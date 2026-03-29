/**
 * Single place for “markdown string → DOM shown in the note editor”.
 * Depends on `window.parseMarkdownToHtml` / `window.runLiveMarkdownTransforms` from
 * `public/markdown-parse.js` and `public/live-md.js` (loaded before the React tree).
 */

import {
  normalizeVaultImagesInPlace,
  parseMarkdownToHtmlWithImages,
} from "./lib/vaultImageUrls";
import {
  highlightAllFencedCodeIn,
  resetCodeHighlightTracking,
} from "./codeHighlight";

/**
 * Replace `root`'s contents with the rendered note: parsed markdown, vault image URLs,
 * live-md transforms, and fenced-code syntax highlighting.
 *
 * The real editor mounts `root` under `document`; if `root` is detached, some live-md
 * steps (e.g. fenced-code chrome) no-op because they skip disconnected nodes.
 */
export function applyMarkdownToEditorRoot(
  root: HTMLElement,
  markdown: string,
  noteRelPath: string | null
): void {
  const raw = markdown ?? "";
  if (raw === "") {
    root.innerHTML = "<p><br></p>";
    resetCodeHighlightTracking();
    return;
  }
  root.innerHTML = parseMarkdownToHtmlWithImages(raw, noteRelPath);
  normalizeVaultImagesInPlace(root, noteRelPath);
  if (typeof window.runLiveMarkdownTransforms === "function") {
    window.runLiveMarkdownTransforms(root);
  }
  resetCodeHighlightTracking();
  highlightAllFencedCodeIn(root);
}
