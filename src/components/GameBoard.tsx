import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useState, useEffect, useCallback } from "react";
import { Board3D } from "./Board3D";
import { Board2D } from "./Board2D";
import { GameControls } from "./GameControls";
import { GameInfo } from "./GameInfo";

interface GameBoardProps {
  gameId: Id<"games">;
  onGameEnd: () => void;
}

type PieceType = "flat" | "wall" | "capstone";
type Player = "white" | "black";

export function GameBoard({ gameId, onGameEnd }: GameBoardProps) {
  const game = useQuery(api.games.getGame, { gameId });
  const moves = useQuery(api.games.getGameMoves, { gameId });
  const currentUser = useQuery(api.auth.loggedInUser);
  const makeMove = useMutation(api.games.makeMove);
  const resignGame = useMutation(api.games.resignGame);

  const [selectedPieceType, setSelectedPieceType] = useState<PieceType>("flat");
  const [isPlacingPiece, setIsPlacingPiece] = useState(true);
  const [selectedStack, setSelectedStack] = useState<{
    row: number;
    col: number;
    size: number;
  } | null>(null);
  const [stackSize, setStackSize] = useState(1);
  const [dropPattern, setDropPattern] = useState<number[]>([1]);
  const [isLoading, setIsLoading] = useState(false);
  const [use3D, setUse3D] = useState(true);

  // Get current user's color
  const currentUserId = currentUser?._id;
  const isWhitePlayer = game?.whitePlayer === currentUserId;
  const isBlackPlayer = game?.blackPlayer === currentUserId;
  const playerColor: Player | null = isWhitePlayer
    ? "white"
    : isBlackPlayer
      ? "black"
      : null;
  const isMyTurn = game?.currentPlayer === playerColor;

  // Reset selection when turn changes
  useEffect(() => {
    setSelectedStack(null);
    setIsPlacingPiece(true);
  }, [game?.currentPlayer]);

  const handleSquareClick = useCallback(
    async (row: number, col: number) => {
      if (!game || !playerColor || !isMyTurn || isLoading) return;

      if (isPlacingPiece) {
        // Handle piece placement
        if (game.board[row][col].length > 0) {
          alert("Position is already occupied!");
          return;
        }

        setIsLoading(true);
        try {
          await makeMove({
            gameId,
            type: "place",
            position: { row, col },
            pieceType: selectedPieceType,
          });
        } catch (error) {
          console.error("Failed to make move:", error);
          alert(error instanceof Error ? error.message : "Failed to make move");
        } finally {
          setIsLoading(false);
        }
      } else {
        // Handle stack movement
        if (!selectedStack) {
          // Select a stack to move
          const stack = game.board[row][col];
          if (stack.length === 0) {
            alert("No pieces to move!");
            return;
          }

          const topPiece = stack[stack.length - 1];
          if (topPiece.player !== playerColor) {
            alert("You don't control this stack!");
            return;
          }

          setSelectedStack({ row, col, size: stack.length });
          setStackSize(Math.min(1, stack.length, game.boardSize));
          setDropPattern([1]);
        } else {
          // Move the selected stack
          if (selectedStack.row === row && selectedStack.col === col) {
            // Clicking the same position - deselect
            setSelectedStack(null);
            return;
          }

          // Validate move direction
          const rowDiff = row - selectedStack.row;
          const colDiff = col - selectedStack.col;

          if (rowDiff !== 0 && colDiff !== 0) {
            alert("Moves must be in straight lines!");
            return;
          }

          const distance = Math.abs(rowDiff) + Math.abs(colDiff);
          if (distance > stackSize) {
            alert("Cannot move that far with current stack size!");
            return;
          }

          // Adjust drop pattern to match distance
          if (dropPattern.length !== distance) {
            const newPattern = Array(distance).fill(1);
            newPattern[distance - 1] = stackSize - (distance - 1);
            setDropPattern(newPattern);
          }

          setIsLoading(true);
          try {
            await makeMove({
              gameId,
              type: "move",
              from: { row: selectedStack.row, col: selectedStack.col },
              to: { row, col },
              stackSize,
              dropPattern,
            });
            setSelectedStack(null);
          } catch (error) {
            console.error("Failed to make move:", error);
            alert(
              error instanceof Error ? error.message : "Failed to make move"
            );
          } finally {
            setIsLoading(false);
          }
        }
      }
    },
    [
      game,
      playerColor,
      isMyTurn,
      isLoading,
      isPlacingPiece,
      selectedPieceType,
      selectedStack,
      stackSize,
      dropPattern,
      makeMove,
      gameId,
    ]
  );

  const handleResign = useCallback(async () => {
    if (window.confirm("Are you sure you want to resign?")) {
      try {
        await resignGame({ gameId });
        onGameEnd();
      } catch (error) {
        console.error("Failed to resign:", error);
        alert("Failed to resign. Please try again.");
      }
    }
  }, [resignGame, gameId, onGameEnd]);

  if (!game) {
    return (
      <div className="flex justify-center items-center min-h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Game Status */}
      <div className="mb-6">
        <GameInfo
          boardSize={game.boardSize}
          moveCount={game.moveCount}
          status={game.status}
          currentPlayer={game.currentPlayer}
          playerColor={playerColor}
          isMyTurn={isMyTurn}
          winner={game.winner}
          winCondition={game.winCondition}
          komi={game.komi}
          isRanked={game.isRanked}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Board */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-lg shadow-lg p-6">
            {/* Board Type Toggle */}
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">Game Board</h3>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600">2D</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={use3D}
                    onChange={(e) => setUse3D(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
                <span className="text-sm text-gray-600">3D</span>
              </div>
            </div>

            <div className="aspect-square">
              {use3D ? (
                <Board3D
                  boardSize={game.boardSize}
                  board={game.board}
                  onSquareClick={(row, col) => {
                    void handleSquareClick(row, col);
                  }}
                  selectedStack={selectedStack}
                  isMyTurn={isMyTurn && !isLoading}
                  isLoading={isLoading}
                />
              ) : (
                <Board2D
                  boardSize={game.boardSize}
                  board={game.board}
                  onSquareClick={(row, col) => {
                    void handleSquareClick(row, col);
                  }}
                  selectedStack={selectedStack}
                  isMyTurn={isMyTurn && !isLoading}
                  isLoading={isLoading}
                />
              )}
            </div>
          </div>
        </div>

        {/* Game Controls */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-lg p-4 space-y-4">
            <GameControls
              isMyTurn={isMyTurn}
              isLoading={isLoading}
              isPlacingPiece={isPlacingPiece}
              onModeChange={setIsPlacingPiece}
              selectedPieceType={selectedPieceType}
              onPieceTypeChange={setSelectedPieceType}
              selectedStack={selectedStack}
              stackSize={stackSize}
              onStackSizeChange={setStackSize}
              dropPattern={dropPattern}
              onDropPatternChange={setDropPattern}
              maxStackSize={game.boardSize}
            />

            {/* Piece Counts */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">
                Remaining Pieces
              </h4>
              <div className="text-sm space-y-1">
                <div className="flex justify-between">
                  <span>White Flats:</span>
                  <span>{game.whitePieces.flat}</span>
                </div>
                <div className="flex justify-between">
                  <span>White Capstones:</span>
                  <span>{game.whitePieces.capstone}</span>
                </div>
                <div className="flex justify-between">
                  <span>Black Flats:</span>
                  <span>{game.blackPieces.flat}</span>
                </div>
                <div className="flex justify-between">
                  <span>Black Capstones:</span>
                  <span>{game.blackPieces.capstone}</span>
                </div>
              </div>
            </div>

            {/* Move History */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">
                Move History
              </h4>
              <div className="max-h-32 overflow-y-auto text-xs space-y-1">
                {moves?.slice(-10).map((move) => (
                  <div key={move._id} className="flex justify-between">
                    <span>{move.moveNumber}.</span>
                    <span className="capitalize">{move.player}</span>
                    <span className="font-mono">{move.notation}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            {game.status === "active" && playerColor && (
              <div className="space-y-2">
                <button
                  onClick={() => {
                    void handleResign();
                  }}
                  className="w-full bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 transition-colors"
                >
                  Resign
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
