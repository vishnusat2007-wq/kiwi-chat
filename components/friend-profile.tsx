"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { KiwiMark } from "@/components/kiwi-mark";
import type { FriendProfilePublic, Viewer } from "@/lib/types";

const DROPBOX_COPY: Record<string, string> = {
  connected: "Dropbox is connected.",
  denied: "Dropbox permission was declined. You can try again.",
  error: "Dropbox didn’t finish connecting. Try once more.",
  forbidden: "Dropbox connect is for the friend login.",
  missing: "Dropbox isn’t hooked up on the server yet. Ask Vishnu to add the app keys.",
};

export function FriendProfile({
  viewer,
  friendProfile,
  dropboxConfigured,
  setup,
  dropboxStatus,
}: {
  viewer: Viewer;
  friendProfile: FriendProfilePublic;
  dropboxConfigured: boolean;
  setup: boolean;
  dropboxStatus: string | null;
}) {
  const router = useRouter();
  const isFriend = viewer.id === "friend";
  const [name, setName] = useState(friendProfile.name);
  const [savedName, setSavedName] = useState(friendProfile.name);
  const [connected, setConnected] = useState(friendProfile.dropbox.connected);
  const [dropboxEmail, setDropboxEmail] = useState(friendProfile.dropbox.email);
  const [dropboxDisplay, setDropboxDisplay] = useState(
    friendProfile.dropbox.displayName,
  );
  const [message, setMessage] = useState<string | null>(
    dropboxStatus ? DROPBOX_COPY[dropboxStatus] ?? null : null,
  );
  const [pending, setPending] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  async function saveName(event: FormEvent) {
    event.preventDefault();
    if (!isFriend) return;
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch("/api/profile", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = (await response.json()) as {
        message?: string;
        friendProfile?: FriendProfilePublic;
      };
      if (!response.ok) {
        setMessage(data.message || "Could not save your name.");
        return;
      }
      const next = data.friendProfile?.name ?? name.trim();
      setSavedName(next);
      setName(next);
      router.push("/");
      router.refresh();
      return;
    } catch {
      setMessage("Could not save. Try again.");
    } finally {
      setPending(false);
    }
  }

  async function disconnect() {
    setDisconnecting(true);
    setMessage(null);
    try {
      const response = await fetch("/api/dropbox/disconnect", {
        method: "POST",
        credentials: "include",
      });
      const data = (await response.json()) as {
        friendProfile?: FriendProfilePublic;
        message?: string;
      };
      if (!response.ok) {
        setMessage(data.message || "Could not disconnect Dropbox.");
        return;
      }
      setConnected(false);
      setDropboxEmail(null);
      setDropboxDisplay(null);
      setMessage("Dropbox disconnected.");
    } catch {
      setMessage("Could not disconnect Dropbox.");
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <div className="kiwi-shell relative flex min-h-[100dvh] items-center justify-center px-4 py-10">
      <div className="kiwi-noise" />
      <div className="relative w-full max-w-[520px] rounded-[28px] border border-line bg-bg-1/85 p-7 shadow-[0_30px_120px_rgba(0,0,0,0.45)] backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <KiwiMark className="h-12 w-12" />
          <div>
            <p className="font-display text-[28px] leading-none tracking-tight text-paper">
              {isFriend ? "Your setup" : "Friend setup"}
            </p>
            <p className="mt-1.5 text-[13px] text-mist">
              {setup
                ? "Two quick things, then you’re in the chat."
                : "Name + Dropbox. That’s all."}
            </p>
          </div>
        </div>

        {isFriend ? (
          <form className="mt-7 space-y-6" onSubmit={saveName}>
            <div>
              <label
                htmlFor="friend-name"
                className="mb-1.5 block text-[12px] font-medium tracking-[0.14em] text-mist uppercase"
              >
                Your name
              </label>
              <input
                id="friend-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="w-full rounded-2xl border border-line bg-bg-0/70 px-4 py-3 text-sm text-paper outline-none placeholder:text-mist/70 focus:border-line-strong focus:ring-2 focus:ring-[rgba(198,241,85,0.18)]"
                placeholder="What should Vishnu call you?"
                maxLength={40}
                required
              />
            </div>

            <div className="rounded-3xl border border-line bg-bg-0/50 p-4">
              <p className="text-[12px] font-medium tracking-[0.14em] text-mist uppercase">
                Dropbox
              </p>
              <p className="mt-2 text-sm leading-6 text-mist">
                Connect the Dropbox you use for this project. One click — no extra
                questions.
              </p>
              {connected ? (
                <div className="mt-4 flex flex-col gap-3">
                  <p className="text-sm text-paper">
                    Connected
                    {dropboxDisplay ? ` as ${dropboxDisplay}` : ""}
                    {dropboxEmail ? ` · ${dropboxEmail}` : ""}
                  </p>
                  <button
                    type="button"
                    onClick={() => void disconnect()}
                    disabled={disconnecting}
                    className="self-start rounded-full border border-line px-4 py-2 text-sm text-mist hover:text-paper disabled:opacity-60"
                  >
                    {disconnecting ? "Disconnecting…" : "Disconnect"}
                  </button>
                </div>
              ) : dropboxConfigured ? (
                <a
                  href="/api/dropbox/start"
                  className="mt-4 inline-flex rounded-full bg-kiwi px-4 py-2 text-sm font-semibold text-[#11180f] hover:bg-[#d4f56f]"
                >
                  Connect Dropbox
                </a>
              ) : (
                <p className="mt-4 text-sm leading-6 text-mist">
                  Dropbox isn’t hooked up on the server yet. Ask Vishnu to add
                  the Dropbox app keys, then come back here.
                </p>
              )}
            </div>

            {message ? (
              <p className="rounded-2xl border border-line bg-bg-0/70 px-3 py-2 text-sm text-paper">
                {message}
              </p>
            ) : null}

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={pending}
                className="rounded-full bg-kiwi px-4 py-2.5 text-sm font-semibold text-[#11180f] hover:bg-[#d4f56f] disabled:opacity-60"
              >
                {pending
                  ? "Saving…"
                  : savedName
                    ? "Save name"
                    : "Save and go to chat"}
              </button>
              {savedName ? (
                <Link href="/" className="text-sm text-mist hover:text-paper">
                  Go to chat
                </Link>
              ) : null}
            </div>
          </form>
        ) : (
          <div className="mt-7 space-y-4">
            <div className="rounded-3xl border border-line bg-bg-0/50 p-4">
              <p className="text-[12px] font-medium tracking-[0.14em] text-mist uppercase">
                Name
              </p>
              <p className="mt-2 text-sm text-paper">
                {friendProfile.name || "Not set yet"}
              </p>
            </div>
            <div className="rounded-3xl border border-line bg-bg-0/50 p-4">
              <p className="text-[12px] font-medium tracking-[0.14em] text-mist uppercase">
                Dropbox
              </p>
              <p className="mt-2 text-sm text-paper">
                {friendProfile.dropbox.connected
                  ? [
                      friendProfile.dropbox.displayName,
                      friendProfile.dropbox.email,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "Connected"
                  : "Not connected yet"}
              </p>
            </div>
            <Link
              href="/"
              className="inline-flex rounded-full bg-kiwi px-4 py-2.5 text-sm font-semibold text-[#11180f] hover:bg-[#d4f56f]"
            >
              Back to chat
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
