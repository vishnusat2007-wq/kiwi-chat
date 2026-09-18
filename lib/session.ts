import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import {
  HUMAN_LIST,
  HUMANS,
  SESSION_COOKIE,
  sessionSecret,
  type PersonId,
} from "./config";

const SESSION_MS = 30 * 24 * 60 * 60 * 1000;

function sha256(value: string | Buffer) {
  return createHash("sha256").update(value).digest();
}

export function secretsEqual(a: string, b: string) {
  return timingSafeEqual(sha256(a), sha256(b));
}

function sign(payload: string) {
  return createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
}

export function createSessionToken(userId: PersonId) {
  const payload = Buffer.from(
    JSON.stringify({ sub: userId, exp: Date.now() + SESSION_MS }),
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string): PersonId | null {
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!payload || !sig) return null;

  const expected = sign(payload);
  if (!secretsEqual(sig, expected)) return null;

  try {
    const data = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as { sub?: unknown; exp?: unknown };
    if (data.sub !== "vishnu" && data.sub !== "friend") return null;
    if (typeof data.exp !== "number" || data.exp < Date.now()) return null;
    return data.sub;
  } catch {
    return null;
  }
}

export function readCookie(header: string, name: string) {
  const parts = header.split(";");
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    if (trimmed.slice(0, eq) !== name) continue;
    return decodeURIComponent(trimmed.slice(eq + 1));
  }
  return "";
}

export function readSessionFromRequest(request: Request): PersonId | null {
  const header = request.headers.get("cookie") ?? "";
  const token = readCookie(header, SESSION_COOKIE);
  if (!token) return null;
  return verifySessionToken(token);
}

export function cookieFlags(maxAgeSeconds: number) {
  const parts = ["Path=/", "HttpOnly", "SameSite=Lax", `Max-Age=${maxAgeSeconds}`];
  if (process.env.VERCEL || process.env.NODE_ENV === "production") {
    parts.push("Secure");
  }
  return parts.join("; ");
}

export function sessionCookieHeader(token: string) {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; ${cookieFlags(
    SESSION_MS / 1000,
  )}`;
}

export function clearCookieHeader(name: string) {
  return `${name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function matchHumanLogin(username: string, password: string): PersonId | null {
  const userNeedle = username.trim().toLowerCase();
  if (!userNeedle || !password) return null;

  let matched: PersonId | null = null;
  for (const human of HUMAN_LIST) {
    const userOk = human.username.trim().toLowerCase() === userNeedle;
    const passOk = secretsEqual(password, human.password);
    if (userOk && passOk) matched = human.id;
  }
  return matched;
}

export function humanDisplayName(id: PersonId, friendName?: string) {
  if (id === "vishnu") return HUMANS.vishnu.name;
  const trimmed = friendName?.trim();
  return trimmed || HUMANS.friend.name;
}
