import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { api } from "./_generated/api";
import { Id } from "./_generated/dataModel";

// Initialize a new game board
function createEmptyBoard(size: number) {
  return Array(size)
    .fill(null)
    .map(() =>
      Array(size)
        .fill(null)
        .map(() => [])
    );
}

// Get initial piece counts based on board size (correct Tak rules)
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

export const createGame = mutation({
  args: { boardSize: v.number() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Must be logged in");

    if (![3, 4, 5, 6, 7, 8].includes(args.boardSize)) {
      throw new Error("Board size must be 3, 4, 5, 6, 7, or 8");
    }

    const pieces = getInitialPieces(args.boardSize);

    const gameId = await ctx.db.insert("games", {
      boardSize: args.boardSize,
      board: createEmptyBoard(args.boardSize),
      currentPlayer: "white",
      whitePlayer: userId,
      status: "waiting",
      moveCount: 0,
      whitePieces: pieces,
      blackPieces: pieces,
      isOpeningPhase: true, // Track opening phase where players place opponent's pieces
    });

    return gameId;
  },
});

export const joinGame = mutation({
  args: { gameId: v.id("games") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Must be logged in");

    const game = await ctx.db.get(args.gameId);
    if (!game) throw new Error("Game not found");

    if (game.status !== "waiting") {
      throw new Error("Game is not available to join");
    }

    if (game.whitePlayer === userId) {
      throw new Error("Cannot join your own game");
    }

    await ctx.db.patch(args.gameId, {
      blackPlayer: userId,
      status: "active",
    });

    return args.gameId;
  },
});

export const findGame = mutation({
  args: { boardSize: v.number() },
  handler: async (ctx, args): Promise<Id<"games">> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Must be logged in");

    // Look for an existing waiting game
    const waitingGame = await ctx.db
      .query("games")
      .withIndex("by_status", (q) => q.eq("status", "waiting"))
      .filter((q) =>
        q.and(
          q.eq(q.field("boardSize"), args.boardSize),
          q.neq(q.field("whitePlayer"), userId)
        )
      )
      .first();

    if (waitingGame) {
      // Join existing game
      await ctx.db.patch(waitingGame._id, {
        blackPlayer: userId,
        status: "active",
      });
      return waitingGame._id;
    } else {
      // Create new game
      return await ctx.runMutation(api.games.createGame, {
        boardSize: args.boardSize,
      });
    }
  },
});

export const getGame = query({
  args: { gameId: v.id("games") },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId);
    if (!game) return null;

    const whitePlayer = await ctx.db.get(game.whitePlayer);
    const blackPlayer = game.blackPlayer
      ? await ctx.db.get(game.blackPlayer)
      : null;

    return {
      ...game,
      whitePlayerName: whitePlayer?.email || "White Player",
      blackPlayerName: blackPlayer?.email || "Black Player",
    };
  },
});

export const getUserGames = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const whiteGames = await ctx.db
      .query("games")
      .withIndex("by_player", (q) => q.eq("whitePlayer", userId))
      .collect();

    const blackGames = await ctx.db
      .query("games")
      .withIndex("by_black_player", (q) => q.eq("blackPlayer", userId))
      .collect();

    return [...whiteGames, ...blackGames].sort(
      (a, b) => b._creationTime - a._creationTime
    );
  },
});

export const getUserStats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const whiteGames = await ctx.db
      .query("games")
      .withIndex("by_player", (q) => q.eq("whitePlayer", userId))
      .collect();

    const blackGames = await ctx.db
      .query("games")
      .withIndex("by_black_player", (q) => q.eq("blackPlayer", userId))
      .collect();

    const allGames = [...whiteGames, ...blackGames];
    const finishedGames = allGames.filter((game) => game.status === "finished");

    const wins = finishedGames.filter(
      (game) =>
        game.winner === (game.whitePlayer === userId ? "white" : "black")
    ).length;
    const losses = finishedGames.filter(
      (game) =>
        game.winner !== (game.whitePlayer === userId ? "white" : "black") &&
        game.winner !== "draw"
    ).length;
    const draws = finishedGames.filter((game) => game.winner === "draw").length;

    const roadWins = finishedGames.filter(
      (game) =>
        game.winner === (game.whitePlayer === userId ? "white" : "black") &&
        game.winCondition === "road"
    ).length;

    const flatWins = finishedGames.filter(
      (game) =>
        game.winner === (game.whitePlayer === userId ? "white" : "black") &&
        game.winCondition === "flat"
    ).length;

    return {
      totalGames: allGames.length,
      finishedGames: finishedGames.length,
      activeGames: allGames.filter((game) => game.status === "active").length,
      wins,
      losses,
      draws,
      roadWins,
      flatWins,
      winRate:
        finishedGames.length > 0
          ? Math.round((wins / finishedGames.length) * 100)
          : 0,
    };
  },
});

// Check if a position is valid for the board
function isValidPosition(row: number, col: number, boardSize: number): boolean {
  return row >= 0 && row < boardSize && col >= 0 && col < boardSize;
}

// Check if there's a road (winning condition)
function checkRoad(board: any[][][], player: "white" | "black"): boolean {
  const size = board.length;
  const visited = Array(size)
    .fill(null)
    .map(() => Array(size).fill(false));

  // Check horizontal road (left to right)
  for (let row = 0; row < size; row++) {
    if (
      board[row][0].length > 0 &&
      board[row][0][board[row][0].length - 1].player === player &&
      board[row][0][board[row][0].length - 1].type !== "standing"
    ) {
      if (dfsRoad(board, visited, row, 0, player, "horizontal")) {
        return true;
      }
    }
  }

  // Check vertical road (top to bottom)
  for (let col = 0; col < size; col++) {
    if (
      board[0][col].length > 0 &&
      board[0][col][board[0][col].length - 1].player === player &&
      board[0][col][board[0][col].length - 1].type !== "standing"
    ) {
      const newVisited = Array(size)
        .fill(null)
        .map(() => Array(size).fill(false));
      if (dfsRoad(board, newVisited, 0, col, player, "vertical")) {
        return true;
      }
    }
  }

  return false;
}

function dfsRoad(
  board: any[][][],
  visited: boolean[][],
  row: number,
  col: number,
  player: "white" | "black",
  direction: "horizontal" | "vertical"
): boolean {
  const size = board.length;

  if (direction === "horizontal" && col === size - 1) return true;
  if (direction === "vertical" && row === size - 1) return true;

  visited[row][col] = true;

  const directions = [
    [0, 1],
    [0, -1],
    [1, 0],
    [-1, 0],
  ];

  for (const [dr, dc] of directions) {
    const newRow = row + dr;
    const newCol = col + dc;

    if (
      isValidPosition(newRow, newCol, size) &&
      !visited[newRow][newCol] &&
      board[newRow][newCol].length > 0
    ) {
      const topPiece = board[newRow][newCol][board[newRow][newCol].length - 1];
      if (topPiece.player === player && topPiece.type !== "standing") {
        if (dfsRoad(board, visited, newRow, newCol, player, direction)) {
          return true;
        }
      }
    }
  }

  return false;
}

// Check if board is full
function isBoardFull(board: any[][][]): boolean {
  for (let row = 0; row < board.length; row++) {
    for (let col = 0; col < board[row].length; col++) {
      if (board[row][col].length === 0) {
        return false;
      }
    }
  }
  return true;
}

// Count flat stones for each player (only top pieces count)
function countFlatStones(board: any[][][]): { white: number; black: number } {
  let whiteFlats = 0;
  let blackFlats = 0;

  for (let row = 0; row < board.length; row++) {
    for (let col = 0; col < board[row].length; col++) {
      const stack = board[row][col];
      if (stack.length > 0) {
        const topPiece = stack[stack.length - 1];
        if (topPiece.type === "flat") {
          if (topPiece.player === "white") {
            whiteFlats++;
          } else {
            blackFlats++;
          }
        }
      }
    }
  }

  return { white: whiteFlats, black: blackFlats };
}

// Check if either player has run out of pieces
function hasPlayerRunOutOfPieces(whitePieces: any, blackPieces: any): boolean {
  return (
    (whitePieces.flat <= 0 && whitePieces.capstone <= 0) ||
    (blackPieces.flat <= 0 && blackPieces.capstone <= 0)
  );
}

// Check if a player is one move away from winning (Tak condition)
function checkTak(board: any[][][], player: "white" | "black"): boolean {
  const size = board.length;

  // Check if player can complete a road in one move by placing a piece
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (board[row][col].length === 0) {
        // Try placing a flat stone here
        const testBoard = JSON.parse(JSON.stringify(board));
        testBoard[row][col].push({ type: "flat", player });

        if (checkRoad(testBoard, player)) {
          return true;
        }
      }
    }
  }

  return false;
}

// Determine winner based on endgame conditions
function determineWinner(
  board: any[][][],
  whitePieces: any,
  blackPieces: any,
  activePlayer: "white" | "black"
): {
  winner?: "white" | "black" | "draw";
  winCondition?: "road" | "flat" | "resign";
  takWarning?: "white" | "black";
} {
  // Check for road wins first (Dragon clause: active player wins if both have roads)
  const whiteHasRoad = checkRoad(board, "white");
  const blackHasRoad = checkRoad(board, "black");

  if (whiteHasRoad && blackHasRoad) {
    // Dragon clause: active player wins when both have roads
    return { winner: activePlayer, winCondition: "road" };
  } else if (whiteHasRoad) {
    return { winner: "white", winCondition: "road" };
  } else if (blackHasRoad) {
    return { winner: "black", winCondition: "road" };
  }

  // Check for flat win conditions
  const boardFull = isBoardFull(board);
  const outOfPieces = hasPlayerRunOutOfPieces(whitePieces, blackPieces);

  if (boardFull || outOfPieces) {
    const flatCounts = countFlatStones(board);

    if (flatCounts.white > flatCounts.black) {
      return { winner: "white", winCondition: "flat" };
    } else if (flatCounts.black > flatCounts.white) {
      return { winner: "black", winCondition: "flat" };
    } else {
      return { winner: "draw", winCondition: "flat" };
    }
  }

  // Check for Tak warning (one move away from road win)
  let takWarning: "white" | "black" | undefined = undefined;
  if (checkTak(board, "white")) {
    takWarning = "white";
  } else if (checkTak(board, "black")) {
    takWarning = "black";
  }

  return { takWarning };
}

export const placePiece = mutation({
  args: {
    gameId: v.id("games"),
    row: v.number(),
    col: v.number(),
    pieceType: v.union(
      v.literal("flat"),
      v.literal("standing"),
      v.literal("capstone")
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Must be logged in");

    const game = await ctx.db.get(args.gameId);
    if (!game) throw new Error("Game not found");

    if (game.status !== "active") {
      throw new Error("Game is not active");
    }

    // Determine player color
    let playerColor: "white" | "black";
    if (game.whitePlayer === userId) {
      playerColor = "white";
    } else if (game.blackPlayer === userId) {
      playerColor = "black";
    } else {
      throw new Error("You are not a player in this game");
    }

    if (game.currentPlayer !== playerColor) {
      throw new Error("It's not your turn");
    }

    // Validate position
    if (!isValidPosition(args.row, args.col, game.boardSize)) {
      throw new Error("Invalid position");
    }

    // Check if position is empty
    if (game.board[args.row][args.col].length > 0) {
      throw new Error("Position is not empty");
    }

    // Handle opening phase (first two moves where players place opponent's pieces)
    let pieceOwner: "white" | "black";
    let isOpeningMove = false;

    if ((game.isOpeningPhase ?? false) && game.moveCount < 2) {
      // During opening, place opponent's piece
      pieceOwner = playerColor === "white" ? "black" : "white";
      isOpeningMove = true;

      // Opening moves must be flat stones only
      if (args.pieceType !== "flat") {
        throw new Error("Opening moves must be flat stones");
      }
    } else {
      // Normal play - place your own piece
      pieceOwner = playerColor;

      // Check piece availability
      const pieces =
        playerColor === "white" ? game.whitePieces : game.blackPieces;
      if (args.pieceType === "capstone" && pieces.capstone <= 0) {
        throw new Error("No capstones remaining");
      }
      if (args.pieceType !== "capstone" && pieces.flat <= 0) {
        throw new Error("No flat stones remaining");
      }
    }

    // Place the piece
    const newBoard = JSON.parse(JSON.stringify(game.board));
    newBoard[args.row][args.col].push({
      type: args.pieceType,
      player: pieceOwner,
    });

    // Update piece counts (only for non-opening moves)
    const newWhitePieces = { ...game.whitePieces };
    const newBlackPieces = { ...game.blackPieces };

    if (!isOpeningMove) {
      if (playerColor === "white") {
        if (args.pieceType === "capstone") {
          newWhitePieces.capstone--;
        } else {
          newWhitePieces.flat--;
        }
      } else {
        if (args.pieceType === "capstone") {
          newBlackPieces.capstone--;
        } else {
          newBlackPieces.flat--;
        }
      }
    }

    // Check for win condition using new endgame logic
    let winner: "white" | "black" | "draw" | undefined = undefined;
    let winCondition: "road" | "flat" | "resign" | undefined = undefined;
    let takWarning: "white" | "black" | undefined = undefined;

    if (!(game.isOpeningPhase ?? false) || game.moveCount >= 1) {
      const result = determineWinner(
        newBoard,
        newWhitePieces,
        newBlackPieces,
        playerColor
      );
      winner = result.winner;
      winCondition = result.winCondition;
      takWarning = result.takWarning;
    }

    // Record the move
    await ctx.db.insert("moves", {
      gameId: args.gameId,
      player: playerColor,
      moveNumber: game.moveCount + 1,
      type: "place",
      position: { row: args.row, col: args.col },
      pieceType: args.pieceType,
    });

    // Update game state
    const newMoveCount = game.moveCount + 1;
    const isStillOpeningPhase =
      (game.isOpeningPhase ?? false) && newMoveCount < 2;

    await ctx.db.patch(args.gameId, {
      board: newBoard,
      currentPlayer: playerColor === "white" ? "black" : "white",
      moveCount: newMoveCount,
      whitePieces: newWhitePieces,
      blackPieces: newBlackPieces,
      isOpeningPhase: isStillOpeningPhase,
      ...(winner && {
        status: "finished" as const,
        winner,
        winCondition,
      }),
    });

    return {
      success: true,
      winner,
      winCondition,
      isOpeningMove,
      pieceOwner,
      takWarning,
    };
  },
});

export const movePieces = mutation({
  args: {
    gameId: v.id("games"),
    fromRow: v.number(),
    fromCol: v.number(),
    toRow: v.number(),
    toCol: v.number(),
    stackSize: v.number(),
    dropPattern: v.array(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Must be logged in");

    const game = await ctx.db.get(args.gameId);
    if (!game) throw new Error("Game not found");

    if (game.status !== "active") {
      throw new Error("Game is not active");
    }

    // Determine player color
    let playerColor: "white" | "black";
    if (game.whitePlayer === userId) {
      playerColor = "white";
    } else if (game.blackPlayer === userId) {
      playerColor = "black";
    } else {
      throw new Error("You are not a player in this game");
    }

    if (game.currentPlayer !== playerColor) {
      throw new Error("It's not your turn");
    }

    // Can't move during opening phase
    if ((game.isOpeningPhase ?? false) && game.moveCount < 2) {
      throw new Error("Cannot move pieces during opening phase");
    }

    // Validate positions
    if (
      !isValidPosition(args.fromRow, args.fromCol, game.boardSize) ||
      !isValidPosition(args.toRow, args.toCol, game.boardSize)
    ) {
      throw new Error("Invalid position");
    }

    // Check if from position has pieces
    const fromStack = game.board[args.fromRow][args.fromCol];
    if (fromStack.length === 0) {
      throw new Error("No pieces to move");
    }

    // Check if player controls the top piece
    const topPiece = fromStack[fromStack.length - 1];
    if (topPiece.player !== playerColor) {
      throw new Error("You don't control the top piece");
    }

    // Validate stack size
    if (
      args.stackSize <= 0 ||
      args.stackSize > fromStack.length ||
      args.stackSize > game.boardSize
    ) {
      throw new Error("Invalid stack size");
    }

    // Validate movement direction (must be straight line)
    const rowDiff = args.toRow - args.fromRow;
    const colDiff = args.toCol - args.fromCol;

    if ((rowDiff !== 0 && colDiff !== 0) || (rowDiff === 0 && colDiff === 0)) {
      throw new Error("Must move in a straight line");
    }

    const distance = Math.abs(rowDiff) + Math.abs(colDiff);

    // Validate drop pattern
    if (args.dropPattern.length !== distance) {
      throw new Error("Drop pattern length must match distance");
    }

    const totalDropped = args.dropPattern.reduce(
      (sum, count) => sum + count,
      0
    );
    if (totalDropped !== args.stackSize) {
      throw new Error("Drop pattern must account for all pieces");
    }

    // Check if all drop counts are positive
    if (args.dropPattern.some((count) => count <= 0)) {
      throw new Error("All drop counts must be positive");
    }

    // Calculate path
    const stepRow = rowDiff === 0 ? 0 : rowDiff / Math.abs(rowDiff);
    const stepCol = colDiff === 0 ? 0 : colDiff / Math.abs(colDiff);

    const path = [];
    for (let i = 1; i <= distance; i++) {
      path.push({
        row: args.fromRow + stepRow * i,
        col: args.fromCol + stepCol * i,
      });
    }

    // Create new board state
    const newBoard = JSON.parse(JSON.stringify(game.board));

    // Remove pieces from source
    const movingPieces = newBoard[args.fromRow][args.fromCol].splice(
      -args.stackSize
    );

    // Validate movement rules and place pieces along path
    const piecesRemaining = [...movingPieces];

    for (let i = 0; i < path.length; i++) {
      const pos = path[i];
      const dropCount = args.dropPattern[i];
      const targetStack = newBoard[pos.row][pos.col];

      // Check if we can move onto this square
      if (targetStack.length > 0) {
        const topPieceOnTarget = targetStack[targetStack.length - 1];

        // Can't move onto standing stones unless we have a capstone
        if (topPieceOnTarget.type === "standing") {
          const movingTopPiece = piecesRemaining[piecesRemaining.length - 1];
          if (movingTopPiece.type !== "capstone") {
            throw new Error("Only capstones can move onto standing stones");
          }

          // Capstone flattens the standing stone
          if (i === path.length - 1 && dropCount === 1) {
            topPieceOnTarget.type = "flat";
          } else {
            throw new Error(
              "Capstone can only flatten standing stone if it's the final piece dropped"
            );
          }
        }

        // Can't move onto capstones
        if (topPieceOnTarget.type === "capstone") {
          throw new Error("Cannot move onto capstones");
        }
      }

      // Drop pieces
      const droppedPieces = piecesRemaining.splice(-dropCount);
      newBoard[pos.row][pos.col].push(...droppedPieces);
    }

    // Check for win condition using new endgame logic
    let winner: "white" | "black" | "draw" | undefined = undefined;
    let winCondition: "road" | "flat" | "resign" | undefined = undefined;
    let takWarning: "white" | "black" | undefined = undefined;

    const result = determineWinner(
      newBoard,
      game.whitePieces,
      game.blackPieces,
      playerColor
    );
    winner = result.winner;
    winCondition = result.winCondition;
    takWarning = result.takWarning;

    // Record the move
    await ctx.db.insert("moves", {
      gameId: args.gameId,
      player: playerColor,
      moveNumber: game.moveCount + 1,
      type: "move",
      from: { row: args.fromRow, col: args.fromCol },
      to: { row: args.toRow, col: args.toCol },
      stackSize: args.stackSize,
      dropPattern: args.dropPattern,
    });

    // Update game state
    await ctx.db.patch(args.gameId, {
      board: newBoard,
      currentPlayer: playerColor === "white" ? "black" : "white",
      moveCount: game.moveCount + 1,
      ...(winner && {
        status: "finished" as const,
        winner,
        winCondition,
      }),
    });

    return { success: true, winner, winCondition, takWarning };
  },
});

export const resign = mutation({
  args: { gameId: v.id("games") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Must be logged in");

    const game = await ctx.db.get(args.gameId);
    if (!game) throw new Error("Game not found");

    if (game.status !== "active") {
      throw new Error("Game is not active");
    }

    let playerColor: "white" | "black";
    if (game.whitePlayer === userId) {
      playerColor = "white";
    } else if (game.blackPlayer === userId) {
      playerColor = "black";
    } else {
      throw new Error("You are not a player in this game");
    }

    const winner = playerColor === "white" ? "black" : "white";

    await ctx.db.patch(args.gameId, {
      status: "finished",
      winner,
      winCondition: "resign",
    });

    return { success: true, winner };
  },
});

export const getGameMoves = query({
  args: { gameId: v.id("games") },
  handler: async (ctx, args) => {
    const moves = await ctx.db
      .query("moves")
      .withIndex("by_game", (q) => q.eq("gameId", args.gameId))
      .order("asc")
      .collect();

    return moves.map((move) => ({
      ...move,
      notation: generateMoveNotation(move),
    }));
  },
});

// Generate move notation (similar to chess notation)
function generateMoveNotation(move: any): string {
  if (move.type === "place") {
    const pos = `${String.fromCharCode(97 + move.position.col)}${move.position.row + 1}`;
    const piece =
      move.pieceType === "capstone"
        ? "C"
        : move.pieceType === "standing"
          ? "S"
          : "";
    return `${piece}${pos}`;
  } else if (move.type === "move") {
    const fromPos = `${String.fromCharCode(97 + move.from.col)}${move.from.row + 1}`;
    const toPos = `${String.fromCharCode(97 + move.to.col)}${move.to.row + 1}`;
    const pattern = move.dropPattern.join("");
    return `${move.stackSize}${fromPos}${pattern}${toPos}`;
  }
  return "";
}
