import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createContext, runInContext } from "node:vm";
import { JSDOM } from "jsdom";

const here = dirname(fileURLToPath(import.meta.url));

const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>", {
  url: "http://localhost/",
  pretendToBeVisual: true,
});
const w = dom.window;
const parseCode = readFileSync(join(here, "../../public/markdown-parse.js"), "utf8");
const liveCode = readFileSync(join(here, "../../public/live-md.js"), "utf8");
const ctx = createContext({
  window: w,
  document: w.document,
  NodeFilter: w.NodeFilter,
});
runInContext(parseCode, ctx, { filename: "markdown-parse.js" });
runInContext(liveCode, ctx, { filename: "live-md.js" });

const fullMd = "# Title\n\nBefore ![alt](img.png) after";
console.log("=== Full MD ===");
console.log(JSON.stringify(fullMd));

// Parser output
const html = w.parseMarkdownToHtml(fullMd);
console.log("\n=== Parsed HTML ===");
console.log(html);

// Live editor render
const root = w.document.createElement("div");
root.contentEditable = "true";
w.document.body.appendChild(root);
root.innerHTML = html;
w.runLiveMarkdownTransforms(root);
console.log("\n=== Live DOM innerHTML ===");
console.log(root.innerHTML);

// Walk visible text in live DOM (same logic as buildDomPosEntries)
function walkText(el) {
  const walker = w.document.createTreeWalker(el, 0x05 /* SHOW_ELEMENT | SHOW_TEXT */, {
    acceptNode(node) {
      if (node.nodeType === 1) { // ELEMENT
        if (node.getAttribute("contenteditable") === "false" || node.hasAttribute("data-md-skip")) {
          return 2; // FILTER_REJECT
        }
        if (node.tagName === "IMG") return 1; // FILTER_ACCEPT
        return 3; // FILTER_SKIP
      }
      if (node.nodeType === 3) { // TEXT
        const parent = node.parentElement;
        if (parent && parent.closest("[contenteditable='false'], [data-md-skip]")) return 2;
        return 1;
      }
      return 3;
    },
  });
  const entries = [];
  let cum = 0;
  let n;
  while ((n = walker.nextNode())) {
    if (n.nodeType === 3) {
      const len = (n.textContent || "").length;
      if (len > 0) {
        entries.push({ type: "text", content: n.textContent, start: cum, end: cum + len });
        cum += len;
      }
    } else if (n.nodeType === 1 && n.tagName === "IMG") {
      entries.push({ type: "IMG", start: cum, end: cum + 1 });
      cum += 1;
    }
  }
  return { entries, totalLen: cum };
}

const liveText = walkText(root);
console.log("\n=== Live DOM pos entries ===");
for (const e of liveText.entries) {
  console.log(JSON.stringify(e));
}
console.log("Total visible length:", liveText.totalLen);

// Now test with markers: inject marker around "after" in body
const NOTE_MARK_START = "\uE000";
const NOTE_MARK_END = "\uE001";
const bodyMd = "Before ![alt](img.png) after";
const headingPrefix = "# Title\n\n";

// "after" is at position 23 in body (bodyMd.indexOf("after") = 23)
const afterIdx = bodyMd.indexOf("Before");
console.log("\n=== body indexOf 'Before' ===", afterIdx);
const markedBody = bodyMd.slice(0, afterIdx) + NOTE_MARK_START + "Before" + NOTE_MARK_END + bodyMd.slice(afterIdx + 6);
console.log("Marked body:", JSON.stringify(markedBody));

const markedHtml = w.parseMarkdownToHtml(headingPrefix + markedBody);
console.log("\n=== Marked full HTML ===");
console.log(markedHtml);

// Extract marker positions using the same logic as extractMarkerPositionsFromHtml
function extractMarkerPositions(html) {
  const results = [];
  let visOffset = 0;
  let insideTag = false;
  let currentStart = -1;
  for (let i = 0; i < html.length; i++) {
    const ch = html[i];
    if (ch === "<") {
      const slice = html.slice(i, i + 5).toLowerCase();
      if (slice.startsWith("<img") && /[ \/>]/.test(slice[4] || "")) visOffset++;
      insideTag = true;
      continue;
    }
    if (ch === ">") { insideTag = false; continue; }
    if (insideTag) continue;
    if (ch === NOTE_MARK_START) { currentStart = visOffset; continue; }
    if (ch === NOTE_MARK_END) {
      if (currentStart !== -1) { results.push({ visStart: currentStart, visEnd: visOffset }); currentStart = -1; }
      continue;
    }
    visOffset++;
  }
  return results;
}

const markerPos = extractMarkerPositions(markedHtml);
console.log("\n=== Marker positions (from marked HTML) ===");
console.log(JSON.stringify(markerPos));

// Compare: what text does the live DOM have at those positions?
console.log("\n=== What live DOM text is at those positions ===");
for (const mp of markerPos) {
  let text = "";
  for (const e of liveText.entries) {
    if (e.end <= mp.visStart || e.start >= mp.visEnd) continue;
    const s = Math.max(0, mp.visStart - e.start);
    const en = Math.min(e.type === "IMG" ? 1 : e.content.length, mp.visEnd - e.start);
    if (e.type === "IMG") {
      text += "[IMG]";
    } else {
      text += e.content.slice(s, en);
    }
  }
  console.log(`visStart=${mp.visStart}, visEnd=${mp.visEnd} => "${text}"`);
}
