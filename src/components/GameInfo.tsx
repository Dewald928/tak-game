import React from "react";

interface GameInfoProps {
  boardSize: number;
  moveCount: number;
  status: string;
  currentPlayer: "white" | "black";
  playerColor: "white" | "black" | null;
  isMyTurn: boolean;
  winner?: "white" | "black" | "draw";
  winCondition?: "road" | "flat" | "resign";
  komi?: number;
  isRanked: boolean;
}

export function GameInfo({
  boardSize,
  moveCount,
  status,
  currentPlayer,
  playerColor,
  isMyTurn,
  winner,
  winCondition,
  komi,
  isRanked,
}: GameInfoProps) {
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

  const getTurnIndicator = () => {
    if (status !== "active") return "";
    return currentPlayer === "white" ? "⚪" : "⚫";
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-4">
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <h2 className="text-xl font-bold text-gray-900">
              {boardSize}×{boardSize} Tak Game
            </h2>
            {isRanked && (
              <span className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded">
                Ranked
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-sm text-gray-600">
            <span>Move {moveCount}</span>
            <span
              className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(status)}`}
            >
              {status}
            </span>
            {komi && komi > 0 && (
              <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
                Komi: {komi / 2}
              </span>
            )}
          </div>
        </div>

        <div className="text-right">
          {status === "active" && (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Current Turn:</span>
              <div className="flex items-center gap-1">
                <span className="text-lg">{getTurnIndicator()}</span>
                <span className="capitalize text-sm font-medium">
                  {currentPlayer}
                </span>
              </div>
            </div>
          )}
          {playerColor && (
            <p className="text-xs text-gray-500 mt-1">
              You are {playerColor === "white" ? "⚪ White" : "⚫ Black"}
              {isMyTurn && " (Your turn)"}
            </p>
          )}
        </div>
      </div>

      {winner && (
        <div className="mt-4 p-3 bg-green-100 border border-green-300 rounded-md">
          <div className="flex items-center gap-2">
            <span className="text-2xl">
              {winner === "white" ? "⚪" : winner === "black" ? "⚫" : "🤝"}
            </span>
            <p className="text-green-800 font-medium">
              {winner === "draw" ? "Game ended in a draw!" : `${winner} wins!`}
              {winCondition && (
                <span className="ml-1 text-sm">
                  (
                  {winCondition === "road"
                    ? "Road victory"
                    : winCondition === "flat"
                      ? "Flat count victory"
                      : "Resignation"}
                  )
                </span>
              )}
            </p>
          </div>
        </div>
      )}

      {status === "waiting" && (
        <div className="mt-4 p-3 bg-yellow-100 border border-yellow-300 rounded-md">
          <p className="text-yellow-800 text-sm">
            🕐 Waiting for another player to join...
          </p>
        </div>
      )}
    </div>
  );
}
