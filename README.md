
<p align="center">
  <img src="public/logo_color.png" alt="Bao" width="128" />
</p>

<h1 align="center">Bao</h1>

<p align="center">
  A beautiful, local-first Markdown editor for notes, docs, and ideas.
</p>

---

**Bao** is a desktop Markdown editor that keeps everything on your machine — no accounts, no cloud, no subscriptions.
Open it and start writing. Your notes are plain Markdown files you can access anywhere.

<p align="center">
  <img src=".github/editor.gif" alt="editor" width="450" />
</p>

---

# Features

### ✍️ Editor

* Live rich-text Markdown with raw source mode
* Floating formatting toolbar
* Slash commands (`/`) for blocks and elements
* Tables, images, code blocks, and nested lists
* Syntax highlighting and inline image resizing

### 📁 Vault & Files

* Local vault folder (plain `.md` files)
* Sidebar file tree with drag & drop
* Create, rename, duplicate, delete files and folders
* Auto-rename file from first `# heading`
* Reveal in Finder / open in default app

### 🗂 Tabs

* Multi-tab editing
* Drag tabs between windows
* Unsaved changes indicator

### 🔍 Search

* Full-text vault search
* Live results with context
* In-editor highlighting

### 🏷 Tags & Notes

* Per-note tags with filtering
* Inline annotations and notes panel
* Resolve/reopen workflow

### 🤖 AI Assistant

* Built-in chat panel (backend integration planned)

---

# Getting Started

## Prerequisites

* Node.js 18+

## Install

```bash
npm install
```

## Development

```bash
npm run dev
```

Starts Vite and launches Electron with hot reload.

## Production

```bash
npm run build
npm start
```

## Tests

```bash
npm test
npm run test:watch
```

---

# Build Desktop App

Bao uses **electron-builder**.

## macOS

```bash
npm run dist
```

Output:

```
release/Bao-1.0.0.dmg
release/mac-arm64/Bao.app
```

## Windows

```bash
npm run dist
```

Output:

```
release/Bao Setup 1.0.0.exe
release/win-unpacked/
```

# Scripts

| Command       | Description            |
| ------------- | ---------------------- |
| npm run dev   | Run app in development |
| npm run build | Build renderer         |
| npm start     | Run built app          |
| npm test      | Run tests              |
| npm run pack  | Package app            |
| npm run dist  | Build installers       |
