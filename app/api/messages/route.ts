import { requireActor } from "@/lib/auth";
import { json, noContent, readJson } from "@/lib/http";
import {
  conversationHasMember,
  createMessage,
  getConversation,
  listMessages,
  noteBot,
} from "@/lib/store";
import { wakeBotsForMessage } from "@/lib/webhooks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS() {
  return noContent();
}

export async function GET(request: Request) {
  const { actor, error } = requireActor(request);
  if (error) return json(error, 401);
  noteBot(actor);

  const url = new URL(request.url);
  const conversationId = url.searchParams.get("conversationId")?.trim();
  if (!conversationId) {
    return json(
      {
        error: "missing_conversation",
        message: "Query param conversationId is required.",
      },
      400,
    );
  }

  if (!(await getConversation(conversationId))) {
    return json({ error: "not_found" }, 404);
  }

  const after = url.searchParams.get("after");
  const mentions = url.searchParams.get("mentions")?.trim();
  let messages = await listMessages({
    conversationId,
    after,
  });

  if (mentions) {
    const wanted = new Set(
      mentions
        .split(",")
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean),
    );
    messages = messages.filter((message) =>
      message.mentions.some((id) => wanted.has(id)),
    );
  }

  return json({ conversationId, messages });
}

export async function POST(request: Request) {
  const { actor, error } = requireActor(request);
  if (!actor) return json(error, 401);
  noteBot(actor);

  const body = await readJson<{
    conversationId?: unknown;
    body?: unknown;
  }>(request);
  if (!body) return json({ error: "invalid_json" }, 400);

  const conversationId =
    typeof body.conversationId === "string" ? body.conversationId.trim() : "";
  const text = typeof body.body === "string" ? body.body.trim() : "";

  if (!conversationId) {
    return json(
      { error: "missing_conversation", message: "conversationId is required." },
      400,
    );
  }
  if (!text) {
    return json({ error: "empty_body", message: "body cannot be empty." }, 400);
  }
  if (text.length > 8000) {
    return json(
      { error: "too_long", message: "body must be 8000 characters or fewer." },
      400,
    );
  }

  if (!(await getConversation(conversationId))) {
    return json({ error: "not_found" }, 404);
  }
  if (
    actor.kind === "bot" &&
    !(await conversationHasMember(conversationId, actor.id))
  ) {
    return json(
      {
        error: "forbidden",
        message: "This bot is not a member of that conversation.",
      },
      403,
    );
  }

  const message = await createMessage({
    conversationId,
    authorId: actor.id,
    authorKind: actor.kind,
    body: text,
  });

  // Fire-and-forget — never block the chat response on webhook latency.
  wakeBotsForMessage(message);

  return json({ message }, 201);
}
