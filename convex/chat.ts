import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  conversationDoc,
  deleteConversationMessages,
  ensureKiwiLab,
  friendName,
  getProfile,
  insertStarter,
  mapConversation,
  mapMessage,
  QUIET_ROOM_ID,
  removeQuietRoom,
  SEED_CONVERSATION_ID,
} from "./model";

const BOT_PRESENCE_WINDOW_MS = 30_000;

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

export const clearConversation = mutation({
  args: {
    conversationId: v.optional(v.string()),
    reseed: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const quiet = await removeQuietRoom(ctx);
    const conversationId = args.conversationId?.trim() || SEED_CONVERSATION_ID;

    if (conversationId === QUIET_ROOM_ID) {
      return {
        conversationId,
        deletedMessages: quiet.deletedMessages,
        reseeded: false,
        quietRoomRemoved: true,
        missing: false,
        removed: true,
      };
    }

    const reseed =
      args.reseed !== false && conversationId === SEED_CONVERSATION_ID;
    let row = await conversationDoc(ctx, conversationId);
    if (!row && conversationId === SEED_CONVERSATION_ID) {
      row = await ensureKiwiLab(ctx);
    }
    if (!row) {
      return {
        conversationId,
        deletedMessages: 0,
        reseeded: false,
        quietRoomRemoved: quiet.removed,
        missing: true,
        removed: false,
      };
    }

    const deletedMessages = await deleteConversationMessages(
      ctx,
      conversationId,
    );
    if (reseed) {
      await insertStarter(ctx, conversationId);
    } else {
      await ctx.db.patch(row._id, { updatedAt: new Date().toISOString() });
    }

    return {
      conversationId,
      deletedMessages,
      reseeded: reseed,
      quietRoomRemoved: quiet.removed,
      missing: false,
      removed: false,
    };
  },
});

export const touchBot = mutation({
  args: { botId: v.union(v.literal("vishnu"), v.literal("friend")) },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("bots")
      .withIndex("by_botId", (q) => q.eq("botId", args.botId))
      .unique();
    const lastSeenAt = new Date().toISOString();
    if (!row) return { botId: args.botId, lastSeenAt, stored: false };
    await ctx.db.patch(row._id, { lastSeenAt });
    return { botId: args.botId, lastSeenAt, stored: true };
  },
});

export const listBotPresence = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const rows = await ctx.db.query("bots").collect();
    const byId = new Map(rows.map((row) => [row.botId, row]));
    const bots = (["vishnu", "friend"] as const).map((id) => {
      const lastSeenAt = byId.get(id)?.lastSeenAt ?? null;
      const seenAt = lastSeenAt ? Date.parse(lastSeenAt) : Number.NaN;
      const connected =
        Number.isFinite(seenAt) && now - seenAt <= BOT_PRESENCE_WINDOW_MS;
      return { id, lastSeenAt, connected };
    });
    return { windowMs: BOT_PRESENCE_WINDOW_MS, bots };
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
