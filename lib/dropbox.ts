import { createHash, randomBytes } from "node:crypto";
import {
  DROPBOX_STATE_COOKIE,
  DROPBOX_VERIFIER_COOKIE,
  dropboxAppKey,
  dropboxAppSecret,
  isDropboxConfigured,
} from "./config";
import { cookieFlags, readCookie } from "./session";

const AUTHORIZE_URL = "https://www.dropbox.com/oauth2/authorize";
const TOKEN_URL = "https://api.dropboxapi.com/oauth2/token";
const ACCOUNT_URL = "https://api.dropboxapi.com/2/users/get_current_account";

export type DropboxAccount = {
  accountId: string;
  email: string;
  displayName: string;
};

export type DropboxTokens = {
  accessToken: string;
  refreshToken: string;
};

export function dropboxRedirectUri(request: Request) {
  const configured = process.env.DROPBOX_REDIRECT_URI?.trim();
  if (configured) return configured;
  return new URL("/api/dropbox/callback", request.url).toString();
}

export function createPkcePair() {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function createOAuthState() {
  return randomBytes(16).toString("base64url");
}

export function dropboxStartCookies(state: string, verifier: string) {
  const flags = cookieFlags(10 * 60);
  return [
    `${DROPBOX_STATE_COOKIE}=${encodeURIComponent(state)}; ${flags}`,
    `${DROPBOX_VERIFIER_COOKIE}=${encodeURIComponent(verifier)}; ${flags}`,
  ];
}

export function readDropboxOAuthCookies(request: Request) {
  const header = request.headers.get("cookie") ?? "";
  return {
    state: readCookie(header, DROPBOX_STATE_COOKIE),
    verifier: readCookie(header, DROPBOX_VERIFIER_COOKIE),
  };
}

export function clearDropboxOAuthCookies() {
  return [
    `${DROPBOX_STATE_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
    `${DROPBOX_VERIFIER_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
  ];
}

export function dropboxAuthorizeUrl(input: {
  request: Request;
  state: string;
  challenge: string;
}) {
  const params = new URLSearchParams({
    client_id: dropboxAppKey(),
    response_type: "code",
    token_access_type: "offline",
    redirect_uri: dropboxRedirectUri(input.request),
    state: input.state,
    code_challenge: input.challenge,
    code_challenge_method: "S256",
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

async function parseOAuthError(response: Response) {
  const text = await response.text();
  try {
    const data = JSON.parse(text) as { error_description?: string; error?: string };
    return data.error_description || data.error || text || `HTTP ${response.status}`;
  } catch {
    return text || `HTTP ${response.status}`;
  }
}

export async function exchangeDropboxCode(input: {
  request: Request;
  code: string;
  verifier: string;
}): Promise<DropboxTokens> {
  if (!isDropboxConfigured()) {
    throw new Error("Dropbox is not configured.");
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: input.code,
    client_id: dropboxAppKey(),
    client_secret: dropboxAppSecret(),
    redirect_uri: dropboxRedirectUri(input.request),
    code_verifier: input.verifier,
  });

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!response.ok) {
    throw new Error(await parseOAuthError(response));
  }

  const data = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
  };
  if (!data.access_token) {
    throw new Error("Dropbox did not return an access token.");
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? "",
  };
}

export async function fetchDropboxAccount(
  accessToken: string,
): Promise<DropboxAccount> {
  const response = await fetch(ACCOUNT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: "null",
  });

  if (!response.ok) {
    throw new Error(await parseOAuthError(response));
  }

  const data = (await response.json()) as {
    account_id?: string;
    email?: string;
    name?: { display_name?: string };
  };

  return {
    accountId: data.account_id ?? "",
    email: data.email ?? "",
    displayName: data.name?.display_name ?? "",
  };
}
