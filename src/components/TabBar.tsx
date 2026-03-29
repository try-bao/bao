import { useCallback, useEffect, useRef, useState } from "react";
import {
  selectTabStripRows,
  tabStripRowsEqual,
} from "../lib/tabStrip";
import { getApi } from "../lib/api";
import { useAppStore } from "../store/useAppStore";

const TAB_DND_MIME = "application/x-bao-tab";

type TabDragPayload = {
  fromIndex: number;
  tabId?: string;
  relPath?: string | null;
  sourceWebContentsId?: number;
};

function parseTabDragPayload(e: React.DragEvent): TabDragPayload | null {
  let raw = e.dataTransfer.getData(TAB_DND_MIME);
  if (!raw) {
    raw = e.dataTransfer.getData("text/plain");
  }
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as TabDragPayload;
  } catch {
    return null;
  }
}

function insertIndexFromTabEvent(
  e: React.DragEvent,
  tabIndex: number
): number {
  const el = e.currentTarget as HTMLElement;
  const rect = el.getBoundingClientRect();
  const mid = rect.left + rect.width / 2;
  return e.clientX < mid ? tabIndex : tabIndex + 1;
}

/** Lets a cross-window drop close the source tab before we decide to tear off. */
const TEAR_OFF_DEFER_MS = 280;

function notifyTabDragEndMain() {
  try {
    getApi().notifyTabDragEnd();
  } catch {
    /* no preload */
  }
}

export function TabBar() {
  const strip = useAppStore(selectTabStripRows, tabStripRowsEqual);
  const activeTabId = useAppStore((s) => s.activeTabId);
  const switchToTab = useAppStore((s) => s.switchToTab);
  const closeTab = useAppStore((s) => s.closeTab);
  const moveTabToIndex = useAppStore((s) => s.moveTabToIndex);
  const openNewTabModal = useAppStore((s) => s.openNewTabModal);
  const toggleChat = useAppStore((s) => s.toggleChat);
  const chatOpen = useAppStore((s) => s.chatOpen);

  const listRef = useRef<HTMLDivElement>(null);
  const internalDropRef = useRef(false);
  const dragTabIdRef = useRef<string | null>(null);
  const wcIdRef = useRef<number | null>(null);

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropIndicatorIndex, setDropIndicatorIndex] = useState<number | null>(
    null
  );

  useEffect(() => {
    try {
      const api = getApi();
      if (typeof api.getWebContentsId !== "function") {
        return;
      }
      void api.getWebContentsId().then((id) => {
        wcIdRef.current = id;
      });
    } catch {
      /* no preload */
    }
  }, []);

  const onTabDragStart = useCallback(
    (tabId: string, fromIndex: number, relPath: string | null) =>
      (e: React.DragEvent) => {
        internalDropRef.current = false;
        dragTabIdRef.current = tabId;
        const payload: TabDragPayload = {
          fromIndex,
          tabId,
          relPath,
          sourceWebContentsId: wcIdRef.current ?? undefined,
        };
        const s = JSON.stringify(payload);
        e.dataTransfer.setData(TAB_DND_MIME, s);
        e.dataTransfer.setData("text/plain", s);
        e.dataTransfer.effectAllowed = "move";
        setDraggingId(tabId);
        try {
          getApi().notifyTabDragStart({ relPath, tabId, fromIndex });
        } catch {
          /* no preload */
        }
      },
    []
  );

  const onTabDragOver = useCallback(
    (tabIndex: number) => (e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setDropIndicatorIndex(insertIndexFromTabEvent(e, tabIndex));
    },
    []
  );

  const onTabDrop = useCallback(
    (tabIndex: number) => (e: React.DragEvent) => {
      e.preventDefault();
      internalDropRef.current = true;
      const insertIndex = insertIndexFromTabEvent(e, tabIndex);
      const parsed = parseTabDragPayload(e);

      const finish = () => {
        setDraggingId(null);
        setDropIndicatorIndex(null);
        notifyTabDragEndMain();
      };

      /* dataTransfer is usually populated for drags within the same window */
      if (parsed && typeof parsed.fromIndex === "number") {
        const myId = wcIdRef.current;
        const sourceWin =
          typeof parsed.sourceWebContentsId === "number"
            ? parsed.sourceWebContentsId
            : null;
        /** Require both IDs — `5 !== null` is true and wrongly looked "cross-window". */
        const looksCrossWindow =
          sourceWin !== null &&
          typeof myId === "number" &&
          Boolean(parsed.relPath) &&
          sourceWin !== myId;

        if (looksCrossWindow && parsed.relPath) {
          void (async () => {
            try {
              const api = getApi();
              const result = await api.requestTabTransfer({
                sourceWebContentsId: sourceWin,
                relPath: parsed.relPath!,
                insertIndex,
              });
              if (!result.ok) {
                if (!result.cancelled) {
                  window.alert(
                    result.error ?? "Could not move tab into this window."
                  );
                }
              } else {
                useAppStore.getState().importTransferredTab({
                  relPath: parsed.relPath!,
                  buffer: result.buffer,
                  lastSavedContent: result.lastSavedContent,
                  insertIndex,
                });
              }
            } catch (err) {
              window.alert(
                err instanceof Error
                  ? err.message
                  : "Could not move tab into this window."
              );
            } finally {
              finish();
            }
          })();
          return;
        }

        if (parsed.fromIndex !== insertIndex) {
          moveTabToIndex(parsed.fromIndex, insertIndex);
        }
        finish();
        return;
      }

      /**
       * Between BrowserWindows, Chromium often gives empty getData() on drop.
       * Main process keeps the dragged tab in sync via notifyTabDragStart.
       */
      void (async () => {
        try {
          const api = getApi();
          const r = await api.consumePendingTabDrag(insertIndex);
          if (r.kind === "empty") {
            return;
          }
          if (r.kind === "same-window") {
            if (r.fromIndex !== insertIndex) {
              moveTabToIndex(r.fromIndex, insertIndex);
            }
            return;
          }
          if (r.kind === "error") {
            window.alert(r.message);
            return;
          }
          if (r.kind === "cross-window") {
            const { result, relPath } = r;
            if (!result.ok) {
              if (!result.cancelled) {
                window.alert(
                  result.error ?? "Could not move tab into this window."
                );
              }
              return;
            }
            useAppStore.getState().importTransferredTab({
              relPath,
              buffer: result.buffer,
              lastSavedContent: result.lastSavedContent,
              insertIndex,
            });
          }
        } catch (err) {
          window.alert(
            err instanceof Error
              ? err.message
              : "Could not move tab into this window."
          );
        } finally {
          finish();
        }
      })();
    },
    [moveTabToIndex]
  );

  const handleTabDragEnd = useCallback((e: React.DragEvent) => {
    const tabId = dragTabIdRef.current;
    dragTabIdRef.current = null;
    setDraggingId(null);
    setDropIndicatorIndex(null);

    const x = e.clientX;
    const y = e.clientY;

    /**
     * `dragend` can run before `drop` in Electron. Defer cleanup/tear-off so
     * `internalDropRef` is set and main `pendingTabDrag` is still valid for consume.
     */
    window.setTimeout(() => {
      notifyTabDragEndMain();

      if (internalDropRef.current) {
        internalDropRef.current = false;
        return;
      }

      if (!tabId) {
        return;
      }

      window.setTimeout(() => {
        if (internalDropRef.current) {
          internalDropRef.current = false;
          return;
        }

        const tab = useAppStore.getState().tabs.find((t) => t.id === tabId);
        if (!tab?.relPath) {
          return;
        }
        const listEl = listRef.current;
        if (!listEl) {
          return;
        }
        const rect = listEl.getBoundingClientRect();
        const inside =
          x >= rect.left &&
          x <= rect.right &&
          y >= rect.top &&
          y <= rect.bottom;
        if (inside) {
          return;
        }
        void useAppStore.getState().tearOffTabToNewWindow(tabId);
      }, TEAR_OFF_DEFER_MS);
    }, 0);
  }, []);

  return (
    <div className="editor-tabs-strip">
      <div className="editor-tabs-bar">
        <div className="editor-tabs">
          <div
            ref={listRef}
            className="editor-tabs-list"
            role="tablist"
            aria-label="Open notes"
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
            }}
          >
            {strip.map((tab, i) => {
              const active = tab.id === activeTabId;
              const dirty = tab.dirty;
              const loneEmpty =
                strip.length === 1 && !tab.relPath && !dirty;
              const isDragging = tab.id === draggingId;
              const insertBefore =
                dropIndicatorIndex !== null && dropIndicatorIndex === i;
              const insertAfterLast =
                dropIndicatorIndex !== null &&
                dropIndicatorIndex === strip.length &&
                i === strip.length - 1;

              return (
                <div
                  key={tab.id}
                  className={`editor-tab${active ? " is-active" : ""}${!tab.relPath ? " is-empty" : ""}${isDragging ? " is-dragging" : ""}${insertBefore ? " is-drop-before" : ""}${insertAfterLast ? " is-drop-after" : ""}`}
                  role="tab"
                  aria-selected={active ? "true" : "false"}
                  aria-label={
                    tab.relPath ? `${tab.title}, ${tab.relPath}` : tab.title
                  }
                  data-tab-id={tab.id}
                  draggable
                  onDragStart={onTabDragStart(tab.id, i, tab.relPath)}
                  onDragOver={onTabDragOver(i)}
                  onDrop={onTabDrop(i)}
                  onDragEnd={handleTabDragEnd}
                  onClick={(ev) => {
                    if (
                      (ev.target as HTMLElement).closest(".editor-tab-close")
                    ) {
                      return;
                    }
                    switchToTab(tab.id);
                  }}
                >
                  <div className="editor-tab-text">
                    <div className="editor-tab-title-row">
                      <span
                        className="editor-tab-dirty"
                        hidden={!dirty}
                        title="Unsaved changes"
                        aria-hidden="true"
                      />
                      <span className="editor-tab-title">{tab.title}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="editor-tab-close"
                    aria-label={
                      tab.relPath
                        ? `Close ${tab.title} (${tab.relPath})`
                        : `Close ${tab.title}`
                    }
                    draggable={false}
                    disabled={loneEmpty}
                    onClick={(ev) => {
                      ev.stopPropagation();
                      closeTab(tab.id);
                    }}
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
          <button
            type="button"
            className="editor-tab-add"
            aria-label="New note"
            title="New note"
            onClick={() => openNewTabModal()}
          >
            +
          </button>
        </div>
        <div className="editor-tabs-actions">
          <button
            type="button"
            className={`btn-chat-toggle${chatOpen ? " is-active" : ""}`}
            aria-expanded={chatOpen ? "true" : "false"}
            aria-controls="chat-panel"
            title={chatOpen ? "Close assistant" : "Open assistant"}
            onClick={() => toggleChat()}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="5" y="8" width="14" height="11" rx="2" />
              <path d="M9 8V6a3 3 0 0 1 6 0v2" />
              <circle cx="10" cy="13" r="1" fill="currentColor" stroke="none" />
              <circle cx="14" cy="13" r="1" fill="currentColor" stroke="none" />
              <path d="M10 17h4" />
              <path d="M12 3v2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
