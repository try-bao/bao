import type { EditorTab, TreeSelection } from "../types";

/** Vault-relative paths that can open as an editor tab (markdown, HTML, or image preview). */
const IMAGE_EXT_RE = /\.(png|jpe?g|gif|webp|svg|avif|bmp|ico)$/i;
const HTML_EXT_RE = /\.html?$/i;
const SCRATCH_PREFIX = ".bao/.scratch-";

export function isScratchPath(relPath: string): boolean {
  return relPath.startsWith(SCRATCH_PREFIX);
}

export function isImageRelPath(relPath: string): boolean {
  return IMAGE_EXT_RE.test(relPath);
}

export function isHtmlRelPath(relPath: string): boolean {
  return HTML_EXT_RE.test(relPath);
}

export function isOpenableInEditor(relPath: string): boolean {
  return relPath.toLowerCase().endsWith(".md") || isHtmlRelPath(relPath) || isImageRelPath(relPath);
}

export function basenameNoMd(relPath: string): string {
  const base = relPath.split("/").pop() || "";
  return base.replace(/\.md$/i, "");
}

/** Last path segment without extension — for tab labels (e.g. `a/b.png` → `b`). */
export function tabStemFromRelPath(relPath: string): string {
  if (relPath.toLowerCase().endsWith(".md")) {
    return basenameNoMd(relPath);
  }
  const base = relPath.split("/").pop() || relPath;
  const i = base.lastIndexOf(".");
  if (i > 0) {
    return base.slice(0, i);
  }
  return base;
}

export function titleFromMarkdown(content: string): string | null {
  const m = content.match(/^\s*#{1,6}\s+(.+)$/m);
  return m ? m[1].trim() : null;
}

/**
 * Split the note into an optional leading ATX title line (after leading blank lines)
 * and the rest. Only the first non-empty line is treated as the document title.
 */
export function splitLeadingAtxHeading(md: string): {
  level: number | null;
  headingText: string | null;
  body: string;
} {
  const raw = (md ?? "").replace(/^\uFEFF/, "");
  const leading = raw.match(/^((?:[ \t]*\r?\n)*)/);
  const start = leading?.[0].length ?? 0;
  const tail = raw.slice(start);
  const hm = tail.match(/^(#{1,6})\s+(.+?)\s*(\r?\n|$)/);
  if (!hm) {
    return { level: null, headingText: null, body: raw };
  }
  const level = hm[1].length;
  const headingText = hm[2].trim();
  const consumed = start + hm[0].length;
  const body = raw.slice(consumed);
  return { level, headingText, body };
}

export function mergeLeadingAtxHeading(
  level: number | null,
  headingText: string | null,
  body: string
): string {
  const b = (body ?? "").replace(/^\uFEFF/, "");
  const t = headingText?.trim() ?? "";
  if (t === "") {
    return b;
  }
  const lv = Math.min(6, Math.max(1, level ?? 1));
  const hashes = "#".repeat(lv);
  const rest = b.replace(/^\r?\n+/, "");
  return `${hashes} ${t}\n\n${rest}`;
}

/** Markdown passed into the live editor (leading title line is edited in the header). */
export function bodyMarkdownForEditor(fullMarkdown: string): string {
  return splitLeadingAtxHeading(fullMarkdown).body;
}

export function editorDisplayTitle(
  relPath: string | null,
  content: string
): string {
  if (!relPath) {
    return "No file open";
  }
  if (isScratchPath(relPath)) {
    const heading = titleFromMarkdown(content);
    return heading || "Untitled";
  }
  if (!relPath.toLowerCase().endsWith(".md")) {
    return relPath.split("/").pop() || relPath;
  }
  const heading = titleFromMarkdown(content);
  if (heading) {
    return heading;
  }
  return relPath.split("/").pop()?.replace(/\.md$/i, "") || relPath;
}

export function noteContentWithCopyHeading(
  content: string,
  originalStem: string
): string {
  if (/^\s*#{1,6}\s+/m.test(content)) {
    return content.replace(
      /^(\s*#{1,6}\s+)(.+)$/m,
      (_, lead: string, title: string) => `${lead}${title.trimEnd()} (copy)`
    );
  }
  return `# ${originalStem} (copy)\n\n${content}`;
}

export function isTabDirty(tab: EditorTab): boolean {
  if (tab.relPath && isImageRelPath(tab.relPath)) {
    return false;
  }
  if (tab.relPath && isScratchPath(tab.relPath)) {
    return true;
  }
  return tab.buffer !== tab.lastSavedContent;
}

export function tabTitle(tab: EditorTab): string {
  return editorDisplayTitle(tab.relPath, tab.buffer);
}

export function parentRel(relPath: string): string {
  const i = relPath.lastIndexOf("/");
  return i === -1 ? "" : relPath.slice(0, i);
}

export function mdFileName(raw: string): string {
  const t = raw.trim();
  if (!t) {
    return "";
  }
  return t.toLowerCase().endsWith(".md") ? t : `${t}.md`;
}

export function wouldMoveChangeLocation(
  fromRel: string,
  toParentRel: string
): boolean {
  const base = fromRel.split("/").pop();
  const next = toParentRel ? `${toParentRel}/${base}` : base!;
  return next !== fromRel;
}

export function remapOpenTabsAfterMove(
  tabs: EditorTab[],
  fromRel: string,
  newRel: string
): EditorTab[] {
  return tabs.map((tab) => {
    if (!tab.relPath) {
      return tab;
    }
    if (tab.relPath === fromRel) {
      return { ...tab, relPath: newRel };
    }
    const prefix = `${fromRel}/`;
    if (tab.relPath.startsWith(prefix)) {
      return {
        ...tab,
        relPath: newRel + tab.relPath.slice(fromRel.length),
      };
    }
    return tab;
  });
}

export function remapSelectionAfterMove(
  selection: TreeSelection | null,
  fromRel: string,
  newRel: string
): TreeSelection | null {
  if (!selection) {
    return null;
  }
  if (selection.relPath === fromRel) {
    return { relPath: newRel, isDirectory: selection.isDirectory };
  }
  const prefix = `${fromRel}/`;
  if (selection.relPath.startsWith(prefix)) {
    return {
      relPath: newRel + selection.relPath.slice(fromRel.length),
      isDirectory: selection.isDirectory,
    };
  }
  return selection;
}

/**
 * Generate a unique "Untitled" heading given a set of existing sibling names
 * (filenames without extension or headings).  Returns "Untitled", "Untitled 2", etc.
 */
export function generateUntitledTitle(existingNames: string[]): string {
  const lower = new Set(existingNames.map((n) => n.toLowerCase()));
  if (!lower.has("untitled")) {
    return "Untitled";
  }
  let i = 2;
  while (lower.has(`untitled ${i}`)) {
    i += 1;
  }
  return `Untitled ${i}`;
}

/**
 * Ensures a leading ATX heading exists in the markdown.
 * If none exists, prepends `# <title>`.
 */
export function ensureLeadingHeading(
  md: string,
  fallbackTitle: string,
): string {
  const split = splitLeadingAtxHeading(md);
  if (split.headingText) {
    return md;
  }
  const body = md.replace(/^\s+/, "");
  return body ? `# ${fallbackTitle}\n\n${body}` : `# ${fallbackTitle}\n`;
}
