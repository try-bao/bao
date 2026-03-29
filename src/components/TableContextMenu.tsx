import { createPortal } from "react-dom";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useAppStore } from "../store/useAppStore";
import {
  addColumnLeft,
  addColumnRight,
  addRowAbove,
  addRowBelow,
  deleteColumn,
  deleteRow,
  getTableCellContext,
  type TableCellContext,
} from "../lib/mdTableEdit";
import { normalizeVaultImagesInPlace } from "../lib/vaultImageUrls";

const SAVE_DEBOUNCE_MS = 120;

function maxColumnCount(table: HTMLTableElement): number {
  let m = 0;
  for (const row of table.querySelectorAll("tr")) {
    m = Math.max(m, row.children.length);
  }
  return Math.max(m, 1);
}

type MenuState = { x: number; y: number; ctx: TableCellContext } | null;

export function TableContextMenu({ live }: { live: HTMLElement | null }) {
  const [menu, setMenu] = useState<MenuState>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: 0, top: 0 });

  const scheduleSave = () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      useAppStore.getState().onEditorInput();
    }, SAVE_DEBOUNCE_MS);
  };

  const afterEdit = (el: HTMLElement | null) => {
    if (el && typeof window.runLiveMarkdownTransforms === "function") {
      window.runLiveMarkdownTransforms(el);
    }
    const state = useAppStore.getState();
    const tab = state.tabs.find((t) => t.id === state.activeTabId);
    if (el && tab?.relPath) {
      normalizeVaultImagesInPlace(el, tab.relPath);
    }
    scheduleSave();
  };

  useEffect(() => {
    if (!live) {
      return;
    }
    const onContextMenu = (e: MouseEvent) => {
      const ctx = getTableCellContext(e.target);
      if (!ctx || !live.contains(ctx.table)) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      setMenu({ x: e.clientX, y: e.clientY, ctx });
    };
    live.addEventListener("contextmenu", onContextMenu);
    return () => live.removeEventListener("contextmenu", onContextMenu);
  }, [live]);

  useLayoutEffect(() => {
    if (!menu || !menuRef.current) {
      return;
    }
    const pad = 8;
    const rect = menuRef.current.getBoundingClientRect();
    let left = Math.min(menu.x, window.innerWidth - rect.width - pad);
    let top = Math.min(menu.y, window.innerHeight - rect.height - pad);
    left = Math.max(pad, left);
    top = Math.max(pad, top);
    setPos({ left, top });
  }, [menu]);

  useEffect(() => {
    if (!menu) {
      return;
    }
    const onDocPointerDown = (e: PointerEvent) => {
      const node = menuRef.current;
      if (node && e.target instanceof Node && node.contains(e.target)) {
        return;
      }
      setMenu(null);
    };
    const timer = window.setTimeout(() => {
      document.addEventListener("pointerdown", onDocPointerDown, true);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("pointerdown", onDocPointerDown, true);
    };
  }, [menu]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  if (!menu) {
    return null;
  }

  const { ctx } = menu;
  const { table, rowEl, colIndex } = ctx;
  const cols = maxColumnCount(table);
  const canDeleteColumn = cols > 1;

  const run = (fn: () => void) => {
    fn();
    afterEdit(live);
    setMenu(null);
  };

  const portal = (
    <div
      ref={menuRef}
      id="table-context-menu"
      className="context-menu"
      role="menu"
      aria-hidden="false"
      style={{
        left: pos.left || menu.x,
        top: pos.top || menu.y,
        position: "fixed",
        zIndex: 450,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className="context-menu-item"
        role="menuitem"
        onClick={() => run(() => addRowAbove(table, rowEl))}
      >
        Add row above
      </button>
      <button
        type="button"
        className="context-menu-item"
        role="menuitem"
        onClick={() => run(() => addRowBelow(table, rowEl))}
      >
        Add row below
      </button>
      <button
        type="button"
        className="context-menu-item"
        role="menuitem"
        onClick={() => run(() => addColumnLeft(table, colIndex))}
      >
        Add column left
      </button>
      <button
        type="button"
        className="context-menu-item"
        role="menuitem"
        onClick={() => run(() => addColumnRight(table, colIndex))}
      >
        Add column right
      </button>
      <button
        type="button"
        className="context-menu-item context-menu-item-delete"
        role="menuitem"
        onClick={() => run(() => deleteRow(rowEl))}
      >
        Delete row
      </button>
      <button
        type="button"
        className="context-menu-item context-menu-item-delete"
        role="menuitem"
        disabled={!canDeleteColumn}
        style={{ opacity: canDeleteColumn ? 1 : 0.45, cursor: canDeleteColumn ? "pointer" : "not-allowed" }}
        onClick={() => {
          if (!canDeleteColumn) {
            return;
          }
          run(() => deleteColumn(table, colIndex));
        }}
      >
        Delete column
      </button>
    </div>
  );

  return createPortal(portal, document.body);
}
