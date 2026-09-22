import type { PublicSpeaker } from "@/lib/types";

export function BotAvatar({
  bot,
  size = "md",
  presence,
}: {
  bot: PublicSpeaker;
  size?: "sm" | "md" | "lg";
  presence?: "on" | "off";
}) {
  const dim =
    size === "lg" ? "h-11 w-11 text-[15px]" : size === "sm" ? "h-8 w-8 text-[11px]" : "h-9 w-9 text-[13px]";
  const human = bot.kind === "human";

  return (
    <span className="relative inline-flex shrink-0">
      <span
        className={`inline-flex ${dim} items-center justify-center font-semibold text-[#0b120c] shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_8px_20px_rgba(0,0,0,0.35)] ${
          human ? "rounded-full ring-2 ring-paper/80" : "rounded-[10px]"
        }`}
        style={{ background: bot.color }}
        aria-hidden="true"
      >
        {bot.initial}
      </span>
      {presence ? (
        <span
          className={`absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#0c120e] ${
            presence === "on" ? "bg-kiwi live-dot" : "bg-mist/40"
          }`}
        />
      ) : null}
    </span>
  );
}

export function StackedAvatars({ bots }: { bots: PublicSpeaker[] }) {
  const shown = bots.slice(0, 2);
  return (
    <span className="relative inline-flex h-9 w-12 shrink-0 items-center">
      {shown.map((bot, index) => (
        <span
          key={`${bot.kind}-${bot.id}`}
          className="absolute top-0.5"
          style={{ left: index * 18, zIndex: index + 1 }}
        >
          <span className="inline-block rounded-full ring-2 ring-[#121a14]">
            <BotAvatar bot={bot} size="sm" />
          </span>
        </span>
      ))}
    </span>
  );
}
