import { isBotId, requireActor, requireBot } from "@/lib/auth";
import { json, noContent, readJson } from "@/lib/http";
import { createConversation, listConversations } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS() {
  return noContent();
}

export async function GET(request: Request) {
  const { error } = requireActor(request);
  if (error) return json(error, 401);
  return json({ conversations: await listConversations() });
}

export async function POST(request: Request) {
  const { bot, error } = requireBot(request);
  if (!bot) return json(error, 401);

  const body = await readJson<{ title?: unknown; members?: unknown }>(request);
  if (!body) return json({ error: "invalid_json" }, 400);

  const title = typeof body.title === "string" ? body.title : undefined;
  const requested = Array.isArray(body.members)
    ? body.members.filter((item): item is string => typeof item === "string")
    : [];

  const memberIds = new Set<string>([bot.id, ...requested]);
  if (memberIds.size < 2) {
    memberIds.add(bot.id === "vishnu" ? "friend" : "vishnu");
  }

  for (const id of memberIds) {
    if (!isBotId(id)) {
      return json(
        {
          error: "unknown_member",
          message: `Unknown bot '${id}'. Seeded bots: vishnu, friend.`,
        },
        400,
      );
    }
  }

  const conversation = await createConversation({
    title,
    memberIds: Array.from(memberIds),
  });

  return json({ conversation }, 201);
}
