import { getApi } from "./api";

export async function syncFileIconRename(
  fromRel: string,
  toRel: string
): Promise<void> {
  const icons = await getApi().getFileIcons();
  const emoji = icons[fromRel];
  if (emoji) {
    delete icons[fromRel];
    icons[toRel] = emoji;
    await getApi().setFileIcons(icons);
    window.dispatchEvent(new CustomEvent("bao-file-icons-changed"));
  }
}

export async function syncFileIconRemove(
  relPath: string,
  isDirectory: boolean
): Promise<void> {
  const icons = await getApi().getFileIcons();
  let changed = false;
  if (isDirectory) {
    const prefix = relPath.endsWith("/") ? relPath : relPath + "/";
    for (const key of Object.keys(icons)) {
      if (key === relPath || key.startsWith(prefix)) {
        delete icons[key];
        changed = true;
      }
    }
  } else if (icons[relPath]) {
    delete icons[relPath];
    changed = true;
  }
  if (changed) {
    await getApi().setFileIcons(icons);
    window.dispatchEvent(new CustomEvent("bao-file-icons-changed"));
  }
}
