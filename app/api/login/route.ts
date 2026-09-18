import { json, noContent, readJson } from "@/lib/http";
import { createSessionToken, matchHumanLogin, sessionCookieHeader } from "@/lib/session";
import { getFriendProfile } from "@/lib/store";
import { humanDisplayName } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS() {
  return noContent();
}

export async function POST(request: Request) {
  const body = await readJson<{ username?: unknown; password?: unknown }>(
    request,
  );
  if (!body) return json({ error: "invalid_json" }, 400);

  const username = typeof body.username === "string" ? body.username : "";
  const password = typeof body.password === "string" ? body.password : "";
  const id = matchHumanLogin(username, password);
  if (!id) {
    return json(
      {
        error: "invalid_login",
        message: "That login doesn’t match. Use the details Vishnu sent you.",
      },
      401,
    );
  }

  const friendProfile = getFriendProfile();
  const response = json({
    ok: true,
    user: {
      id,
      name: humanDisplayName(id, friendProfile.name),
    },
    next:
      id === "friend" && !friendProfile.name.trim() ? "/profile?setup=1" : "/",
  });
  response.headers.append("Set-Cookie", sessionCookieHeader(createSessionToken(id)));
  return response;
}
