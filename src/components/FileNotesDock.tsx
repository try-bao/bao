import { useEffect, useMemo, useRef, useState } from "react";
import * as note from "../lib/noteUtils";
import { useAppStore } from "../store/useAppStore";

type Filter = "all" | "open" | "resolved";

function selectionSnippet(
  buffer: string,
  relPath: string,
  index: [number, number]
): string {
  const body = relPath.toLowerCase().endsWith(".md")
    ? note.bodyMarkdownForEditor(buffer)
    : buffer;
  const [a, b] = index;
  if (a < 0 || b > body.length || a >= b) {
    return "—";
  }
  const s = body.slice(a, b).replace(/\s+/g, " ").trim();
  if (!s) {
    return "—";
  }
  return s.length > 100 ? `${s.slice(0, 97)}…` : s;
}

export function FileNotesDock() {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const panelRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const activeRelPath = useAppStore((s) => {
    const t = s.tabs.find((x) => x.id === s.activeTabId);
    return t?.relPath ?? null;
  });
  const tabBuffer = useAppStore((s) => {
    const t = s.tabs.find((x) => x.id === s.activeTabId);
    return t?.buffer ?? "";
  });
  const notes = useAppStore((s) => {
    const p = s.tabs.find((x) => x.id === s.activeTabId)?.relPath;
    return p ? s.fileNotesByPath[p] ?? [] : [];
  });
  const setResolved = useAppStore((s) => s.setFileNoteResolved);

  const mdOpen = Boolean(activeRelPath?.toLowerCase().endsWith(".md"));

  const filtered = useMemo(() => {
    return notes
      .map((n, i) => ({ n, i }))
      .filter(({ n }) => {
        if (filter === "open") {
          return !n.resolved;
        }
        if (filter === "resolved") {
          return n.resolved;
        }
        return true;
      });
  }, [notes, filter]);

  const unresolvedCount = useMemo(
    () => notes.filter((n) => !n.resolved).length,
    [notes]
  );

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
      }
    };
    const onPointer = (e: PointerEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || btnRef.current?.contains(t)) {
        return;
      }
      setOpen(false);
    };
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("pointerdown", onPointer, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("pointerdown", onPointer, true);
    };
  }, [open]);

  const jumpToNote = (index: number) => {
    const el = document.querySelector<HTMLElement>(
      `[data-bao-note-index="${index}"]`
    );
    if (!el) {
      return;
    }
    el.scrollIntoView({ block: "nearest", behavior: "smooth" });
    el.focus();
  };

  if (!mdOpen || !activeRelPath) {
    return null;
  }

  return (
    <div className="file-notes-dock">
      <button
        ref={btnRef}
        type="button"
        className={`file-notes-dock__toggle${open ? " is-open" : ""}`}
        aria-label="Notes for this file"
        aria-expanded={open}
        aria-haspopup="dialog"
        title="Notes"
        onClick={() => setOpen((v) => !v)}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        {unresolvedCount > 0 ? (
          <span className="file-notes-dock__badge" aria-hidden>
            {unresolvedCount > 99 ? "99+" : unresolvedCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          ref={panelRef}
          className="file-notes-dock__panel"
          role="dialog"
          aria-label="File notes"
        >
          <div className="file-notes-dock__head">
            <span className="file-notes-dock__title">Notes</span>
            <span className="file-notes-dock__count">{notes.length}</span>
          </div>

          <div
            className="file-notes-dock__filters"
            role="tablist"
            aria-label="Filter by status"
          >
            {(
              [
                ["all", "All"],
                ["open", "Open"],
                ["resolved", "Resolved"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={filter === key}
                className={`file-notes-dock__filter${filter === key ? " is-active" : ""}`}
                onClick={() => setFilter(key)}
              >
                {label}
              </button>
            ))}
          </div>

          <ul className="file-notes-dock__list">
            {filtered.length === 0 ? (
              <li className="file-notes-dock__empty">No notes.</li>
            ) : (
              filtered.map(({ n, i }) => (
                <li key={i} className="file-notes-dock__item">
                  <div className="file-notes-dock__item-meta">
                    <span
                      className={`file-notes-dock__status${n.resolved ? " is-resolved" : ""}`}
                    >
                      {n.resolved ? "Resolved" : "Open"}
                    </span>
                    {!n.resolved ? (
                      <button
                        type="button"
                        className="file-notes-dock__linkish"
                        onClick={() => jumpToNote(i)}
                      >
                        Show in editor
                      </button>
                    ) : null}
                  </div>
                  <div className="file-notes-dock__quote">
                    {selectionSnippet(tabBuffer, activeRelPath, n.index)}
                  </div>
                  <div className="file-notes-dock__body">{n.value}</div>
                  {n.createdAt ? (
                    <div className="file-notes-dock__date">
                      {new Date(n.createdAt).toLocaleString()}
                    </div>
                  ) : null}
                  <div className="file-notes-dock__actions">
                    <button
                      type="button"
                      className="file-notes-dock__btn"
                      onClick={() =>
                        void setResolved(activeRelPath, i, !n.resolved)
                      }
                    >
                      {n.resolved ? "Reopen" : "Resolve"}
                    </button>
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
