import type { AuthorKind, PersonId } from "./config";
import {
  bodyMentionsCto,
  bodyMentionsFriendGrok,
  type MentionId,
} from "./mentions";

export type WebhookMessage = {
  id: string;
  seq: number;
  conversationId: string;
  authorId: PersonId;
  authorKind: AuthorKind;
  body: string;
  mentions: MentionId[];
  createdAt: string;
};

type WebhookTarget = "cto" | "friend";

function webhookUrl(target: WebhookTarget) {
  if (target === "cto") {
    return process.env.KIWI_CTO_WEBHOOK_URL?.trim() || "";
  }
  return process.env.KIWI_FRIEND_WEBHOOK_URL?.trim() || "";
}

function webhookSecret(target: WebhookTarget) {
  if (target === "cto") {
    return process.env.KIWI_CTO_WEBHOOK_SECRET?.trim() || "";
  }
  return process.env.KIWI_FRIEND_WEBHOOK_SECRET?.trim() || "";
}

function shouldWakeCto(message: WebhookMessage) {
  const fromVishnuBot =
    message.authorKind === "bot" && message.authorId === "vishnu";
  if (!fromVishnuBot) return true;
  return (
    message.mentions.includes("cto") || bodyMentionsCto(message.body)
  );
}

function shouldWakeFriend(message: WebhookMessage) {
  const fromFriendBot =
    message.authorKind === "bot" && message.authorId === "friend";
  if (!fromFriendBot) return true;
  return (
    message.mentions.includes("friend-grok") ||
    bodyMentionsFriendGrok(message.body)
  );
}

function buildPayload(message: WebhookMessage, target: WebhookTarget) {
  return {
    event: "message.created",
    target,
    conversationId: message.conversationId,
    message: {
      id: message.id,
      seq: message.seq,
      authorId: message.authorId,
      authorKind: message.authorKind,
      body: message.body,
      mentions: message.mentions,
      createdAt: message.createdAt,
    },
  };
}

function buildHeaders(target: WebhookTarget) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "kiwi-chat-webhook/1",
  };
  const secret = webhookSecret(target);
  if (secret) {
    // Grok Bot routines often accept either form; send both when a secret is set.
    headers.Authorization = `Bearer ${secret}`;
    headers["X-Kiwi-Webhook-Secret"] = secret;
    headers["X-Kiwi-Sender-Key"] = secret;
  }
  return headers;
}

async function postWebhook(target: WebhookTarget, message: WebhookMessage) {
  const url = webhookUrl(target);
  if (!url) return;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: buildHeaders(target),
      body: JSON.stringify(buildPayload(message, target)),
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) {
      console.warn(
        `Kiwi ${target} webhook returned ${response.status} for ${message.id}`,
      );
    }
  } catch (error) {
    console.warn(`Kiwi ${target} webhook failed for ${message.id}`, error);
  }
}

/**
 * Fire-and-forget bot wakes after a message is stored.
 * Never awaited by the chat response path.
 */
export function wakeBotsForMessage(message: WebhookMessage) {
  if (shouldWakeCto(message) && webhookUrl("cto")) {
    void postWebhook("cto", message);
  }
  if (shouldWakeFriend(message) && webhookUrl("friend")) {
    void postWebhook("friend", message);
  }
}
