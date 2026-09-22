"use client";

import Link from "next/link";
import { useState } from "react";
import { KiwiMark } from "@/components/kiwi-mark";

export type GuideBlock = {
  id: string;
  title: string;
  hint: string;
  code: string;
};

export function FriendBotGuide({
  viewerName,
  brief,
  blocks,
}: {
  viewerName: string;
  brief: string;
  blocks: GuideBlock[];
}) {
  const [copied, setCopied] = useState<string | null>(null);

  async function copy(id: string, value: string) {
    await navigator.clipboard.writeText(value);
    setCopied(id);
    window.setTimeout(() => setCopied((current) => (current === id ? null : current)), 1400);
  }

  return (
    <div className="kiwi-shell relative min-h-[100dvh] px-4 py-10">
      <div className="kiwi-noise" />
      <div className="kiwi-panel relative mx-auto w-full max-w-[760px] overflow-hidden rounded-[36px] px-6 pt-9 pb-8 md:px-10 md:pt-11 md:pb-10">
        <span className="kiwi-panel-accent" />
        <div className="flex items-center justify-between gap-3">
          <KiwiMark className="h-14 w-14" />
          <Link
            href="/chat"
            className="rounded-full border border-line px-3.5 py-2 text-[12px] font-extrabold tracking-wide text-mist uppercase hover:text-paper"
          >
            Back to chat
          </Link>
        </div>
        <p className="kiwi-kicker mt-7">Private · {viewerName}</p>
        <h1 className="mt-3 font-display text-[48px] leading-[0.88] text-paper md:text-[60px]">
          Connect the friend’s Grok
        </h1>
        <p className="mt-4 max-w-[38rem] text-[16px] leading-7 text-mist">
          Paste this into the friend’s Grok. It uses the friend bearer token on
          Kiwi Lab. Humans stay on the login. While the poll loop is running,
          the messenger shows Friend’s Grok as connected.
        </p>

        <button
          type="button"
          onClick={() => void copy("brief", brief)}
          className="kiwi-btn mt-6 rounded-full px-5 py-3 text-[15px]"
        >
          {copied === "brief" ? "Copied the brief" : "Copy the whole brief"}
        </button>

        <div className="mt-8 space-y-4">
          {blocks.map((block) => (
            <section
              key={block.id}
              className="rounded-[28px] border border-line bg-bg-0/80 p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-[16px] font-extrabold text-paper">{block.title}</h2>
                  <p className="mt-1 text-[13px] leading-6 text-mist">{block.hint}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void copy(block.id, block.code)}
                  className="shrink-0 rounded-full border border-line px-3 py-1.5 text-[12px] font-bold text-mist hover:text-paper"
                >
                  {copied === block.id ? "Copied" : "Copy"}
                </button>
              </div>
              <pre className="guide-code mt-4">{block.code}</pre>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
