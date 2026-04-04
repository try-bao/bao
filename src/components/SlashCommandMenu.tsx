import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  applyBlockquote,
  applyBulletListBlock,
  applyCodeBlock,
  applyDivider,
  applyHeading,
  applyNumberedListBlock,
  applyTaskList,
  getMdLiveEl,
  insertImageMarkdown,
  insertTable,
} from "../lib/formatSelection";
import {
  deleteSlashCommandRange,
  type SlashDetection,
} from "../lib/slashCommand";
import { getApi } from "../lib/api";
import { useAppStore } from "../store/useAppStore";

type Submenu = "main" | "heading" | "emoji";

type Item = {
  id: string;
  label: string;
  hint?: string;
  keywords: string;
};

const MAIN_ITEMS: Item[] = [
  {
    id: "heading",
    label: "Heading",
    hint: "H1–H6",
    keywords: "heading title h1 h2",
  },
  { id: "table", label: "Table", keywords: "table grid" },
  { id: "code", label: "Code block", keywords: "code fence" },
  { id: "image", label: "Image", keywords: "image photo picture" },
  { id: "bullet", label: "Bulleted list", keywords: "bullet unordered ul" },
  { id: "numbered", label: "Numbered list", keywords: "numbered ordered ol" },
  { id: "todo", label: "Todo list", keywords: "todo task checkbox" },
  { id: "quote", label: "Quote", keywords: "quote blockquote" },
  { id: "divider", label: "Divider", keywords: "divider horizontal rule hr" },
  { id: "emoji", label: "Emoji", keywords: "emoji smiley face emoticon" },
];

type EmojiEntry = { emoji: string; name: string };

const EMOJI_LIST: EmojiEntry[] = [
  { emoji: "😀", name: "grinning face" },
  { emoji: "😂", name: "joy tears laughing" },
  { emoji: "😅", name: "sweat smile nervous" },
  { emoji: "😊", name: "blush happy" },
  { emoji: "😍", name: "heart eyes love" },
  { emoji: "🥰", name: "smiling hearts love" },
  { emoji: "😎", name: "sunglasses cool" },
  { emoji: "🤔", name: "thinking think" },
  { emoji: "😢", name: "cry sad" },
  { emoji: "😡", name: "angry mad rage" },
  { emoji: "🥳", name: "party celebrate" },
  { emoji: "😴", name: "sleeping sleep zzz" },
  { emoji: "🤯", name: "mind blown exploding" },
  { emoji: "🫡", name: "salute" },
  { emoji: "👍", name: "thumbs up yes good" },
  { emoji: "👎", name: "thumbs down no bad" },
  { emoji: "👏", name: "clap applause" },
  { emoji: "🙌", name: "raised hands hooray" },
  { emoji: "🤝", name: "handshake deal" },
  { emoji: "✌️", name: "peace victory" },
  { emoji: "🫶", name: "heart hands love" },
  { emoji: "💪", name: "muscle strong flex" },
  { emoji: "🔥", name: "fire hot lit" },
  { emoji: "⭐", name: "star" },
  { emoji: "✨", name: "sparkles magic" },
  { emoji: "💡", name: "light bulb idea" },
  { emoji: "❤️", name: "red heart love" },
  { emoji: "💔", name: "broken heart" },
  { emoji: "💯", name: "hundred perfect" },
  { emoji: "🎉", name: "party popper tada" },
  { emoji: "🎯", name: "bullseye target dart" },
  { emoji: "🚀", name: "rocket launch" },
  { emoji: "⚡", name: "lightning zap bolt" },
  { emoji: "🌟", name: "glowing star" },
  { emoji: "🌈", name: "rainbow" },
  { emoji: "☀️", name: "sun sunny" },
  { emoji: "🌙", name: "moon night" },
  { emoji: "🍕", name: "pizza food" },
  { emoji: "☕", name: "coffee cup" },
  { emoji: "🎵", name: "music note" },
  { emoji: "📌", name: "pin pushpin" },
  { emoji: "📝", name: "memo note write" },
  { emoji: "📎", name: "paperclip attach" },
  { emoji: "📅", name: "calendar date" },
  { emoji: "✅", name: "check mark done" },
  { emoji: "❌", name: "cross mark no" },
  { emoji: "⚠️", name: "warning caution" },
  { emoji: "❓", name: "question mark" },
  { emoji: "❗", name: "exclamation alert" },
  { emoji: "💬", name: "speech bubble chat" },
  { emoji: "👀", name: "eyes look see" },
  { emoji: "🐛", name: "bug insect" },
  { emoji: "🏷️", name: "tag label" },
  { emoji: "📦", name: "package box" },
  { emoji: "🔒", name: "lock secure" },
  { emoji: "🔑", name: "key" },
  { emoji: "🗑️", name: "trash delete" },
  { emoji: "💀", name: "skull dead" },
  { emoji: "👻", name: "ghost" },
  { emoji: "🤖", name: "robot bot" },
  { emoji: "🧠", name: "brain smart" },
  { emoji: "🎨", name: "art palette paint" },
  { emoji: "🏆", name: "trophy award winner" },
];

const HEADING_LEVELS = [1, 2, 3, 4, 5, 6] as const;

function matchesFilter(item: Item, f: string): boolean {
  const q = f.trim().toLowerCase();
  if (!q) {
    return true;
  }
  const blob = `${item.label} ${item.keywords} ${item.hint ?? ""}`.toLowerCase();
  return blob.includes(q);
}

function runPipeline(live: HTMLElement): void {
  if (typeof window.runLiveMarkdownTransforms === "function") {
    window.runLiveMarkdownTransforms(live);
  }
}

function applySlashChoice(
  live: HTMLElement,
  det: SlashDetection,
  action: string,
  headingLevel?: number
): void {
  deleteSlashCommandRange(live, det);

  switch (action) {
    case "heading": {
      const level = headingLevel ?? 2;
      applyHeading(live, level);
      break;
    }
    case "table":
      insertTable();
      runPipeline(live);
      break;
    case "code":
      applyCodeBlock(live);
      runPipeline(live);
      break;
    case "image": {
      getApi()
        .chooseImageFile()
        .then((res) => {
          if (res.chosen && res.relPath) {
            insertImageMarkdown("", res.relPath);
          }
          runPipeline(live);
        })
        .catch(() => {
          runPipeline(live);
        });
      break;
    }
    case "bullet":
      applyBulletListBlock(live);
      break;
    case "numbered":
      applyNumberedListBlock(live);
      break;
    case "todo":
      applyTaskList(live);
      runPipeline(live);
      break;
    case "quote":
      applyBlockquote(live);
      break;
    case "divider":
      applyDivider(live);
      break;
    default:
      break;
  }

  live.focus();
}

type Props = {
  live: HTMLElement | null;
  detection: SlashDetection | null;
  onClearDetection: () => void;
};

export function SlashCommandMenu({
  live,
  detection,
  onClearDetection,
}: Props) {
  const onEditorInput = useAppStore((s) => s.onEditorInput);
  const [submenu, setSubmenu] = useState<Submenu>("main");
  const [highlight, setHighlight] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: 0, top: 0 });

  const open = Boolean(live && detection);

  /* Auto-detect /emoji prefix to switch submenu automatically */
  const rawFilter = (detection?.filter ?? "").trim().toLowerCase();
  const isEmojiMode = rawFilter === "emoji" || rawFilter.startsWith("emoji ");
  const emojiSubFilter = isEmojiMode
    ? rawFilter.slice(5).trim()
    : "";

  const activeSubmenu = isEmojiMode ? "emoji" as Submenu : submenu;

  useEffect(() => {
    if (open && !isEmojiMode) {
      setSubmenu("main");
      setHighlight(0);
    }
  }, [open, detection?.slashOffset]);

  useEffect(() => {
    setHighlight(0);
  }, [isEmojiMode, rawFilter]);

  const filteredMain = MAIN_ITEMS.filter((it) =>
    matchesFilter(it, detection?.filter ?? "")
  );

  const filteredEmoji = EMOJI_LIST.filter(
    (e) => !emojiSubFilter || e.name.includes(emojiSubFilter) || e.emoji === emojiSubFilter
  );

  const rowCount =
    activeSubmenu === "heading"
      ? HEADING_LEVELS.length
      : activeSubmenu === "emoji"
        ? filteredEmoji.length
        : filteredMain.length;

  useEffect(() => {
    setHighlight((h) =>
      rowCount === 0 ? 0 : Math.min(h, Math.max(0, rowCount - 1))
    );
  }, [rowCount, submenu, detection?.filter]);

  useLayoutEffect(() => {
    if (!open || !menuRef.current || !detection) {
      return;
    }
    const pad = 8;
    const rect = menuRef.current.getBoundingClientRect();
    let left = Math.min(
      detection.caretRect.left,
      window.innerWidth - rect.width - pad
    );
    let top = detection.caretRect.bottom + 4;
    if (top + rect.height > window.innerHeight - pad) {
      top = Math.max(pad, detection.caretRect.top - rect.height - 4);
    }
    left = Math.max(pad, left);
    top = Math.max(pad, top);
    setPos({ left, top });
  }, [open, detection, submenu, rowCount, highlight]);

  const finish = useCallback(() => {
    onClearDetection();
    queueMicrotask(() => onEditorInput());
  }, [onClearDetection, onEditorInput]);

  const pickEmoji = useCallback(
    (emoji: string) => {
      if (!live || !detection) {
        return;
      }
      deleteSlashCommandRange(live, detection);
      const sel = window.getSelection();
      if (sel && sel.rangeCount) {
        const range = sel.getRangeAt(0);
        range.deleteContents();
        range.insertNode(document.createTextNode(emoji));
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
      }
      live.focus();
      finish();
    },
    [live, detection, finish]
  );

  const pickMain = useCallback(
    (id: string) => {
      if (!live || !detection) {
        return;
      }
      if (id === "heading") {
        setSubmenu("heading");
        setHighlight(0);
        return;
      }
      applySlashChoice(live, detection, id);
      finish();
    },
    [live, detection, finish]
  );

  const pickHeading = useCallback(
    (level: number) => {
      if (!live || !detection) {
        return;
      }
      applySlashChoice(live, detection, "heading", level);
      finish();
    },
    [live, detection, finish]
  );

  useEffect(() => {
    if (!open) {
      return;
    }
    const onDocPointerDown = (e: PointerEvent) => {
      const menu = menuRef.current;
      if (menu && e.target instanceof Node && menu.contains(e.target)) {
        return;
      }
      const md = getMdLiveEl();
      if (md && e.target instanceof Node && md.contains(e.target)) {
        return;
      }
      onClearDetection();
    };
    const t = window.setTimeout(() => {
      document.addEventListener("pointerdown", onDocPointerDown, true);
    }, 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener("pointerdown", onDocPointerDown, true);
    };
  }, [open, onClearDetection]);

  useEffect(() => {
    if (!open || !live || !detection) {
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        deleteSlashCommandRange(live, detection);
        onClearDetection();
        queueMicrotask(() => onEditorInput());
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (rowCount === 0) {
          return;
        }
        setHighlight((h) => (h + 1) % rowCount);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        if (rowCount === 0) {
          return;
        }
        setHighlight((h) => (h - 1 + rowCount) % rowCount);
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        if (activeSubmenu === "heading") {
          const level = HEADING_LEVELS[highlight] ?? 2;
          pickHeading(level);
        } else if (activeSubmenu === "emoji") {
          const entry = filteredEmoji[highlight];
          if (entry) {
            pickEmoji(entry.emoji);
          }
        } else {
          const row = filteredMain[highlight];
          if (row) {
            pickMain(row.id);
          }
        }
        return;
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [
    open,
    live,
    detection,
    rowCount,
    filteredMain,
    highlight,
    activeSubmenu,
    pickMain,
    pickHeading,
    pickEmoji,
    filteredEmoji,
    onClearDetection,
    onEditorInput,
  ]);

  if (!open || !detection) {
    return null;
  }

  const menu = (
    <div
      ref={menuRef}
      id="slash-command-menu"
      className="slash-command-menu"
      role="listbox"
      aria-label="Insert block"
      style={{ left: pos.left, top: pos.top }}
    >
      {activeSubmenu === "heading" && (
        <div className="slash-command-menu-header">
          <button
            type="button"
            className="slash-command-menu-back"
            onClick={() => {
              setSubmenu("main");
              setHighlight(0);
            }}
          >
            ← Back
          </button>
          <span className="slash-command-menu-header-title">Heading level</span>
        </div>
      )}
      {activeSubmenu === "emoji" && (
        <div className="slash-command-menu-header">
          <span className="slash-command-menu-header-title">Pick an emoji{emojiSubFilter ? ` — "${emojiSubFilter}"` : ""}</span>
        </div>
      )}
      {activeSubmenu === "emoji" ? (
        <div className="slash-command-emoji-grid">
          {filteredEmoji.map((entry, i) => (
            <button
              key={entry.emoji}
              type="button"
              title={entry.name}
              className={`slash-command-emoji-btn${i === highlight ? " is-highlighted" : ""}`}
              onMouseEnter={() => setHighlight(i)}
              onClick={() => pickEmoji(entry.emoji)}
            >
              {entry.emoji}
            </button>
          ))}
          {filteredEmoji.length === 0 && (
            <div className="slash-command-menu-empty">No matching emoji</div>
          )}
        </div>
      ) : (
      <ul className="slash-command-menu-list">
        {activeSubmenu === "heading"
          ? HEADING_LEVELS.map((level, i) => (
              <li key={level}>
                <button
                  type="button"
                  role="option"
                  aria-selected={i === highlight}
                  className={`slash-command-menu-item${i === highlight ? " is-highlighted" : ""}`}
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => pickHeading(level)}
                >
                  <span className="slash-command-menu-label">
                    Heading {level}
                  </span>
                  <span className="slash-command-menu-hint">
                    {"#".repeat(level)} …
                  </span>
                </button>
              </li>
            ))
          : filteredMain.map((it, i) => (
              <li key={it.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={i === highlight}
                  className={`slash-command-menu-item${i === highlight ? " is-highlighted" : ""}`}
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => pickMain(it.id)}
                >
                  <span className="slash-command-menu-label">{it.label}</span>
                  {it.hint ? (
                    <span className="slash-command-menu-hint">{it.hint}</span>
                  ) : null}
                </button>
              </li>
            ))}
      </ul>
      )}
      {submenu === "main" && filteredMain.length === 0 ? (
        <div className="slash-command-menu-empty">No matches</div>
      ) : null}
    </div>
  );

  return createPortal(menu, document.body);
}
