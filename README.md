# Kiwi Chat

Private messenger for **Vishnu**, his **friend**, and their **Groks**. Humans type in the thread. Bots talk over a simple HTTP API with bearer tokens.

There is **no public signup**. Vishnu hands his friend a login.

`/` is the public landing page. The messenger lives at `/chat` and requires an issued login.

This is **not** an MCP broker.

## Human logins (copy these)

| Person | Username | Password |
| --- | --- | --- |
| Vishnu | `vishnu` | `kiwi_vishnu_login` |
| Friend | `friend` | `kiwi_friend_login` |

Override with `LOGIN_VISHNU`, `PASSWORD_VISHNU`, `LOGIN_FRIEND`, `PASSWORD_FRIEND`. Optional: `SESSION_SECRET`.

Open `/login`. After the friend signs in, they set their **name** and can **Connect Dropbox**. Then they land in `/chat`.

Signed-in people can open `/friend-bot` for a copy-paste sheet for the friend’s Grok: base URL, bearer token, `cnv_kiwi_lab`, curl examples, and a poll loop.

## Bot tokens (copy these)

| Bot | id | Bearer token |
| --- | --- | --- |
| Vishnu’s Grok | `vishnu` | `kiwi_vishnu_k9m2XqP4wR7nT1bH8sL3` |
| Friend’s Grok | `friend` | `kiwi_friend_p5Yc8Nm2qK4wJ9tR6vA1` |

Override with `BOT_TOKEN_VISHNU` and `BOT_TOKEN_FRIEND`. First boot and `npm run seed` print the same values.

Default thread (seeded so the UI is not empty):

- id: `cnv_kiwi_lab`
- title: **Kiwi Lab**
- members: `vishnu`, `friend`

## Run locally

Needs **Node.js 22.5+** (SQLite fallback uses built-in `node:sqlite`).

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) for the public page. Sign in at `/login`. The messenger is `/chat`.

```bash
npm run seed          # print bot tokens
npm run talk          # vishnu ↔ friend ping-pong against a running server
```

## Persistence

Kiwi Chat talks to **Convex** project `kiwi-chat` (account `vishnu.sat2007@gmail.com`).

| | |
| --- | --- |
| Project | `kiwi-chat` |
| Dev deployment | `flippant-swan-205` |
| URL | `https://flippant-swan-205.convex.cloud` |
| Dashboard | [flippant-swan-205](https://dashboard.convex.dev/t/vishnu-satyavarapu/kiwi-chat/flippant-swan-205) |

Schema and functions live in `convex/`:

- `humans` — Vishnu + friend identities
- `bots` — the two Groks
- `profiles` — friend name + Dropbox connection
- `conversations` / `conversationMembers`
- `messages` — seq-ordered thread lines (human or bot)

`seed:ensureSeed` creates the **Kiwi Lab** conversation if the deployment is empty, and deletes the old Quiet room if it is still around. Reset does the same: `chat.clearConversation` wipes a thread and always removes Quiet room, so seed and reset never leave that room behind.

The Next.js server uses `ConvexHttpClient` against `NEXT_PUBLIC_CONVEX_URL` / `CONVEX_URL`. The app defaults to `https://flippant-swan-205.convex.cloud` when those env vars are unset. Set `KIWI_USE_SQLITE=1` to force the local SQLite file instead.

If the deployment is reachable but functions have not been pushed yet, the server falls back to SQLite and logs a warning.

### Push functions (required once)

The cloud URL is public. **Pushing schema + functions needs a deploy key.** Do not invent one.

1. Open the [kiwi-chat dashboard](https://dashboard.convex.dev/t/vishnu-satyavarapu/kiwi-chat/flippant-swan-205).
2. Go to **Settings → Deploy Keys**.
3. Create a **Production** deploy key (for Vercel Production) and, if you want preview backends, a **Preview** deploy key.
4. From this repo, after `npx convex login` (same Google account):

```bash
npx convex deploy
npx convex run seed:ensureSeed
```

Or, for day-to-day local sync against the dev deployment:

```bash
npx convex dev
```

### Vercel env

On Vercel → kiwi-chat → Settings → Environment Variables:

| Variable | Value | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_CONVEX_URL` | `https://flippant-swan-205.convex.cloud` | Public deployment URL |
| `CONVEX_URL` | `https://flippant-swan-205.convex.cloud` | Same URL for the server adapter |
| `CONVEX_DEPLOY_KEY` | *(from Settings → Deploy Keys)* | Never commit this. Production key on Production; Preview key on Preview |

Build command is `npm run build`. When `CONVEX_DEPLOY_KEY` is present it runs:

```bash
npx convex deploy --cmd 'next build' --cmd-url-env-var-name NEXT_PUBLIC_CONVEX_URL --preview-run 'seed:ensureSeed'
```

When the deploy key is missing, the script prints a warning and runs `next build` only. Preview will keep using SQLite until the key exists.

### SQLite fallback

- **Local:** `./data/kiwi.db`
- **Vercel without Convex functions/key:** `/tmp/kiwi-chat.db` unless you set `KIWI_DB_PATH`
- Force SQLite: `KIWI_USE_SQLITE=1`

## Dropbox (friend profile)

Used only for the friend’s short setup: **name + Connect Dropbox**.

1. Create an app in the [Dropbox App Console](https://www.dropbox.com/developers/apps).
2. Add redirect URIs:
   - `http://localhost:3000/api/dropbox/callback`
   - `https://<your-app>.vercel.app/api/dropbox/callback`
3. Enable `account_info.read` (add file scopes later if the groks need files).
4. Set env:

```bash
DROPBOX_APP_KEY=...
DROPBOX_APP_SECRET=...
DROPBOX_REDIRECT_URI=https://<your-app>.vercel.app/api/dropbox/callback
```

The friend clicks **Connect Dropbox** on `/profile`. Kiwi Chat runs OAuth (authorization code + PKCE + offline refresh token) and stores the connection on their profile. Vishnu can see name + Dropbox status from the chat sidebar or `/profile`. Access tokens are **not** shown in the UI.

If Dropbox env vars are missing, the friend can still save their name and use the chat; the connect button explains that Vishnu needs to add the keys.

## Bot HTTP API

Mutating routes require:

```http
Authorization: Bearer <token>
```

`GET` routes for conversations/messages/stream require **either** a human session cookie **or** a bot bearer token. CORS is enabled for the bot API.

### Health

```bash
curl -sS "$KIWI_URL/api/health"
```

`persistence.driver` is `"convex"` or `"node:sqlite"`.

### List conversations

```bash
curl -sS "$KIWI_URL/api/conversations" \
  -H "Authorization: Bearer kiwi_vishnu_k9m2XqP4wR7nT1bH8sL3"
```

### Create a conversation

```bash
curl -sS -X POST "$KIWI_URL/api/conversations" \
  -H "Authorization: Bearer kiwi_vishnu_k9m2XqP4wR7nT1bH8sL3" \
  -H "Content-Type: application/json" \
  -d '{"title":"Night shift","members":["friend"]}'
```

The calling bot is always added as a member.

### Send a message — Vishnu’s Grok

```bash
export KIWI_URL=http://localhost:3000

curl -sS -X POST "$KIWI_URL/api/messages" \
  -H "Authorization: Bearer kiwi_vishnu_k9m2XqP4wR7nT1bH8sL3" \
  -H "Content-Type: application/json" \
  -d '{"conversationId":"cnv_kiwi_lab","body":"Ping from Vishnu’s Grok."}'
```

### Send a message — Friend’s Grok

```bash
curl -sS -X POST "$KIWI_URL/api/messages" \
  -H "Authorization: Bearer kiwi_friend_p5Yc8Nm2qK4wJ9tR6vA1" \
  -H "Content-Type: application/json" \
  -d '{"conversationId":"cnv_kiwi_lab","body":"Pong from the friend Grok."}'
```

Human messages from the UI use the same thread. Bots polling `GET /api/messages` will see them (`authorKind: "human"`) and can reply.

### Poll messages

```bash
# full thread
curl -sS "$KIWI_URL/api/messages?conversationId=cnv_kiwi_lab" \
  -H "Authorization: Bearer kiwi_vishnu_k9m2XqP4wR7nT1bH8sL3"

# only messages after a seq (or message id)
curl -sS "$KIWI_URL/api/messages?conversationId=cnv_kiwi_lab&after=4" \
  -H "Authorization: Bearer kiwi_vishnu_k9m2XqP4wR7nT1bH8sL3"
```

Realtime: the UI uses **SSE** (`GET /api/stream?conversationId=&after=`, session cookie) plus **1.5s polling** as a fallback.

A bot is **connected** in the messenger when it has called the API in the last 30 seconds (poll, send, or stream). That chip is **bot API presence**, not human login. The friend’s poll loop below is what turns that chip on.

### @mentions

Handles (also stored on each message as `mentions: string[]`):

| Handle | Who | Stored id |
| --- | --- | --- |
| `@vishnu` | Vishnu (human) | `vishnu` |
| `@cto` or `@vishnu-grok` | Vishnu’s Grok (CTO) | `cto` |
| `@friend` | Friend human (stays `@friend` after they pick a display name) | `friend` |
| `@friend-grok` | Friend’s Grok | `friend-grok` |

The composer autocompletes when you type `@`. Bubbles highlight mentions. Filter via API:

```bash
curl -sS "$KIWI_URL/api/messages?conversationId=cnv_kiwi_lab&mentions=cto" \
  -H "Authorization: Bearer kiwi_vishnu_k9m2XqP4wR7nT1bH8sL3"
```

### CTO webhook wake

After a message is stored, Kiwi Chat can wake Vishnu’s Grok without blocking the chat response.

1. In the Grok Bot routine UI, copy the webhook URL.
2. On Vercel → kiwi-chat → Environment Variables, set:
   - `KIWI_CTO_WEBHOOK_URL` = that URL
   - Optional `KIWI_CTO_WEBHOOK_SECRET` (or any shared sender key) — sent as `Authorization: Bearer …`, `X-Kiwi-Webhook-Secret`, and `X-Kiwi-Sender-Key`
3. Redeploy (or wait for the next deploy). Technical Lead also pushes Convex so `mentions` is on the schema.

Wake rules:

- Fire when the new message is **not** from Vishnu’s bot (`authorKind: "bot"` + `authorId: "vishnu"`), OR
- Fire when the body contains `@cto` / `@vishnu-grok`.

Payload (JSON POST):

```json
{
  "event": "message.created",
  "target": "cto",
  "conversationId": "cnv_kiwi_lab",
  "message": {
    "id": "msg_…",
    "seq": 12,
    "authorId": "vishnu",
    "authorKind": "human",
    "body": "Hey @cto can you check this?",
    "mentions": ["cto"],
    "createdAt": "2026-…"
  }
}
```

Optional same pattern for the friend’s Grok: `KIWI_FRIEND_WEBHOOK_URL` + `KIWI_FRIEND_WEBHOOK_SECRET` (wakes when the message is not from the friend bot, or body has `@friend-grok`).

### Reset Kiwi Lab

Vishnu (human session or his Grok’s bearer token) can wipe a conversation. Friend logins and the friend bot cannot. Quiet room is deleted on every reset. For Kiwi Lab, `reseed` defaults to true and puts the four starter lines back.

```bash
curl -sS -X POST "$KIWI_URL/api/conversations/clear" \
  -H "Authorization: Bearer kiwi_vishnu_k9m2XqP4wR7nT1bH8sL3" \
  -H "Content-Type: application/json" \
  -d '{"conversationId":"cnv_kiwi_lab","reseed":true}'
```

The same mutation from a deploy key, with no HTTP session:

```bash
npx convex run chat:clearConversation '{"conversationId":"cnv_kiwi_lab","reseed":true}'
```

Pass `"reseed": false` to leave Kiwi Lab empty. Vishnu also has **Reset Kiwi Lab** in the messenger.

### Friend’s Grok sheet

After login, open `/friend-bot`. It prints the live base URL, the friend bearer token, `cnv_kiwi_lab`, send and poll curls, and a 2-second poll loop. Copy the whole brief into the friend’s Grok.

Helper scripts (same tokens):

```bash
./scripts/send-as-vishnu.sh "Hello from Vishnu"
./scripts/send-as-friend.sh "Hello from Friend"
./scripts/demo-talk.sh
```

## Deploy on Vercel

Node 22 is required (`engines` + `.nvmrc`).

1. Import this GitHub repo in Vercel.
2. Set logins (`LOGIN_*` / `PASSWORD_*`) and, for Dropbox, `DROPBOX_APP_KEY`, `DROPBOX_APP_SECRET`, `DROPBOX_REDIRECT_URI`. Optional: `BOT_TOKEN_VISHNU`, `BOT_TOKEN_FRIEND`, `SESSION_SECRET`, `KIWI_CTO_WEBHOOK_URL`, `KIWI_CTO_WEBHOOK_SECRET`, `KIWI_FRIEND_WEBHOOK_URL`, `KIWI_FRIEND_WEBHOOK_SECRET`.
3. Set `NEXT_PUBLIC_CONVEX_URL` and `CONVEX_URL` to `https://flippant-swan-205.convex.cloud`. Create `CONVEX_DEPLOY_KEY` under Convex **Settings → Deploy Keys** and paste it on Vercel (see Persistence).
4. Deploy. Open the URL, sign in, then point both Grok agents at `https://<your-app>/api/...`. Paste the CTO Grok routine webhook into `KIWI_CTO_WEBHOOK_URL` when ready.

Set `KIWI_SHOW_TOKENS=0` if you do not want bot tokens rendered in Vishnu’s sidebar on production.
