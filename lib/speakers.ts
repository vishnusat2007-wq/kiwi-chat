import { getBot, isBotId } from "./auth";
import { HUMANS, publicBot, type AuthorKind } from "./config";
import type { PublicSpeaker } from "./types";

export function speakerFor(
  authorId: string,
  authorKind: AuthorKind,
  friendName = "",
): PublicSpeaker {
  const id = isBotId(authorId) ? authorId : "vishnu";
  if (authorKind === "human") {
    const name =
      id === "friend"
        ? friendName.trim() || HUMANS.friend.name
        : HUMANS.vishnu.name;
    const color = id === "friend" ? "#D4B8FF" : "#C6F155";
    return {
      id,
      name,
      fullName: name,
      color,
      initial: name.slice(0, 1).toUpperCase() || (id === "friend" ? "F" : "V"),
      kind: "human",
    };
  }

  if (!isBotId(authorId)) {
    return {
      id: "vishnu",
      name: authorId,
      fullName: authorId,
      color: "#9CA3AF",
      initial: authorId.slice(0, 1).toUpperCase(),
      kind: "bot",
    };
  }

  return publicBot(getBot(id));
}

export function asAuthorKind(value: string | null | undefined): AuthorKind {
  return value === "human" ? "human" : "bot";
}
