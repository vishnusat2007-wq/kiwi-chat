export type MentionId = "vishnu" | "cto" | "friend" | "friend-grok";

export type MentionTarget = {
  id: MentionId;
  /** Primary handle shown in autocomplete and inserted on pick. */
  handle: string;
  /** All handles that parse to this id (includes silent aliases). */
  aliases: string[];
  /**
   * Aliases that still resolve for parsing/webhooks but are not advertised
   * in autocomplete copy (e.g. legacy `@cto`).
   */
  silentAliases?: string[];
  label: string;
  detail: string;
  color: string;
};

/**
 * Canonical @handles for Kiwi Chat.
 *
 * | Handle | Who |
 * | --- | --- |
 * | `@vishnu` | Vishnu (human) |
 * | `@vishnu-grok` | Kiwi Lead (Vishnu’s bot) — stored as `cto`; `@cto` is a silent alias |
 * | `@friend` | Friend human (keep `@friend` even after they pick a display name) |
 * | `@friend-grok` | Friend’s Grok |
 */
export const MENTION_TARGETS: MentionTarget[] = [
  {
    id: "vishnu",
    handle: "vishnu",
    aliases: ["vishnu"],
    label: "Vishnu",
    detail: "Human",
    color: "#C6F155",
  },
  {
    id: "cto",
    handle: "vishnu-grok",
    aliases: ["vishnu-grok", "cto"],
    silentAliases: ["cto"],
    label: "Kiwi Lead",
    detail: "Bot · @vishnu-grok",
    color: "#C6F155",
  },
  {
    id: "friend",
    handle: "friend",
    aliases: ["friend"],
    label: "Friend",
    detail: "Human · handle stays @friend",
    color: "#D4B8FF",
  },
  {
    id: "friend-grok",
    handle: "friend-grok",
    aliases: ["friend-grok"],
    label: "Friend’s Grok",
    detail: "Bot",
    color: "#D4B8FF",
  },
];

const HANDLE_TO_ID = new Map<string, MentionId>();
for (const target of MENTION_TARGETS) {
  for (const alias of target.aliases) {
    HANDLE_TO_ID.set(alias.toLowerCase(), target.id);
  }
}

const MENTION_TOKEN = /(?:^|[^a-z0-9_])@([a-z0-9][a-z0-9-]*)/gi;

export function mentionIdForHandle(handle: string): MentionId | null {
  return HANDLE_TO_ID.get(handle.trim().toLowerCase()) ?? null;
}

export function parseMentions(body: string): MentionId[] {
  const found = new Set<MentionId>();
  MENTION_TOKEN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = MENTION_TOKEN.exec(body)) !== null) {
    const id = mentionIdForHandle(match[1] ?? "");
    if (id) found.add(id);
  }
  return MENTION_TARGETS.map((target) => target.id).filter((id) =>
    found.has(id),
  );
}

export function bodyMentionsCto(body: string) {
  return parseMentions(body).includes("cto");
}

export function bodyMentionsFriendGrok(body: string) {
  return parseMentions(body).includes("friend-grok");
}

export function mentionsForViewer(viewerId: "vishnu" | "friend"): MentionId[] {
  return viewerId === "vishnu" ? ["vishnu", "cto"] : ["friend", "friend-grok"];
}

export function messageMentionsViewer(
  mentions: MentionId[] | undefined,
  viewerId: "vishnu" | "friend",
) {
  const mine = new Set(mentionsForViewer(viewerId));
  return (mentions ?? []).some((id) => mine.has(id));
}

export function filterMentionSuggestions(query: string) {
  const needle = query.trim().toLowerCase().replace(/^@/, "");
  if (!needle) return MENTION_TARGETS;
  return MENTION_TARGETS.filter(
    (target) =>
      target.aliases.some((alias) => alias.startsWith(needle)) ||
      target.label.toLowerCase().includes(needle) ||
      target.detail.toLowerCase().includes(needle) ||
      target.handle.startsWith(needle),
  );
}

export type MentionSegment =
  | { type: "text"; value: string }
  | { type: "mention"; value: string; id: MentionId };

export function splitMentionSegments(body: string): MentionSegment[] {
  const segments: MentionSegment[] = [];
  const pattern = /@([a-z0-9][a-z0-9-]*)/gi;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(body)) !== null) {
    const handle = match[1] ?? "";
    const id = mentionIdForHandle(handle);
    const start = match.index;
    if (start > lastIndex) {
      segments.push({ type: "text", value: body.slice(lastIndex, start) });
    }
    if (id) {
      segments.push({ type: "mention", value: `@${handle}`, id });
    } else {
      segments.push({ type: "text", value: match[0] });
    }
    lastIndex = start + match[0].length;
  }
  if (lastIndex < body.length) {
    segments.push({ type: "text", value: body.slice(lastIndex) });
  }
  return segments.length > 0 ? segments : [{ type: "text", value: body }];
}

export function normalizeMentions(value: unknown, body?: string): MentionId[] {
  if (Array.isArray(value)) {
    const ids = new Set<MentionId>();
    for (const item of value) {
      if (typeof item !== "string") continue;
      const asId = item.trim().toLowerCase();
      if (
        asId === "vishnu" ||
        asId === "cto" ||
        asId === "friend" ||
        asId === "friend-grok"
      ) {
        ids.add(asId);
        continue;
      }
      const mapped = mentionIdForHandle(asId);
      if (mapped) ids.add(mapped);
    }
    if (ids.size > 0) {
      return MENTION_TARGETS.map((target) => target.id).filter((id) =>
        ids.has(id),
      );
    }
  }
  return body ? parseMentions(body) : [];
}
