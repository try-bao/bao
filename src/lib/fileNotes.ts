import type { BaoApi } from "../types";
import { splitLeadingAtxHeading } from "./noteUtils";
import { getMarkdownPreservingImgPaths } from "./vaultImageUrls";

/** Sidecar JSON under `.bao/notes/<vault-path>.json` (mirrors the note file path). */
export interface FileNoteEntry {
  index: [number, number];
  value: string;
  resolved: boolean;
  createdAt?: string;
}

export const NOTE_MARK_START = "\uE000";
export const NOTE_MARK_END = "\uE001";

/** Void elements that cannot contain child nodes and need special marker handling. */
const VOID_ELEMENT_TAGS = new Set(["IMG", "INPUT", "BR", "HR"]);

/**
 * When the selection is exactly one void element (img, checkbox, etc.),
 * Range.insertNode would corrupt the void element.
 * Return that element so callers can insert markers as siblings instead.
 */
function getSingleSelectedVoidElement(range: Range): Element | null {
  if (range.collapsed) {
    return null;
  }
  const { startContainer: sc, endContainer: ec, startOffset: so, endOffset: eo } =
    range;

  // Direct element selection
  if (
    sc === ec &&
    sc.nodeType === Node.ELEMENT_NODE &&
    VOID_ELEMENT_TAGS.has((sc as Element).tagName)
  ) {
    return sc as Element;
  }

  // Single child element within parent
  if (
    sc === ec &&
    sc.nodeType === Node.ELEMENT_NODE &&
    so + 1 === eo
  ) {
    const child = sc.childNodes[so];
    if (
      child?.nodeType === Node.ELEMENT_NODE &&
      VOID_ELEMENT_TAGS.has((child as Element).tagName)
    ) {
      return child as Element;
    }
  }

  return null;
}

/**
 * Legacy wrapper for image-only checks (used externally).
 */
function getSingleSelectedImage(range: Range): HTMLImageElement | null {
  const el = getSingleSelectedVoidElement(range);
  return el?.tagName === "IMG" ? (el as HTMLImageElement) : null;
}

/** `notes/foo.md` → `.bao/notes/notes/foo.md.json` */
export function fileNotesSidecarRelPath(relPath: string): string {
  const norm = relPath.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!norm) {
    return ".bao/notes/unknown.json";
  }
  return `.bao/notes/${norm}.json`;
}

/** Legacy: `notes/foo.md` → `notes/foo_notes.json` (beside the file). */
export function legacyFileNotesSidecarRelPath(relPath: string): string {
  const norm = relPath.replace(/\\/g, "/");
  const i = norm.lastIndexOf("/");
  const dir = i === -1 ? "" : norm.slice(0, i);
  const base = i === -1 ? norm : norm.slice(i + 1);
  const dot = base.lastIndexOf(".");
  const stem = dot > 0 ? base.slice(0, dot) : base;
  const name = `${stem}_notes.json`;
  return dir ? `${dir}/${name}` : name;
}

export function parseFileNotesJson(raw: string): FileNoteEntry[] {
  try {
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data)) {
      return [];
    }
    const out: FileNoteEntry[] = [];
    for (const row of data) {
      if (!row || typeof row !== "object") {
        continue;
      }
      const r = row as Record<string, unknown>;
      const idx = r.index;
      const value = r.value;
      const resolved = r.resolved;
      if (
        !Array.isArray(idx) ||
        idx.length !== 2 ||
        typeof idx[0] !== "number" ||
        typeof idx[1] !== "number"
      ) {
        continue;
      }
      if (typeof value !== "string") {
        continue;
      }
      out.push({
        index: [idx[0], idx[1]],
        value,
        resolved: Boolean(resolved),
        ...(typeof r.createdAt === "string" ? { createdAt: r.createdAt } : {}),
      });
    }
    return out;
  } catch {
    return [];
  }
}

export function serializeFileNotes(notes: FileNoteEntry[]): string {
  return `${JSON.stringify(notes, null, 2)}\n`;
}

/**
 * Adjust note character-offset indices after a document edit.
 * Compares old vs new body markdown to find the edit region,
 * then shifts note ranges that fall after the edit point.
 * Returns updated notes array, or null if nothing changed.
 */
export function adjustNoteIndicesForEdit(
  notes: FileNoteEntry[],
  oldBody: string,
  newBody: string
): FileNoteEntry[] | null {
  if (oldBody === newBody || notes.length === 0) return null;

  const minLen = Math.min(oldBody.length, newBody.length);
  let prefixLen = 0;
  while (prefixLen < minLen && oldBody[prefixLen] === newBody[prefixLen]) {
    prefixLen++;
  }

  let suffixLen = 0;
  const maxSuffix = minLen - prefixLen;
  while (
    suffixLen < maxSuffix &&
    oldBody[oldBody.length - 1 - suffixLen] === newBody[newBody.length - 1 - suffixLen]
  ) {
    suffixLen++;
  }

  const oldEditEnd = oldBody.length - suffixLen;
  const newEditEnd = newBody.length - suffixLen;
  const delta = newEditEnd - oldEditEnd;

  if (delta === 0 && prefixLen === oldEditEnd) return null;

  let changed = false;
  const result: FileNoteEntry[] = [];

  for (const n of notes) {
    const [s, e] = n.index;

    if (e <= prefixLen) {
      // entirely before the edit – no change
      result.push(n);
    } else if (s >= oldEditEnd) {
      // entirely after the edit – shift by delta
      result.push({ ...n, index: [s + delta, e + delta] });
      changed = true;
    } else if (s <= prefixLen && e >= oldEditEnd) {
      // edit is fully contained within the note – expand / shrink end
      result.push({ ...n, index: [s, e + delta] });
      changed = true;
    } else {
      // partial overlap – the annotated text was partially rewritten; drop
      changed = true;
    }
  }

  if (!changed) return null;
  return result;
}

function rangesOverlap(a: [number, number], b: [number, number]): boolean {
  return !(a[1] <= b[0] || b[1] <= a[0]);
}

/**
 * Insert marker characters into body markdown (UTF-16 indices) for note ranges.
 * Skips overlapping ranges. Inserts from right to left so all indices stay valid.
 */
export function injectNoteMarkersInBodyMd(
  bodyMd: string,
  notes: FileNoteEntry[]
): { marked: string; noteFileIndices: number[] } {
  const items = notes
    .map((n, fileIndex) => ({ n, fileIndex }))
    .filter(({ n }) => {
      if (n.resolved) return false;
      const [a, b] = n.index;
      return Number.isFinite(a) && Number.isFinite(b) && a >= 0 && b <= bodyMd.length && a < b;
    })
    .sort((a, b) => a.n.index[0] - b.n.index[0]);

  // Deduplicate overlapping ranges
  const kept: typeof items = [];
  for (const item of items) {
    if (kept.length > 0 && rangesOverlap(kept[kept.length - 1].n.index, item.n.index)) continue;
    kept.push(item);
  }

  // Build insertion ops (right-to-left to keep offsets valid)
  const ops: { p: number; ch: string }[] = [];
  for (const { n } of kept) {
    const [st, en] = n.index;
    ops.push({ p: en, ch: NOTE_MARK_END }, { p: st, ch: NOTE_MARK_START });
  }
  ops.sort((a, b) => b.p - a.p);

  // Use string slicing (UTF-16 indexing) to match how offsets are computed
  let marked = bodyMd;
  for (const op of ops) {
    marked = marked.slice(0, op.p) + op.ch + marked.slice(op.p);
  }
  return { marked, noteFileIndices: kept.map((k) => k.fileIndex) };
}

/**
 * Parse an HTML string and find the text-stream positions of NOTE_MARK_START / NOTE_MARK_END pairs.
 * Returns an array of {visStart, visEnd} where visStart/visEnd are character offsets in the
 * "visible text" (all text content concatenated with tags stripped, markers excluded from counting).
 */
function extractMarkerPositionsFromHtml(
  html: string
): { visStart: number; visEnd: number }[] {
  const results: { visStart: number; visEnd: number }[] = [];
  let visOffset = 0;
  let insideTag = false;
  let currentStart = -1;

  for (let i = 0; i < html.length; i++) {
    const ch = html[i];
    if (ch === "<") {
      // Count <img> tags as 1 visible unit (they are void elements with no text children)
      const slice = html.slice(i, i + 5).toLowerCase();
      if (slice.startsWith("<img") && /[ \/>]/.test(slice[4] ?? "")) {
        visOffset++;
      }
      insideTag = true;
      continue;
    }
    if (ch === ">") {
      insideTag = false;
      continue;
    }
    if (insideTag) continue;

    // Decode HTML entity if present
    if (ch === "&") {
      const semi = html.indexOf(";", i);
      if (semi !== -1 && semi - i <= 8) {
        const entity = html.slice(i, semi + 1);
        // Common entities — decode to single char
        const decoded = decodeEntity(entity);
        if (decoded !== null) {
          // Check if the decoded char is a marker
          if (decoded === NOTE_MARK_START) {
            currentStart = visOffset;
            i = semi;
            continue;
          }
          if (decoded === NOTE_MARK_END) {
            if (currentStart !== -1) {
              results.push({ visStart: currentStart, visEnd: visOffset });
              currentStart = -1;
            }
            i = semi;
            continue;
          }
          visOffset += decoded.length;
          i = semi;
          continue;
        }
      }
    }

    if (ch === NOTE_MARK_START) {
      currentStart = visOffset;
      continue;
    }
    if (ch === NOTE_MARK_END) {
      if (currentStart !== -1) {
        results.push({ visStart: currentStart, visEnd: visOffset });
        currentStart = -1;
      }
      continue;
    }

    visOffset++;
  }
  return results;
}

function decodeEntity(entity: string): string | null {
  const map: Record<string, string> = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&#39;": "'",
    "&apos;": "'",
    "&nbsp;": "\u00a0",
  };
  if (map[entity]) return map[entity];
  // Numeric entities: &#xE000; or &#57344;
  if (entity.startsWith("&#x")) {
    const code = parseInt(entity.slice(3, -1), 16);
    if (!isNaN(code)) return String.fromCharCode(code);
  }
  if (entity.startsWith("&#")) {
    const code = parseInt(entity.slice(2, -1), 10);
    if (!isNaN(code)) return String.fromCharCode(code);
  }
  return null;
}

/**
 * Apply note highlights as absolutely-positioned overlay divs.
 * This runs AFTER all markdown parsing and live-md transforms are complete.
 * 
 * No DOM mutation of editor content — just overlays on top.
 *
 * Strategy (two-pass):
 * 1. Inject markers into markdown, parse with the real parser → HTML with markers
 * 2. Extract marker positions in the HTML text stream (strip tags, count chars)
 * 3. Walk the final DOM to build Ranges from visible-text offsets
 * 4. Use Range.getClientRects() to position overlay divs
 */
export function applyNoteHighlightsToRenderedDom(
  root: HTMLElement,
  fullMd: string,
  notes: FileNoteEntry[]
): void {
  // Remove any previous overlays
  root.querySelectorAll(".bao-note-overlay-container").forEach((el) => el.remove());

  if (typeof window.parseMarkdownToHtml !== "function") return;

  // Note indices are body-relative (heading is managed by EditorHeader).
  // Split the full markdown so we can inject markers into the body, then
  // reconstruct the full document before parsing.  This ensures the marker
  // positions in the parsed HTML match the full DOM (which includes the heading).
  const { body: bodyMd } = splitLeadingAtxHeading(fullMd);
  const headingPrefix = fullMd.slice(0, fullMd.length - bodyMd.length);

  const { marked: markedBody, noteFileIndices } = injectNoteMarkersInBodyMd(bodyMd, notes);
  if (noteFileIndices.length === 0) return;

  // Step 1: Parse the full markdown (heading + marked body) using the real parser
  const htmlWithMarkers = window.parseMarkdownToHtml(headingPrefix + markedBody);

  // Step 2: Find marker positions in the visible text stream
  const markerRanges = extractMarkerPositionsFromHtml(htmlWithMarkers);
  if (markerRanges.length === 0) return;

  const visRanges = markerRanges.map((r, i) => ({
    ...r,
    fileIndex: noteFileIndices[i] ?? i,
  }));

  // Step 3: Build DOM position entries (text nodes + IMG elements)
  const posEntries = buildDomPosEntries(root);

  // The root needs position:relative so overlays position correctly
  const prevPosition = root.style.position;
  if (!prevPosition || prevPosition === "static") {
    root.style.position = "relative";
  }

  // Step 4: Create overlay container and position highlight overlays
  const container = document.createElement("div");
  container.className = "bao-note-overlay-container";
  container.setAttribute("aria-hidden", "true");
  container.setAttribute("contenteditable", "false");
  container.style.cssText = "position:absolute;top:0;left:0;width:0;height:0;pointer-events:none;z-index:1;";

  const rootRect = root.getBoundingClientRect();
  const scrollLeft = root.scrollLeft;
  const scrollTop = root.scrollTop;

  for (const { visStart, visEnd, fileIndex } of visRanges) {
    if (visStart >= visEnd) continue;

    const range = createRangeFromEntries(posEntries, visStart, visEnd);
    if (!range) continue;

    let rects: DOMRectList | DOMRect[];
    try {
      rects = range.getClientRects();
      if (rects.length === 0) {
        // For element-only ranges (e.g. images), use getBoundingClientRect on the element
        const bounding = range.getBoundingClientRect();
        if (bounding.width > 0 && bounding.height > 0) {
          rects = [bounding];
        } else {
          continue;
        }
      }
    } catch {
      continue;
    }

    for (let ri = 0; ri < rects.length; ri++) {
      const r = rects[ri];
      if (r.width <= 0 || r.height <= 0) continue;

      const overlay = document.createElement("div");
      overlay.className = "bao-note-highlight";
      overlay.dataset.baoNoteIndex = String(fileIndex);
      if (ri === 0) {
        // Only the first rect is clickable/focusable
        overlay.setAttribute("role", "button");
        overlay.setAttribute("tabindex", "0");
        overlay.setAttribute("aria-label", "Note");
      }
      overlay.style.cssText =
        `position:absolute;pointer-events:auto;` +
        `left:${r.left - rootRect.left + scrollLeft}px;` +
        `top:${r.top - rootRect.top + scrollTop}px;` +
        `width:${r.width}px;` +
        `height:${r.height}px;`;
      container.appendChild(overlay);
    }
  }

  if (container.children.length > 0) {
    root.appendChild(container);
  }
}

type DomPosEntry =
  | { isElement: false; node: Text; start: number; end: number }
  | { isElement: true; node: Element; start: number; end: number };

function buildDomPosEntries(root: HTMLElement): DomPosEntry[] {
  const posEntries: DomPosEntry[] = [];
  let cumOffset = 0;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ALL, {
    acceptNode(node) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as Element;
        if (
          el.getAttribute("contenteditable") === "false" ||
          el.hasAttribute("data-md-skip")
        ) {
          return NodeFilter.FILTER_REJECT;
        }
        if (el.tagName === "IMG") {
          return NodeFilter.FILTER_ACCEPT;
        }
        return NodeFilter.FILTER_SKIP;
      }
      if (node.nodeType === Node.TEXT_NODE) {
        const parent = node.parentElement;
        if (parent?.closest("[contenteditable='false'], [data-md-skip]")) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
      return NodeFilter.FILTER_SKIP;
    },
  });
  let wNode: Node | null;
  while ((wNode = walker.nextNode())) {
    if (wNode.nodeType === Node.TEXT_NODE) {
      const text = wNode as Text;
      const len = (text.textContent ?? "").length;
      if (len > 0) {
        posEntries.push({ isElement: false, node: text, start: cumOffset, end: cumOffset + len });
        cumOffset += len;
      }
    } else if (wNode.nodeType === Node.ELEMENT_NODE && (wNode as Element).tagName === "IMG") {
      posEntries.push({ isElement: true, node: wNode as Element, start: cumOffset, end: cumOffset + 1 });
      cumOffset += 1;
    }
  }
  return posEntries;
}

/**
 * Build a DOM Range from visible-text offsets using the position entries.
 * Handles both text nodes (character offsets) and IMG elements (before/after).
 */
function createRangeFromEntries(
  entries: ({ isElement: false; node: Text; start: number; end: number } | { isElement: true; node: Element; start: number; end: number })[],
  visStart: number,
  visEnd: number
): Range | null {
  const range = document.createRange();
  let startSet = false;
  let endSet = false;

  // Find start position
  for (const entry of entries) {
    if (entry.isElement) {
      if (visStart === entry.start) {
        range.setStartBefore(entry.node);
        startSet = true;
        break;
      }
    } else {
      if (visStart >= entry.start && visStart <= entry.end) {
        range.setStart(entry.node, visStart - entry.start);
        startSet = true;
        break;
      }
    }
  }

  // Find end position
  for (const entry of entries) {
    if (entry.isElement) {
      if (visEnd === entry.end) {
        range.setEndAfter(entry.node);
        endSet = true;
        break;
      }
    } else {
      if (visEnd >= entry.start && visEnd <= entry.end) {
        range.setEnd(entry.node, visEnd - entry.start);
        endSet = true;
        break;
      }
    }
  }

  return startSet && endSet ? range : null;
}

/**
 * Insert temporary markers around the selection, read body markdown offsets, then remove markers.
 * Handles void elements (images, checkboxes), list items, and cross-block selections.
 */
export function measureNoteOffsetsFromSelection(
  live: HTMLElement,
  range: Range,
  noteRelPath: string | null
): [number, number] | null {
  if (!live.contains(range.commonAncestorContainer)) {
    return null;
  }
  if (range.collapsed) {
    return null;
  }

  // Handle single void element selection (img, checkbox, etc.)
  const voidEl = getSingleSelectedVoidElement(range);
  const voidParent = voidEl?.parentNode ?? null;
  if (voidEl && voidParent) {
    voidParent.insertBefore(document.createTextNode(NOTE_MARK_START), voidEl);
    voidParent.insertBefore(document.createTextNode(NOTE_MARK_END), voidEl.nextSibling);
  } else {
    // Standard text selection handling
    const sc = range.startContainer;
    const so = range.startOffset;
    const ec = range.endContainer;
    const eo = range.endOffset;

    // Check if start or end is inside a void element and adjust
    const startVoid = findContainingVoidElement(sc);
    const endVoid = findContainingVoidElement(ec);

    try {
      if (startVoid && endVoid && startVoid === endVoid) {
        // Both ends inside same void element - wrap the whole element
        const parent = startVoid.parentNode;
        if (parent) {
          parent.insertBefore(document.createTextNode(NOTE_MARK_START), startVoid);
          parent.insertBefore(document.createTextNode(NOTE_MARK_END), startVoid.nextSibling);
        }
      } else {
        // Insert end marker first (to preserve start offsets)
        const endRange = document.createRange();
        if (endVoid && endVoid.parentNode) {
          endRange.setStartAfter(endVoid);
        } else {
          endRange.setStart(ec, eo);
        }
        endRange.collapse(true);
        endRange.insertNode(document.createTextNode(NOTE_MARK_END));

        // Insert start marker
        const startRange = document.createRange();
        if (startVoid && startVoid.parentNode) {
          startRange.setStartBefore(startVoid);
        } else {
          startRange.setStart(sc, so);
        }
        startRange.collapse(true);
        startRange.insertNode(document.createTextNode(NOTE_MARK_START));
      }
    } catch {
      // Fallback: try original approach
      const endRange = document.createRange();
      endRange.setStart(ec, eo);
      endRange.collapse(true);
      endRange.insertNode(document.createTextNode(NOTE_MARK_END));

      const startRange = document.createRange();
      startRange.setStart(sc, so);
      startRange.collapse(true);
      startRange.insertNode(document.createTextNode(NOTE_MARK_START));
    }
  }

  const md = getMarkdownPreservingImgPaths(live, noteRelPath);
  const i0 = md.indexOf(NOTE_MARK_START);
  const i1 = md.indexOf(NOTE_MARK_END);
  if (i0 === -1 || i1 === -1 || i1 <= i0) {
    removeFirstMarkerPairFromLive(live);
    return null;
  }

  // i0 and i1 are positions in the marked string.  Convert to positions in
  // the original (marker-free) string: the start marker at i0 shifts
  // everything after it by +1, so original_start = i0 and
  // original_end = i1 - 1 (subtracting the one marker char before i1).
  let start = i0;
  let end = i1 - 1;

  removeFirstMarkerPairFromLive(live);

  if (end <= start) {
    return null;
  }

  // Note indices are body-relative (heading is managed by EditorHeader).
  // The live editor renders the full markdown including heading, so the raw
  // positions above are full-markdown-relative.  Subtract the heading length.
  if (noteRelPath?.toLowerCase().endsWith(".md")) {
    const clean = md.replaceAll(NOTE_MARK_START, "").replaceAll(NOTE_MARK_END, "");
    const { body } = splitLeadingAtxHeading(clean);
    const headingLen = clean.length - body.length;
    start -= headingLen;
    end -= headingLen;
    if (start < 0 || end <= start) {
      return null;
    }
  }

  return [start, end];
}

/**
 * Check if a node is inside (or is) a void element that can't contain markers internally.
 */
function findContainingVoidElement(node: Node): Element | null {
  let n: Node | null = node;
  while (n) {
    if (n.nodeType === Node.ELEMENT_NODE) {
      const el = n as Element;
      if (VOID_ELEMENT_TAGS.has(el.tagName)) {
        return el;
      }
      // Also treat contenteditable=false elements as "void" for marker purposes
      if (el.getAttribute("contenteditable") === "false") {
        return el;
      }
    }
    n = n.parentNode;
  }
  return null;
}

function findFirstChar(
  root: HTMLElement,
  ch: string
): { node: Text; offset: number } | null {
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  let n: Node | null;
  while ((n = w.nextNode())) {
    const t = n as Text;
    const str = t.textContent ?? "";
    const i = str.indexOf(ch);
    if (i !== -1) {
      return { node: t, offset: i };
    }
  }
  return null;
}

function deleteCharAt(loc: { node: Text; offset: number }): void {
  const t = loc.node;
  const str = t.textContent ?? "";
  t.textContent = str.slice(0, loc.offset) + str.slice(loc.offset + 1);
}

function removeFirstMarkerPairFromLive(live: HTMLElement): void {
  const e = findFirstChar(live, NOTE_MARK_END);
  if (e) {
    deleteCharAt(e);
  }
  const s = findFirstChar(live, NOTE_MARK_START);
  if (s) {
    deleteCharAt(s);
  }
}

export async function readFileNotesIfPresent(
  api: BaoApi,
  mdRelPath: string
): Promise<FileNoteEntry[]> {
  const sidecar = fileNotesSidecarRelPath(mdRelPath);
  try {
    if (await api.pathExists(sidecar)) {
      return parseFileNotesJson(await api.readFile(sidecar));
    }
    // Migration: old .metadata/notes/ path → new .bao/notes/ path
    const oldMetadata = sidecar.replace(/^\.bao\/notes\//, ".metadata/notes/");
    if (oldMetadata !== sidecar && (await api.pathExists(oldMetadata))) {
      const raw = await api.readFile(oldMetadata);
      const list = parseFileNotesJson(raw);
      await writeFileNotes(api, mdRelPath, list);
      try {
        await api.deleteItem(oldMetadata);
      } catch {
        /* ignore */
      }
      return list;
    }
    const legacy = legacyFileNotesSidecarRelPath(mdRelPath);
    if (await api.pathExists(legacy)) {
      const raw = await api.readFile(legacy);
      const list = parseFileNotesJson(raw);
      await writeFileNotes(api, mdRelPath, list);
      try {
        await api.deleteItem(legacy);
      } catch {
        /* ignore */
      }
      return list;
    }
  } catch {
    /* ignore */
  }
  return [];
}

export async function writeFileNotes(
  api: BaoApi,
  mdRelPath: string,
  notes: FileNoteEntry[]
): Promise<void> {
  const sidecar = fileNotesSidecarRelPath(mdRelPath);
  await api.writeFile(sidecar, serializeFileNotes(notes));
}

export async function renameFileNotesSidecar(
  api: BaoApi,
  oldMdRel: string,
  newMdRel: string
): Promise<void> {
  const oldS = fileNotesSidecarRelPath(oldMdRel);
  const newS = fileNotesSidecarRelPath(newMdRel);
  if (oldS === newS) {
    return;
  }
  try {
    let raw: string | null = null;
    if (await api.pathExists(oldS)) {
      raw = await api.readFile(oldS);
    } else {
      const leg = legacyFileNotesSidecarRelPath(oldMdRel);
      if (await api.pathExists(leg)) {
        raw = await api.readFile(leg);
      }
    }
    if (raw !== null) {
      await api.writeFile(newS, raw);
    }
    if (await api.pathExists(oldS)) {
      await api.deleteItem(oldS);
    }
    const leg = legacyFileNotesSidecarRelPath(oldMdRel);
    if (await api.pathExists(leg)) {
      await api.deleteItem(leg);
    }
  } catch {
    /* ignore */
  }
}

export async function copyFileNotesSidecar(
  api: BaoApi,
  srcMdRel: string,
  destMdRel: string
): Promise<void> {
  const srcS = fileNotesSidecarRelPath(srcMdRel);
  const destS = fileNotesSidecarRelPath(destMdRel);
  try {
    let raw: string | null = null;
    if (await api.pathExists(srcS)) {
      raw = await api.readFile(srcS);
    } else {
      const leg = legacyFileNotesSidecarRelPath(srcMdRel);
      if (await api.pathExists(leg)) {
        raw = await api.readFile(leg);
      }
    }
    if (raw !== null) {
      await api.writeFile(destS, raw);
    }
  } catch {
    /* ignore */
  }
}

/** Remove new-path and legacy sidecars for a markdown file (e.g. on delete). */
export async function deleteAllFileNotesSidecarsForMd(
  api: BaoApi,
  mdRelPath: string
): Promise<void> {
  for (const p of [
    fileNotesSidecarRelPath(mdRelPath),
    legacyFileNotesSidecarRelPath(mdRelPath),
  ]) {
    try {
      if (await api.pathExists(p)) {
        await api.deleteItem(p);
      }
    } catch {
      /* ignore */
    }
  }
}

export function remapFileNotesStateKey(
  map: Record<string, FileNoteEntry[]>,
  fromRel: string,
  toRel: string
): Record<string, FileNoteEntry[]> {
  const next: Record<string, FileNoteEntry[]> = {};
  const prefix = `${fromRel}/`;
  for (const [key, val] of Object.entries(map)) {
    if (key === fromRel) {
      next[toRel] = val;
    } else if (key.startsWith(prefix)) {
      next[toRel + key.slice(fromRel.length)] = val;
    } else {
      next[key] = val;
    }
  }
  return next;
}
