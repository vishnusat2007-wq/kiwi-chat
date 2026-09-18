import { BOT_LIST, publicBot } from "@/lib/config";
import { getPersistenceInfo } from "@/lib/db";
import { json } from "@/lib/http";
import { listConversations } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  const persistence = getPersistenceInfo();
  return json({
    ok: true,
    service: "kiwi-chat",
    bots: BOT_LIST.map(publicBot),
    conversations: listConversations().length,
    persistence,
  });
}
