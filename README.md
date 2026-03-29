<p align="center">
  <img src="public/logo_color.png" alt="Bao" width="128" />
</p>

<h1 align="center">Bao</h1>

<p align="center">
  A beautiful, local-first Markdown editor for your notes, docs, and ideas.
</p>

---

Bao is a desktop note-taking app that keeps everything on your machine — no accounts, no cloud sync, no subscriptions. Open a local vault folder and start writing. Your notes are plain Markdown files you can read anywhere.

Under the hood it's built with Electron, React, Vite, and Tailwind CSS.

## Features

### Editor

- **Live rich-text Markdown** — type natural Markdown syntax (`# `, `- `, `**`) and it transforms in place. Switch to raw source mode any time.
- **Floating toolbar** — select text to bold, italicize, strikethrough, add inline code, insert links, or change block styles (headings, quotes).
- **Slash commands** — type `/` at the start of a line to insert headings, tables, code blocks, images, lists, todos, quotes, or dividers.
- **Table editing** — add/remove rows and columns via a right-click context menu. Tab and Shift+Tab navigate between cells.
- **Image support** — inline images served from your vault via a custom `vault://` protocol. Drag corners to resize; dimensions persist in the Markdown source.
- **Code blocks** — syntax-highlighted with highlight.js and automatic language detection.
- **List nesting** — Tab/Shift+Tab to indent and outdent bullet, numbered, and task lists.

### File Management

- **Vault-based storage** — all notes live in a single folder on disk (`~/Documents/bao/` by default). No database, no proprietary format.
- **Full file tree** — sidebar with folders-first sorting, inline filtering, drag-and-drop reordering, and import from Finder.
- **Create, rename, duplicate, delete** files and folders. Renaming a note also updates its tags and annotation sidecars.
- **Auto-rename** — the file on disk automatically matches the first `# heading` in the note.
- **Reveal in Finder** and **Open in default app** from the context menu.

### Tabs & Windows

- **Multi-tab interface** — open several notes at once. Drag to reorder tabs or tear one off into a new window.
- **Cross-window tab transfer** — drag a tab between Bao windows and it carries over unsaved changes.
- **Dirty indicators** — a dot on the tab tells you there are unsaved edits.

### Search

- **Full-text vault search** — case-insensitive search across every `.md` file with live results, line numbers, and context snippets.
- **Click to jump** — select a result to open the file and scroll to the matching line.
- **In-editor highlighting** — search matches are highlighted inside the live editor using the CSS Custom Highlight API.

### Tags

- **Per-note tags** — add comma-separated tags in the editor header. Stored in a central `.metadata/tag_index.json` file.
- **Tag filter mode** — switch the sidebar to filter notes by one or more tags with autocomplete.

### Annotations

- **Inline text notes** — select text and attach a comment. Annotations are anchored to character offsets and automatically adjust as you edit.
- **Notes dock** — a panel listing all annotations for the current file with All / Open / Resolved filter tabs.
- **Resolve / reopen** workflow — mark annotations done and revisit them later.

### AI Assistant

- **Chat panel** — collapsible sidebar chat for an AI assistant (backend integration coming soon).

### Keyboard Shortcuts

| Action | Mac | Windows / Linux |
|--------|-----|-----------------|
| Save | `⌘S` | `Ctrl+S` |
| New document | `⌘T` | `Ctrl+T` |
| Close tab | `⌘W` | `Ctrl+W` |
| Bold | `⌘B` | `Ctrl+B` |
| Italic | `⌘I` | `Ctrl+I` |
| Inline code | `` ⌘` `` | `` Ctrl+` `` |
| Link | `⌘K` | `Ctrl+K` |
| Strikethrough | `⌘⇧X` | `Ctrl+Shift+X` |
| Task list | `⌘⇧L` | `Ctrl+Shift+L` |
| Toggle sidebar | `⌘B` | `Ctrl+B` |
| Toggle assistant | `⌘⇧C` | `Ctrl+Shift+C` |
| Settings | `⌘,` | `Ctrl+,` |
| Rename | `F2` | `F2` |

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18 or newer (includes `npm`)

### Install dependencies

```bash
npm install
```

### Development

```bash
npm run dev
```

Starts the Vite dev server and launches Electron with hot-reload.

### Production preview

```bash
npm run build
npm start
```

Builds the renderer into `dist/` and launches Electron loading the built files.

### Tests

```bash
npm test            # single run
npm run test:watch  # watch mode
```

---

## Building Distributable Apps

Bao uses [electron-builder](https://www.electron.build/) to package the app for macOS and Windows.

### macOS

**Build a `.dmg` installer + unpacked `.app`:**

```bash
npm run dist
```

Output in `release/`:

- `Bao-1.0.0-arm64.dmg` (or `x64` on Intel)
- `mac-arm64/Bao.app`

Open the `.dmg` and drag **Bao** into your Applications folder.

**Build an unpacked app only (faster, good for testing):**

```bash
npm run pack
```

Creates `release/mac-arm64/Bao.app` without an installer. Run it directly:

```bash
open release/mac-arm64/Bao.app
```

> **Code signing:** The `pack` script sets `CSC_IDENTITY_AUTO_DISCOVERY=false` to skip signing. To distribute outside your machine you need an Apple Developer certificate. See the [electron-builder code signing docs](https://www.electron.build/code-signing).

### Windows

On a Windows machine (or via CI):

```bash
npm run dist
```

Output in `release/`:

- `Bao Setup 1.0.0.exe` — NSIS installer
- `win-unpacked/` — portable app

Run the `.exe` to install, or launch `Bao.exe` from `win-unpacked/` for a portable setup.

**Unpacked only:**

```bash
npm run pack
```

> **Cross-compiling:** electron-builder can only build Windows targets on Windows (or CI with Wine). Use GitHub Actions or similar for multi-platform builds. See the [electron-builder multi-platform build docs](https://www.electron.build/multi-platform-build).

---

## Project Layout

| Path | Role |
|------|------|
| `main.js` | Main process — window creation, IPC handlers, vault protocol |
| `preload.js` | Secure bridge between main and renderer |
| `src/` | React renderer (Vite + TypeScript + Tailwind) |
| `src/components/` | UI components — editor, sidebar, tabs, search, settings |
| `src/lib/` | Utilities — formatting, tables, tags, search, images |
| `src/store/` | Zustand state management |
| `public/` | Static assets copied to `dist/` |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Vite dev server + Electron with hot-reload |
| `npm run build` | Build renderer into `dist/` |
| `npm start` | Launch Electron with built renderer |
| `npm test` | Run tests once |
| `npm run test:watch` | Run tests in watch mode |
| `npm run pack` | Build + package into an unpacked app (no installer) |
| `npm run dist` | Build + package into distributable installers |

