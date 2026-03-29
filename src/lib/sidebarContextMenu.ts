import { useAppStore } from "../store/useAppStore";
import * as note from "./noteUtils";

/** Right-click anywhere in the vault sidebar (tree or chrome) to open the custom menu. */
export function openSidebarContextMenuFromEvent(e: React.MouseEvent): void {
  e.preventDefault();
  e.stopPropagation();
  let parent = "";
  const row = (e.target as HTMLElement).closest(".tree-row");
  const rel = row?.getAttribute("data-rel-path");
  if (row && rel != null) {
    const isDir = row.getAttribute("data-is-directory") === "true";
    parent = isDir ? rel : note.parentRel(rel);
    // If right-clicking on a node that's already in the multi-selection, keep it
    const st = useAppStore.getState();
    const inMulti = st.multiSelection.some(
      (s) => s.relPath === rel && s.isDirectory === isDir
    );
    if (!inMulti) {
      st.setSelection(
        { relPath: rel, isDirectory: isDir },
        parent
      );
    }
  } else {
    parent = "";
    useAppStore.getState().setSelection(null, "");
  }
  let renameTarget: {
    relPath: string;
    isDirectory: boolean;
    name: string;
  } | null = null;
  if (row && rel != null) {
    renameTarget = {
      relPath: rel,
      isDirectory: row.getAttribute("data-is-directory") === "true",
      name:
        row.getAttribute("data-node-name") || rel.split("/").pop() || "",
    };
  }
  useAppStore.getState().hideContextMenu();
  useAppStore.getState().showContextMenu({
    x: e.clientX,
    y: e.clientY,
    parentRel: parent,
    renameTarget,
  });
}
