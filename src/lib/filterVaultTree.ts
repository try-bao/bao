import type { BaoTreeNode } from "../types";
import * as note from "./noteUtils";

/**
 * Keep folders that match the query or contain a matching descendant; keep files whose
 * display name or path matches (case-insensitive substring).
 */
export function filterTreeByQuery(
  nodes: BaoTreeNode[],
  query: string
): BaoTreeNode[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    return nodes;
  }

  function matchesFile(n: BaoTreeNode): boolean {
    const display = note.basenameNoMd(n.relPath).toLowerCase();
    return (
      display.includes(q) ||
      n.name.toLowerCase().includes(q) ||
      n.relPath.toLowerCase().includes(q)
    );
  }

  function walk(n: BaoTreeNode): BaoTreeNode | null {
    if (n.isDirectory) {
      const children = n.children?.map(walk).filter(Boolean) as BaoTreeNode[];
      if (children?.length) {
        return { ...n, children };
      }
      if (n.name.toLowerCase().includes(q)) {
        return { ...n, children: n.children };
      }
      return null;
    }
    return matchesFile(n) ? n : null;
  }

  return nodes.map(walk).filter(Boolean) as BaoTreeNode[];
}
