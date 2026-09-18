import { getBot, isBotId } from "./auth";
import {
  BOT_LIST,
  HUMANS,
  SEED_CONVERSATION_ID,
  isDropboxConfigured,
  publicBot,
  shouldShowTokensInUi,
  type AuthorKind,
  type PersonId,
} from "./config";
import { getDb } from "./db";
import { createId, nowIso } from "./ids";
import { humanDisplayName } from "./session";
import type {
  BootstrapPayload,
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

function asAuthorKind(value: string | null | undefined): AuthorKind {
  return value === "human" ? "human" : "bot";
}

function speakerFor(authorId: string, authorKind: AuthorKind): PublicSpeaker {
  const id = isBotId(authorId) ? authorId : "vishnu";
  if (authorKind === "human") {
    const name =
      id === "friend"
        ? humanDisplayName("friend", getFriendProfile().name)
        : HUMANS.vishnu.name;
    const color = id === "friend" ? "#D4B8FF" : "#C6F155";
    return {
      id,
      name,
      fullName: name,
      color,
      initial: name.slice(0, 1).toUpperCase() || (id === "friend" ? "F" : "V"),
      kind: "human",
    };
  }

  if (!isBotId(authorId)) {
    return {
      id: "vishnu",
      name: authorId,
      fullName: authorId,
      color: "#9CA3AF",
      initial: authorId.slice(0, 1).toUpperCase(),
      kind: "bot",
    };
  }

  return publicBot(getBot(id));
}

function mapMessage(row: MessageRow): Message {
  const authorKind = asAuthorKind(row.author_kind);
  const authorId = isBotId(row.bot_id) ? row.bot_id : "vishnu";
  const speaker = speakerFor(authorId, authorKind);
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
    createdAt: row.created_at,
  };
}

function membersFor(conversationId: string): PublicSpeaker[] {
  const db = getDb();
  const rows = db
    .prepare(
      "SELECT bot_id FROM conversation_members WHERE conversation_id = ? ORDER BY bot_id",
    )
    .all(conversationId) as MemberRow[];
  return rows.map((row) => speakerFor(row.bot_id, "bot"));
}

function lastMessageFor(conversationId: string): Message | null {
  const db = getDb();
  const row = db
    .prepare(
      "SELECT seq, id, conversation_id, bot_id, author_kind, body, created_at FROM messages WHERE conversation_id = ? ORDER BY seq DESC LIMIT 1",
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

export function getFriendProfile(): FriendProfilePublic {
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

export function saveFriendName(name: string) {
  const db = getDb();
  const trimmed = name.trim().slice(0, 40);
  db.prepare(
    "UPDATE friend_profiles SET name = ?, updated_at = ? WHERE id = 'friend'",
  ).run(trimmed, nowIso());
  return getFriendProfile();
}

export function saveFriendDropbox(input: {
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

export function clearFriendDropbox() {
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
        `SELECT seq, id, conversation_id, bot_id, author_kind, body, created_at
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
        `SELECT seq, id, conversation_id, bot_id, author_kind, body, created_at
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
      `SELECT seq, id, conversation_id, bot_id, author_kind, body, created_at
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
  authorId: PersonId;
  authorKind: AuthorKind;
  body: string;
}) {
  const db = getDb();
  const id = createId("msg");
  const createdAt = nowIso();
  db.prepare(
    "INSERT INTO messages (id, conversation_id, bot_id, author_kind, body, created_at) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(
    id,
    input.conversationId,
    input.authorId,
    input.authorKind,
    input.body,
    createdAt,
  );
  db.prepare(
    "UPDATE conversations SET updated_at = ? WHERE id = ?",
  ).run(createdAt, input.conversationId);

  const row = db
    .prepare(
      "SELECT seq, id, conversation_id, bot_id, author_kind, body, created_at FROM messages WHERE id = ?",
    )
    .get(id) as MessageRow;
  return mapMessage(row);
}

export function getBootstrap(viewerId: PersonId): BootstrapPayload {
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
  const friendProfile = getFriendProfile();
  const showTokens = shouldShowTokensInUi() && viewerId === "vishnu";

  return {
    conversations,
    messages,
    activeConversationId,
    bots: BOT_LIST.map(publicBot),
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
