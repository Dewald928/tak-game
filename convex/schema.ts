import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const applicationTables = {
  games: defineTable({
    boardSize: v.number(), // 3, 4, 5, 6, 7, or 8
    board: v.array(v.array(v.array(v.object({
      type: v.union(v.literal("flat"), v.literal("standing"), v.literal("capstone")),
      player: v.union(v.literal("white"), v.literal("black"))
    })))), // 3D array: [row][col][stack]
    currentPlayer: v.union(v.literal("white"), v.literal("black")),
    whitePlayer: v.id("users"),
    blackPlayer: v.optional(v.id("users")),
    status: v.union(
      v.literal("waiting"), 
      v.literal("active"), 
      v.literal("finished")
    ),
    winner: v.optional(v.union(v.literal("white"), v.literal("black"), v.literal("draw"))),
    winCondition: v.optional(v.union(v.literal("road"), v.literal("flat"), v.literal("resign"))),
    moveCount: v.number(),
    isOpeningPhase: v.optional(v.boolean()), // Track opening phase where players place opponent's pieces
    whitePieces: v.object({
      flat: v.number(),
      capstone: v.number()
    }),
    blackPieces: v.object({
      flat: v.number(),
      capstone: v.number()
    })
  })
    .index("by_status", ["status"])
    .index("by_player", ["whitePlayer"])
    .index("by_black_player", ["blackPlayer"]),

  moves: defineTable({
    gameId: v.id("games"),
    player: v.union(v.literal("white"), v.literal("black")),
    moveNumber: v.number(),
    type: v.union(v.literal("place"), v.literal("move")),
    // For place moves
    position: v.optional(v.object({
      row: v.number(),
      col: v.number()
    })),
    pieceType: v.optional(v.union(v.literal("flat"), v.literal("standing"), v.literal("capstone"))),
    // For move moves
    from: v.optional(v.object({
      row: v.number(),
      col: v.number()
    })),
    to: v.optional(v.object({
      row: v.number(),
      col: v.number()
    })),
    stackSize: v.optional(v.number()),
    dropPattern: v.optional(v.array(v.number()))
  }).index("by_game", ["gameId"])
};

export default defineSchema({
  ...authTables,
  ...applicationTables,
});
