import { useState } from "react";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { SignInForm } from "./SignInForm";
import { SignOutButton } from "./SignOutButton";
import { GameLobby } from "./GameLobby";
import { GameBoard3D } from "./GameBoard3D";
import { Id } from "../convex/_generated/dataModel";
import { Toaster } from "sonner";

export default function App() {
  const [currentGameId, setCurrentGameId] = useState<Id<"games"> | null>(null);
  const [view3D, setView3D] = useState(true);

  return (
    <main className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100">
      <Toaster position="top-right" />

      <AuthLoading>
        <div className="flex justify-center items-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div>
        </div>
      </AuthLoading>

      <Unauthenticated>
        <SignInForm />
      </Unauthenticated>

      <Authenticated>
        <div className="container mx-auto px-4 py-8">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-4xl font-bold text-amber-800">3D Tak Game</h1>
            <SignOutButton />
          </div>

          {currentGameId ? (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setCurrentGameId(null)}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  ← Back to Lobby
                </button>
              </div>

              <GameBoard3D gameId={currentGameId} />
            </div>
          ) : (
            <GameLobby onJoinGame={setCurrentGameId} />
          )}
        </div>
      </Authenticated>
    </main>
  );
}
