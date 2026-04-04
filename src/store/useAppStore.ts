import { createWithEqualityFn } from "zustand/traditional";
import { getApi } from "../lib/api";
import * as note from "../lib/noteUtils";
import {
  copyFileNotesSidecar,
  deleteAllFileNotesSidecarsForMd,
  readFileNotesIfPresent,
  remapFileNotesStateKey,
  renameFileNotesSidecar,
  writeFileNotes,
  adjustNoteIndicesForEdit,
  type FileNoteEntry,
} from "../lib/fileNotes";
import {
  syncTagIndexRemove,
  syncTagIndexRename,
} from "../lib/tagIndexOps";
import type {
  ChatBubble,
  ContextRenameTarget,
  EditorBridge,
  EditorTab,
  TabTransferYield,
  TreeSelection,
  BaoTreeNode,
} from "../types";

const CHAT_OPEN_KEY = "bao-chat-open";
const SIDEBAR_COLLAPSED_KEY = "bao-sidebar-collapsed";

function flattenTree(nodes: BaoTreeNode[]): BaoTreeNode[] {
  const out: BaoTreeNode[] = [];
  const stack = [...nodes];
  while (stack.length) {
    const n = stack.pop()!;
    out.push(n);
    if (n.children) stack.push(...n.children);
  }
  return out;
}

let tabIdSeq = 1;
function newTabId(): string {
  tabIdSeq += 1;
  return `tab-${tabIdSeq}`;
}

async function getFileMtimeMsSafe(relPath: string): Promise<number | null> {
  try {
    return await getApi().getFileMtimeMs(relPath);
  } catch {
    return null;
  }
}

function readSidebarCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

function readChatOpenPref(): boolean {
  try {
    return localStorage.getItem(CHAT_OPEN_KEY) === "1";
  } catch {
    return false;
  }
}

const initialTabId = "tab-1";

function getActiveTabFrom(
  tabs: EditorTab[],
  activeTabId: string | null
): EditorTab | null {
  return tabs.find((t) => t.id === activeTabId) ?? null;
}

interface ContextMenuState {
  x: number;
  y: number;
  parentRel: string;
  renameTarget: ContextRenameTarget | null;
}

interface ModalState {
  open: boolean;
  mode: "file" | "folder" | "rename" | null;
  title: string;
  hint: string;
  defaultValue: string;
  confirmLabel: string;
  renameFromRel: string | null;
  forcedParent: string | undefined;
}

interface AppState {
  editorBridge: EditorBridge | null;
  setEditorBridge: (b: EditorBridge | null) => void;

  tabs: EditorTab[];
  activeTabId: string | null;
  expanded: Record<string, boolean>;
  selection: TreeSelection | null;
  multiSelection: TreeSelection[];
  newItemParent: string;
  clipboardNoteRelPath: string | null;

  sidebarCollapsed: boolean;
  chatOpen: boolean;
  settingsOpen: boolean;
  shortcutsOpen: boolean;

  /** Current search query for highlighting in the editor */
  searchHighlightQuery: string;
  setSearchHighlightQuery: (q: string) => void;

  sourceMode: boolean;
  toggleSourceMode: () => void;

  treeNodes: BaoTreeNode[];
  treeError: string | null;

  contextMenu: ContextMenuState | null;
  hideContextMenu: () => void;
  showContextMenu: (p: ContextMenuState) => void;

  modal: ModalState;
  setModalInputSync: (v: string) => void;
  modalInputValue: string;

  chatMessages: ChatBubble[];

  vaultPathDisplay: string | null;

  flushActiveBuffer: () => void;
  onEditorInput: () => void;
  setActiveNoteTitle: (headingText: string) => void;
  switchToTab: (id: string) => void;
  moveTabToIndex: (fromIndex: number, insertIndex: number) => void;
  tearOffTabToNewWindow: (tabId: string) => Promise<void>;
  handleIncomingTabTransferRequest: (payload: {
    requestId: string;
    relPath: string;
    insertIndex: number;
  }) => void;
  importTransferredTab: (opts: {
    relPath: string;
    buffer: string;
    lastSavedContent: string;
    insertIndex: number;
  }) => Promise<void>;
  closeTab: (tabId: string, opts?: { skipDirtyCheck?: boolean }) => void;
  openNewTabModal: () => void;
  openModalFile: (forcedParent?: string) => void;
  openModalFolder: (forcedParent?: string) => void;
  openRenameModal: (target: ContextRenameTarget) => void;
  closeModal: () => void;
  confirmModal: (inputValue: string) => Promise<void>;

  setSidebarCollapsed: (v: boolean) => void;
  toggleSidebar: () => void;
  setChatOpen: (v: boolean) => void;
  toggleChat: () => void;
  openSettings: () => void;
  closeSettings: () => void;
  openShortcuts: () => void;
  closeShortcuts: () => void;

  refreshTree: () => Promise<void>;
  toggleExpanded: (relPath: string) => void;
  setSelection: (s: TreeSelection | null, newItemParent: string) => void;
  setMultiSelection: (s: TreeSelection[]) => void;
  tryOpenFile: (relPath: string) => Promise<void>;
  save: () => Promise<void>;
  deleteContextItem: (target: ContextRenameTarget) => Promise<void>;
  deleteMultiSelection: () => Promise<void>;
  duplicateNoteAtPath: (src: string) => Promise<void>;
  duplicateFromClipboard: () => Promise<void>;
  handleTreeDrop: (e: React.DragEvent) => Promise<void>;
  expandAncestors: (relPath: string) => void;

  appendChatBubble: (role: "user" | "assistant", text: string) => void;
  sendChatMessage: (text: string) => void;

  setClipboardNote: (relPath: string | null) => void;
  loadVaultPath: () => Promise<void>;
  changeVault: () => Promise<void>;
  openVault: (dir: string) => Promise<void>;
  closeVault: () => void;

  fileNotesByPath: Record<string, FileNoteEntry[]>;
  fileNotesRevision: number;
  loadFileNotesForPath: (relPath: string) => Promise<void>;
  addFileNote: (
    relPath: string,
    index: [number, number],
    value: string
  ) => Promise<void>;
  setFileNoteResolved: (
    relPath: string,
    noteIndex: number,
    resolved: boolean
  ) => Promise<void>;
}

export const useAppStore = createWithEqualityFn<AppState>((set, get) => ({
  editorBridge: null,
  setEditorBridge: (b) => set({ editorBridge: b }),

  tabs: [
    {
      id: initialTabId,
      relPath: null,
      buffer: "",
      lastSavedContent: "",
      fileMtimeMs: null,
    },
  ],
  activeTabId: initialTabId,
  expanded: {},
  selection: null,
  multiSelection: [],
  newItemParent: "",
  clipboardNoteRelPath: null,

  sidebarCollapsed: readSidebarCollapsed(),
  chatOpen: readChatOpenPref(),
  settingsOpen: false,
  shortcutsOpen: false,

  searchHighlightQuery: "",
  setSearchHighlightQuery: (q) => set({ searchHighlightQuery: q }),

  treeNodes: [],
  treeError: null,

  contextMenu: null,
  hideContextMenu: () => set({ contextMenu: null }),
  showContextMenu: (p) => set({ contextMenu: p }),

  modal: {
    open: false,
    mode: null,
    title: "",
    hint: "",
    defaultValue: "",
    confirmLabel: "Create",
    renameFromRel: null,
    forcedParent: undefined,
  },
  modalInputValue: "",
  setModalInputSync: (v) => set({ modalInputValue: v }),

  chatMessages: [],

  vaultPathDisplay: null,

  fileNotesByPath: {},
  fileNotesRevision: 0,

  loadFileNotesForPath: async (relPath) => {
    if (!relPath.toLowerCase().endsWith(".md")) {
      return;
    }
    const api = getApi();
    const list = await readFileNotesIfPresent(api, relPath);
    set((s) => ({
      fileNotesByPath: { ...s.fileNotesByPath, [relPath]: list },
      fileNotesRevision: s.fileNotesRevision + 1,
    }));
  },

  addFileNote: async (relPath, index, value) => {
    const api = getApi();
    const s = get();
    const prev = s.fileNotesByPath[relPath] ?? [];
    const next = [...prev, { index, value, resolved: false, createdAt: new Date().toISOString() }];
    await writeFileNotes(api, relPath, next);
    set({
      fileNotesByPath: { ...s.fileNotesByPath, [relPath]: next },
      fileNotesRevision: s.fileNotesRevision + 1,
    });
  },

  setFileNoteResolved: async (relPath, noteIndex, resolved) => {
    const api = getApi();
    const s = get();
    const prev = s.fileNotesByPath[relPath] ?? [];
    if (!prev[noteIndex]) {
      return;
    }
    const next = prev.map((n, i) =>
      i === noteIndex ? { ...n, resolved } : n
    );
    await writeFileNotes(api, relPath, next);
    set({
      fileNotesByPath: { ...s.fileNotesByPath, [relPath]: next },
      fileNotesRevision: s.fileNotesRevision + 1,
    });
  },

  flushActiveBuffer: () => {
    const s = get();
    const bridge = s.editorBridge;
    const id = s.activeTabId;
    if (!bridge || !id) {
      return;
    }
    const md = bridge.getMarkdown();
    set({
      tabs: s.tabs.map((t) => (t.id === id ? { ...t, buffer: md } : t)),
    });
  },

  onEditorInput: () => {
    const s = get();
    const tab = getActiveTabFrom(s.tabs, s.activeTabId);
    if (!tab?.relPath) {
      return;
    }
    const md = s.editorBridge?.getMarkdown() ?? "";

    // Adjust note character offsets so they track the annotated text.
    // We intentionally do NOT bump fileNotesRevision here — that would
    // trigger the sync effect which re-renders the entire editor DOM and
    // destroys the cursor.  Overlay refresh is handled by the editor
    // input callback in MarkdownEditor.
    const isMd = tab.relPath.toLowerCase().endsWith(".md");
    const oldBody = isMd ? note.bodyMarkdownForEditor(tab.buffer) : tab.buffer;
    const newBody = isMd ? note.bodyMarkdownForEditor(md) : md;
    const prevNotes = s.fileNotesByPath[tab.relPath];
    const adjusted = prevNotes
      ? adjustNoteIndicesForEdit(prevNotes, oldBody, newBody)
      : null;

    const updates: Record<string, unknown> = {
      tabs: s.tabs.map((t) =>
        t.id === tab.id ? { ...t, buffer: md } : t
      ),
    };

    if (adjusted) {
      updates.fileNotesByPath = { ...s.fileNotesByPath, [tab.relPath!]: adjusted };
      // Persist adjusted indices in the background
      const api = getApi();
      const relPath = tab.relPath!;
      void writeFileNotes(api, relPath, adjusted);
    }

    set(updates as any);
  },

  setActiveNoteTitle: (headingText) => {
    const s = get();
    const tab = getActiveTabFrom(s.tabs, s.activeTabId);
    if (!tab?.relPath || !tab.relPath.toLowerCase().endsWith(".md")) {
      return;
    }
    get().flushActiveBuffer();
    const t2 = getActiveTabFrom(get().tabs, get().activeTabId);
    if (!t2?.relPath || !t2.relPath.toLowerCase().endsWith(".md")) {
      return;
    }
    const split = note.splitLeadingAtxHeading(t2.buffer);
    const next = note.mergeLeadingAtxHeading(
      split.level,
      headingText,
      split.body
    );
    set({
      tabs: get().tabs.map((x) =>
        x.id === t2.id ? { ...x, buffer: next } : x
      ),
    });
  },

  moveTabToIndex: (fromIndex, insertIndex) => {
    const tabs = get().tabs;
    if (fromIndex < 0 || fromIndex >= tabs.length) {
      return;
    }
    if (insertIndex < 0 || insertIndex > tabs.length) {
      return;
    }
    const next = [...tabs];
    const [item] = next.splice(fromIndex, 1);
    let dest = insertIndex;
    if (insertIndex > fromIndex) {
      dest = insertIndex - 1;
    }
    next.splice(dest, 0, item);
    set({ tabs: next });
  },

  tearOffTabToNewWindow: async (tabId) => {
    const s0 = get();
    const tab = s0.tabs.find((t) => t.id === tabId);
    if (!tab?.relPath) {
      return;
    }
    if (s0.activeTabId === tabId) {
      get().flushActiveBuffer();
    }
    const t = get().tabs.find((x) => x.id === tabId);
    if (!t?.relPath) {
      return;
    }
    if (note.isTabDirty(t)) {
      const ok = window.confirm(
        "Discard unsaved changes and open this note in a new window?"
      );
      if (!ok) {
        return;
      }
    }
    const api = getApi();
    try {
      await api.openFileInNewWindow(t.relPath);
    } catch (err) {
      window.alert(
        err instanceof Error ? err.message : "Could not open a new window."
      );
      return;
    }
    get().closeTab(tabId, { skipDirtyCheck: true });
  },

  handleIncomingTabTransferRequest: ({
    requestId,
    relPath,
  }) => {
    const api = getApi();
    const send = (r: TabTransferYield) => {
      api.sendTabTransferResult(requestId, r);
    };
    const tab = get().tabs.find((t) => t.relPath === relPath);
    if (!tab) {
      send({ ok: false, error: "Tab not found in source window" });
      return;
    }
    if (get().activeTabId === tab.id) {
      get().flushActiveBuffer();
    }
    const t = get().tabs.find((x) => x.id === tab.id);
    if (!t?.relPath) {
      send({ ok: false, error: "Tab not found" });
      return;
    }
    if (note.isTabDirty(t)) {
      const ok = window.confirm(
        "Move this tab into the other window? Unsaved changes will be carried over."
      );
      if (!ok) {
        send({ ok: false, cancelled: true });
        return;
      }
    }
    const buffer = t.buffer;
    const lastSavedContent = t.lastSavedContent;
    get().closeTab(tab.id, { skipDirtyCheck: true });
    send({ ok: true, buffer, lastSavedContent });
  },

  importTransferredTab: async ({
    relPath,
    buffer,
    lastSavedContent,
    insertIndex,
  }) => {
    get().flushActiveBuffer();
    const tabs = get().tabs;
    const mtime = await getFileMtimeMsSafe(relPath);
    const existingIdx = tabs.findIndex((t) => t.relPath === relPath);
    if (existingIdx >= 0) {
      const tab = tabs[existingIdx];
      const id = tab.id;
      set({
        tabs: tabs.map((t) =>
          t.id === id ? { ...t, buffer, lastSavedContent, fileMtimeMs: mtime } : t
        ),
      });
      const fromIdx = get().tabs.findIndex((x) => x.id === id);
      get().moveTabToIndex(fromIdx, insertIndex);
      get().switchToTab(id);
      return;
    }
    const id = newTabId();
    const next = [...tabs];
    const clamped = Math.max(0, Math.min(insertIndex, next.length));
    next.splice(clamped, 0, {
      id,
      relPath,
      buffer,
      lastSavedContent,
      fileMtimeMs: mtime,
    });
    set({ tabs: next, activeTabId: id });
    const bridge = get().editorBridge;
    if (relPath && note.isImageRelPath(relPath)) {
      bridge?.setMarkdown("", { silent: true });
      bridge?.setDisabled(true);
    } else {
      bridge?.setMarkdown(buffer, { silent: true });
      bridge?.setDisabled(false);
    }
    set({
      selection: { relPath, isDirectory: false },
      newItemParent: note.parentRel(relPath),
    });
    if (relPath.toLowerCase().endsWith(".md")) {
      await get().loadFileNotesForPath(relPath);
    }
  },

  switchToTab: (id) => {
    if (id === get().activeTabId) {
      return;
    }
    get().flushActiveBuffer();
    const s = get();
    const next = s.tabs.find((t) => t.id === id);
    if (!next) {
      return;
    }
    set({ activeTabId: id });
    const bridge = get().editorBridge;
    if (next.relPath && note.isImageRelPath(next.relPath)) {
      bridge?.setMarkdown("", { silent: true });
      bridge?.setDisabled(true);
    } else {
      bridge?.setMarkdown(next.buffer, { silent: true });
      bridge?.setDisabled(!next.relPath);
    }
    const tab = getActiveTabFrom(get().tabs, id);
    if (tab?.relPath) {
      set({
        selection: { relPath: tab.relPath, isDirectory: false },
        newItemParent: note.parentRel(tab.relPath),
      });
    }
  },

  closeTab: (tabId, opts = {}) => {
    const s0 = get();
    const tab = s0.tabs.find((t) => t.id === tabId);
    if (!tab) {
      return;
    }
    if (s0.activeTabId === tabId) {
      get().flushActiveBuffer();
    }
    const tAfterFlush = get().tabs.find((x) => x.id === tabId)!;
    if (note.isTabDirty(tAfterFlush) && !opts.skipDirtyCheck) {
      const ok = window.confirm(
        "Discard unsaved changes and close this tab?"
      );
      if (!ok) {
        return;
      }
    }
    const s1 = get();
    if (s1.tabs.length === 1) {
      const cleared = {
        ...tAfterFlush,
        relPath: null,
        buffer: "",
        lastSavedContent: "",
        fileMtimeMs: null,
      };
      set({
        tabs: [cleared],
        activeTabId: cleared.id,
      });
      get().editorBridge?.setMarkdown("", { silent: true });
      get().editorBridge?.setDisabled(true);
      return;
    }
    const idx = s1.tabs.findIndex((t) => t.id === tabId);
    const nextTabs = s1.tabs.filter((t) => t.id !== tabId);
    let nextActive = s1.activeTabId;
    if (s1.activeTabId === tabId) {
      const neighbor = s1.tabs[Math.max(0, idx - 1)] ?? nextTabs[0];
      nextActive = neighbor.id;
    }
    const nextTab = nextTabs.find((t) => t.id === nextActive)!;
    set({ tabs: nextTabs, activeTabId: nextActive });
    const bridge = get().editorBridge;
    if (nextTab.relPath && note.isImageRelPath(nextTab.relPath)) {
      bridge?.setMarkdown("", { silent: true });
      bridge?.setDisabled(true);
    } else {
      bridge?.setMarkdown(nextTab.buffer, { silent: true });
      bridge?.setDisabled(!nextTab.relPath);
    }
    if (nextTab.relPath) {
      set({
        selection: { relPath: nextTab.relPath, isDirectory: false },
        newItemParent: note.parentRel(nextTab.relPath),
      });
    }
  },

  openNewTabModal: () => {
    const s = get();
    const vaultRoot = s.vaultPathDisplay || "";
    const absPath = s.newItemParent ? `${vaultRoot}/${s.newItemParent}` : vaultRoot;
    set({
      modal: {
        open: true,
        mode: "file",
        title: "New document",
        hint: `Creates a Markdown file in: ${absPath}`,
        defaultValue: "Untitled",
        confirmLabel: "Create",
        renameFromRel: null,
        forcedParent: undefined,
      },
      modalInputValue: "Untitled",
    });
  },

  openModalFile: (forcedParent) => {
    const s = get();
    const parent =
      forcedParent !== undefined ? forcedParent : s.newItemParent;
    if (forcedParent !== undefined) {
      set({ newItemParent: parent });
    }
    const vaultRoot = s.vaultPathDisplay || "";
    const absPath = parent ? `${vaultRoot}/${parent}` : vaultRoot;
    set({
      modal: {
        open: true,
        mode: "file",
        title: "New document",
        hint: `Creates a Markdown file in: ${absPath}`,
        defaultValue: "Untitled",
        confirmLabel: "Create",
        renameFromRel: null,
        forcedParent,
      },
      modalInputValue: "Untitled",
    });
  },

  openModalFolder: (forcedParent) => {
    const s = get();
    const parent =
      forcedParent !== undefined ? forcedParent : s.newItemParent;
    if (forcedParent !== undefined) {
      set({ newItemParent: parent });
    }
    const vaultRoot = s.vaultPathDisplay || "";
    const absPath = parent ? `${vaultRoot}/${parent}` : vaultRoot;
    set({
      modal: {
        open: true,
        mode: "folder",
        title: "New folder",
        hint: `Creates a folder in: ${absPath}`,
        defaultValue: "New folder",
        confirmLabel: "Create",
        renameFromRel: null,
        forcedParent,
      },
      modalInputValue: "New folder",
    });
  },

  openRenameModal: (target) => {
    const base = target.isDirectory
      ? target.name
      : target.name.replace(/\.md$/i, "");
    set({
      modal: {
        open: true,
        mode: "rename",
        title: "Rename",
        hint: target.relPath,
        defaultValue: base,
        confirmLabel: "Rename",
        renameFromRel: target.relPath,
        forcedParent: undefined,
      },
      modalInputValue: base,
    });
  },

  closeModal: () =>
    set({
      modal: {
        open: false,
        mode: null,
        title: "",
        hint: "",
        defaultValue: "",
        confirmLabel: "Create",
        renameFromRel: null,
        forcedParent: undefined,
      },
      modalInputValue: "",
    }),

  confirmModal: async (inputValue) => {
    const api = getApi();
    const s = get();
    const m = s.modal;
    const name = inputValue.trim();

    if (m.mode === "rename") {
      if (!name || !m.renameFromRel) {
        get().closeModal();
        return;
      }
      try {
        const { newRelPath } = await api.renameItem(m.renameFromRel, name);
        await syncTagIndexRename(m.renameFromRel, newRelPath);
        await renameFileNotesSidecar(api, m.renameFromRel, newRelPath);
        set((st) => ({
          tabs: note.remapOpenTabsAfterMove(
            st.tabs,
            m.renameFromRel!,
            newRelPath
          ),
          selection: note.remapSelectionAfterMove(
            st.selection,
            m.renameFromRel!,
            newRelPath
          ),
          fileNotesByPath: remapFileNotesStateKey(
            st.fileNotesByPath,
            m.renameFromRel!,
            newRelPath
          ),
          fileNotesRevision: st.fileNotesRevision + 1,
        }));
        get().closeModal();
        await get().refreshTree();
      } catch (err) {
        window.alert(
          err instanceof Error ? err.message : "Could not rename."
        );
      }
      return;
    }

    if (!name || !m.mode) {
      get().closeModal();
      return;
    }

    const parent =
      m.forcedParent !== undefined ? m.forcedParent : s.newItemParent;

    try {
      if (m.mode === "folder") {
        await api.createFolder(parent, name);
        get().expandAncestors(parent);
        const folderRel = parent ? `${parent}/${name}` : name;
        set((st) => ({
          expanded: { ...st.expanded, [folderRel]: true },
        }));
      } else {
        await api.createFile(parent, name);
        get().expandAncestors(parent);
        const rel = parent
          ? `${parent}/${note.mdFileName(name)}`.replace(/\\/g, "/")
          : note.mdFileName(name);
        await get().tryOpenFile(rel);
      }
      get().closeModal();
      await get().refreshTree();
    } catch (err) {
      window.alert(
        err instanceof Error ? err.message : "Could not create item."
      );
    }
  },

  setSidebarCollapsed: (collapsed) => {
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
    set({ sidebarCollapsed: collapsed });
  },

  toggleSidebar: () => {
    get().setSidebarCollapsed(!get().sidebarCollapsed);
  },

  setChatOpen: (open) => {
    try {
      localStorage.setItem(CHAT_OPEN_KEY, open ? "1" : "0");
    } catch {
      /* ignore */
    }
    set({ chatOpen: open });
  },

  toggleChat: () => get().setChatOpen(!get().chatOpen),

  openSettings: () => {
    set({
      settingsOpen: true,
      shortcutsOpen: false,
    });
    void get().loadVaultPath();
  },
  closeSettings: () => set({ settingsOpen: false }),
  openShortcuts: () =>
    set({
      shortcutsOpen: true,
      settingsOpen: false,
    }),
  closeShortcuts: () => set({ shortcutsOpen: false }),

  sourceMode: false,
  toggleSourceMode: () => set((s) => ({ sourceMode: !s.sourceMode })),

  refreshTree: async () => {
    const api = getApi();
    try {
      const tree = await api.listTree();
      set({ treeNodes: tree, treeError: null });
    } catch {
      set({ treeNodes: [], treeError: "Could not load files." });
    }
  },

  toggleExpanded: (relPath) =>
    set((s) => ({
      expanded: { ...s.expanded, [relPath]: !s.expanded[relPath] },
    })),

  setSelection: (sel, nip) => set({ selection: sel, multiSelection: [], newItemParent: nip }),
  setMultiSelection: (s) => set({ multiSelection: s }),

  tryOpenFile: async (relPath) => {
    const api = getApi();
    const existing = get().tabs.find((t) => t.relPath === relPath);
    if (existing) {
      get().switchToTab(existing.id);
      return;
    }
    if (note.isImageRelPath(relPath)) {
      try {
        const ok = await api.pathExists(relPath);
        if (!ok) {
          throw new Error("File does not exist.");
        }
      } catch (err) {
        window.alert(
          err instanceof Error ? err.message : "Could not open file."
        );
        return;
      }
      const imageMtime = await getFileMtimeMsSafe(relPath);
      get().flushActiveBuffer();
      const s = get();
      const active = getActiveTabFrom(s.tabs, s.activeTabId);
      const reuse =
        active &&
        !active.relPath &&
        !note.isTabDirty(active) &&
        active.buffer === "";
      if (reuse) {
        const updated = {
          ...active,
          relPath,
          buffer: "",
          lastSavedContent: "",
          fileMtimeMs: imageMtime,
        };
        set({
          tabs: s.tabs.map((t) => (t.id === active.id ? updated : t)),
        });
        get().editorBridge?.setMarkdown("", { silent: true });
        get().editorBridge?.setDisabled(true);
        set({
          selection: { relPath, isDirectory: false },
          newItemParent: note.parentRel(relPath),
        });
        return;
      }
      const id = newTabId();
      const s2 = get();
      set({
        tabs: [
          ...s2.tabs,
          {
            id,
            relPath,
            buffer: "",
            lastSavedContent: "",
            fileMtimeMs: imageMtime,
          },
        ],
        activeTabId: id,
      });
      get().editorBridge?.setMarkdown("", { silent: true });
      get().editorBridge?.setDisabled(true);
      set({
        selection: { relPath, isDirectory: false },
        newItemParent: note.parentRel(relPath),
      });
      return;
    }
    try {
      const text = await api.readFile(relPath);
      const mdMtime = await getFileMtimeMsSafe(relPath);
      get().flushActiveBuffer();
      const s = get();
      const active = getActiveTabFrom(s.tabs, s.activeTabId);
      const reuse =
        active &&
        !active.relPath &&
        !note.isTabDirty(active) &&
        active.buffer === "";
      if (reuse) {
        const updated = {
          ...active,
          relPath,
          buffer: text,
          lastSavedContent: text,
          fileMtimeMs: mdMtime,
        };
        set({
          tabs: s.tabs.map((t) => (t.id === active.id ? updated : t)),
        });
        get().editorBridge?.setMarkdown(text, { silent: true });
        get().editorBridge?.setDisabled(false);
        set({
          selection: { relPath, isDirectory: false },
          newItemParent: note.parentRel(relPath),
        });
        await get().loadFileNotesForPath(relPath);
        return;
      }
      const id = newTabId();
      const s2 = get();
      set({
        tabs: [
          ...s2.tabs,
          {
            id,
            relPath,
            buffer: text,
            lastSavedContent: text,
            fileMtimeMs: mdMtime,
          },
        ],
        activeTabId: id,
      });
      get().editorBridge?.setMarkdown(text, { silent: true });
      get().editorBridge?.setDisabled(false);
      set({
        selection: { relPath, isDirectory: false },
        newItemParent: note.parentRel(relPath),
      });
      await get().loadFileNotesForPath(relPath);
    } catch (err) {
      window.alert(
        err instanceof Error ? err.message : "Could not open file."
      );
    }
  },

  save: async () => {
    const api = getApi();
    get().flushActiveBuffer();
    let s = get();
    let tab = getActiveTabFrom(s.tabs, s.activeTabId);
    if (!tab?.relPath) {
      return;
    }
    if (note.isImageRelPath(tab.relPath)) {
      return;
    }

    // Auto-add "Untitled" heading when missing for .md files
    if (tab.relPath.toLowerCase().endsWith(".md") && !note.titleFromMarkdown(tab.buffer)) {
      const parentDir = note.parentRel(tab.relPath);
      const allNodes = flattenTree(s.treeNodes ?? []);
      const siblings = allNodes
        .filter(
          (n) =>
            !n.isDirectory &&
            n.relPath.toLowerCase().endsWith(".md") &&
            note.parentRel(n.relPath) === parentDir &&
            n.relPath !== tab!.relPath,
        )
        .map((n) => note.basenameNoMd(n.relPath));
      const title = note.generateUntitledTitle(siblings);
      const next = note.ensureLeadingHeading(tab.buffer, title);
      set({
        tabs: s.tabs.map((t) =>
          t.id === tab!.id ? { ...t, buffer: next } : t
        ),
      });
      s = get();
      tab = getActiveTabFrom(s.tabs, s.activeTabId)!;
      // Re-render the editor with the new heading
      if (s.editorBridge) {
        s.editorBridge.setMarkdown(tab.buffer, { silent: true });
      }
    }

    try {
      await api.writeFile(tab.relPath, tab.buffer);
      const savedPath = tab.relPath;
      set({
        tabs: s.tabs.map((t) =>
          t.id === tab!.id
            ? { ...t, lastSavedContent: t.buffer }
            : t
        ),
      });

      const tAfterSave = get().tabs.find((x) => x.id === tab.id);
      const statPath = tAfterSave?.relPath ?? savedPath;
      const mtimeAfterSave = await getFileMtimeMsSafe(statPath);
      set((st) => ({
        tabs: st.tabs.map((x) =>
          x.id === tab.id
            ? { ...x, fileMtimeMs: mtimeAfterSave ?? x.fileMtimeMs }
            : x
        ),
      }));
      await get().refreshTree();
    } catch (err) {
      window.alert(
        err instanceof Error ? err.message : "Could not save file."
      );
    }
  },

  deleteContextItem: async (target) => {
    const api = getApi();
    const delPath = target.relPath;
    const childPrefix = target.isDirectory ? `${delPath}/` : "";
    const s = get();
    const tabsAffected = s.tabs.filter((t) => {
      if (!t.relPath) {
        return false;
      }
      if (t.relPath === delPath) {
        return true;
      }
      if (childPrefix && t.relPath.startsWith(childPrefix)) {
        return true;
      }
      return false;
    });
    const anyDirty = tabsAffected.some(note.isTabDirty);
    let msg = `Delete "${target.name}"? This cannot be undone.`;
    if (tabsAffected.length > 0) {
      msg += `\n\n${tabsAffected.length} open tab(s) will be closed.`;
    }
    if (anyDirty) {
      msg += " Unsaved changes will be lost.";
    }
    if (!window.confirm(msg)) {
      return;
    }
    if (!target.isDirectory && target.relPath.toLowerCase().endsWith(".md")) {
      await deleteAllFileNotesSidecarsForMd(api, target.relPath);
    }
    await api.deleteItem(delPath);
    await syncTagIndexRemove(delPath, target.isDirectory);
    for (const t of tabsAffected) {
      get().closeTab(t.id, { skipDirtyCheck: true });
    }
    set((st) => {
      if (
        !st.selection ||
        (st.selection.relPath !== delPath &&
          !(childPrefix && st.selection.relPath.startsWith(childPrefix)))
      ) {
        return {};
      }
      return { selection: null };
    });
    await get().refreshTree();
  },

  deleteMultiSelection: async () => {
    const { multiSelection, selection } = get();
    // Collect items to delete: multiSelection if any, otherwise fall back to single selection
    const items: Array<{ relPath: string; isDirectory: boolean }> =
      multiSelection.length > 0
        ? multiSelection
        : selection
          ? [selection]
          : [];
    if (items.length === 0) return;

    const api = getApi();
    const s = get();
    // Gather all affected tabs
    const tabsAffected = s.tabs.filter((t) => {
      if (!t.relPath) return false;
      return items.some((item) => {
        if (t.relPath === item.relPath) return true;
        if (item.isDirectory && t.relPath!.startsWith(`${item.relPath}/`)) return true;
        return false;
      });
    });
    const anyDirty = tabsAffected.some(note.isTabDirty);

    const label =
      items.length === 1
        ? `"${items[0].relPath.split("/").pop()}"`
        : `${items.length} items`;
    let msg = `Delete ${label}? This cannot be undone.`;
    if (tabsAffected.length > 0) {
      msg += `\n\n${tabsAffected.length} open tab(s) will be closed.`;
    }
    if (anyDirty) {
      msg += " Unsaved changes will be lost.";
    }
    if (!window.confirm(msg)) return;

    for (const item of items) {
      if (!item.isDirectory && item.relPath.toLowerCase().endsWith(".md")) {
        await deleteAllFileNotesSidecarsForMd(api, item.relPath);
      }
      await api.deleteItem(item.relPath);
      await syncTagIndexRemove(item.relPath, item.isDirectory);
    }
    for (const t of tabsAffected) {
      get().closeTab(t.id, { skipDirtyCheck: true });
    }
    set({ selection: null, multiSelection: [] });
    await get().refreshTree();
  },

  duplicateNoteAtPath: async (src) => {
    if (!src || !src.toLowerCase().endsWith(".md")) {
      return;
    }
    const api = getApi();
    const parent = note.parentRel(src);
    const baseName = src.split("/").pop() || "";
    const stem = baseName.replace(/\.md$/i, "");
    let i = 0;
    let newName = "";
    let newRel = "";
    while (true) {
      newName = i === 0 ? `${stem}_copy.md` : `${stem}_copy_${i + 1}.md`;
      newRel = parent ? `${parent}/${newName}` : newName;
      if (!(await api.pathExists(newRel))) {
        break;
      }
      i += 1;
    }
    get().flushActiveBuffer();
    const s = get();
    const openTab = s.tabs.find((t) => t.relPath === src);
    const contentRaw =
      openTab && openTab.id === s.activeTabId
        ? get().editorBridge?.getMarkdown() ?? openTab.buffer
        : openTab
          ? openTab.buffer
          : await api.readFile(src);
    const content = note.noteContentWithCopyHeading(contentRaw, stem);
    await api.writeFile(newRel, content);
    await copyFileNotesSidecar(api, src, newRel);
    get().expandAncestors(parent);
    await get().refreshTree();
    await get().tryOpenFile(newRel);
  },

  duplicateFromClipboard: async () => {
    const src = get().clipboardNoteRelPath;
    if (src) {
      await get().duplicateNoteAtPath(src);
    }
  },

  handleTreeDrop: async (e) => {
    e.preventDefault();
    const api = getApi();
    const row = (e.target as HTMLElement).closest(".tree-row");
    let toParent = "";
    const dropRel = row?.getAttribute("data-rel-path");
    if (row && dropRel != null) {
      const isDir = row.getAttribute("data-is-directory") === "true";
      toParent = isDir ? dropRel : note.parentRel(dropRel);
    }

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const paths: string[] = [];
      for (const f of e.dataTransfer.files) {
        const p = api.getPathForFile(f);
        if (p) {
          paths.push(p);
        }
      }
      if (paths.length) {
        try {
          await api.importPaths(paths, toParent);
          get().expandAncestors(toParent);
          await get().refreshTree();
        } catch (err) {
          window.alert(
            err instanceof Error ? err.message : "Import failed."
          );
        }
      }
      return;
    }

    const raw = e.dataTransfer.getData("application/x-bao-node");
    if (!raw) {
      return;
    }
    let payload: { items?: { fromRel: string; isDirectory: boolean }[] };
    try {
      payload = JSON.parse(raw) as typeof payload;
    } catch {
      return;
    }
    const items = payload.items;
    if (!items || !items.length) {
      return;
    }
    // Filter to only items that would actually change location,
    // and skip items that are children of other items being moved.
    const movable = items.filter(
      (it) =>
        it.fromRel &&
        note.wouldMoveChangeLocation(it.fromRel, toParent) &&
        !items.some(
          (other) =>
            other.fromRel !== it.fromRel &&
            other.isDirectory &&
            it.fromRel.startsWith(`${other.fromRel}/`)
        )
    );
    if (!movable.length) {
      return;
    }
    try {
      for (const item of movable) {
        const { newRelPath } = await api.moveItem(item.fromRel, toParent);
        await syncTagIndexRename(item.fromRel, newRelPath);
        await renameFileNotesSidecar(api, item.fromRel, newRelPath);
        set((st) => {
          // Remap expanded state for moved folders
          let expanded = st.expanded;
          if (item.isDirectory) {
            const nextExp = { ...expanded };
            const prefix = `${item.fromRel}/`;
            for (const key of Object.keys(nextExp)) {
              if (key === item.fromRel) {
                nextExp[newRelPath] = nextExp[key]!;
                delete nextExp[key];
              } else if (key.startsWith(prefix)) {
                nextExp[newRelPath + key.slice(item.fromRel.length)] = nextExp[key]!;
                delete nextExp[key];
              }
            }
            expanded = nextExp;
          }
          return {
            expanded,
            tabs: note.remapOpenTabsAfterMove(st.tabs, item.fromRel, newRelPath),
            selection: note.remapSelectionAfterMove(
              st.selection,
              item.fromRel,
              newRelPath
            ),
            multiSelection: [],
            fileNotesByPath: remapFileNotesStateKey(
              st.fileNotesByPath,
              item.fromRel,
              newRelPath
            ),
            fileNotesRevision: st.fileNotesRevision + 1,
          };
        });
      }
      get().expandAncestors(toParent);
      await get().refreshTree();
    } catch (err) {
      window.alert(
        err instanceof Error ? err.message : "Could not move item."
      );
    }
  },

  expandAncestors: (relPath) => {
    if (!relPath) {
      return;
    }
    const parts = relPath.split("/");
    let acc = "";
    set((s) => {
      const next = { ...s.expanded };
      for (const p of parts) {
        acc = acc ? `${acc}/${p}` : p;
        next[acc] = true;
      }
      return { expanded: next };
    });
  },

  appendChatBubble: (role, text) => {
    const id = crypto.randomUUID();
    set((s) => ({
      chatMessages: [...s.chatMessages, { id, role, text }],
    }));
  },

  sendChatMessage: (text) => {
    get().appendChatBubble("user", text);
    window.setTimeout(() => {
      get().appendChatBubble("assistant", "coming soon!");
    }, 250);
  },

  setClipboardNote: (relPath) => set({ clipboardNoteRelPath: relPath }),

  loadVaultPath: async () => {
    const api = getApi();
    try {
      const dir = await api.getDataDir();
      set({ vaultPathDisplay: dir });
    } catch {
      set({ vaultPathDisplay: null });
    }
  },

  openVault: async (dir: string) => {
    const api = getApi();
    await api.openVault(dir);
    set({
      vaultPathDisplay: dir,
      tabs: [],
      activeTabId: null,
      expanded: {},
      selection: null,
      multiSelection: [],
      fileNotesByPath: {},
      fileNotesRevision: 0,
      clipboardNoteRelPath: null,
    });
    await get().refreshTree();
  },

  changeVault: async () => {
    const api = getApi();
    const result = await api.chooseVaultFolder();
    if (!result.chosen) return;
    set({
      vaultPathDisplay: result.path ?? null,
      tabs: [],
      activeTabId: null,
      expanded: {},
      selection: null,
      multiSelection: [],
      fileNotesByPath: {},
      fileNotesRevision: 0,
      clipboardNoteRelPath: null,
    });
    await get().refreshTree();
  },

  closeVault: () => {
    set({
      vaultPathDisplay: null,
      tabs: [],
      activeTabId: null,
      treeNodes: [],
      treeError: null,
      expanded: {},
      selection: null,
      multiSelection: [],
      fileNotesByPath: {},
      fileNotesRevision: 0,
      clipboardNoteRelPath: null,
      settingsOpen: false,
      shortcutsOpen: false,
    });
  },
}));

export function getActiveTabSnapshot(
  tabs: EditorTab[],
  activeTabId: string | null
): EditorTab | null {
  return getActiveTabFrom(tabs, activeTabId);
}
