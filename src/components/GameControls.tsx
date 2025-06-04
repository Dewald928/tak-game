import React from "react";

interface GameControlsProps {
  isMyTurn: boolean;
  isLoading: boolean;
  isPlacingPiece: boolean;
  onModeChange: (isPlacing: boolean) => void;
  selectedPieceType: "flat" | "wall" | "capstone";
  onPieceTypeChange: (type: "flat" | "wall" | "capstone") => void;
  selectedStack: { row: number; col: number; size: number } | null;
  stackSize: number;
  onStackSizeChange: (size: number) => void;
  dropPattern: number[];
  onDropPatternChange: (pattern: number[]) => void;
  maxStackSize: number;
}

export function GameControls({
  isMyTurn,
  isLoading,
  isPlacingPiece,
  onModeChange,
  selectedPieceType,
  onPieceTypeChange,
  selectedStack,
  stackSize,
  onStackSizeChange,
  dropPattern,
  onDropPatternChange,
  maxStackSize,
}: GameControlsProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-gray-900">Game Controls</h3>

      {/* Mode Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Move Mode
        </label>
        <div className="space-y-2">
          <label className="flex items-center">
            <input
              type="radio"
              name="moveMode"
              checked={isPlacingPiece}
              onChange={() => onModeChange(true)}
              disabled={!isMyTurn || isLoading}
              className="mr-2"
            />
            Place Piece
          </label>
          <label className="flex items-center">
            <input
              type="radio"
              name="moveMode"
              checked={!isPlacingPiece}
              onChange={() => onModeChange(false)}
              disabled={!isMyTurn || isLoading}
              className="mr-2"
            />
            Move Stack
          </label>
        </div>
      </div>

      {/* Piece Selection (only when placing) */}
      {isPlacingPiece && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Piece Type
          </label>
          <div className="space-y-2">
            <label className="flex items-center">
              <input
                type="radio"
                name="pieceType"
                value="flat"
                checked={selectedPieceType === "flat"}
                onChange={(e) =>
                  onPieceTypeChange(
                    e.target.value as "flat" | "wall" | "capstone"
                  )
                }
                disabled={!isMyTurn || isLoading}
                className="mr-2"
              />
              Flat Stone
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                name="pieceType"
                value="wall"
                checked={selectedPieceType === "wall"}
                onChange={(e) =>
                  onPieceTypeChange(
                    e.target.value as "flat" | "wall" | "capstone"
                  )
                }
                disabled={!isMyTurn || isLoading}
                className="mr-2"
              />
              Standing Stone (Wall)
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                name="pieceType"
                value="capstone"
                checked={selectedPieceType === "capstone"}
                onChange={(e) =>
                  onPieceTypeChange(
                    e.target.value as "flat" | "wall" | "capstone"
                  )
                }
                disabled={!isMyTurn || isLoading}
                className="mr-2"
              />
              Capstone
            </label>
          </div>
        </div>
      )}

      {/* Stack Movement Controls (only when moving) */}
      {!isPlacingPiece && selectedStack && (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Stack Size to Move: {stackSize}
            </label>
            <input
              type="range"
              min="1"
              max={Math.min(selectedStack.size, maxStackSize)}
              value={stackSize}
              onChange={(e) => onStackSizeChange(Number(e.target.value))}
              disabled={!isMyTurn || isLoading}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>1</span>
              <span>{Math.min(selectedStack.size, maxStackSize)}</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Drop Pattern
            </label>
            <div className="text-xs text-gray-600 mb-2">
              How many pieces to drop at each position: [
              {dropPattern.join(", ")}]
            </div>
            <div className="flex space-x-1">
              {dropPattern.map((count, index) => (
                <input
                  key={index}
                  type="number"
                  min="1"
                  max={stackSize}
                  value={count}
                  onChange={(e) => {
                    const newPattern = [...dropPattern];
                    newPattern[index] = Number(e.target.value);
                    onDropPatternChange(newPattern);
                  }}
                  disabled={!isMyTurn || isLoading}
                  className="w-12 px-1 py-1 text-xs border border-gray-300 rounded"
                />
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Total: {dropPattern.reduce((sum, count) => sum + count, 0)} /{" "}
              {stackSize}
            </p>
          </div>
        </div>
      )}

      {!isPlacingPiece && !selectedStack && (
        <div className="text-sm text-gray-500">
          Click on a stack you control to select it for movement
        </div>
      )}
    </div>
  );
}
