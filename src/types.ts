/** Result of moving a tab from another window into this one. */
export type TabTransferYield =
  | { ok: true; buffer: string; lastSavedContent: string }
  | { ok: false; cancelled?: boolean; error?: string };

/** Fallback when HTML dataTransfer is empty (common for cross-window drags in Electron). */
export type ConsumePendingTabDragResult =
  | { kind: "empty" }
  | {
      kind: "same-window";
      fromIndex: number;
      insertIndex: number;
      relPath: string | null;
      tabId: string;
    }
  | { kind: "cross-window"; relPath: string; result: TabTransferYield }
  | { kind: "error"; message: string };

export interface BaoTreeNode {
  name: string;
  relPath: string;
  isDirectory: boolean;
  children?: BaoTreeNode[];
  displayName?: string;
}

export interface BaoApi {
  platform: string;
  onShowKeyboardShortcuts: (callback: () => void) => () => void;
  onCloseTab: (callback: () => void) => () => void;
  getDataDir: () => Promise<string | null>;
  getRecentVaults: () => Promise<string[]>;
  openVault: (dir: string) => Promise<{ path: string }>;
  chooseVaultFolder: () => Promise<{ chosen: boolean; path?: string }>;
  /** `null` or `""` reveals the vault root folder. */
  revealInFileManager: (relPath: string | null) => Promise<void>;
  /** Open a native file picker for images; copies the file into the vault root and returns the vault-relative path. */
  chooseImageFile: () => Promise<{ chosen: boolean; relPath?: string }>;
  /** Open a vault-relative file with the default app (e.g. images in Preview). */
  openVaultFile: (relPath: string) => Promise<void>;
  /** Open an http(s) URL in the system browser. */
  openExternalUrl: (url: string) => Promise<void>;
  listTree: () => Promise<BaoTreeNode[]>;
  /** Search for text within all markdown documents in the vault. */
  searchInVault: (query: string) => Promise<
    Array<{
      relPath: string;
      matches: Array<{
        relPath: string;
        lineNumber: number;
        lineContent: string;
        matchStart: number;
        matchEnd: number;
      }>;
    }>
  >;
  pathExists: (relPath: string) => Promise<boolean>;
  readFile: (relPath: string) => Promise<string>;
  /** Filesystem modification time in ms, or null if missing / error. */
  getFileMtimeMs: (relPath: string) => Promise<number | null>;
  /** Tag → vault-relative file paths; stored in `.metadata/tag_index.json`. */
  getTagIndex: () => Promise<Record<string, string[]>>;
  setTagIndex: (index: Record<string, string[]>) => Promise<void>;
  writeFile: (relPath: string, content: string) => Promise<void>;
  /** Save raw bytes (e.g. pasted images). `base64` is the file payload without a data-URL prefix. */
  writeBinaryFile: (relPath: string, base64: string) => Promise<void>;
  createFolder: (parentRel: string, name: string) => Promise<void>;
  createFile: (parentRel: string, name: string) => Promise<void>;
  moveItem: (
    fromRel: string,
    toParentRel: string
  ) => Promise<{ newRelPath: string }>;
  importPaths: (paths: string[], parentRel: string) => Promise<void>;
  renameItem: (
    fromRel: string,
    newName: string
  ) => Promise<{ newRelPath: string }>;
  deleteItem: (relPath: string) => Promise<void>;
  /** Open a new app window focused on this vault file (Electron). */
  openFileInNewWindow: (relPath: string) => Promise<void>;
  /** Renderer `webContents.id` for cross-window tab drag. */
  getWebContentsId: () => Promise<number>;
  requestTabTransfer: (payload: {
    sourceWebContentsId: number;
    relPath: string;
    insertIndex: number;
  }) => Promise<TabTransferYield>;
  onTabTransferRequest: (
    callback: (payload: {
      requestId: string;
      relPath: string;
      insertIndex: number;
    }) => void
  ) => () => void;
  sendTabTransferResult: (requestId: string, result: TabTransferYield) => void;
  /** Sync tab drag with main — required when dataTransfer is empty between windows. */
  notifyTabDragStart: (payload: {
    relPath: string | null;
    tabId: string;
    fromIndex: number;
  }) => void;
  notifyTabDragEnd: () => void;
  consumePendingTabDrag: (
    insertIndex: number
  ) => Promise<ConsumePendingTabDragResult>;
  exportPdf: (
    html: string,
    suggestedName: string
  ) => Promise<{ saved: boolean; filePath?: string }>;
  getPathForFile: (file: File) => string | undefined;
}

export interface EditorTab {
  id: string;
  relPath: string | null;
  buffer: string;
  lastSavedContent: string;
  /** Last known mtime from disk (display); null when unknown. */
  fileMtimeMs: number | null;
}

export interface TreeSelection {
  relPath: string;
  isDirectory: boolean;
}

export interface ContextRenameTarget {
  relPath: string;
  isDirectory: boolean;
  name: string;
}

export type ModalMode = "file" | "folder" | "rename" | "save-scratch";

export interface EditorBridge {
  getMarkdown: () => string;
  setMarkdown: (md: string, opts?: { silent?: boolean }) => void;
  setDisabled: (disabled: boolean) => void;
}

export interface ChatBubble {
  id: string;
  role: "user" | "assistant";
  text: string;
}
