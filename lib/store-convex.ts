import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";
import { getBot } from "./auth";
import {
  BOT_LIST,
  HUMANS,
  SEED_CONVERSATION_ID,
  convexDeploymentUrl,
  isDropboxConfigured,
  publicBot,
  shouldShowTokensInUi,
  type AuthorKind,
  type PersonId,
} from "./config";
import { humanDisplayName } from "./session";
import type {
  BootstrapPayload,
  Conversation,
  FriendProfilePublic,
  Message,
} from "./types";

let printed = false;

function client() {
  const url = convexDeploymentUrl();
  if (!url) {
    throw new Error("Convex is not configured.");
  }
  return new ConvexHttpClient(url);
}

export async function getFriendProfile(): Promise<FriendProfilePublic> {
  return client().query(anyApi.chat.getFriendProfile, {});
}

export async function saveFriendName(name: string) {
  return client().mutation(anyApi.chat.saveFriendName, { name });
}

export async function saveFriendDropbox(input: {
  accountId: string;
  email: string;
  displayName: string;
  accessToken: string;
  refreshToken: string;
}) {
  return client().mutation(anyApi.chat.saveFriendDropbox, input);
}

export async function clearFriendDropbox() {
  return client().mutation(anyApi.chat.clearFriendDropbox, {});
}

export async function listConversations(): Promise<Conversation[]> {
  return client().query(anyApi.chat.listConversations, {});
}

export async function getConversation(id: string): Promise<Conversation | null> {
  return client().query(anyApi.chat.getConversation, { conversationId: id });
}

export async function conversationHasMember(
  conversationId: string,
  botId: string,
) {
  return client().query(anyApi.chat.conversationHasMember, {
    conversationId,
    botId,
  });
}

export async function createConversation(input: {
  title?: string;
  memberIds: string[];
}) {
  const conversation = await client().mutation(anyApi.chat.createConversation, {
    title: input.title,
    memberIds: input.memberIds,
  });
  if (!conversation) {
    throw new Error("Convex did not return the new conversation.");
  }
  return conversation as Conversation;
}

export async function listMessages(input: {
  conversationId: string;
  after?: string | number | null;
  limit?: number;
}): Promise<Message[]> {
  return client().query(anyApi.chat.listMessages, {
    conversationId: input.conversationId,
    after: input.after ?? null,
    limit: input.limit,
  });
}

export async function lastSeq(conversationId: string) {
  return client().query(anyApi.chat.lastSeq, { conversationId });
}

export async function createMessage(input: {
  conversationId: string;
  authorId: PersonId;
  authorKind: AuthorKind;
  body: string;
}) {
  return client().mutation(anyApi.chat.createMessage, input);
}

export async function getBootstrap(viewerId: PersonId): Promise<BootstrapPayload> {
  const conversations = await listConversations();
  const preferred =
    conversations.find(
      (conversation) =>
        conversation.id === SEED_CONVERSATION_ID && conversation.lastMessage,
    ) ??
    conversations.find((conversation) => conversation.lastMessage) ??
    conversations[0] ??
    null;
  const activeConversationId = preferred?.id ?? null;
  const messages = activeConversationId
    ? await listMessages({ conversationId: activeConversationId })
    : [];
  const friendProfile = await getFriendProfile();
  const showTokens = shouldShowTokensInUi() && viewerId === "vishnu";

  return {
    conversations,
    messages,
    activeConversationId,
    bots: BOT_LIST.map(publicBot),
    viewer: {
      id: viewerId,
      name: humanDisplayName(viewerId, friendProfile.name),
      username: HUMANS[viewerId].username,
    },
    friendProfile,
    dropboxConfigured: isDropboxConfigured(),
    tokens: showTokens
      ? {
          vishnu: getBot("vishnu").token,
          friend: getBot("friend").token,
        }
      : null,
    health: { ok: true },
  };
}

export async function ensureSeed() {
  const result = (await client().mutation(anyApi.seed.ensureSeed, {})) as {
    seeded: boolean;
    conversationId: string;
  };
  if (!printed) {
    printed = true;
    const url = convexDeploymentUrl();
    console.log(
      [
        "",
        "  🥝  Kiwi Chat ready",
        "  ─────────────────────────────────────────────",
        `  Database   Convex · ${url}`,
        "  People     vishnu  ·  friend  (env logins, no public signup)",
        "  Bots       vishnu  ·  friend",
        result.seeded
          ? "  Seeded default thread: Kiwi Lab (vishnu ↔ friend)."
          : "  Existing Convex data reused.",
        "",
      ].join("\n"),
    );
  }
  return result;
}
