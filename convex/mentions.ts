export type MentionId = "vishnu" | "cto" | "friend" | "friend-grok";

const HANDLE_TO_ID: Record<string, MentionId> = {
  vishnu: "vishnu",
  cto: "cto",
  "vishnu-grok": "cto",
  friend: "friend",
  "friend-grok": "friend-grok",
};

const ORDER: MentionId[] = ["vishnu", "cto", "friend", "friend-grok"];

export function parseMentions(body: string): MentionId[] {
  const found = new Set<MentionId>();
  const pattern = /(?:^|[^a-z0-9_])@([a-z0-9][a-z0-9-]*)/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(body)) !== null) {
    const id = HANDLE_TO_ID[(match[1] ?? "").toLowerCase()];
    if (id) found.add(id);
  }
  return ORDER.filter((id) => found.has(id));
}

export function normalizeMentions(
  value: MentionId[] | undefined,
  body: string,
): MentionId[] {
  if (Array.isArray(value) && value.length > 0) {
    const found = new Set(value);
    return ORDER.filter((id) => found.has(id));
  }
  return parseMentions(body);
}
