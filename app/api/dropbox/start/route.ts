import { requireHuman } from "@/lib/auth";
import { isDropboxConfigured } from "@/lib/config";
import {
  createOAuthState,
  createPkcePair,
  dropboxAuthorizeUrl,
  dropboxStartCookies,
} from "@/lib/dropbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function redirectTo(request: Request, path: string, cookies: string[] = []) {
  const response = new Response(null, {
    status: 302,
    headers: { Location: new URL(path, request.url).toString() },
  });
  for (const cookie of cookies) {
    response.headers.append("Set-Cookie", cookie);
  }
  return response;
}

export function GET(request: Request) {
  const { human } = requireHuman(request);
  if (!human) return redirectTo(request, "/login");
  if (human !== "friend") {
    return redirectTo(request, "/profile?dropbox=forbidden");
  }
  if (!isDropboxConfigured()) {
    return redirectTo(request, "/profile?dropbox=missing");
  }

  const state = createOAuthState();
  const pkce = createPkcePair();
  const location = dropboxAuthorizeUrl({
    request,
    state,
    challenge: pkce.challenge,
  });
  const response = new Response(null, {
    status: 302,
    headers: { Location: location },
  });
  for (const cookie of dropboxStartCookies(state, pkce.verifier)) {
    response.headers.append("Set-Cookie", cookie);
  }
  return response;
}
