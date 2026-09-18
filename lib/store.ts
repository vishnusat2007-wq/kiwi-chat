import { getBot, isBotId } from "./auth";
import { BOT_LIST, publicBot, SEED_CONVERSATION_ID, shouldShowTokensInUi } from "./config";
import { getDb, getPersistenceInfo } from "./db";
import { createId, nowIso } from "./ids";
import type {
  BootstrapPayload,
  Conversation,
  Message,
  PublicBot,
} from "./types";

type ConversationRow = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

type MessageRow = {
  seq: number;
  id: string;
  conversation_id: string;
  bot_id: string;
  body: string;
  created_at: string;
};

type MemberRow = {
  bot_id: string;
};

function mapBot(botId: string): PublicBot {
  if (!isBotId(botId)) {
    return {
      id: "vishnu",
      name: botId,
      fullName: botId,
      color: "#9CA3AF",
      initial: botId.slice(0, 1).toUpperCase(),
    };
  }
  return publicBot(getBot(botId));
}

function mapMessage(row: MessageRow): Message {
  return {
    id: row.id,
    seq: row.seq,
    conversationId: row.conversation_id,
    botId: isBotId(row.bot_id) ? row.bot_id : "vishnu",
    bot: mapBot(row.bot_id),
    body: row.body,
    createdAt: row.created_at,
  };
}

function membersFor(conversationId: string): PublicBot[] {
  const db = getDb();
  const rows = db
    .prepare(
      "SELECT bot_id FROM conversation_members WHERE conversation_id = ? ORDER BY bot_id",
    )
    .all(conversationId) as MemberRow[];
  return rows.map((row) => mapBot(row.bot_id));
}

function lastMessageFor(conversationId: string): Message | null {
  const db = getDb();
  const row = db
    .prepare(
      "SELECT seq, id, conversation_id, bot_id, body, created_at FROM messages WHERE conversation_id = ? ORDER BY seq DESC LIMIT 1",
    )
    .get(conversationId) as MessageRow | undefined;
  return row ? mapMessage(row) : null;
}

function mapConversation(row: ConversationRow): Conversation {
  return {
    id: row.id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    members: membersFor(row.id),
    lastMessage: lastMessageFor(row.id),
  };
}

export function listConversations(): Conversation[] {
  const db = getDb();
  const rows = db
    .prepare(
      "SELECT id, title, created_at, updated_at FROM conversations ORDER BY updated_at DESC, id ASC",
    )
    .all() as ConversationRow[];
  return rows.map(mapConversation);
}

export function getConversation(id: string): Conversation | null {
  const db = getDb();
  const row = db
    .prepare(
      "SELECT id, title, created_at, updated_at FROM conversations WHERE id = ?",
    )
    .get(id) as ConversationRow | undefined;
  return row ? mapConversation(row) : null;
}

export function conversationHasMember(conversationId: string, botId: string) {
  const db = getDb();
  const row = db
    .prepare(
      "SELECT 1 AS ok FROM conversation_members WHERE conversation_id = ? AND bot_id = ?",
    )
    .get(conversationId, botId) as { ok: number } | undefined;
  return Boolean(row);
}

export function createConversation(input: {
  title?: string;
  memberIds: string[];
}) {
  const db = getDb();
  const id = createId("cnv");
  const createdAt = nowIso();
  const title = (input.title?.trim() || "New thread").slice(0, 80);
  const uniqueMembers = Array.from(new Set(input.memberIds));

  db.prepare(
    "INSERT INTO conversations (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)",
  ).run(id, title, createdAt, createdAt);

  const insertMember = db.prepare(
    "INSERT INTO conversation_members (conversation_id, bot_id) VALUES (?, ?)",
  );
  for (const memberId of uniqueMembers) {
    insertMember.run(id, memberId);
  }

  return getConversation(id)!;
}

export function listMessages(input: {
  conversationId: string;
  after?: string | number | null;
  limit?: number;
}): Message[] {
  const db = getDb();
  const limit = Math.min(Math.max(input.limit ?? 200, 1), 500);
  const after = input.after;

  if (after === undefined || after === null || after === "") {
    const rows = db
      .prepare(
        `SELECT seq, id, conversation_id, bot_id, body, created_at
         FROM messages
         WHERE conversation_id = ?
         ORDER BY seq ASC
         LIMIT ?`,
      )
      .all(input.conversationId, limit) as MessageRow[];
    return rows.map(mapMessage);
  }

  const afterText = String(after);
  const afterAsSeq = Number.parseInt(afterText, 10);
  const byId = db
    .prepare("SELECT seq FROM messages WHERE id = ?")
    .get(afterText) as { seq: number } | undefined;

  let minSeq = -1;
  if (byId) {
    minSeq = byId.seq;
  } else if (Number.isFinite(afterAsSeq) && afterText === String(afterAsSeq)) {
    minSeq = afterAsSeq;
  } else {
    const byTime = db
      .prepare(
        `SELECT seq, id, conversation_id, bot_id, body, created_at
         FROM messages
         WHERE conversation_id = ? AND created_at > ?
         ORDER BY seq ASC
         LIMIT ?`,
      )
      .all(input.conversationId, afterText, limit) as MessageRow[];
    return byTime.map(mapMessage);
  }

  const rows = db
    .prepare(
      `SELECT seq, id, conversation_id, bot_id, body, created_at
       FROM messages
       WHERE conversation_id = ? AND seq > ?
       ORDER BY seq ASC
       LIMIT ?`,
    )
    .all(input.conversationId, minSeq, limit) as MessageRow[];
  return rows.map(mapMessage);
}

export function lastSeq(conversationId: string) {
  const db = getDb();
  const row = db
    .prepare("SELECT MAX(seq) AS seq FROM messages WHERE conversation_id = ?")
    .get(conversationId) as { seq: number | null } | undefined;
  return row?.seq ?? 0;
}

export function createMessage(input: {
  conversationId: string;
  botId: string;
  body: string;
}) {
  const db = getDb();
  const id = createId("msg");
  const createdAt = nowIso();
  db.prepare(
    "INSERT INTO messages (id, conversation_id, bot_id, body, created_at) VALUES (?, ?, ?, ?, ?)",
  ).run(id, input.conversationId, input.botId, input.body, createdAt);
  db.prepare(
    "UPDATE conversations SET updated_at = ? WHERE id = ?",
  ).run(createdAt, input.conversationId);

  const row = db
    .prepare(
      "SELECT seq, id, conversation_id, bot_id, body, created_at FROM messages WHERE id = ?",
    )
    .get(id) as MessageRow;
  return mapMessage(row);
}

export function getBootstrap(): BootstrapPayload {
  const conversations = listConversations();
  const preferred =
    conversations.find(
      (conversation) =>
        conversation.id === SEED_CONVERSATION_ID && conversation.lastMessage,
    ) ??
    conversations.find((conversation) => conversation.lastMessage) ??
    conversations[0] ??
    null;
  const activeConversationId = preferred?.id ?? null;
  const messages = activeConversationId
    ? listMessages({ conversationId: activeConversationId })
    : [];

  return {
    conversations,
    messages,
    activeConversationId,
    bots: BOT_LIST.map(publicBot),
    persistence: getPersistenceInfo(),
    tokens: shouldShowTokensInUi()
      ? {
          vishnu: getBot("vishnu").token,
          friend: getBot("friend").token,
        }
      : null,
    health: { ok: true },
  };
}
