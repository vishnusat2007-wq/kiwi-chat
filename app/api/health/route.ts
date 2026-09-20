import { BOT_LIST, publicBot } from "@/lib/config";
import { json } from "@/lib/http";
import {
  ensurePersistence,
  getActivePersistenceInfo,
  listConversations,
} from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  await ensurePersistence();
  const persistence = await getActivePersistenceInfo();
  return json({
    ok: true,
    service: "kiwi-chat",
    bots: BOT_LIST.map(publicBot),
    conversations: (await listConversations()).length,
    persistence,
  });
}
