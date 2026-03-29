// @vitest-environment jsdom

import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { applyMarkdownToEditorRoot } from "../markdownEditorRender";
import { installMarkdownEditorGlobals } from "./loadMarkdownParse";

/** Editor root must be in the document: live-md skips transforms on disconnected nodes. */
function createAttachedRoot(): HTMLDivElement {
  const root = document.createElement("div");
  document.body.appendChild(root);
  return root;
}

describe("applyMarkdownToEditorRoot", () => {
  beforeAll(() => {
    installMarkdownEditorGlobals(globalThis as Window & typeof globalThis);
  });

  afterEach(() => {
    document.body.replaceChildren();
  });

  it("renders an empty note as a single empty paragraph", () => {
    const root = createAttachedRoot();
    applyMarkdownToEditorRoot(root, "", null);
    expect(root.innerHTML).toBe("<p><br></p>");
  });

  it("renders headings and paragraphs from markdown", () => {
    const root = createAttachedRoot();
    applyMarkdownToEditorRoot(root, "# Title\n\nHello.", null);
    const h1 = root.querySelector("h1");
    const p = root.querySelector("p");
    expect(h1?.textContent).toBe("Title");
    expect(p?.textContent).toBe("Hello.");
  });

  it("produces a fenced code block with language class", () => {
    const root = createAttachedRoot();
    applyMarkdownToEditorRoot(
      root,
      "```ts\nconst n: number = 1;\n```\n",
      null
    );
    /* live-md maps `ts` → `typescript` for the class name */
    const code = root.querySelector(
      "pre.md-fenced-pre code.language-typescript"
    );
    expect(code).toBeTruthy();
    expect(code?.textContent).toContain("const n");
  });

  it("rewrites relative image paths to vault:// URLs for the open note", () => {
    const root = createAttachedRoot();
    applyMarkdownToEditorRoot(root, "![](img/photo.png)", "folder/note.md");
    const img = root.querySelector("img");
    expect(img?.getAttribute("src")).toBe(
      "vault://localhost/folder/img/photo.png"
    );
  });

  it("leaves http(s) image URLs unchanged", () => {
    const root = createAttachedRoot();
    applyMarkdownToEditorRoot(
      root,
      "![](https://example.com/a.png)",
      "folder/note.md"
    );
    expect(root.querySelector("img")?.getAttribute("src")).toBe(
      "https://example.com/a.png"
    );
  });
});
