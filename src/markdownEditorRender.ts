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

/**
 * Replace `root`'s contents with sanitised HTML (for `.html` / `.htm` files).
 * Scripts and event-handler attributes are stripped to prevent code execution.
 * Inline `<style>` blocks are preserved so the page looks as intended.
 */
export function applyHtmlToEditorRoot(
  root: HTMLElement,
  html: string,
  noteRelPath: string | null
): void {
  const raw = html ?? "";
  if (raw === "") {
    root.innerHTML = "<p><br></p>";
    return;
  }
  // Parse into an inert document so scripts never execute.
  const doc = new DOMParser().parseFromString(raw, "text/html");
  // Remove dangerous elements (keep <style> for presentation).
  for (const tag of ["script", "iframe", "object", "embed"]) {
    doc.querySelectorAll(tag).forEach((el) => el.remove());
  }
  // Strip event-handler attributes (onclick, onerror, etc.).
  for (const el of doc.body.querySelectorAll("*")) {
    for (const attr of [...el.attributes]) {
      if (attr.name.startsWith("on")) {
        el.removeAttribute(attr.name);
      }
    }
  }
  // Collect <style> from <head> so styles still apply inside the editor root.
  let headStyles = "";
  for (const s of doc.head.querySelectorAll("style")) {
    headStyles += s.outerHTML;
  }
  root.innerHTML = headStyles + doc.body.innerHTML;
  normalizeVaultImagesInPlace(root, noteRelPath);
}
