import { useEffect } from "react";
import { useAppStore } from "./store/useAppStore";
import * as note from "./lib/noteUtils";
import { Sidebar } from "./components/Sidebar";
import { TabBar } from "./components/TabBar";

import { MarkdownEditor } from "./components/MarkdownEditor";
import { EditorErrorBoundary } from "./components/EditorErrorBoundary";
import { ImageTabViewer } from "./components/ImageTabViewer";
import { ChatPanel } from "./components/ChatPanel";
import { SettingsPage } from "./components/SettingsPage";
import { ShortcutsPage } from "./components/ShortcutsPage";
import { NewItemModal } from "./components/NewItemModal";
import { ContextMenu } from "./components/ContextMenu";
import { FileNotesDock } from "./components/FileNotesDock";
import { SelectionStyleToolbar } from "./components/SelectionStyleToolbar";
import { useGlobalShortcuts } from "./hooks/useGlobalShortcuts";
import { getApi } from "./lib/api";

export default function App() {
  useGlobalShortcuts();

  const sidebarCollapsed = useAppStore((s) => s.sidebarCollapsed);
  const chatOpen = useAppStore((s) => s.chatOpen);
  const settingsOpen = useAppStore((s) => s.settingsOpen);
  const shortcutsOpen = useAppStore((s) => s.shortcutsOpen);
  const activeTabId = useAppStore((s) => s.activeTabId);
  const activeRelPath = useAppStore((s) => {
    const t = s.tabs.find((x) => x.id === s.activeTabId);
    return t?.relPath ?? null;
  });
  const activeFileMtimeMs = useAppStore((s) => {
    const t = s.tabs.find((x) => x.id === s.activeTabId);
    return t?.fileMtimeMs ?? null;
  });
  const refreshTree = useAppStore((s) => s.refreshTree);
  const openSettings = useAppStore((s) => s.openSettings);
  const openShortcuts = useAppStore((s) => s.openShortcuts);
  const sourceMode = useAppStore((s) => s.sourceMode);
  const toggleSourceMode = useAppStore((s) => s.toggleSourceMode);

  useEffect(() => {
    void refreshTree();
  }, [refreshTree]);

  useEffect(() => {
    try {
      const api = getApi();
      if (typeof api.onTabTransferRequest !== "function") {
        return;
      }
      return api.onTabTransferRequest((payload) => {
        useAppStore.getState().handleIncomingTabTransferRequest(payload);
      });
    } catch {
      return;
    }
  }, []);

  useEffect(() => {
    const raw = window.location.hash.replace(/^#/, "");
    if (!raw) {
      return;
    }
    const rel = new URLSearchParams(raw).get("bao-open");
    if (!rel) {
      return;
    }
    try {
      window.history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search
      );
    } catch {
      /* ignore */
    }
    const path = rel.trim().replace(/\\/g, "/");
    if (!path) {
      return;
    }
    void (async () => {
      try {
        await useAppStore.getState().tryOpenFile(path);
      } catch {
        /* tryOpenFile already alerts on failure */
      }
    })();
  }, []);

  useEffect(() => {
    const onVaultFiles = () => {
      void refreshTree();
    };
    window.addEventListener("bao-vault-files-changed", onVaultFiles);
    return () =>
      window.removeEventListener("bao-vault-files-changed", onVaultFiles);
  }, [refreshTree]);

  const overlayOpen = settingsOpen || shortcutsOpen;

  const imageRelPath =
    activeRelPath && note.isImageRelPath(activeRelPath)
      ? activeRelPath
      : null;

  return (
    <div
      id="app"
      className={`app${sidebarCollapsed ? " is-sidebar-collapsed" : ""}${chatOpen ? " is-chat-open" : ""}${settingsOpen ? " is-settings-open" : ""}${shortcutsOpen ? " is-shortcuts-open" : ""}`}
    >
      <Sidebar />
      <div className="workspace" id="workspace">
        <div
          className="workspace-corner-actions"
          role="toolbar"
          aria-label="Help and settings"
        >
          {!overlayOpen ? <FileNotesDock /> : null}
          {activeRelPath?.toLowerCase().endsWith(".md") ? (
            <button
              type="button"
              className={`workspace-corner-btn${sourceMode ? " is-active" : ""}`}
              title={sourceMode ? "Rich text view" : "View markdown source"}
              aria-label={sourceMode ? "Rich text view" : "View markdown source"}
              aria-pressed={sourceMode}
              onClick={toggleSourceMode}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polyline points="16 18 22 12 16 6" />
                <polyline points="8 6 2 12 8 18" />
              </svg>
            </button>
          ) : null}
          <button
            type="button"
            className="workspace-corner-btn"
            aria-label="Keyboard shortcuts"
            title="Keyboard shortcuts"
            onClick={() => openShortcuts()}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="2" y="6" width="20" height="12" rx="2" />
              <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01" />
              <path d="M8 14h8" />
            </svg>
          </button>
          <button
            type="button"
            className="workspace-corner-btn"
            aria-label="Settings"
            title="Settings (⌘,)"
            onClick={() => openSettings()}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
        </div>
        <div
          className={`workspace-main${overlayOpen ? " hidden" : ""}`}
          id="workspace-main"
        >
          <section className="editor-panel">
            <TabBar />
            {activeRelPath ? (
              <div className="editor-path-bar" title={activeRelPath}>
                <p className="editor-path-bar__text">
                  {activeRelPath}
                  {activeFileMtimeMs != null ? (
                    <span className="editor-path-bar__mtime">
                      {" "}(Last updated{" "}
                      <time dateTime={new Date(activeFileMtimeMs).toISOString()}>
                        {new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(activeFileMtimeMs))}
                      </time>)
                    </span>
                  ) : null}
                </p>
              </div>
            ) : null}
            <div className="editor-body">
              <EditorErrorBoundary>
                {imageRelPath ? (
                  <ImageTabViewer relPath={imageRelPath} />
                ) : (
                  <MarkdownEditor />
                )}
              </EditorErrorBoundary>
            </div>
          </section>
          <ChatPanel />
        </div>
        <SettingsPage />
        <ShortcutsPage />
      </div>
      <NewItemModal />
      <ContextMenu />
      <SelectionStyleToolbar />
    </div>
  );
}
