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
  missing:
    "Dropbox isn’t hooked up on the server yet. Ask Vishnu to add the app keys.",
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
    <div className="kiwi-shell relative flex min-h-[100dvh] items-center justify-center px-4 py-12">
      <div className="kiwi-noise" />
      <div className="kiwi-panel relative w-full max-w-[540px] rounded-[32px] p-8 md:p-10">
        <KiwiMark className="h-14 w-14" />
        <p className="mt-5 font-display text-[40px] leading-[0.92] tracking-tight text-paper">
          {isFriend ? "You’re in." : "Friend setup"}
        </p>
        <p className="mt-3 text-[15px] leading-7 text-mist">
          {setup
            ? "Two things, then the chat: your name, and Dropbox."
            : "Name + Dropbox. That’s the whole profile."}
        </p>

        {isFriend ? (
          <form className="mt-8 space-y-6" onSubmit={saveName}>
            <div>
              <label
                htmlFor="friend-name"
                className="mb-2 block text-[12px] font-semibold tracking-[0.18em] text-kiwi uppercase"
              >
                Your name
              </label>
              <input
                id="friend-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="w-full rounded-2xl border border-line bg-bg-0 px-4 py-3.5 text-[16px] text-paper outline-none placeholder:text-mist/60 focus:border-line-strong focus:ring-2 focus:ring-[rgba(198,241,85,0.22)]"
                placeholder="What should we call you?"
                maxLength={40}
                required
              />
            </div>

            <div className="rounded-[24px] border border-line-strong bg-bg-0/80 p-5">
              <p className="text-[12px] font-semibold tracking-[0.18em] text-kiwi uppercase">
                Dropbox
              </p>
              <p className="mt-2 text-[15px] leading-7 text-mist">
                Connect the Dropbox for this project. One click. No extra
                questions.
              </p>
              {connected ? (
                <div className="mt-5 flex flex-col gap-3">
                  <p className="text-[15px] font-medium text-paper">
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
                  className="kiwi-btn mt-5 inline-flex rounded-full px-5 py-2.5 text-sm"
                >
                  Connect Dropbox
                </a>
              ) : (
                <p className="mt-5 rounded-2xl border border-line bg-bg-2 px-4 py-3 text-sm leading-6 text-paper">
                  Dropbox keys aren’t on the server yet. Ask Vishnu to add them,
                  then come back and tap Connect.
                </p>
              )}
            </div>

            {message ? (
              <p className="rounded-2xl border border-line-strong bg-bg-0 px-4 py-3 text-sm text-paper">
                {message}
              </p>
            ) : null}

            <div className="flex flex-wrap items-center gap-4">
              <button
                type="submit"
                disabled={pending}
                className="kiwi-btn rounded-full px-5 py-3 text-[15px] disabled:opacity-60"
              >
                {pending
                  ? "Saving…"
                  : savedName
                    ? "Save name"
                    : "Save and open chat"}
              </button>
              {savedName ? (
                <Link
                  href="/"
                  className="text-[15px] font-medium text-kiwi hover:text-paper"
                >
                  Open chat →
                </Link>
              ) : null}
            </div>
          </form>
        ) : (
          <div className="mt-8 space-y-4">
            <div className="rounded-[24px] border border-line bg-bg-0/80 p-5">
              <p className="text-[12px] font-semibold tracking-[0.18em] text-kiwi uppercase">
                Name
              </p>
              <p className="mt-2 font-display text-3xl text-paper">
                {friendProfile.name || "Not set yet"}
              </p>
            </div>
            <div className="rounded-[24px] border border-line bg-bg-0/80 p-5">
              <p className="text-[12px] font-semibold tracking-[0.18em] text-kiwi uppercase">
                Dropbox
              </p>
              <p className="mt-2 text-[17px] text-paper">
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
              className="kiwi-btn inline-flex rounded-full px-5 py-3 text-[15px]"
            >
              Back to chat
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
