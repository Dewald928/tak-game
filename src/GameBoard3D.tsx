import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { useState, useRef, useEffect, useCallback } from "react";
import { toast } from "sonner";
import * as THREE from "three";

interface GameBoardProps {
  gameId: Id<"games">;
}

interface Piece {
  type: "flat" | "standing" | "capstone";
  player: "white" | "black";
}

type GameMode = "place" | "move";

export function GameBoard3D({ gameId }: GameBoardProps) {
  const game = useQuery(api.games.getGame, { gameId });
  const gameMoves = useQuery(api.games.getGameMoves, { gameId });
  const loggedInUser = useQuery(api.auth.loggedInUser);
  const placePiece = useMutation(api.games.placePiece);
  const movePieces = useMutation(api.games.movePieces);
  const resign = useMutation(api.games.resign);

  const [selectedPieceType, setSelectedPieceType] = useState<
    "flat" | "standing" | "capstone"
  >("flat");
  const [gameMode, setGameMode] = useState<GameMode>("place");
  const [isPlacing, setIsPlacing] = useState(false);
  const [hoveredCell, setHoveredCell] = useState<{
    row: number;
    col: number;
  } | null>(null);
  const prevHoveredCellRef = useRef<{ row: number; col: number } | null>(null);

  // Movement state
  const [selectedStack, setSelectedStack] = useState<{
    row: number;
    col: number;
  } | null>(null);
  const [stackSize, setStackSize] = useState(1);
  const [movePath, setMovePath] = useState<{ row: number; col: number }[]>([]);
  const [dropPattern, setDropPattern] = useState<number[]>([]);

  // 3D Scene refs
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const boardMeshesRef = useRef<THREE.Mesh[][]>([]);
  const pieceMeshesRef = useRef<THREE.Group[][][]>([]);
  const raycasterRef = useRef<THREE.Raycaster | null>(null);
  const mouseRef = useRef<THREE.Vector2 | null>(null);
  const previewPieceRef = useRef<THREE.Group | null>(null);

  // Helper function to check if a move is valid
  const isValidMove = useCallback(
    (row: number, col: number): boolean => {
      if (!game || !loggedInUser) return false;

      const userColor =
        game.whitePlayer === loggedInUser._id ? "white" : "black";
      const isUserTurn =
        game.currentPlayer === userColor && game.status === "active";
      const isOpeningPhase =
        (game.isOpeningPhase ?? false) && game.moveCount < 2;

      if (!isUserTurn) return false;

      if (gameMode === "place") {
        return game.board[row][col].length === 0; // Empty cell
      } else if (gameMode === "move") {
        if (!selectedStack) {
          // Selecting a stack - must have pieces and be controlled by player
          const stack = game.board[row][col];
          if (stack.length === 0) return false;
          const topPiece = stack[stack.length - 1];
          return topPiece.player === userColor;
        } else {
          // Moving to a position - check if it's a valid move destination
          if (selectedStack.row === row && selectedStack.col === col)
            return true; // Deselect

          // Check if it's in a straight line
          const rowDiff = row - selectedStack.row;
          const colDiff = col - selectedStack.col;
          if (
            (rowDiff !== 0 && colDiff !== 0) ||
            (rowDiff === 0 && colDiff === 0)
          )
            return false;

          // Check path for obstructions (walls and capstones)
          const stepRow = rowDiff === 0 ? 0 : rowDiff / Math.abs(rowDiff);
          const stepCol = colDiff === 0 ? 0 : colDiff / Math.abs(colDiff);
          const distance = Math.abs(rowDiff) + Math.abs(colDiff);

          // Check each square along the path
          for (let i = 1; i <= distance; i++) {
            const checkRow = selectedStack.row + stepRow * i;
            const checkCol = selectedStack.col + stepCol * i;
            const targetStack = game.board[checkRow][checkCol];

            if (targetStack.length > 0) {
              const topPiece = targetStack[targetStack.length - 1];

              // Can't move onto capstones
              if (topPiece.type === "capstone") {
                return false;
              }

              // Can only move onto walls with capstones, and only as final destination
              if (topPiece.type === "standing") {
                const movingStack =
                  game.board[selectedStack.row][selectedStack.col];
                const movingTopPiece = movingStack[movingStack.length - 1];

                // Only capstones can move onto walls, and only as the final move
                if (
                  movingTopPiece.type !== "capstone" ||
                  i !== distance ||
                  stackSize !== 1
                ) {
                  return false;
                }
              }
            }
          }

          return true;
        }
      }

      return false;
    },
    [game, loggedInUser, gameMode, selectedStack, stackSize]
  );

  // Initialize 3D scene (only when game changes)
  useEffect(() => {
    if (!mountRef.current || !game) return;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf8f9fa);
    sceneRef.current = scene;

    // Camera setup - much closer and more zoomed in
    const camera = new THREE.PerspectiveCamera(45, 1000 / 700, 0.1, 1000);
    const boardCenter = (game.boardSize - 1) / 2;
    camera.position.set(
      boardCenter + game.boardSize * 0.8,
      game.boardSize * 1.2,
      boardCenter + game.boardSize * 0.8
    );
    camera.lookAt(boardCenter, 0, boardCenter);
    cameraRef.current = camera;

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(1000, 700);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0xf8f9fa);
    rendererRef.current = renderer;

    // Enhanced lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(
      game.boardSize * 2,
      game.boardSize * 2,
      game.boardSize
    );
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 4096;
    directionalLight.shadow.mapSize.height = 4096;
    directionalLight.shadow.camera.near = 0.1;
    directionalLight.shadow.camera.far = game.boardSize * 10;
    directionalLight.shadow.camera.left = -game.boardSize * 2;
    directionalLight.shadow.camera.right = game.boardSize * 2;
    directionalLight.shadow.camera.top = game.boardSize * 2;
    directionalLight.shadow.camera.bottom = -game.boardSize * 2;
    scene.add(directionalLight);

    // Add a rim light for better piece visibility
    const rimLight = new THREE.DirectionalLight(0x87ceeb, 0.3);
    rimLight.position.set(-game.boardSize, game.boardSize, -game.boardSize);
    scene.add(rimLight);

    // Create board base and labels (static elements)
    const boardGeometry = new THREE.BoxGeometry(
      game.boardSize + 0.5,
      0.2,
      game.boardSize + 0.5
    );
    const boardMaterial = new THREE.MeshLambertMaterial({ color: 0x8b4513 });
    const boardBase = new THREE.Mesh(boardGeometry, boardMaterial);
    boardBase.position.set(
      (game.boardSize - 1) / 2,
      -0.1,
      (game.boardSize - 1) / 2
    );
    boardBase.receiveShadow = true;
    scene.add(boardBase);

    // Create axis labels
    const createAxisLabel = (
      text: string,
      position: THREE.Vector3,
      rotation?: THREE.Euler
    ) => {
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      if (!context) return;

      canvas.width = 128;
      canvas.height = 128;

      context.fillStyle = "#92400e"; // amber-800
      context.font = "bold 48px Arial";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(text, 64, 64);

      const texture = new THREE.CanvasTexture(canvas);
      const material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        alphaTest: 0.1,
      });
      const geometry = new THREE.PlaneGeometry(0.4, 0.4);
      const mesh = new THREE.Mesh(geometry, material);

      mesh.position.copy(position);
      if (rotation) {
        mesh.rotation.copy(rotation);
      }
      mesh.rotation.x = -Math.PI / 2; // Lay flat on the ground

      scene.add(mesh);
    };

    // Add column labels (A, B, C, etc.)
    for (let col = 0; col < game.boardSize; col++) {
      const letter = String.fromCharCode(65 + col); // A, B, C, etc.
      // Bottom edge
      createAxisLabel(letter, new THREE.Vector3(col, 0.05, -0.6));
      // Top edge
      createAxisLabel(
        letter,
        new THREE.Vector3(col, 0.05, game.boardSize - 0.4)
      );
    }

    // Add row labels (1, 2, 3, etc.)
    for (let row = 0; row < game.boardSize; row++) {
      const number = (row + 1).toString();
      // Left edge
      createAxisLabel(number, new THREE.Vector3(-0.6, 0.05, row));
      // Right edge
      createAxisLabel(
        number,
        new THREE.Vector3(game.boardSize - 0.4, 0.05, row)
      );
    }

    // Initialize board meshes array
    boardMeshesRef.current = [];
    pieceMeshesRef.current = [];
    for (let row = 0; row < game.boardSize; row++) {
      boardMeshesRef.current[row] = [];
      pieceMeshesRef.current[row] = [];
      for (let col = 0; col < game.boardSize; col++) {
        pieceMeshesRef.current[row][col] = [];
      }
    }

    // Raycaster for mouse interaction
    raycasterRef.current = new THREE.Raycaster();
    mouseRef.current = new THREE.Vector2();

    // Clear previous canvas if exists
    if (mountRef.current.firstChild) {
      mountRef.current.removeChild(mountRef.current.firstChild);
    }
    mountRef.current.appendChild(renderer.domElement);

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [game?.boardSize, game?._id]);

  // Update interaction handlers when game state changes
  useEffect(() => {
    if (!rendererRef.current || !game) return;

    const renderer = rendererRef.current;
    const camera = cameraRef.current;

    // Mouse controls
    let isMouseDown = false;
    let mouseX = 0;
    let mouseY = 0;

    const handleMouseMove = (event: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouseRef.current!.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current!.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      // Handle hover for preview
      if (
        !isMouseDown &&
        raycasterRef.current &&
        mouseRef.current &&
        cameraRef.current
      ) {
        raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
        const intersects = raycasterRef.current.intersectObjects(
          boardMeshesRef.current.flat()
        );

        if (intersects.length > 0) {
          const mesh = intersects[0].object as THREE.Mesh & {
            userData: { row: number; col: number };
          };
          if (mesh.userData) {
            const newRow = mesh.userData.row;
            const newCol = mesh.userData.col;

            // Only update state if the cell actually changed
            setHoveredCell((prevCell) => {
              if (prevCell?.row === newRow && prevCell?.col === newCol) {
                return prevCell; // No change, return the same object
              }
              return { row: newRow, col: newCol };
            });
          }
        } else {
          setHoveredCell((prevCell) => (prevCell === null ? prevCell : null));
        }
      }

      if (isMouseDown) {
        const deltaX = event.clientX - mouseX;
        const deltaY = event.clientY - mouseY;

        // Rotate camera around the board center
        const boardCenter = (game.boardSize - 1) / 2;
        const radius = Math.sqrt(
          (camera!.position.x - boardCenter) ** 2 +
            (camera!.position.z - boardCenter) ** 2
        );
        const currentAngle = Math.atan2(
          camera!.position.z - boardCenter,
          camera!.position.x - boardCenter
        );
        const newAngle = currentAngle - deltaX * 0.01;

        camera!.position.x = boardCenter + radius * Math.cos(newAngle);
        camera!.position.z = boardCenter + radius * Math.sin(newAngle);
        camera!.position.y = Math.max(
          game.boardSize * 0.5,
          camera!.position.y - deltaY * 0.01
        );

        camera!.lookAt(boardCenter, 0, boardCenter);
      }

      mouseX = event.clientX;
      mouseY = event.clientY;
    };

    const handleMouseDown = (event: MouseEvent) => {
      if (event.button === 0) {
        // Left click for camera rotation
        isMouseDown = true;
      }
    };

    const handleMouseUp = () => {
      isMouseDown = false;
    };

    const handleClick = () => {
      if (!raycasterRef.current || !mouseRef.current || !cameraRef.current)
        return;

      raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
      const intersects = raycasterRef.current.intersectObjects(
        boardMeshesRef.current.flat()
      );

      if (intersects.length > 0) {
        const mesh = intersects[0].object as THREE.Mesh & {
          userData: { row: number; col: number };
        };
        if (mesh.userData) {
          void handleCellClick(mesh.userData.row, mesh.userData.col);
        }
      }
    };

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const boardCenter = (game.boardSize - 1) / 2;
      const direction = new THREE.Vector3();
      direction.subVectors(
        camera!.position,
        new THREE.Vector3(boardCenter, 0, boardCenter)
      );

      const zoomFactor = event.deltaY > 0 ? 1.1 : 0.9;
      direction.multiplyScalar(zoomFactor);

      camera!.position.copy(
        new THREE.Vector3(boardCenter, 0, boardCenter).add(direction)
      );
      camera!.position.y = Math.max(game.boardSize * 0.3, camera!.position.y);
      camera!.lookAt(boardCenter, 0, boardCenter);
    };

    renderer.domElement.addEventListener("mousemove", handleMouseMove);
    renderer.domElement.addEventListener("mousedown", handleMouseDown);
    renderer.domElement.addEventListener("mouseup", handleMouseUp);
    renderer.domElement.addEventListener("click", handleClick);
    renderer.domElement.addEventListener("wheel", handleWheel, {
      passive: false,
    });

    return () => {
      renderer.domElement.removeEventListener("mousemove", handleMouseMove);
      renderer.domElement.removeEventListener("mousedown", handleMouseDown);
      renderer.domElement.removeEventListener("mouseup", handleMouseUp);
      renderer.domElement.removeEventListener("click", handleClick);
      renderer.domElement.removeEventListener("wheel", handleWheel);
    };
  }, [game, loggedInUser, gameMode, selectedStack, movePath]);

  // Update pieces when game state changes
  useEffect(() => {
    if (!game || !sceneRef.current) return;
    updatePieces();
  }, [game?.board, game?.moveCount, selectedStack, movePath]);

  // Handle hover effects separately to avoid flashing
  useEffect(() => {
    if (!game || !sceneRef.current) return;
    updateHoverEffects();
  }, [hoveredCell, gameMode, selectedPieceType, loggedInUser]);

  // Memoized function to check if a hover is valid (for hover effects only)
  const isValidHover = useCallback(
    (row: number, col: number): boolean => {
      if (!game || !loggedInUser) return false;

      const userColor =
        game.whitePlayer === loggedInUser._id ? "white" : "black";
      const isUserTurn =
        game.currentPlayer === userColor && game.status === "active";

      if (!isUserTurn) return false;

      if (gameMode === "place") {
        return game.board[row][col].length === 0; // Empty cell
      } else if (gameMode === "move") {
        if (!selectedStack) {
          // Selecting a stack - must have pieces and be controlled by player
          const stack = game.board[row][col];
          if (stack.length === 0) return false;
          const topPiece = stack[stack.length - 1];
          return topPiece.player === userColor;
        } else {
          // Moving to a position - simplified check for hover
          if (selectedStack.row === row && selectedStack.col === col)
            return true;

          // Check if it's in a straight line
          const rowDiff = row - selectedStack.row;
          const colDiff = col - selectedStack.col;
          return !(
            (rowDiff !== 0 && colDiff !== 0) ||
            (rowDiff === 0 && colDiff === 0)
          );
        }
      }

      return false;
    },
    [game, loggedInUser, gameMode, selectedStack]
  );

  // Helper function to get board cell color
  const getBoardCellColor = useCallback(
    (row: number, col: number): number => {
      const isHovered =
        hoveredCell && hoveredCell.row === row && hoveredCell.col === col;
      const isValid = isHovered && isValidHover(row, col);
      const isSelected =
        selectedStack && selectedStack.row === row && selectedStack.col === col;
      const isInPath = movePath.some(
        (pos) => pos.row === row && pos.col === col
      );

      if (isSelected) {
        return 0x22c55e; // Green for selected
      } else if (isInPath) {
        return 0x3b82f6; // Blue for path
      } else if (isValid) {
        return 0x10b981; // Valid move highlight
      } else if (isHovered) {
        return 0x9ca3af; // Light gray hover
      } else {
        return (row + col) % 2 === 0 ? 0xf9fafb : 0xf3f4f6;
      }
    },
    [hoveredCell, selectedStack, movePath, isValidHover]
  );

  // Update only specific cells that changed
  const updateCellColors = useCallback(
    (cells: { row: number; col: number }[]) => {
      if (!game || !sceneRef.current || boardMeshesRef.current.length === 0)
        return;

      cells.forEach(({ row, col }) => {
        if (
          row >= 0 &&
          row < game.boardSize &&
          col >= 0 &&
          col < game.boardSize
        ) {
          const mesh = boardMeshesRef.current[row]?.[col];
          if (mesh) {
            const color = getBoardCellColor(row, col);
            (mesh.material as THREE.MeshLambertMaterial).color.setHex(color);
          }
        }
      });
    },
    [game, getBoardCellColor]
  );

  // Handle hover cell changes efficiently
  useEffect(() => {
    const cellsToUpdate: { row: number; col: number }[] = [];

    // Add previous hovered cell to update list
    if (prevHoveredCellRef.current) {
      cellsToUpdate.push(prevHoveredCellRef.current);
    }

    // Add current hovered cell to update list
    if (hoveredCell) {
      cellsToUpdate.push(hoveredCell);
    }

    // Update only the affected cells
    updateCellColors(cellsToUpdate);

    // Update preview piece
    updatePreviewPiece();

    // Store current as previous for next time
    prevHoveredCellRef.current = hoveredCell;
  }, [hoveredCell, updateCellColors]);

  // Update preview piece separately
  const updatePreviewPiece = useCallback(() => {
    if (!game || !sceneRef.current) return;

    // Clear existing preview piece
    if (previewPieceRef.current) {
      sceneRef.current.remove(previewPieceRef.current);
      previewPieceRef.current = null;
    }

    // Add preview piece for valid placement
    if (
      hoveredCell &&
      gameMode === "place" &&
      isValidHover(hoveredCell.row, hoveredCell.col)
    ) {
      const userColor =
        game.whitePlayer === loggedInUser?._id ? "white" : "black";
      const isOpeningPhase =
        (game.isOpeningPhase ?? false) && game.moveCount < 2;

      let pieceOwner: "white" | "black" = userColor;
      if (isOpeningPhase) {
        pieceOwner = userColor === "white" ? "black" : "white";
      }

      const previewPiece = createPieceMesh(
        {
          type: selectedPieceType,
          player: pieceOwner,
        },
        0
      );

      previewPiece.position.x = hoveredCell.col;
      previewPiece.position.z = hoveredCell.row;

      // Make preview semi-transparent
      previewPiece.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.material = child.material.clone();
          child.material.transparent = true;
          child.material.opacity = 0.6;
        }
      });

      sceneRef.current.add(previewPiece);
      previewPieceRef.current = previewPiece;
    }
  }, [
    game,
    hoveredCell,
    gameMode,
    selectedPieceType,
    loggedInUser,
    isValidHover,
  ]);

  // Update all board colors when game state changes
  const updateAllBoardColors = useCallback(() => {
    if (!game || !sceneRef.current || boardMeshesRef.current.length === 0)
      return;

    const allCells: { row: number; col: number }[] = [];
    for (let row = 0; row < game.boardSize; row++) {
      for (let col = 0; col < game.boardSize; col++) {
        allCells.push({ row, col });
      }
    }
    updateCellColors(allCells);
  }, [game, updateCellColors]);

  // Update board colors when selection or path changes
  useEffect(() => {
    updateAllBoardColors();
  }, [selectedStack, movePath, updateAllBoardColors]);

  const updateHoverEffects = useCallback(() => {
    if (!game || !sceneRef.current) return;

    // Update board colors
    if (boardMeshesRef.current.length > 0) {
      for (let row = 0; row < game.boardSize; row++) {
        for (let col = 0; col < game.boardSize; col++) {
          const mesh = boardMeshesRef.current[row]?.[col];
          if (!mesh) continue;

          let color: number;

          const isHovered =
            hoveredCell && hoveredCell.row === row && hoveredCell.col === col;
          const isValid = isHovered && isValidHover(row, col);
          const isSelected =
            selectedStack &&
            selectedStack.row === row &&
            selectedStack.col === col;
          const isInPath = movePath.some(
            (pos) => pos.row === row && pos.col === col
          );

          if (isSelected) {
            color = 0x22c55e; // Green for selected
          } else if (isInPath) {
            color = 0x3b82f6; // Blue for path
          } else if (isValid) {
            color = 0x10b981; // Valid move highlight
          } else if (isHovered) {
            color = 0x9ca3af; // Light gray hover
          } else {
            color = (row + col) % 2 === 0 ? 0xf9fafb : 0xf3f4f6;
          }

          (mesh.material as THREE.MeshLambertMaterial).color.setHex(color);
        }
      }
    }

    // Clear existing preview piece
    if (previewPieceRef.current) {
      sceneRef.current.remove(previewPieceRef.current);
      previewPieceRef.current = null;
    }

    // Add preview piece for valid placement
    if (
      hoveredCell &&
      gameMode === "place" &&
      isValidHover(hoveredCell.row, hoveredCell.col)
    ) {
      const userColor =
        game.whitePlayer === loggedInUser?._id ? "white" : "black";
      const isOpeningPhase =
        (game.isOpeningPhase ?? false) && game.moveCount < 2;

      let pieceOwner: "white" | "black" = userColor;
      if (isOpeningPhase) {
        pieceOwner = userColor === "white" ? "black" : "white";
      }

      const previewPiece = createPieceMesh(
        {
          type: selectedPieceType,
          player: pieceOwner,
        },
        0
      );

      previewPiece.position.x = hoveredCell.col;
      previewPiece.position.z = hoveredCell.row;

      // Make preview semi-transparent
      previewPiece.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.material = child.material.clone();
          child.material.transparent = true;
          child.material.opacity = 0.6;
        }
      });

      sceneRef.current.add(previewPiece);
      previewPieceRef.current = previewPiece;
    }
  }, [
    game,
    hoveredCell,
    gameMode,
    selectedPieceType,
    loggedInUser,
    selectedStack,
    movePath,
    isValidHover,
  ]);

  // Handle hover effects separately to avoid flashing
  useEffect(() => {
    updateHoverEffects();
  }, [updateHoverEffects]);

  // Create and update board squares
  useEffect(() => {
    if (!game || !sceneRef.current) return;

    // Clear existing board squares
    for (let row = 0; row < boardMeshesRef.current.length; row++) {
      for (let col = 0; col < boardMeshesRef.current[row].length; col++) {
        if (boardMeshesRef.current[row][col]) {
          sceneRef.current.remove(boardMeshesRef.current[row][col]);
        }
      }
    }

    // Create board squares
    for (let row = 0; row < game.boardSize; row++) {
      if (!boardMeshesRef.current[row]) {
        boardMeshesRef.current[row] = [];
      }

      for (let col = 0; col < game.boardSize; col++) {
        // Board square
        const geometry = new THREE.BoxGeometry(0.95, 0.05, 0.95);
        let material: THREE.MeshLambertMaterial;

        // Determine square color based on state
        const isHovered =
          hoveredCell && hoveredCell.row === row && hoveredCell.col === col;
        const isValid = isHovered && isValidMove(row, col);
        const isSelected =
          selectedStack &&
          selectedStack.row === row &&
          selectedStack.col === col;
        const isInPath = movePath.some(
          (pos) => pos.row === row && pos.col === col
        );

        if (isSelected) {
          material = new THREE.MeshLambertMaterial({ color: 0x22c55e }); // Green for selected
        } else if (isInPath) {
          material = new THREE.MeshLambertMaterial({ color: 0x3b82f6 }); // Blue for path
        } else if (isValid) {
          material = new THREE.MeshLambertMaterial({ color: 0x10b981 }); // Valid move highlight
        } else if (isHovered) {
          material = new THREE.MeshLambertMaterial({ color: 0x6b7280 }); // Gray hover
        } else {
          material = new THREE.MeshLambertMaterial({
            color: (row + col) % 2 === 0 ? 0xf3f4f6 : 0xe5e7eb,
          });
        }

        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(col, 0.025, row);
        mesh.receiveShadow = true;
        mesh.userData = { row, col };

        sceneRef.current.add(mesh);
        boardMeshesRef.current[row][col] = mesh;
      }
    }
  }, [game, hoveredCell, selectedStack, movePath, loggedInUser, gameMode]);

  const createPieceMesh = (piece: Piece, stackIndex: number) => {
    const group = new THREE.Group();

    let geometry: THREE.BufferGeometry;
    let material: THREE.MeshLambertMaterial;

    if (piece.type === "capstone") {
      // Capstone: Distinctive sphere with gold accent
      geometry = new THREE.SphereGeometry(0.35, 20, 16);
      if (piece.player === "white") {
        material = new THREE.MeshLambertMaterial({
          color: 0xffffff,
          emissive: 0xaaaaaa,
          emissiveIntensity: 0.6,
        });
      } else {
        material = new THREE.MeshLambertMaterial({ color: 0x1f2937 });
      }

      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      // Add golden ring for capstones
      const ringGeometry = new THREE.TorusGeometry(0.3, 0.03, 8, 16);
      const ringMaterial = new THREE.MeshLambertMaterial({ color: 0xffd700 });
      const ring = new THREE.Mesh(ringGeometry, ringMaterial);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.1;
      group.add(ring);

      group.add(mesh);
    } else {
      // Flat and Standing stones: Square Box
      geometry = new THREE.BoxGeometry(0.76, 0.12, 0.76);
      if (piece.player === "white") {
        material = new THREE.MeshLambertMaterial({
          color: 0xffffff,
          emissive: 0xaaaaaa,
          emissiveIntensity: 0.6,
        });
      } else {
        material = new THREE.MeshLambertMaterial({ color: 0x1f2937 });
      }

      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      if (piece.type === "standing") {
        // Rotate to standing position and make thinner
        mesh.rotation.z = Math.PI / 2;
        mesh.scale.set(1, 0.3, 1);
      }

      group.add(mesh);
    }

    // Position piece in stack with proper spacing
    group.position.y = 0.1 + stackIndex * 0.15;

    return group;
  };

  const updatePieces = () => {
    if (!game || !sceneRef.current) return;

    // Clear existing pieces
    pieceMeshesRef.current.forEach((row) => {
      row.forEach((col) => {
        col.forEach((group) => {
          sceneRef.current!.remove(group);
        });
      });
    });

    // Add current pieces with enhanced stacking
    for (let row = 0; row < game.boardSize; row++) {
      for (let col = 0; col < game.boardSize; col++) {
        // Ensure pieceMeshesRef array exists
        if (!pieceMeshesRef.current[row]) {
          pieceMeshesRef.current[row] = [];
        }
        if (!pieceMeshesRef.current[row][col]) {
          pieceMeshesRef.current[row][col] = [];
        }

        pieceMeshesRef.current[row][col] = [];
        const stack = game.board[row][col];

        stack.forEach((piece, stackIndex) => {
          const pieceMesh = createPieceMesh(piece, stackIndex);
          pieceMesh.position.x = col;
          pieceMesh.position.z = row;

          // Add glow effect for top pieces
          if (stackIndex === stack.length - 1 && stack.length > 1) {
            const glowGeometry = new THREE.SphereGeometry(0.5, 16, 16);
            const glowMaterial = new THREE.MeshBasicMaterial({
              color: piece.player === "white" ? 0x3b82f6 : 0xef4444,
              transparent: true,
              opacity: 0.1,
            });
            const glow = new THREE.Mesh(glowGeometry, glowMaterial);
            glow.position.copy(pieceMesh.position);
            glow.position.y = pieceMesh.position.y + 0.1;
            sceneRef.current!.add(glow);
          }

          sceneRef.current!.add(pieceMesh);
          pieceMeshesRef.current[row][col].push(pieceMesh);
        });
      }
    }
  };

  if (!game || !loggedInUser) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div>
      </div>
    );
  }

  const userColor = game.whitePlayer === loggedInUser._id ? "white" : "black";
  const isUserTurn =
    game.currentPlayer === userColor && game.status === "active";
  const userPieces =
    userColor === "white" ? game.whitePieces : game.blackPieces;
  const isOpeningPhase = (game.isOpeningPhase ?? false) && game.moveCount < 2;

  const handleCellClick = async (row: number, col: number) => {
    if (!isUserTurn || isPlacing || game.status !== "active") return;

    if (gameMode === "place") {
      if (game.board[row][col].length > 0) return; // Cell not empty

      setIsPlacing(true);
      try {
        const result = await placePiece({
          gameId,
          row,
          col,
          pieceType: selectedPieceType,
        });

        if (result.winner) {
          const winMessage =
            result.winCondition === "road"
              ? "road"
              : result.winCondition === "flat"
                ? "flat win"
                : result.winCondition;
          toast.success(
            `${result.winner === "draw" ? "Draw" : `${result.winner} wins`} by ${winMessage}!`
          );
        } else if (result.takWarning) {
          toast.warning(
            `Tak! ${result.takWarning} is one move away from winning!`,
            {
              duration: 5000,
              style: { backgroundColor: "#fbbf24", color: "#92400e" },
            }
          );
        }
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to place piece"
        );
      } finally {
        setIsPlacing(false);
      }
    } else if (gameMode === "move") {
      if (!selectedStack) {
        // Select a stack to move
        const stack = game.board[row][col];
        if (stack.length === 0) return;

        const topPiece = stack[stack.length - 1];
        if (topPiece.player !== userColor) {
          toast.error("You don't control this stack");
          return;
        }

        setSelectedStack({ row, col });
        setStackSize(Math.min(stack.length, game.boardSize));
        setMovePath([]);
        setDropPattern([]);
      } else if (selectedStack.row === row && selectedStack.col === col) {
        // Deselect
        setSelectedStack(null);
        setMovePath([]);
        setDropPattern([]);
      } else {
        // Try to move to this position
        if (movePath.length === 0) {
          // Start building path
          const rowDiff = row - selectedStack.row;
          const colDiff = col - selectedStack.col;

          if (
            (rowDiff !== 0 && colDiff !== 0) ||
            (rowDiff === 0 && colDiff === 0)
          ) {
            toast.error("Must move in a straight line");
            return;
          }

          setMovePath([{ row, col }]);
          setDropPattern([1]);
        } else {
          // Continue path or execute move
          const lastPos = movePath[movePath.length - 1];
          const rowDiff = row - lastPos.row;
          const colDiff = col - lastPos.col;

          // Check if continuing in same direction
          const pathRowDiff = movePath[0].row - selectedStack.row;
          const pathColDiff = movePath[0].col - selectedStack.col;
          const pathStepRow =
            pathRowDiff === 0 ? 0 : pathRowDiff / Math.abs(pathRowDiff);
          const pathStepCol =
            pathColDiff === 0 ? 0 : pathColDiff / Math.abs(pathColDiff);

          if (
            (rowDiff === pathStepRow && colDiff === 0) ||
            (rowDiff === 0 && colDiff === pathStepCol)
          ) {
            // Continue path
            setMovePath([...movePath, { row, col }]);
            setDropPattern([...dropPattern, 1]);
          } else {
            // Execute move
            void executeMove();
          }
        }
      }
    }
  };

  const executeMove = async () => {
    if (!selectedStack || movePath.length === 0) return;

    setIsPlacing(true);
    try {
      const result = await movePieces({
        gameId,
        fromRow: selectedStack.row,
        fromCol: selectedStack.col,
        toRow: movePath[movePath.length - 1].row,
        toCol: movePath[movePath.length - 1].col,
        stackSize,
        dropPattern,
      });

      if (result.winner) {
        const winMessage =
          result.winCondition === "road"
            ? "road"
            : result.winCondition === "flat"
              ? "flat win"
              : result.winCondition;
        toast.success(
          `${result.winner === "draw" ? "Draw" : `${result.winner} wins`} by ${winMessage}!`
        );
      } else if (result.takWarning) {
        toast.warning(
          `Tak! ${result.takWarning} is one move away from winning!`,
          {
            duration: 5000,
            style: { backgroundColor: "#fbbf24", color: "#92400e" },
          }
        );
      }

      // Reset movement state
      setSelectedStack(null);
      setMovePath([]);
      setDropPattern([]);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to move pieces"
      );
    } finally {
      setIsPlacing(false);
    }
  };

  const handleResign = async () => {
    if (window.confirm("Are you sure you want to resign?")) {
      try {
        await resign({ gameId });
        toast.success("Game resigned");
      } catch (error) {
        toast.error("Failed to resign");
      }
    }
  };

  const updateDropPattern = (index: number, value: number) => {
    const newPattern = [...dropPattern];
    newPattern[index] = Math.max(1, value);

    // Ensure total doesn't exceed stack size
    const total = newPattern.reduce((sum, count) => sum + count, 0);
    if (total <= stackSize) {
      setDropPattern(newPattern);
    }
  };

  return (
    <div className="space-y-6">
      {/* Game Header */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-3xl font-bold text-amber-800">
            Tak {game.boardSize}×{game.boardSize} - 3D View
          </h1>
          <div className="text-right">
            <div className="text-sm text-amber-600">Move {game.moveCount}</div>
            {game.status === "active" && (
              <div
                className={`font-semibold ${game.currentPlayer === "white" ? "text-gray-800" : "text-gray-600"}`}
              >
                {game.currentPlayer === userColor
                  ? "Your turn"
                  : "Opponent's turn"}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-between items-center">
          <div className="flex gap-8">
            <div className="text-center">
              <div className="font-semibold text-gray-800">White</div>
              <div className="text-sm text-gray-600">
                {game.whitePlayerName}
              </div>
              <div className="text-xs text-gray-500">
                Flat: {game.whitePieces.flat} | Cap: {game.whitePieces.capstone}
              </div>
            </div>
            <div className="text-center">
              <div className="font-semibold text-gray-800">Black</div>
              <div className="text-sm text-gray-600">
                {game.blackPlayerName}
              </div>
              <div className="text-xs text-gray-500">
                Flat: {game.blackPieces.flat} | Cap: {game.blackPieces.capstone}
              </div>
            </div>
          </div>

          {game.status === "finished" && (
            <div className="text-center">
              <div
                className={`text-lg font-bold ${game.winner === "draw" ? "text-yellow-600" : "text-green-600"}`}
              >
                {game.winner === "draw" ? "Draw!" : `${game.winner} Wins!`}
              </div>
              <div className="text-sm text-gray-600">
                by{" "}
                {game.winCondition === "road"
                  ? "road"
                  : game.winCondition === "flat"
                    ? "flat win"
                    : game.winCondition}
              </div>
            </div>
          )}

          {game.status === "waiting" && (
            <div className="text-center">
              <div className="text-lg font-semibold text-yellow-600">
                Waiting for opponent...
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-6">
        {/* 3D Game Board */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="mb-4">
            <p className="text-sm text-amber-600">
              🖱️ Click and drag to rotate • Scroll to zoom • Click squares to{" "}
              {gameMode === "place" ? "place pieces" : "select/move stacks"}
            </p>
          </div>
          <div
            ref={mountRef}
            className="border-4 border-amber-600 rounded-lg overflow-hidden shadow-xl"
            style={{ width: 1000, height: 700 }}
          />
        </div>

        {/* Controls */}
        <div className="space-y-4">
          {/* Mode Selection */}
          {isUserTurn && game.status === "active" && !isOpeningPhase && (
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-semibold text-amber-800 mb-4">
                Game Mode
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setGameMode("place");
                    setSelectedStack(null);
                    setMovePath([]);
                    setDropPattern([]);
                  }}
                  className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                    gameMode === "place"
                      ? "bg-amber-600 text-white"
                      : "bg-amber-100 text-amber-700 hover:bg-amber-200"
                  }`}
                >
                  Place
                </button>
                <button
                  onClick={() => {
                    setGameMode("move");
                    setSelectedStack(null);
                    setMovePath([]);
                    setDropPattern([]);
                  }}
                  className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                    gameMode === "move"
                      ? "bg-amber-600 text-white"
                      : "bg-amber-100 text-amber-700 hover:bg-amber-200"
                  }`}
                >
                  Move
                </button>
              </div>
            </div>
          )}

          {/* Opening Phase Notice */}
          {isUserTurn && game.status === "active" && isOpeningPhase && (
            <div className="bg-amber-50 border-2 border-amber-200 rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-semibold text-amber-800 mb-2">
                Opening Phase
              </h3>
              <p className="text-sm text-amber-700">
                Place your opponent's flat stone on any empty square. Movement
                is not allowed during the opening phase.
              </p>
            </div>
          )}

          {/* Piece Selection */}
          {isUserTurn && game.status === "active" && gameMode === "place" && (
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-semibold text-amber-800 mb-4">
                {isOpeningPhase ? "Place Opponent's Piece" : "Place Piece"}
              </h3>

              <div className="space-y-3">
                <button
                  onClick={() => setSelectedPieceType("flat")}
                  disabled={!isOpeningPhase && userPieces.flat <= 0}
                  className={`w-full p-3 rounded-lg border-2 transition-colors ${
                    selectedPieceType === "flat"
                      ? "border-amber-500 bg-amber-50"
                      : "border-gray-300 hover:border-amber-300"
                  } ${!isOpeningPhase && userPieces.flat <= 0 ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  <div className="flex items-center justify-between">
                    <span>Flat</span>
                    <span className="text-sm text-gray-600">
                      {isOpeningPhase ? "Required" : userPieces.flat}
                    </span>
                  </div>
                </button>

                {!isOpeningPhase && (
                  <>
                    <button
                      onClick={() => setSelectedPieceType("standing")}
                      disabled={userPieces.flat <= 0}
                      className={`w-full p-3 rounded-lg border-2 transition-colors ${
                        selectedPieceType === "standing"
                          ? "border-amber-500 bg-amber-50"
                          : "border-gray-300 hover:border-amber-300"
                      } ${userPieces.flat <= 0 ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      <div className="flex items-center justify-between">
                        <span>Wall</span>
                        <span className="text-sm text-gray-600">
                          {userPieces.flat}
                        </span>
                      </div>
                    </button>

                    {userPieces.capstone > 0 && (
                      <button
                        onClick={() => setSelectedPieceType("capstone")}
                        className={`w-full p-3 rounded-lg border-2 transition-colors ${
                          selectedPieceType === "capstone"
                            ? "border-amber-500 bg-amber-50"
                            : "border-gray-300 hover:border-amber-300"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span>Capstone</span>
                          <span className="text-sm text-gray-600">
                            {userPieces.capstone}
                          </span>
                        </div>
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Movement Controls */}
          {isUserTurn &&
            game.status === "active" &&
            gameMode === "move" &&
            selectedStack && (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-semibold text-amber-800 mb-4">
                  Move Stack
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-amber-700 mb-2">
                      Stack Size: {stackSize}
                    </label>
                    <input
                      type="range"
                      min="1"
                      max={Math.min(
                        game.board[selectedStack.row][selectedStack.col].length,
                        game.boardSize
                      )}
                      value={stackSize}
                      onChange={(e) => setStackSize(parseInt(e.target.value))}
                      className="w-full"
                    />
                  </div>

                  {movePath.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-amber-700 mb-2">
                        Drop Pattern
                      </label>
                      <div className="space-y-2">
                        {dropPattern.map((count, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <span className="text-sm">Step {index + 1}:</span>
                            <input
                              type="number"
                              min="1"
                              max={stackSize}
                              value={count}
                              onChange={(e) =>
                                updateDropPattern(
                                  index,
                                  parseInt(e.target.value) || 1
                                )
                              }
                              className="w-16 px-2 py-1 border rounded"
                            />
                          </div>
                        ))}
                      </div>
                      <div className="mt-2 text-sm text-gray-600">
                        Total:{" "}
                        {dropPattern.reduce((sum, count) => sum + count, 0)} /{" "}
                        {stackSize}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={() => void executeMove()}
                      disabled={
                        dropPattern.reduce((sum, count) => sum + count, 0) !==
                        stackSize
                      }
                      className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Execute Move
                    </button>
                    <button
                      onClick={() => {
                        setSelectedStack(null);
                        setMovePath([]);
                        setDropPattern([]);
                      }}
                      className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

          {/* Game Actions */}
          {game.status === "active" && (
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-semibold text-amber-800 mb-4">
                Actions
              </h3>
              <button
                onClick={() => void handleResign()}
                className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Resign
              </button>
            </div>
          )}

          {/* Move History */}
          {gameMoves && gameMoves.length > 0 && (
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-semibold text-amber-800 mb-4">
                Move History
              </h3>
              <div className="max-h-64 overflow-y-auto space-y-1">
                {gameMoves.map((move, index) => (
                  <div
                    key={move._id}
                    className={`flex items-center justify-between p-2 rounded text-sm ${
                      move.player === "white"
                        ? "bg-gray-100 text-gray-800"
                        : "bg-gray-800 text-white"
                    }`}
                  >
                    <span className="font-mono font-medium">
                      {Math.floor(index / 2) + 1}.
                      {move.player === "black" ? ".." : ""} {move.notation}
                    </span>
                    <span className="text-xs opacity-75">
                      {move.type === "place" ? "Place" : "Move"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Game Rules */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-lg font-semibold text-amber-800 mb-4">
              Quick Rules
            </h3>
            <div className="space-y-2 text-sm text-amber-700">
              <p>
                <strong>Goal:</strong> Connect opposite edges with your road
              </p>
              <p>
                • <strong>Opening:</strong> First turn places opponent's flat
                stone
              </p>
              <p>
                • <strong>Pieces:</strong> Flat stones (roads), Walls (block
                roads), Capstones (special)
              </p>
              <p>
                • <strong>Roads:</strong> Only flats and capstones count toward
                roads
              </p>
              <p>
                • <strong>Walls:</strong> Standing stones block roads, can't be
                stacked on
              </p>
              <p>
                • <strong>Capstones:</strong> Count as road, can flatten walls,
                can't be stacked on
              </p>
              <p>
                • <strong>Movement:</strong> Straight lines only, no diagonals
              </p>
              <p>
                • <strong>Stacks:</strong> Drop at least 1 piece per square
                moved
              </p>
              <p>
                • <strong>Carry limit:</strong> Can't pick up more pieces than
                board size
              </p>
              <p>
                • <strong>Flat win:</strong> If no road, player with most top
                flats wins
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
