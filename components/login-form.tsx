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
    <div className="kiwi-shell relative flex min-h-[100dvh] items-center justify-center px-4 py-10">
      <div className="kiwi-noise" />
      <div className="relative w-full max-w-[420px] rounded-[28px] border border-line bg-bg-1/85 p-7 shadow-[0_30px_120px_rgba(0,0,0,0.45)] backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <KiwiMark className="h-12 w-12" />
          <div>
            <p className="font-display text-[28px] leading-none tracking-tight text-paper">
              Kiwi Chat
            </p>
            <p className="mt-1.5 text-[13px] text-mist">Private room · Vishnu & friend</p>
          </div>
        </div>

        <p className="mt-6 text-sm leading-6 text-mist">
          This isn’t an open signup. Use the login Vishnu already gave you.
        </p>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div>
            <label
              htmlFor="username"
              className="mb-1.5 block text-[12px] font-medium tracking-[0.14em] text-mist uppercase"
            >
              Username
            </label>
            <input
              id="username"
              name="username"
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="w-full rounded-2xl border border-line bg-bg-0/70 px-4 py-3 text-sm text-paper outline-none placeholder:text-mist/70 focus:border-line-strong focus:ring-2 focus:ring-[rgba(198,241,85,0.18)]"
              placeholder="Your given username"
              required
            />
          </div>
          <div>
            <label
              htmlFor="password"
              className="mb-1.5 block text-[12px] font-medium tracking-[0.14em] text-mist uppercase"
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
              className="w-full rounded-2xl border border-line bg-bg-0/70 px-4 py-3 text-sm text-paper outline-none placeholder:text-mist/70 focus:border-line-strong focus:ring-2 focus:ring-[rgba(198,241,85,0.18)]"
              placeholder="Your given password"
              required
            />
          </div>

          {error ? (
            <p className="rounded-2xl border border-[rgba(255,139,139,0.28)] bg-[rgba(255,139,139,0.08)] px-3 py-2 text-sm text-[#ffb4b4]">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-full bg-kiwi px-4 py-3 text-sm font-semibold text-[#11180f] hover:bg-[#d4f56f] disabled:opacity-60"
          >
            {pending ? "Entering…" : "Enter Kiwi Chat"}
          </button>
        </form>
      </div>
    </div>
  );
}
