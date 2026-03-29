import { vaultUrlFromRelPath } from "../lib/vaultImageUrls";

export function ImageTabViewer({ relPath }: { relPath: string }) {
  const src = vaultUrlFromRelPath(relPath);
  const name = relPath.split("/").pop() ?? relPath;

  return (
    <div
      className="editor-image-view"
      role="img"
      aria-label={name}
    >
      <img
        className="editor-image-view__img"
        src={src}
        alt=""
        draggable={false}
      />
    </div>
  );
}
