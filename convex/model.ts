import type { QueryCtx, MutationCtx } from "./_generated/server";

const HUMAN_NAMES = {
  vishnu: "Vishnu",
  friend: "Friend",
} as const;

const BOTS = {
  vishnu: {
    id: "vishnu" as const,
    name: "Vishnu",
    fullName: "Vishnu’s Grok",
    color: "#C6F155",
    initial: "V",
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
