/**
 * Markdown → HTML (CommonMark/GFM-style subset). No dependencies.
 * Headings, fenced code, hr, blockquote, ul/ol, task lists, GFM tables,
 * paragraphs, inline `code`, **bold**, __bold__, *italic*, _italic_, ~~strike~~,
 * [text](url), ![alt](url).
 */
(function () {
  "use strict";

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function safeHref(href) {
    const h = String(href || "").trim();
    if (/^https?:\/\//i.test(h)) return h;
    if (/^mailto:/i.test(h)) return h;
    if (h.startsWith("/") || h.startsWith("./") || h.startsWith("../")) return h;
    return "#";
  }

  function safeImgSrc(src) {
    const s = String(src || "").trim();
    if (/^https?:\/\//i.test(s)) return s;
    if (/^vault:\/\//i.test(s)) return s;
    if (/^data:image\/[a-z+]+;base64,/i.test(s)) return s;
    if (s.startsWith("/") || s.startsWith("./") || s.startsWith("../")) return s;
    // Vault-relative paths: file or folder segments without a scheme (e.g. images/photo.png)
    if (
      s &&
      !/^[a-z][a-z0-9+.-]*:/i.test(s) &&
      !/[\s<>"|?*]/.test(s)
    ) {
      return s;
    }
    return "";
  }

  /**
   * @param {string} s
   * @returns {string}
   */
  // Private Use Area markers used for note highlights — pass through unchanged.
  var NOTE_MARK_START = "\uE000";
  var NOTE_MARK_END   = "\uE001";

  function parseInline(s) {
    if (!s) return "";
    let out = "";
    let i = 0;
    const n = s.length;

    while (i < n) {
      const ch = s[i];
      const rest = s.slice(i);

      // Preserve note-highlight markers so they survive into the DOM as text.
      if (ch === NOTE_MARK_START || ch === NOTE_MARK_END) {
        out += ch;
        i += 1;
        continue;
      }

      if (ch === "`") {
        const end = s.indexOf("`", i + 1);
        if (end === -1) {
          out += escapeHtml(ch);
          i += 1;
          continue;
        }
        out += "<code>" + escapeHtml(s.slice(i + 1, end)) + "</code>";
        i = end + 1;
        continue;
      }

      if (rest.startsWith("![")) {
        const m = rest.match(
          /^!\[([^\]]*)\]\(([^)]*)\)(?:\{(\d+)(?:x(\d+))?\})?/
        );
        if (m) {
          const src = safeImgSrc(m[2]);
          if (src) {
            let attrs =
              '<img alt="' +
              escapeHtml(m[1]) +
              '" src="' +
              escapeHtml(src) +
              '" draggable="false" class="md-content-img"';
            if (m[3]) {
              attrs += ' data-md-w="' + escapeHtml(m[3]) + '"';
              if (m[4]) {
                attrs +=
                  ' data-md-h="' +
                  escapeHtml(m[4]) +
                  '" style="width:' +
                  escapeHtml(m[3]) +
                  "px;height:" +
                  escapeHtml(m[4]) +
                  'px;"';
              } else {
                attrs +=
                  ' style="width:' + escapeHtml(m[3]) + 'px;height:auto;"';
              }
            }
            attrs += " />";
            out += attrs;
          } else {
            out += escapeHtml(m[0]);
          }
          i += m[0].length;
          continue;
        }
      }

      if (ch === "[" && !rest.startsWith("![")) {
        const m = rest.match(/^\[([^\]]*)\]\(([^)]*)\)/);
        if (m) {
          const label = m[1];
          const rawHref = m[2];
          const href = safeHref(rawHref);
          out +=
            '<a href="' +
            escapeHtml(href) +
            '" data-md-href="' +
            escapeHtml(rawHref) +
            '" rel="noopener noreferrer">' +
            parseInline(label) +
            "</a>";
          i += m[0].length;
          continue;
        }
      }

      if (rest.startsWith("**")) {
        const end = s.indexOf("**", i + 2);
        if (end !== -1) {
          out += "<strong>" + parseInline(s.slice(i + 2, end)) + "</strong>";
          i = end + 2;
          continue;
        }
      }

      if (rest.startsWith("__")) {
        const end = s.indexOf("__", i + 2);
        if (end !== -1) {
          const inner = s.slice(i + 2, end);
          if (inner.length > 0 && !inner.includes("__")) {
            out += "<strong>" + parseInline(inner) + "</strong>";
            i = end + 2;
            continue;
          }
        }
      }

      if (rest.startsWith("~~")) {
        const end = s.indexOf("~~", i + 2);
        if (end !== -1) {
          out += "<del>" + parseInline(s.slice(i + 2, end)) + "</del>";
          i = end + 2;
          continue;
        }
      }

      if (ch === "*" && s[i + 1] !== "*") {
        const end = s.indexOf("*", i + 1);
        if (end !== -1 && (end === i + 1 || s[end - 1] !== "*") && s[end + 1] !== "*") {
          const inner = s.slice(i + 1, end);
          if (inner.length > 0 && !inner.includes("*")) {
            out += "<em>" + parseInline(inner) + "</em>";
            i = end + 1;
            continue;
          }
        }
      }

      if (ch === "_" && s[i + 1] !== "_") {
        const end = s.indexOf("_", i + 1);
        if (
          end !== -1 &&
          s[end + 1] !== "_" &&
          (end === i + 1 || s[end - 1] !== "_")
        ) {
          const inner = s.slice(i + 1, end);
          if (inner.length > 0 && !inner.includes("_")) {
            out += "<em>" + parseInline(inner) + "</em>";
            i = end + 1;
            continue;
          }
        }
      }

      if (ch === "<") {
        const auto = rest.match(/^<(https?:\/\/[^>\s]+)>/i);
        if (auto) {
          const u = auto[1];
          out +=
            '<a href="' +
            escapeHtml(u) +
            '" rel="noopener noreferrer">' +
            escapeHtml(u) +
            "</a>";
          i += auto[0].length;
          continue;
        }
        const mail = rest.match(/^<(mailto:[^>\s]+)>/i);
        if (mail) {
          const u = mail[1];
          out +=
            '<a href="' +
            escapeHtml(u) +
            '">' +
            escapeHtml(u.replace(/^mailto:/i, "")) +
            "</a>";
          i += mail[0].length;
          continue;
        }
      }

      out += escapeHtml(ch);
      i += 1;
    }
    return out;
  }

  function isHrLine(line) {
    const t = line.trim();
    return /^(?:-\s*){3,}$/.test(t) || /^(?:\*\s*){3,}$/.test(t) || /^(?:_\s*){3,}$/.test(t);
  }

  function isTableDivider(line) {
    const t = line.trim();
    if (!t.includes("|")) return false;
    return /^\|?[\s:|\-]+\|[\s|\-:]*$/.test(t);
  }

  function isTableRow(line) {
    const t = line.trim();
    return t.includes("|") && /\|[^|]+\|/.test(t);
  }

  function parseTableRow(line) {
    const t = line.trim();
    const raw = t.startsWith("|") ? t.slice(1) : t;
    const parts = raw.split("|");
    if (parts.length && parts[parts.length - 1].trim() === "") {
      parts.pop();
    }
    return parts.map((c) => c.trim());
  }

  /**
   * Nested `-` / `*` lists (2+ leading spaces per level). Returns { html, nextIdx }.
   */
  function parseBulletListHtml(lines, startIdx, minWs) {
    const re = /^(\s*)([-*])\s+(.*)$/;
    let html = "<ul>";
    let idx = startIdx;
    while (idx < lines.length) {
      const L = stripMarkers(lines[idx]);
      const m = L.match(re);
      if (!m) {
        break;
      }
      const ws = m[1].length;
      if (ws < minWs) {
        break;
      }
      if (ws > minWs) {
        break;
      }
      const content = m[3];
      if (/^\[[ xX]\]\s*/.test(String(content).trim())) {
        break;
      }
      // Extract original content with markers for inline parsing
      var origMatch = lines[idx].match(/^[\uE000\uE001]*\s*[-*]\s+(.*)$/);
      var origContent = origMatch ? origMatch[1] : content;
      idx += 1;
      let inner = parseInline(origContent);
      if (idx < lines.length) {
        const next = stripMarkers(lines[idx]);
        const mT = next.match(/^(\s*)([-*])\s+\[([ xX])\]\s*(.*)$/);
        const mO = next.match(/^(\s*)(\d+)\.\s+(.*)$/);
        const mB = next.match(re);
        if (mT && mT[1].length > ws) {
          const sub = parseTaskListHtml(lines, idx, ws + 2);
          inner += sub.html;
          idx = sub.nextIdx;
        } else if (mO && mO[1].length > ws) {
          const sub = parseOrderedListHtml(lines, idx, ws + 2);
          inner += sub.html;
          idx = sub.nextIdx;
        } else if (mB && mB[1].length > ws) {
          const rest = (mB[3] || "").trim();
          if (!/^\[[ xX]\]\s*/.test(rest)) {
            const sub = parseBulletListHtml(lines, idx, ws + 2);
            inner += sub.html;
            idx = sub.nextIdx;
          }
        }
      }
      html += "<li>" + inner + "</li>";
    }
    html += "</ul>";
    return { html: html, nextIdx: idx };
  }

  function parseOrderedListHtml(lines, startIdx, minWs) {
    const re = /^(\s*)(\d+)\.\s+(.*)$/;
    let html = "<ol>";
    let idx = startIdx;
    while (idx < lines.length) {
      const L = stripMarkers(lines[idx]);
      const m = L.match(re);
      if (!m) {
        break;
      }
      const ws = m[1].length;
      if (ws < minWs) {
        break;
      }
      if (ws > minWs) {
        break;
      }
      const content = m[3];
      // Extract original content with markers for inline parsing
      var origMatch = lines[idx].match(/^[\uE000\uE001]*\s*\d+\.\s+(.*)$/);
      var origContent = origMatch ? origMatch[1] : content;
      idx += 1;
      let inner = parseInline(origContent);
      if (idx < lines.length) {
        const next = stripMarkers(lines[idx]);
        const mT = next.match(/^(\s*)([-*])\s+\[([ xX])\]\s*(.*)$/);
        const mO = next.match(re);
        const mB = next.match(/^(\s*)([-*])\s+(.*)$/);
        if (mT && mT[1].length > ws) {
          const sub = parseTaskListHtml(lines, idx, ws + 2);
          inner += sub.html;
          idx = sub.nextIdx;
        } else if (mO && mO[1].length > ws) {
          const sub = parseOrderedListHtml(lines, idx, ws + 2);
          inner += sub.html;
          idx = sub.nextIdx;
        } else if (mB && mB[1].length > ws) {
          const rest = (mB[3] || "").trim();
          if (!/^\[[ xX]\]\s*/.test(rest)) {
            const sub = parseBulletListHtml(lines, idx, ws + 2);
            inner += sub.html;
            idx = sub.nextIdx;
          }
        }
      }
      html += "<li>" + inner + "</li>";
    }
    html += "</ol>";
    return { html: html, nextIdx: idx };
  }

  /**
   * Nested GFM task lists: `- [ ]` / `- [x]` with 2 spaces per indent level.
   */
  function parseTaskListHtml(lines, startIdx, minWs) {
    const re = /^(\s*)([-*])\s+\[([ xX])\]\s*(.*)$/;
    let html = '<ul class="md-task-list">';
    let idx = startIdx;
    while (idx < lines.length) {
      const L = stripMarkers(lines[idx]);
      const m = L.match(re);
      if (!m) {
        break;
      }
      const ws = m[1].length;
      if (ws < minWs) {
        break;
      }
      if (ws > minWs) {
        break;
      }
      const checked = m[3].toLowerCase() === "x";
      const content = m[4];
      // Extract original content with markers for inline parsing
      var origMatch = lines[idx].match(/^[\uE000\uE001]*\s*[-*]\s+\[[ xX]\]\s*(.*)$/);
      var origContent = origMatch ? origMatch[1] : content;
      idx += 1;
      const chk = checked ? "checked " : "";
      let nestedAfter = "";
      if (idx < lines.length) {
        const next = stripMarkers(lines[idx]);
        const mT = next.match(re);
        const mO = next.match(/^(\s*)(\d+)\.\s+(.*)$/);
        const mB = next.match(/^(\s*)([-*])\s+(.*)$/);
        if (mT && mT[1].length > ws) {
          const sub = parseTaskListHtml(lines, idx, ws + 2);
          nestedAfter += sub.html;
          idx = sub.nextIdx;
        } else if (mO && mO[1].length > ws) {
          const sub = parseOrderedListHtml(lines, idx, ws + 2);
          nestedAfter += sub.html;
          idx = sub.nextIdx;
        } else if (mB && mB[1].length > ws) {
          const rest = (mB[3] || "").trim();
          if (!/^\[[ xX]\]\s*/.test(rest)) {
            const sub = parseBulletListHtml(lines, idx, ws + 2);
            nestedAfter += sub.html;
            idx = sub.nextIdx;
          }
        }
      }
      const taskBody = parseInline(origContent) || "\u200b";
      html +=
        '<li class="md-task-item"><input type="checkbox" class="md-task-cb" contenteditable="false" ' +
        chk +
        '/><span class="md-task-body">' +
        taskBody +
        "</span>" +
        nestedAfter +
        "</li>";
    }
    html += "</ul>";
    return { html: html, nextIdx: idx };
  }

  function liBulletToMd(li, indentPrefix) {
    const childIndent = indentPrefix + "  ";
    let inlinePart = "";
    let blocks = "";
    const ch = li.childNodes;
    for (let j = 0; j < ch.length; j += 1) {
      const n = ch[j];
      if (n.nodeType === 3) {
        inlinePart += n.textContent;
      } else if (n.nodeType === 1) {
        const t = n.tagName.toLowerCase();
        if (t === "ul") {
          blocks += bulletUlToMd(n, childIndent);
        } else if (t === "ol") {
          blocks += orderedOlToMd(n, childIndent);
        } else if (t === "input") {
          /* skip checkbox in plain bullet li */
        } else {
          inlinePart += inlineToMd(n);
        }
      }
    }
    let line = indentPrefix + "- " + inlinePart.trim();
    if (blocks) {
      line += "\n" + blocks.replace(/\n$/, "");
    }
    return line + "\n";
  }

  function liTaskToMd(li, indentPrefix) {
    const childIndent = indentPrefix + "  ";
    const cb = li.querySelector(":scope > input.md-task-cb");
    const mark = cb && cb.checked ? "x" : " ";
    const span = li.querySelector(":scope > span.md-task-body");
    let text = "";
    if (span) {
      text = inlineToMd(span).trim().replace(/\u200b/g, "");
    } else {
      const ch = li.childNodes;
      for (let j = 0; j < ch.length; j += 1) {
        const n = ch[j];
        if (n.nodeType === 1 && n.tagName === "INPUT") continue;
        if (n.nodeType === 3) text += n.textContent;
        else if (n.nodeType === 1) {
          const tn = n.tagName.toLowerCase();
          if (tn !== "ul" && tn !== "ol") text += inlineToMd(n);
        }
      }
      text = text.trim();
    }
    let nested = "";
    const ch2 = li.childNodes;
    for (let j = 0; j < ch2.length; j += 1) {
      const n = ch2[j];
      if (n.nodeType !== 1) continue;
      const tn = n.tagName.toLowerCase();
      if (tn === "ul") {
        nested += n.classList.contains("md-task-list")
          ? taskUlToMd(n, childIndent)
          : bulletUlToMd(n, childIndent);
      } else if (tn === "ol") {
        nested += orderedOlToMd(n, childIndent);
      }
    }
    let o = indentPrefix + "- [" + mark + "] " + text.replace(/\n/g, "\n  ") + "\n";
    if (nested) o += nested;
    return o;
  }

  function taskUlToMd(ul, indentPrefix) {
    const items = ul.querySelectorAll(":scope > li.md-task-item");
    let o = "";
    for (let i = 0; i < items.length; i += 1) {
      o += liTaskToMd(items[i], indentPrefix);
    }
    return o;
  }

  function bulletUlToMd(ul, indentPrefix) {
    if (ul.classList && ul.classList.contains("md-task-list")) {
      return taskUlToMd(ul, indentPrefix);
    }
    const items = ul.querySelectorAll(":scope > li");
    let o = "";
    for (let i = 0; i < items.length; i += 1) {
      o += liBulletToMd(items[i], indentPrefix);
    }
    return o;
  }

  function liOrderedToMd(li, indentPrefix, num) {
    const childIndent = indentPrefix + "  ";
    let inlinePart = "";
    let blocks = "";
    const ch = li.childNodes;
    for (let j = 0; j < ch.length; j += 1) {
      const n = ch[j];
      if (n.nodeType === 3) {
        inlinePart += n.textContent;
      } else if (n.nodeType === 1) {
        const t = n.tagName.toLowerCase();
        if (t === "ul") {
          blocks += bulletUlToMd(n, childIndent);
        } else if (t === "ol") {
          blocks += orderedOlToMd(n, childIndent);
        } else {
          inlinePart += inlineToMd(n);
        }
      }
    }
    let line = indentPrefix + num + ". " + inlinePart.trim();
    if (blocks) {
      line += "\n" + blocks.replace(/\n$/, "");
    }
    return line + "\n";
  }

  function orderedOlToMd(ol, indentPrefix) {
    const items = ol.querySelectorAll(":scope > li");
    let o = "";
    for (let j = 0; j < items.length; j += 1) {
      o += liOrderedToMd(items[j], indentPrefix, j + 1);
    }
    return o;
  }

  /**
   * Strip note-highlight markers so block-level regexes aren't confused.
   * The original line (with markers) is still passed to parseInline so
   * the markers survive into the rendered HTML.
   */
  function stripMarkers(s) {
    return s.replace(/[\uE000\uE001]/g, "");
  }

  /**
   * @param {string} md
   * @returns {string}
   */
  function parseMarkdownToHtml(md) {
    if (md == null || md === "") {
      return "";
    }
    const lines = md.replace(/\r\n/g, "\n").split("\n");
    const blocks = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];
      // For block-level pattern matching, use a version without markers
      var cl = stripMarkers(line);

      if (cl.trim() === "") {
        i += 1;
        continue;
      }

      const fence = cl.match(/^```(\w*)\s*$/);
      if (fence) {
        const body = [];
        i += 1;
        while (i < lines.length && !/^```\s*$/.test(lines[i])) {
          body.push(lines[i]);
          i += 1;
        }
        if (i < lines.length) {
          i += 1;
        }
        const lang = fence[1] ? ' class="language-' + escapeHtml(fence[1]) + '"' : "";
        blocks.push("<pre><code" + lang + ">" + escapeHtml(body.join("\n")) + "</code></pre>");
        continue;
      }

      if (isHrLine(cl)) {
        blocks.push("<hr>");
        i += 1;
        continue;
      }

      if (isTableRow(cl) && i + 1 < lines.length && isTableDivider(stripMarkers(lines[i + 1]))) {
        const headerCells = parseTableRow(cl);
        var headerCellsOrig = parseTableRow(lines[i]);
        i += 2;
        const bodyRows = [];
        var bodyRowsOrig = [];
        while (i < lines.length && isTableRow(stripMarkers(lines[i])) && lines[i].trim().length > 0) {
          bodyRows.push(parseTableRow(stripMarkers(lines[i])));
          bodyRowsOrig.push(parseTableRow(lines[i]));
          i += 1;
        }
        let html = "<table><thead><tr>";
        for (let h = 0; h < headerCells.length; h += 1) {
          var hCellOrig = headerCellsOrig[h] != null ? headerCellsOrig[h] : headerCells[h];
          html += "<th>" + parseInline(hCellOrig) + "</th>";
        }
        html += "</tr></thead><tbody>";
        for (let r = 0; r < bodyRows.length; r += 1) {
          html += "<tr>";
          const row = bodyRows[r];
          var rowOrig = bodyRowsOrig[r] || row;
          for (let c = 0; c < headerCells.length; c += 1) {
            var cellOrig = rowOrig[c] != null ? rowOrig[c] : (row[c] != null ? row[c] : "");
            html += "<td>" + parseInline(cellOrig) + "</td>";
          }
          html += "</tr>";
        }
        html += "</tbody></table>";
        blocks.push(html);
        continue;
      }

      const hm = cl.match(/^(#{1,6})\s+(.*)$/);
      if (hm) {
        const lev = hm[1].length;
        // Use the original line (with markers) for inline content
        var hmOrig = line.match(/^[\uE000\uE001]*(#{1,6})\s+(.*)$/);
        var headContent = hmOrig ? hmOrig[2] : hm[2];
        blocks.push("<h" + lev + ">" + parseInline(headContent.trim()) + "</h" + lev + ">");
        i += 1;
        continue;
      }

      if (cl.startsWith(">")) {
        const qs = [];
        while (i < lines.length && stripMarkers(lines[i]).startsWith(">")) {
          qs.push(lines[i].replace(/^[\uE000\uE001]*>\s?/, ""));
          i += 1;
        }
        blocks.push("<blockquote><p>" + parseInline(qs.join(" ").trim()) + "</p></blockquote>");
        continue;
      }

      if (/^[-*]\s+\[([ xX])\]/.test(cl)) {
        const lead = cl.match(/^(\s*)/);
        if (lead && lead[1].length === 0) {
          const parsed = parseTaskListHtml(lines, i, 0);
          blocks.push(parsed.html);
          i = parsed.nextIdx;
          continue;
        }
      }

      const olm = cl.match(/^(\d+)\.\s+(.*)$/);
      if (olm) {
        const lead = cl.match(/^(\s*)/);
        if (lead && lead[1].length === 0) {
          const parsed = parseOrderedListHtml(lines, i, 0);
          blocks.push(parsed.html);
          i = parsed.nextIdx;
          continue;
        }
      }

      if (/^[-*]\s+/.test(cl)) {
        const lead = cl.match(/^(\s*)/);
        if (lead && lead[1].length === 0) {
          const parsed = parseBulletListHtml(lines, i, 0);
          blocks.push(parsed.html);
          i = parsed.nextIdx;
          continue;
        }
      }

      const para = [];
      while (i < lines.length) {
        const L = stripMarkers(lines[i]);
        if (L.trim() === "") break;
        if (isHrLine(L)) break;
        if (/^```/.test(L)) break;
        if (/^#{1,6}\s/.test(L)) break;
        if (L.startsWith(">")) break;
        if (/^[-*]\s+\[([ xX])\]/.test(L)) break;
        if (/^[-*]\s/.test(L)) break;
        if (/^\d+\.\s/.test(L)) break;
        if (isTableRow(L) && i + 1 < lines.length && isTableDivider(stripMarkers(lines[i + 1]))) break;
        para.push(lines[i]);  // push original line with markers
        i += 1;
      }
      const ptext = para.join(" ").trim();
      if (ptext) {
        blocks.push("<p>" + parseInline(ptext) + "</p>");
      }
    }

    return blocks.join("");
  }

  function inlineToMd(el) {
    let s = "";
    const ch = el.childNodes;
    for (let i = 0; i < ch.length; i += 1) {
      const node = ch[i];
      if (node.nodeType === 3) {
        s += node.textContent;
        continue;
      }
      if (node.nodeType !== 1) continue;
      const t = node.tagName.toLowerCase();
      if (t === "strong" || t === "b") {
        s += "**" + inlineToMd(node) + "**";
      } else if (t === "em" || t === "i") {
        s += "*" + inlineToMd(node) + "*";
      } else if (t === "del" || t === "s" || t === "strike") {
        s += "~~" + inlineToMd(node) + "~~";
      } else if (t === "code") {
        s += "`" + String(node.textContent || "").replace(/`/g, "\\`") + "`";
      } else if (t === "a") {
        const href = node.getAttribute("data-md-href") || node.getAttribute("href") || "";
        s += "[" + inlineToMd(node) + "](" + href + ")";
      } else if (t === "img") {
        const alt = node.getAttribute("alt") || "";
        const src = node.getAttribute("src") || "";
        let w = node.getAttribute("data-md-w") || "";
        let h = node.getAttribute("data-md-h") || "";
        if (!w && node.style && node.style.width) {
          const px = parseInt(node.style.width, 10);
          if (!isNaN(px)) {
            w = String(px);
          }
        }
        if (!h && node.style && node.style.height && node.style.height !== "auto") {
          const px = parseInt(node.style.height, 10);
          if (!isNaN(px)) {
            h = String(px);
          }
        }
        let dim = "";
        if (w) {
          dim = "{" + w;
          if (h) {
            dim += "x" + h;
          }
          dim += "}";
        }
        s += "![" + alt + "](" + src + ")" + dim;
      } else if (t === "br") {
        s += "\n";
      } else if (t === "ul") {
        s += bulletUlToMd(node, "");
      } else if (t === "ol") {
        s += orderedOlToMd(node, "");
      } else if (t === "li") {
        const chLi = node.childNodes;
        for (let k = 0; k < chLi.length; k += 1) {
          const c = chLi[k];
          if (c.nodeType === 3) {
            s += c.textContent;
          } else if (c.nodeType === 1) {
            const ct = c.tagName.toLowerCase();
            if (ct === "ul") {
              s += bulletUlToMd(c, "");
            } else if (ct === "ol") {
              s += orderedOlToMd(c, "");
            } else {
              s += inlineToMd(c);
            }
          }
        }
      } else {
        s += inlineToMd(node);
      }
    }
    return s;
  }

  function tableToMd(table) {
    const rows = table.querySelectorAll("tr");
    if (!rows.length) return "";
    const head = rows[0].querySelectorAll("th, td");
    const headCells = [];
    for (let i = 0; i < head.length; i += 1) {
      headCells.push(inlineToMd(head[i]).trim().replace(/\|/g, "\\|"));
    }
    let o = "| " + headCells.join(" | ") + " |\n";
    o += "| " + headCells.map(() => "---").join(" | ") + " |\n";
    for (let r = 1; r < rows.length; r += 1) {
      const cells = rows[r].querySelectorAll("td");
      const line = [];
      for (let c = 0; c < headCells.length; c += 1) {
        const cell = cells[c];
        line.push(cell ? inlineToMd(cell).trim().replace(/\|/g, "\\|") : "");
      }
      o += "| " + line.join(" | ") + " |\n";
    }
    return o + "\n";
  }

  function blockToMd(node) {
    if (node.nodeType === 3) {
      return node.textContent;
    }
    if (node.nodeType !== 1) {
      return "";
    }
    const tag = node.tagName.toLowerCase();
    if (tag === "h1") return "# " + inlineToMd(node).trim() + "\n\n";
    if (tag === "h2") return "## " + inlineToMd(node).trim() + "\n\n";
    if (tag === "h3") return "### " + inlineToMd(node).trim() + "\n\n";
    if (tag === "h4") return "#### " + inlineToMd(node).trim() + "\n\n";
    if (tag === "h5") return "##### " + inlineToMd(node).trim() + "\n\n";
    if (tag === "h6") return "###### " + inlineToMd(node).trim() + "\n\n";
    if (tag === "p") return inlineToMd(node) + "\n\n";
    if (tag === "hr") return "---\n\n";
    if (tag === "blockquote") {
      const inner = inlineToMd(node).trim().split("\n");
      return inner.map((ln) => "> " + ln).join("\n") + "\n\n";
    }
    if (tag === "ul") {
      return bulletUlToMd(node, "") + "\n";
    }
    if (tag === "ol") {
      return orderedOlToMd(node, "") + "\n";
    }
    if (tag === "pre") {
      const code = node.querySelector("code");
      const body = (code ? code.textContent : node.textContent).replace(/\u200b/g, "");
      const langMatch = code && code.className && code.className.match(/language-(\w+)/);
      const lang = langMatch ? langMatch[1] : "";
      const fence = lang ? "```" + lang : "```";
      return fence + "\n" + body + "\n```\n\n";
    }
    if (tag === "table") {
      return tableToMd(node);
    }
    if (
      tag === "div" ||
      tag === "section" ||
      tag === "article" ||
      tag === "main" ||
      tag === "header" ||
      tag === "footer" ||
      tag === "nav" ||
      tag === "figure" ||
      tag === "aside" ||
      tag === "center" ||
      tag === "details" ||
      tag === "summary"
    ) {
      let o = "";
      for (let i = 0; i < node.childNodes.length; i += 1) {
        o += blockToMd(node.childNodes[i]);
      }
      return o;
    }
    if (tag === "meta" || tag === "link" || tag === "style" || tag === "script") {
      return "";
    }
    return inlineToMd(node) + "\n\n";
  }

  function htmlToMarkdown(root) {
    if (!root) {
      return "";
    }
    const plain = (root.innerText || root.textContent || "")
      .replace(/\u00a0/g, " ")
      .trim();
    if (!plain) {
      return "";
    }
    if (!root.childNodes.length) {
      return "";
    }
    let out = "";
    for (let i = 0; i < root.childNodes.length; i += 1) {
      out += blockToMd(root.childNodes[i]);
    }
    return out.replace(/\n{3,}/g, "\n\n").trimEnd();
  }

  /**
   * Clipboard HTML (e.g. from a website or Word) → markdown using the same
   * block rules as the editor (tables, lists, headings, etc.).
   */
  function pasteHtmlToMarkdown(htmlString) {
    if (!htmlString || !String(htmlString).trim()) {
      return "";
    }
    let doc;
    try {
      doc = new DOMParser().parseFromString(htmlString, "text/html");
    } catch {
      return "";
    }
    const body = doc.body;
    if (!body) {
      return "";
    }
    let out = "";
    for (let i = 0; i < body.childNodes.length; i += 1) {
      const n = body.childNodes[i];
      if (n.nodeType === 3 && !String(n.textContent || "").trim()) {
        continue;
      }
      out += blockToMd(n);
    }
    return out.replace(/\n{3,}/g, "\n\n").trimEnd();
  }

  window.parseMarkdownToHtml = parseMarkdownToHtml;
  window.htmlToMarkdown = htmlToMarkdown;
  window.pasteHtmlToMarkdown = pasteHtmlToMarkdown;
})();
