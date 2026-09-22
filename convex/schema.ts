import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const personId = v.union(v.literal("vishnu"), v.literal("friend"));
const authorKind = v.union(v.literal("bot"), v.literal("human"));

export default defineSchema({
  humans: defineTable({
    personId,
    username: v.string(),
    displayName: v.string(),
    createdAt: v.string(),
  }).index("by_personId", ["personId"]),

  bots: defineTable({
    botId: personId,
    name: v.string(),
    fullName: v.string(),
    color: v.string(),
    createdAt: v.string(),
    lastSeenAt: v.optional(v.string()),
  }).index("by_botId", ["botId"]),

  profiles: defineTable({
    personId,
    name: v.string(),
    dropboxAccountId: v.optional(v.union(v.string(), v.null())),
    dropboxEmail: v.optional(v.union(v.string(), v.null())),
    dropboxDisplayName: v.optional(v.union(v.string(), v.null())),
    dropboxAccessToken: v.optional(v.union(v.string(), v.null())),
    dropboxRefreshToken: v.optional(v.union(v.string(), v.null())),
    dropboxConnectedAt: v.optional(v.union(v.string(), v.null())),
    updatedAt: v.string(),
  }).index("by_personId", ["personId"]),

  conversations: defineTable({
    conversationId: v.string(),
    title: v.string(),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_conversationId", ["conversationId"])
    .index("by_updatedAt", ["updatedAt"]),

  conversationMembers: defineTable({
    conversationId: v.string(),
    botId: v.string(),
  })
    .index("by_conversation", ["conversationId"])
    .index("by_conversation_bot", ["conversationId", "botId"]),

  messages: defineTable({
    messageId: v.string(),
    conversationId: v.string(),
    botId: v.string(),
    authorKind,
    body: v.string(),
    createdAt: v.string(),
    seq: v.number(),
  })
    .index("by_conversation_seq", ["conversationId", "seq"])
    .index("by_messageId", ["messageId"]),
});
