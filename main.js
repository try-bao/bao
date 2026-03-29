const {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  shell,
  protocol,
  webContents,
} = require("electron");
const fs = require("fs");
const path = require("path");

protocol.registerSchemesAsPrivileged([
  {
    scheme: "vault",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      bypassCSP: true,
    },
  },
]);

/** Decode vault: request URL to a vault-relative posix path (handles vault://host/… quirks). */
function relPathFromVaultRequestUrl(requestUrl) {
  let u;
  try {
    u = new URL(requestUrl);
  } catch {
    return null;
  }
  let pathname = u.pathname || "";
  if (pathname.startsWith("//")) {
    pathname = pathname.slice(1);
  }
  if (pathname.startsWith("/")) {
    pathname = pathname.slice(1);
  }
  const decodedPath = pathname
    .split("/")
    .map((seg) => decodeURIComponent(seg))
    .filter((seg) => seg.length > 0)
    .join("/");

  if (u.hostname && u.hostname !== "localhost") {
    return decodedPath ? `${u.hostname}/${decodedPath}` : u.hostname;
  }
  return decodedPath;
}

function mimeFromFilePath(absPath) {
  const ext = path.extname(absPath).toLowerCase();
  const map = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".bmp": "image/bmp",
    ".avif": "image/avif",
    ".tif": "image/tiff",
    ".tiff": "image/tiff",
    ".heic": "image/heic",
    ".heif": "image/heif",
  };
  return map[ext] || "application/octet-stream";
}

function getBaoDir() {
  return path.join(app.getPath("documents"), "bao");
}

function ensureBaoFolder() {
  const dir = getBaoDir();
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function tagIndexAbs() {
  return path.join(getBaoDir(), ".metadata", "tag_index.json");
}

function readTagIndexFile() {
  const abs = tagIndexAbs();
  try {
    if (!fs.existsSync(abs)) {
      return {};
    }
    const raw = fs.readFileSync(abs, "utf8");
    const data = JSON.parse(raw);
    if (data && typeof data === "object" && !Array.isArray(data)) {
      return data;
    }
  } catch {
    /* ignore corrupt / empty */
  }
  return {};
}

function writeTagIndexFile(index) {
  ensureBaoFolder();
  const metaDir = path.join(getBaoDir(), ".metadata");
  fs.mkdirSync(metaDir, { recursive: true });
  fs.writeFileSync(tagIndexAbs(), JSON.stringify(index, null, 2), "utf8");
}

function toAbs(relPath) {
  const root = getBaoDir();
  const abs = path.resolve(root, relPath || ".");
  const rel = path.relative(root, abs);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error("Path outside vault");
  }
  return abs;
}

function assertInsideVault(absPath) {
  const root = getBaoDir();
  const rel = path.relative(root, absPath);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error("Invalid path");
  }
}

function isPathInsideVault(absPath) {
  const root = getBaoDir();
  const rel = path.relative(root, path.resolve(absPath));
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

function copyIntoVaultUnique(srcAbs, destDirAbs) {
  const baseName = path.basename(srcAbs);
  let dest = path.join(destDirAbs, baseName);
  let n = 1;
  while (fs.existsSync(dest)) {
    const ext = path.extname(baseName);
    const stem = ext ? baseName.slice(0, -ext.length) : baseName;
    dest = path.join(destDirAbs, `${stem} (${n})${ext}`);
    n += 1;
  }
  const stat = fs.statSync(srcAbs);
  if (stat.isDirectory()) {
    fs.cpSync(srcAbs, dest, { recursive: true });
  } else {
    fs.copyFileSync(srcAbs, dest);
  }
}

function sanitizeName(name) {
  const trimmed = String(name || "").trim();
  if (!trimmed || trimmed.includes("/") || trimmed.includes("\\")) {
    throw new Error("Invalid name");
  }
  if (trimmed === "." || trimmed === "..") {
    throw new Error("Invalid name");
  }
  return trimmed;
}

/** Turn first markdown heading text into a single path segment (no extension). */
function headingTextToFileStem(raw) {
  let s = String(raw ?? "").trim();
  if (!s) {
    return "";
  }
  s = s.replace(/[/\\?%*:|"<>]/g, "");
  s = s.replace(/\s+/g, " ").trim();
  if (s.length > 120) {
    s = s.slice(0, 120).trim();
  }
  s = s.replace(/[.\s]+$/g, "");
  if (!s) {
    return "";
  }
  const upper = s.toUpperCase();
  const reserved = new Set([
    "CON",
    "PRN",
    "AUX",
    "NUL",
    "COM1",
    "COM2",
    "COM3",
    "COM4",
    "COM5",
    "COM6",
    "COM7",
    "COM8",
    "COM9",
    "LPT1",
    "LPT2",
    "LPT3",
    "LPT4",
    "LPT5",
    "LPT6",
    "LPT7",
    "LPT8",
    "LPT9",
  ]);
  if (reserved.has(upper)) {
    s = `${s}_`;
  }
  return s;
}

/** First ATX heading text (# … through ###### …), or null */
function extractMarkdownHeadingTitle(absPath) {
  if (!absPath.toLowerCase().endsWith(".md")) {
    return null;
  }
  let fd;
  try {
    fd = fs.openSync(absPath, "r");
    const buf = Buffer.alloc(16384);
    const n = fs.readSync(fd, buf, 0, 16384, 0);
    const chunk = buf.slice(0, n).toString("utf8");
    const m = chunk.match(/^\s*#{1,6}\s+(.+)$/m);
    return m ? m[1].trim() : null;
  } catch {
    return null;
  } finally {
    if (fd !== undefined) {
      try {
        fs.closeSync(fd);
      } catch {
        // ignore
      }
    }
  }
}

function buildTree(absDir, relBase) {
  let entries;
  try {
    entries = fs.readdirSync(absDir, { withFileTypes: true });
  } catch {
    return [];
  }

  const nodes = [];
  for (const ent of entries) {
    if (ent.name.startsWith(".")) {
      continue;
    }
    if (/_notes\.json$/i.test(ent.name)) {
      continue;
    }
    const rel = relBase ? `${relBase}/${ent.name}` : ent.name;
    const abs = path.join(absDir, ent.name);
    const relPath = rel.split(path.sep).join("/");

    if (ent.isDirectory()) {
      nodes.push({
        name: ent.name,
        relPath,
        isDirectory: true,
        children: buildTree(abs, rel),
      });
    } else {
      const isMd = ent.name.toLowerCase().endsWith(".md");
      const heading = isMd ? extractMarkdownHeadingTitle(abs) : null;
      const fallback = isMd
        ? ent.name.replace(/\.md$/i, "")
        : ent.name;
      nodes.push({
        name: ent.name,
        relPath,
        isDirectory: false,
        displayName: heading || fallback,
      });
    }
  }

  nodes.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) {
      return a.isDirectory ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });

  return nodes;
}

function sendShowKeyboardShortcuts() {
  const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
  if (win && !win.isDestroyed()) {
    win.webContents.send("bao:show-keyboard-shortcuts");
  }
}

function sendCloseTabToWindow(browserWindow) {
  const win =
    browserWindow ||
    BrowserWindow.getFocusedWindow() ||
    BrowserWindow.getAllWindows()[0];
  if (win && !win.isDestroyed()) {
    win.webContents.send("bao:close-tab");
  }
}

function buildApplicationMenu() {
  const isMac = process.platform === "darwin";

  /** @type {Electron.MenuItemConstructorOptions[]} */
  const template = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: "about" },
              { type: "separator" },
              { role: "services" },
              { type: "separator" },
              { role: "hide" },
              { role: "hideOthers" },
              { role: "unhide" },
              { type: "separator" },
              { role: "quit" },
            ],
          },
        ]
      : []),
    {
      label: "File",
      submenu: [
        {
          label: "Close Tab",
          accelerator: isMac ? "Command+W" : "Ctrl+W",
          click: (_item, browserWindow) =>
            sendCloseTabToWindow(browserWindow),
        },
        { type: "separator" },
        ...(isMac
          ? [
              {
                label: "Close Window",
                accelerator: "Command+Shift+W",
                click: (_item, browserWindow) => {
                  const win =
                    browserWindow ||
                    BrowserWindow.getFocusedWindow();
                  win?.close();
                },
              },
            ]
          : [{ role: "quit" }]),
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        ...(isMac
          ? [
              { role: "pasteAndMatchStyle" },
              { role: "delete" },
              { role: "selectAll" },
              { type: "separator" },
              {
                label: "Speech",
                submenu: [
                  { role: "startSpeaking" },
                  { role: "stopSpeaking" },
                ],
              },
            ]
          : [
              { role: "delete" },
              { type: "separator" },
              { role: "selectAll" },
            ]),
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    {
      label: "Window",
      submenu: [
        { role: "minimize" },
        { role: "zoom" },
        ...(isMac
          ? [{ type: "separator" }, { role: "front" }]
          : [{ role: "close" }]),
      ],
    },
    {
      label: "Help",
      submenu: [
        {
          label: "Keyboard Shortcuts",
          click: () => sendShowKeyboardShortcuts(),
        },
      ],
    },
  ];

  return Menu.buildFromTemplate(template);
}

/** @param {string | null | undefined} openRelPath vault-relative path to open after load */
function createWindow(openRelPath) {
  const win = new BrowserWindow({
    width: 960,
    height: 700,
    minWidth: 520,
    minHeight: 360,
    backgroundColor: "#fafafa",
    icon: path.join(__dirname, "public", "logo_color.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const rel =
    openRelPath != null && String(openRelPath).trim() !== ""
      ? String(openRelPath).trim().replace(/\\/g, "/")
      : "";
  const hash = rel ? `bao-open=${encodeURIComponent(rel)}` : "";

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    win.loadURL(devUrl + (hash ? `#${hash}` : ""));
  } else {
    const indexHtml = path.join(__dirname, "dist", "index.html");
    if (hash) {
      win.loadFile(indexHtml, { hash });
    } else {
      win.loadFile(indexHtml);
    }
  }
}

app.whenReady().then(() => {
  ensureBaoFolder();

  protocol.handle("vault", async (request) => {
    try {
      const relPath = relPathFromVaultRequestUrl(request.url);
      if (!relPath) {
        return new Response(null, { status: 404 });
      }
      const abs = toAbs(relPath);
      if (!fs.existsSync(abs) || fs.statSync(abs).isDirectory()) {
        return new Response(null, { status: 404 });
      }
      const buf = fs.readFileSync(abs);
      return new Response(buf, {
        headers: {
          "Content-Type": mimeFromFilePath(abs),
          "Cache-Control": "private, max-age=3600",
        },
      });
    } catch {
      return new Response(null, { status: 500 });
    }
  });

  Menu.setApplicationMenu(buildApplicationMenu());

  /** @type {Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void; timeout: NodeJS.Timeout }>} */
  const tabTransferPending = new Map();

  /**
   * HTML5 drag data is often empty between BrowserWindows; the renderer also
   * syncs drag state here via bao:tab-drag-start / bao:tab-drag-end.
   * @type {{ sourceWebContentsId: number; relPath: string | null; tabId: string; fromIndex: number } | null}
   */
  let pendingTabDrag = null;

  ipcMain.handle("bao:get-web-contents-id", (event) => event.sender.id);

  function awaitTabTransferFromSource(src, relPath, insertIndex) {
    if (!src || src.isDestroyed()) {
      return Promise.reject(new Error("Source window not found"));
    }
    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        tabTransferPending.delete(requestId);
        reject(new Error("Tab transfer timed out"));
      }, 12000);
      tabTransferPending.set(requestId, {
        resolve: (v) => {
          clearTimeout(timeout);
          resolve(v);
        },
        reject: (e) => {
          clearTimeout(timeout);
          reject(e);
        },
        timeout,
      });
      src.send("bao:tab-transfer-request", {
        requestId,
        relPath,
        insertIndex,
      });
    });
  }

  ipcMain.on("bao:tab-drag-start", (event, payload) => {
    const rel =
      payload.relPath != null && String(payload.relPath).trim() !== ""
        ? String(payload.relPath).replace(/\\/g, "/")
        : null;
    pendingTabDrag = {
      sourceWebContentsId: event.sender.id,
      relPath: rel,
      tabId: String(payload.tabId ?? ""),
      fromIndex: Number(payload.fromIndex) || 0,
    };
  });

  ipcMain.on("bao:tab-drag-end", (event) => {
    if (
      pendingTabDrag &&
      pendingTabDrag.sourceWebContentsId === event.sender.id
    ) {
      pendingTabDrag = null;
    }
  });

  ipcMain.handle(
    "bao:consume-pending-tab-drag",
    async (event, { insertIndex: _insertIndex }) => {
      const targetId = event.sender.id;
      if (!pendingTabDrag) {
        return { kind: "empty" };
      }
      const p = pendingTabDrag;
      const { sourceWebContentsId, relPath, fromIndex, tabId } = p;

      if (sourceWebContentsId === targetId) {
        pendingTabDrag = null;
        return {
          kind: "same-window",
          fromIndex,
          insertIndex: _insertIndex,
          relPath,
          tabId,
        };
      }

      if (!relPath) {
        pendingTabDrag = null;
        return {
          kind: "error",
          message:
            "Save this note to a file before moving it into another window.",
        };
      }

      pendingTabDrag = null;
      const src = webContents.fromId(sourceWebContentsId);
      try {
        const result = await awaitTabTransferFromSource(
          src,
          relPath,
          _insertIndex
        );
        return { kind: "cross-window", relPath, result };
      } catch (err) {
        return {
          kind: "error",
          message: err instanceof Error ? err.message : String(err),
        };
      }
    }
  );

  ipcMain.handle(
    "bao:request-tab-transfer",
    async (_event, { sourceWebContentsId, relPath, insertIndex: _insertIndex }) => {
      const src = webContents.fromId(sourceWebContentsId);
      return awaitTabTransferFromSource(src, relPath, _insertIndex);
    }
  );

  ipcMain.on("bao:tab-transfer-result", (_event, requestId, result) => {
    const pending = tabTransferPending.get(requestId);
    if (!pending) {
      return;
    }
    tabTransferPending.delete(requestId);
    clearTimeout(pending.timeout);
    pending.resolve(result);
  });

  ipcMain.handle("bao:get-data-dir", () => getBaoDir());

  ipcMain.handle("bao:reveal-in-file-manager", async (_, relPath) => {
    const root = getBaoDir();
    const abs =
      relPath == null || relPath === "" ? root : toAbs(relPath);
    if (!fs.existsSync(abs)) {
      throw new Error("Path does not exist");
    }
    const stat = fs.statSync(abs);
    if (stat.isDirectory()) {
      const errMsg = await shell.openPath(abs);
      if (errMsg) {
        throw new Error(errMsg);
      }
    } else {
      shell.showItemInFolder(abs);
    }
  });

  /** Open a vault file with the OS default application (e.g. Preview for images). */
  ipcMain.handle("bao:open-vault-file", async (_, relPath) => {
    const abs = toAbs(relPath);
    if (!fs.existsSync(abs)) {
      throw new Error("Path does not exist");
    }
    if (fs.statSync(abs).isDirectory()) {
      throw new Error("Not a file");
    }
    const errMsg = await shell.openPath(abs);
    if (errMsg) {
      throw new Error(errMsg);
    }
  });

  ipcMain.handle("bao:open-external-url", async (_, url) => {
    const u = String(url || "").trim();
    if (!/^https?:\/\//i.test(u)) {
      throw new Error("Invalid URL");
    }
    await shell.openExternal(u);
  });

  ipcMain.handle("bao:list-tree", () => {
    const root = getBaoDir();
    return buildTree(root, "");
  });

  ipcMain.handle("bao:search-in-vault", (_, query) => {
    const root = getBaoDir();
    const results = [];
    const q = String(query || "").toLowerCase();
    if (!q) {
      return results;
    }

    function searchDir(absDir, relBase) {
      let entries;
      try {
        entries = fs.readdirSync(absDir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        if (entry.name.startsWith(".")) continue;
        const absPath = path.join(absDir, entry.name);
        const relPath = relBase ? `${relBase}/${entry.name}` : entry.name;

        if (entry.isDirectory()) {
          searchDir(absPath, relPath);
        } else if (entry.name.toLowerCase().endsWith(".md")) {
          try {
            const content = fs.readFileSync(absPath, "utf8");
            const lines = content.split("\n");
            const matches = [];
            for (let i = 0; i < lines.length; i++) {
              const line = lines[i];
              const lineLower = line.toLowerCase();
              let idx = 0;
              while ((idx = lineLower.indexOf(q, idx)) !== -1) {
                matches.push({
                  relPath,
                  lineNumber: i + 1,
                  lineContent: line.substring(
                    Math.max(0, idx - 40),
                    Math.min(line.length, idx + q.length + 40)
                  ),
                  matchStart: Math.min(40, idx),
                  matchEnd: Math.min(40, idx) + q.length,
                });
                idx += q.length;
              }
            }
            if (matches.length > 0) {
              results.push({ relPath, matches });
            }
          } catch {
            /* ignore read errors */
          }
        }
      }
    }

    searchDir(root, "");
    return results;
  });

  ipcMain.handle("bao:path-exists", (_, relPath) => {
    try {
      return fs.existsSync(toAbs(relPath));
    } catch {
      return false;
    }
  });

  ipcMain.handle("bao:read-file", (_, relPath) => {
    const abs = toAbs(relPath);
    return fs.readFileSync(abs, "utf8");
  });

  ipcMain.handle("bao:get-file-mtime-ms", (_, relPath) => {
    try {
      const abs = toAbs(relPath);
      if (!fs.existsSync(abs)) {
        return null;
      }
      return fs.statSync(abs).mtimeMs;
    } catch {
      return null;
    }
  });

  ipcMain.handle("bao:get-tag-index", () => readTagIndexFile());

  ipcMain.handle("bao:set-tag-index", (_, index) => {
    if (!index || typeof index !== "object" || Array.isArray(index)) {
      throw new Error("Invalid tag index");
    }
    writeTagIndexFile(index);
  });

  ipcMain.handle("bao:write-file", (_, relPath, content) => {
    const abs = toAbs(relPath);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content, "utf8");
  });

  ipcMain.handle("bao:write-binary-file", (_, relPath, base64) => {
    const abs = toAbs(relPath);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, Buffer.from(String(base64 || ""), "base64"));
  });

  ipcMain.handle("bao:create-folder", (_, parentRel, name) => {
    const folderName = sanitizeName(name);
    const parentAbs = toAbs(parentRel || "");
    const dest = path.join(parentAbs, folderName);
    assertInsideVault(dest);
    fs.mkdirSync(dest, { recursive: true });
  });

  ipcMain.handle("bao:create-file", (_, parentRel, name) => {
    let fileName = sanitizeName(name);
    if (!fileName.toLowerCase().endsWith(".md")) {
      fileName += ".md";
    }
    const parentAbs = toAbs(parentRel || "");
    const dest = path.join(parentAbs, fileName);
    assertInsideVault(dest);
    if (fs.existsSync(dest)) {
      throw new Error("File already exists");
    }
    const title = fileName.replace(/\.md$/i, "");
    fs.writeFileSync(dest, `# ${title}\n\n`, "utf8");
  });

  ipcMain.handle("bao:move", (_, fromRel, toParentRel) => {
    const root = getBaoDir();
    const fromAbs = toAbs(fromRel);
    const destDirAbs = toAbs(toParentRel || "");
    const baseName = path.basename(fromAbs);
    const destAbs = path.join(destDirAbs, baseName);

    const normFrom = String(fromRel).split(path.sep).join("/");
    const normToParent = String(toParentRel || "").split(path.sep).join("/");

    if (normToParent === normFrom || normToParent.startsWith(`${normFrom}/`)) {
      throw new Error("Cannot move a folder into itself");
    }

    assertInsideVault(destAbs);

    if (fs.existsSync(destAbs)) {
      throw new Error("An item with that name already exists here");
    }

    fs.renameSync(fromAbs, destAbs);

    const newRel = path.relative(root, destAbs).split(path.sep).join("/");
    return { newRelPath: newRel };
  });

  ipcMain.handle("bao:import-paths", (_, absolutePaths, parentRel) => {
    const destDirAbs = toAbs(parentRel || "");
    assertInsideVault(destDirAbs);

    for (const srcAbs of absolutePaths) {
      if (!srcAbs || typeof srcAbs !== "string") {
        continue;
      }
      const resolved = path.resolve(srcAbs);
      if (!fs.existsSync(resolved)) {
        continue;
      }
      if (isPathInsideVault(resolved)) {
        continue;
      }

      copyIntoVaultUnique(resolved, destDirAbs);
    }
    return true;
  });

  ipcMain.handle("bao:rename-to-heading", (_, fromRel, headingText) => {
    const root = getBaoDir();
    if (!String(fromRel).toLowerCase().endsWith(".md")) {
      return { newRelPath: fromRel, renamed: false };
    }

    const stem = headingTextToFileStem(headingText);
    if (!stem) {
      return { newRelPath: fromRel, renamed: false };
    }

    const fromAbs = toAbs(fromRel);
    const parentAbs = path.dirname(fromAbs);
    const curName = path.basename(fromAbs);
    const curStem = curName.replace(/\.md$/i, "");

    if (stem.toLowerCase() === curStem.toLowerCase()) {
      return { newRelPath: fromRel, renamed: false };
    }

    let candidateFile = `${stem}.md`;
    let destAbs = path.join(parentAbs, candidateFile);
    let n = 2;

    while (fs.existsSync(destAbs)) {
      if (path.resolve(destAbs) === path.resolve(fromAbs)) {
        return { newRelPath: fromRel, renamed: false };
      }
      candidateFile = `${stem} (${n}).md`;
      destAbs = path.join(parentAbs, candidateFile);
      n += 1;
    }

    fs.renameSync(fromAbs, destAbs);
    const newRel = path.relative(root, destAbs).split(path.sep).join("/");
    return { newRelPath: newRel, renamed: true };
  });

  ipcMain.handle("bao:rename-item", (_, fromRel, newNameRaw) => {
    const root = getBaoDir();
    const fromAbs = toAbs(fromRel);
    if (!fs.existsSync(fromAbs)) {
      throw new Error("Item not found");
    }
    const stat = fs.statSync(fromAbs);
    const isDir = stat.isDirectory();
    const parentAbs = path.dirname(fromAbs);
    const wasMd = fromAbs.toLowerCase().endsWith(".md");

    let newBase;
    if (isDir) {
      newBase = sanitizeName(newNameRaw);
    } else {
      let fn = String(newNameRaw ?? "").trim();
      if (!fn) {
        throw new Error("Invalid name");
      }
      if (wasMd && !fn.toLowerCase().endsWith(".md")) {
        fn += ".md";
      }
      newBase = sanitizeName(fn);
    }

    const destAbs = path.join(parentAbs, newBase);
    assertInsideVault(destAbs);

    if (path.resolve(fromAbs) === path.resolve(destAbs)) {
      return { newRelPath: fromRel };
    }
    if (fs.existsSync(destAbs)) {
      throw new Error("An item with that name already exists");
    }

    fs.renameSync(fromAbs, destAbs);
    const newRel = path.relative(root, destAbs).split(path.sep).join("/");
    return { newRelPath: newRel };
  });

  ipcMain.handle("bao:open-file-in-new-window", (_, relPath) => {
    const r = String(relPath ?? "")
      .trim()
      .replace(/\\/g, "/");
    if (!r) {
      throw new Error("Missing path");
    }
    createWindow(r);
    return true;
  });

  ipcMain.handle("bao:delete-item", (_, relPath) => {
    const norm = String(relPath ?? "")
      .trim()
      .replace(/\\/g, "/");
    if (!norm) {
      throw new Error("Cannot delete vault root");
    }
    const abs = toAbs(relPath);
    assertInsideVault(abs);
    if (!fs.existsSync(abs)) {
      throw new Error("Item not found");
    }
    const stat = fs.statSync(abs);
    if (stat.isDirectory()) {
      fs.rmSync(abs, { recursive: true, force: true });
    } else {
      fs.unlinkSync(abs);
    }
    return true;
  });

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
