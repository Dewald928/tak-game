import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { useState } from "react";
import { Id } from "../convex/_generated/dataModel";
import { toast } from "sonner";

interface GameLobbyProps {
  onJoinGame: (gameId: Id<"games">) => void;
}

export function GameLobby({ onJoinGame }: GameLobbyProps) {
  const [selectedBoardSize, setSelectedBoardSize] = useState(5);
  const [isSearching, setIsSearching] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const userGames = useQuery(api.games.getUserGames) || [];
  const userStats = useQuery(api.games.getUserStats);
  const findGame = useMutation(api.games.findGame);
  const createGame = useMutation(api.games.createGame);
  const joinGame = useMutation(api.games.joinGame);

  const handleQuickMatch = async () => {
    setIsSearching(true);
    try {
      const gameId = await findGame({ boardSize: selectedBoardSize });
      onJoinGame(gameId);
      toast.success("Game found!");
    } catch (error) {
      toast.error("Failed to find game");
      console.error(error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleCreateGame = async () => {
    try {
      const gameId = await createGame({ boardSize: selectedBoardSize });
      onJoinGame(gameId);
      toast.success("Game created! Waiting for opponent...");
    } catch (error) {
      toast.error("Failed to create game");
      console.error(error);
    }
  };

  const handleJoinExistingGame = async (gameId: Id<"games">) => {
    try {
      await joinGame({ gameId });
      onJoinGame(gameId);
      toast.success("Joined game!");
    } catch (error) {
      toast.error("Failed to join game");
      console.error(error);
    }
  };

  const activeGames = userGames.filter((game) => game.status === "active");
  const waitingGames = userGames.filter((game) => game.status === "waiting");
  const finishedGames = userGames
    .filter((game) => game.status === "finished")
    .slice(0, 5);

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-amber-800 mb-2">Game Lobby</h1>
        <p className="text-amber-600">
          Choose your board size and find an opponent
        </p>
      </div>

      {/* Quick Match Section */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-2xl font-semibold text-amber-800 mb-4">
          Quick Match
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-amber-700 mb-2">
              Board Size
            </label>
            <div className="flex gap-2 flex-wrap">
              {[3, 4, 5, 6, 7, 8].map((size) => (
                <button
                  key={size}
                  onClick={() => setSelectedBoardSize(size)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    selectedBoardSize === size
                      ? "bg-amber-600 text-white"
                      : "bg-amber-100 text-amber-700 hover:bg-amber-200"
                  }`}
                >
                  {size}×{size}
                </button>
              ))}
            </div>
            <div className="text-xs text-amber-600 mt-2 space-y-1">
              <p>
                <strong>Piece counts:</strong>
              </p>
              <p>3×3: 10 flat, 0 capstone | 4×4: 15 flat, 0 capstone</p>
              <p>5×5: 21 flat, 1 capstone | 6×6: 30 flat, 1 capstone</p>
              <p>7×7: 40 flat, 2 capstone | 8×8: 50 flat, 2 capstone</p>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => void handleQuickMatch()}
              disabled={isSearching}
              className="flex-1 px-6 py-3 bg-amber-600 text-white rounded-lg font-semibold hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSearching ? "Searching..." : "Find Game"}
            </button>
            <button
              onClick={() => void handleCreateGame()}
              className="flex-1 px-6 py-3 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 transition-colors"
            >
              Create Game
            </button>
          </div>
        </div>
      </div>

      {/* User Statistics */}
      {userStats && (
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-2xl font-semibold text-amber-800 mb-4">
            Your Statistics
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {userStats.totalGames}
              </div>
              <div className="text-sm text-blue-700">Total Games</div>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {userStats.wins}
              </div>
              <div className="text-sm text-green-700">Wins</div>
            </div>
            <div className="text-center p-3 bg-red-50 rounded-lg">
              <div className="text-2xl font-bold text-red-600">
                {userStats.losses}
              </div>
              <div className="text-sm text-red-700">Losses</div>
            </div>
            <div className="text-center p-3 bg-yellow-50 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600">
                {userStats.winRate}%
              </div>
              <div className="text-sm text-yellow-700">Win Rate</div>
            </div>
          </div>
          {userStats.finishedGames > 0 && (
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-purple-50 rounded-lg">
                <div className="text-xl font-bold text-purple-600">
                  {userStats.roadWins}
                </div>
                <div className="text-sm text-purple-700">Road Wins</div>
              </div>
              <div className="text-center p-3 bg-indigo-50 rounded-lg">
                <div className="text-xl font-bold text-indigo-600">
                  {userStats.flatWins}
                </div>
                <div className="text-sm text-indigo-700">Flat Wins</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Active Games */}
      {activeGames.length > 0 && (
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-2xl font-semibold text-amber-800 mb-4">
            Active Games
          </h2>
          <div className="space-y-3">
            {activeGames.map((game) => (
              <div
                key={game._id}
                className="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-200"
              >
                <div>
                  <div className="font-medium text-green-800">
                    {game.boardSize}×{game.boardSize} Board
                  </div>
                  <div className="text-sm text-green-600">
                    Move {game.moveCount} • {game.currentPlayer}'s turn
                    {(game.isOpeningPhase ?? false) &&
                      game.moveCount < 2 &&
                      " (Opening)"}
                  </div>
                </div>
                <button
                  onClick={() => onJoinGame(game._id)}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  Continue
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Waiting Games */}
      {waitingGames.length > 0 && (
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-2xl font-semibold text-amber-800 mb-4">
            Waiting for Opponent
          </h2>
          <div className="space-y-3">
            {waitingGames.map((game) => (
              <div
                key={game._id}
                className="flex items-center justify-between p-4 bg-yellow-50 rounded-lg border border-yellow-200"
              >
                <div>
                  <div className="font-medium text-yellow-800">
                    {game.boardSize}×{game.boardSize} Board
                  </div>
                  <div className="text-sm text-yellow-600">
                    Waiting for opponent to join...
                  </div>
                </div>
                <button
                  onClick={() => onJoinGame(game._id)}
                  className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
                >
                  View
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Games */}
      {finishedGames.length > 0 && (
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-2xl font-semibold text-amber-800 mb-4">
            Recent Games
          </h2>
          <div className="space-y-3">
            {finishedGames.map((game) => (
              <div
                key={game._id}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200"
              >
                <div>
                  <div className="font-medium text-gray-800">
                    {game.boardSize}×{game.boardSize} Board
                  </div>
                  <div className="text-sm text-gray-600">
                    {game.winner === "draw" ? "Draw" : `${game.winner} won`} •{" "}
                    {game.winCondition === "road"
                      ? "road"
                      : game.winCondition === "flat"
                        ? "flat win"
                        : game.winCondition}
                  </div>
                </div>
                <button
                  onClick={() => onJoinGame(game._id)}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Review
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Game Rules */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-2xl font-semibold text-amber-800 mb-4">
          How to Play Tak
        </h2>
        <div className="space-y-3 text-amber-700">
          <p>
            <strong>Objective:</strong> Create a road connecting two opposite
            edges of the board.
          </p>
          <p>
            <strong>Opening:</strong> Each player's first turn places one of
            their opponent's flats.
          </p>
          <p>
            <strong>Pieces:</strong> Flats (can be placed flat or standing as
            walls) and capstones (special pieces).
          </p>
          <p>
            <strong>Placement:</strong> Place pieces on empty squares. Walls
            block roads but can be flattened by capstones.
          </p>
          <p>
            <strong>Movement:</strong> Move stacks of pieces in straight lines,
            dropping pieces along the path.
          </p>
          <p>
            <strong>Winning:</strong> First to create a road wins, or flat win
            when pieces run out.
          </p>
          <p>
            <strong>Tak:</strong> Warning when a player is one move away from
            winning a road.
          </p>
        </div>
      </div>
    </div>
  );
}
