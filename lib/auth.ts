import { createHash, timingSafeEqual } from "node:crypto";
import { BOT_LIST, BOTS, type BotId, type BotProfile, type PersonId } from "./config";
import { readSessionFromRequest } from "./session";

function sha256(value: string) {
  return createHash("sha256").update(value).digest();
}

function tokensEqual(a: string, b: string) {
  const left = sha256(a);
  const right = sha256(b);
  return timingSafeEqual(left, right);
}

export type Actor =
  | { kind: "bot"; id: BotId; bot: BotProfile }
  | { kind: "human"; id: PersonId };

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

export function getActor(request: Request): Actor | null {
  const bot = authenticateBot(request);
  if (bot) return { kind: "bot", id: bot.id, bot };
  const human = readSessionFromRequest(request);
  if (human) return { kind: "human", id: human };
  return null;
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

export function requireActor(request: Request) {
  const actor = getActor(request);
  if (!actor) {
    return {
      actor: null as Actor | null,
      error: {
        error: "unauthorized",
        message: "Sign in, or provide Authorization: Bearer <bot token>.",
      },
    };
  }
  return { actor, error: null };
}

export function canResetChat(actor: Actor) {
  return actor.id === "vishnu";
}

export function requireHuman(request: Request) {
  const human = readSessionFromRequest(request);
  if (!human) {
    return {
      human: null as PersonId | null,
      error: {
        error: "unauthorized",
        message: "Sign in with the login Vishnu gave you.",
      },
    };
  }
  return { human, error: null };
}

export function isBotId(value: string): value is BotId {
  return value === "vishnu" || value === "friend";
}

export function getBot(id: BotId) {
  return BOTS[id];
}
