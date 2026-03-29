import { useEffect } from "react";
import { getApi } from "../lib/api";
import { tryEditorTabIndent } from "../lib/mdEditorIndent";
import { tryTableCellTab } from "../lib/mdTableEdit";
import { useAppStore } from "../store/useAppStore";
import * as note from "../lib/noteUtils";

function getMdLive(): HTMLElement | null {
  return document.querySelector(".md-live");
}

function editorFocusInside(ae: Element | null): boolean {
  const root = document.getElementById("editor-root");
  return Boolean(root && ae && root.contains(ae));
}

function wrapSelectionInline(tagName: string) {
  const mdLive = getMdLive();
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount || !mdLive) {
    return;
  }
  const range = sel.getRangeAt(0);
  if (!mdLive.contains(range.commonAncestorContainer)) {
    return;
  }
  const doc = mdLive.ownerDocument || document;
  const el = doc.createElement(tagName);
  if (range.collapsed) {
    el.appendChild(doc.createTextNode(""));
    range.insertNode(el);
    range.selectNodeContents(el);
    range.collapse(false);
  } else {
    const contents = range.extractContents();
    el.appendChild(contents);
    range.insertNode(el);
    range.selectNodeContents(el);
    range.collapse(false);
  }
  sel.removeAllRanges();
  sel.addRange(range);
}

function insertOrWrapLink() {
  const mdLive = getMdLive();
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount || !mdLive) {
    return;
  }
  const range = sel.getRangeAt(0);
  if (!mdLive.contains(range.commonAncestorContainer)) {
    return;
  }
  const selectedText = range.toString();
  const url = window.prompt("Link URL", "https://");
  if (url === null) {
    return;
  }
  const href = url.trim() || "#";
  const doc = mdLive.ownerDocument || document;
  const a = doc.createElement("a");
  a.href = href;
  a.rel = "noopener noreferrer";
  if (range.collapsed) {
    a.textContent = selectedText || "link";
  } else {
    const contents = range.extractContents();
    a.appendChild(contents);
  }
  range.insertNode(a);
  range.selectNodeContents(a);
  range.collapse(false);
  sel.removeAllRanges();
  sel.addRange(range);
}

function insertPlainAtCaret(text: string) {
  if (
    typeof document.queryCommandSupported === "function" &&
    document.queryCommandSupported("insertText")
  ) {
    document.execCommand("insertText", false, text);
    return;
  }
  const mdLive = getMdLive();
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount || !mdLive) {
    return;
  }
  const range = sel.getRangeAt(0);
  range.deleteContents();
  range.insertNode(document.createTextNode(text));
  range.collapse(false);
  sel.removeAllRanges();
  sel.addRange(range);
}

function isTextEditingFocus(): boolean {
  const ae = document.activeElement;
  if (!ae) {
    return false;
  }
  const modalInput = document.getElementById("modal-input-react");
  if (
    editorFocusInside(ae) ||
    ae === modalInput ||
    ae.getAttribute("aria-label") === "Chat message"
  ) {
    return true;
  }
  const tag = ae.tagName;
  if (tag === "TEXTAREA") {
    return true;
  }
  if (tag === "INPUT") {
    const type = (ae as HTMLInputElement).type?.toLowerCase() ?? "";
    if (
      type === "checkbox" ||
      type === "radio" ||
      type === "button" ||
      type === "submit"
    ) {
      return false;
    }
    return true;
  }
  return Boolean((ae as HTMLElement).isContentEditable);
}

function tryEditorMarkdownShortcuts(e: KeyboardEvent): boolean {
  const mdLive = getMdLive();
  if (!mdLive || !editorFocusInside(document.activeElement)) {
    return false;
  }
  const mod = e.metaKey || e.ctrlKey;
  if (!mod) {
    return false;
  }

  const onInput = () => useAppStore.getState().onEditorInput();

  if (!e.shiftKey && !e.altKey && (e.key === "b" || e.key === "B")) {
    e.preventDefault();
    document.execCommand("bold");
    queueMicrotask(onInput);
    return true;
  }

  if (!e.shiftKey && !e.altKey && (e.key === "i" || e.key === "I")) {
    e.preventDefault();
    document.execCommand("italic");
    queueMicrotask(onInput);
    return true;
  }

  if (!e.shiftKey && !e.altKey && e.code === "Backquote") {
    e.preventDefault();
    wrapSelectionInline("code");
    queueMicrotask(onInput);
    return true;
  }

  if (!e.shiftKey && !e.altKey && (e.key === "k" || e.key === "K")) {
    e.preventDefault();
    document.dispatchEvent(new CustomEvent("bao:open-link-dialog"));
    return true;
  }

  if (e.shiftKey && !e.altKey && (e.key === "x" || e.key === "X")) {
    e.preventDefault();
    document.execCommand("strikeThrough");
    queueMicrotask(onInput);
    return true;
  }

  if (e.shiftKey && !e.altKey && e.key === "7") {
    e.preventDefault();
    document.execCommand("insertOrderedList");
    queueMicrotask(onInput);
    return true;
  }

  if (e.shiftKey && !e.altKey && e.key === "8") {
    e.preventDefault();
    document.execCommand("insertUnorderedList");
    queueMicrotask(onInput);
    return true;
  }

  if (e.shiftKey && !e.altKey && e.key === "9") {
    e.preventDefault();
    document.execCommand("formatBlock", false, "blockquote");
    queueMicrotask(onInput);
    return true;
  }

  if (e.shiftKey && !e.altKey && (e.key === "-" || e.key === "_")) {
    e.preventDefault();
    document.execCommand("insertHorizontalRule");
    queueMicrotask(onInput);
    return true;
  }

  if (e.altKey && !e.shiftKey) {
    const map: Record<string, string> = {
      Digit1: "h1",
      Digit2: "h2",
      Digit3: "h3",
      Digit4: "h4",
      Digit5: "h5",
      Digit6: "h6",
    };
    const tag = map[e.code];
    if (tag) {
      e.preventDefault();
      document.execCommand("formatBlock", false, tag);
      queueMicrotask(onInput);
      return true;
    }

    if (e.code === "KeyM") {
      e.preventDefault();
      document.dispatchEvent(new CustomEvent("bao:open-note-dialog"));
      return true;
    }
  }

  if (e.shiftKey && !e.altKey && (e.key === "l" || e.key === "L")) {
    e.preventDefault();
    insertPlainAtCaret("- [ ] ");
    queueMicrotask(onInput);
    return true;
  }

  return false;
}

export function useGlobalShortcuts() {
  useEffect(() => {
    const api = getApi();
    const unsubShortcuts =
      typeof api.onShowKeyboardShortcuts === "function"
        ? api.onShowKeyboardShortcuts(() => {
            useAppStore.getState().openShortcuts();
          })
        : () => {};
    const unsubCloseTab =
      typeof api.onCloseTab === "function"
        ? api.onCloseTab(() => {
            const id = useAppStore.getState().activeTabId;
            if (id) {
              useAppStore.getState().closeTab(id);
            }
          })
        : () => {};

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Tab") {
        const mdLive = getMdLive();
        if (mdLive && editorFocusInside(document.activeElement)) {
          // First try table cell navigation
          if (tryTableCellTab(e, mdLive)) {
            return;
          }
          // Then try list indent/outdent
          if (tryEditorTabIndent(e, mdLive, () => {
            useAppStore.getState().onEditorInput();
          })) {
            return;
          }
        }
      }

      if (tryEditorMarkdownShortcuts(e)) {
        return;
      }

      const st = useAppStore.getState();
      const modalOpen = st.modal.open;

      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && (e.key === "t" || e.key === "T")) {
        if (modalOpen) {
          return;
        }
        e.preventDefault();
        st.openNewTabModal();
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key === ",") {
        if (modalOpen) {
          return;
        }
        e.preventDefault();
        if (st.shortcutsOpen) {
          st.closeShortcuts();
          return;
        }
        if (st.settingsOpen) {
          st.closeSettings();
        } else {
          st.openSettings();
        }
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key === "c" && !e.shiftKey) {
        if (
          !isTextEditingFocus() &&
          st.selection &&
          !st.selection.isDirectory &&
          st.selection.relPath.toLowerCase().endsWith(".md")
        ) {
          st.setClipboardNote(st.selection.relPath);
          e.preventDefault();
          return;
        }
      }

      if ((e.metaKey || e.ctrlKey) && e.key === "v" && !e.shiftKey) {
        if (!isTextEditingFocus() && st.clipboardNoteRelPath) {
          e.preventDefault();
          void st.duplicateFromClipboard();
          return;
        }
      }

      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        void st.save();
        return;
      }

      if ((e.metaKey || e.ctrlKey) && (e.key === "b" || e.key === "B")) {
        e.preventDefault();
        st.toggleSidebar();
        return;
      }

      if (
        (e.metaKey || e.ctrlKey) &&
        e.shiftKey &&
        (e.key === "c" || e.key === "C")
      ) {
        e.preventDefault();
        st.toggleChat();
        return;
      }

      if (e.key === "F2" && st.selection) {
        const ae = document.activeElement;
        if (
          editorFocusInside(ae) ||
          ae?.getAttribute("aria-label") === "Chat message"
        ) {
          return;
        }
        e.preventDefault();
        const leaf = st.selection.relPath.split("/").pop() || "";
        st.openRenameModal({
          relPath: st.selection.relPath,
          isDirectory: st.selection.isDirectory,
          name: leaf,
        });
        return;
      }

      if (e.key === "Escape") {
        if (st.contextMenu) {
          e.preventDefault();
          st.hideContextMenu();
          return;
        }
        if (modalOpen) {
          e.preventDefault();
          st.closeModal();
          return;
        }
        if (st.shortcutsOpen) {
          e.preventDefault();
          st.closeShortcuts();
          return;
        }
        if (st.settingsOpen) {
          e.preventDefault();
          st.closeSettings();
          return;
        }
        if (st.chatOpen) {
          e.preventDefault();
          st.setChatOpen(false);
        }
      }
    };

    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      useAppStore.getState().flushActiveBuffer();
      const tabs = useAppStore.getState().tabs;
      if (tabs.some((t) => note.isTabDirty(t))) {
        e.preventDefault();
        e.returnValue = "";
      }
    };

    document.addEventListener("keydown", onKey);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("beforeunload", onBeforeUnload);
      unsubShortcuts();
      unsubCloseTab();
    };
  }, []);
}
