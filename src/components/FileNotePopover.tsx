import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAppStore } from "../store/useAppStore";

type PopState = { x: number; y: number; noteIndex: number } | null;

export function FileNotePopover({ liveEl }: { liveEl: HTMLElement | null }) {
  const [pop, setPop] = useState<PopState>(null);
  const popRef = useRef<PopState>(null);
  popRef.current = pop;
  const activeTabId = useAppStore((s) => s.activeTabId);
  const activeRelPath = useAppStore((s) => {
    const t = s.tabs.find((x) => x.id === s.activeTabId);
    return t?.relPath ?? null;
  });
  const notes = useAppStore((s) => {
    const t = s.tabs.find((x) => x.id === s.activeTabId);
    const p = t?.relPath;
    return p ? s.fileNotesByPath[p] ?? [] : [];
  });
  const setResolved = useAppStore((s) => s.setFileNoteResolved);

  useEffect(() => {
    setPop(null);
  }, [activeTabId, activeRelPath]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t || !liveEl) {
        return;
      }
      const mark = t.closest(".bao-note-highlight");
      if (mark && liveEl.contains(mark)) {
        e.preventDefault();
        e.stopPropagation();
        const idx = Number((mark as HTMLElement).dataset.baoNoteIndex);
        if (!Number.isFinite(idx)) {
          return;
        }
        const r = mark.getBoundingClientRect();
        const vw = window.innerWidth;
        const left = Math.min(Math.max(8, r.left + r.width / 2), vw - 8);
        setPop({
          x: left,
          y: r.bottom + 6,
          noteIndex: idx,
        });
        return;
      }
      if (popRef.current && !t.closest(".bao-file-note-popover")) {
        setPop(null);
      }
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [liveEl]);

  if (!pop || !activeRelPath) {
    return null;
  }

  const entry = notes[pop.noteIndex];
  if (!entry) {
    return null;
  }

  const panel = (
    <div
      className="bao-file-note-popover"
      role="dialog"
      aria-label="Note"
      style={{
        position: "fixed",
        left: pop.x,
        top: pop.y,
        transform: "translateX(-50%)",
        zIndex: 460,
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="bao-file-note-popover__text">{entry.value}</div>
      {entry.createdAt ? (
        <div className="bao-file-note-popover__date">
          {new Date(entry.createdAt).toLocaleString()}
        </div>
      ) : null}
      <div className="bao-file-note-popover__actions">
        <button
          type="button"
          className="bao-file-note-popover__btn"
          onClick={() => {
            void setResolved(activeRelPath, pop.noteIndex, !entry.resolved);
          }}
        >
          {entry.resolved ? "Reopen" : "Resolve"}
        </button>
        <button
          type="button"
          className="bao-file-note-popover__btn bao-file-note-popover__btn--muted"
          onClick={() => setPop(null)}
        >
          Close
        </button>
      </div>
    </div>
  );

  return createPortal(panel, document.body);
}
