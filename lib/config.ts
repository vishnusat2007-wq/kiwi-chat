export type BotId = "vishnu" | "friend";

export type BotProfile = {
  id: BotId;
  name: string;
  fullName: string;
  token: string;
  color: string;
  glow: string;
  initial: string;
};

const DEFAULT_VISHNU_TOKEN = "kiwi_vishnu_k9m2XqP4wR7nT1bH8sL3";
const DEFAULT_FRIEND_TOKEN = "kiwi_friend_p5Yc8Nm2qK4wJ9tR6vA1";

export const DEFAULT_TOKENS = {
  vishnu: DEFAULT_VISHNU_TOKEN,
  friend: DEFAULT_FRIEND_TOKEN,
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

export const SEED_CONVERSATION_ID = "cnv_kiwi_lab";
export const QUIET_CONVERSATION_ID = "cnv_quiet_room";

export function isVercelRuntime() {
  return Boolean(process.env.VERCEL);
}

export function isEphemeralPersistence() {
  if (process.env.KIWI_DB_PATH) return false;
  return isVercelRuntime();
}

export function shouldShowTokensInUi() {
  if (process.env.KIWI_SHOW_TOKENS === "0") return false;
  if (process.env.KIWI_SHOW_TOKENS === "1") return true;
  return process.env.VERCEL_ENV !== "production";
}

export function publicBot(bot: BotProfile) {
  return {
    id: bot.id,
    name: bot.name,
    fullName: bot.fullName,
    color: bot.color,
    initial: bot.initial,
  };
}
