import { useCallback, useEffect, useRef, useState } from "react";
import {
  handleSelectionChangeForCodeHighlight,
  registerHighlightGlobally,
} from "../codeHighlight";
import { installMdImageResize } from "../lib/mdImageResize";
import { getMarkdownPreservingImgPaths, normalizeVaultImagesInPlace } from "../lib/vaultImageUrls";
import {
  applyNoteHighlightsToRenderedDom,
} from "../lib/fileNotes";
import { applyMarkdownToEditorRoot, applyHtmlToEditorRoot } from "../markdownEditorRender";
import { getApi } from "../lib/api";
import * as note from "../lib/noteUtils";
import * as tagCore from "../lib/tagIndexCore";
import { useAppStore } from "../store/useAppStore";
import type { EditorBridge } from "../types";
import {
  detectSlashCommand,
  type SlashDetection,
} from "../lib/slashCommand";
import { rafThrottle } from "../lib/rafThrottle";
import { applySearchHighlights, clearSearchHighlights } from "../lib/searchHighlight";
import { FileNotePopover } from "./FileNotePopover";
import { SlashCommandMenu } from "./SlashCommandMenu";
import { TableContextMenu } from "./TableContextMenu";

const EDITOR_PLACEHOLDER =
  "Write markdown… Open a note from the sidebar or press + to create one.";

/** Debounce htmlToMarkdown-derived buffer updates (expensive on large notes). */
const EDITOR_INPUT_DEBOUNCE_MS = 120;

export function MarkdownEditor() {
  const setEditorBridge = useAppStore((s) => s.setEditorBridge);
  const sourceMode = useAppStore((s) => s.sourceMode);
  const activeRelPath = useAppStore((s) => {
    const t = s.tabs.find((x) => x.id === s.activeTabId);
    return t?.relPath ?? null;
  });

  useEffect(() => {
    if (!activeRelPath) {
      setEditorBridge(null);
    }
  }, [activeRelPath, setEditorBridge]);

  if (!activeRelPath) {
    return (
      <div className="editor-empty-state" role="status" aria-live="polite">
        No File Open
      </div>
    );
  }

  return sourceMode ? <MarkdownSourceView /> : <MarkdownEditorActive />;
}

function MarkdownEditorActive() {
  const rootRef = useRef<HTMLDivElement>(null);
  const mdLiveRef = useRef<HTMLDivElement | null>(null);
  const suppressRef = useRef(false);
  const editorInputDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const [liveEl, setLiveEl] = useState<HTMLElement | null>(null);
  const [slashDet, setSlashDet] = useState<SlashDetection | null>(null);
  const setEditorBridge = useAppStore((s) => s.setEditorBridge);
  const onEditorInput = useAppStore((s) => s.onEditorInput);
  const activeTabId = useAppStore((s) => s.activeTabId);
  const activeRelPath = useAppStore((s) => {
    const t = s.tabs.find((x) => x.id === s.activeTabId);
    return t?.relPath ?? null;
  });
  const fileNotesRevision = useAppStore((s) => s.fileNotesRevision);
  const searchHighlightQuery = useAppStore((s) => s.searchHighlightQuery);

  // Apply search highlighting when query changes
  useEffect(() => {
    if (mdLiveRef.current) {
      applySearchHighlights(mdLiveRef.current, searchHighlightQuery);
    }
    return () => {
      clearSearchHighlights();
    };
  }, [searchHighlightQuery, activeTabId]);

  // Listen for goto-line events from search results
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.lineNumber && mdLiveRef.current) {
        // Find the line and scroll to it
        const live = mdLiveRef.current;
        const blocks = Array.from(live.children);
        const targetIndex = Math.max(0, detail.lineNumber - 1);
        if (blocks[targetIndex]) {
          blocks[targetIndex].scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
        }
      }
    };
    window.addEventListener("bao-goto-line", handler);
    return () => window.removeEventListener("bao-goto-line", handler);
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (
      !root ||
      typeof window.parseMarkdownToHtml !== "function" ||
      typeof window.htmlToMarkdown !== "function" ||
      typeof window.wireLiveMarkdown !== "function"
    ) {
      console.error("markdown-parse.js or live-md.js failed to load.");
      return;
    }

    root.innerHTML = "";
    const live = document.createElement("div");
    live.className = "md-live";
    live.dataset.baoMdLive = "";
    live.setAttribute("role", "textbox");
    live.setAttribute("aria-multiline", "true");
    live.setAttribute("aria-label", "Note editor");
    live.setAttribute("data-placeholder", EDITOR_PLACEHOLDER);
    live.contentEditable = "true";
    root.appendChild(live);
    mdLiveRef.current = live;
    setLiveEl(live);
    const tab0 = useAppStore
      .getState()
      .tabs.find((t) => t.id === useAppStore.getState().activeTabId);
    live.dataset.baoNoteRelPath = tab0?.relPath ?? "";

    registerHighlightGlobally();

    const onSelHighlight = rafThrottle(() =>
      handleSelectionChangeForCodeHighlight(live)
    );
    document.addEventListener("selectionchange", onSelHighlight);

    const bridge: EditorBridge = {
      getMarkdown: () => {
        if (!mdLiveRef.current) {
          return "";
        }
        const state = useAppStore.getState();
        const tab = state.tabs.find((t) => t.id === state.activeTabId);
        if (note.isHtmlRelPath(tab?.relPath ?? "")) {
          return mdLiveRef.current.innerHTML;
        }
        if (typeof window.htmlToMarkdown !== "function") {
          return "";
        }
        return getMarkdownPreservingImgPaths(
          mdLiveRef.current,
          tab?.relPath ?? null
        );
      },
      setMarkdown: (md, opts = {}) => {
        const silent = Boolean(opts.silent);
        if (!mdLiveRef.current) {
          return;
        }
        suppressRef.current = silent;
        try {
          const raw = md ?? "";
          const state = useAppStore.getState();
          const tab = state.tabs.find((t) => t.id === state.activeTabId);
          const noteRelPath = tab?.relPath ?? null;
          if (note.isHtmlRelPath(noteRelPath ?? "")) {
            applyHtmlToEditorRoot(mdLiveRef.current, raw, noteRelPath);
          } else {
            if (typeof window.parseMarkdownToHtml !== "function") return;
            applyMarkdownToEditorRoot(mdLiveRef.current, raw, noteRelPath);
          }
        } finally {
          suppressRef.current = false;
        }
      },
      setDisabled: (disabled) => {
        root.classList.toggle("editor-root--disabled", disabled);
        if (mdLiveRef.current) {
          mdLiveRef.current.contentEditable = disabled ? "false" : "true";
        }
      },
    };

    const scheduleEditorInput = () => {
      if (editorInputDebounceRef.current) {
        clearTimeout(editorInputDebounceRef.current);
      }
      editorInputDebounceRef.current = setTimeout(() => {
        editorInputDebounceRef.current = null;
        useAppStore.getState().onEditorInput();

        // Auto-restore heading if user deleted it
        const liveNow = mdLiveRef.current;
        if (liveNow) {
          const st = useAppStore.getState();
          const tab = st.tabs.find((t) => t.id === st.activeTabId);
          if (tab?.relPath?.toLowerCase().endsWith(".md")) {
            const hasTitleNow = note.titleFromMarkdown(tab.buffer);
            console.log("[bao] heading check:", JSON.stringify({ buffer: tab.buffer.slice(0, 120), hasTitleNow }));
            if (!hasTitleNow) {
              // Re-read buffer after onEditorInput stored it
              const currentMd = tab.buffer;
              const title = note.generateUntitledTitle([]);
              const next = note.ensureLeadingHeading(currentMd, title);
              if (next !== currentMd) {
                useAppStore.setState({
                  tabs: st.tabs.map((t) =>
                    t.id === tab.id ? { ...t, buffer: next } : t
                  ),
                });
                suppressRef.current = true;
                try {
                  applyMarkdownToEditorRoot(liveNow, next, tab.relPath);
                } finally {
                  suppressRef.current = false;
                }
              }
            }
          }
        }

        // Refresh note overlays on the *existing* live DOM (no full re-render).
        // onEditorInput just adjusted the note indices in the store.
        if (liveNow) {
          const st = useAppStore.getState();
          const tab = st.tabs.find((t) => t.id === st.activeTabId);
          if (tab?.relPath?.toLowerCase().endsWith(".md")) {
            const notes = st.fileNotesByPath[tab.relPath] ?? [];
            if (notes.some((n) => !n.resolved)) {
              const fullMd = st.editorBridge?.getMarkdown() ?? tab.buffer;
              applyNoteHighlightsToRenderedDom(liveNow, fullMd, notes);
            } else {
              // Remove stale overlays if all notes resolved
              liveNow.querySelectorAll(".bao-note-overlay-container").forEach((el) => el.remove());
            }
          }
        }
      }, EDITOR_INPUT_DEBOUNCE_MS);
    };

    window.wireLiveMarkdown(live, () => {
      if (suppressRef.current) {
        return;
      }
      const state = useAppStore.getState();
      const tab = state.tabs.find((t) => t.id === state.activeTabId);
      normalizeVaultImagesInPlace(live, tab?.relPath ?? null);
      scheduleEditorInput();
    });

    const unImgResize = installMdImageResize(live, () => {
      if (suppressRef.current) {
        return;
      }
      const state = useAppStore.getState();
      const tab = state.tabs.find((t) => t.id === state.activeTabId);
      normalizeVaultImagesInPlace(live, tab?.relPath ?? null);
      scheduleEditorInput();
    });

    live.addEventListener("change", (ev) => {
      const t = ev.target;
      if (
        t instanceof HTMLInputElement &&
        t.type === "checkbox" &&
        t.classList.contains("md-task-cb")
      ) {
        if (!suppressRef.current) {
          const state = useAppStore.getState();
          const tab = state.tabs.find((x) => x.id === state.activeTabId);
          normalizeVaultImagesInPlace(live, tab?.relPath ?? null);
          onEditorInput();
        }
      }
    });

    setEditorBridge(bridge);

    return () => {
      if (editorInputDebounceRef.current) {
        clearTimeout(editorInputDebounceRef.current);
        editorInputDebounceRef.current = null;
      }
      document.removeEventListener("selectionchange", onSelHighlight);
      unImgResize();
      setEditorBridge(null);
      setLiveEl(null);
      setSlashDet(null);
      mdLiveRef.current = null;
      root.innerHTML = "";
    };
  }, [setEditorBridge, onEditorInput]);

  const syncKey = `${activeTabId}:${activeRelPath ?? ""}`;

  useEffect(() => {
    if (editorInputDebounceRef.current) {
      clearTimeout(editorInputDebounceRef.current);
      editorInputDebounceRef.current = null;
    }
  }, [syncKey]);

  useEffect(() => {
    if (!liveEl) {
      setSlashDet(null);
      return;
    }
    const runSlashDetect = () => {
      const sel = window.getSelection();
      if (!sel?.rangeCount || !sel.anchorNode || !liveEl.contains(sel.anchorNode)) {
        setSlashDet(null);
        return;
      }
      /* If focus moved outside the editor, don't show the menu; allow null activeElement (transient). */
      const ae = document.activeElement;
      if (ae && ae !== liveEl && !liveEl.contains(ae)) {
        setSlashDet(null);
        return;
      }
      setSlashDet(
        detectSlashCommand(liveEl, sel.anchorNode, sel.anchorOffset)
      );
    };
    const tick = rafThrottle(runSlashDetect);
    const onSlashKey = (e: KeyboardEvent) => {
      if (e.key === "/" || e.code === "NumpadDivide") {
        queueMicrotask(runSlashDetect);
      }
    };
    liveEl.addEventListener("input", runSlashDetect);
    liveEl.addEventListener("keyup", onSlashKey);
    liveEl.addEventListener("compositionend", runSlashDetect);
    document.addEventListener("selectionchange", tick);
    return () => {
      liveEl.removeEventListener("input", runSlashDetect);
      liveEl.removeEventListener("keyup", onSlashKey);
      liveEl.removeEventListener("compositionend", runSlashDetect);
      document.removeEventListener("selectionchange", tick);
    };
  }, [liveEl, syncKey]);

  useEffect(() => {
    const live = mdLiveRef.current;
    const bridge = useAppStore.getState().editorBridge;
    const tab = useAppStore
      .getState()
      .tabs.find((t) => t.id === useAppStore.getState().activeTabId);
    if (!live || !bridge || !tab) {
      return;
    }
    const notes =
      tab.relPath && tab.relPath.toLowerCase().endsWith(".md")
        ? useAppStore.getState().fileNotesByPath[tab.relPath] ?? []
        : [];
    const hasUnresolvedNote = notes.some((n) => !n.resolved);
    const isHtml = note.isHtmlRelPath(tab.relPath ?? "");
    suppressRef.current = true;
    try {
      const raw = tab.buffer ?? "";
      if (isHtml) {
        applyHtmlToEditorRoot(live, raw, tab.relPath);
      } else {
        // Render markdown normally — no markers injected
        applyMarkdownToEditorRoot(live, raw, tab.relPath);
        // Apply note highlights as the very last step, on top of the rendered DOM
        if (tab.relPath?.toLowerCase().endsWith(".md") && hasUnresolvedNote) {
          applyNoteHighlightsToRenderedDom(live, raw, notes);
        }
      }
    } finally {
      suppressRef.current = false;
    }
    live.dataset.baoNoteRelPath = tab.relPath ?? "";
    bridge.setDisabled(!tab.relPath);
  }, [syncKey, fileNotesRevision]);

  return (
    <>
      <div
        ref={rootRef}
        id="editor-root"
        className="editor-root"
        aria-label="Note editor"
      />
      <TitleTagPopover live={liveEl} />
      <SlashCommandMenu
        live={liveEl}
        detection={slashDet}
        onClearDetection={() => setSlashDet(null)}
      />
      <TableContextMenu live={liveEl} />
      <FileNotePopover liveEl={liveEl} />
    </>
  );
}

/* ─── Title Tag Popover ─── */

function TitleTagPopover({ live }: { live: HTMLElement | null }) {
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [noteTags, setNoteTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const popoverRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeRelPath = useAppStore((s) => {
    const t = s.tabs.find((x) => x.id === s.activeTabId);
    return t?.relPath ?? null;
  });

  // Load tags when path changes or popover opens
  useEffect(() => {
    if (!activeRelPath) {
      setNoteTags([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const idx = await getApi().getTagIndex();
        if (!cancelled) setNoteTags(tagCore.tagsForFile(idx, activeRelPath));
      } catch {
        if (!cancelled) setNoteTags([]);
      }
    })();
    return () => { cancelled = true; };
  }, [activeRelPath, expanded]);

  const persistNoteTags = useCallback(
    async (nextTags: string[]) => {
      if (!activeRelPath) return;
      const idx = await getApi().getTagIndex();
      const next = tagCore.setTagsForFile(idx, activeRelPath, nextTags);
      await getApi().setTagIndex(next);
      setNoteTags(tagCore.tagsForFile(next, activeRelPath));
    },
    [activeRelPath],
  );

  const addTagsFromInput = useCallback(async () => {
    const raw = tagInput.trim();
    if (!raw) return;
    const parts = raw
      .split(/[,;]+/)
      .map((s) => s.trim().toLowerCase())
      .filter((p) => p.length > 0 && !/[\\/]/.test(p));
    if (!parts.length) { setTagInput(""); return; }
    const merged = [...new Set([...noteTags, ...parts])];
    await persistNoteTags(merged);
    setTagInput("");
  }, [tagInput, noteTags, persistNoteTags]);

  const removeTag = useCallback(
    async (tag: string) => {
      await persistNoteTags(noteTags.filter((t) => t !== tag));
    },
    [noteTags, persistNoteTags],
  );

  const scheduleHide = () => {
    hideTimer.current = setTimeout(() => {
      setVisible(false);
      setExpanded(false);
      setTagInput("");
    }, 300);
  };

  const cancelHide = () => {
    if (hideTimer.current) { clearTimeout(hideTimer.current); hideTimer.current = null; }
  };

  // Attach mouseover/mouseout on the first h1 inside the live editor
  useEffect(() => {
    if (!live) return;
    const onOver = (e: MouseEvent) => {
      const h1 = live.querySelector("h1");
      if (!h1) return;
      const target = e.target as Node;
      if (h1 === target || h1.contains(target)) {
        cancelHide();
        const rect = h1.getBoundingClientRect();
        setPos({ top: rect.top, left: rect.left });
        setVisible(true);
      }
    };
    const onOut = (e: MouseEvent) => {
      const h1 = live.querySelector("h1");
      if (!h1) return;
      const related = e.relatedTarget as Node | null;
      if (related && (h1 === related || h1.contains(related))) return;
      if (related && popoverRef.current?.contains(related)) return;
      scheduleHide();
    };
    live.addEventListener("mouseover", onOver);
    live.addEventListener("mouseout", onOut);
    return () => {
      live.removeEventListener("mouseover", onOver);
      live.removeEventListener("mouseout", onOut);
    };
  }, [live]);

  if (!visible || !pos) return null;

  return (
    <div
      ref={popoverRef}
      className={`title-tag-popover${expanded ? " is-expanded" : ""}`}
      style={{ top: pos.top, left: pos.left }}
      onMouseEnter={cancelHide}
      onMouseLeave={scheduleHide}
    >
      {!expanded ? (
        <button
          type="button"
          className="title-tag-popover__trigger"
          onClick={() => setExpanded(true)}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
          {noteTags.length > 0 ? `Tags (${noteTags.length})` : "Add tags"}
        </button>
      ) : (
        <div className="title-tag-popover__body">
          {noteTags.length > 0 && (
            <ul className="title-tag-popover__list">
              {noteTags.map((tag) => (
                <li key={tag} className="title-tag-popover__tag">
                  <span className="title-tag-popover__tag-text">{tag}</span>
                  <button
                    type="button"
                    className="title-tag-popover__tag-remove"
                    aria-label={`Remove tag ${tag}`}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => void removeTag(tag)}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
          <input
            type="text"
            className="title-tag-popover__input"
            placeholder="Add tags (comma-separated, Enter)"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void addTagsFromInput();
              }
            }}
            autoFocus
          />
        </div>
      )}
    </div>
  );
}

function MarkdownSourceView() {
  const activeTabId = useAppStore((s) => s.activeTabId);
  const buffer = useAppStore((s) => {
    const t = s.tabs.find((x) => x.id === s.activeTabId);
    return t?.buffer ?? "";
  });
  const editorBridge = useAppStore((s) => s.editorBridge);
  const onEditorInput = useAppStore((s) => s.onEditorInput);
  const [draft, setDraft] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);

  // Sync store buffer into local draft on mount / tab switch
  useEffect(() => {
    // Flush the rich editor first so buffer is up-to-date
    useAppStore.getState().flushActiveBuffer();
    const t = useAppStore.getState().tabs.find((x) => x.id === useAppStore.getState().activeTabId);
    setDraft(t?.buffer ?? "");
  }, [activeTabId]);

  // When leaving source mode, push changes back
  useEffect(() => {
    return () => {
      // On unmount (toggling back to rich), push draft into the editor bridge
      const bridge = useAppStore.getState().editorBridge;
      if (bridge) {
        bridge.setMarkdown(draftRef.current, { silent: false });
      }
    };
  }, []);

  // Keep a ref so the cleanup can read the latest draft
  const draftRef = useRef(draft);
  draftRef.current = draft;

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setDraft(val);
    // Update store buffer directly so save works
    const s = useAppStore.getState();
    const id = s.activeTabId;
    if (id) {
      useAppStore.setState({
        tabs: s.tabs.map((t) =>
          t.id === id ? { ...t, buffer: val } : t
        ),
      });
    }
  };

  return (
    <div className="editor-source-view">
      <textarea
        ref={taRef}
        className="editor-source-textarea"
        value={draft}
        onChange={handleChange}
        spellCheck={false}
        aria-label="Source"
      />
    </div>
  );
}
