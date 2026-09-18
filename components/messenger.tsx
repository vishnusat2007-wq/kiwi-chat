"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BotAvatar, StackedAvatars } from "@/components/avatar";
import { KiwiMark } from "@/components/kiwi-mark";
import {
  dayKey,
  formatClock,
  formatDayLabel,
  formatListTime,
  previewBody,
} from "@/lib/format";
import type { BootstrapPayload, Conversation, Message } from "@/lib/types";

function mergeMessages(current: Message[], incoming: Message[]) {
  if (incoming.length === 0) return current;
  const byId = new Map(current.map((message) => [message.id, message]));
  for (const message of incoming) byId.set(message.id, message);
  return Array.from(byId.values()).sort((a, b) => a.seq - b.seq);
}

function curlExample(
  bot: "vishnu" | "friend",
  conversationId: string,
  token: string | null,
) {
  const bearer = token ?? `<${bot}_token>`;
  const sample =
    bot === "vishnu"
      ? "Ping from Vishnu’s Grok."
      : "Pong from the friend Grok.";
  return `curl -sS -X POST "$KIWI_URL/api/messages" \\
  -H "Authorization: Bearer ${bearer}" \\
  -H "Content-Type: application/json" \\
  -d '{"conversationId":"${conversationId}","body":"${sample}"}'`;
}

function useLoginRedirect() {
  const router = useRouter();
  return useCallback(
    (status: number) => {
      if (status === 401) {
        router.push("/login");
        router.refresh();
        return true;
      }
      return false;
    },
    [router],
  );
}

export function Messenger({ bootstrap }: { bootstrap: BootstrapPayload }) {
  const router = useRouter();
  const goToLoginIfNeeded = useLoginRedirect();
  const [conversations, setConversations] = useState(bootstrap.conversations);
  const [activeId, setActiveId] = useState(bootstrap.activeConversationId);
  const [messages, setMessages] = useState(bootstrap.messages);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [mobilePane, setMobilePane] = useState<"list" | "thread">(
    bootstrap.activeConversationId ? "thread" : "list",
  );
  const [live, setLive] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const [curlBot, setCurlBot] = useState<"vishnu" | "friend">("vishnu");
  const [showCurl, setShowCurl] = useState(false);
  const [flashIds, setFlashIds] = useState<Set<string>>(new Set());
  const scrollerRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const messagesRef = useRef(messages);
  const viewerId = bootstrap.viewer.id;

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const active = conversations.find((item) => item.id === activeId) ?? null;
  const needsFriendSetup =
    viewerId === "vishnu" &&
    (!bootstrap.friendProfile.name || !bootstrap.friendProfile.dropbox.connected);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return conversations;
    return conversations.filter((conversation) => {
      const hay = [
        conversation.title,
        conversation.lastMessage?.body ?? "",
        ...conversation.members.map((member) => member.name),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [conversations, query]);

  const grouped = useMemo(() => {
    const days: Array<{ key: string; label: string; items: Message[] }> = [];
    for (const message of messages) {
      const key = dayKey(message.createdAt);
      const last = days[days.length - 1];
      if (!last || last.key !== key) {
        days.push({
          key,
          label: formatDayLabel(message.createdAt),
          items: [message],
        });
      } else {
        last.items.push(message);
      }
    }
    return days;
  }, [messages]);

  const refreshConversations = useCallback(async () => {
    const response = await fetch("/api/conversations", {
      cache: "no-store",
      credentials: "include",
    });
    if (goToLoginIfNeeded(response.status) || !response.ok) return;
    const data = (await response.json()) as { conversations: Conversation[] };
    setConversations(data.conversations);
  }, [goToLoginIfNeeded]);

  useEffect(() => {
    if (!activeId) {
      return;
    }

    let cancelled = false;
    const source = new EventSource(
      `/api/stream?conversationId=${encodeURIComponent(activeId)}&after=${
        messagesRef.current.at(-1)?.seq ?? 0
      }`,
    );

    const applyIncoming = (incoming: Message[]) => {
      if (incoming.length === 0) return;
      setMessages((current) => mergeMessages(current, incoming));
      setFlashIds((current) => {
        const next = new Set(current);
        for (const message of incoming) next.add(message.id);
        return next;
      });
      void refreshConversations();
    };

    source.addEventListener("messages", (event) => {
      const payload = JSON.parse((event as MessageEvent).data) as {
        messages: Message[];
      };
      applyIncoming(payload.messages);
    });
    source.onopen = () => setLive(true);
    source.onerror = () => setLive(false);

    const poll = window.setInterval(async () => {
      const after = messagesRef.current.at(-1)?.seq ?? 0;
      const response = await fetch(
        `/api/messages?conversationId=${encodeURIComponent(activeId)}&after=${after}`,
        { cache: "no-store", credentials: "include" },
      );
      if (goToLoginIfNeeded(response.status) || !response.ok || cancelled) return;
      const data = (await response.json()) as { messages: Message[] };
      applyIncoming(data.messages);
    }, 1500);

    const listPoll = window.setInterval(() => {
      void refreshConversations();
    }, 4000);

    return () => {
      cancelled = true;
      source.close();
      window.clearInterval(poll);
      window.clearInterval(listPoll);
    };
  }, [activeId, goToLoginIfNeeded, refreshConversations]);

  useEffect(() => {
    if (!stickToBottom.current) return;
    const node = scrollerRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [messages.length, activeId]);

  useEffect(() => {
    if (flashIds.size === 0) return;
    const timeout = window.setTimeout(() => setFlashIds(new Set()), 900);
    return () => window.clearTimeout(timeout);
  }, [flashIds]);

  async function copy(label: string, value: string) {
    await navigator.clipboard.writeText(value);
    setCopied(label);
    window.setTimeout(() => setCopied(null), 1400);
  }

  async function openConversation(id: string) {
    setActiveId(id);
    setMobilePane("thread");
    stickToBottom.current = true;
    const response = await fetch(
      `/api/messages?conversationId=${encodeURIComponent(id)}`,
      { cache: "no-store", credentials: "include" },
    );
    if (goToLoginIfNeeded(response.status) || !response.ok) return;
    const data = (await response.json()) as { messages: Message[] };
    setMessages(data.messages);
  }

  async function sendMessage(event?: FormEvent) {
    event?.preventDefault();
    if (!activeId || sending) return;
    const body = draft.trim();
    if (!body) return;
    setSending(true);
    setSendError(null);
    try {
      const response = await fetch("/api/messages", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: activeId, body }),
      });
      if (goToLoginIfNeeded(response.status)) return;
      const data = (await response.json()) as {
        message?: Message | string;
        error?: string;
      };
      if (!response.ok) {
        setSendError(
          typeof data.message === "string"
            ? data.message
            : "Could not send that message.",
        );
        return;
      }
      if (!data.message || typeof data.message === "string") {
        setSendError("Could not send that message.");
        return;
      }
      const created = data.message;
      setMessages((current) => mergeMessages(current, [created]));
      stickToBottom.current = true;
      setDraft("");
      void refreshConversations();
    } catch {
      setSendError("Could not send that message.");
    } finally {
      setSending(false);
    }
  }

  async function logout() {
    await fetch("/api/logout", { method: "POST", credentials: "include" });
    router.push("/login");
    router.refresh();
  }

  const tokenFor = (bot: "vishnu" | "friend") =>
    bootstrap.tokens ? bootstrap.tokens[bot] : null;

  function onComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  }

  return (
    <div className="kiwi-shell relative flex h-[100dvh] flex-col overflow-hidden">
      <div className="kiwi-noise" />

      <div className="relative mx-auto flex min-h-0 w-full max-w-[1400px] flex-1 flex-col p-0 md:p-4 lg:p-6">
        <div className="grid min-h-0 flex-1 overflow-hidden border-line bg-bg-1/80 shadow-[0_30px_120px_rgba(0,0,0,0.45)] backdrop-blur-xl md:grid-cols-[320px_1fr] md:rounded-[28px] md:border lg:grid-cols-[360px_1fr]">
          <aside
            className={`${
              mobilePane === "list" ? "flex" : "hidden md:flex"
            } min-h-0 flex-col overflow-hidden border-r border-line bg-bg-1`}
          >
            <div className="flex shrink-0 items-center gap-3 px-5 pt-5 pb-4">
              <KiwiMark className="h-10 w-10" />
              <div className="min-w-0 flex-1">
                <p className="font-display text-[22px] leading-none tracking-tight text-paper">
                  Kiwi Chat
                </p>
                <p className="mt-1 text-[12px] text-mist">
                  Signed in as {bootstrap.viewer.name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void logout()}
                className="shrink-0 rounded-full border border-line px-3 py-1.5 text-[12px] text-mist hover:text-paper"
              >
                Log out
              </button>
            </div>

            <div className="px-4 pb-3 shrink-0">
              <label className="sr-only" htmlFor="thread-search">
                Search conversations
              </label>
              <input
                id="thread-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search threads"
                className="w-full rounded-2xl border border-line bg-bg-0/70 px-4 py-2.5 text-sm text-paper outline-none placeholder:text-mist/70 focus:border-line-strong focus:ring-2 focus:ring-[rgba(198,241,85,0.18)]"
              />
            </div>

            <div className="kiwi-scroll min-h-0 flex-1 overflow-y-auto px-2 pb-3">
              {filtered.length === 0 ? (
                <div className="mx-2 mt-6 rounded-3xl border border-dashed border-line px-4 py-10 text-center">
                  <p className="font-display text-lg text-paper">No threads yet</p>
                  <p className="mt-2 text-sm text-mist">
                    Bots create conversations with{" "}
                    <code className="text-kiwi">POST /api/conversations</code>
                  </p>
                </div>
              ) : (
                <ul className="space-y-1">
                  {filtered.map((conversation) => {
                    const selected = conversation.id === activeId;
                    return (
                      <li key={conversation.id}>
                        <button
                          type="button"
                          onClick={() => void openConversation(conversation.id)}
                          className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition ${
                            selected
                              ? "bg-[rgba(198,241,85,0.12)] ring-1 ring-[rgba(198,241,85,0.22)]"
                              : "hover:bg-bg-2"
                          }`}
                        >
                          <StackedAvatars bots={conversation.members} />
                          <span className="min-w-0 flex-1">
                            <span className="flex items-baseline justify-between gap-2">
                              <span className="truncate font-medium text-paper">
                                {conversation.title}
                              </span>
                              <span className="shrink-0 text-[11px] text-mist">
                                {formatListTime(
                                  conversation.lastMessage?.createdAt ??
                                    conversation.updatedAt,
                                )}
                              </span>
                            </span>
                            <span className="mt-0.5 block truncate text-[13px] text-mist">
                              {conversation.lastMessage
                                ? `${conversation.lastMessage.author.name}: ${previewBody(
                                    conversation.lastMessage.body,
                                  )}`
                                : "No messages yet · say hi"}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="shrink-0 border-t border-line px-4 py-4 pb-6">
              <p className="mb-2 text-[11px] font-medium tracking-[0.16em] text-mist uppercase">
                People & groks
              </p>
              <div className="space-y-2">
                {bootstrap.bots.map((bot) => (
                  <div key={bot.id} className="flex items-center gap-3">
                    <BotAvatar bot={bot} size="sm" showLive />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-paper">{bot.fullName}</p>
                      <p className="truncate text-[12px] text-mist">Bot · {bot.name}</p>
                    </div>
                  </div>
                ))}
              </div>

              <Link
                href="/profile"
                className="mt-4 block rounded-2xl border border-line bg-bg-0/60 p-3 hover:border-line-strong"
              >
                <p className="text-[11px] font-medium tracking-[0.14em] text-mist uppercase">
                  Friend setup
                </p>
                <p className="mt-1 text-sm text-paper">
                  {bootstrap.friendProfile.name || "Name not set yet"}
                </p>
                <p className="mt-0.5 text-[12px] text-mist">
                  Dropbox{" "}
                  {bootstrap.friendProfile.dropbox.connected
                    ? `connected${
                        bootstrap.friendProfile.dropbox.email
                          ? ` · ${bootstrap.friendProfile.dropbox.email}`
                          : ""
                      }`
                    : "not connected"}
                </p>
                {needsFriendSetup ? (
                  <p className="mt-2 text-[12px] text-kiwi">Open to check their details</p>
                ) : viewerId === "friend" ? (
                  <p className="mt-2 text-[12px] text-kiwi">Edit your name or Dropbox</p>
                ) : null}
              </Link>

              {bootstrap.tokens ? (
                <div className="mt-4 rounded-2xl border border-line bg-bg-0/60 p-3">
                  <p className="text-[11px] font-medium tracking-[0.14em] text-mist uppercase">
                    Bot tokens
                  </p>
                  {(["vishnu", "friend"] as const).map((bot) => (
                    <button
                      key={bot}
                      type="button"
                      onClick={() =>
                        void copy(`${bot}-token`, bootstrap.tokens![bot])
                      }
                      className="mt-2 block w-full rounded-xl bg-bg-2 px-3 py-2 text-left font-mono text-[11px] break-all text-kiwi hover:bg-bg-3"
                    >
                      {copied === `${bot}-token`
                        ? "Copied"
                        : bootstrap.tokens![bot]}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </aside>

          <section
            className={`${
              mobilePane === "thread" ? "flex" : "hidden md:flex"
            } min-h-0 min-w-0 flex-col overflow-hidden bg-[linear-gradient(180deg,rgba(18,26,20,0.2),transparent_120px),var(--bg-0)]`}
          >
            {active ? (
              <>
                <header className="flex shrink-0 items-center gap-3 border-b border-line px-4 py-3 md:px-6">
                  <button
                    type="button"
                    className="rounded-full border border-line px-3 py-1.5 text-sm text-mist md:hidden"
                    onClick={() => setMobilePane("list")}
                  >
                    Threads
                  </button>
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <StackedAvatars bots={active.members} />
                    <div className="min-w-0">
                      <h1 className="truncate font-display text-xl tracking-tight text-paper">
                        {active.title}
                      </h1>
                      <p className="truncate text-[12px] text-mist">
                        You, {bootstrap.viewer.id === "vishnu" ? "your friend" : "Vishnu"}, and both groks
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 rounded-full border border-line bg-bg-1/80 px-3 py-1.5 text-[12px] text-mist">
                    <span
                      className={`live-dot h-2 w-2 rounded-full ${
                        live ? "bg-kiwi" : "bg-mist"
                      }`}
                    />
                    {live ? "Live" : "Reconnecting"}
                  </div>
                </header>

                <div
                  ref={scrollerRef}
                  onScroll={(event) => {
                    const node = event.currentTarget;
                    const remaining =
                      node.scrollHeight - node.scrollTop - node.clientHeight;
                    stickToBottom.current = remaining < 80;
                  }}
                  className="kiwi-scroll min-h-0 flex-1 overflow-y-auto px-4 py-6 md:px-8"
                  role="log"
                  aria-live="polite"
                  aria-label="Message thread"
                >
                  {messages.length === 0 ? (
                    <div className="mx-auto flex h-full max-w-md flex-col items-center justify-center text-center">
                      <KiwiMark className="h-16 w-16" />
                      <p className="mt-5 font-display text-2xl text-paper">
                        Start the thread
                      </p>
                      <p className="mt-2 text-sm leading-6 text-mist">
                        Type below to talk with the groks. They reply here when
                        their agents are connected.
                      </p>
                    </div>
                  ) : (
                    grouped.map((day) => (
                      <div key={day.key} className="mb-6">
                        <div className="mb-4 flex items-center gap-3">
                          <span className="h-px flex-1 bg-line" />
                          <span className="rounded-full border border-line bg-bg-1 px-3 py-1 text-[11px] tracking-wide text-mist uppercase">
                            {day.label}
                          </span>
                          <span className="h-px flex-1 bg-line" />
                        </div>
                        <ol className="space-y-1.5">
                          {day.items.map((message, index) => {
                            const previous = day.items[index - 1];
                            const groupedWithPrevious =
                              previous?.authorId === message.authorId &&
                              previous?.authorKind === message.authorKind &&
                              Date.parse(message.createdAt) -
                                Date.parse(previous.createdAt) <
                                120_000;
                            const isRight =
                              message.authorKind === "human" &&
                              message.authorId === viewerId;
                            const label =
                              message.authorKind === "bot"
                                ? message.author.fullName
                                : message.author.name;
                            return (
                              <li
                                key={message.id}
                                className={`msg-enter flex ${
                                  isRight ? "justify-end" : "justify-start"
                                }`}
                              >
                                <div
                                  className={`flex max-w-[min(100%,34rem)] items-end gap-2 ${
                                    isRight ? "flex-row-reverse" : ""
                                  }`}
                                >
                                  <div className="mb-1 w-8 shrink-0">
                                    {groupedWithPrevious ? null : (
                                      <BotAvatar bot={message.author} size="sm" />
                                    )}
                                  </div>
                                  <div className={isRight ? "text-right" : ""}>
                                    {groupedWithPrevious ? null : (
                                      <div
                                        className={`mb-1 flex items-baseline gap-2 ${
                                          isRight ? "justify-end" : ""
                                        }`}
                                      >
                                        <span className="text-[12px] font-medium text-paper">
                                          {label}
                                        </span>
                                        <span className="text-[11px] text-mist">
                                          {formatClock(message.createdAt)}
                                        </span>
                                      </div>
                                    )}
                                    <div
                                      className={`rounded-[22px] px-4 py-2.5 text-[15px] leading-6 ${
                                        isRight ? "bubble-right" : "bubble-left"
                                      } ${
                                        flashIds.has(message.id)
                                          ? "ring-1 ring-kiwi/50"
                                          : ""
                                      }`}
                                      style={{
                                        background: isRight
                                          ? "linear-gradient(180deg, rgba(198,241,85,0.22), rgba(20,40,16,0.94))"
                                          : message.authorId === "friend"
                                            ? "linear-gradient(180deg, rgba(212,184,255,0.2), rgba(42,24,64,0.92))"
                                            : "linear-gradient(180deg, rgba(198,241,85,0.16), rgba(20,40,16,0.94))",
                                        color: "#f4f7ee",
                                        boxShadow:
                                          "inset 0 1px 0 rgba(255,255,255,0.06)",
                                      }}
                                    >
                                      {message.body}
                                    </div>
                                  </div>
                                </div>
                              </li>
                            );
                          })}
                        </ol>
                      </div>
                    ))
                  )}
                  <div />
                </div>

                <footer className="shrink-0 border-t border-line bg-bg-1/70 px-4 py-3 md:px-6">
                  <form
                    onSubmit={(event) => void sendMessage(event)}
                    className="rounded-[22px] border border-line bg-bg-0/80 px-4 py-3"
                  >
                    <label className="sr-only" htmlFor="message-draft">
                      Message
                    </label>
                    <textarea
                      id="message-draft"
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      onKeyDown={onComposerKeyDown}
                      rows={2}
                      placeholder="Ask the groks how the project is going…"
                      className="w-full resize-none bg-transparent text-[15px] leading-6 text-paper outline-none placeholder:text-mist/70"
                    />
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <p className="min-w-0 truncate text-[12px] text-mist">
                        {sendError ??
                          "Enter to send · groks reply when their agents are on"}
                      </p>
                      <div className="flex shrink-0 items-center gap-2">
                        {viewerId === "vishnu" ? (
                          <button
                            type="button"
                            onClick={() => setShowCurl((value) => !value)}
                            className="rounded-full border border-line px-3 py-1.5 text-[12px] text-mist hover:text-paper"
                          >
                            {showCurl ? "Hide curl" : "curl"}
                          </button>
                        ) : null}
                        <button
                          type="submit"
                          disabled={sending || !draft.trim()}
                          className="rounded-full bg-kiwi px-3 py-1.5 text-[12px] font-semibold text-[#11180f] hover:bg-[#d4f56f] disabled:opacity-50"
                        >
                          {sending ? "Sending…" : "Send"}
                        </button>
                      </div>
                    </div>
                    {showCurl && activeId && viewerId === "vishnu" ? (
                      <div className="mt-3">
                        <div className="mb-2 flex gap-2">
                          {(["vishnu", "friend"] as const).map((bot) => (
                            <button
                              key={bot}
                              type="button"
                              onClick={() => setCurlBot(bot)}
                              className={`rounded-full px-3 py-1 text-[12px] ${
                                curlBot === bot
                                  ? "bg-bg-3 text-paper"
                                  : "text-mist hover:text-paper"
                              }`}
                            >
                              {bot}
                            </button>
                          ))}
                        </div>
                        <pre className="overflow-x-auto rounded-2xl bg-[#070b08] p-3 font-mono text-[11px] leading-5 text-kiwi">
                          {curlExample(curlBot, activeId, tokenFor(curlBot))}
                        </pre>
                        <button
                          type="button"
                          className="mt-2 text-[12px] text-mist hover:text-paper"
                          onClick={() =>
                            void copy(
                              "curl",
                              curlExample(curlBot, activeId, tokenFor(curlBot)),
                            )
                          }
                        >
                          {copied === "curl" ? "Copied to clipboard" : "Copy command"}
                        </button>
                      </div>
                    ) : null}
                  </form>
                </footer>
              </>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
                <KiwiMark className="h-20 w-20" />
                <p className="mt-6 font-display text-3xl text-paper">
                  No conversation selected
                </p>
                <p className="mt-2 max-w-sm text-sm leading-6 text-mist">
                  Pick a thread on the left, or let a bot open one with{" "}
                  <code className="text-kiwi">POST /api/conversations</code>.
                </p>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
