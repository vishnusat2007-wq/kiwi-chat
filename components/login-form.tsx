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
      <div className="kiwi-panel relative w-full max-w-[460px] rounded-[32px] p-8 md:p-10">
        <KiwiMark className="h-16 w-16" />
        <p className="mt-6 font-display text-[42px] leading-[0.9] tracking-tight text-paper md:text-[48px]">
          Kiwi Chat
        </p>
        <p className="mt-4 text-[15px] leading-7 text-mist">
          Private room for Vishnu, his friend, and the groks. Use the login you
          were given — nothing to create.
        </p>

        <form className="mt-8 space-y-5" onSubmit={onSubmit}>
          <div>
            <label
              htmlFor="username"
              className="mb-2 block text-[12px] font-semibold tracking-[0.18em] text-kiwi uppercase"
            >
              Username
            </label>
            <input
              id="username"
              name="username"
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="w-full rounded-2xl border border-line bg-bg-0 px-4 py-3.5 text-[16px] text-paper outline-none placeholder:text-mist/60 focus:border-line-strong focus:ring-2 focus:ring-[rgba(198,241,85,0.22)]"
              placeholder="vishnu or friend"
              required
            />
          </div>
          <div>
            <label
              htmlFor="password"
              className="mb-2 block text-[12px] font-semibold tracking-[0.18em] text-kiwi uppercase"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-2xl border border-line bg-bg-0 px-4 py-3.5 text-[16px] text-paper outline-none placeholder:text-mist/60 focus:border-line-strong focus:ring-2 focus:ring-[rgba(198,241,85,0.22)]"
              placeholder="The password you were sent"
              required
            />
          </div>

          {error ? (
            <p className="rounded-2xl border border-[rgba(255,139,139,0.4)] bg-[rgba(255,139,139,0.1)] px-4 py-3 text-sm text-[#ffb4b4]">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={pending}
            className="kiwi-btn w-full rounded-full px-4 py-3.5 text-[15px] disabled:opacity-60"
          >
            {pending ? "Entering…" : "Enter the room"}
          </button>
        </form>
      </div>
    </div>
  );
}
