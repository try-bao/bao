import hljs from "highlight.js";
import "highlight.js/styles/github.css";

let lastCodeEl: HTMLElement | null = null;

function isPreCode(el: HTMLElement | null): el is HTMLElement {
  return Boolean(el && el.matches("pre code"));
}

/**
 * Apply syntax highlighting to a fenced code block. Plain text if no language class.
 */
export function highlightCodeElement(code: HTMLElement): void {
  if (!code.closest("pre")) {
    return;
  }
  const langMatch = code.className?.match(/language-(\w+)/);
  const lang = langMatch?.[1] ?? "";
  if (!lang) {
    // Auto-detect language for blocks without an explicit language
    try {
      const text = code.textContent || "";
      if (text.trim().length > 10) {
        const res = hljs.highlightAuto(text);
        if (res.language && res.relevance > 4) {
          code.innerHTML = res.value;
          code.classList.add("hljs");
          code.dataset.highlighted = "1";
          return;
        }
      }
    } catch {
      // fall through
    }
    code.classList.remove("hljs");
    delete code.dataset.highlighted;
    return;
  }
  try {
    if (hljs.getLanguage(lang)) {
      hljs.highlightElement(code);
    } else {
      const res = hljs.highlightAuto(code.textContent || "");
      code.innerHTML = res.value;
      code.classList.add("hljs");
    }
    code.dataset.highlighted = "1";
  } catch {
    code.classList.remove("hljs");
    delete code.dataset.highlighted;
  }
}

export function stripHighlightForEdit(code: HTMLElement): void {
  if (code.dataset.highlighted !== "1") {
    return;
  }
  const t = code.textContent ?? "";
  code.textContent = t;
  code.classList.remove("hljs");
  delete code.dataset.highlighted;
}

export function highlightAllFencedCodeIn(root: HTMLElement): void {
  root.querySelectorAll("pre.md-fenced-pre code").forEach((node) => {
    const code = node as HTMLElement;
    let n: Node | null = document.getSelection()?.anchorNode ?? null;
    if (n && n.nodeType === 3) {
      n = n.parentElement;
    }
    const active = n && (n as Element).closest?.("pre code");
    if (active === code) {
      return;
    }
    highlightCodeElement(code);
  });
}

export function handleSelectionChangeForCodeHighlight(root: HTMLElement): void {
  const sel = document.getSelection();
  if (!sel?.rangeCount || !sel.anchorNode || !root.contains(sel.anchorNode)) {
    return;
  }
  const anchor = sel.anchorNode;
  if (!anchor) {
    return;
  }
  let n: Node = anchor;
  if (n.nodeType === 3) {
    const p = n.parentElement;
    if (!p) {
      return;
    }
    n = p;
  }
  const code = (n as Element).closest?.("pre code") as HTMLElement | null;
  if (code === lastCodeEl) {
    return;
  }
  if (lastCodeEl && root.contains(lastCodeEl)) {
    highlightCodeElement(lastCodeEl);
  }
  if (code && root.contains(code)) {
    stripHighlightForEdit(code);
  }
  lastCodeEl = code && root.contains(code) ? code : null;
}

export function resetCodeHighlightTracking(): void {
  lastCodeEl = null;
}

export function registerHighlightGlobally(): void {
  window.baoHighlightCodeElement = (el: HTMLElement) => {
    highlightCodeElement(el);
  };
}
