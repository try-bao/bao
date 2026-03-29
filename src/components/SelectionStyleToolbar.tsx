import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { measureNoteOffsetsFromSelection } from "../lib/fileNotes";
import {
  applyBold,
  applyFormatBlock,
  applyItalic,
  applyLink,
  applyStrikethrough,
  applyUnlink,
  detectActiveFormats,
  getActiveRangeCloned,
  getMdLiveEl,
  isSelectionInsideMdLive,
  restoreRange,
  toggleInlineCode,
  type ActiveFormats,
} from "../lib/formatSelection";
import { normalizeVaultImagesInPlace } from "../lib/vaultImageUrls";
import { useAppStore } from "../store/useAppStore";

const BLOCK_STYLE_OPTIONS: { value: string; label: string }[] = [
  { value: "p", label: "Paragraph" },
  { value: "h1", label: "Heading 1" },
  { value: "h2", label: "Heading 2" },
  { value: "h3", label: "Heading 3" },
  { value: "h4", label: "Heading 4" },
  { value: "h5", label: "Heading 5" },
  { value: "h6", label: "Heading 6" },
  { value: "blockquote", label: "Quote" },
];

type Pos = { top: number; left: number; placeAbove: boolean };

function computeToolbarPos(range: Range): Pos | null {
  const rects = range.getClientRects();
  const rect =
    rects.length > 0 ? rects[rects.length - 1]! : range.getBoundingClientRect();
  if (!rect.width && !rect.height && range.collapsed) {
    return null;
  }
  const vw = window.innerWidth;
  const margin = 8;
  const toolbarH = 68;
  const placeAbove = rect.top > toolbarH + margin;
  const top = placeAbove ? rect.top - margin : rect.bottom + margin;
  let left = rect.left + rect.width / 2;
  left = Math.max(120, Math.min(vw - 120, left));
  return { top, left, placeAbove };
}

function syncAfterEdit(live: HTMLElement) {
  if (typeof window.runLiveMarkdownTransforms === "function") {
    window.runLiveMarkdownTransforms(live);
  }
  const state = useAppStore.getState();
  const tab = state.tabs.find((t) => t.id === state.activeTabId);
  normalizeVaultImagesInPlace(live, tab?.relPath ?? null);
  state.onEditorInput();
}

function ToolbarBtn({
  label,
  children,
  title,
  onAction,
  narrow,
  icon,
  className,
  active,
}: {
  label?: string;
  children?: ReactNode;
  title: string;
  onAction: () => void;
  narrow?: boolean;
  /** Icon-only control (e.g. link) */
  icon?: boolean;
  className?: string;
  active?: boolean;
}) {
  const content = children ?? label ?? null;
  return (
    <button
      type="button"
      className={`selection-toolbar-btn${narrow ? " selection-toolbar-btn--narrow" : ""}${icon ? " selection-toolbar-btn--icon" : ""}${active ? " selection-toolbar-btn--active" : ""}${className ? ` ${className}` : ""}`}
      title={title}
      aria-label={title}
      aria-pressed={active}
      onMouseDown={(e) => e.preventDefault()}
      onClick={(e) => {
        e.preventDefault();
        onAction();
      }}
    >
      {content}
    </button>
  );
}

export function SelectionStyleToolbar() {
  const activeTabId = useAppStore((s) => s.activeTabId);
  const activeRelPath = useAppStore((s) => {
    const t = s.tabs.find((x) => x.id === s.activeTabId);
    return t?.relPath ?? null;
  });
  const flushActiveBuffer = useAppStore((s) => s.flushActiveBuffer);
  const addFileNote = useAppStore((s) => s.addFileNote);
  const settingsOpen = useAppStore((s) => s.settingsOpen);
  const shortcutsOpen = useAppStore((s) => s.shortcutsOpen);
  const noteOpen = Boolean(activeRelPath);
  const overlayOpen = settingsOpen || shortcutsOpen;
  const mdNote = Boolean(activeRelPath?.toLowerCase().endsWith(".md"));

  const rangeRef = useRef<Range | null>(null);
  const [pos, setPos] = useState<Pos | null>(null);
  const [open, setOpen] = useState(false);
  const [blockStyleMenuOpen, setBlockStyleMenuOpen] = useState(false);
  const blockMenuRef = useRef<HTMLDivElement>(null);
  const tButtonRef = useRef<HTMLButtonElement>(null);

  const [noteDialog, setNoteDialog] = useState<{
    relPath: string;
    offsets: [number, number];
  } | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const noteTextareaRef = useRef<HTMLTextAreaElement>(null);

  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkDraft, setLinkDraft] = useState("https://");
  const linkInputRef = useRef<HTMLInputElement>(null);

  const [activeFormats, setActiveFormats] = useState<ActiveFormats>({
    bold: false,
    italic: false,
    strikethrough: false,
    code: false,
    link: false,
  });

  const refreshFromSelection = useCallback(() => {
    setBlockStyleMenuOpen(false);
    if (linkDialogOpen || noteDialog) {
      return;
    }
    if (!noteOpen || overlayOpen) {
      setOpen(false);
      rangeRef.current = null;
      setPos(null);
      return;
    }
    const root = document.getElementById("editor-root");
    if (!root || root.classList.contains("editor-root--disabled")) {
      setOpen(false);
      rangeRef.current = null;
      setPos(null);
      return;
    }
    const r = getActiveRangeCloned();
    if (!r || !isSelectionInsideMdLive()) {
      setOpen(false);
      rangeRef.current = null;
      setPos(null);
      return;
    }
    rangeRef.current = r;
    const p = computeToolbarPos(r);
    setPos(p);
    setOpen(Boolean(p));
    const live = getMdLiveEl();
    if (live) {
      setActiveFormats(detectActiveFormats(live));
    }
  }, [noteOpen, overlayOpen, linkDialogOpen, noteDialog]);

  useEffect(() => {
    const onSel = () => {
      requestAnimationFrame(refreshFromSelection);
    };
    document.addEventListener("selectionchange", onSel);
    return () => document.removeEventListener("selectionchange", onSel);
  }, [refreshFromSelection]);

  useEffect(() => {
    refreshFromSelection();
  }, [activeTabId, noteOpen, overlayOpen, refreshFromSelection]);

  useEffect(() => {
    const el = document.querySelector(".editor-body");
    if (!el) {
      return;
    }
    const onScroll = () => {
      if (!rangeRef.current) {
        return;
      }
      const p = computeToolbarPos(rangeRef.current);
      setPos(p);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  useLayoutEffect(() => {
    const onResize = () => {
      if (rangeRef.current) {
        setPos(computeToolbarPos(rangeRef.current));
      }
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!noteDialog) {
      return;
    }
    setNoteDraft("");
    const t = window.setTimeout(() => {
      noteTextareaRef.current?.focus();
    }, 0);
    return () => window.clearTimeout(t);
  }, [noteDialog]);

  useEffect(() => {
    if (!linkDialogOpen) {
      return;
    }
    const t = window.setTimeout(() => {
      linkInputRef.current?.focus();
      linkInputRef.current?.select();
    }, 0);
    return () => window.clearTimeout(t);
  }, [linkDialogOpen]);

  // Listen for keyboard-shortcut events (Cmd+K, Cmd+Option+M)
  useEffect(() => {
    const onOpenLink = () => {
      if (overlayOpen) return;
      const range = getActiveRangeCloned();
      if (range && isSelectionInsideMdLive()) {
        rangeRef.current = range;
        setLinkDraft("https://");
        setLinkDialogOpen(true);
      }
    };
    const onOpenNote = () => {
      if (overlayOpen || !mdNote) return;
      const live = getMdLiveEl();
      const range = getActiveRangeCloned();
      if (!live || !range || !activeRelPath || !isSelectionInsideMdLive()) return;
      if (range.collapsed) return;
      rangeRef.current = range;
      flushActiveBuffer();
      const offsets = measureNoteOffsetsFromSelection(live, range.cloneRange(), activeRelPath);
      if (!offsets) return;
      useAppStore.getState().onEditorInput();
      setNoteDialog({ relPath: activeRelPath, offsets });
    };
    document.addEventListener("bao:open-link-dialog", onOpenLink);
    document.addEventListener("bao:open-note-dialog", onOpenNote);
    return () => {
      document.removeEventListener("bao:open-link-dialog", onOpenLink);
      document.removeEventListener("bao:open-note-dialog", onOpenNote);
    };
  }, [overlayOpen, mdNote, activeRelPath, flushActiveBuffer]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") {
        return;
      }
      if (noteDialog) {
        e.preventDefault();
        setNoteDialog(null);
      } else if (linkDialogOpen) {
        e.preventDefault();
        setLinkDialogOpen(false);
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [noteDialog, linkDialogOpen]);

  useEffect(() => {
    if (!blockStyleMenuOpen) {
      return;
    }
    const onDocPointerDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (tButtonRef.current?.contains(t)) {
        return;
      }
      if (blockMenuRef.current?.contains(t)) {
        return;
      }
      setBlockStyleMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setBlockStyleMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", onDocPointerDown, true);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onDocPointerDown, true);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [blockStyleMenuOpen]);

  const runWithRestoredRange = useCallback(
    (fn: () => void) => {
      const live = getMdLiveEl();
      const range = rangeRef.current;
      if (!live || !range) {
        return;
      }
      restoreRange(live, range);
      fn();
      syncAfterEdit(live);
      const next = getActiveRangeCloned();
      if (next) {
        rangeRef.current = next;
        setPos(computeToolbarPos(next));
      } else {
        rangeRef.current = null;
        setOpen(false);
        setPos(null);
      }
    },
    []
  );

  const showToolbar = Boolean(open && pos && noteOpen);

  const confirmNote = async () => {
    if (!noteDialog) {
      return;
    }
    const trimmed = noteDraft.trim();
    if (!trimmed) {
      return;
    }
    await addFileNote(noteDialog.relPath, noteDialog.offsets, trimmed);
    useAppStore.getState().onEditorInput();
    setNoteDialog(null);
    setOpen(false);
    rangeRef.current = null;
    setPos(null);
  };

  const confirmLink = () => {
    const url = linkDraft.trim();
    setLinkDialogOpen(false);
    if (!url) {
      return;
    }
    runWithRestoredRange(() => applyLink(url));
  };

  const panel =
    showToolbar && pos ? (
    <div
      className="selection-style-toolbar"
      role="toolbar"
      aria-label="Text style"
      style={{
        position: "fixed",
        top: pos.top,
        left: pos.left,
        transform: pos.placeAbove
          ? "translate(-50%, -100%)"
          : "translate(-50%, 0)",
        zIndex: 450,
      }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="selection-toolbar-row selection-toolbar-row--segmented">
        <div
          className={`selection-toolbar-t-wrap${blockStyleMenuOpen ? " is-open" : ""}`}
        >
          <button
            ref={tButtonRef}
            type="button"
            className="selection-toolbar-t-btn"
            title="Paragraph or heading"
            aria-label="Paragraph or heading"
            aria-expanded={blockStyleMenuOpen}
            aria-haspopup="menu"
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setBlockStyleMenuOpen((v) => !v);
            }}
          >
            <span className="selection-toolbar-t-icon" aria-hidden>
              T
            </span>
          </button>
          {blockStyleMenuOpen ? (
            <div
              ref={blockMenuRef}
              id="selection-block-style-menu"
              className="selection-toolbar-block-menu"
              role="menu"
              aria-label="Block style"
              onMouseDown={(e) => e.preventDefault()}
            >
              {BLOCK_STYLE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  role="menuitem"
                  className="selection-toolbar-block-menu-item"
                  onClick={() => {
                    runWithRestoredRange(() => applyFormatBlock(opt.value));
                    setBlockStyleMenuOpen(false);
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <ToolbarBtn
          title="Bold"
          narrow
          active={activeFormats.bold}
          onAction={() => runWithRestoredRange(() => applyBold())}
        >
          <span className="selection-toolbar-bold-char" aria-hidden>
            B
          </span>
        </ToolbarBtn>
        <ToolbarBtn
          title="Italic"
          narrow
          active={activeFormats.italic}
          onAction={() => runWithRestoredRange(() => applyItalic())}
        >
          <span className="selection-toolbar-italic-char" aria-hidden>
            I
          </span>
        </ToolbarBtn>
        <ToolbarBtn
          title="Strikethrough"
          narrow
          active={activeFormats.strikethrough}
          onAction={() => runWithRestoredRange(() => applyStrikethrough())}
        >
          <span className="selection-toolbar-strike-char">S</span>
        </ToolbarBtn>
        <ToolbarBtn
          label="<>"
          title="Inline code"
          narrow
          active={activeFormats.code}
          onAction={() =>
            runWithRestoredRange(() => {
              const live = getMdLiveEl();
              if (live) {
                toggleInlineCode(live);
              }
            })
          }
        />
        <ToolbarBtn
          title="Link"
          narrow
          icon
          active={activeFormats.link}
          onAction={() => {
            if (activeFormats.link) {
              runWithRestoredRange(() => applyUnlink());
            } else {
              setLinkDraft("https://");
              setLinkDialogOpen(true);
            }
          }}
        >
          <svg
            className="selection-toolbar-link-icon"
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
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
        </ToolbarBtn>
        {mdNote ? (
          <ToolbarBtn
            title="Add note"
            narrow
            icon
            onAction={() => {
              const live = getMdLiveEl();
              const range = rangeRef.current;
              if (!live || !range || !activeRelPath) {
                return;
              }
              flushActiveBuffer();
              const r = range.cloneRange();
              const offsets = measureNoteOffsetsFromSelection(
                live,
                r,
                activeRelPath
              );
              if (!offsets) {
                window.alert("Could not add a note for this selection.");
                return;
              }
              useAppStore.getState().onEditorInput();
              setNoteDialog({ relPath: activeRelPath, offsets });
            }}
          >
            <svg
              className="selection-toolbar-link-icon"
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
          </ToolbarBtn>
        ) : null}
      </div>
    </div>
    ) : null;

  const noteModal =
    noteDialog ? (
      <div
        className="modal-backdrop"
        aria-hidden="false"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            setNoteDialog(null);
          }
        }}
      >
        <div
          className="modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="selection-note-dialog-title"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 className="modal-title" id="selection-note-dialog-title">
            Add note
          </h2>
          <p className="modal-hint">Comment on the selected text.</p>
          <label className="modal-label">
            Note
            <textarea
              ref={noteTextareaRef}
              className="modal-input modal-input--textarea"
              rows={4}
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  void confirmNote();
                }
              }}
            />
          </label>
          <div className="modal-actions">
            <button
              type="button"
              className="btn"
              onClick={() => setNoteDialog(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void confirmNote()}
            >
              Save note
            </button>
          </div>
        </div>
      </div>
    ) : null;

  const linkModal = linkDialogOpen ? (
    <div
      className="modal-backdrop"
      aria-hidden="false"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          setLinkDialogOpen(false);
        }
      }}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="selection-link-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="modal-title" id="selection-link-dialog-title">
          Link URL
        </h2>
        <p className="modal-hint">Paste or type a web address.</p>
        <label className="modal-label">
          URL
          <input
            ref={linkInputRef}
            type="url"
            className="modal-input"
            autoComplete="off"
            value={linkDraft}
            onChange={(e) => setLinkDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                confirmLink();
              }
            }}
          />
        </label>
        <div className="modal-actions">
          <button
            type="button"
            className="btn"
            onClick={() => setLinkDialogOpen(false)}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={confirmLink}
          >
            Add link
          </button>
        </div>
      </div>
    </div>
  ) : null;

  if (!showToolbar && !noteDialog && !linkDialogOpen) {
    return null;
  }

  return (
    <>
      {panel ? createPortal(panel, document.body) : null}
      {noteModal ? createPortal(noteModal, document.body) : null}
      {linkModal ? createPortal(linkModal, document.body) : null}
    </>
  );
}
