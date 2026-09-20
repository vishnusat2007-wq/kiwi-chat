import type { AuthorKind, BotId, PersonId } from "./config";

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

export type BootstrapPayload = {
  conversations: Conversation[];
  messages: Message[];
  activeConversationId: string | null;
  bots: PublicSpeaker[];
  viewer: Viewer;
  friendProfile: FriendProfilePublic;
  dropboxConfigured: boolean;
  tokens: { vishnu: string; friend: string } | null;
  health: { ok: true };
};
