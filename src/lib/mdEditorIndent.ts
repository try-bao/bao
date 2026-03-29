/** Tab / Shift+Tab only inside list items: indent / outdent nested lists. No tab character elsewhere. */

function findContainingLi(node: Node | null): HTMLLIElement | null {
  let n: Node | null = node;
  while (n) {
    if (n.nodeType === 1 && (n as HTMLElement).tagName === "LI") {
      return n as HTMLLIElement;
    }
    n = n.parentNode;
  }
  return null;
}

function copyListClasses(from: Element, to: HTMLElement): void {
  if (from.classList.contains("md-task-list")) {
    to.classList.add("md-task-list");
  }
}

function indentListItem(li: HTMLLIElement): boolean {
  const prev = li.previousElementSibling;
  if (!prev || prev.tagName !== "LI") {
    return false;
  }
  const parentList = li.parentElement;
  if (
    !parentList ||
    (parentList.tagName !== "UL" && parentList.tagName !== "OL")
  ) {
    return false;
  }
  const listTag = parentList.tagName;
  let nested: HTMLElement | null = null;
  const last = prev.lastElementChild;
  if (last && (last.tagName === "UL" || last.tagName === "OL")) {
    nested = last as HTMLElement;
  }
  if (!nested) {
    nested = document.createElement(listTag);
    copyListClasses(parentList, nested);
    prev.appendChild(nested);
  }
  nested.appendChild(li);
  return true;
}

function outdentListItem(li: HTMLLIElement): boolean {
  const parentList = li.parentElement;
  if (
    !parentList ||
    (parentList.tagName !== "UL" && parentList.tagName !== "OL")
  ) {
    return false;
  }
  const outerLi = parentList.parentElement;
  if (!outerLi || outerLi.tagName !== "LI") {
    return false;
  }
  const outerList = outerLi.parentElement;
  if (
    !outerList ||
    (outerList.tagName !== "UL" && outerList.tagName !== "OL")
  ) {
    return false;
  }
  outerList.insertBefore(li, outerLi.nextSibling);
  if (parentList.childNodes.length === 0) {
    parentList.remove();
  }
  return true;
}

function placeCaretAtStartOfText(el: HTMLElement): void {
  const sel = window.getSelection();
  if (!sel) {
    return;
  }
  const r = document.createRange();
  // For task list items, skip past the checkbox input
  const firstText = findFirstTextNode(el);
  if (firstText) {
    r.setStart(firstText, 0);
    r.collapse(true);
  } else {
    r.selectNodeContents(el);
    r.collapse(true);
  }
  sel.removeAllRanges();
  sel.addRange(r);
}

function findFirstTextNode(el: Node): Text | null {
  for (const child of el.childNodes) {
    // Skip checkbox inputs in task lists
    if (child.nodeType === 1 && (child as HTMLElement).tagName === "INPUT") {
      continue;
    }
    if (child.nodeType === 3 && child.textContent?.trim()) {
      return child as Text;
    }
    if (child.nodeType === 1) {
      const nested = findFirstTextNode(child);
      if (nested) return nested;
    }
  }
  return null;
}

/**
 * @returns true if the event was handled (caller should preventDefault).
 */
export function tryEditorTabIndent(
  e: KeyboardEvent,
  mdLive: HTMLElement,
  afterDomChange: () => void
): boolean {
  if (e.key !== "Tab") {
    return false;
  }
  if (e.metaKey || e.ctrlKey || e.altKey) {
    return false;
  }
  const sel = window.getSelection();
  if (!sel?.rangeCount || !mdLive.contains(sel.anchorNode)) {
    return false;
  }

  const li = findContainingLi(sel.anchorNode);
  if (!li || !mdLive.contains(li)) {
    return false;
  }

  const ok = e.shiftKey ? outdentListItem(li) : indentListItem(li);
  if (!ok) {
    return false;
  }

  e.preventDefault();
  placeCaretAtStartOfText(li);
  if (typeof window.runLiveMarkdownTransforms === "function") {
    window.runLiveMarkdownTransforms(mdLive);
  }
  queueMicrotask(afterDomChange);
  return true;
}
