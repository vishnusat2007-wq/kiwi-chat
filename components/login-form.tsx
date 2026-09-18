"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { KiwiMark } from "@/components/kiwi-mark";

export function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const response = await fetch("/api/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = (await response.json()) as {
        message?: string;
        next?: string;
      };
      if (!response.ok) {
        setError(data.message || "Could not sign in.");
        return;
      }
      router.push(data.next || "/");
      router.refresh();
    } catch {
      setError("Could not reach Kiwi Chat. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="kiwi-shell relative flex min-h-[100dvh] items-center justify-center px-4 py-12">
      <div className="kiwi-noise" />
      <div className="kiwi-panel relative w-full max-w-[480px] overflow-hidden rounded-[36px] px-8 pt-10 pb-9 md:px-11 md:pt-12 md:pb-11">
        <span className="kiwi-panel-accent" />
        <div className="flex items-center justify-between gap-3">
          <KiwiMark className="h-[4.25rem] w-[4.25rem]" />
          <span className="rounded-full bg-kiwi px-3 py-1 text-[11px] font-extrabold tracking-[0.18em] text-[#11180f] uppercase">
            Private
          </span>
        </div>
        <h1 className="mt-7 font-display text-[52px] leading-[0.86] text-paper md:text-[58px]">
          Kiwi Chat
        </h1>
        <p className="mt-5 max-w-[22rem] text-[16px] leading-7 text-mist">
          Locked room for Vishnu, his friend, and the groks. Use the login you
          were given. Nothing to create.
        </p>

        <form className="mt-9 space-y-5" onSubmit={onSubmit}>
          <div>
            <label htmlFor="username" className="kiwi-kicker mb-2 block">
              Username
            </label>
            <input
              id="username"
              name="username"
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="kiwi-field"
              placeholder="vishnu or friend"
              required
            />
          </div>
          <div>
            <label htmlFor="password" className="kiwi-kicker mb-2 block">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="kiwi-field"
              placeholder="The password you were sent"
              required
            />
          </div>

          {error ? (
            <p className="rounded-2xl border border-[rgba(255,139,139,0.45)] bg-[rgba(255,139,139,0.12)] px-4 py-3 text-sm font-medium text-[#ffb4b4]">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={pending}
            className="kiwi-btn mt-1 w-full rounded-full px-4 py-4 text-[17px] disabled:opacity-60"
          >
            {pending ? "Entering…" : "Enter the room"}
          </button>
        </form>
      </div>
    </div>
  );
}
