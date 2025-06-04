import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

interface GameLobbyProps {
  onGameSelect: (gameId: Id<"games">) => void;
}

export function GameLobby({ onGameSelect }: GameLobbyProps) {
  const availableGames = useQuery(api.games.getAvailableGames);
  const userGames = useQuery(api.games.getUserGames);
  const joinGame = useMutation(api.games.joinGame);

  const handleJoinGame = async (gameId: Id<"games">) => {
    try {
      await joinGame({ gameId });
      onGameSelect(gameId);
    } catch (error) {
      console.error("Failed to join game:", error);
      alert("Failed to join game. Please try again.");
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const getBoardSizeName = (size: number) => {
    return `${size}×${size}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "waiting":
        return "text-yellow-600 bg-yellow-100";
      case "active":
        return "text-green-600 bg-green-100";
      case "finished":
        return "text-gray-600 bg-gray-100";
      default:
        return "text-gray-600 bg-gray-100";
    }
  };

  const getWinnerText = (game: any) => {
    if (!game.winner) return "";
    if (game.winner === "draw") return "Draw";
    return `${game.winner === "white" ? "White" : "Black"} wins`;
  };

  return (
    <div className="space-y-8">
      {/* Available Games */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          Available Games
        </h2>
        {!availableGames ? (
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : availableGames.length === 0 ? (
          <div className="text-center py-8 bg-white rounded-lg shadow-sm">
            <p className="text-gray-500">No games available to join</p>
            <p className="text-sm text-gray-400 mt-1">
              Create a new game to get started!
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {availableGames.map((game) => (
              <div
                key={game._id}
                className="bg-white rounded-lg shadow-sm border p-4"
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      {getBoardSizeName(game.boardSize)} Board
                    </h3>
                    <p className="text-sm text-gray-500">
                      Created {formatDate(game.createdAt)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end space-y-1">
                    {game.isRanked && (
                      <span className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded">
                        Ranked
                      </span>
                    )}
                    {game.komi && game.komi > 0 && (
                      <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
                        Komi: {game.komi / 2}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => {
                    handleJoinGame(game._id).catch(console.error);
                  }}
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
                >
                  Join Game
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* User's Games */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Your Games</h2>
        {!userGames ? (
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : userGames.length === 0 ? (
          <div className="text-center py-8 bg-white rounded-lg shadow-sm">
            <p className="text-gray-500">No games yet</p>
            <p className="text-sm text-gray-400 mt-1">
              Create or join a game to start playing!
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Game
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Moves
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Result
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {userGames.map((game) => (
                    <tr key={game._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {getBoardSizeName(game.boardSize)}
                            </div>
                            {game.isRanked && (
                              <div className="text-xs text-purple-600">
                                Ranked
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(game.status)}`}
                        >
                          {game.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {game.moveCount}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {getWinnerText(game)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(game.createdAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => onGameSelect(game._id)}
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                        >
                          {game.status === "active" ? "Continue" : "View"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
