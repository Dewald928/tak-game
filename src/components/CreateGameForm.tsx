import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

interface CreateGameFormProps {
  onGameCreated: (gameId: Id<"games">) => void;
  onCancel: () => void;
}

export function CreateGameForm({
  onGameCreated,
  onCancel,
}: CreateGameFormProps) {
  const [boardSize, setBoardSize] = useState(5);
  const [isRanked, setIsRanked] = useState(false);
  const [komi, setKomi] = useState(0);
  const [isCreating, setIsCreating] = useState(false);

  const createGame = useMutation(api.games.createGame);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);

    try {
      const gameId = await createGame({
        boardSize,
        isRanked,
        komi: komi > 0 ? komi * 2 : undefined, // Store as half-points
      });
      onGameCreated(gameId);
    } catch (error) {
      console.error("Failed to create game:", error);
      alert("Failed to create game. Please try again.");
    } finally {
      setIsCreating(false);
    }
  };

  const getPieceCount = (size: number) => {
    const pieceCounts = {
      3: { flat: 10, capstone: 0 },
      4: { flat: 15, capstone: 0 },
      5: { flat: 21, capstone: 1 },
      6: { flat: 30, capstone: 1 },
      7: { flat: 40, capstone: 2 },
      8: { flat: 50, capstone: 2 },
    };
    return pieceCounts[size as keyof typeof pieceCounts];
  };

  const pieces = getPieceCount(boardSize);

  return (
    <div className="max-w-md mx-auto">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">
          Create New Game
        </h2>

        <form
          onSubmit={(e) => {
            handleSubmit(e).catch(console.error);
          }}
          className="space-y-6"
        >
          {/* Board Size */}
          <div>
            <label
              htmlFor="boardSize"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Board Size
            </label>
            <select
              id="boardSize"
              value={boardSize}
              onChange={(e) => setBoardSize(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              <option value={3}>3×3 (Quick Game)</option>
              <option value={4}>4×4 (Fast Game)</option>
              <option value={5}>5×5 (Standard)</option>
              <option value={6}>6×6 (Long Game)</option>
              <option value={7}>7×7 (Epic Game)</option>
              <option value={8}>8×8 (Marathon)</option>
            </select>
            <p className="text-sm text-gray-500 mt-1">
              Each player gets {pieces.flat} flat pieces
              {pieces.capstone > 0 &&
                ` and ${pieces.capstone} capstone${pieces.capstone > 1 ? "s" : ""}`}
            </p>
          </div>

          {/* Komi */}
          <div>
            <label
              htmlFor="komi"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Komi (Tie-breaking Bonus)
            </label>
            <select
              id="komi"
              value={komi}
              onChange={(e) => setKomi(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              <option value={0}>0 (No Komi)</option>
              <option value={0.5}>0.5</option>
              <option value={1}>1</option>
              <option value={1.5}>1.5</option>
              <option value={2}>2</option>
              <option value={2.5}>2.5</option>
              <option value={3}>3</option>
            </select>
            <p className="text-sm text-gray-500 mt-1">
              White gets a {komi}-point bonus for flat wins (helps balance
              first-player advantage)
            </p>
          </div>

          {/* Ranked Game */}
          <div>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={isRanked}
                onChange={(e) => setIsRanked(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="ml-2 text-sm font-medium text-gray-700">
                Ranked Game
              </span>
            </label>
            <p className="text-sm text-gray-500 mt-1">
              Ranked games affect your rating and appear in leaderboards
            </p>
          </div>

          {/* Game Info */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-2">
              Game Information
            </h3>
            <div className="text-sm text-gray-600 space-y-1">
              <p>• First two moves: players place opponent's pieces</p>
              <p>• First move must be a flat piece</p>
              <p>• Win by creating a road or controlling the most flats</p>
              <p>
                • Standing pieces (walls) block roads but can be flattened by
                capstones
              </p>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex space-x-3">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCreating}
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isCreating ? "Creating..." : "Create Game"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
