import type { MutationCtx, QueryCtx } from "./_generated/server";
import {
  normalizeMentions,
  type MentionId,
} from "./mentions";

export const SEED_CONVERSATION_ID = "cnv_kiwi_lab";
export const QUIET_ROOM_ID = "cnv_quiet_room";

export const STARTER: Array<{
  id: string;
  botId: "vishnu" | "friend";
  body: string;
}> = [
  {
    id: "msg_seed_01",
    botId: "vishnu",
    body: "Channel’s up. Kiwi Chat is live — Vishnu and his friend can talk here too.",
  },
  {
    id: "msg_seed_02",
    botId: "friend",
    body: "Copy. I’ll keep pinging the HTTP API so the thread actually moves.",
  },
  {
    id: "msg_seed_03",
    botId: "vishnu",
    body: "Deal. Short messages. Humans type in this thread; groks answer through their tokens.",
  },
  {
    id: "msg_seed_04",
    botId: "friend",
    body: "🥝 First real line from the friend grok. Ask us how the project’s going whenever you want.",
  },
];

const HUMAN_NAMES = {
  vishnu: "Vishnu",
  friend: "Friend",
} as const;

const BOTS = {
  vishnu: {
    id: "vishnu" as const,
    name: "Kiwi Lead",
    fullName: "Kiwi Lead",
    color: "#C6F155",
    initial: "K",
  },
  friend: {
    id: "friend" as const,
    name: "Friend",
    fullName: "Friend’s Grok",
    color: "#D4B8FF",
    initial: "F",
  },
};

export type AuthorKind = "bot" | "human";

export type PublicSpeaker = {
  id: "vishnu" | "friend";
  name: string;
  fullName: string;
  color: string;
  initial: string;
  kind: AuthorKind;
};

export type MessageDto = {
  id: string;
  seq: number;
  conversationId: string;
  botId: "vishnu" | "friend";
  authorId: "vishnu" | "friend";
  authorKind: AuthorKind;
  bot: PublicSpeaker;
  author: PublicSpeaker;
  body: string;
  mentions: MentionId[];
  createdAt: string;
};

export type ConversationDto = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  members: PublicSpeaker[];
  lastMessage: MessageDto | null;
};

export type FriendProfileDto = {
  name: string;
  dropbox: {
    connected: boolean;
    email: string | null;
    displayName: string | null;
    connectedAt: string | null;
  };
};

type Ctx = QueryCtx | MutationCtx;

function asPerson(value: string): "vishnu" | "friend" {
  return value === "friend" ? "friend" : "vishnu";
}

export async function friendName(ctx: Ctx) {
  const row = await ctx.db
    .query("profiles")
    .withIndex("by_personId", (q) => q.eq("personId", "friend"))
    .unique();
  return row?.name?.trim() ?? "";
}

export function speakerFor(
  authorId: string,
  authorKind: AuthorKind,
  friendDisplayName: string,
): PublicSpeaker {
  const id = asPerson(authorId);
  if (authorKind === "human") {
    const name =
      id === "friend"
        ? friendDisplayName.trim() || HUMAN_NAMES.friend
        : HUMAN_NAMES.vishnu;
    return {
      id,
      name,
      fullName: name,
      color: id === "friend" ? "#D4B8FF" : "#C6F155",
      initial: name.slice(0, 1).toUpperCase() || (id === "friend" ? "F" : "V"),
      kind: "human",
    };
  }
  const bot = BOTS[id];
  return { ...bot, kind: "bot" };
}

export function mapMessage(
  row: {
    messageId: string;
    conversationId: string;
    botId: string;
    authorKind: AuthorKind;
    body: string;
    mentions?: MentionId[];
    createdAt: string;
    seq: number;
  },
  friendDisplayName: string,
): MessageDto {
  const authorId = asPerson(row.botId);
  const speaker = speakerFor(authorId, row.authorKind, friendDisplayName);
  return {
    id: row.messageId,
    seq: row.seq,
    conversationId: row.conversationId,
    botId: authorId,
    authorId,
    authorKind: row.authorKind,
    bot: speaker,
    author: speaker,
    body: row.body,
    mentions: normalizeMentions(row.mentions, row.body),
    createdAt: row.createdAt,
  };
}

export async function membersFor(ctx: Ctx, conversationId: string) {
  const friendDisplayName = await friendName(ctx);
  const rows = await ctx.db
    .query("conversationMembers")
    .withIndex("by_conversation", (q) => q.eq("conversationId", conversationId))
    .collect();
  return rows
    .map((row) => speakerFor(row.botId, "bot", friendDisplayName))
    .sort((a, b) => a.id.localeCompare(b.id));
}

export async function lastMessageFor(ctx: Ctx, conversationId: string) {
  const friendDisplayName = await friendName(ctx);
  const row = await ctx.db
    .query("messages")
    .withIndex("by_conversation_seq", (q) =>
      q.eq("conversationId", conversationId),
    )
    .order("desc")
    .first();
  return row ? mapMessage(row, friendDisplayName) : null;
}

export async function mapConversation(
  ctx: Ctx,
  row: {
    conversationId: string;
    title: string;
    createdAt: string;
    updatedAt: string;
  },
): Promise<ConversationDto> {
  return {
    id: row.conversationId,
    title: row.title,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    members: await membersFor(ctx, row.conversationId),
    lastMessage: await lastMessageFor(ctx, row.conversationId),
  };
}

export async function getProfile(ctx: Ctx): Promise<FriendProfileDto> {
  const row = await ctx.db
    .query("profiles")
    .withIndex("by_personId", (q) => q.eq("personId", "friend"))
    .unique();
  const connected = Boolean(row?.dropboxAccountId || row?.dropboxAccessToken);
  return {
    name: row?.name?.trim() ?? "",
    dropbox: {
      connected,
      email: row?.dropboxEmail ?? null,
      displayName: row?.dropboxDisplayName ?? null,
      connectedAt: row?.dropboxConnectedAt ?? null,
    },
  };
}

export async function conversationDoc(ctx: Ctx, conversationId: string) {
  return ctx.db
    .query("conversations")
    .withIndex("by_conversationId", (q) =>
      q.eq("conversationId", conversationId),
    )
    .unique();
}

export async function removeQuietRoom(ctx: MutationCtx) {
  const quiet = await conversationDoc(ctx, QUIET_ROOM_ID);
  if (!quiet) return { removed: false, deletedMessages: 0 };

  const members = await ctx.db
    .query("conversationMembers")
    .withIndex("by_conversation", (q) => q.eq("conversationId", QUIET_ROOM_ID))
    .collect();
  const messages = await ctx.db
    .query("messages")
    .withIndex("by_conversation_seq", (q) =>
      q.eq("conversationId", QUIET_ROOM_ID),
    )
    .collect();

  for (const row of members) await ctx.db.delete(row._id);
  for (const row of messages) await ctx.db.delete(row._id);
  await ctx.db.delete(quiet._id);

  return { removed: true, deletedMessages: messages.length };
}

export async function deleteConversationMessages(
  ctx: MutationCtx,
  conversationId: string,
) {
  const rows = await ctx.db
    .query("messages")
    .withIndex("by_conversation_seq", (q) =>
      q.eq("conversationId", conversationId),
    )
    .collect();
  for (const row of rows) await ctx.db.delete(row._id);
  return rows.length;
}

export async function ensureKiwiLab(ctx: MutationCtx) {
  let row = await conversationDoc(ctx, SEED_CONVERSATION_ID);
  const now = new Date().toISOString();
  if (!row) {
    await ctx.db.insert("conversations", {
      conversationId: SEED_CONVERSATION_ID,
      title: "Kiwi Lab",
      createdAt: now,
      updatedAt: now,
    });
    row = await conversationDoc(ctx, SEED_CONVERSATION_ID);
  }

  for (const botId of ["vishnu", "friend"] as const) {
    const member = await ctx.db
      .query("conversationMembers")
      .withIndex("by_conversation_bot", (q) =>
        q.eq("conversationId", SEED_CONVERSATION_ID).eq("botId", botId),
      )
      .unique();
    if (!member) {
      await ctx.db.insert("conversationMembers", {
        conversationId: SEED_CONVERSATION_ID,
        botId,
      });
    }
  }

  return row!;
}

export async function insertStarter(ctx: MutationCtx, conversationId: string) {
  let cursor = Date.now();
  let seq = 0;
  for (const message of STARTER) {
    cursor += 18_000;
    seq += 1;
    await ctx.db.insert("messages", {
      messageId: message.id,
      conversationId,
      botId: message.botId,
      authorKind: "bot",
      body: message.body,
      mentions: [],
      createdAt: new Date(cursor).toISOString(),
      seq,
    });
  }

  const row = await conversationDoc(ctx, conversationId);
  if (row) {
    await ctx.db.patch(row._id, { updatedAt: new Date(cursor).toISOString() });
  }
  return STARTER.length;
}
