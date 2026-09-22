import { canResetChat, requireActor } from "@/lib/auth";
import { isMissingConvexFunctions } from "@/lib/convex-client";
import { json, noContent, readJson } from "@/lib/http";
import { clearConversation, listConversations, listMessages } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS() {
  return noContent();
}

export async function POST(request: Request) {
  const { actor, error } = requireActor(request);
  if (!actor) return json(error, 401);
  if (!canResetChat(actor)) {
    return json(
      {
        error: "forbidden",
        message: "Only Vishnu can reset a thread.",
      },
      403,
    );
  }

  const body =
    (await readJson<{
      conversationId?: unknown;
      reseed?: unknown;
    }>(request)) ?? {};

  const conversationId =
    typeof body.conversationId === "string" ? body.conversationId.trim() : "";
  if (body.reseed !== undefined && typeof body.reseed !== "boolean") {
    return json(
      { error: "invalid_reseed", message: "reseed must be a boolean." },
      400,
    );
  }

  try {
    const result = await clearConversation({
      ...(conversationId ? { conversationId } : {}),
      ...(typeof body.reseed === "boolean" ? { reseed: body.reseed } : {}),
    });

    if (result.missing) {
      return json(
        {
          error: "not_found",
          message: "No conversation with that id.",
          ...result,
        },
        404,
      );
    }

    const [messages, conversations] = await Promise.all([
      result.removed
        ? Promise.resolve([])
        : listMessages({ conversationId: result.conversationId }),
      listConversations(),
    ]);

    return json({ ...result, messages, conversations });
  } catch (cause) {
    if (isMissingConvexFunctions(cause)) {
      return json(
        {
          error: "not_deployed",
          message:
            "chat.clearConversation is not on this Convex deployment yet. Push convex/ and run it again.",
        },
        503,
      );
    }
    throw cause;
  }
}
