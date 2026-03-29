/** Slash command: `/` at the start of a line inside a text block (paragraph, heading, contenteditable div, list item, table cell, …). */

export type SlashDetection = {
  filter: string;
  /** Character offsets within `block` (UTF-16) for `/` through caret (inclusive of slash, exclusive of post-caret). */
  slashOffset: number;
  endOffset: number;
  block: HTMLElement;
  caretRect: DOMRect;
};

/** Block-level containers where `/` commands are allowed (matches common contenteditable output). */
function isSlashTextBlock(el: HTMLElement): boolean {
  const t = el.tagName;
  if (/^P|H[1-6]|LI|TD|TH$/i.test(t)) {
    return true;
  }
  /* Chromium often emits <div> lines instead of <p>; allow top-level or nested divs, but not known chrome. */
  if (/^DIV$/i.test(t)) {
    if (el.closest("pre")) {
      return false;
    }
    if (el.getAttribute("data-md-skip") === "true") {
      return false;
    }
    return true;
  }
  return false;
}

function nearestTextBlock(node: Node | null, root: HTMLElement): HTMLElement | null {
  let n: Node | null = node;
  while (n && n !== root) {
    if (n.nodeType === 1 && isSlashTextBlock(n as HTMLElement)) {
      return n as HTMLElement;
    }
    n = n.parentNode;
  }
  return null;
}

function caretOffsetIn(block: HTMLElement, anchor: Node, offset: number): number {
  const r = document.createRange();
  try {
    r.setStart(block, 0);
    r.setEnd(anchor, offset);
    return r.toString().length;
  } catch {
    return -1;
  }
}

function setRangeAtCharOffset(
  range: Range,
  block: HTMLElement,
  offset: number,
  isStart: boolean
): boolean {
  let remaining = offset;
  const walk = (n: Node): boolean => {
    if (n.nodeType === Node.TEXT_NODE) {
      const len = n.textContent?.length ?? 0;
      if (remaining < len) {
        if (isStart) {
          range.setStart(n, remaining);
        } else {
          range.setEnd(n, remaining);
        }
        return true;
      }
      if (remaining === len) {
        if (isStart) {
          range.setStart(n, len);
        } else {
          range.setEnd(n, len);
        }
        return true;
      }
      remaining -= len;
      return false;
    }
    for (let i = 0; i < n.childNodes.length; i += 1) {
      if (walk(n.childNodes[i])) {
        return true;
      }
    }
    return false;
  };
  const ok = walk(block);
  if (!ok && offset === 0) {
    if (isStart) {
      range.setStart(block, 0);
    } else {
      range.setEnd(block, 0);
    }
    return true;
  }
  return ok;
}

/** Build a range from slashOffset to endOffset (for delete). */
export function rangeForSlashDelete(
  block: HTMLElement,
  slashOffset: number,
  endOffset: number
): Range | null {
  const r = document.createRange();
  if (!setRangeAtCharOffset(r, block, slashOffset, true)) {
    return null;
  }
  if (!setRangeAtCharOffset(r, block, endOffset, false)) {
    return null;
  }
  return r;
}

function caretElementRect(): DOMRect | null {
  const sel = window.getSelection();
  if (!sel?.rangeCount) {
    return null;
  }
  const range = sel.getRangeAt(0);
  const rects = range.getClientRects();
  if (rects.length) {
    return rects[rects.length - 1]!;
  }
  /* Collapsed carets often report no client rects; bounding rect still has a usable position. */
  return range.getBoundingClientRect();
}

/**
 * When the caret is right after `/` and optional filter on the current line only, return slash state.
 */
export function detectSlashCommand(
  live: HTMLElement,
  anchor: Node,
  offset: number
): SlashDetection | null {
  const block = nearestTextBlock(anchor, live);
  if (!block || !live.contains(block)) {
    return null;
  }

  const endOffset = caretOffsetIn(block, anchor, offset);
  if (endOffset < 0) {
    return null;
  }

  const r = document.createRange();
  r.setStart(block, 0);
  r.setEnd(anchor, offset);
  const beforeCaret = r.toString().replace(/\r\n/g, "\n");
  const lineStart = beforeCaret.lastIndexOf("\n") + 1;
  const lineText = beforeCaret.slice(lineStart);

  const m = lineText.match(/^(\s*)\/(.*)$/);
  if (!m) {
    return null;
  }

  const wsLen = m[1].length;
  const slashOffset = lineStart + wsLen;
  const filter = m[2] ?? "";

  const rect = caretElementRect();
  if (!rect) {
    return null;
  }

  return {
    filter,
    slashOffset,
    endOffset,
    block,
    caretRect: rect,
  };
}

export function deleteSlashCommandRange(live: HTMLElement, det: SlashDetection): void {
  const r = rangeForSlashDelete(det.block, det.slashOffset, det.endOffset);
  if (!r) {
    return;
  }
  r.deleteContents();
  const sel = window.getSelection();
  if (sel) {
    sel.removeAllRanges();
    sel.addRange(r);
  }
  live.focus();
}
