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
import { useAppStore } from "../store/useAppStore";

type Submenu = "main" | "heading";

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
      const url = window.prompt("Image URL or vault path", "");
      if (url?.trim()) {
        insertImageMarkdown("", url.trim());
      }
      runPipeline(live);
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

  useEffect(() => {
    if (open) {
      setSubmenu("main");
      setHighlight(0);
    }
  }, [open, detection?.filter, detection?.slashOffset]);

  const filteredMain = MAIN_ITEMS.filter((it) =>
    matchesFilter(it, detection?.filter ?? "")
  );

  const rowCount =
    submenu === "heading" ? HEADING_LEVELS.length : filteredMain.length;

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
        if (submenu === "heading") {
          const level = HEADING_LEVELS[highlight] ?? 2;
          pickHeading(level);
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
    submenu,
    pickMain,
    pickHeading,
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
      {submenu === "heading" && (
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
      <ul className="slash-command-menu-list">
        {submenu === "heading"
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
      {submenu === "main" && filteredMain.length === 0 ? (
        <div className="slash-command-menu-empty">No matches</div>
      ) : null}
    </div>
  );

  return createPortal(menu, document.body);
}
