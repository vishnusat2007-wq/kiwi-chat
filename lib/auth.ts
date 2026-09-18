import { createHash, timingSafeEqual } from "node:crypto";
import { BOT_LIST, BOTS, type BotId, type BotProfile } from "./config";

function sha256(value: string) {
  return createHash("sha256").update(value).digest();
}

function tokensEqual(a: string, b: string) {
  const left = sha256(a);
  const right = sha256(b);
  return timingSafeEqual(left, right);
}

export function parseBearer(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? "";
}

export function authenticateBot(request: Request): BotProfile | null {
  const token = parseBearer(request);
  if (!token) return null;

  let matched: BotProfile | null = null;
  for (const bot of BOT_LIST) {
    if (tokensEqual(token, bot.token)) {
      matched = bot;
    }
  }
  return matched;
}

export function requireBot(request: Request) {
  const bot = authenticateBot(request);
  if (!bot) {
    return {
      bot: null as BotProfile | null,
      error: {
        error: "unauthorized",
        message: "Provide Authorization: Bearer <bot token>.",
      },
    };
  }
  return { bot, error: null };
}

export function isBotId(value: string): value is BotId {
  return value === "vishnu" || value === "friend";
}

export function getBot(id: BotId) {
  return BOTS[id];
}
