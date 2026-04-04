import { useCallback, useEffect, useRef, useState } from "react";
import { getApi } from "../lib/api";
import * as note from "../lib/noteUtils";
import * as tagCore from "../lib/tagIndexCore";
import { tabStripTitle } from "../lib/tabStrip";
import { useAppStore } from "../store/useAppStore";
import type { EditorTab } from "../types";

function formatFileMtime(ms: number): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(ms));
  } catch {
    return new Date(ms).toLocaleString();
  }
}

function headerFieldTitle(tab: EditorTab): string {
  if (!tab.relPath) {
    return tabStripTitle(tab, true);
  }
  if (!tab.relPath.toLowerCase().endsWith(".md")) {
    return tabStripTitle(tab, true);
  }
  const sp = note.splitLeadingAtxHeading(tab.buffer);
  return sp.headingText ?? (tab.relPath.split("/").pop() ?? tab.relPath);
}

export function EditorHeader() {
  const activeTabId = useAppStore((s) => s.activeTabId);
  const tab = useAppStore((s) => s.tabs.find((t) => t.id === activeTabId));
  const setActiveNoteTitle = useAppStore((s) => s.setActiveNoteTitle);
  const titleInputRef = useRef<HTMLInputElement>(null);

  const [titleDraft, setTitleDraft] = useState("");
  const [noteTags, setNoteTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");

  const isMdTab = Boolean(tab?.relPath?.toLowerCase().endsWith(".md"));

  useEffect(() => {
    if (!tab) {
      setTitleDraft("");
      return;
    }
    if (isMdTab && document.activeElement === titleInputRef.current) {
      return;
    }
    setTitleDraft(headerFieldTitle(tab));
  }, [activeTabId, tab, isMdTab]);

  const commitTitle = useCallback(() => {
    if (!tab?.relPath?.toLowerCase().endsWith(".md")) {
      return;
    }
    setActiveNoteTitle(titleDraft);
  }, [tab, titleDraft, setActiveNoteTitle]);

  const relPathForTags = tab?.relPath ?? null;

  useEffect(() => {
    if (!relPathForTags) {
      setNoteTags([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const idx = await getApi().getTagIndex();
        if (!cancelled) {
          setNoteTags(tagCore.tagsForFile(idx, relPathForTags));
        }
      } catch {
        if (!cancelled) {
          setNoteTags([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [relPathForTags]);

  const persistNoteTags = useCallback(
    async (nextTags: string[]) => {
      if (!relPathForTags) {
        return;
      }
      const idx = await getApi().getTagIndex();
      const next = tagCore.setTagsForFile(idx, relPathForTags, nextTags);
      await getApi().setTagIndex(next);
      setNoteTags(tagCore.tagsForFile(next, relPathForTags));
    },
    [relPathForTags]
  );

  const addTagsFromInput = useCallback(async () => {
    const raw = tagInput.trim();
    if (!raw) {
      return;
    }
    const parts = raw
      .split(/[,;]+/)
      .map((s) => s.trim().toLowerCase())
      .filter((p) => p.length > 0 && !/[\\/]/.test(p));
    if (!parts.length) {
      setTagInput("");
      return;
    }
    const merged = [...new Set([...noteTags, ...parts])];
    await persistNoteTags(merged);
    setTagInput("");
  }, [tagInput, noteTags, persistNoteTags]);

  const removeTag = useCallback(
    async (tag: string) => {
      await persistNoteTags(noteTags.filter((t) => t !== tag));
    },
    [noteTags, persistNoteTags]
  );

  if (!tab || !tab.relPath || note.isScratchPath(tab.relPath)) {
    return null;
  }

  const relPath = tab.relPath;
  const isMd = Boolean(relPath?.toLowerCase().endsWith(".md"));

  if (!isMd) {
    return null;
  }

  return (
    <header className="editor-header">

      <h1 className="editor-header__title">
          <input
            ref={titleInputRef}
            type="text"
            className="editor-header__title-input"
            data-bao-editor-title=""
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                (e.target as HTMLInputElement).blur();
              }
            }}
            aria-label="Note title"
          />
        </h1>
      {relPath ? (
        <div className="editor-header__meta">
          <div className="editor-header__tags" aria-label="Tags">
            <ul className="editor-header__tag-list">
              {noteTags.map((tag) => (
                <li key={tag} className="editor-header__tag">
                  <span className="editor-header__tag-text">{tag}</span>
                  <button
                    type="button"
                    className="editor-header__tag-remove"
                    aria-label={`Remove tag ${tag}`}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => void removeTag(tag)}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
            <input
              type="text"
              className="editor-header__tag-input"
              placeholder="Add tags (comma-separated, Enter)"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void addTagsFromInput();
                }
              }}
            />
          </div>
        </div>
      ) : null}
    </header>
  );
}
