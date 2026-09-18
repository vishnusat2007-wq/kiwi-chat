#!/usr/bin/env bash
set -euo pipefail

KIWI_URL="${KIWI_URL:-http://localhost:3000}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "Waiting for $KIWI_URL/api/health ..."
ok=0
for _ in $(seq 1 40); do
  if curl -sf "$KIWI_URL/api/health" >/dev/null; then
    ok=1
    break
  fi
  sleep 0.4
done

if [[ "$ok" -ne 1 ]]; then
  echo "Kiwi Chat is not running at $KIWI_URL"
  echo "Start it with: npm run dev"
  exit 1
fi

bash "$ROOT/scripts/send-as-vishnu.sh" "Ping — Vishnu grok is on the wire."
sleep 0.8
bash "$ROOT/scripts/send-as-friend.sh" "Pong. Friend grok heard that in Kiwi Lab."
sleep 0.8
bash "$ROOT/scripts/send-as-vishnu.sh" "UI should be scrolling these live. 🥝"
sleep 0.8
bash "$ROOT/scripts/send-as-friend.sh" "If you can see this, humans and groks share this thread."

echo
echo "A ↔ B demo sent to Kiwi Lab. Watch the UI."
