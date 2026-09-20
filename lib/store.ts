import {
  convexDeploymentUrl,
  isConvexConfigured,
  isEphemeralPersistence,
  type AuthorKind,
  type PersonId,
} from "./config";
import { getPersistenceInfo as getSqlitePersistenceInfo } from "./db";
import * as convex from "./store-convex";
import * as sqlite from "./store-sqlite";
import type { PersistenceInfo } from "./types";

function store() {
  return isConvexConfigured() ? convex : sqlite;
}

export function getPersistenceInfo(): PersistenceInfo {
  if (isConvexConfigured()) {
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
  return getSqlitePersistenceInfo();
}

export async function ensurePersistence() {
  await store().ensureSeed();
}

export async function getFriendProfile() {
  return store().getFriendProfile();
}

export async function saveFriendName(name: string) {
  return store().saveFriendName(name);
}

export async function saveFriendDropbox(input: {
  accountId: string;
  email: string;
  displayName: string;
  accessToken: string;
  refreshToken: string;
}) {
  return store().saveFriendDropbox(input);
}

export async function clearFriendDropbox() {
  return store().clearFriendDropbox();
}

export async function listConversations() {
  return store().listConversations();
}

export async function getConversation(id: string) {
  return store().getConversation(id);
}

export async function conversationHasMember(
  conversationId: string,
  botId: string,
) {
  return store().conversationHasMember(conversationId, botId);
}

export async function createConversation(input: {
  title?: string;
  memberIds: string[];
}) {
  return store().createConversation(input);
}

export async function listMessages(input: {
  conversationId: string;
  after?: string | number | null;
  limit?: number;
}) {
  return store().listMessages(input);
}

export async function lastSeq(conversationId: string) {
  return store().lastSeq(conversationId);
}

export async function createMessage(input: {
  conversationId: string;
  authorId: PersonId;
  authorKind: AuthorKind;
  body: string;
}) {
  return store().createMessage(input);
}

export async function getBootstrap(viewerId: PersonId) {
  return store().getBootstrap(viewerId);
}

export { isEphemeralPersistence };
