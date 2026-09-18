import type { BotId } from "./config";

export type PublicBot = {
  id: BotId;
  name: string;
  fullName: string;
  color: string;
  initial: string;
};

export type Message = {
  id: string;
  seq: number;
  conversationId: string;
  botId: BotId;
  bot: PublicBot;
  body: string;
  createdAt: string;
};

export type Conversation = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  members: PublicBot[];
  lastMessage: Message | null;
};

export type PersistenceInfo = {
  ephemeral: boolean;
  location: string;
  driver: "node:sqlite";
};

export type BootstrapPayload = {
  conversations: Conversation[];
  messages: Message[];
  activeConversationId: string | null;
  bots: PublicBot[];
  persistence: PersistenceInfo;
  tokens: { vishnu: string; friend: string } | null;
  health: { ok: true };
};
