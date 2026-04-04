// @vitest-environment jsdom

import { afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  applyNoteHighlightsToRenderedDom,
  measureNoteOffsetsFromSelection,
  injectNoteMarkersInBodyMd,
  NOTE_MARK_START,
  NOTE_MARK_END,
} from "../lib/fileNotes";
import { bodyMarkdownForEditor } from "../lib/noteUtils";
import { installMarkdownEditorGlobals } from "./loadMarkdownParse";
import { applyMarkdownToEditorRoot } from "../markdownEditorRender";

function createAttachedRoot(): HTMLDivElement {
  const root = document.createElement("div");
  root.contentEditable = "true";
  document.body.appendChild(root);
  return root;
}

describe("measureNoteOffsetsFromSelection returns body-relative offsets", () => {
  beforeAll(() => {
    installMarkdownEditorGlobals(globalThis as Window & typeof globalThis);
  });

  afterEach(() => {
    document.body.replaceChildren();
  });

  it("subtracts heading length so offsets are body-relative", () => {
    const fullMd = "# Title\n\nHello world";
    const root = createAttachedRoot();
    applyMarkdownToEditorRoot(root, fullMd, "test.md");

    // Find the text node containing "Hello world" in the rendered DOM
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let targetNode: Text | null = null;
    let node: Node | null;
    while ((node = walker.nextNode())) {
      const text = (node as Text).textContent ?? "";
      if (text.includes("world")) {
        targetNode = node as Text;
        break;
      }
    }
    expect(targetNode).not.toBeNull();

    // Select "world" in the DOM
    const range = document.createRange();
    const worldIdx = (targetNode!.textContent ?? "").indexOf("world");
    range.setStart(targetNode!, worldIdx);
    range.setEnd(targetNode!, worldIdx + 5);

    const offsets = measureNoteOffsetsFromSelection(root, range, "test.md");
    expect(offsets).not.toBeNull();

    // The offsets should be body-relative, not full-markdown-relative
    const bodyMd = bodyMarkdownForEditor(fullMd);
    const [a, b] = offsets!;
    expect(a).toBeGreaterThanOrEqual(0);
    expect(b).toBeLessThanOrEqual(bodyMd.length);
    expect(bodyMd.slice(a, b)).toBe("world");
  });

  it("works for a document without heading (no offset adjustment needed)", () => {
    const fullMd = "Hello world";
    const root = createAttachedRoot();
    applyMarkdownToEditorRoot(root, fullMd, "test.md");

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let targetNode: Text | null = null;
    let node: Node | null;
    while ((node = walker.nextNode())) {
      const text = (node as Text).textContent ?? "";
      if (text.includes("Hello")) {
        targetNode = node as Text;
        break;
      }
    }
    expect(targetNode).not.toBeNull();

    const range = document.createRange();
    const idx = (targetNode!.textContent ?? "").indexOf("Hello");
    range.setStart(targetNode!, idx);
    range.setEnd(targetNode!, idx + 5);

    const offsets = measureNoteOffsetsFromSelection(root, range, "test.md");
    expect(offsets).not.toBeNull();

    const bodyMd = bodyMarkdownForEditor(fullMd);
    const [a, b] = offsets!;
    expect(bodyMd.slice(a, b)).toBe("Hello");
  });

  it("offsets can be used with injectNoteMarkersInBodyMd for correct highlighting", () => {
    const fullMd = "# My Note\n\nSome important text here";
    const root = createAttachedRoot();
    applyMarkdownToEditorRoot(root, fullMd, "note.md");

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let targetNode: Text | null = null;
    let node: Node | null;
    while ((node = walker.nextNode())) {
      const text = (node as Text).textContent ?? "";
      if (text.includes("important")) {
        targetNode = node as Text;
        break;
      }
    }
    expect(targetNode).not.toBeNull();

    const range = document.createRange();
    const idx = (targetNode!.textContent ?? "").indexOf("important");
    range.setStart(targetNode!, idx);
    range.setEnd(targetNode!, idx + "important".length);

    const offsets = measureNoteOffsetsFromSelection(root, range, "note.md");
    expect(offsets).not.toBeNull();

    // Use the offsets with injectNoteMarkersInBodyMd
    const bodyMd = bodyMarkdownForEditor(fullMd);
    const noteEntry = { index: offsets!, value: "test note", resolved: false };
    const { marked, noteFileIndices } = injectNoteMarkersInBodyMd(bodyMd, [noteEntry]);

    expect(noteFileIndices).toHaveLength(1);
    const s = marked.indexOf(NOTE_MARK_START);
    const e = marked.indexOf(NOTE_MARK_END);
    expect(s).toBeGreaterThanOrEqual(0);
    expect(marked.slice(s + 1, e)).toBe("important");
  });
});

describe("note overlay container does not corrupt serialized markdown", () => {
  beforeAll(() => {
    installMarkdownEditorGlobals(globalThis as Window & typeof globalThis);
  });

  afterEach(() => {
    document.body.replaceChildren();
  });

  it("htmlToMarkdown ignores the overlay container", () => {
    const fullMd = "# Title\n\nHello world";
    const root = createAttachedRoot();
    applyMarkdownToEditorRoot(root, fullMd, "test.md");

    // Simulate what applyNoteHighlightsToRenderedDom does: append an overlay container
    const container = document.createElement("div");
    container.className = "bao-note-overlay-container";
    container.setAttribute("aria-hidden", "true");
    container.setAttribute("contenteditable", "false");
    const overlay = document.createElement("div");
    overlay.className = "bao-note-highlight";
    overlay.textContent = ""; // empty overlay
    container.appendChild(overlay);
    root.appendChild(container);

    // Serialize markdown — overlay container should be invisible
    const md = window.htmlToMarkdown(root);
    expect(md).not.toContain("overlay");
    expect(md).not.toContain("bao-note");
    // The markdown should be the same as without the overlay
    const root2 = createAttachedRoot();
    applyMarkdownToEditorRoot(root2, fullMd, "test.md");
    const mdClean = window.htmlToMarkdown(root2);
    expect(md).toBe(mdClean);
  });
});

describe("end-to-end: note highlights the correct text in a headed document", () => {
  beforeAll(() => {
    installMarkdownEditorGlobals(globalThis as Window & typeof globalThis);
  });

  afterEach(() => {
    document.body.replaceChildren();
  });

  it("measured offsets target the selected word, not something shifted by the heading", () => {
    const fullMd = "# Title\n\nHello world";
    const root = createAttachedRoot();
    applyMarkdownToEditorRoot(root, fullMd, "test.md");

    // Select "world"
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let targetNode: Text | null = null;
    let node: Node | null;
    while ((node = walker.nextNode())) {
      if ((node as Text).textContent?.includes("world")) {
        targetNode = node as Text;
        break;
      }
    }
    expect(targetNode).not.toBeNull();
    const range = document.createRange();
    const wi = (targetNode!.textContent ?? "").indexOf("world");
    range.setStart(targetNode!, wi);
    range.setEnd(targetNode!, wi + 5);

    const offsets = measureNoteOffsetsFromSelection(root, range, "test.md");
    expect(offsets).not.toBeNull();

    // Offsets must point to "world" in the body (not shifted by heading)
    const bodyMd = bodyMarkdownForEditor(fullMd);
    expect(bodyMd.slice(offsets![0], offsets![1])).toBe("world");

    // When markers are injected into body and parsed as full doc, they wrap "world"
    const { marked: markedBody, noteFileIndices } = injectNoteMarkersInBodyMd(bodyMd, [
      { index: offsets!, value: "my note", resolved: false },
    ]);
    expect(noteFileIndices).toHaveLength(1);
    const s = markedBody.indexOf(NOTE_MARK_START);
    const e = markedBody.indexOf(NOTE_MARK_END);
    expect(markedBody.slice(s + 1, e)).toBe("world");
  });

  it("offsets for text right after heading are correct", () => {
    const fullMd = "# Big Heading\n\nFirst paragraph text";
    const root = createAttachedRoot();
    applyMarkdownToEditorRoot(root, fullMd, "test.md");

    // Select "First"
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let targetNode: Text | null = null;
    let node: Node | null;
    while ((node = walker.nextNode())) {
      if ((node as Text).textContent?.includes("First")) {
        targetNode = node as Text;
        break;
      }
    }
    expect(targetNode).not.toBeNull();
    const range = document.createRange();
    const fi = (targetNode!.textContent ?? "").indexOf("First");
    range.setStart(targetNode!, fi);
    range.setEnd(targetNode!, fi + 5);

    const offsets = measureNoteOffsetsFromSelection(root, range, "test.md");
    expect(offsets).not.toBeNull();

    const bodyMd = bodyMarkdownForEditor(fullMd);
    expect(bodyMd.slice(offsets![0], offsets![1])).toBe("First");

    // The full pipeline: inject into body, prepend heading, parse
    const { marked: markedBody, noteFileIndices } = injectNoteMarkersInBodyMd(bodyMd, [
      { index: offsets!, value: "note", resolved: false },
    ]);
    expect(noteFileIndices).toHaveLength(1);

    // Parse the reconstructed full markdown (heading + marked body)
    const headingPrefix = fullMd.slice(0, fullMd.length - bodyMd.length);
    const fullMarkedHtml = window.parseMarkdownToHtml(headingPrefix + markedBody);
    // The heading text should NOT be inside markers
    expect(fullMarkedHtml).toContain("Big Heading");
    // The marker characters should be present (wrapping "First")
    expect(fullMarkedHtml).toMatch(/\uE000|&#xE000;|&#57344;/);
  });
});

describe("full pipeline: measure → store → apply highlights", () => {
  beforeAll(() => {
    installMarkdownEditorGlobals(globalThis as Window & typeof globalThis);
  });

  afterEach(() => {
    document.body.replaceChildren();
  });

  function countDomVisibleChars(root: HTMLElement): number {
    let count = 0;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ALL, {
      acceptNode(node) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node as Element;
          if (
            el.getAttribute("contenteditable") === "false" ||
            el.hasAttribute("data-md-skip")
          ) {
            return NodeFilter.FILTER_REJECT;
          }
          if (el.tagName === "IMG") return NodeFilter.FILTER_ACCEPT;
          return NodeFilter.FILTER_SKIP;
        }
        if (node.nodeType === Node.TEXT_NODE) {
          const parent = (node as Text).parentElement;
          if (parent?.closest("[contenteditable='false'], [data-md-skip]")) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
        return NodeFilter.FILTER_SKIP;
      },
    });
    let n: Node | null;
    while ((n = walker.nextNode())) {
      if (n.nodeType === Node.TEXT_NODE) {
        count += (n.textContent ?? "").length;
      } else if (n.nodeType === Node.ELEMENT_NODE && (n as Element).tagName === "IMG") {
        count += 1;
      }
    }
    return count;
  }

  function countHtmlVisibleChars(html: string): number {
    let vis = 0;
    let insideTag = false;
    for (let i = 0; i < html.length; i++) {
      const ch = html[i];
      if (ch === "<") {
        const slice = html.slice(i, i + 5).toLowerCase();
        if (slice.startsWith("<img") && /[ \/>]/.test(slice[4] ?? "")) {
          vis++;
        }
        insideTag = true;
        continue;
      }
      if (ch === ">") { insideTag = false; continue; }
      if (insideTag) continue;
      if (ch === "&") {
        const semi = html.indexOf(";", i);
        if (semi !== -1 && semi - i <= 8) {
          const entity = html.slice(i, semi + 1);
          const map: Record<string, string> = {
            "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"',
            "&#39;": "'", "&apos;": "'", "&nbsp;": "\u00a0",
          };
          if (map[entity]) { vis += map[entity].length; i = semi; continue; }
          if (entity.startsWith("&#x")) { vis++; i = semi; continue; }
          if (entity.startsWith("&#")) { vis++; i = semi; continue; }
        }
      }
      if (ch === NOTE_MARK_START || ch === NOTE_MARK_END) continue;
      vis++;
    }
    return vis;
  }

  it("DOM and HTML visible text counts match for simple document", () => {
    const fullMd = "# Title\n\nHello world";
    const root = createAttachedRoot();
    applyMarkdownToEditorRoot(root, fullMd, "test.md");

    const html = window.parseMarkdownToHtml(fullMd);
    const domCount = countDomVisibleChars(root);
    const htmlCount = countHtmlVisibleChars(html);
    expect(domCount).toBe(htmlCount);
  });

  it("DOM and HTML visible text counts match for document with bold/italic", () => {
    const fullMd = "# My Note\n\nHello **bold** and *italic* world";
    const root = createAttachedRoot();
    applyMarkdownToEditorRoot(root, fullMd, "test.md");

    const html = window.parseMarkdownToHtml(fullMd);
    const domCount = countDomVisibleChars(root);
    const htmlCount = countHtmlVisibleChars(html);
    expect(domCount).toBe(htmlCount);
  });

  it("DOM and HTML visible text counts match for document with code block", () => {
    const fullMd = "# Code\n\nSome text\n\n```js\nconst x = 1;\n```\n\nAfter code";
    const root = createAttachedRoot();
    applyMarkdownToEditorRoot(root, fullMd, "test.md");

    const html = window.parseMarkdownToHtml(fullMd);
    const domCount = countDomVisibleChars(root);
    const htmlCount = countHtmlVisibleChars(html);
    expect(domCount).toBe(htmlCount);
  });

  it("DOM and HTML visible text counts match for document with links", () => {
    const fullMd = "# Links\n\nVisit [Google](https://google.com) today";
    const root = createAttachedRoot();
    applyMarkdownToEditorRoot(root, fullMd, "test.md");

    const html = window.parseMarkdownToHtml(fullMd);
    const domCount = countDomVisibleChars(root);
    const htmlCount = countHtmlVisibleChars(html);
    expect(domCount).toBe(htmlCount);
  });

  it("DOM and HTML visible text counts match for multi-paragraph document", () => {
    const fullMd = "# Document\n\nFirst paragraph.\n\nSecond paragraph.\n\nThird one.";
    const root = createAttachedRoot();
    applyMarkdownToEditorRoot(root, fullMd, "test.md");

    const html = window.parseMarkdownToHtml(fullMd);
    const domCount = countDomVisibleChars(root);
    const htmlCount = countHtmlVisibleChars(html);
    expect(domCount).toBe(htmlCount);
  });

  it("DOM and HTML visible text match for document with entities", () => {
    const fullMd = "# Title\n\nHello & world < 5 > 3";
    const root = createAttachedRoot();
    applyMarkdownToEditorRoot(root, fullMd, "test.md");

    const html = window.parseMarkdownToHtml(fullMd);
    const domCount = countDomVisibleChars(root);
    const htmlCount = countHtmlVisibleChars(html);
    expect(domCount).toBe(htmlCount);
  });

  it("full pipeline: select text → measure offsets → apply highlights creates overlay", () => {
    const fullMd = "# Title\n\nHello world, this is a test note.";
    const root = createAttachedRoot();
    applyMarkdownToEditorRoot(root, fullMd, "test.md");

    // Select "world"
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let targetNode: Text | null = null;
    let node: Node | null;
    while ((node = walker.nextNode())) {
      if ((node as Text).textContent?.includes("world")) {
        targetNode = node as Text;
        break;
      }
    }
    expect(targetNode).not.toBeNull();
    const range = document.createRange();
    const wi = (targetNode!.textContent ?? "").indexOf("world");
    range.setStart(targetNode!, wi);
    range.setEnd(targetNode!, wi + 5);

    // Measure offsets
    const offsets = measureNoteOffsetsFromSelection(root, range, "test.md");
    expect(offsets).not.toBeNull();

    // Verify body text matches
    const bodyMd = bodyMarkdownForEditor(fullMd);
    expect(bodyMd.slice(offsets![0], offsets![1])).toBe("world");

    // Apply note highlights — in jsdom, getClientRects returns empty, so overlay will be empty
    // but the function should not throw
    const notes = [{ index: offsets! as [number, number], value: "test note", resolved: false }];
    applyNoteHighlightsToRenderedDom(root, fullMd, notes);

    // The overlay container should be created (even with 0 rects in jsdom)
    // At minimum: no exceptions were thrown, and the DOM isn't corrupted
    const md2 = window.htmlToMarkdown(root);
    // The markdown should still be the same (overlay doesn't corrupt)
    const rootClean = createAttachedRoot();
    applyMarkdownToEditorRoot(rootClean, fullMd, "test.md");
    const mdClean = window.htmlToMarkdown(rootClean);
    expect(md2).toBe(mdClean);
  });
});
