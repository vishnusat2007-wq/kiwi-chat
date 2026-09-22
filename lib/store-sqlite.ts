import { getBot } from "./auth";
import {
  BOT_LIST,
  BOT_PRESENCE_WINDOW_MS,
  HUMANS,
  SEED_CONVERSATION_ID,
  botIsConnected,
  isDropboxConfigured,
  publicBot,
  shouldShowTokensInUi,
  type AuthorKind,
  type PersonId,
} from "./config";
import { getDb, removeQuietRoom } from "./db";
import { createId, nowIso } from "./ids";
import { normalizeMentions, parseMentions } from "./mentions";
import { QUIET_ROOM_ID, SEED_MESSAGES, SEED_TITLE } from "./seed";
import { humanDisplayName } from "./session";
import { asAuthorKind, speakerFor } from "./speakers";
import type {
  BootstrapPayload,
  BotPresenceSnapshot,
  ClearConversationResult,
  Conversation,
  FriendProfilePublic,
  Message,
  PublicSpeaker,
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
  author_kind?: string | null;
  body: string;
  mentions?: string | null;
  created_at: string;
};

type MemberRow = {
  bot_id: string;
};

type FriendProfileRow = {
  id: string;
  name: string;
  dropbox_account_id: string | null;
  dropbox_email: string | null;
  dropbox_display_name: string | null;
  dropbox_access_token: string | null;
  dropbox_refresh_token: string | null;
  dropbox_connected_at: string | null;
  updated_at: string;
};

function parseStoredMentions(raw: string | null | undefined, body: string) {
  if (!raw) return normalizeMentions(undefined, body);
  try {
    return normalizeMentions(JSON.parse(raw) as unknown, body);
  } catch {
    return normalizeMentions(undefined, body);
  }
}

function mapMessage(row: MessageRow, friendName: string): Message {
  const authorKind = asAuthorKind(row.author_kind);
  const authorId = row.bot_id === "friend" ? "friend" : "vishnu";
  const speaker = speakerFor(authorId, authorKind, friendName);
  return {
    id: row.id,
    seq: row.seq,
    conversationId: row.conversation_id,
    botId: authorId,
    authorId,
    authorKind,
    bot: speaker,
    author: speaker,
    body: row.body,
    mentions: parseStoredMentions(row.mentions, row.body),
    createdAt: row.created_at,
  };
}

function membersFor(conversationId: string, friendName: string): PublicSpeaker[] {
  const db = getDb();
  const rows = db
    .prepare(
      "SELECT bot_id FROM conversation_members WHERE conversation_id = ? ORDER BY bot_id",
    )
    .all(conversationId) as MemberRow[];
  return rows.map((row) => speakerFor(row.bot_id, "bot", friendName));
}

function lastMessageFor(conversationId: string, friendName: string): Message | null {
  const db = getDb();
  const row = db
    .prepare(
      "SELECT seq, id, conversation_id, bot_id, author_kind, body, mentions, created_at FROM messages WHERE conversation_id = ? ORDER BY seq DESC LIMIT 1",
    )
    .get(conversationId) as MessageRow | undefined;
  return row ? mapMessage(row, friendName) : null;
}

function mapConversation(row: ConversationRow, friendName: string): Conversation {
  return {
    id: row.id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    members: membersFor(row.id, friendName),
    lastMessage: lastMessageFor(row.id, friendName),
  };
}

export async function getFriendProfile(): Promise<FriendProfilePublic> {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT id, name, dropbox_account_id, dropbox_email, dropbox_display_name,
              dropbox_access_token, dropbox_refresh_token, dropbox_connected_at, updated_at
       FROM friend_profiles WHERE id = 'friend'`,
    )
    .get() as FriendProfileRow | undefined;

  const connected = Boolean(row?.dropbox_account_id || row?.dropbox_access_token);
  return {
    name: row?.name?.trim() ?? "",
    dropbox: {
      connected,
      email: row?.dropbox_email ?? null,
      displayName: row?.dropbox_display_name ?? null,
      connectedAt: row?.dropbox_connected_at ?? null,
    },
  };
}

export async function saveFriendName(name: string) {
  const db = getDb();
  const trimmed = name.trim().slice(0, 40);
  db.prepare(
    "UPDATE friend_profiles SET name = ?, updated_at = ? WHERE id = 'friend'",
  ).run(trimmed, nowIso());
  return getFriendProfile();
}

export async function saveFriendDropbox(input: {
  accountId: string;
  email: string;
  displayName: string;
  accessToken: string;
  refreshToken: string;
}) {
  const db = getDb();
  db.prepare(
    `UPDATE friend_profiles
     SET dropbox_account_id = ?, dropbox_email = ?, dropbox_display_name = ?,
         dropbox_access_token = ?, dropbox_refresh_token = ?, dropbox_connected_at = ?,
         updated_at = ?
     WHERE id = 'friend'`,
  ).run(
    input.accountId,
    input.email,
    input.displayName,
    input.accessToken,
    input.refreshToken,
    nowIso(),
    nowIso(),
  );
  return getFriendProfile();
}

export async function clearFriendDropbox() {
  const db = getDb();
  db.prepare(
    `UPDATE friend_profiles
     SET dropbox_account_id = NULL, dropbox_email = NULL, dropbox_display_name = NULL,
         dropbox_access_token = NULL, dropbox_refresh_token = NULL, dropbox_connected_at = NULL,
         updated_at = ?
     WHERE id = 'friend'`,
  ).run(nowIso());
  return getFriendProfile();
}

export async function listConversations(): Promise<Conversation[]> {
  const db = getDb();
  const friendName = (await getFriendProfile()).name;
  const rows = db
    .prepare(
      "SELECT id, title, created_at, updated_at FROM conversations ORDER BY updated_at DESC, id ASC",
    )
    .all() as ConversationRow[];
  return rows.map((row) => mapConversation(row, friendName));
}

export async function getConversation(id: string): Promise<Conversation | null> {
  const db = getDb();
  const friendName = (await getFriendProfile()).name;
  const row = db
    .prepare(
      "SELECT id, title, created_at, updated_at FROM conversations WHERE id = ?",
    )
    .get(id) as ConversationRow | undefined;
  return row ? mapConversation(row, friendName) : null;
}

export async function conversationHasMember(
  conversationId: string,
  botId: string,
) {
  const db = getDb();
  const row = db
    .prepare(
      "SELECT 1 AS ok FROM conversation_members WHERE conversation_id = ? AND bot_id = ?",
    )
    .get(conversationId, botId) as { ok: number } | undefined;
  return Boolean(row);
}

export async function createConversation(input: {
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

  return (await getConversation(id))!;
}

export async function listMessages(input: {
  conversationId: string;
  after?: string | number | null;
  limit?: number;
}): Promise<Message[]> {
  const db = getDb();
  const friendName = (await getFriendProfile()).name;
  const limit = Math.min(Math.max(input.limit ?? 200, 1), 500);
  const after = input.after;

  if (after === undefined || after === null || after === "") {
    const rows = db
      .prepare(
        `SELECT seq, id, conversation_id, bot_id, author_kind, body, mentions, created_at
         FROM messages
         WHERE conversation_id = ?
         ORDER BY seq ASC
         LIMIT ?`,
      )
      .all(input.conversationId, limit) as MessageRow[];
    return rows.map((row) => mapMessage(row, friendName));
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
        `SELECT seq, id, conversation_id, bot_id, author_kind, body, mentions, created_at
         FROM messages
         WHERE conversation_id = ? AND created_at > ?
         ORDER BY seq ASC
         LIMIT ?`,
      )
      .all(input.conversationId, afterText, limit) as MessageRow[];
    return byTime.map((row) => mapMessage(row, friendName));
  }

  const rows = db
    .prepare(
      `SELECT seq, id, conversation_id, bot_id, author_kind, body, mentions, created_at
       FROM messages
       WHERE conversation_id = ? AND seq > ?
       ORDER BY seq ASC
       LIMIT ?`,
    )
    .all(input.conversationId, minSeq, limit) as MessageRow[];
  return rows.map((row) => mapMessage(row, friendName));
}

export async function lastSeq(conversationId: string) {
  const db = getDb();
  const row = db
    .prepare("SELECT MAX(seq) AS seq FROM messages WHERE conversation_id = ?")
    .get(conversationId) as { seq: number | null } | undefined;
  return row?.seq ?? 0;
}

export async function createMessage(input: {
  conversationId: string;
  authorId: PersonId;
  authorKind: AuthorKind;
  body: string;
}) {
  const db = getDb();
  const id = createId("msg");
  const createdAt = nowIso();
  const mentions = parseMentions(input.body);
  db.prepare(
    "INSERT INTO messages (id, conversation_id, bot_id, author_kind, body, mentions, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
  ).run(
    id,
    input.conversationId,
    input.authorId,
    input.authorKind,
    input.body,
    JSON.stringify(mentions),
    createdAt,
  );
  db.prepare("UPDATE conversations SET updated_at = ? WHERE id = ?").run(
    createdAt,
    input.conversationId,
  );

  const friendName = (await getFriendProfile()).name;
  const row = db
    .prepare(
      "SELECT seq, id, conversation_id, bot_id, author_kind, body, mentions, created_at FROM messages WHERE id = ?",
    )
    .get(id) as MessageRow;
  return mapMessage(row, friendName);
}

export async function touchBot(botId: PersonId) {
  const db = getDb();
  const lastSeenAt = nowIso();
  db.prepare("UPDATE bots SET last_seen_at = ? WHERE id = ?").run(
    lastSeenAt,
    botId,
  );
  return { botId, lastSeenAt, stored: true };
}

export async function listBotPresence(): Promise<BotPresenceSnapshot> {
  const db = getDb();
  const rows = db
    .prepare("SELECT id, last_seen_at FROM bots")
    .all() as Array<{ id: string; last_seen_at: string | null }>;
  const byId = new Map(rows.map((row) => [row.id, row.last_seen_at]));
  const now = Date.now();
  return {
    windowMs: BOT_PRESENCE_WINDOW_MS,
    bots: (["vishnu", "friend"] as const).map((id) => {
      const lastSeenAt = byId.get(id) ?? null;
      return { id, lastSeenAt, connected: botIsConnected(lastSeenAt, now) };
    }),
  };
}

function ensureSqliteLab(db: ReturnType<typeof getDb>) {
  const existing = db
    .prepare("SELECT id FROM conversations WHERE id = ?")
    .get(SEED_CONVERSATION_ID) as { id: string } | undefined;
  if (!existing) {
    const createdAt = nowIso();
    db.prepare(
      "INSERT INTO conversations (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)",
    ).run(SEED_CONVERSATION_ID, SEED_TITLE, createdAt, createdAt);
  }
  const insertMember = db.prepare(
    "INSERT OR IGNORE INTO conversation_members (conversation_id, bot_id) VALUES (?, ?)",
  );
  insertMember.run(SEED_CONVERSATION_ID, "vishnu");
  insertMember.run(SEED_CONVERSATION_ID, "friend");
}

function insertSqliteStarter(db: ReturnType<typeof getDb>) {
  const insertMessage = db.prepare(
    "INSERT INTO messages (id, conversation_id, bot_id, author_kind, body, mentions, created_at) VALUES (?, ?, ?, 'bot', ?, '[]', ?)",
  );
  let cursor = Date.now();
  for (const message of SEED_MESSAGES) {
    cursor += 18_000;
    insertMessage.run(
      message.id,
      SEED_CONVERSATION_ID,
      message.botId,
      message.body,
      new Date(cursor).toISOString(),
    );
  }
  db.prepare("UPDATE conversations SET updated_at = ? WHERE id = ?").run(
    new Date(cursor).toISOString(),
    SEED_CONVERSATION_ID,
  );
}

export async function clearConversation(input: {
  conversationId?: string;
  reseed?: boolean;
}): Promise<ClearConversationResult> {
  const db = getDb();
  const quiet = removeQuietRoom(db);
  const conversationId = input.conversationId?.trim() || SEED_CONVERSATION_ID;

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

  const reseed = input.reseed !== false && conversationId === SEED_CONVERSATION_ID;
  const existing = db
    .prepare("SELECT id FROM conversations WHERE id = ?")
    .get(conversationId) as { id: string } | undefined;

  if (!existing && conversationId === SEED_CONVERSATION_ID) {
    ensureSqliteLab(db);
  } else if (!existing) {
    return {
      conversationId,
      deletedMessages: 0,
      reseeded: false,
      quietRoomRemoved: quiet.removed,
      missing: true,
      removed: false,
    };
  }

  const deleted = db
    .prepare("DELETE FROM messages WHERE conversation_id = ?")
    .run(conversationId) as { changes?: number };
  if (reseed) {
    insertSqliteStarter(db);
  } else {
    db.prepare("UPDATE conversations SET updated_at = ? WHERE id = ?").run(
      nowIso(),
      conversationId,
    );
  }

  return {
    conversationId,
    deletedMessages: deleted.changes ?? 0,
    reseeded: reseed,
    quietRoomRemoved: quiet.removed,
    missing: false,
    removed: false,
  };
}

export async function getBootstrap(viewerId: PersonId): Promise<BootstrapPayload> {
  const conversations = await listConversations();
  const preferred =
    conversations.find(
      (conversation) =>
        conversation.id === SEED_CONVERSATION_ID && conversation.lastMessage,
    ) ??
    conversations.find((conversation) => conversation.lastMessage) ??
    conversations[0] ??
    null;
  const activeConversationId = preferred?.id ?? null;
  const [messages, friendProfile, presence] = await Promise.all([
    activeConversationId
      ? listMessages({ conversationId: activeConversationId })
      : Promise.resolve([]),
    getFriendProfile(),
    listBotPresence(),
  ]);
  const showTokens = shouldShowTokensInUi() && viewerId === "vishnu";

  return {
    conversations,
    messages,
    activeConversationId,
    seedConversationId: SEED_CONVERSATION_ID,
    bots: BOT_LIST.map(publicBot),
    botPresence: presence.bots,
    viewer: {
      id: viewerId,
      name: humanDisplayName(viewerId, friendProfile.name),
      username: HUMANS[viewerId].username,
    },
    friendProfile,
    dropboxConfigured: isDropboxConfigured(),
    tokens: showTokens
      ? {
          vishnu: getBot("vishnu").token,
          friend: getBot("friend").token,
        }
      : null,
    health: { ok: true },
  };
}

export async function ensureSeed() {
  const db = getDb();
  removeQuietRoom(db);
}
