import { Authenticated, Unauthenticated } from "convex/react";
import { useState } from "react";
import { SignInForm } from "./SignInForm";
import { SignOutButton } from "./SignOutButton";
import { GameBoard } from "./components/GameBoard";
import { GameLobby } from "./components/GameLobby";
import { CreateGameForm } from "./components/CreateGameForm";
import { Id } from "../convex/_generated/dataModel";

type Screen = "lobby" | "create" | "game";

function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>("lobby");
  const [currentGameId, setCurrentGameId] = useState<Id<"games"> | null>(null);

  const navigateToGame = (gameId: Id<"games">) => {
    setCurrentGameId(gameId);
    setCurrentScreen("game");
  };

  const navigateToLobby = () => {
    setCurrentGameId(null);
    setCurrentScreen("lobby");
  };

  const navigateToCreate = () => {
    setCurrentScreen("create");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100">
      <Unauthenticated>
        <div className="flex items-center justify-center min-h-screen">
          <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full mx-4">
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold text-gray-800 mb-2">Tak</h1>
              <p className="text-gray-600">The Beautiful Game</p>
            </div>
            <SignInForm />
          </div>
        </div>
      </Unauthenticated>

      <Authenticated>
        <div className="min-h-screen">
          <header className="bg-white shadow-sm border-b">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between items-center h-16">
                <div className="flex items-center">
                  <h1 className="text-2xl font-bold text-gray-900">Tak</h1>
                  {currentScreen !== "lobby" && (
                    <button
                      onClick={navigateToLobby}
                      className="ml-4 text-blue-600 hover:text-blue-800"
                    >
                      ← Back to Lobby
                    </button>
                  )}
                </div>
                <div className="flex items-center space-x-4">
                  {currentScreen === "lobby" && (
                    <button
                      onClick={navigateToCreate}
                      className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
                    >
                      Create Game
                    </button>
                  )}
                  <SignOutButton />
                </div>
              </div>
            </div>
          </header>

          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {currentScreen === "lobby" && (
              <GameLobby onGameSelect={navigateToGame} />
            )}
            {currentScreen === "create" && (
              <CreateGameForm
                onGameCreated={navigateToGame}
                onCancel={navigateToLobby}
              />
            )}
            {currentScreen === "game" && currentGameId && (
              <GameBoard gameId={currentGameId} onGameEnd={navigateToLobby} />
            )}
          </main>
        </div>
      </Authenticated>
    </div>
  );
}

export default App;
