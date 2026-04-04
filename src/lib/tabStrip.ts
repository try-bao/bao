import * as note from "./noteUtils";
import type { EditorTab } from "../types";

/** Minimal tab row for the tab strip (avoids re-rendering when unrelated buffer bytes change). */
export type TabStripRow = {
  id: string;
  relPath: string | null;
  dirty: boolean;
  title: string;
};

export function tabStripTitle(t: EditorTab, isActive: boolean): string {
  if (!t.relPath) {
    return note.editorDisplayTitle(null, t.buffer);
  }
  if (note.isScratchPath(t.relPath)) {
    return note.editorDisplayTitle(t.relPath, t.buffer);
  }
  if (!t.relPath.toLowerCase().endsWith(".md")) {
    return t.relPath.split("/").pop() ?? t.relPath;
  }
  if (isActive) {
    return note.editorDisplayTitle(t.relPath, t.buffer);
  }
  return t.relPath.split("/").pop()?.replace(/\.md$/i, "") ?? t.relPath;
}

export function selectTabStripRows(s: {
  tabs: EditorTab[];
  activeTabId: string | null;
}): TabStripRow[] {
  const aid = s.activeTabId;
  return s.tabs.map((t) => ({
    id: t.id,
    relPath: t.relPath,
    dirty: note.isTabDirty(t),
    title: tabStripTitle(t, t.id === aid),
  }));
}

export function tabStripRowsEqual(a: TabStripRow[], b: TabStripRow[]): boolean {
  if (a === b) {
    return true;
  }
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i += 1) {
    if (a[i].id !== b[i].id) {
      return false;
    }
    if (a[i].relPath !== b[i].relPath) {
      return false;
    }
    if (a[i].dirty !== b[i].dirty) {
      return false;
    }
    if (a[i].title !== b[i].title) {
      return false;
    }
  }
  return true;
}
