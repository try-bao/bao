import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getApi } from "../lib/api";
import { useAppStore } from "../store/useAppStore";
import { formatErr } from "../lib/formatErr";

function revealMenuLabel(platform: string): string {
  if (platform === "darwin") {
    return "Reveal in Finder";
  }
  if (platform === "win32") {
    return "Show in File Explorer";
  }
  return "Open in file manager";
}

export function ContextMenu() {
  const contextMenu = useAppStore((s) => s.contextMenu);
  const hideContextMenu = useAppStore((s) => s.hideContextMenu);
  const openModalFile = useAppStore((s) => s.openModalFile);
  const openModalFolder = useAppStore((s) => s.openModalFolder);
  const openRenameModal = useAppStore((s) => s.openRenameModal);
  const deleteContextItem = useAppStore((s) => s.deleteContextItem);
  const deleteMultiSelection = useAppStore((s) => s.deleteMultiSelection);
  const multiSelection = useAppStore((s) => s.multiSelection);
  const duplicateNoteAtPath = useAppStore((s) => s.duplicateNoteAtPath);
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: 0, top: 0 });

  useLayoutEffect(() => {
    if (!contextMenu || !ref.current) {
      return;
    }
    const pad = 8;
    const rect = ref.current.getBoundingClientRect();
    let left = Math.min(
      contextMenu.x,
      window.innerWidth - rect.width - pad
    );
    let top = Math.min(
      contextMenu.y,
      window.innerHeight - rect.height - pad
    );
    left = Math.max(pad, left);
    top = Math.max(pad, top);
    setPos({ left, top });
  }, [contextMenu]);

  /* Defer attach so the opening pointer event does not immediately dismiss the menu. */
  useEffect(() => {
    if (!contextMenu) {
      return;
    }
    const onDocPointerDown = (e: PointerEvent) => {
      const menu = document.getElementById("context-menu");
      if (menu && e.target instanceof Node && menu.contains(e.target)) {
        return;
      }
      hideContextMenu();
    };
    const timer = window.setTimeout(() => {
      document.addEventListener("pointerdown", onDocPointerDown, true);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("pointerdown", onDocPointerDown, true);
    };
  }, [contextMenu, hideContextMenu]);

  if (!contextMenu) {
    return null;
  }

  const { parentRel, renameTarget } = contextMenu;

  const showDup =
    Boolean(renameTarget) &&
    !renameTarget!.isDirectory &&
    renameTarget!.relPath.toLowerCase().endsWith(".md");

  const showExportPdf = showDup;

  const platform = getApi().platform;

  const menu = (
    <div
      ref={ref}
      id="context-menu"
      className="context-menu"
      role="menu"
      aria-hidden="false"
      style={{
        left: pos.left || contextMenu.x,
        top: pos.top || contextMenu.y,
        position: "fixed",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className="context-menu-item"
        role="menuitem"
        onClick={(e) => {
          e.stopPropagation();
          hideContextMenu();
          openModalFile(parentRel);
        }}
      >
        New document
      </button>
      <button
        type="button"
        className="context-menu-item"
        role="menuitem"
        onClick={(e) => {
          e.stopPropagation();
          hideContextMenu();
          openModalFolder(parentRel);
        }}
      >
        New folder
      </button>
      <button
        type="button"
        className="context-menu-item"
        role="menuitem"
        onClick={(e) => {
          e.stopPropagation();
          hideContextMenu();
          const api = getApi();
          const rel = renameTarget?.relPath ?? null;
          void api.revealInFileManager(rel).catch((err) => {
            console.error(err);
            window.alert(formatErr("Could not reveal in file manager.", err));
          });
        }}
      >
        {revealMenuLabel(platform)}
      </button>
      <button
        type="button"
        className={`context-menu-item context-menu-item-duplicate${showDup ? "" : " hidden"}`}
        role="menuitem"
        onClick={(e) => {
          e.stopPropagation();
          hideContextMenu();
          if (showDup) {
            void duplicateNoteAtPath(renameTarget!.relPath);
          }
        }}
      >
        Duplicate
      </button>
      <button
        type="button"
        className={`context-menu-item${showExportPdf ? "" : " hidden"}`}
        role="menuitem"
        onClick={(e) => {
          e.stopPropagation();
          hideContextMenu();
          if (showExportPdf) {
            const relPath = renameTarget!.relPath;
            const fileName = relPath.split("/").pop() || "export";
            void (async () => {
              try {
                const api = getApi();
                const md = await api.readFile(relPath);
                const html =
                  typeof window.parseMarkdownToHtml === "function"
                    ? window.parseMarkdownToHtml(md)
                    : `<pre>${md}</pre>`;
                await api.exportPdf(html, fileName);
              } catch (err) {
                console.error(err);
                window.alert(formatErr("Failed to export PDF.", err));
              }
            })();
          }
        }}
      >
        Export as PDF
      </button>
      <button
        type="button"
        className={`context-menu-item context-menu-item-rename${renameTarget ? "" : " hidden"}`}
        role="menuitem"
        onClick={(e) => {
          e.stopPropagation();
          hideContextMenu();
          if (renameTarget) {
            openRenameModal(renameTarget);
          }
        }}
      >
        Rename
      </button>
      <button
        type="button"
        className={`context-menu-item context-menu-item-delete${renameTarget || multiSelection.length > 1 ? "" : " hidden"}`}
        role="menuitem"
        onClick={(e) => {
          e.stopPropagation();
          hideContextMenu();
          if (multiSelection.length > 1) {
            void deleteMultiSelection();
          } else if (renameTarget) {
            void deleteContextItem(renameTarget);
          }
        }}
      >
        {multiSelection.length > 1
          ? `Delete ${multiSelection.length} items…`
          : "Delete…"}
      </button>
    </div>
  );

  return createPortal(menu, document.body);
}
