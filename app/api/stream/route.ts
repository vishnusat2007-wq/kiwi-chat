import { corsHeaders } from "@/lib/http";
import { getConversation, lastSeq, listMessages } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export function GET(request: Request) {
  const url = new URL(request.url);
  const conversationId = url.searchParams.get("conversationId")?.trim();
  if (!conversationId) {
    return Response.json(
      { error: "missing_conversation" },
      { status: 400, headers: corsHeaders() },
    );
  }
  if (!getConversation(conversationId)) {
    return Response.json(
      { error: "not_found" },
      { status: 404, headers: corsHeaders() },
    );
  }

  let cursor =
    url.searchParams.get("after") ?? String(lastSeq(conversationId));
  const encoder = new TextEncoder();
  let closed = false;
  let interval: ReturnType<typeof setInterval> | undefined;
  let timeout: ReturnType<typeof setTimeout> | undefined;

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };

      send("hello", { conversationId, seq: lastSeq(conversationId) });

      interval = setInterval(() => {
        if (closed) return;
        const messages = listMessages({
          conversationId,
          after: cursor || null,
        });
        if (messages.length > 0) {
          cursor = String(messages[messages.length - 1].seq);
          send("messages", { conversationId, messages });
        } else {
          send("ping", { t: Date.now() });
        }
      }, 1000);

      timeout = setTimeout(() => {
        if (closed) return;
        closed = true;
        if (interval) clearInterval(interval);
        send("bye", { reconnect: true });
        controller.close();
      }, 20_000);
    },
    cancel() {
      closed = true;
      if (interval) clearInterval(interval);
      if (timeout) clearTimeout(timeout);
    },
  });

  return new Response(stream, {
    headers: {
      ...corsHeaders(),
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
