#!/usr/bin/env bash
set -euo pipefail

KIWI_URL="${KIWI_URL:-http://localhost:3000}"
TOKEN="${BOT_TOKEN_VISHNU:-kiwi_vishnu_k9m2XqP4wR7nT1bH8sL3}"
BODY="${1:-Ping from Vishnu’s Grok.}"
CONV="${2:-}"

if [[ -z "$CONV" ]]; then
  CONV="$(curl -sf "$KIWI_URL/api/conversations" | node -e '
    let d = "";
    process.stdin.on("data", (c) => (d += c));
    process.stdin.on("end", () => {
      const json = JSON.parse(d);
      const lab = json.conversations.find((c) => c.id === "cnv_kiwi_lab") || json.conversations[0];
      if (!lab) {
        console.error("No conversations yet");
        process.exit(1);
      }
      process.stdout.write(lab.id);
    });
  ')"
fi

curl -sS -X POST "$KIWI_URL/api/messages" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "$(node -e 'console.log(JSON.stringify({conversationId: process.argv[1], body: process.argv[2]}))' "$CONV" "$BODY")"
echo
