/**
 * Click an image to select it; drag the bottom-right handle to resize (keeps aspect ratio).
 * Double-click is ignored (no open, no default browser action on the image).
 * Sizes persist as data-md-w / data-md-h → markdown `![alt](src){WxH}` via htmlToMarkdown.
 */

const MIN_W = 48;
const MAX_W = 4096;

function placeHandle(img: HTMLImageElement, handle: HTMLElement) {
  const r = img.getBoundingClientRect();
  const size = 12;
  handle.style.left = `${r.right - size}px`;
  handle.style.top = `${r.bottom - size}px`;
}

export function installMdImageResize(
  container: HTMLElement,
  onResizeEnd: () => void
): () => void {
  let selected: HTMLImageElement | null = null;
  let handle: HTMLDivElement | null = null;
  let dragging = false;
  let startX = 0;
  let startY = 0;
  let startW = 0;
  let startH = 0;
  let ratio = 1;

  const scrollParent = () => document.querySelector(".editor-body");

  function clearSelection() {
    if (selected) {
      selected.classList.remove("md-img-selected");
      selected = null;
    }
    if (handle) {
      handle.remove();
      handle = null;
    }
  }

  function syncHandle() {
    if (selected && handle) {
      placeHandle(selected, handle);
    }
  }

  function applySize(img: HTMLImageElement, w: number, h: number) {
    const rw = Math.round(w);
    const rh = Math.round(h);
    img.style.width = `${rw}px`;
    img.style.height = `${rh}px`;
    img.setAttribute("data-md-w", String(rw));
    img.setAttribute("data-md-h", String(rh));
  }

  function onPointerMove(e: PointerEvent) {
    if (!dragging || !selected) {
      return;
    }
    e.preventDefault();
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    const diag = (dx + dy) / 2;
    let newW = startW + diag;
    newW = Math.max(MIN_W, Math.min(MAX_W, newW));
    const newH = newW / ratio;
    applySize(selected, newW, newH);
    syncHandle();
  }

  function endDrag() {
    if (!dragging) {
      return;
    }
    dragging = false;
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", endDrag);
    window.removeEventListener("pointercancel", endDrag);
    try {
      onResizeEnd();
    } catch {
      /* ignore */
    }
  }

  function onPointerDownHandle(e: PointerEvent) {
    if (!selected) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    dragging = true;
    startX = e.clientX;
    startY = e.clientY;
    const rect = selected.getBoundingClientRect();
    startW = rect.width;
    startH = rect.height;
    ratio = startW > 0 && startH > 0 ? startW / startH : 1;
    window.addEventListener("pointermove", onPointerMove, { passive: false });
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);
  }

  function selectImg(img: HTMLImageElement) {
    clearSelection();
    selected = img;
    img.classList.add("md-img-selected");
    handle = document.createElement("div");
    handle.className = "md-img-resize-handle";
    handle.title = "Drag to resize";
    handle.setAttribute("aria-hidden", "true");
    document.body.appendChild(handle);
    placeHandle(img, handle);
    handle.addEventListener("pointerdown", onPointerDownHandle);
  }

  const onContainerClick = (e: MouseEvent) => {
    const t = e.target;
    if (t instanceof HTMLImageElement && container.contains(t)) {
      e.stopPropagation();
      selectImg(t);
    }
  };

  const onDocumentPointerDown = (e: PointerEvent) => {
    if (dragging) {
      return;
    }
    const t = e.target as Node;
    if (handle && (t === handle || handle.contains(t))) {
      return;
    }
    if (t instanceof HTMLImageElement && container.contains(t)) {
      return;
    }
    if (container.contains(t) && !(t instanceof HTMLImageElement)) {
      clearSelection();
    }
  };

  const onDocClick = (e: MouseEvent) => {
    const t = e.target as Node;
    if (!container.contains(t) && (!handle || !handle.contains(t))) {
      if (t !== selected && !(selected && selected.contains(t))) {
        clearSelection();
      }
    }
  };

  const onScroll = () => {
    if (!dragging) {
      syncHandle();
    }
  };

  const onDragStart = (e: DragEvent) => {
    if (e.target instanceof HTMLImageElement && container.contains(e.target)) {
      e.preventDefault();
    }
  };

  /** Suppress double-click (no open, no native image handling in the editor). */
  const onImgDblClick = (e: MouseEvent) => {
    if (e.target instanceof HTMLImageElement && container.contains(e.target)) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  container.addEventListener("dblclick", onImgDblClick, true);
  container.addEventListener("dragstart", onDragStart, true);
  container.addEventListener("click", onContainerClick, true);
  document.addEventListener("pointerdown", onDocumentPointerDown, true);
  document.addEventListener("click", onDocClick, true);
  window.addEventListener("resize", syncHandle);
  scrollParent()?.addEventListener("scroll", onScroll, { passive: true });

  return () => {
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", endDrag);
    window.removeEventListener("pointercancel", endDrag);
    clearSelection();
    container.removeEventListener("dblclick", onImgDblClick, true);
    container.removeEventListener("dragstart", onDragStart, true);
    container.removeEventListener("click", onContainerClick, true);
    document.removeEventListener("pointerdown", onDocumentPointerDown, true);
    document.removeEventListener("click", onDocClick, true);
    window.removeEventListener("resize", syncHandle);
    scrollParent()?.removeEventListener("scroll", onScroll);
  };
}
