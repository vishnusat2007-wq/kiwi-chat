import type { AuthorKind, BotId, PersonId } from "./config";
import type { MentionId } from "./mentions";

export type PublicSpeaker = {
  id: BotId;
  name: string;
  fullName: string;
  color: string;
  initial: string;
  kind: AuthorKind;
};

export type PublicBot = PublicSpeaker;

export type Message = {
  id: string;
  seq: number;
  conversationId: string;
  botId: BotId;
  authorId: PersonId;
  authorKind: AuthorKind;
  bot: PublicSpeaker;
  author: PublicSpeaker;
  body: string;
  /** Canonical mention ids present in the body (`vishnu`, `cto`, `friend`, `friend-grok`). */
  mentions: MentionId[];
  createdAt: string;
};

export type Conversation = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  members: PublicSpeaker[];
  lastMessage: Message | null;
};

export type PersistenceDriver = "convex" | "node:sqlite";

export type PersistenceInfo = {
  ephemeral: boolean;
  location: string;
  driver: PersistenceDriver;
};

export type FriendDropboxStatus = {
  connected: boolean;
  email: string | null;
  displayName: string | null;
  connectedAt: string | null;
};

export type FriendProfilePublic = {
  name: string;
  dropbox: FriendDropboxStatus;
};

export type Viewer = {
  id: PersonId;
  name: string;
  username: string;
};

export type BotPresence = {
  id: BotId;
  lastSeenAt: string | null;
  connected: boolean;
};

export type BotPresenceSnapshot = {
  windowMs: number;
  bots: BotPresence[];
};

export type ClearConversationResult = {
  conversationId: string;
  deletedMessages: number;
  reseeded: boolean;
  quietRoomRemoved: boolean;
  missing: boolean;
  removed: boolean;
};

export type BootstrapPayload = {
  conversations: Conversation[];
  messages: Message[];
  activeConversationId: string | null;
  seedConversationId: string;
  bots: PublicSpeaker[];
  botPresence: BotPresence[];
  viewer: Viewer;
  friendProfile: FriendProfilePublic;
  dropboxConfigured: boolean;
  tokens: { vishnu: string; friend: string } | null;
  health: { ok: true };
};
