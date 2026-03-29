/**
 * Highlight search matches in a contentEditable element using CSS Custom Highlight API
 * or fallback to a manual approach.
 */

const HIGHLIGHT_NAME = "bao-search-highlight";

// Check if CSS Custom Highlight API is supported
const supportsHighlightAPI =
  typeof CSS !== "undefined" &&
  "highlights" in CSS &&
  typeof (CSS as any).highlights?.set === "function";

/**
 * Clear all search highlights from the editor.
 */
export function clearSearchHighlights(): void {
  if (supportsHighlightAPI) {
    (CSS as any).highlights.delete(HIGHLIGHT_NAME);
  } else {
    // Fallback: remove highlight marks
    document.querySelectorAll("mark.editor-search-mark").forEach((el) => {
      const parent = el.parentNode;
      if (parent) {
        parent.replaceChild(document.createTextNode(el.textContent || ""), el);
        parent.normalize();
      }
    });
  }
}

/**
 * Apply search highlighting to the given element for the specified query.
 */
export function applySearchHighlights(
  container: HTMLElement,
  query: string
): void {
  clearSearchHighlights();

  const q = query.trim().toLowerCase();
  if (!q) {
    return;
  }

  if (supportsHighlightAPI) {
    applyHighlightAPI(container, q);
  } else {
    // Fallback not implemented for contentEditable to avoid cursor issues
    // The search panel already shows results with highlights
  }
}

function applyHighlightAPI(container: HTMLElement, query: string): void {
  const ranges: Range[] = [];
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);

  let node: Text | null;
  while ((node = walker.nextNode() as Text | null)) {
    const text = node.textContent?.toLowerCase() || "";
    let idx = 0;
    while ((idx = text.indexOf(query, idx)) !== -1) {
      const range = document.createRange();
      range.setStart(node, idx);
      range.setEnd(node, idx + query.length);
      ranges.push(range);
      idx += query.length;
    }
  }

  if (ranges.length > 0) {
    const Highlight = (window as any).Highlight;
    if (Highlight) {
      const highlight = new Highlight(...ranges);
      (CSS as any).highlights.set(HIGHLIGHT_NAME, highlight);
    }
  }
}
