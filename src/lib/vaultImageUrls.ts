/** Resolve markdown image paths against the open note and build vault:// URLs for Electron. */

function parentDir(relPath: string): string {
  const i = relPath.lastIndexOf("/");
  return i === -1 ? "" : relPath.slice(0, i);
}

function normalizeParts(parts: string[]): string[] {
  const out: string[] = [];
  for (const p of parts) {
    if (p === "..") {
      if (out.length) out.pop();
    } else if (p !== "." && p !== "") {
      out.push(p);
    }
  }
  return out;
}

function joinVaultPath(baseDir: string, fragment: string): string {
  const base = baseDir ? baseDir.split("/").filter(Boolean) : [];
  const frag = fragment.split("/");
  return normalizeParts([...base, ...frag]).join("/");
}

/**
 * Convert img src in markdown to a vault-relative path (posix, no leading slash).
 */
export function resolveImageToVaultRel(
  noteRelPath: string | null,
  src: string
): string | null {
  const s = src.trim();
  if (/^https?:\/\//i.test(s) || /^data:image\//i.test(s)) {
    return null;
  }
  if (s.startsWith("vault://")) {
    return null;
  }
  const noteDir = noteRelPath ? parentDir(noteRelPath) : "";
  let rel: string;
  if (s.startsWith("/")) {
    rel = s.slice(1).replace(/\\/g, "/");
  } else if (s.startsWith("./")) {
    rel = joinVaultPath(noteDir, s.slice(2));
  } else if (s.startsWith("../")) {
    rel = joinVaultPath(noteDir, s);
  } else {
    rel = joinVaultPath(noteDir, s);
  }
  return rel;
}

/**
 * Use vault://localhost/… so the path always lives in `pathname`.
 * `vault:///notes/a.png` often normalizes to `vault://notes/a.png`, which wrongly
 * parses host "notes" and path "/a.png" — breaking image loads.
 */
export function vaultUrlFromRelPath(relPath: string): string {
  const norm = relPath.replace(/\\/g, "/").replace(/^\/+/, "");
  const encoded = norm
    .split("/")
    .map((seg) => encodeURIComponent(seg))
    .join("/");
  return `vault://localhost/${encoded}`;
}

export function vaultUrlToRelPath(vaultUrl: string): string {
  const u = new URL(vaultUrl);
  let pathname = u.pathname;
  if (pathname.startsWith("//")) {
    pathname = pathname.slice(1);
  }
  if (pathname.startsWith("/")) {
    pathname = pathname.slice(1);
  }
  const decodedPath = pathname
    .split("/")
    .map((seg) => decodeURIComponent(seg))
    .join("/");

  if (u.hostname && u.hostname !== "localhost") {
    return decodedPath ? `${u.hostname}/${decodedPath}` : u.hostname;
  }
  return decodedPath;
}

/** Shortest relative path from the note file to the image for markdown storage. */
export function vaultRelToMarkdownPath(
  noteRelPath: string | null,
  imageVaultRel: string
): string {
  if (!noteRelPath) {
    return imageVaultRel;
  }
  const fromDir = parentDir(noteRelPath);
  const fromParts = fromDir ? fromDir.split("/").filter(Boolean) : [];
  const toParts = imageVaultRel.split("/").filter(Boolean);
  let i = 0;
  while (
    i < fromParts.length &&
    i < toParts.length &&
    fromParts[i] === toParts[i]
  ) {
    i += 1;
  }
  const up = fromParts.length - i;
  const down = toParts.slice(i);
  const ups = Array(up).fill("..");
  const parts = [...ups, ...down];
  if (parts.length === 0) {
    return ".";
  }
  if (parts[0] === "..") {
    return parts.join("/");
  }
  return `./${parts.join("/")}`;
}

export function parseMarkdownToHtmlWithImages(
  md: string,
  noteRelPath: string | null
): string {
  if (typeof window.parseMarkdownToHtml !== "function") {
    return "";
  }
  const html = window.parseMarkdownToHtml(md);
  return rewriteImgSrcInHtmlString(html, noteRelPath);
}

function rewriteImgSrcInHtmlString(
  html: string,
  noteRelPath: string | null
): string {
  const doc = new DOMParser().parseFromString(
    `<div class="md-img-wrap">${html}</div>`,
    "text/html"
  );
  const root = doc.body.firstElementChild;
  if (!root) {
    return html;
  }
  normalizeVaultImagesInPlace(root as HTMLElement, noteRelPath);
  return root.innerHTML;
}

export function normalizeVaultImagesInPlace(
  root: HTMLElement,
  noteRelPath: string | null
): void {
  root.querySelectorAll("img").forEach((img) => {
    const src = img.getAttribute("src");
    if (!src || src.startsWith("vault://")) {
      return;
    }
    if (/^https?:\/\//i.test(src) || /^data:image\//i.test(src)) {
      return;
    }
    const rel = resolveImageToVaultRel(noteRelPath, src);
    if (rel) {
      img.setAttribute("src", vaultUrlFromRelPath(rel));
      img.setAttribute("loading", "lazy");
    }
  });
}

export function getMarkdownPreservingImgPaths(
  mdLive: HTMLElement,
  noteRelPath: string | null
): string {
  if (typeof window.htmlToMarkdown !== "function") {
    return "";
  }
  const imgs = [...mdLive.querySelectorAll("img")];
  const backup: { el: HTMLImageElement; src: string }[] = [];
  for (const img of imgs) {
    const src = img.getAttribute("src");
    if (src?.startsWith("vault://")) {
      backup.push({ el: img, src });
      const vaultRel = vaultUrlToRelPath(src);
      img.setAttribute("src", vaultRelToMarkdownPath(noteRelPath, vaultRel));
    }
  }
  try {
    return window.htmlToMarkdown(mdLive);
  } finally {
    for (const { el, src } of backup) {
      el.setAttribute("src", src);
    }
  }
}
