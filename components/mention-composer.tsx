"use client";

import {
  FormEvent,
  KeyboardEvent,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  filterMentionSuggestions,
  type MentionTarget,
} from "@/lib/mentions";

function activeMentionQuery(value: string, caret: number) {
  const before = value.slice(0, caret);
  const match = before.match(/(^|[\s([{])@([a-z0-9-]*)$/i);
  if (!match) return null;
  return {
    start: (match.index ?? 0) + match[1].length,
    query: match[2] ?? "",
  };
}

export function MentionComposer({
  value,
  onChange,
  onSubmit,
  disabled,
  sendError,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (event?: FormEvent) => void;
  disabled: boolean;
  sendError: string | null;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [caret, setCaret] = useState(0);
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const mention = useMemo(
    () => activeMentionQuery(value, caret),
    [value, caret],
  );
  const suggestions = useMemo(
    () => (mention ? filterMentionSuggestions(mention.query) : []),
    [mention],
  );
  const mentionKey = mention
    ? `${mention.start}:${mention.query}`
    : "";
  const open = Boolean(
    mention && suggestions.length > 0 && dismissedKey !== mentionKey,
  );

  function applyMention(target: MentionTarget) {
    if (!mention || !textareaRef.current) return;
    const before = value.slice(0, mention.start);
    const after = value.slice(caret);
    const insertion = `@${target.handle} `;
    const next = `${before}${insertion}${after}`;
    onChange(next);
    const nextCaret = before.length + insertion.length;
    setDismissedKey(`${mention.start}:${target.handle}`);
    setActiveIndex(0);
    requestAnimationFrame(() => {
      const node = textareaRef.current;
      if (!node) return;
      node.focus();
      node.setSelectionRange(nextCaret, nextCaret);
      setCaret(nextCaret);
    });
  }

  function onComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (open && suggestions.length > 0) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((index) => (index + 1) % suggestions.length);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex(
          (index) => (index - 1 + suggestions.length) % suggestions.length,
        );
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        applyMention(suggestions[activeIndex] ?? suggestions[0]);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setDismissedKey(mentionKey);
        return;
      }
    }

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      onSubmit();
    }
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(event);
      }}
      className="composer-card relative rounded-[30px] px-5 py-4"
    >
      {open ? (
        <ul
          className="mention-menu absolute bottom-[calc(100%+10px)] left-3 right-3 z-20 overflow-hidden rounded-[22px] border border-line-strong bg-bg-1 shadow-[0_18px_40px_rgba(0,0,0,0.45)]"
          role="listbox"
          aria-label="Mention someone"
        >
          {suggestions.map((target, index) => (
            <li key={target.id}>
              <button
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                className={`flex w-full items-center gap-3 px-4 py-3 text-left transition ${
                  index === activeIndex ? "bg-bg-3" : "hover:bg-bg-2"
                }`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => applyMention(target)}
              >
                <span
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[12px] font-extrabold text-[#0b120c]"
                  style={{ background: target.color }}
                >
                  {target.label.slice(0, 1)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-bold text-paper">
                    @{target.handle}
                    <span className="ml-2 font-medium text-mist">
                      {target.label}
                    </span>
                  </span>
                  <span className="block truncate text-[12px] text-mist">
                    {target.detail}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <label className="sr-only" htmlFor="message-draft">
        Message
      </label>
      <textarea
        id="message-draft"
        ref={textareaRef}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          setCaret(event.target.selectionStart);
        }}
        onClick={(event) => setCaret(event.currentTarget.selectionStart)}
        onKeyUp={(event) => setCaret(event.currentTarget.selectionStart)}
        onKeyDown={onComposerKeyDown}
        rows={2}
        placeholder="Try @cto or @friend-grok"
        className="w-full resize-none bg-transparent text-[17px] leading-7 text-paper outline-none placeholder:text-mist/60"
      />
      <div className="mt-2 flex items-center justify-between gap-3">
        <p className="min-w-0 truncate text-[13px] font-medium text-mist">
          {sendError ??
            "Enter to send · @ to mention · Shift+Enter for a new line"}
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <a
            href="/friend-bot"
            className="rounded-full border border-line px-3 py-2 text-[12px] font-bold text-mist hover:text-paper"
          >
            Grok setup
          </a>
          <button
            type="submit"
            disabled={disabled || !value.trim()}
            className="kiwi-btn rounded-full px-5 py-2.5 text-[14px] disabled:opacity-50"
          >
            {disabled ? "Sending…" : "Send"}
          </button>
        </div>
      </div>
    </form>
  );
}
