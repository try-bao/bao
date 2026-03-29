/** Contenteditable table row/column helpers (simple grids; no colspan). */

export type TableCellContext = {
  table: HTMLTableElement;
  cell: HTMLTableCellElement;
  rowEl: HTMLTableRowElement;
  rowIndex: number;
  colIndex: number;
};

export function getTableCellContext(
  target: EventTarget | Node | null
): TableCellContext | null {
  let el: Element | null = null;
  if (target instanceof Element) {
    el = target;
  } else if (target instanceof Node) {
    // Handle text nodes - get parent element
    el = target.parentElement;
  }
  const cell = el?.closest?.("th, td");
  if (!cell || !(cell instanceof HTMLTableCellElement)) {
    return null;
  }
  const row = cell.closest("tr");
  const table = cell.closest("table");
  if (!row || !table || !(table instanceof HTMLTableElement)) {
    return null;
  }
  const rowParent = row.parentElement;
  if (!rowParent) {
    return null;
  }
  const rowsInSection =
    rowParent instanceof HTMLTableSectionElement
      ? Array.from(rowParent.rows)
      : Array.from(rowParent.querySelectorAll(":scope > tr"));
  const rowIndex = rowsInSection.indexOf(row as HTMLTableRowElement);
  const colIndex = Array.from(row.children).indexOf(cell);
  if (rowIndex < 0 || colIndex < 0) {
    return null;
  }
  return {
    table,
    cell,
    rowEl: row as HTMLTableRowElement,
    rowIndex,
    colIndex,
  };
}

function maxColumnCount(table: HTMLTableElement): number {
  let m = 0;
  for (const row of table.querySelectorAll("tr")) {
    m = Math.max(m, row.children.length);
  }
  return Math.max(m, 1);
}

function ensureCellContent(el: HTMLTableCellElement): void {
  if (!el.textContent?.trim()) {
    el.textContent = "\u00a0";
  }
}

function makeDataRow(n: number): HTMLTableRowElement {
  const tr = document.createElement("tr");
  for (let i = 0; i < n; i += 1) {
    const td = document.createElement("td");
    td.textContent = "\u00a0";
    tr.appendChild(td);
  }
  return tr;
}

/** Insert a data row above/below the given row (tbody; creates tbody if needed). */
export function addRowBelow(table: HTMLTableElement, rowEl: HTMLTableRowElement): void {
  const n = maxColumnCount(table);
  let tbody = table.querySelector("tbody");
  if (!tbody) {
    tbody = document.createElement("tbody");
    table.appendChild(tbody);
  }
  const tr = makeDataRow(n);
  if (rowEl.parentElement === tbody) {
    rowEl.insertAdjacentElement("afterend", tr);
  } else {
    tbody.appendChild(tr);
  }
}

export function addRowAbove(table: HTMLTableElement, rowEl: HTMLTableRowElement): void {
  const n = maxColumnCount(table);
  let tbody = table.querySelector("tbody");
  if (!tbody) {
    tbody = document.createElement("tbody");
    table.appendChild(tbody);
  }
  const tr = makeDataRow(n);
  if (rowEl.parentElement === tbody) {
    rowEl.insertAdjacentElement("beforebegin", tr);
  } else {
    tbody.insertBefore(tr, tbody.firstChild);
  }
}

/** Insert a column to the right of `afterColIndex` (0-based). */
export function addColumnRight(
  table: HTMLTableElement,
  afterColIndex: number
): void {
  const rows = table.querySelectorAll("tr");
  for (const row of rows) {
    const isHeader = row.parentElement?.tagName === "THEAD";
    const tag = isHeader ? "th" : "td";
    const c = document.createElement(tag);
    c.textContent = "\u00a0";
    const cells = row.children;
    if (afterColIndex >= 0 && afterColIndex < cells.length) {
      cells[afterColIndex].insertAdjacentElement("afterend", c);
    } else {
      row.appendChild(c);
    }
    ensureCellContent(c as HTMLTableCellElement);
  }
}

/** Insert a column to the left of `beforeColIndex` (0-based). */
export function addColumnLeft(
  table: HTMLTableElement,
  beforeColIndex: number
): void {
  if (beforeColIndex <= 0) {
    const rows = table.querySelectorAll("tr");
    for (const row of rows) {
      const isHeader = row.parentElement?.tagName === "THEAD";
      const tag = isHeader ? "th" : "td";
      const c = document.createElement(tag);
      c.textContent = "\u00a0";
      row.insertBefore(c, row.firstChild);
      ensureCellContent(c as HTMLTableCellElement);
    }
    return;
  }
  addColumnRight(table, beforeColIndex - 1);
}

export function deleteRow(rowEl: HTMLTableRowElement): void {
  rowEl.remove();
}

/** Remove nth cell from every row (0-based). */
export function deleteColumn(table: HTMLTableElement, colIndex: number): void {
  for (const row of table.querySelectorAll("tr")) {
    const cell = row.children[colIndex];
    if (cell) {
      cell.remove();
    }
  }
}

/** Get all rows in the table (thead + tbody combined). */
function getAllTableRows(table: HTMLTableElement): HTMLTableRowElement[] {
  return Array.from(table.querySelectorAll("tr"));
}

/** Place caret at the start of a cell and select its contents. */
function focusCell(cell: HTMLTableCellElement): void {
  const sel = window.getSelection();
  if (!sel) return;
  const r = document.createRange();
  r.selectNodeContents(cell);
  sel.removeAllRanges();
  sel.addRange(r);
}

/**
 * Navigate to the next or previous cell in the table.
 * @returns the target cell if navigation occurred, null otherwise.
 */
export function navigateTableCell(
  ctx: TableCellContext,
  direction: "next" | "prev"
): HTMLTableCellElement | null {
  const allRows = getAllTableRows(ctx.table);
  const globalRowIndex = allRows.indexOf(ctx.rowEl);
  if (globalRowIndex < 0) return null;

  let targetRow = globalRowIndex;
  let targetCol = ctx.colIndex;

  if (direction === "next") {
    const maxCol = ctx.rowEl.children.length - 1;
    if (targetCol < maxCol) {
      targetCol += 1;
    } else {
      // Move to first cell of next row
      targetRow += 1;
      targetCol = 0;
    }
  } else {
    // direction === "prev"
    if (targetCol > 0) {
      targetCol -= 1;
    } else {
      // Move to last cell of previous row
      targetRow -= 1;
      if (targetRow >= 0) {
        targetCol = allRows[targetRow].children.length - 1;
      }
    }
  }

  // Check bounds
  if (targetRow < 0 || targetRow >= allRows.length) {
    return null;
  }
  const row = allRows[targetRow];
  const cell = row.children[targetCol] as HTMLTableCellElement | undefined;
  if (!cell) return null;

  focusCell(cell);
  return cell;
}

/**
 * Handle Tab/Shift+Tab inside a table cell.
 * @returns true if handled (caller should preventDefault).
 */
export function tryTableCellTab(
  e: KeyboardEvent,
  mdLive: HTMLElement
): boolean {
  if (e.key !== "Tab") return false;
  if (e.metaKey || e.ctrlKey || e.altKey) return false;

  const sel = window.getSelection();
  if (!sel || !mdLive.contains(sel.anchorNode)) return false;

  // Check if cursor is inside a table cell
  const ctx = getTableCellContext(sel.anchorNode);
  if (!ctx || !mdLive.contains(ctx.table)) return false;

  const direction = e.shiftKey ? "prev" : "next";
  const targetCell = navigateTableCell(ctx, direction);
  if (targetCell) {
    e.preventDefault();
    return true;
  }
  return false;
}
