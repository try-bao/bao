/** Helpers for the floating markdown style toolbar (contenteditable + execCommand + DOM). */

export function getMdLiveEl(): HTMLElement | null {
  return document.querySelector("[data-bao-md-live]");
}

export function isSelectionInsideMdLive(): boolean {
  const live = getMdLiveEl();
  const sel = window.getSelection();
  if (!live || !sel?.rangeCount) {
    return false;
  }
  return live.contains(sel.anchorNode) && live.contains(sel.focusNode);
}

export function getActiveRangeCloned(): Range | null {
  const sel = window.getSelection();
  if (!sel?.rangeCount || sel.isCollapsed) {
    return null;
  }
  const live = getMdLiveEl();
  if (!live || !isSelectionInsideMdLive()) {
    return null;
  }
  return sel.getRangeAt(0).cloneRange();
}

export function restoreRange(live: HTMLElement, range: Range): void {
  const sel = window.getSelection();
  if (!sel) {
    return;
  }
  sel.removeAllRanges();
  sel.addRange(range);
  live.focus();
}

function hasCommand(name: string): boolean {
  return (
    typeof document.queryCommandSupported === "function" &&
    document.queryCommandSupported(name)
  );
}

export function applyBold(): void {
  if (hasCommand("bold")) {
    document.execCommand("bold", false);
  }
}

export function applyItalic(): void {
  if (hasCommand("italic")) {
    document.execCommand("italic", false);
  }
}

export function applyStrikethrough(): void {
  if (hasCommand("strikeThrough")) {
    document.execCommand("strikeThrough", false);
  }
}

/** Wraps the current range contents in <code> (best-effort if selection crosses blocks). */
export function applyInlineCode(live: HTMLElement): void {
  const sel = window.getSelection();
  if (!sel?.rangeCount || sel.isCollapsed) {
    return;
  }
  const range = sel.getRangeAt(0);
  if (!live.contains(range.commonAncestorContainer)) {
    return;
  }
  try {
    const frag = range.extractContents();
    const code = document.createElement("code");
    code.appendChild(frag);
    range.insertNode(code);
    sel.removeAllRanges();
    const after = document.createRange();
    after.selectNodeContents(code);
    after.collapse(false);
    sel.addRange(after);
  } catch {
    /* range.surroundContents can throw across block boundaries */
  }
}

export function applyLink(url: string): void {
  const u = String(url || "").trim();
  if (!u || !hasCommand("createLink")) {
    return;
  }
  document.execCommand("createLink", false, u);
}

export function applyUnlink(): void {
  if (hasCommand("unlink")) {
    document.execCommand("unlink", false);
  }
}

/* ── Active‑format detection ─────────────────────────────────────── */

/** Walk up from `node` looking for an ancestor element matching `tag` below `root`. */
function closestTag(
  node: Node | null,
  tag: string,
  root: HTMLElement
): Element | null {
  let n: Node | null = node;
  while (n && n !== root) {
    if (
      n.nodeType === 1 &&
      (n as Element).tagName.toLowerCase() === tag
    ) {
      return n as Element;
    }
    n = n.parentNode;
  }
  return null;
}

export interface ActiveFormats {
  bold: boolean;
  italic: boolean;
  strikethrough: boolean;
  code: boolean;
  link: boolean;
}

/** Detect which inline formats are active for the current selection. */
export function detectActiveFormats(live: HTMLElement): ActiveFormats {
  const result: ActiveFormats = {
    bold: false,
    italic: false,
    strikethrough: false,
    code: false,
    link: false,
  };
  const sel = window.getSelection();
  if (!sel?.rangeCount || !live.contains(sel.anchorNode)) {
    return result;
  }
  result.bold = document.queryCommandState("bold");
  result.italic = document.queryCommandState("italic");
  result.strikethrough = document.queryCommandState("strikeThrough");
  result.code = closestTag(sel.anchorNode, "code", live) !== null;
  result.link = closestTag(sel.anchorNode, "a", live) !== null;
  return result;
}

/** Toggle inline code: unwrap if already inside <code>, otherwise wrap. */
export function toggleInlineCode(live: HTMLElement): void {
  const sel = window.getSelection();
  if (!sel?.rangeCount || sel.isCollapsed) {
    return;
  }
  const codeEl = closestTag(sel.anchorNode, "code", live);
  if (codeEl) {
    // Unwrap: replace <code> with its children
    const parent = codeEl.parentNode;
    if (!parent) return;
    while (codeEl.firstChild) {
      parent.insertBefore(codeEl.firstChild, codeEl);
    }
    parent.removeChild(codeEl);
    return;
  }
  applyInlineCode(live);
}

export function applyRemoveFormat(): void {
  if (hasCommand("removeFormat")) {
    document.execCommand("removeFormat", false);
  }
}

export function applyFormatBlock(tag: string): void {
  const t = String(tag || "").toLowerCase();
  if (!t || !hasCommand("formatBlock")) {
    return;
  }
  document.execCommand("formatBlock", false, t);
}

export function applyBulletList(): void {
  if (hasCommand("insertUnorderedList")) {
    document.execCommand("insertUnorderedList", false);
  }
}

export function applyOrderedList(): void {
  if (hasCommand("insertOrderedList")) {
    document.execCommand("insertOrderedList", false);
  }
}

export function applyHorizontalRule(): void {
  if (hasCommand("insertHorizontalRule")) {
    document.execCommand("insertHorizontalRule", false);
  }
}

function topLevelChild(node: Node | null, root: HTMLElement): Element | null {
  let n: Node | null = node;
  while (n && n !== root) {
    if (n.parentNode === root && n.nodeType === 1) {
      return n as Element;
    }
    n = n.parentNode;
  }
  return null;
}

/** Innermost `p` / `h1`–`h6` containing the caret (e.g. inside a list item). */
function nearestBlockParagraphOrHeading(
  node: Node | null,
  root: HTMLElement
): Element | null {
  let n: Node | null = node;
  while (n && n !== root) {
    if (n.nodeType === 1) {
      const t = (n as Element).tagName;
      if (/^P|H[1-6]$/i.test(t)) {
        return n as Element;
      }
    }
    n = n.parentNode;
  }
  return null;
}

/** One row: `- [ ] text` as task list (matches live-md task HTML). */
export function applyTaskList(live: HTMLElement): void {
  const sel = window.getSelection();
  if (!sel?.rangeCount) {
    return;
  }
  const block = topLevelChild(sel.anchorNode, live);
  if (!block || !/^P|H[1-6]$/i.test(block.tagName)) {
    return;
  }
  const ul = document.createElement("ul");
  ul.className = "md-task-list";
  const li = document.createElement("li");
  li.className = "md-task-item";
  const cb = document.createElement("input");
  cb.type = "checkbox";
  cb.className = "md-task-cb";
  cb.setAttribute("contenteditable", "false");
  li.appendChild(cb);
  li.appendChild(document.createTextNode(" "));
  const span = document.createElement("span");
  span.className = "md-task-body";
  span.innerHTML = block.innerHTML;
  if (!span.textContent || span.textContent.replace(/\u200b/g, "").trim() === "") {
    span.textContent = "\u200b";
  }
  li.appendChild(span);
  ul.appendChild(li);
  block.parentNode?.replaceChild(ul, block);

  const sel2 = window.getSelection();
  if (sel2) {
    const r = document.createRange();
    r.selectNodeContents(span);
    r.collapse(false);
    sel2.removeAllRanges();
    sel2.addRange(r);
  }
  live.focus();
}

export function applyCodeBlock(live: HTMLElement): void {
  const sel = window.getSelection();
  if (!sel?.rangeCount) {
    return;
  }
  let block = topLevelChild(sel.anchorNode, live);
  if (!block || !/^P|H[1-6]$/i.test(block.tagName)) {
    block = nearestBlockParagraphOrHeading(sel.anchorNode, live);
  }
  if (!block || !/^P|H[1-6]$/i.test(block.tagName)) {
    return;
  }
  const text = (block as HTMLElement).innerText.replace(/\r\n/g, "\n");
  const pre = document.createElement("pre");
  const code = document.createElement("code");
  /* Use zero-width space for empty code so contenteditable can place a caret */
  code.textContent = text || "\u200b";
  pre.appendChild(code);
  block.parentNode?.replaceChild(pre, block);

  const sel2 = window.getSelection();
  if (sel2) {
    const r = document.createRange();
    r.selectNodeContents(code);
    r.collapse(false);
    sel2.removeAllRanges();
    sel2.addRange(r);
  }
  live.focus();
}

const TABLE_HTML = `<table class="md-table">
<thead><tr><th>\u00a0</th><th>\u00a0</th></tr></thead>
<tbody><tr><td>\u00a0</td><td>\u00a0</td></tr></tbody>
</table>`;

export function insertTable(): void {
  if (hasCommand("insertHTML")) {
    document.execCommand("insertHTML", false, TABLE_HTML);
  }
}

export function applyIndent(): void {
  if (hasCommand("indent")) {
    document.execCommand("indent", false);
  }
}

export function applyOutdent(): void {
  if (hasCommand("outdent")) {
    document.execCommand("outdent", false);
  }
}

export function applyUndo(): void {
  if (hasCommand("undo")) {
    document.execCommand("undo", false);
  }
}

export function applyRedo(): void {
  if (hasCommand("redo")) {
    document.execCommand("redo", false);
  }
}

export function insertImageMarkdown(alt: string, url: string): void {
  const a = String(alt || "").replace(/[[\]]/g, "");
  const u = String(url || "").trim();
  if (!u) {
    return;
  }
  const md = `![${a}](${u})`;
  if (hasCommand("insertText")) {
    document.execCommand("insertText", false, md);
  }
}

/* ── Slash-command direct DOM helpers ──────────────────────────── */

/** Place caret at the end of an element's contents. */
function placeCaretAtEnd(el: HTMLElement): void {
  const sel = window.getSelection();
  if (!sel) return;
  const r = document.createRange();
  r.selectNodeContents(el);
  r.collapse(false);
  sel.removeAllRanges();
  sel.addRange(r);
}

/** Find the current top-level block (or nearest P/DIV) under `live` at the caret position. */
function currentBlock(live: HTMLElement): Element | null {
  const sel = window.getSelection();
  if (!sel?.anchorNode) return null;
  let block = topLevelChild(sel.anchorNode, live);
  if (!block) block = nearestBlockParagraphOrHeading(sel.anchorNode, live);
  return block;
}

export function applyHeading(live: HTMLElement, level: number): void {
  const block = currentBlock(live);
  if (!block) return;
  const tag = `h${Math.min(6, Math.max(1, level))}`;
  const h = document.createElement(tag);
  h.appendChild(document.createElement("br"));
  block.parentNode?.replaceChild(h, block);
  live.focus();
  placeCaretAtEnd(h);
}

export function applyBulletListBlock(live: HTMLElement): void {
  const block = currentBlock(live);
  if (!block) return;
  const ul = document.createElement("ul");
  const li = document.createElement("li");
  li.textContent = "\u200b";
  ul.appendChild(li);
  block.parentNode?.replaceChild(ul, block);
  live.focus();
  placeCaretAtEnd(li);
}

export function applyNumberedListBlock(live: HTMLElement): void {
  const block = currentBlock(live);
  if (!block) return;
  const ol = document.createElement("ol");
  const li = document.createElement("li");
  li.textContent = "\u200b";
  ol.appendChild(li);
  block.parentNode?.replaceChild(ol, block);
  live.focus();
  placeCaretAtEnd(li);
}

export function applyBlockquote(live: HTMLElement): void {
  const block = currentBlock(live);
  if (!block) return;
  const bq = document.createElement("blockquote");
  const p = document.createElement("p");
  p.textContent = "\u200b";
  bq.appendChild(p);
  block.parentNode?.replaceChild(bq, block);
  live.focus();
  placeCaretAtEnd(p);
}

export function applyDivider(live: HTMLElement): void {
  const block = currentBlock(live);
  if (!block) return;
  const hr = document.createElement("hr");
  const p = document.createElement("p");
  p.appendChild(document.createElement("br"));
  block.parentNode?.replaceChild(hr, block);
  hr.parentNode?.insertBefore(p, hr.nextSibling);
  live.focus();
  placeCaretAtEnd(p);
}
