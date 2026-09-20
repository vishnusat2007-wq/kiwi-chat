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

Kiwi Chat prefers **Convex** when a deployment URL is set. If those env vars are missing, it falls back to **SQLite** so local/dev still works.

### Convex (production)

Schema and functions live in `convex/`:

- `humans` — Vishnu + friend identities
- `bots` — the two Groks
- `profiles` — friend name + Dropbox connection
- `conversations` / `conversationMembers`
- `messages` — seq-ordered thread lines (human or bot)

`seed:ensureSeed` creates the **Kiwi Lab** conversation if the deployment is empty, and deletes the old Quiet room if it is still around.

1. Create a Convex project at [dashboard.convex.dev](https://dashboard.convex.dev) (Google account `vishnuthebestone@gmail.com`).
2. From this repo:

```bash
npx convex dev
```

That writes `.env.local` with `CONVEX_DEPLOYMENT` and `NEXT_PUBLIC_CONVEX_URL`. Leave those files local — do not commit real keys.

3. On Vercel → Project → Settings → Environment Variables, set placeholders first, then paste the real values after the project exists:

| Variable | Where it comes from | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_CONVEX_URL` | Convex deployment URL, like `https://<name>.convex.cloud` | Required for the Next.js server adapter |
| `CONVEX_URL` | Same URL | Optional alias; used if `NEXT_PUBLIC_CONVEX_URL` is unset |
| `CONVEX_DEPLOY_KEY` | Convex dashboard → Deployment Settings → Generate Production Deploy Key | Production only, or a Preview deploy key on Preview |
| `CONVEX_DEPLOYMENT` | Written by `npx convex dev` | Local only |

4. Build command is `npm run build`. If `CONVEX_DEPLOY_KEY` is present, that script runs:

```bash
npx convex deploy --cmd 'next build' --preview-run 'seed:ensureSeed'
```

If the deploy key is missing, it runs `next build` and uses SQLite fallback.

Do **not** invent Convex credentials in the repo. The CTO injects the real project URL and deploy key after the project is created.

### SQLite fallback (local / missing Convex env)

- **Local:** `./data/kiwi.db`
- **Vercel without Convex:** `/tmp/kiwi-chat.db` unless you set `KIWI_DB_PATH`
- Override path with `KIWI_DB_PATH`

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

Helper scripts (same tokens):

```bash
./scripts/send-as-vishnu.sh "Hello from Vishnu"
./scripts/send-as-friend.sh "Hello from Friend"
./scripts/demo-talk.sh
```

## Deploy on Vercel

Node 22 is required (`engines` + `.nvmrc`).

1. Import this GitHub repo in Vercel.
2. Set logins (`LOGIN_*` / `PASSWORD_*`) and, for Dropbox, `DROPBOX_APP_KEY`, `DROPBOX_APP_SECRET`, `DROPBOX_REDIRECT_URI`. Optional: `BOT_TOKEN_VISHNU`, `BOT_TOKEN_FRIEND`, `SESSION_SECRET`.
3. After the Convex project exists, set `NEXT_PUBLIC_CONVEX_URL` and `CONVEX_DEPLOY_KEY` (see Persistence).
4. Deploy. Open the URL, sign in, then point both Grok agents at `https://<your-app>/api/...`.

Set `KIWI_SHOW_TOKENS=0` if you do not want bot tokens rendered in Vishnu’s sidebar on production.
