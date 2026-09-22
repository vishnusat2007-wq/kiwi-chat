import { FriendBotGuide, type GuideBlock } from "@/components/friend-bot-guide";
import { getBot } from "@/lib/auth";
import { SEED_CONVERSATION_ID } from "@/lib/config";
import { requirePageSession } from "@/lib/page-auth";
import { humanDisplayName } from "@/lib/session";
import { getFriendProfile } from "@/lib/store";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function requestOrigin(headerStore: Headers) {
  const forwardedHost = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  const host = forwardedHost?.split(",")[0]?.trim() || "localhost:3000";
  const forwardedProto = headerStore.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const proto =
    forwardedProto ||
    (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
  return `${proto}://${host}`;
}

function buildBrief(origin: string, token: string, conversationId: string) {
  return `You are the friend’s Grok on Kiwi Chat. Humans type in the messenger. You talk only over HTTP.

Base URL: ${origin}
Authorization: Bearer ${token}
Conversation id: ${conversationId}

Setup:
export KIWI_URL="${origin}"
export KIWI_TOKEN="${token}"
export KIWI_CONVERSATION="${conversationId}"

Send a line:
curl -sS -X POST "$KIWI_URL/api/messages" \\
  -H "Authorization: Bearer $KIWI_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"conversationId":"${conversationId}","body":"Pong from the friend Grok."}'

Read new lines (after is the last seq you have already seen):
curl -sS "$KIWI_URL/api/messages?conversationId=${conversationId}&after=0" \\
  -H "Authorization: Bearer $KIWI_TOKEN"

Poll loop (every 2 seconds). This is what marks Friend’s Grok as connected:
AFTER=0
while true; do
  json=$(curl -sS "$KIWI_URL/api/messages?conversationId=$KIWI_CONVERSATION&after=$AFTER" \\
    -H "Authorization: Bearer $KIWI_TOKEN")
  printf '%s\\n' "$json"
  AFTER=$(printf '%s' "$json" | node --input-type=module -e '
    import { readFileSync } from "node:fs";
    const raw = readFileSync(0, "utf8");
    const data = JSON.parse(raw || "{}");
    const messages = data.messages ?? [];
    const fallback = process.argv[1] ?? "0";
    process.stdout.write(messages.length ? String(messages.at(-1).seq) : String(fallback));
  ' "$AFTER")
  sleep 2
done

Rules:
- authorKind "human" is a person typing in Kiwi Chat.
- authorKind "bot" and authorId "vishnu" is Vishnu’s Grok.
- Skip your own lines: authorId "friend" and authorKind "bot".
- Reply with POST /api/messages and a short body.
- Keep the poll loop running about every 2 seconds.`;
}

export default async function FriendBotPage() {
  const viewerId = await requirePageSession();
  const [headerStore, friendProfile] = await Promise.all([
    headers(),
    getFriendProfile(),
  ]);
  const origin = requestOrigin(headerStore);
  const token = getBot("friend").token;
  const conversationId = SEED_CONVERSATION_ID;
  const brief = buildBrief(origin, token, conversationId);

  const blocks: GuideBlock[] = [
    {
      id: "base",
      title: "Base URL",
      hint: "No trailing slash. This is the site you are signed into.",
      code: origin,
    },
    {
      id: "token",
      title: "Bearer token · friend’s Grok",
      hint: "Existing friend bot token. Header is Authorization: Bearer <token>.",
      code: token,
    },
    {
      id: "conversation",
      title: "Conversation id",
      hint: "Kiwi Lab. Send and poll this thread.",
      code: conversationId,
    },
    {
      id: "env",
      title: "Shell setup",
      hint: "Export these before the curls.",
      code: `export KIWI_URL="${origin}"\nexport KIWI_TOKEN="${token}"\nexport KIWI_CONVERSATION="${conversationId}"`,
    },
    {
      id: "send",
      title: "Send a line",
      hint: "POST /api/messages. The calling bot is the author.",
      code: `curl -sS -X POST "$KIWI_URL/api/messages" \\\n  -H "Authorization: Bearer $KIWI_TOKEN" \\\n  -H "Content-Type: application/json" \\\n  -d '{"conversationId":"${conversationId}","body":"Pong from the friend Grok."}'`,
    },
    {
      id: "poll",
      title: "Read the thread",
      hint: "GET /api/messages. after=0 returns the thread. Later, pass the last seq.",
      code: `curl -sS "$KIWI_URL/api/messages?conversationId=${conversationId}&after=0" \\\n  -H "Authorization: Bearer $KIWI_TOKEN"`,
    },
    {
      id: "loop",
      title: "Poll loop",
      hint: "Run this and leave it up. A hit inside 30 seconds shows Friend’s Grok as connected.",
      code: `AFTER=0
while true; do
  json=$(curl -sS "$KIWI_URL/api/messages?conversationId=$KIWI_CONVERSATION&after=$AFTER" \\
    -H "Authorization: Bearer $KIWI_TOKEN")
  printf '%s\\n' "$json"
  AFTER=$(printf '%s' "$json" | node --input-type=module -e '
    import { readFileSync } from "node:fs";
    const raw = readFileSync(0, "utf8");
    const data = JSON.parse(raw || "{}");
    const messages = data.messages ?? [];
    const fallback = process.argv[1] ?? "0";
    process.stdout.write(messages.length ? String(messages.at(-1).seq) : String(fallback));
  ' "$AFTER")
  sleep 2
done`,
    },
  ];

  return (
    <FriendBotGuide
      viewerName={humanDisplayName(viewerId, friendProfile.name)}
      brief={brief}
      blocks={blocks}
    />
  );
}
