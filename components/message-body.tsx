"use client";

import {
  MENTION_TARGETS,
  messageMentionsViewer,
  splitMentionSegments,
  type MentionId,
} from "@/lib/mentions";
import type { Message } from "@/lib/types";

const COLOR_BY_ID = new Map(
  MENTION_TARGETS.map((target) => [target.id, target.color] as const),
);

export function MessageBody({
  body,
  mentions,
  highlightForViewer,
}: {
  body: string;
  mentions?: MentionId[];
  highlightForViewer?: boolean;
}) {
  const segments = splitMentionSegments(body);
  return (
    <span
      className={
        highlightForViewer ? "mention-unread-body" : undefined
      }
    >
      {segments.map((segment, index) => {
        if (segment.type === "text") {
          return <span key={index}>{segment.value}</span>;
        }
        const color = COLOR_BY_ID.get(segment.id) ?? "var(--kiwi)";
        return (
          <span
            key={index}
            className="mention-chip"
            style={{ color, borderColor: `${color}55`, background: `${color}18` }}
            data-mention={segment.id}
          >
            {segment.value}
          </span>
        );
      })}
      {highlightForViewer && mentions && mentions.length > 0 ? (
        <span className="sr-only">Mentions you</span>
      ) : null}
    </span>
  );
}

export function messageIsMentionFor(
  message: Message,
  viewerId: "vishnu" | "friend",
) {
  return messageMentionsViewer(message.mentions, viewerId);
}
