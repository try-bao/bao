/** On-disk shape: `{ [tag: string]: vaultRelativePath[] }` */

export type TagIndex = Record<string, string[]>;

function normRel(p: string): string {
  return p.replace(/\\/g, "/");
}

export function tagsForFile(index: TagIndex, relPath: string): string[] {
  const r = normRel(relPath);
  const out: string[] = [];
  for (const [tag, files] of Object.entries(index)) {
    if (files.some((f) => normRel(f) === r)) {
      out.push(tag);
    }
  }
  return out.sort((a, b) => a.localeCompare(b));
}

export function setTagsForFile(
  index: TagIndex,
  relPath: string,
  tags: string[]
): TagIndex {
  const r = normRel(relPath);
  const normalized = [
    ...new Set(
      tags.map((t) => t.trim().toLowerCase()).filter((t) => t.length > 0)
    ),
  ];
  const next: TagIndex = {};
  for (const [tag, files] of Object.entries(index)) {
    const filtered = files.filter((f) => normRel(f) !== r);
    if (filtered.length) {
      next[tag] = [...filtered];
    }
  }
  for (const t of normalized) {
    if (!next[t]) {
      next[t] = [];
    }
    if (!next[t].includes(r)) {
      next[t].push(r);
    }
  }
  return next;
}

export function renamePathInIndex(
  index: TagIndex,
  fromRel: string,
  toRel: string
): TagIndex {
  const fromNorm = normRel(fromRel);
  const toNorm = normRel(toRel);
  const fromPrefix = fromNorm.endsWith("/") ? fromNorm : `${fromNorm}/`;
  const next: TagIndex = {};
  for (const [tag, files] of Object.entries(index)) {
    const mapped = files.map((fp) => {
      const p = normRel(fp);
      if (p === fromNorm) {
        return toNorm;
      }
      if (p.startsWith(fromPrefix)) {
        return toNorm + p.slice(fromNorm.length);
      }
      return p;
    });
    const dedup = [...new Set(mapped)];
    if (dedup.length) {
      next[tag] = dedup;
    }
  }
  return next;
}

export function removePathFromIndex(
  index: TagIndex,
  relPath: string,
  isDirectory: boolean
): TagIndex {
  const rel = normRel(relPath);
  const prefix = isDirectory ? (rel.endsWith("/") ? rel : `${rel}/`) : "";
  const next: TagIndex = {};
  for (const [tag, files] of Object.entries(index)) {
    const filtered = files.filter((f) => {
      const fp = normRel(f);
      if (isDirectory) {
        return fp !== rel && !fp.startsWith(prefix);
      }
      return fp !== rel;
    });
    if (filtered.length) {
      next[tag] = filtered;
    }
  }
  return next;
}
