import { describe, expect, it } from "vitest";
import {
  loadMarkdownParse,
  markdownRoundTrip,
} from "./loadMarkdownParse";

function norm(s: string): string {
  return s.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trimEnd();
}

describe("markdown round-trip (parseMarkdownToHtml → htmlToMarkdown)", () => {
  const w = loadMarkdownParse();

  it("preserves plain paragraph", () => {
    const md = "Hello world.\n\nSecond paragraph.";
    expect(norm(markdownRoundTrip(w, md))).toBe(norm(md));
  });

  it("preserves ATX headings", () => {
    const md = "# Title\n\n## Sub\n\nBody.";
    expect(norm(markdownRoundTrip(w, md))).toBe(norm(md));
  });

  it("preserves bullet list (top-level items)", () => {
    const md = "- one\n- two\n";
    expect(norm(markdownRoundTrip(w, md))).toBe(norm(md));
  });

  it("preserves fenced code block with language", () => {
    const md = "```js\nconst x = 1;\n```\n\n";
    const out = norm(markdownRoundTrip(w, md));
    expect(out).toContain("```js");
    expect(out).toContain("const x = 1;");
  });

  it("preserves horizontal rule", () => {
    const md = "Before\n\n---\n\nAfter\n";
    expect(norm(markdownRoundTrip(w, md))).toContain("---");
  });

  it("preserves link and emphasis", () => {
    const md = "Text with **bold** and [a link](https://example.com).\n";
    const out = norm(markdownRoundTrip(w, md));
    expect(out).toContain("**bold**");
    expect(out).toContain("[a link](https://example.com)");
  });

  it("preserves GFM table row shape", () => {
    const md = "| a | b |\n|---|---|\n| 1 | 2 |\n\n";
    const out = norm(markdownRoundTrip(w, md));
    expect(out).toContain("| a | b |");
    expect(out).toContain("| 1 | 2 |");
  });

  it("handles empty markdown", () => {
    expect(markdownRoundTrip(w, "").trim()).toBe("");
  });
});

describe("note markers survive through parseMarkdownToHtml without breaking rendering", () => {
  const w = loadMarkdownParse();
  const S = "\uE000";
  const E = "\uE001";

  function parseToHtml(md: string): string {
    return w.parseMarkdownToHtml(md);
  }

  it("paragraph text with markers parses correctly", () => {
    const html = parseToHtml(`Some ${S}highlighted${E} text`);
    expect(html).toContain("<p>");
    expect(html).toContain(S);
    expect(html).toContain(E);
    expect(html).toContain("highlighted");
  });

  it("heading with markers parses as heading", () => {
    const html = parseToHtml(`## ${S}Title${E}`);
    expect(html).toContain("<h2>");
    expect(html).toContain(S);
    expect(html).toContain("Title");
  });

  it("bullet list with markers parses as list", () => {
    const html = parseToHtml(`- ${S}item one${E}\n- item two`);
    expect(html).toContain("<ul>");
    expect(html).toContain("<li>");
    expect(html).toContain(S);
    expect(html).toContain("item one");
    expect(html).toContain("item two");
  });

  it("task list with markers parses as task list", () => {
    const html = parseToHtml(`- [ ] ${S}task item${E}`);
    expect(html).toContain("md-task-list");
    expect(html).toContain("md-task-item");
    expect(html).toContain(S);
    expect(html).toContain("task item");
  });

  it("image with markers parses as image", () => {
    const html = parseToHtml(`${S}![alt](img.png)${E}`);
    expect(html).toContain("<img");
    expect(html).toContain(S);
    expect(html).toContain(E);
  });

  it("ordered list with markers parses as ordered list", () => {
    const html = parseToHtml(`1. ${S}first${E}\n2. second`);
    expect(html).toContain("<ol>");
    expect(html).toContain("<li>");
    expect(html).toContain(S);
    expect(html).toContain("first");
  });

  it("blockquote with markers parses as blockquote", () => {
    const html = parseToHtml(`> ${S}quoted text${E}`);
    expect(html).toContain("<blockquote>");
    expect(html).toContain(S);
    expect(html).toContain("quoted text");
  });
});
