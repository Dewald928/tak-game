import { useRef, useEffect, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

interface Piece {
  player: "white" | "black";
  type: "flat" | "wall" | "capstone";
}

interface Board3DProps {
  boardSize: number;
  board: Piece[][][];
  onSquareClick: (row: number, col: number) => void;
  selectedStack?: { row: number; col: number } | null;
  isMyTurn: boolean;
  isLoading: boolean;
}

export function Board3D({
  boardSize,
  board,
  onSquareClick,
  selectedStack,
  isMyTurn,
  isLoading,
}: Board3DProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const raycasterRef = useRef<THREE.Raycaster | null>(null);
  const mouseRef = useRef<THREE.Vector2 | null>(null);
  const squareObjectsRef = useRef<THREE.Mesh[][]>([]);
  const pieceObjectsRef = useRef<THREE.Group[][][]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const clickHandlerRef = useRef<((row: number, col: number) => void) | null>(
    null
  );

  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep click handler ref updated
  useEffect(() => {
    clickHandlerRef.current = onSquareClick;
  }, [onSquareClick]);

  // Initialize Three.js scene (once only)
  useEffect(() => {
    if (!mountRef.current || isInitialized) return;

    console.log("Board3D: Starting initialization...");

    try {
      const container = mountRef.current;
      const width = container.clientWidth || 400;
      const height = container.clientHeight || 400;

      console.log("Board3D: Container dimensions:", { width, height });

      // Scene
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0xf5f5dc);
      sceneRef.current = scene;

      // Camera
      const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
      camera.position.set(boardSize * 2, boardSize * 2, boardSize * 2);
      camera.lookAt(boardSize / 2, 0, boardSize / 2);
      cameraRef.current = camera;

      // Renderer
      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setSize(width, height);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;

      console.log("Board3D: Renderer created, appending to container");
      container.appendChild(renderer.domElement);
      rendererRef.current = renderer;

      // OrbitControls for zoom and rotation
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.target.set(boardSize / 2, 0, boardSize / 2); // Look at center of board
      controls.enableDamping = true; // Smooth movement
      controls.dampingFactor = 0.05;
      controls.enableZoom = true;
      controls.enableRotate = true;
      controls.enablePan = true;

      // Limit zoom and rotation for better UX
      controls.minDistance = boardSize * 0.5; // Minimum zoom
      controls.maxDistance = boardSize * 4; // Maximum zoom
      controls.maxPolarAngle = Math.PI * 0.7; // Prevent going under the board
      controls.minPolarAngle = Math.PI * 0.1; // Prevent going too high

      controlsRef.current = controls;

      // Raycaster for mouse interaction
      raycasterRef.current = new THREE.Raycaster();
      mouseRef.current = new THREE.Vector2();

      // Lighting
      const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
      scene.add(ambientLight);

      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
      directionalLight.position.set(
        boardSize * 2,
        boardSize * 3,
        boardSize * 2
      );
      directionalLight.castShadow = true;
      directionalLight.shadow.mapSize.width = 2048;
      directionalLight.shadow.mapSize.height = 2048;
      scene.add(directionalLight);

      // Create board squares
      const squareGeometry = new THREE.PlaneGeometry(0.9, 0.9);
      const squareMaterial = new THREE.MeshLambertMaterial({ color: 0xdeb887 });

      squareObjectsRef.current = [];
      for (let row = 0; row < boardSize; row++) {
        squareObjectsRef.current[row] = [];
        for (let col = 0; col < boardSize; col++) {
          const square = new THREE.Mesh(squareGeometry, squareMaterial);
          square.rotation.x = -Math.PI / 2;
          square.position.set(col, 0, row);
          square.receiveShadow = true;
          square.userData = { row, col, type: "square" };
          scene.add(square);
          squareObjectsRef.current[row][col] = square;
        }
      }

      console.log("Board3D: Board squares created:", boardSize * boardSize);

      // Initialize piece objects array
      pieceObjectsRef.current = Array(boardSize)
        .fill(null)
        .map(() =>
          Array(boardSize)
            .fill(null)
            .map(() => [])
        );

      // Animation loop
      const animate = () => {
        animationFrameRef.current = requestAnimationFrame(animate);

        // Update controls
        if (controlsRef.current) {
          controlsRef.current.update();
        }

        if (rendererRef.current && sceneRef.current && cameraRef.current) {
          rendererRef.current.render(sceneRef.current, cameraRef.current);
        }
      };
      animate();

      console.log("Board3D: Animation loop started");

      // Handle resize
      const handleResize = () => {
        if (!container || !cameraRef.current || !rendererRef.current) return;
        const width = container.clientWidth || 400;
        const height = container.clientHeight || 400;
        cameraRef.current.aspect = width / height;
        cameraRef.current.updateProjectionMatrix();
        rendererRef.current.setSize(width, height);
      };
      window.addEventListener("resize", handleResize);

      setIsInitialized(true);
      console.log("Board3D: Initialization complete");

      // Cleanup function
      return () => {
        console.log("Board3D: Cleaning up Three.js scene...");
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
        window.removeEventListener("resize", handleResize);

        if (controlsRef.current) {
          controlsRef.current.dispose();
        }

        if (
          container &&
          renderer.domElement &&
          container.contains(renderer.domElement)
        ) {
          container.removeChild(renderer.domElement);
        }

        // Clean up Three.js resources
        renderer.dispose();
        squareGeometry.dispose();
        squareMaterial.dispose();
      };
    } catch (err) {
      console.error("Board3D: Initialization error:", err);
      setError(
        `Failed to initialize 3D board: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    }
  }, [boardSize]); // Only depend on boardSize

  // Set up mouse event handlers (separate effect)
  useEffect(() => {
    if (!isInitialized || !rendererRef.current) return;

    const renderer = rendererRef.current;
    let isDragging = false;
    let mouseDownTime = 0;

    const handleMouseDown = () => {
      isDragging = false;
      mouseDownTime = Date.now();
    };

    const handleMouseMove = () => {
      isDragging = true;
    };

    const handleMouseClick = (event: MouseEvent) => {
      // Only process clicks if we're not dragging and it was a quick click
      const clickDuration = Date.now() - mouseDownTime;
      if (isDragging || clickDuration > 200) return;

      if (
        !isMyTurn ||
        isLoading ||
        !raycasterRef.current ||
        !mouseRef.current ||
        !cameraRef.current ||
        !sceneRef.current
      )
        return;

      const rect = renderer.domElement.getBoundingClientRect();
      mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
      const intersects = raycasterRef.current.intersectObjects(
        sceneRef.current.children
      );

      if (intersects.length > 0) {
        const intersected = intersects[0].object;
        if (intersected.userData.type === "square") {
          const { row, col } = intersected.userData;
          if (clickHandlerRef.current) {
            clickHandlerRef.current(row, col);
          }
        }
      }
    };

    renderer.domElement.addEventListener("mousedown", handleMouseDown);
    renderer.domElement.addEventListener("mousemove", handleMouseMove);
    renderer.domElement.addEventListener("click", handleMouseClick);

    return () => {
      renderer.domElement.removeEventListener("mousedown", handleMouseDown);
      renderer.domElement.removeEventListener("mousemove", handleMouseMove);
      renderer.domElement.removeEventListener("click", handleMouseClick);
    };
  }, [isInitialized, isMyTurn, isLoading]);

  // Update pieces when board changes (separate effect)
  useEffect(() => {
    if (!sceneRef.current || !isInitialized) return;

    const scene = sceneRef.current;

    // Clear existing pieces
    pieceObjectsRef.current.forEach((row) =>
      row.forEach((col) =>
        col.forEach((group) => {
          scene.remove(group);
          // Dispose of geometries and materials
          group.children.forEach((child) => {
            if (child instanceof THREE.Mesh) {
              child.geometry.dispose();
              if (Array.isArray(child.material)) {
                child.material.forEach((mat) => mat.dispose());
              } else {
                child.material.dispose();
              }
            }
          });
        })
      )
    );

    // Reset piece objects array
    pieceObjectsRef.current = Array(boardSize)
      .fill(null)
      .map(() =>
        Array(boardSize)
          .fill(null)
          .map(() => [])
      );

    // Add current pieces
    for (let row = 0; row < boardSize; row++) {
      for (let col = 0; col < boardSize; col++) {
        const stack = board[row][col];
        for (let i = 0; i < stack.length; i++) {
          const piece = stack[i];
          const group = createPieceObject(piece);
          group.position.set(col, i * 0.1, row);
          scene.add(group);
          pieceObjectsRef.current[row][col].push(group);
        }
      }
    }
  }, [board, boardSize, isInitialized]);

  // Update selected square highlighting (separate effect)
  useEffect(() => {
    if (!squareObjectsRef.current.length || !isInitialized) return;

    const selectedMaterial = new THREE.MeshLambertMaterial({ color: 0x90ee90 });
    const normalMaterial = new THREE.MeshLambertMaterial({ color: 0xdeb887 });

    // Reset all squares to normal
    squareObjectsRef.current.forEach((row) =>
      row.forEach((square) => {
        if (square.material !== normalMaterial) {
          square.material = normalMaterial;
        }
      })
    );

    // Highlight selected square
    if (selectedStack) {
      const square =
        squareObjectsRef.current[selectedStack.row]?.[selectedStack.col];
      if (square) {
        square.material = selectedMaterial;
      }
    }

    // Cleanup materials when effect runs again
    return () => {
      selectedMaterial.dispose();
      normalMaterial.dispose();
    };
  }, [selectedStack, isInitialized]);

  const createPieceObject = (piece: Piece): THREE.Group => {
    const group = new THREE.Group();

    let geometry: THREE.BufferGeometry;
    let material: THREE.Material;

    // Create geometry based on piece type
    if (piece.type === "flat") {
      geometry = new THREE.CylinderGeometry(0.35, 0.35, 0.08, 16);
    } else if (piece.type === "wall") {
      geometry = new THREE.BoxGeometry(0.7, 0.4, 0.1);
    } else {
      // capstone
      geometry = new THREE.CylinderGeometry(0.3, 0.4, 0.15, 8);
    }

    // Create material based on player
    if (piece.player === "white") {
      material = new THREE.MeshLambertMaterial({ color: 0xf5f5f5 });
    } else {
      material = new THREE.MeshLambertMaterial({ color: 0x2c2c2c });
    }

    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    if (piece.type === "wall") {
      mesh.rotation.y = Math.PI / 4; // Rotate walls for visual distinction
    }

    group.add(mesh);
    return group;
  };

  if (error) {
    return (
      <div className="w-full h-full min-h-96 bg-red-100 rounded-lg flex items-center justify-center">
        <div className="text-center p-4">
          <h3 className="text-lg font-medium text-red-800 mb-2">
            3D Board Error
          </h3>
          <p className="text-sm text-red-600">{error}</p>
          <p className="text-xs text-red-500 mt-2">
            Your browser may not support WebGL. Try refreshing the page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={mountRef}
      className="w-full h-full min-h-96 bg-gradient-to-b from-sky-200 to-sky-100 rounded-lg overflow-hidden relative"
      style={{
        cursor: isMyTurn && !isLoading ? "pointer" : "default",
        minHeight: "400px",
      }}
    >
      {!isInitialized && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <p className="text-sm text-gray-600">Loading 3D Board...</p>
          </div>
        </div>
      )}
      {isInitialized && (
        <>
          <div className="absolute top-2 left-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">
            3D Board Active
          </div>
          <div className="absolute top-2 right-2 bg-black bg-opacity-70 text-white text-xs px-3 py-2 rounded max-w-48">
            <div className="font-semibold mb-1">Controls:</div>
            <div>• Left click: Place piece</div>
            <div>• Left drag: Rotate view</div>
            <div>• Scroll: Zoom in/out</div>
            <div>• Right drag: Pan view</div>
          </div>
        </>
      )}
    </div>
  );
}
