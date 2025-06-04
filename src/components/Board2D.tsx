import React from "react";

interface Piece {
  player: "white" | "black";
  type: "flat" | "wall" | "capstone";
}

interface Board2DProps {
  boardSize: number;
  board: Piece[][][];
  onSquareClick: (row: number, col: number) => void;
  selectedStack?: { row: number; col: number } | null;
  isMyTurn: boolean;
  isLoading: boolean;
}

export function Board2D({
  boardSize,
  board,
  onSquareClick,
  selectedStack,
  isMyTurn,
  isLoading,
}: Board2DProps) {
  const getPieceIcon = (piece: Piece) => {
    const isWhite = piece.player === "white";
    switch (piece.type) {
      case "flat":
        return isWhite ? "⚪" : "⚫";
      case "wall":
        return isWhite ? "⬜" : "⬛";
      case "capstone":
        return isWhite ? "👑" : "♛";
      default:
        return "";
    }
  };

  const getStackDisplay = (stack: Piece[]) => {
    if (stack.length === 0) return null;

    const topPiece = stack[stack.length - 1];
    const count = stack.length;

    return (
      <div className="flex flex-col items-center justify-center h-full">
        <div className="text-lg">{getPieceIcon(topPiece)}</div>
        {count > 1 && (
          <div className="text-xs font-bold text-gray-700">{count}</div>
        )}
      </div>
    );
  };

  const isSelected = (row: number, col: number) => {
    return selectedStack?.row === row && selectedStack?.col === col;
  };

  return (
    <div className="w-full h-full min-h-96 bg-gradient-to-b from-amber-100 to-amber-200 rounded-lg p-4 flex items-center justify-center">
      <div className="bg-amber-50 p-4 rounded-lg shadow-inner">
        <div
          className="grid gap-1"
          style={{
            gridTemplateColumns: `repeat(${boardSize}, 1fr)`,
            aspectRatio: "1",
          }}
        >
          {Array.from({ length: boardSize }, (_, row) =>
            Array.from({ length: boardSize }, (_, col) => (
              <button
                key={`${row}-${col}`}
                onClick={() => onSquareClick(row, col)}
                disabled={!isMyTurn || isLoading}
                className={`
                  w-12 h-12 border-2 transition-all duration-200
                  ${
                    isSelected(row, col)
                      ? "border-green-500 bg-green-100"
                      : "border-amber-300 bg-amber-200"
                  }
                  ${
                    isMyTurn && !isLoading
                      ? "hover:border-blue-400 hover:bg-blue-100 cursor-pointer"
                      : "cursor-not-allowed opacity-60"
                  }
                  ${board[row][col].length > 0 ? "shadow-md" : ""}
                `}
              >
                {getStackDisplay(board[row][col])}
              </button>
            ))
          )}
        </div>
        <div className="text-center mt-4">
          <p className="text-sm text-gray-600">2D Board (Fallback Mode)</p>
          <p className="text-xs text-gray-500">Click squares to make moves</p>
        </div>
      </div>
    </div>
  );
}
