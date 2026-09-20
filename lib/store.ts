import {
  convexDeploymentUrl,
  isConvexConfigured,
  isEphemeralPersistence,
  type AuthorKind,
  type PersonId,
} from "./config";
import { isMissingConvexFunctions } from "./convex-client";
import { getPersistenceInfo as getSqlitePersistenceInfo } from "./db";
import * as convex from "./store-convex";
import * as sqlite from "./store-sqlite";
import type { PersistenceInfo } from "./types";

type Store = typeof convex | typeof sqlite;

let adapterPromise: Promise<Store> | null = null;

async function resolveAdapter(): Promise<Store> {
  if (!isConvexConfigured()) return sqlite;
  try {
    await convex.ensureSeed();
    return convex;
  } catch (error) {
    if (isMissingConvexFunctions(error)) {
      console.warn(
        "Convex deployment is reachable but Kiwi functions are not deployed yet. Using SQLite until someone runs `npx convex deploy` with a deploy key from Dashboard → Settings → Deploy Keys.",
      );
      return sqlite;
    }
    throw error;
  }
}

function adapter() {
  if (!adapterPromise) adapterPromise = resolveAdapter();
  return adapterPromise;
}

function convexPersistenceInfo(): PersistenceInfo {
  const url = convexDeploymentUrl();
  let location = url;
  try {
    location = new URL(url).host;
  } catch {
    location = url;
  }
  return {
    ephemeral: false,
    location,
    driver: "convex",
  };
}

export function getPersistenceInfo(): PersistenceInfo {
  if (isConvexConfigured()) return convexPersistenceInfo();
  return getSqlitePersistenceInfo();
}

export async function getActivePersistenceInfo(): Promise<PersistenceInfo> {
  const store = await adapter();
  return store === convex ? convexPersistenceInfo() : getSqlitePersistenceInfo();
}

export async function ensurePersistence() {
  await (await adapter()).ensureSeed();
}

export async function getFriendProfile() {
  return (await adapter()).getFriendProfile();
}

export async function saveFriendName(name: string) {
  return (await adapter()).saveFriendName(name);
}

export async function saveFriendDropbox(input: {
  accountId: string;
  email: string;
  displayName: string;
  accessToken: string;
  refreshToken: string;
}) {
  return (await adapter()).saveFriendDropbox(input);
}

export async function clearFriendDropbox() {
  return (await adapter()).clearFriendDropbox();
}

export async function listConversations() {
  return (await adapter()).listConversations();
}

export async function getConversation(id: string) {
  return (await adapter()).getConversation(id);
}

export async function conversationHasMember(
  conversationId: string,
  botId: string,
) {
  return (await adapter()).conversationHasMember(conversationId, botId);
}

export async function createConversation(input: {
  title?: string;
  memberIds: string[];
}) {
  return (await adapter()).createConversation(input);
}

export async function listMessages(input: {
  conversationId: string;
  after?: string | number | null;
  limit?: number;
}) {
  return (await adapter()).listMessages(input);
}

export async function lastSeq(conversationId: string) {
  return (await adapter()).lastSeq(conversationId);
}

export async function createMessage(input: {
  conversationId: string;
  authorId: PersonId;
  authorKind: AuthorKind;
  body: string;
}) {
  return (await adapter()).createMessage(input);
}

export async function getBootstrap(viewerId: PersonId) {
  return (await adapter()).getBootstrap(viewerId);
}

export { isEphemeralPersistence };
