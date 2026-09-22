export type PersonId = "vishnu" | "friend";
export type BotId = PersonId;
export type AuthorKind = "bot" | "human";

export type BotProfile = {
  id: BotId;
  name: string;
  fullName: string;
  token: string;
  color: string;
  glow: string;
  initial: string;
};

export type HumanLogin = {
  id: PersonId;
  username: string;
  password: string;
  name: string;
};

const DEFAULT_VISHNU_TOKEN = "kiwi_vishnu_k9m2XqP4wR7nT1bH8sL3";
const DEFAULT_FRIEND_TOKEN = "kiwi_friend_p5Yc8Nm2qK4wJ9tR6vA1";

export const DEFAULT_TOKENS = {
  vishnu: DEFAULT_VISHNU_TOKEN,
  friend: DEFAULT_FRIEND_TOKEN,
} as const;

export const DEFAULT_LOGINS = {
  vishnu: { username: "vishnu", password: "kiwi_vishnu_login" },
  friend: { username: "friend", password: "kiwi_friend_login" },
} as const;

export const BOTS: Record<BotId, BotProfile> = {
  vishnu: {
    id: "vishnu",
    name: "Vishnu",
    fullName: "Vishnu’s Grok",
    token: process.env.BOT_TOKEN_VISHNU?.trim() || DEFAULT_VISHNU_TOKEN,
    color: "#C6F155",
    glow: "rgba(198, 241, 85, 0.45)",
    initial: "V",
  },
  friend: {
    id: "friend",
    name: "Friend",
    fullName: "Friend’s Grok",
    token: process.env.BOT_TOKEN_FRIEND?.trim() || DEFAULT_FRIEND_TOKEN,
    color: "#D4B8FF",
    glow: "rgba(212, 184, 255, 0.4)",
    initial: "F",
  },
};

export const BOT_LIST = Object.values(BOTS);

export const HUMANS: Record<PersonId, HumanLogin> = {
  vishnu: {
    id: "vishnu",
    username: process.env.LOGIN_VISHNU?.trim() || DEFAULT_LOGINS.vishnu.username,
    password:
      process.env.PASSWORD_VISHNU?.trim() || DEFAULT_LOGINS.vishnu.password,
    name: "Vishnu",
  },
  friend: {
    id: "friend",
    username: process.env.LOGIN_FRIEND?.trim() || DEFAULT_LOGINS.friend.username,
    password:
      process.env.PASSWORD_FRIEND?.trim() || DEFAULT_LOGINS.friend.password,
    name: "Friend",
  },
};

export const HUMAN_LIST = Object.values(HUMANS);

export const SEED_CONVERSATION_ID = "cnv_kiwi_lab";

/** A bot stays "connected" when it has polled or posted inside this window. */
export const BOT_PRESENCE_WINDOW_MS = 30_000;

export function botIsConnected(lastSeenAt: string | null, now = Date.now()) {
  if (!lastSeenAt) return false;
  const seen = Date.parse(lastSeenAt);
  if (!Number.isFinite(seen)) return false;
  return now - seen <= BOT_PRESENCE_WINDOW_MS;
}
export const SESSION_COOKIE = "kiwi_session";
export const DROPBOX_STATE_COOKIE = "kiwi_dbx_state";
export const DROPBOX_VERIFIER_COOKIE = "kiwi_dbx_verifier";

export function isVercelRuntime() {
  return Boolean(process.env.VERCEL);
}

/** Dev deployment for project kiwi-chat (team vishnu-satyavarapu). */
export const CONVEX_PROJECT = "kiwi-chat";
export const CONVEX_DEPLOYMENT_NAME = "flippant-swan-205";
export const CONVEX_CLOUD_URL = "https://flippant-swan-205.convex.cloud";
export const CONVEX_DASHBOARD_URL =
  "https://dashboard.convex.dev/t/vishnu-satyavarapu/kiwi-chat/flippant-swan-205";

export function convexDeploymentUrl() {
  if (process.env.KIWI_USE_SQLITE === "1") return "";
  return (
    process.env.NEXT_PUBLIC_CONVEX_URL?.trim() ||
    process.env.CONVEX_URL?.trim() ||
    CONVEX_CLOUD_URL
  );
}

export function isConvexConfigured() {
  return Boolean(convexDeploymentUrl());
}

export function isEphemeralPersistence() {
  if (isConvexConfigured()) return false;
  if (process.env.KIWI_DB_PATH) return false;
  return isVercelRuntime();
}

export function shouldShowTokensInUi() {
  if (process.env.KIWI_SHOW_TOKENS === "0") return false;
  if (process.env.KIWI_SHOW_TOKENS === "1") return true;
  return process.env.VERCEL_ENV !== "production";
}

export function sessionSecret() {
  const explicit = process.env.SESSION_SECRET?.trim();
  if (explicit) return explicit;
  return `kiwi-session:${BOTS.vishnu.token}:${BOTS.friend.token}`;
}

export function dropboxAppKey() {
  return process.env.DROPBOX_APP_KEY?.trim() || "";
}

export function dropboxAppSecret() {
  return process.env.DROPBOX_APP_SECRET?.trim() || "";
}

export function isDropboxConfigured() {
  return Boolean(dropboxAppKey() && dropboxAppSecret());
}

export function publicBot(bot: BotProfile) {
  return {
    id: bot.id,
    name: bot.name,
    fullName: bot.fullName,
    color: bot.color,
    initial: bot.initial,
    kind: "bot" as const,
  };
}
