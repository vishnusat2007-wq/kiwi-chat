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
import type { BootstrapPayload, BotPresence, Conversation, Message } from "@/lib/types";

function mergeMessages(current: Message[], incoming: Message[]) {
  if (incoming.length === 0) return current;
  const byId = new Map(current.map((message) => [message.id, message]));
  for (const message of incoming) byId.set(message.id, message);
  return Array.from(byId.values()).sort((a, b) => a.seq - b.seq);
}

function speakerLabel(message: Message) {
  return message.authorKind === "bot" ? message.author.fullName : message.author.name;
}

function BotConnection({
  name,
  connected,
}: {
  name: string;
  connected: boolean;
}) {
  return (
    <span className={`bot-status ${connected ? "is-on" : "is-off"}`}>
      <span
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${
          connected ? "bg-current live-dot" : "bg-current opacity-45"
        }`}
        aria-hidden="true"
      />
      <span className="truncate">{name}</span>
      <span className="shrink-0 tracking-[0.12em] uppercase">
        {connected ? "Connected" : "Not connected"}
      </span>
    </span>
  );
}

function ResetThread({
  confirming,
  pending,
  error,
  onAsk,
  onCancel,
  onConfirm,
}: {
  confirming: boolean;
  pending: boolean;
  error: string | null;
  onAsk: () => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (confirming) {
    return (
      <div className="flex max-w-xs flex-col items-start gap-2">
        <p className="text-[12px] leading-5 text-mist">
          Wipe Kiwi Lab and restore the starter lines. Quiet room is removed
          too.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className="rounded-full bg-kiwi px-3 py-1.5 text-[12px] font-extrabold text-[#11180f] disabled:opacity-60"
          >
            {pending ? "Resetting…" : "Reset"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="rounded-full border border-line px-3 py-1.5 text-[12px] font-bold text-mist hover:text-paper"
          >
            Cancel
          </button>
        </div>
        {error ? <p className="text-[12px] text-[#ff8b8b]">{error}</p> : null}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onAsk}
      className="rounded-full border border-line px-3 py-1.5 text-[12px] font-bold text-mist hover:text-paper"
    >
      Reset Kiwi Lab
    </button>
  );
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
  const [presence, setPresence] = useState<BotPresence[]>(bootstrap.botPresence);
  const [streamKey, setStreamKey] = useState(0);
  const [resetMode, setResetMode] = useState<"idle" | "confirm" | "working">("idle");
  const [resetError, setResetError] = useState<string | null>(null);
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

  const connectedById = useMemo(() => {
    return new Map(presence.map((item) => [item.id, item.connected]));
  }, [presence]);

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
    let cancelled = false;
    async function pullPresence() {
      const response = await fetch("/api/bots/status", {
        cache: "no-store",
        credentials: "include",
      });
      if (goToLoginIfNeeded(response.status) || !response.ok || cancelled) return;
      const data = (await response.json()) as { bots: BotPresence[] };
      setPresence(data.bots);
    }
    void pullPresence();
    const timer = window.setInterval(() => {
      void pullPresence();
    }, 4000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
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
  }, [activeId, goToLoginIfNeeded, refreshConversations, streamKey]);

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
    router.push("/");
    router.refresh();
  }

  async function resetKiwiLab() {
    setResetMode("working");
    setResetError(null);
    try {
      const response = await fetch("/api/conversations/clear", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: bootstrap.seedConversationId,
          reseed: true,
        }),
      });
      if (goToLoginIfNeeded(response.status)) {
        setResetMode("idle");
        return;
      }
      const data = (await response.json()) as {
        message?: string;
        messages?: Message[];
        conversations?: Conversation[];
      };
      if (!response.ok || !data.messages || !data.conversations) {
        setResetError(
          typeof data.message === "string" ? data.message : "Could not reset Kiwi Lab.",
        );
        setResetMode("confirm");
        return;
      }
      messagesRef.current = data.messages;
      setMessages(data.messages);
      setConversations(data.conversations);
      setActiveId(bootstrap.seedConversationId);
      setMobilePane("thread");
      stickToBottom.current = true;
      setStreamKey((value) => value + 1);
      setResetMode("idle");
    } catch {
      setResetError("Could not reset Kiwi Lab.");
      setResetMode("confirm");
    }
  }

  function onComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  }

  return (
    <div className="messenger-shell relative flex h-[100dvh] flex-col overflow-hidden">
      <div className="kiwi-noise" />

      <div className="relative mx-auto flex min-h-0 w-full flex-1 flex-col p-0 lg:p-4">
        <div className="messenger-frame grid min-h-0 flex-1 overflow-hidden md:grid-cols-[320px_1fr] lg:grid-cols-[380px_1fr] lg:rounded-[36px]">
          <aside
            className={`${
              mobilePane === "list" ? "flex" : "hidden md:flex"
            } messenger-rail min-h-0 flex-col overflow-hidden border-r border-line bg-bg-1`}
          >
            <div className="flex shrink-0 items-center gap-3 border-b border-line px-5 pt-6 pb-5">
              <Link href="/" className="shrink-0" aria-label="Kiwi Chat public page">
                <KiwiMark className="h-14 w-14" />
              </Link>
              <div className="min-w-0 flex-1">
                <p className="font-display text-[32px] leading-none text-paper">
                  Kiwi Chat
                </p>
                <p className="mt-1.5 text-[12px] font-extrabold tracking-[0.16em] text-kiwi uppercase">
                  {bootstrap.viewer.name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void logout()}
                className="shrink-0 rounded-full border border-line px-3.5 py-2 text-[12px] font-extrabold tracking-wide text-mist uppercase hover:border-line-strong hover:text-paper"
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
                className="kiwi-field py-3 text-[15px]"
              />
            </div>

            <div className="kiwi-scroll min-h-0 flex-1 overflow-y-auto px-2 pb-3">
              {filtered.length === 0 ? (
                <div className="mx-2 mt-6 rounded-[28px] border border-dashed border-line-strong px-5 py-12 text-center">
                  <p className="font-display text-[34px] leading-none text-paper">
                    Empty lab
                  </p>
                  <p className="mt-3 text-[15px] leading-7 text-mist">
                    A grok opens one with{" "}
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
                          className={`flex w-full items-center gap-3 rounded-[22px] px-3 py-3.5 text-left transition ${
                            selected
                              ? "thread-active"
                              : "hover:bg-bg-2"
                          }`}
                        >
                          <StackedAvatars bots={conversation.members} />
                          <span className="min-w-0 flex-1">
                            <span className="flex items-baseline justify-between gap-2">
                              <span className="truncate text-[16px] font-extrabold text-paper">
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
                                ? `${
                                    conversation.lastMessage.authorKind === "bot"
                                      ? "Grok · "
                                      : ""
                                  }${speakerLabel(conversation.lastMessage)}: ${previewBody(
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

            <div className="kiwi-scroll max-h-[48%] shrink-0 overflow-y-auto border-t border-line px-4 py-4 pb-6">
              <p className="kiwi-kicker mb-3">People & groks</p>
              <div className="space-y-2">
                {bootstrap.bots.map((bot) => {
                  const connected = connectedById.get(bot.id) === true;
                  return (
                    <div key={bot.id} className="flex items-center gap-3">
                      <BotAvatar
                        bot={bot}
                        size="sm"
                        presence={connected ? "on" : "off"}
                      />
                      <div className="min-w-0">
                        <p className="text-[15px] font-bold text-paper">{bot.fullName}</p>
                        <p
                          className={`truncate text-[12px] font-bold ${
                            connected ? "text-kiwi" : "text-mist"
                          }`}
                        >
                          {connected ? "Connected" : "Not connected"}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <Link
                href="/friend-bot"
                className="mt-4 block text-[13px] font-extrabold text-kiwi hover:text-paper"
              >
                Connect friend’s Grok →
              </Link>

              {viewerId === "vishnu" ? (
                <div className="mt-4">
                  <ResetThread
                    confirming={resetMode !== "idle"}
                    pending={resetMode === "working"}
                    error={resetError}
                    onAsk={() => {
                      setResetError(null);
                      setResetMode("confirm");
                    }}
                    onCancel={() => {
                      setResetError(null);
                      setResetMode("idle");
                    }}
                    onConfirm={() => void resetKiwiLab()}
                  />
                </div>
              ) : null}

              <Link
                href="/profile"
                className="mt-5 block rounded-[24px] border border-line-strong bg-bg-0 p-4 hover:bg-bg-2"
              >
                <p className="kiwi-kicker">Friend setup</p>
                <p className="mt-2 font-display text-[26px] leading-none text-paper">
                  {bootstrap.friendProfile.name || "Name not set yet"}
                </p>
                <p className="mt-2 text-[13px] text-mist">
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
                  <p className="mt-3 text-[13px] font-medium text-kiwi">
                    Check their details →
                  </p>
                ) : viewerId === "friend" ? (
                  <p className="mt-3 text-[13px] font-medium text-kiwi">
                    Edit name or Dropbox →
                  </p>
                ) : null}
              </Link>

              {bootstrap.tokens ? (
                <div className="mt-4 rounded-2xl border border-line bg-bg-0/60 p-3">
                  <p className="kiwi-kicker">Bot tokens</p>
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
            } messenger-thread min-h-0 min-w-0 flex-col overflow-hidden`}
          >
            {active ? (
              <>
                <header className="flex shrink-0 items-center gap-3 border-b border-line px-4 py-4 md:px-7">
                  <button
                    type="button"
                    className="rounded-full border border-line px-3 py-1.5 text-sm font-bold text-mist md:hidden"
                    onClick={() => setMobilePane("list")}
                  >
                    Threads
                  </button>
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <StackedAvatars bots={active.members} />
                    <div className="min-w-0">
                      <h1 className="truncate font-display text-[34px] leading-none text-paper md:text-[40px]">
                        {active.title}
                      </h1>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {bootstrap.bots.map((bot) => (
                          <BotConnection
                            key={bot.id}
                            name={bot.fullName}
                            connected={connectedById.get(bot.id) === true}
                          />
                        ))}
                      </div>
                      {viewerId === "vishnu" &&
                      active.id === bootstrap.seedConversationId ? (
                        <div className="mt-2 md:hidden">
                          <ResetThread
                            confirming={resetMode !== "idle"}
                            pending={resetMode === "working"}
                            error={resetError}
                            onAsk={() => {
                              setResetError(null);
                              setResetMode("confirm");
                            }}
                            onCancel={() => {
                              setResetError(null);
                              setResetMode("idle");
                            }}
                            onConfirm={() => void resetKiwiLab()}
                          />
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div
                    className={`flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[12px] font-extrabold tracking-[0.14em] uppercase ${
                      live
                        ? "bg-kiwi text-[#11180f]"
                        : "border border-line bg-bg-1 text-mist"
                    }`}
                  >
                    <span
                      className={`live-dot h-2 w-2 rounded-full ${
                        live ? "bg-[#11180f]" : "bg-mist"
                      }`}
                    />
                    {live ? "Live" : "Reconnect"}
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
                      <div className="kiwi-halo h-24 w-24">
                        <KiwiMark className="relative h-[4.5rem] w-[4.5rem]" />
                      </div>
                      <p className="mt-7 font-display text-[52px] leading-[0.86] text-paper">
                        The room is open.
                      </p>
                      <p className="mt-4 text-[16px] leading-7 text-mist">
                        Type below. The groks answer in this thread when their
                        agents are on.
                      </p>
                    </div>
                  ) : (
                    grouped.map((day) => (
                      <div key={day.key} className="mb-6">
                        <div className="mb-4 flex items-center gap-3">
                          <span className="h-px flex-1 bg-line" />
                          <span className="rounded-full border border-line bg-bg-1 px-3 py-1 text-[11px] font-extrabold tracking-[0.16em] text-mist uppercase">
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
                            const label = speakerLabel(message);
                            const bubble =
                              isRight
                                ? "bubble-right bubble-mine"
                                : message.authorKind === "bot"
                                  ? `bubble-left bubble-bot ${
                                      message.authorId === "friend"
                                        ? "bubble-friend"
                                        : "bubble-vishnu"
                                    }`
                                  : "bubble-left bubble-human";
                            const kindLabel =
                              message.authorKind === "bot"
                                ? "Grok"
                                : isRight
                                  ? "You"
                                  : "Human";
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
                                        className={`mb-1 flex flex-wrap items-baseline gap-2 ${
                                          isRight ? "justify-end" : ""
                                        }`}
                                      >
                                        <span className="text-[13px] font-bold text-paper">
                                          {label}
                                        </span>
                                        <span
                                          className={
                                            message.authorKind === "bot"
                                              ? "kind-pill kind-pill-grok"
                                              : "kind-pill kind-pill-human"
                                          }
                                        >
                                          {kindLabel}
                                        </span>
                                        <span className="text-[11px] text-mist">
                                          {formatClock(message.createdAt)}
                                        </span>
                                      </div>
                                    )}
                                    <div
                                      className={`max-w-full rounded-[26px] px-4 py-3.5 text-[16.5px] leading-6 ${bubble} ${
                                        flashIds.has(message.id)
                                          ? "ring-1 ring-kiwi/60"
                                          : ""
                                      }`}
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

                <footer className="composer-dock shrink-0 border-t border-line px-4 py-4 md:px-7">
                  <form
                    onSubmit={(event) => void sendMessage(event)}
                    className="composer-card rounded-[30px] px-5 py-4"
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
                      placeholder="Ask the groks how the project is going."
                      className="w-full resize-none bg-transparent text-[17px] leading-7 text-paper outline-none placeholder:text-mist/60"
                    />
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <p className="min-w-0 truncate text-[13px] font-medium text-mist">
                        {sendError ?? "Enter to send · Shift+Enter for a new line"}
                      </p>
                      <div className="flex shrink-0 items-center gap-2">
                        <Link
                          href="/friend-bot"
                          className="rounded-full border border-line px-3 py-2 text-[12px] font-bold text-mist hover:text-paper"
                        >
                          Grok setup
                        </Link>
                        <button
                          type="submit"
                          disabled={sending || !draft.trim()}
                          className="kiwi-btn rounded-full px-5 py-2.5 text-[14px] disabled:opacity-50"
                        >
                          {sending ? "Sending…" : "Send"}
                        </button>
                      </div>
                    </div>
                  </form>
                </footer>
              </>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
                <div className="kiwi-halo h-28 w-28">
                  <KiwiMark className="relative h-20 w-20" />
                </div>
                <p className="mt-8 font-display text-[56px] leading-none text-paper">
                  Pick a thread
                </p>
                <p className="mt-4 max-w-sm text-[16px] leading-7 text-mist">
                  Choose Kiwi Lab on the left, or let a grok open one with{" "}
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
