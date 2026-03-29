import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createContext, runInContext } from "node:vm";
import { JSDOM } from "jsdom";

const here = dirname(fileURLToPath(import.meta.url));

export type MarkdownParseWindow = Window &
  typeof globalThis & {
    parseMarkdownToHtml: (md: string) => string;
    htmlToMarkdown: (root: HTMLElement) => string;
    pasteHtmlToMarkdown: (html: string) => string;
  };

/** Load `public/markdown-parse.js` in a fresh jsdom window (same API as the Electron renderer). */
export function loadMarkdownParse(): MarkdownParseWindow {
  const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>", {
    url: "http://localhost/",
    pretendToBeVisual: true,
  });
  const w = dom.window;
  const code = readFileSync(
    join(here, "../../public/markdown-parse.js"),
    "utf8"
  );
  const ctx = createContext({
    window: w,
    document: w.document,
  });
  runInContext(code, ctx, { filename: "markdown-parse.js" });
  return w as unknown as MarkdownParseWindow;
}

/**
 * Install `markdown-parse.js` and `live-md.js` on an existing Window (e.g. Vitest jsdom).
 * Matches the globals loaded by `loadMarkdownLibs()` in the app.
 */
export function installMarkdownEditorGlobals(
  w: Window & typeof globalThis
): void {
  const parseCode = readFileSync(
    join(here, "../../public/markdown-parse.js"),
    "utf8"
  );
  const liveCode = readFileSync(
    join(here, "../../public/live-md.js"),
    "utf8"
  );
  /* live-md uses global `NodeFilter` (TreeWalker); vm sandbox must expose it. */
  const nodeFilter = w.NodeFilter ?? new JSDOM().window.NodeFilter;
  const ctx = createContext({
    window: w,
    document: w.document,
    NodeFilter: nodeFilter,
  });
  runInContext(parseCode, ctx, { filename: "markdown-parse.js" });
  runInContext(liveCode, ctx, { filename: "live-md.js" });
}

/** Serialize HTML fragment to markdown the same way the editor does. */
export function htmlFragmentToMarkdown(
  w: MarkdownParseWindow,
  html: string
): string {
  const div = w.document.createElement("div");
  div.innerHTML = html;
  return w.htmlToMarkdown(div);
}

/** Full round-trip: markdown → parse → HTML → htmlToMarkdown. */
export function markdownRoundTrip(w: MarkdownParseWindow, md: string): string {
  const html = w.parseMarkdownToHtml(md);
  return htmlFragmentToMarkdown(w, html);
}
