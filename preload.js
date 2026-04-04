const electron = require("electron");
const { contextBridge, ipcRenderer } = electron;

function pathForFile(file) {
  const wu = electron.webUtils;
  if (wu && typeof wu.getPathForFile === "function") {
    try {
      return wu.getPathForFile(file);
    } catch {
      // fall through
    }
  }
  return file.path;
}

contextBridge.exposeInMainWorld("bao", {
  platform: process.platform,
  onShowKeyboardShortcuts: (callback) => {
    const channel = "bao:show-keyboard-shortcuts";
    const listener = () => {
      callback();
    };
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },
  onCloseTab: (callback) => {
    const channel = "bao:close-tab";
    const listener = () => {
      callback();
    };
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },
  getDataDir: () => ipcRenderer.invoke("bao:get-data-dir"),
  getRecentVaults: () => ipcRenderer.invoke("bao:get-recent-vaults"),
  openVault: (dir) => ipcRenderer.invoke("bao:open-vault", dir),
  chooseVaultFolder: () => ipcRenderer.invoke("bao:choose-vault-folder"),
  revealInFileManager: (relPath) =>
    ipcRenderer.invoke("bao:reveal-in-file-manager", relPath),
  chooseImageFile: () =>
    ipcRenderer.invoke("bao:choose-image-file"),
  openVaultFile: (relPath) =>
    ipcRenderer.invoke("bao:open-vault-file", relPath),
  openExternalUrl: (url) =>
    ipcRenderer.invoke("bao:open-external-url", url),
  listTree: () => ipcRenderer.invoke("bao:list-tree"),
  searchInVault: (query) => ipcRenderer.invoke("bao:search-in-vault", query),
  pathExists: (relPath) => ipcRenderer.invoke("bao:path-exists", relPath),
  readFile: (relPath) => ipcRenderer.invoke("bao:read-file", relPath),
  getFileMtimeMs: (relPath) =>
    ipcRenderer.invoke("bao:get-file-mtime-ms", relPath),
  getTagIndex: () => ipcRenderer.invoke("bao:get-tag-index"),
  setTagIndex: (index) => ipcRenderer.invoke("bao:set-tag-index", index),
  writeFile: (relPath, content) =>
    ipcRenderer.invoke("bao:write-file", relPath, content),
  writeBinaryFile: (relPath, base64) =>
    ipcRenderer.invoke("bao:write-binary-file", relPath, base64),
  createFolder: (parentRel, name) =>
    ipcRenderer.invoke("bao:create-folder", parentRel, name),
  createFile: (parentRel, name) =>
    ipcRenderer.invoke("bao:create-file", parentRel, name),
  moveItem: (fromRel, toParentRel) =>
    ipcRenderer.invoke("bao:move", fromRel, toParentRel),
  importPaths: (paths, parentRel) =>
    ipcRenderer.invoke("bao:import-paths", paths, parentRel),
  renameItem: (fromRel, newName) =>
    ipcRenderer.invoke("bao:rename-item", fromRel, newName),
  deleteItem: (relPath) => ipcRenderer.invoke("bao:delete-item", relPath),
  openFileInNewWindow: (relPath) =>
    ipcRenderer.invoke("bao:open-file-in-new-window", relPath),
  getWebContentsId: () => ipcRenderer.invoke("bao:get-web-contents-id"),
  requestTabTransfer: (payload) =>
    ipcRenderer.invoke("bao:request-tab-transfer", payload),
  onTabTransferRequest: (callback) => {
    const channel = "bao:tab-transfer-request";
    const listener = (_event, payload) => {
      callback(payload);
    };
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },
  sendTabTransferResult: (requestId, result) =>
    ipcRenderer.send("bao:tab-transfer-result", requestId, result),
  notifyTabDragStart: (payload) =>
    ipcRenderer.send("bao:tab-drag-start", payload),
  notifyTabDragEnd: () => ipcRenderer.send("bao:tab-drag-end"),
  consumePendingTabDrag: (insertIndex) =>
    ipcRenderer.invoke("bao:consume-pending-tab-drag", { insertIndex }),
  exportPdf: (html, suggestedName) =>
    ipcRenderer.invoke("bao:export-pdf", { html, suggestedName }),
  getPathForFile: pathForFile,
});
