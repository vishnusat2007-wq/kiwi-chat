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
import { api, getConvexClient } from "./convex-client";
import { humanDisplayName } from "./session";
import type {
  BootstrapPayload,
  BotPresenceSnapshot,
  ClearConversationResult,
  Conversation,
  FriendProfilePublic,
  Message,
} from "./types";

let printed = false;

function client() {
  return getConvexClient();
}

export async function getFriendProfile(): Promise<FriendProfilePublic> {
  return client().query(api.chat.getFriendProfile, {});
}

export async function saveFriendName(name: string) {
  return client().mutation(api.chat.saveFriendName, { name });
}

export async function saveFriendDropbox(input: {
  accountId: string;
  email: string;
  displayName: string;
  accessToken: string;
  refreshToken: string;
}) {
  return client().mutation(api.chat.saveFriendDropbox, input);
}

export async function clearFriendDropbox() {
  return client().mutation(api.chat.clearFriendDropbox, {});
}

export async function listConversations(): Promise<Conversation[]> {
  return client().query(api.chat.listConversations, {});
}

export async function getConversation(id: string): Promise<Conversation | null> {
  return client().query(api.chat.getConversation, { conversationId: id });
}

export async function conversationHasMember(
  conversationId: string,
  botId: string,
) {
  return client().query(api.chat.conversationHasMember, {
    conversationId,
    botId,
  });
}

export async function createConversation(input: {
  title?: string;
  memberIds: string[];
}) {
  const conversation = await client().mutation(api.chat.createConversation, {
    title: input.title,
    memberIds: input.memberIds,
  });
  if (!conversation) {
    throw new Error("Convex did not return the new conversation.");
  }
  return conversation;
}

export async function listMessages(input: {
  conversationId: string;
  after?: string | number | null;
  limit?: number;
}): Promise<Message[]> {
  return client().query(api.chat.listMessages, {
    conversationId: input.conversationId,
    after: input.after ?? null,
    limit: input.limit,
  });
}

export async function lastSeq(conversationId: string) {
  return client().query(api.chat.lastSeq, { conversationId });
}

export async function touchBot(botId: PersonId) {
  return client().mutation(api.chat.touchBot, { botId });
}

export async function listBotPresence(): Promise<BotPresenceSnapshot> {
  return client().query(api.chat.listBotPresence, {});
}

export async function clearConversation(input: {
  conversationId?: string;
  reseed?: boolean;
}): Promise<ClearConversationResult> {
  return client().mutation(api.chat.clearConversation, {
    ...(input.conversationId ? { conversationId: input.conversationId } : {}),
    ...(input.reseed !== undefined ? { reseed: input.reseed } : {}),
  });
}

export async function createMessage(input: {
  conversationId: string;
  authorId: PersonId;
  authorKind: AuthorKind;
  body: string;
}) {
  return client().mutation(api.chat.createMessage, input);
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
  const [messages, friendProfile, presence] = await Promise.all([
    activeConversationId
      ? listMessages({ conversationId: activeConversationId })
      : Promise.resolve([] as Message[]),
    getFriendProfile(),
    listBotPresence(),
  ]);
  const showTokens = shouldShowTokensInUi() && viewerId === "vishnu";

  return {
    conversations,
    messages,
    activeConversationId,
    seedConversationId: SEED_CONVERSATION_ID,
    bots: BOT_LIST.map(publicBot),
    botPresence: presence.bots,
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
  const result = await client().mutation(api.seed.ensureSeed, {});
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
