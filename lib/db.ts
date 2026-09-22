import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { BOTS, isEphemeralPersistence, SEED_CONVERSATION_ID } from "./config";
import { nowIso } from "./ids";
import { QUIET_ROOM_ID, SEED_MESSAGES, SEED_TITLE } from "./seed";
import type { PersistenceInfo } from "./types";

type GlobalDb = typeof globalThis & {
  __kiwiDb?: DatabaseSync;
  __kiwiSeedPrinted?: boolean;
};

type ColumnRow = { name: string };

function resolveDbPath() {
  if (process.env.KIWI_DB_PATH) return process.env.KIWI_DB_PATH;
  if (process.env.VERCEL) return "/tmp/kiwi-chat.db";
  return path.join(process.cwd(), "data", "kiwi.db");
}

export function getPersistenceInfo(): PersistenceInfo {
  const location = resolveDbPath();
  return {
    ephemeral: isEphemeralPersistence(),
    location,
    driver: "node:sqlite",
  };
}

function ensureColumn(
  db: DatabaseSync,
  table: string,
  column: string,
  definition: string,
) {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as ColumnRow[];
  if (rows.some((row) => row.name === column)) return;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

function migrate(db: DatabaseSync) {
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS conversation_members (
      conversation_id TEXT NOT NULL,
      bot_id TEXT NOT NULL,
      PRIMARY KEY (conversation_id, bot_id),
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS messages (
      seq INTEGER PRIMARY KEY AUTOINCREMENT,
      id TEXT NOT NULL UNIQUE,
      conversation_id TEXT NOT NULL,
      bot_id TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_messages_conversation_seq
      ON messages (conversation_id, seq);

    CREATE TABLE IF NOT EXISTS friend_profiles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL DEFAULT '',
      dropbox_account_id TEXT,
      dropbox_email TEXT,
      dropbox_display_name TEXT,
      dropbox_access_token TEXT,
      dropbox_refresh_token TEXT,
      dropbox_connected_at TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS humans (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      display_name TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS bots (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      full_name TEXT NOT NULL,
      color TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  ensureColumn(db, "messages", "author_kind", "TEXT NOT NULL DEFAULT 'bot'");
  ensureColumn(db, "messages", "mentions", "TEXT NOT NULL DEFAULT '[]'");

  ensureColumn(db, "bots", "last_seen_at", "TEXT");
  removeQuietRoom(db);

  const createdAt = nowIso();
  db.prepare(
    "INSERT OR IGNORE INTO humans (id, username, display_name, created_at) VALUES ('vishnu', 'vishnu', 'Vishnu', ?)",
  ).run(createdAt);
  db.prepare(
    "INSERT OR IGNORE INTO humans (id, username, display_name, created_at) VALUES ('friend', 'friend', 'Friend', ?)",
  ).run(createdAt);
  db.prepare(
    "INSERT OR IGNORE INTO bots (id, name, full_name, color, created_at) VALUES ('vishnu', 'Vishnu', 'Vishnu’s Grok', '#C6F155', ?)",
  ).run(createdAt);
  db.prepare(
    "INSERT OR IGNORE INTO bots (id, name, full_name, color, created_at) VALUES ('friend', 'Friend', 'Friend’s Grok', '#D4B8FF', ?)",
  ).run(createdAt);

  db.prepare(
    "INSERT OR IGNORE INTO friend_profiles (id, name, updated_at) VALUES ('friend', '', ?)",
  ).run(nowIso());
}

function seedIfEmpty(db: DatabaseSync) {
  const row = db.prepare("SELECT COUNT(*) AS count FROM conversations").get() as
    | { count: number }
    | undefined;
  if (row && row.count > 0) return false;

  const createdAt = nowIso();
  const insertConversation = db.prepare(
    "INSERT INTO conversations (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)",
  );
  const insertMember = db.prepare(
    "INSERT INTO conversation_members (conversation_id, bot_id) VALUES (?, ?)",
  );
  const insertMessage = db.prepare(
    "INSERT INTO messages (id, conversation_id, bot_id, author_kind, body, mentions, created_at) VALUES (?, ?, ?, 'bot', ?, '[]', ?)",
  );

  insertConversation.run(
    SEED_CONVERSATION_ID,
    SEED_TITLE,
    createdAt,
    createdAt,
  );
  insertMember.run(SEED_CONVERSATION_ID, "vishnu");
  insertMember.run(SEED_CONVERSATION_ID, "friend");

  let cursor = Date.parse(createdAt);
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

  db.prepare(
    "UPDATE conversations SET updated_at = ? WHERE id = ?",
  ).run(new Date(cursor).toISOString(), SEED_CONVERSATION_ID);

  return true;
}

export function printTokenBanner(freshSeed: boolean) {
  const persistence = getPersistenceInfo();
  const lines = [
    "",
    "  🥝  Kiwi Chat ready",
    "  ─────────────────────────────────────────────",
    `  Database   ${persistence.location}`,
    "  People     vishnu  ·  friend  (env logins, no public signup)",
    "  Bots       vishnu  ·  friend",
    "",
    "  Vishnu’s Grok token",
    `    ${BOTS.vishnu.token}`,
    "",
    "  Friend’s Grok token",
    `    ${BOTS.friend.token}`,
    "",
    "  Copy bot tokens into your grok agents. Rotate with BOT_TOKEN_VISHNU / BOT_TOKEN_FRIEND.",
    "  Human logins: LOGIN_VISHNU / PASSWORD_VISHNU and LOGIN_FRIEND / PASSWORD_FRIEND.",
    freshSeed
      ? "  Seeded default thread: Kiwi Lab (vishnu ↔ friend)."
      : "  Existing database reused.",
    "",
  ];
  console.log(lines.join("\n"));
}

export function removeQuietRoom(db: DatabaseSync) {
  const existing = db
    .prepare("SELECT id FROM conversations WHERE id = ?")
    .get(QUIET_ROOM_ID) as { id: string } | undefined;
  const counted = db
    .prepare("SELECT COUNT(*) AS count FROM messages WHERE conversation_id = ?")
    .get(QUIET_ROOM_ID) as { count: number };
  db.prepare("DELETE FROM messages WHERE conversation_id = ?").run(QUIET_ROOM_ID);
  db.prepare("DELETE FROM conversation_members WHERE conversation_id = ?").run(
    QUIET_ROOM_ID,
  );
  db.prepare("DELETE FROM conversations WHERE id = ?").run(QUIET_ROOM_ID);
  return {
    removed: Boolean(existing),
    deletedMessages: counted.count,
  };
}

export function getDb() {
  const globalDb = globalThis as GlobalDb;
  if (!globalDb.__kiwiDb) {
    const dbPath = resolveDbPath();
    mkdirSync(path.dirname(dbPath), { recursive: true });
    const db = new DatabaseSync(dbPath, {
      enableForeignKeyConstraints: true,
    });
    migrate(db);
    const fresh = seedIfEmpty(db);
    if (!globalDb.__kiwiSeedPrinted) {
      printTokenBanner(fresh);
      globalDb.__kiwiSeedPrinted = true;
    }
    globalDb.__kiwiDb = db;
  }
  return globalDb.__kiwiDb;
}
