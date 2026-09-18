import { json, noContent } from "@/lib/http";
import { SESSION_COOKIE } from "@/lib/config";
import { clearCookieHeader } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS() {
  return noContent();
}

export function POST() {
  const response = json({ ok: true });
  response.headers.append("Set-Cookie", clearCookieHeader(SESSION_COOKIE));
  return response;
}
