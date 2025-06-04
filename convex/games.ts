import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

// Types for the game
type PieceType = "flat" | "wall" | "capstone";
type Player = "white" | "black";
type GameStatus = "waiting" | "active" | "finished";

interface Piece {
  type: PieceType;
  player: Player;
}

type Board = Piece[][][]; // 3D array: [row][col][stack]

// Get initial piece counts based on board size (Tak rules)
function getInitialPieces(boardSize: number) {
  const pieceCounts = {
    3: { flat: 10, capstone: 0 },
    4: { flat: 15, capstone: 0 },
    5: { flat: 21, capstone: 1 },
    6: { flat: 30, capstone: 1 },
    7: { flat: 40, capstone: 2 },
    8: { flat: 50, capstone: 2 },
  };
  return (
    pieceCounts[boardSize as keyof typeof pieceCounts] || {
      flat: 21,
      capstone: 1,
    }
  );
}

// Create empty board
function createEmptyBoard(size: number): Board {
  return Array(size)
    .fill(null)
    .map(() =>
      Array(size)
        .fill(null)
        .map(() => [])
    );
}

// Check if position is valid
function isValidPosition(row: number, col: number, size: number): boolean {
  return row >= 0 && row < size && col >= 0 && col < size;
}

// Check for road win condition
function checkRoad(board: Board, player: Player): boolean {
  const size = board.length;
  const visited = Array(size)
    .fill(null)
    .map(() => Array(size).fill(false));

  // DFS to find connected components
  function dfs(
    row: number,
    col: number,
    component: { row: number; col: number }[]
  ) {
    if (
      !isValidPosition(row, col, size) ||
      visited[row][col] ||
      board[row][col].length === 0
    ) {
      return;
    }

    const topPiece = board[row][col][board[row][col].length - 1];
    if (!topPiece || topPiece.player !== player || topPiece.type === "wall") {
      return;
    }

    visited[row][col] = true;
    component.push({ row, col });

    // Check adjacent cells
    const directions = [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ];
    for (const [dr, dc] of directions) {
      dfs(row + dr, col + dc, component);
    }
  }

  // Find all connected components
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (!visited[row][col] && board[row][col].length > 0) {
        const topPiece = board[row][col][board[row][col].length - 1];
        if (
          topPiece &&
          topPiece.player === player &&
          topPiece.type !== "wall"
        ) {
          const component: { row: number; col: number }[] = [];
          dfs(row, col, component);

          // Check if this component forms a road
          if (component.length > 0) {
            const rows = component.map((p) => p.row);
            const cols = component.map((p) => p.col);
            const minRow = Math.min(...rows);
            const maxRow = Math.max(...rows);
            const minCol = Math.min(...cols);
            const maxCol = Math.max(...cols);

            // Check for horizontal road (spans full width)
            if (minCol === 0 && maxCol === size - 1) {
              return true;
            }
            // Check for vertical road (spans full height)
            if (minRow === 0 && maxRow === size - 1) {
              return true;
            }
          }
        }
      }
    }
  }

  return false;
}

// Count flat stones for flat win
function countFlatStones(board: Board): { white: number; black: number } {
  let white = 0;
  let black = 0;

  for (const row of board) {
    for (const cell of row) {
      if (cell.length > 0) {
        const topPiece = cell[cell.length - 1];
        if (topPiece.type === "flat") {
          if (topPiece.player === "white") {
            white++;
          } else {
            black++;
          }
        }
      }
    }
  }

  return { white, black };
}

// Check if board is full
function isBoardFull(board: Board): boolean {
  for (const row of board) {
    for (const cell of row) {
      if (cell.length === 0) {
        return false;
      }
    }
  }
  return true;
}

// Create a new game
export const createGame = mutation({
  args: {
    boardSize: v.number(),
    isRanked: v.optional(v.boolean()),
    komi: v.optional(v.number()),
  },
  returns: v.id("games"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    if (args.boardSize < 3 || args.boardSize > 8) {
      throw new Error("Board size must be between 3 and 8");
    }

    const pieces = getInitialPieces(args.boardSize);
    const emptyBoard = createEmptyBoard(args.boardSize);

    const gameId = await ctx.db.insert("games", {
      boardSize: args.boardSize,
      status: "waiting",
      createdAt: Date.now(),
      whitePlayer: userId,
      blackPlayer: undefined,
      currentPlayer: "white",
      moveCount: 0,
      board: emptyBoard,
      whitePieces: pieces,
      blackPieces: pieces,
      winner: undefined,
      winCondition: undefined,
      komi: args.komi || 0,
      isRanked: args.isRanked || false,
    });

    return gameId;
  },
});

// Join a game
export const joinGame = mutation({
  args: {
    gameId: v.id("games"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const game = await ctx.db.get(args.gameId);
    if (!game) {
      throw new Error("Game not found");
    }

    if (game.status !== "waiting") {
      throw new Error("Game is not waiting for players");
    }

    if (game.whitePlayer === userId) {
      throw new Error("Cannot join your own game");
    }

    if (game.blackPlayer) {
      throw new Error("Game already has two players");
    }

    await ctx.db.patch(args.gameId, {
      blackPlayer: userId,
      status: "active",
    });
  },
});

// Make a move
export const makeMove = mutation({
  args: {
    gameId: v.id("games"),
    type: v.union(v.literal("place"), v.literal("move")),
    // For place moves
    position: v.optional(
      v.object({
        row: v.number(),
        col: v.number(),
      })
    ),
    pieceType: v.optional(
      v.union(v.literal("flat"), v.literal("wall"), v.literal("capstone"))
    ),
    // For move moves
    from: v.optional(
      v.object({
        row: v.number(),
        col: v.number(),
      })
    ),
    to: v.optional(
      v.object({
        row: v.number(),
        col: v.number(),
      })
    ),
    stackSize: v.optional(v.number()),
    dropPattern: v.optional(v.array(v.number())),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const game = await ctx.db.get(args.gameId);
    if (!game) {
      throw new Error("Game not found");
    }

    if (game.status !== "active") {
      throw new Error("Game is not active");
    }

    // Check if it's the player's turn
    const isWhitePlayer = game.whitePlayer === userId;
    const isBlackPlayer = game.blackPlayer === userId;

    if (!isWhitePlayer && !isBlackPlayer) {
      throw new Error("You are not a player in this game");
    }

    const playerColor: Player = isWhitePlayer ? "white" : "black";
    if (game.currentPlayer !== playerColor) {
      throw new Error("Not your turn");
    }

    let notation = "";
    const newBoard = JSON.parse(JSON.stringify(game.board)) as Board;
    const newWhitePieces = { ...game.whitePieces };
    const newBlackPieces = { ...game.blackPieces };

    if (args.type === "place") {
      // Handle place move
      if (!args.position || !args.pieceType) {
        throw new Error("Position and piece type required for place move");
      }

      const { row, col } = args.position;
      const { pieceType } = args;

      if (!isValidPosition(row, col, game.boardSize)) {
        throw new Error("Invalid position");
      }

      if (newBoard[row][col].length > 0) {
        throw new Error("Position already occupied");
      }

      // Check piece availability
      const playerPieces =
        playerColor === "white" ? newWhitePieces : newBlackPieces;
      if (pieceType === "capstone" && playerPieces.capstone <= 0) {
        throw new Error("No capstones remaining");
      }
      if (pieceType !== "capstone" && playerPieces.flat <= 0) {
        throw new Error("No flat pieces remaining");
      }

      // First two moves: players place opponent's pieces
      let actualPlayer = playerColor;
      if (game.moveCount < 2) {
        actualPlayer = playerColor === "white" ? "black" : "white";

        // First move must be a flat piece
        if (game.moveCount === 0 && pieceType !== "flat") {
          throw new Error("First move must be a flat piece");
        }
      }

      // Place the piece
      newBoard[row][col].push({
        type: pieceType,
        player: actualPlayer,
      });

      // Update piece counts
      if (pieceType === "capstone") {
        if (playerColor === "white") {
          newWhitePieces.capstone--;
        } else {
          newBlackPieces.capstone--;
        }
      } else {
        if (playerColor === "white") {
          newWhitePieces.flat--;
        } else {
          newBlackPieces.flat--;
        }
      }

      // Generate notation
      const file = String.fromCharCode(97 + col); // 'a' + col
      const rank = row + 1;
      notation = `${pieceType === "capstone" ? "C" : pieceType === "wall" ? "S" : ""}${file}${rank}`;
    } else {
      // Handle move (stack movement)
      if (!args.from || !args.to || !args.stackSize || !args.dropPattern) {
        throw new Error(
          "From, to, stack size, and drop pattern required for move"
        );
      }

      const { from, to } = args;
      const { stackSize, dropPattern } = args;

      if (
        !isValidPosition(from.row, from.col, game.boardSize) ||
        !isValidPosition(to.row, to.col, game.boardSize)
      ) {
        throw new Error("Invalid position");
      }

      const fromStack = newBoard[from.row][from.col];
      if (fromStack.length === 0) {
        throw new Error("No pieces to move");
      }

      // Check if player controls the stack (top piece belongs to player)
      const topPiece = fromStack[fromStack.length - 1];
      if (topPiece.player !== playerColor) {
        throw new Error("You don't control this stack");
      }

      if (stackSize > fromStack.length || stackSize > game.boardSize) {
        throw new Error("Invalid stack size");
      }

      // Move must be in straight line
      const rowDiff = to.row - from.row;
      const colDiff = to.col - from.col;
      if (rowDiff !== 0 && colDiff !== 0) {
        throw new Error("Move must be in straight line");
      }

      const distance = Math.abs(rowDiff) + Math.abs(colDiff);
      if (dropPattern.length !== distance) {
        throw new Error("Drop pattern length must match distance");
      }

      const totalDrops = dropPattern.reduce((sum, count) => sum + count, 0);
      if (totalDrops !== stackSize) {
        throw new Error("Drop pattern must sum to stack size");
      }

      // Move pieces
      const movingPieces = fromStack.splice(-stackSize);

      const rowStep = rowDiff === 0 ? 0 : rowDiff > 0 ? 1 : -1;
      const colStep = colDiff === 0 ? 0 : colDiff > 0 ? 1 : -1;

      let currentRow = from.row;
      let currentCol = from.col;

      for (let i = 0; i < dropPattern.length; i++) {
        currentRow += rowStep;
        currentCol += colStep;

        const dropCount = dropPattern[i];
        const targetStack = newBoard[currentRow][currentCol];

        // Check for obstructions
        if (targetStack.length > 0) {
          const topPieceAtTarget = targetStack[targetStack.length - 1];

          // Can't move onto capstones
          if (topPieceAtTarget.type === "capstone") {
            throw new Error("Cannot move onto capstone");
          }

          // Can only flatten walls with capstone on final drop
          if (topPieceAtTarget.type === "wall") {
            if (
              i !== dropPattern.length - 1 ||
              dropCount !== 1 ||
              movingPieces[movingPieces.length - 1].type !== "capstone"
            ) {
              throw new Error("Can only flatten wall with single capstone");
            }
            // Flatten the wall
            targetStack[targetStack.length - 1] = {
              ...topPieceAtTarget,
              type: "flat",
            };
          }
        }

        // Drop pieces
        for (let j = 0; j < dropCount; j++) {
          targetStack.push(movingPieces.shift()!);
        }
      }

      // Generate notation for move
      const fromFile = String.fromCharCode(97 + from.col);
      const fromRank = from.row + 1;
      const _toFile = String.fromCharCode(97 + to.col);
      const _toRank = to.row + 1;
      const direction =
        rowDiff > 0 ? "+" : rowDiff < 0 ? "-" : colDiff > 0 ? ">" : "<";

      notation = `${stackSize > 1 ? stackSize : ""}${fromFile}${fromRank}${direction}`;
      if (dropPattern.length > 1 || dropPattern[0] !== stackSize) {
        notation += dropPattern.join("");
      }
    }

    // Check for win conditions
    let winner: Player | "draw" | undefined;
    let winCondition: "road" | "flat" | undefined;

    // Check for road win
    if (checkRoad(newBoard, "white")) {
      winner = "white";
      winCondition = "road";
    } else if (checkRoad(newBoard, "black")) {
      winner = "black";
      winCondition = "road";
    } else if (
      isBoardFull(newBoard) ||
      newWhitePieces.flat + newWhitePieces.capstone === 0 ||
      newBlackPieces.flat + newBlackPieces.capstone === 0
    ) {
      // Check for flat win
      const flatCounts = countFlatStones(newBoard);
      const whiteScore = flatCounts.white + (game.komi || 0) / 2;
      const blackScore = flatCounts.black;

      if (whiteScore > blackScore) {
        winner = "white";
      } else if (blackScore > whiteScore) {
        winner = "black";
      } else {
        winner = "draw";
      }
      winCondition = "flat";
    }

    // Update game state
    const nextPlayer = playerColor === "white" ? "black" : "white";
    const newStatus: GameStatus = winner ? "finished" : "active";

    await ctx.db.patch(args.gameId, {
      board: newBoard,
      whitePieces: newWhitePieces,
      blackPieces: newBlackPieces,
      currentPlayer: newStatus === "finished" ? game.currentPlayer : nextPlayer,
      moveCount: game.moveCount + 1,
      status: newStatus,
      winner,
      winCondition,
    });

    // Record the move
    await ctx.db.insert("moves", {
      gameId: args.gameId,
      moveNumber: game.moveCount + 1,
      player: playerColor,
      type: args.type,
      position: args.position,
      pieceType: args.pieceType,
      from: args.from,
      to: args.to,
      stackSize: args.stackSize,
      dropPattern: args.dropPattern,
      notation,
      createdAt: Date.now(),
    });
  },
});

// Get game by ID
export const getGame = query({
  args: { gameId: v.id("games") },
  returns: v.union(
    v.object({
      _id: v.id("games"),
      _creationTime: v.number(),
      boardSize: v.number(),
      status: v.union(
        v.literal("waiting"),
        v.literal("active"),
        v.literal("finished")
      ),
      createdAt: v.number(),
      whitePlayer: v.id("users"),
      blackPlayer: v.optional(v.id("users")),
      currentPlayer: v.union(v.literal("white"), v.literal("black")),
      moveCount: v.number(),
      board: v.array(
        v.array(
          v.array(
            v.object({
              type: v.union(
                v.literal("flat"),
                v.literal("wall"),
                v.literal("capstone")
              ),
              player: v.union(v.literal("white"), v.literal("black")),
            })
          )
        )
      ),
      whitePieces: v.object({
        flat: v.number(),
        capstone: v.number(),
      }),
      blackPieces: v.object({
        flat: v.number(),
        capstone: v.number(),
      }),
      winner: v.optional(
        v.union(v.literal("white"), v.literal("black"), v.literal("draw"))
      ),
      winCondition: v.optional(
        v.union(v.literal("road"), v.literal("flat"), v.literal("resign"))
      ),
      komi: v.optional(v.number()),
      isRanked: v.boolean(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.gameId);
  },
});

// Get available games to join
export const getAvailableGames = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("games"),
      boardSize: v.number(),
      createdAt: v.number(),
      whitePlayer: v.id("users"),
      isRanked: v.boolean(),
      komi: v.optional(v.number()),
    })
  ),
  handler: async (ctx) => {
    const games = await ctx.db
      .query("games")
      .withIndex("by_status", (q) => q.eq("status", "waiting"))
      .order("desc")
      .take(20);

    return games.map((game) => ({
      _id: game._id,
      boardSize: game.boardSize,
      createdAt: game.createdAt,
      whitePlayer: game.whitePlayer,
      isRanked: game.isRanked,
      komi: game.komi,
    }));
  },
});

// Get user's games
export const getUserGames = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("games"),
      boardSize: v.number(),
      status: v.union(
        v.literal("waiting"),
        v.literal("active"),
        v.literal("finished")
      ),
      createdAt: v.number(),
      whitePlayer: v.id("users"),
      blackPlayer: v.optional(v.id("users")),
      currentPlayer: v.union(v.literal("white"), v.literal("black")),
      moveCount: v.number(),
      winner: v.optional(
        v.union(v.literal("white"), v.literal("black"), v.literal("draw"))
      ),
      isRanked: v.boolean(),
    })
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    const whiteGames = await ctx.db
      .query("games")
      .withIndex("by_white_player", (q) => q.eq("whitePlayer", userId))
      .order("desc")
      .take(50);

    const blackGames = await ctx.db
      .query("games")
      .withIndex("by_black_player", (q) => q.eq("blackPlayer", userId))
      .order("desc")
      .take(50);

    const allGames = [...whiteGames, ...blackGames]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 50);

    return allGames.map((game) => ({
      _id: game._id,
      boardSize: game.boardSize,
      status: game.status,
      createdAt: game.createdAt,
      whitePlayer: game.whitePlayer,
      blackPlayer: game.blackPlayer,
      currentPlayer: game.currentPlayer,
      moveCount: game.moveCount,
      winner: game.winner,
      isRanked: game.isRanked,
    }));
  },
});

// Get moves for a game
export const getGameMoves = query({
  args: { gameId: v.id("games") },
  returns: v.array(
    v.object({
      _id: v.id("moves"),
      moveNumber: v.number(),
      player: v.union(v.literal("white"), v.literal("black")),
      type: v.union(v.literal("place"), v.literal("move")),
      notation: v.string(),
      createdAt: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    const moves = await ctx.db
      .query("moves")
      .withIndex("by_game", (q) => q.eq("gameId", args.gameId))
      .order("asc")
      .collect();

    return moves.map((move) => ({
      _id: move._id,
      moveNumber: move.moveNumber,
      player: move.player,
      type: move.type,
      notation: move.notation,
      createdAt: move.createdAt,
    }));
  },
});

// Resign from game
export const resignGame = mutation({
  args: { gameId: v.id("games") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const game = await ctx.db.get(args.gameId);
    if (!game) {
      throw new Error("Game not found");
    }

    if (game.status !== "active") {
      throw new Error("Game is not active");
    }

    const isWhitePlayer = game.whitePlayer === userId;
    const isBlackPlayer = game.blackPlayer === userId;

    if (!isWhitePlayer && !isBlackPlayer) {
      throw new Error("You are not a player in this game");
    }

    const winner = isWhitePlayer ? "black" : "white";

    await ctx.db.patch(args.gameId, {
      status: "finished",
      winner,
      winCondition: "resign",
    });
  },
});
