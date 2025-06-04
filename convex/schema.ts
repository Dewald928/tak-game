import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const takTables = {
  games: defineTable({
    // Game metadata
    boardSize: v.number(), // 3, 4, 5, 6, 7, or 8
    status: v.union(
      v.literal("waiting"), // Waiting for second player
      v.literal("active"), // Game in progress
      v.literal("finished") // Game completed
    ),
    createdAt: v.number(),

    // Players
    whitePlayer: v.id("users"),
    blackPlayer: v.optional(v.id("users")),
    currentPlayer: v.union(v.literal("white"), v.literal("black")),

    // Game state
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
    ), // 3D array: [row][col][stack]

    // Piece counts remaining
    whitePieces: v.object({
      flat: v.number(),
      capstone: v.number(),
    }),
    blackPieces: v.object({
      flat: v.number(),
      capstone: v.number(),
    }),

    // Win condition
    winner: v.optional(
      v.union(v.literal("white"), v.literal("black"), v.literal("draw"))
    ),
    winCondition: v.optional(
      v.union(v.literal("road"), v.literal("flat"), v.literal("resign"))
    ),

    // Game settings
    komi: v.optional(v.number()), // Half-point bonus
    isRanked: v.boolean(),
  })
    .index("by_status", ["status"])
    .index("by_white_player", ["whitePlayer"])
    .index("by_black_player", ["blackPlayer"])
    .index("by_created", ["createdAt"]),

  moves: defineTable({
    gameId: v.id("games"),
    moveNumber: v.number(),
    player: v.union(v.literal("white"), v.literal("black")),

    // Move data
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

    // For move moves (stack movement)
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
    stackSize: v.optional(v.number()), // How many pieces to move
    dropPattern: v.optional(v.array(v.number())), // How many pieces to drop at each position

    // Notation for PTN (Portable Tak Notation)
    notation: v.string(),

    createdAt: v.number(),
  }).index("by_game", ["gameId", "moveNumber"]),
};

export default defineSchema({
  ...authTables,
  ...takTables,
});
