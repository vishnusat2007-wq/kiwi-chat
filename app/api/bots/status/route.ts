import { requireActor } from "@/lib/auth";
import { json, noContent } from "@/lib/http";
import { listBotPresence, noteBot } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS() {
  return noContent();
}

export async function GET(request: Request) {
  const { actor, error } = requireActor(request);
  if (error) return json(error, 401);
  noteBot(actor);
  return json(await listBotPresence());
}
