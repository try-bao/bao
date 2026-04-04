import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { openSidebarContextMenuFromEvent } from "../lib/sidebarContextMenu";
import { filterTreeByQuery } from "../lib/filterVaultTree";
import { useAppStore } from "../store/useAppStore";
import * as note from "../lib/noteUtils";
import { loadTagIndex } from "../lib/tagIndexOps";
import type { BaoTreeNode } from "../types";

const TREE_ICON_FOLDER = `<svg class="tree-svg" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`;

const TREE_ICON_FILE = `<svg class="tree-svg" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`;

function TreeRow({
  node,
  depth,
  expanded,
  selection,
  multiSelection,
  dropTargetRel,
  onRowClick,
  onRowDblClick,
  onToggleClick,
  onDragStart,
}: {
  node: BaoTreeNode;
  depth: number;
  expanded: Record<string, boolean>;
  selection: { relPath: string; isDirectory: boolean } | null;
  multiSelection: { relPath: string; isDirectory: boolean }[];
  dropTargetRel: string | null;
  onRowClick: (node: BaoTreeNode, e: React.MouseEvent) => void;
  onRowDblClick: (node: BaoTreeNode, e: React.MouseEvent) => void;
  onToggleClick: (node: BaoTreeNode, e: React.MouseEvent) => void;
  onDragStart: (node: BaoTreeNode, e: React.DragEvent) => void;
}) {
  const isSelected =
    (selection &&
      selection.relPath === node.relPath &&
      selection.isDirectory === node.isDirectory) ||
    multiSelection.some(
      (s) => s.relPath === node.relPath && s.isDirectory === node.isDirectory
    );
  const isDrop = dropTargetRel === node.relPath;

  return (
    <div className="tree-node">
      <div
        className={`tree-row${node.isDirectory ? " is-folder" : ""}${isSelected ? " is-selected" : ""}${isDrop ? " is-drop-target" : ""}`}
        draggable
        {...{
          "data-rel-path": node.relPath,
          "data-is-directory": node.isDirectory ? "true" : "false",
          "data-node-name": node.name,
        }}
        style={{ paddingLeft: `${depth * 0.35}rem` }}
        onClick={(e) => onRowClick(node, e)}
        onDoubleClick={(e) => onRowDblClick(node, e)}
        onDragStart={(e) => onDragStart(node, e)}
      >
        <button
          type="button"
          className={`tree-toggle${!node.isDirectory ? " is-leaf" : ""}`}
          aria-hidden={!node.isDirectory ? "true" : undefined}
          aria-expanded={
            node.isDirectory
              ? expanded[node.relPath]
                ? "true"
                : "false"
              : undefined
          }
          onClick={(e) => node.isDirectory && onToggleClick(node, e)}
        >
          {node.isDirectory ? (expanded[node.relPath] ? "▾" : "▸") : null}
        </button>
        <span
          className="tree-icon"
          dangerouslySetInnerHTML={{
            __html: node.isDirectory ? TREE_ICON_FOLDER : TREE_ICON_FILE,
          }}
        />
        <span className="tree-label">
          {node.name}
        </span>
      </div>
      {node.isDirectory &&
        node.children &&
        expanded[node.relPath] && (
          <div className="tree-children">
            {node.children.map((ch) => (
              <TreeRow
                key={ch.relPath}
                node={ch}
                depth={depth + 1}
                expanded={expanded}
                selection={selection}
                multiSelection={multiSelection}
                dropTargetRel={dropTargetRel}
                onRowClick={onRowClick}
                onRowDblClick={onRowDblClick}
                onToggleClick={onToggleClick}
                onDragStart={onDragStart}
              />
            ))}
          </div>
        )}
    </div>
  );
}

export function FileTree({
  vaultSearchQuery = "",
  tagFilter = "",
}: {
  vaultSearchQuery?: string;
  tagFilter?: string | string[];
}) {
  const treeNodes = useAppStore((s) => s.treeNodes);
  const [tagIndex, setTagIndex] = useState<Record<string, string[]>>({});
  const tagIndexRevision = useAppStore((s) => s.tagIndexRevision);

  useEffect(() => {
    loadTagIndex().then(setTagIndex);
  }, [tagIndexRevision]);

  const displayNodes = useMemo(() => {
    let nodes = filterTreeByQuery(treeNodes, vaultSearchQuery);

    // Filter by tag(s) if specified
    const tags = Array.isArray(tagFilter)
      ? tagFilter.map((t) => t.trim().toLowerCase()).filter(Boolean)
      : tagFilter.trim().toLowerCase() ? [tagFilter.trim().toLowerCase()] : [];
    if (tags.length > 0) {
      const taggedFiles = new Set<string>();
      for (const [t, files] of Object.entries(tagIndex)) {
        if (tags.some((tag) => t.toLowerCase().includes(tag))) {
          for (const f of files) {
            taggedFiles.add(f);
          }
        }
      }

      function filterByTag(n: BaoTreeNode): BaoTreeNode | null {
        if (n.isDirectory) {
          const children = n.children
            ?.map(filterByTag)
            .filter(Boolean) as BaoTreeNode[];
          if (children?.length) {
            return { ...n, children };
          }
          return null;
        }
        return taggedFiles.has(n.relPath) ? n : null;
      }

      nodes = nodes.map(filterByTag).filter(Boolean) as BaoTreeNode[];
    }

    return nodes;
  }, [treeNodes, vaultSearchQuery, tagFilter, tagIndex]);
  const treeError = useAppStore((s) => s.treeError);
  const expanded = useAppStore((s) => s.expanded);
  const selection = useAppStore((s) => s.selection);
  const multiSelection = useAppStore((s) => s.multiSelection);
  const setMultiSelection = useAppStore((s) => s.setMultiSelection);
  const toggleExpanded = useAppStore((s) => s.toggleExpanded);
  const setSelection = useAppStore((s) => s.setSelection);
  const tryOpenFile = useAppStore((s) => s.tryOpenFile);
  const refreshTree = useAppStore((s) => s.refreshTree);
  const openRenameModal = useAppStore((s) => s.openRenameModal);
  const handleTreeDrop = useAppStore((s) => s.handleTreeDrop);
  const deleteMultiSelection = useAppStore((s) => s.deleteMultiSelection);

  const [dropTargetRel, setDropTargetRel] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const lastClickedRef = useRef<{ relPath: string; isDirectory: boolean } | null>(null);

  const clearDrop = useCallback(() => setDropTargetRel(null), []);

  /** Flatten the visible tree (respecting expanded folders) into display order */
  const flatVisibleNodes = useMemo(() => {
    const out: BaoTreeNode[] = [];
    function walk(nodes: BaoTreeNode[]) {
      for (const n of nodes) {
        out.push(n);
        if (n.isDirectory && n.children && expanded[n.relPath]) {
          walk(n.children);
        }
      }
    }
    walk(displayNodes);
    return out;
  }, [displayNodes, expanded]);

  useEffect(() => {
    document.addEventListener("dragend", clearDrop);
    return () => document.removeEventListener("dragend", clearDrop);
  }, [clearDrop]);

  // Cmd+A to select all visible files; Backspace to delete selection
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Only act when the sidebar / file tree is focused
      if (!wrapRef.current?.contains(document.activeElement) &&
          document.activeElement !== wrapRef.current) {
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "a") {
        e.preventDefault();
        const all = flatVisibleNodes.map((n) => ({
          relPath: n.relPath,
          isDirectory: n.isDirectory,
        }));
        setMultiSelection(all);
        return;
      }
      if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();
        void deleteMultiSelection();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [flatVisibleNodes, setMultiSelection, deleteMultiSelection]);

  const onDragStart = useCallback((node: BaoTreeNode, e: React.DragEvent) => {
    // If the dragged node is part of the multi-selection, move all selected items.
    // Otherwise, move only the dragged node.
    const inMulti = multiSelection.some(
      (s) => s.relPath === node.relPath && s.isDirectory === node.isDirectory
    );
    const items = inMulti
      ? multiSelection.map((s) => ({ fromRel: s.relPath, isDirectory: s.isDirectory }))
      : [{ fromRel: node.relPath, isDirectory: node.isDirectory }];
    e.dataTransfer.setData(
      "application/x-bao-node",
      JSON.stringify({ items })
    );
    e.dataTransfer.effectAllowed = "move";
  }, [multiSelection]);

  const onRowClick = useCallback(
    async (node: BaoTreeNode, e: React.MouseEvent) => {
      e.stopPropagation();
      if (e.detail === 2) {
        return;
      }

      // Shift+click: range selection from last-clicked to this node
      if (e.shiftKey && lastClickedRef.current) {
        const anchor = lastClickedRef.current;
        const anchorIdx = flatVisibleNodes.findIndex(
          (n) =>
            n.relPath === anchor.relPath &&
            n.isDirectory === anchor.isDirectory
        );
        const targetIdx = flatVisibleNodes.findIndex(
          (n) =>
            n.relPath === node.relPath &&
            n.isDirectory === node.isDirectory
        );
        if (anchorIdx !== -1 && targetIdx !== -1) {
          const lo = Math.min(anchorIdx, targetIdx);
          const hi = Math.max(anchorIdx, targetIdx);
          const range = flatVisibleNodes.slice(lo, hi + 1).map((n) => ({
            relPath: n.relPath,
            isDirectory: n.isDirectory,
          }));
          setMultiSelection(range);
          return;
        }
      }

      // Normal click – single selection
      lastClickedRef.current = {
        relPath: node.relPath,
        isDirectory: node.isDirectory,
      };
      setSelection(
        { relPath: node.relPath, isDirectory: node.isDirectory },
        node.isDirectory ? node.relPath : note.parentRel(node.relPath)
      );

      if (node.isDirectory) {
        toggleExpanded(node.relPath);
        await refreshTree();
        return;
      }

      if (note.isOpenableInEditor(node.relPath)) {
        await tryOpenFile(node.relPath);
      } else {
        window.alert("Only Markdown notes and images can be opened here.");
      }
      await refreshTree();
    },
    [flatVisibleNodes, refreshTree, setMultiSelection, setSelection, toggleExpanded, tryOpenFile]
  );

  const onToggleClick = useCallback(
    async (node: BaoTreeNode, e: React.MouseEvent) => {
      e.stopPropagation();
      toggleExpanded(node.relPath);
      setSelection(
        { relPath: node.relPath, isDirectory: true },
        node.relPath
      );
      await refreshTree();
    },
    [refreshTree, setSelection, toggleExpanded]
  );

  const onRowDblClick = useCallback(
    (node: BaoTreeNode, e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest(".tree-toggle")) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      openRenameModal({
        relPath: node.relPath,
        isDirectory: node.isDirectory,
        name: node.name,
      });
    },
    [openRenameModal]
  );

  const onDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer.types.includes("Files")) {
        e.dataTransfer.dropEffect = "copy";
      } else {
        e.dataTransfer.dropEffect = "move";
      }
      const row = (e.target as HTMLElement).closest(".tree-row");
      clearDrop();
      const dr = row?.getAttribute("data-rel-path");
      if (row && dr) {
        setDropTargetRel(dr);
      }
    },
    [clearDrop]
  );

  const onDragLeave = useCallback(
    (e: React.DragEvent) => {
      if (!wrapRef.current?.contains(e.relatedTarget as Node)) {
        clearDrop();
      }
    },
    [clearDrop]
  );

  const onDrop = useCallback(
    async (e: React.DragEvent) => {
      clearDrop();
      await handleTreeDrop(e);
    },
    [clearDrop, handleTreeDrop]
  );

  if (treeError) {
    return (
      <div className="sidebar-tree-wrap">
        <div className="tree" id="file-tree" role="tree">
          <p className="tree-error">{treeError}</p>
        </div>
      </div>
    );
  }

  if (!treeNodes.length) {
    return (
      <div
        ref={wrapRef}
        className="sidebar-tree-wrap"
        onContextMenu={openSidebarContextMenuFromEvent}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        <div className="tree" id="file-tree" role="tree">
          <p className="tree-empty">
            No files yet. Right-click here or use + on the tab bar to add a
            note.
          </p>
        </div>
      </div>
    );
  }

  if (!displayNodes.length && vaultSearchQuery.trim()) {
    return (
      <div
        ref={wrapRef}
        className="sidebar-tree-wrap"
        onContextMenu={openSidebarContextMenuFromEvent}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        <div className="tree" id="file-tree" role="tree">
          <p className="tree-empty">No files match your filter.</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={wrapRef}
      className="sidebar-tree-wrap"
      tabIndex={0}
      onContextMenu={openSidebarContextMenuFromEvent}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className="tree" id="file-tree" role="tree">
        {displayNodes.map((node) => (
          <TreeRow
            key={node.relPath}
            node={node}
            depth={0}
            expanded={expanded}
            selection={selection}
            multiSelection={multiSelection}
            dropTargetRel={dropTargetRel}
            onRowClick={onRowClick}
            onRowDblClick={onRowDblClick}
            onToggleClick={onToggleClick}
            onDragStart={onDragStart}
          />
        ))}
      </div>
    </div>
  );
}
