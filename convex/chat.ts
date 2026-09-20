import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  conversationDoc,
  friendName,
  getProfile,
  mapConversation,
  mapMessage,
} from "./model";

export const listConversations = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("conversations").collect();
    rows.sort((a, b) => {
      if (a.updatedAt === b.updatedAt) return a.conversationId.localeCompare(b.conversationId);
      return a.updatedAt < b.updatedAt ? 1 : -1;
    });
    return Promise.all(rows.map((row) => mapConversation(ctx, row)));
  },
});

export const getConversation = query({
  args: { conversationId: v.string() },
  handler: async (ctx, args) => {
    const row = await conversationDoc(ctx, args.conversationId);
    return row ? mapConversation(ctx, row) : null;
  },
});

export const conversationHasMember = query({
  args: { conversationId: v.string(), botId: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("conversationMembers")
      .withIndex("by_conversation_bot", (q) =>
        q.eq("conversationId", args.conversationId).eq("botId", args.botId),
      )
      .unique();
    return Boolean(row);
  },
});

export const lastSeq = query({
  args: { conversationId: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("messages")
      .withIndex("by_conversation_seq", (q) =>
        q.eq("conversationId", args.conversationId),
      )
      .order("desc")
      .first();
    return row?.seq ?? 0;
  },
});

export const listMessages = query({
  args: {
    conversationId: v.string(),
    after: v.optional(v.union(v.string(), v.number(), v.null())),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? 200, 1), 500);
    const friendDisplayName = await friendName(ctx);
    const rows = await ctx.db
      .query("messages")
      .withIndex("by_conversation_seq", (q) =>
        q.eq("conversationId", args.conversationId),
      )
      .collect();
    rows.sort((a, b) => a.seq - b.seq);

    const after = args.after;
    if (after === undefined || after === null || after === "") {
      return rows.slice(0, limit).map((row) => mapMessage(row, friendDisplayName));
    }

    const afterText = String(after);
    const afterAsSeq = Number.parseInt(afterText, 10);
    const byId = rows.find((row) => row.messageId === afterText);
    let minSeq = -1;
    if (byId) {
      minSeq = byId.seq;
    } else if (Number.isFinite(afterAsSeq) && afterText === String(afterAsSeq)) {
      minSeq = afterAsSeq;
    } else {
      return rows
        .filter((row) => row.createdAt > afterText)
        .slice(0, limit)
        .map((row) => mapMessage(row, friendDisplayName));
    }

    return rows
      .filter((row) => row.seq > minSeq)
      .slice(0, limit)
      .map((row) => mapMessage(row, friendDisplayName));
  },
});

export const createConversation = mutation({
  args: {
    title: v.optional(v.string()),
    memberIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const conversationId = `cnv_${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`;
    const createdAt = new Date().toISOString();
    const title = (args.title?.trim() || "New thread").slice(0, 80);
    const uniqueMembers = Array.from(new Set(args.memberIds));

    await ctx.db.insert("conversations", {
      conversationId,
      title,
      createdAt,
      updatedAt: createdAt,
    });
    for (const botId of uniqueMembers) {
      await ctx.db.insert("conversationMembers", { conversationId, botId });
    }

    const row = await conversationDoc(ctx, conversationId);
    return row ? mapConversation(ctx, row) : null;
  },
});

export const createMessage = mutation({
  args: {
    conversationId: v.string(),
    authorId: v.string(),
    authorKind: v.union(v.literal("bot"), v.literal("human")),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    const last = await ctx.db
      .query("messages")
      .withIndex("by_conversation_seq", (q) =>
        q.eq("conversationId", args.conversationId),
      )
      .order("desc")
      .first();
    const seq = (last?.seq ?? 0) + 1;
    const messageId = `msg_${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`;
    const createdAt = new Date().toISOString();

    await ctx.db.insert("messages", {
      messageId,
      conversationId: args.conversationId,
      botId: args.authorId,
      authorKind: args.authorKind,
      body: args.body,
      createdAt,
      seq,
    });

    const conversation = await conversationDoc(ctx, args.conversationId);
    if (conversation) {
      await ctx.db.patch(conversation._id, { updatedAt: createdAt });
    }

    const friendDisplayName = await friendName(ctx);
    return mapMessage(
      {
        messageId,
        conversationId: args.conversationId,
        botId: args.authorId,
        authorKind: args.authorKind,
        body: args.body,
        createdAt,
        seq,
      },
      friendDisplayName,
    );
  },
});

export const getFriendProfile = query({
  args: {},
  handler: async (ctx) => getProfile(ctx),
});

export const saveFriendName = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const trimmed = args.name.trim().slice(0, 40);
    const row = await ctx.db
      .query("profiles")
      .withIndex("by_personId", (q) => q.eq("personId", "friend"))
      .unique();
    const updatedAt = new Date().toISOString();
    if (row) {
      await ctx.db.patch(row._id, { name: trimmed, updatedAt });
    } else {
      await ctx.db.insert("profiles", {
        personId: "friend",
        name: trimmed,
        updatedAt,
      });
    }
    return getProfile(ctx);
  },
});

export const saveFriendDropbox = mutation({
  args: {
    accountId: v.string(),
    email: v.string(),
    displayName: v.string(),
    accessToken: v.string(),
    refreshToken: v.string(),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("profiles")
      .withIndex("by_personId", (q) => q.eq("personId", "friend"))
      .unique();
    const now = new Date().toISOString();
    const fields = {
      dropboxAccountId: args.accountId,
      dropboxEmail: args.email,
      dropboxDisplayName: args.displayName,
      dropboxAccessToken: args.accessToken,
      dropboxRefreshToken: args.refreshToken,
      dropboxConnectedAt: now,
      updatedAt: now,
    };
    if (row) {
      await ctx.db.patch(row._id, fields);
    } else {
      await ctx.db.insert("profiles", {
        personId: "friend",
        name: "",
        ...fields,
      });
    }
    return getProfile(ctx);
  },
});

export const clearFriendDropbox = mutation({
  args: {},
  handler: async (ctx) => {
    const row = await ctx.db
      .query("profiles")
      .withIndex("by_personId", (q) => q.eq("personId", "friend"))
      .unique();
    if (row) {
      await ctx.db.patch(row._id, {
        dropboxAccountId: null,
        dropboxEmail: null,
        dropboxDisplayName: null,
        dropboxAccessToken: null,
        dropboxRefreshToken: null,
        dropboxConnectedAt: null,
        updatedAt: new Date().toISOString(),
      });
    }
    return getProfile(ctx);
  },
});
