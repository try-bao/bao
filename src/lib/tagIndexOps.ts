import { getApi } from "./api";
import * as core from "./tagIndexCore";

export async function loadTagIndex(): Promise<core.TagIndex> {
  return getApi().getTagIndex();
}

export async function persistTagIndex(index: core.TagIndex): Promise<void> {
  await getApi().setTagIndex(index);
}

export async function syncTagIndexRename(
  fromRel: string,
  toRel: string
): Promise<void> {
  const idx = await loadTagIndex();
  const next = core.renamePathInIndex(idx, fromRel, toRel);
  await persistTagIndex(next);
}

export async function syncTagIndexRemove(
  relPath: string,
  isDirectory: boolean
): Promise<void> {
  const idx = await loadTagIndex();
  const next = core.removePathFromIndex(idx, relPath, isDirectory);
  await persistTagIndex(next);
}
