import { requireHuman } from "@/lib/auth";
import {
  clearDropboxOAuthCookies,
  exchangeDropboxCode,
  fetchDropboxAccount,
  readDropboxOAuthCookies,
} from "@/lib/dropbox";
import { secretsEqual } from "@/lib/session";
import { saveFriendDropbox } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function redirectTo(request: Request, path: string) {
  const response = new Response(null, {
    status: 302,
    headers: { Location: new URL(path, request.url).toString() },
  });
  for (const cookie of clearDropboxOAuthCookies()) {
    response.headers.append("Set-Cookie", cookie);
  }
  return response;
}

export async function GET(request: Request) {
  const { human } = requireHuman(request);
  if (!human) {
    return redirectTo(request, "/login");
  }
  if (human !== "friend") {
    return redirectTo(request, "/profile?dropbox=forbidden");
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code")?.trim() ?? "";
  const state = url.searchParams.get("state")?.trim() ?? "";
  const oauthError = url.searchParams.get("error");
  const stored = readDropboxOAuthCookies(request);

  if (oauthError) {
    return redirectTo(request, "/profile?dropbox=denied");
  }
  if (!code || !state || !stored.state || !stored.verifier) {
    return redirectTo(request, "/profile?dropbox=error");
  }
  if (!secretsEqual(state, stored.state)) {
    return redirectTo(request, "/profile?dropbox=error");
  }

  try {
    const tokens = await exchangeDropboxCode({
      request,
      code,
      verifier: stored.verifier,
    });
    const account = await fetchDropboxAccount(tokens.accessToken);
    await saveFriendDropbox({
      accountId: account.accountId,
      email: account.email,
      displayName: account.displayName,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    });
    return redirectTo(request, "/profile?dropbox=connected");
  } catch {
    return redirectTo(request, "/profile?dropbox=error");
  }
}
