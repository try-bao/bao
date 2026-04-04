/**
 * Typora-style shortcuts: fenced code, hr, blockquote, task/ordered/bullet lists, # headings,
 * inline `code`, ** ** / __bold__, *italic*, ~~strike~~, links, images.
 * Depends on window.parseMarkdownToHtml / window.htmlToMarkdown from markdown-parse.js (not required at load time).
 */
(function () {
  "use strict";

  function placeCaretAfterBlock(el) {
    const sel = window.getSelection();
    if (!sel) {
      return;
    }
    const r = document.createRange();
    r.setStartAfter(el);
    r.collapse(true);
    sel.removeAllRanges();
    sel.addRange(r);
  }

  function placeCaretAtEndOfFencedCode(pre) {
    const code = pre.querySelector("code");
    if (!code) {
      placeCaretAfterBlock(pre);
      return;
    }
    const sel = window.getSelection();
    if (!sel) {
      return;
    }
    const r = document.createRange();
    r.selectNodeContents(code);
    r.collapse(false);
    sel.removeAllRanges();
    sel.addRange(r);
  }

  var FENCE_LANG_ALIASES = {
    js: "javascript",
    ts: "typescript",
    mjs: "javascript",
    cjs: "javascript",
    py: "python",
    rb: "ruby",
    sh: "bash",
    zsh: "bash",
    yml: "yaml",
    md: "markdown",
    html: "xml",
    htm: "xml",
    cpp: "cpp",
    cc: "cpp",
    cxx: "cpp",
    hpp: "cpp",
  };

  function normalizeFenceLang(s) {
    if (!s) {
      return "";
    }
    var t = String(s).toLowerCase().trim();
    if (FENCE_LANG_ALIASES[t]) {
      return FENCE_LANG_ALIASES[t];
    }
    return t;
  }

  var MD_CODE_LANG_OPTIONS = [
    ["", "Plain text"],
    ["javascript", "JavaScript"],
    ["typescript", "TypeScript"],
    ["python", "Python"],
    ["rust", "Rust"],
    ["go", "Go"],
    ["java", "Java"],
    ["c", "C"],
    ["cpp", "C++"],
    ["csharp", "C#"],
    ["css", "CSS"],
    ["xml", "HTML/XML"],
    ["json", "JSON"],
    ["yaml", "YAML"],
    ["bash", "Bash"],
    ["markdown", "Markdown"],
    ["diff", "Diff"],
  ];

  function buildCodeBlockToolbar(langNormalized) {
    var toolbar = document.createElement("div");
    toolbar.className = "md-code-toolbar";
    toolbar.setAttribute("contenteditable", "false");
    toolbar.setAttribute("data-md-skip", "true");
    var select = document.createElement("select");
    select.className = "md-code-lang-select";
    select.setAttribute("aria-label", "Code block language");
    select.title = "Language";
    var j;
    var opt;
    for (j = 0; j < MD_CODE_LANG_OPTIONS.length; j += 1) {
      opt = document.createElement("option");
      opt.value = MD_CODE_LANG_OPTIONS[j][0];
      opt.textContent = MD_CODE_LANG_OPTIONS[j][1];
      select.appendChild(opt);
    }
    if (langNormalized && select.querySelector('option[value="' + langNormalized + '"]')) {
      select.value = langNormalized;
    } else if (langNormalized) {
      opt = document.createElement("option");
      opt.value = langNormalized;
      opt.textContent = langNormalized;
      select.appendChild(opt);
      select.value = langNormalized;
    }
    select.addEventListener("change", function () {
      var v = select.value;
      var pre = toolbar.parentNode;
      var codeEl = pre && pre.querySelector("code");
      if (!codeEl) {
        return;
      }
      codeEl.className = v ? "language-" + v : "";
      if (typeof window.baoHighlightCodeElement === "function") {
        window.baoHighlightCodeElement(codeEl);
      }
    });
    toolbar.appendChild(select);
    return toolbar;
  }

  function buildFencedPre(langRaw, bodyText) {
    var lang = normalizeFenceLang(langRaw);
    var pre = document.createElement("pre");
    pre.className = "md-fenced-pre";
    var toolbar = buildCodeBlockToolbar(lang);
    var code = document.createElement("code");
    code.setAttribute("spellcheck", "false");
    if (lang) {
      code.className = "language-" + lang;
    }
    /* Use zero-width space for empty code blocks so the caret is placeable */
    code.textContent = bodyText || "\u200b";
    pre.appendChild(toolbar);
    pre.appendChild(code);
    return pre;
  }

  /**
   * Markdown load: <pre><code> without toolbar → add language bar (non-destructive).
   */
  function ensureFencedPreChrome(root) {
    var pres = root.querySelectorAll(":scope > pre:not(.md-fenced-pre)");
    var i;
    var pre;
    var code;
    var langMatch;
    var lang;
    for (i = 0; i < pres.length; i += 1) {
      pre = pres[i];
      if (!pre.isConnected || pre.closest("li")) {
        continue;
      }
      if (pre.querySelector(".md-code-toolbar")) {
        continue;
      }
      code = pre.querySelector(":scope > code");
      if (!code) {
        continue;
      }
      lang = "";
      langMatch = code.className && code.className.match(/language-(\w+)/);
      if (langMatch) {
        lang = normalizeFenceLang(langMatch[1]);
        if (lang && lang !== langMatch[1]) {
          code.className = "language-" + lang;
        }
      }
      pre.classList.add("md-fenced-pre");
      pre.insertBefore(buildCodeBlockToolbar(lang), code);
    }
  }

  /**
   * Turn ``` … ``` into <pre> (toolbar + <code>) (typed as one block or as three paragraphs: fence / body / fence).
   */
  function convertFencedCodeBlocks(root) {
    ensureFencedPreChrome(root);
    let again = true;
    while (again) {
      again = false;
      const layer = Array.from(root.querySelectorAll(":scope > p, :scope > div"));
      for (let i = 0; i < layer.length; i += 1) {
        const el = layer[i];
        if (!el.isConnected || el.closest("li")) {
          continue;
        }
        if (el.querySelector("pre, h1, h2, h3, h4, h5, h6, blockquote, ul, ol, table")) {
          continue;
        }
        const raw = el.textContent.replace(/\r\n/g, "\n");
        const m = raw.match(/^```(\w*)\n([\s\S]*?)\n```\s*$/);
        if (m) {
          const pre = buildFencedPre(m[1], m[2]);
          el.parentNode.replaceChild(pre, el);
          placeCaretAtEndOfFencedCode(pre);
          again = true;
          break;
        }
      }
      if (again) {
        continue;
      }
      const kids = Array.from(root.children);
      for (let i = 0; i < kids.length - 2; i += 1) {
        const a = kids[i];
        const b = kids[i + 1];
        const c = kids[i + 2];
        if (!/^P|DIV$/i.test(a.tagName) || !/^P|DIV$/i.test(b.tagName) || !/^P|DIV$/i.test(c.tagName)) {
          continue;
        }
        if (a.closest("li") || b.closest("li") || c.closest("li")) {
          continue;
        }
        const ta = a.textContent.replace(/\r\n/g, "\n").trim();
        const tc = c.textContent.replace(/\r\n/g, "\n").trim();
        const openFence = ta.match(/^```(\w*)$/);
        if (!openFence || !/^```$/.test(tc)) {
          continue;
        }
        const pre = buildFencedPre(openFence[1], b.textContent.replace(/\r\n/g, "\n"));
        a.parentNode.insertBefore(pre, a);
        a.remove();
        b.remove();
        c.remove();
        placeCaretAtEndOfFencedCode(pre);
        again = true;
        break;
      }
    }
  }

  function placeCaretAtEndOfElement(el) {
    if (!el) {
      return;
    }
    const sel = window.getSelection();
    if (!sel) {
      return;
    }
    const r = document.createRange();
    r.selectNodeContents(el);
    r.collapse(false);
    sel.removeAllRanges();
    sel.addRange(r);
  }

  /**
   * Turn "- item" / "* item" (or multiple such lines / siblings) into <ul><li>…</li></ul>.
   */
  function convertBulletLists(root) {
    let again = true;
    while (again) {
      again = false;
      const kids = Array.from(root.children);
      for (let i = 0; i < kids.length; i += 1) {
        const node = kids[i];
        if (!/^P|DIV$/i.test(node.tagName)) {
          continue;
        }
        if (node.closest("li")) {
          continue;
        }
        if (node.querySelector("pre, h1, h2, h3, h4, h5, h6, blockquote, ul, ol, table")) {
          continue;
        }

        const raw = node.textContent.replace(/\r\n/g, "\n");
        const trimmed = raw.trim();
        /* GFM task lines start with "- [" ; don't turn them (or partial "- [") into plain bullets */
        if (/^[-*]\s+\[/.test(trimmed)) {
          continue;
        }

        if (trimmed.includes("\n")) {
          const lines = trimmed
            .split("\n")
            .map((l) => l.trim())
            .filter((l) => l.length);
          if (
            lines.length >= 1 &&
            lines.every((l) => {
              if (/^[-*]\s+\[/.test(l)) {
                return false;
              }
              const mm = l.match(/^[-*]\s+(.*)$/);
              return Boolean(mm && mm[1].trim() !== "");
            })
          ) {
            const ul = document.createElement("ul");
            for (const line of lines) {
              const li = document.createElement("li");
              li.textContent = line.replace(/^[-*]\s+/, "");
              ul.appendChild(li);
            }
            node.parentNode.replaceChild(ul, node);
            placeCaretAtEndOfElement(ul.lastElementChild);
            again = true;
            break;
          }
        }

        if (trimmed.includes("\n")) {
          continue;
        }
        const m = trimmed.match(/^[-*]\s+(.*)$/);
        if (!m) {
          continue;
        }
        /* Don't turn "- " into a plain ul yet — user may still be typing "- [ ]". */
        if (m[1].trim() === "") {
          continue;
        }

        const items = [m[1]];
        let j = i + 1;
        while (j < kids.length) {
          const n2 = kids[j];
          if (!/^P|DIV$/i.test(n2.tagName)) {
            break;
          }
          if (n2.querySelector("pre, h1, h2, h3, h4, h5, h6, blockquote, ul, ol, table")) {
            break;
          }
          const t2 = n2.textContent.replace(/\r\n/g, "\n").trim();
          if (t2.includes("\n")) {
            break;
          }
          if (/^[-*]\s+\[/.test(t2)) {
            break;
          }
          const m2 = t2.match(/^[-*]\s+(.*)$/);
          if (!m2 || m2[1].trim() === "") {
            break;
          }
          items.push(m2[1]);
          j += 1;
        }

        const ul = document.createElement("ul");
        for (let k = 0; k < items.length; k += 1) {
          const li = document.createElement("li");
          li.textContent = items[k];
          ul.appendChild(li);
        }
        node.parentNode.insertBefore(ul, node);
        for (let k = i; k < j; k += 1) {
          kids[k].remove();
        }
        placeCaretAtEndOfElement(ul.lastElementChild);
        again = true;
        break;
      }
    }
  }

  function isHrLineText(t) {
    const s = t.trim();
    return /^(?:-\s*){3,}$/.test(s) || /^(?:_\s*){3,}$/.test(s);
  }

  function convertHorizontalRules(root) {
    let changed = true;
    while (changed) {
      changed = false;
      const blocks = root.querySelectorAll(":scope > p, :scope > div");
      for (let i = 0; i < blocks.length; i += 1) {
        const block = blocks[i];
        if (block.closest("li")) {
          continue;
        }
        if (block.querySelector("pre, h1, h2, h3, h4, h5, h6, blockquote, ul, ol, table, hr")) {
          continue;
        }
        const raw = block.textContent.replace(/\r\n/g, "\n").trim();
        if (!raw || raw.includes("\n")) {
          continue;
        }
        if (!isHrLineText(raw)) {
          continue;
        }
        const hr = document.createElement("hr");
        block.parentNode.replaceChild(hr, block);
        placeCaretAfterBlock(hr);
        changed = true;
        break;
      }
    }
  }

  function convertBlockquotes(root) {
    let changed = true;
    while (changed) {
      changed = false;
      const blocks = root.querySelectorAll(":scope > p, :scope > div");
      for (let i = 0; i < blocks.length; i += 1) {
        const block = blocks[i];
        if (block.closest("li")) {
          continue;
        }
        if (block.querySelector("pre, h1, h2, h3, h4, h5, h6, blockquote, ul, ol, table, hr")) {
          continue;
        }
        const raw = block.textContent.replace(/\r\n/g, "\n");
        const trimmed = raw.trim();
        if (!trimmed) {
          continue;
        }
        let body = "";
        if (trimmed.includes("\n")) {
          const lines = trimmed.split("\n").map((l) => l.trim());
          if (!lines.every((l) => l.startsWith(">"))) {
            continue;
          }
          body = lines.map((l) => l.replace(/^>\s?/, "")).join(" ").trim();
        } else {
          const m = trimmed.match(/^>\s?(.*)$/);
          if (!m) {
            continue;
          }
          body = m[1].trim();
        }
        const bq = document.createElement("blockquote");
        const p = document.createElement("p");
        p.textContent = body || "\u200b";
        bq.appendChild(p);
        block.parentNode.replaceChild(bq, block);
        placeCaretAtEndOfElement(p);
        changed = true;
        break;
      }
    }
  }

  function buildTaskListUl(items) {
    const ul = document.createElement("ul");
    ul.className = "md-task-list";
    for (let k = 0; k < items.length; k += 1) {
      const it = items[k];
      const li = document.createElement("li");
      li.className = "md-task-item";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.className = "md-task-cb";
      cb.setAttribute("contenteditable", "false");
      if (it.checked) {
        cb.checked = true;
      }
      li.appendChild(cb);
      const span = document.createElement("span");
      span.className = "md-task-body";
      /* Empty spans do not hold a caret in contenteditable; \u200b is stripped in htmlToMarkdown. */
      span.textContent = it.text || "\u200b";
      li.appendChild(span);
      ul.appendChild(li);
    }
    return ul;
  }

  function convertTaskLists(root) {
    let again = true;
    while (again) {
      again = false;
      const kids = Array.from(root.children);
      for (let i = 0; i < kids.length; i += 1) {
        const node = kids[i];
        if (!/^P|DIV$/i.test(node.tagName)) {
          continue;
        }
        if (node.closest("li")) {
          continue;
        }
        if (node.querySelector("pre, h1, h2, h3, h4, h5, h6, blockquote, ul, ol, table")) {
          continue;
        }

        const raw = node.textContent.replace(/\r\n/g, "\n");
        const trimmed = raw.trim();

        if (trimmed.includes("\n")) {
          const lines = trimmed
            .split("\n")
            .map((l) => l.trim())
            .filter((l) => l.length);
          const taskRe = /^[-*]\s+\[([ xX])\]\s*(.*)$/;
          if (
            lines.length >= 1 &&
            lines.every((l) => taskRe.test(l))
          ) {
            const items = lines.map((l) => {
              const m = l.match(taskRe);
              return {
                checked: m[1].toLowerCase() === "x",
                text: m[2],
              };
            });
            const ul = buildTaskListUl(items);
            node.parentNode.replaceChild(ul, node);
            const last = ul.querySelector("li:last-child span");
            placeCaretAtEndOfElement(last || ul.lastElementChild);
            again = true;
            break;
          }
        }

        if (trimmed.includes("\n")) {
          continue;
        }
        const m = trimmed.match(/^[-*]\s+\[([ xX])\]\s*(.*)$/);
        if (!m) {
          continue;
        }

        const items = [{ checked: m[1].toLowerCase() === "x", text: m[2] }];
        let j = i + 1;
        while (j < kids.length) {
          const n2 = kids[j];
          if (!/^P|DIV$/i.test(n2.tagName)) {
            break;
          }
          if (n2.querySelector("pre, h1, h2, h3, h4, h5, h6, blockquote, ul, ol, table")) {
            break;
          }
          const t2 = n2.textContent.replace(/\r\n/g, "\n").trim();
          if (t2.includes("\n")) {
            break;
          }
          const m2 = t2.match(/^[-*]\s+\[([ xX])\]\s*(.*)$/);
          if (!m2) {
            break;
          }
          items.push({ checked: m2[1].toLowerCase() === "x", text: m2[2] });
          j += 1;
        }

        const ul = buildTaskListUl(items);
        node.parentNode.insertBefore(ul, node);
        for (let k = i; k < j; k += 1) {
          kids[k].remove();
        }
        const last = ul.querySelector("li:last-child span");
        placeCaretAtEndOfElement(last || ul.lastElementChild);
        again = true;
        break;
      }
    }
  }

  function convertOrderedLists(root) {
    let again = true;
    while (again) {
      again = false;
      const kids = Array.from(root.children);
      for (let i = 0; i < kids.length; i += 1) {
        const node = kids[i];
        if (!/^P|DIV$/i.test(node.tagName)) {
          continue;
        }
        if (node.closest("li")) {
          continue;
        }
        if (node.querySelector("pre, h1, h2, h3, h4, h5, h6, blockquote, ul, ol, table")) {
          continue;
        }

        const raw = node.textContent.replace(/\r\n/g, "\n");
        const trimmed = raw.trim();

        if (trimmed.includes("\n")) {
          const lines = trimmed
            .split("\n")
            .map((l) => l.trim())
            .filter((l) => l.length);
          if (
            lines.length >= 1 &&
            lines.every(
              (l) => /^\d+\.\s+(.*)$/.test(l) || /^\d+\.$/.test(l)
            )
          ) {
            const ol = document.createElement("ol");
            for (const line of lines) {
              const li = document.createElement("li");
              const om = line.match(/^\d+\.\s+(.*)$/);
              li.textContent = om ? om[1] : "";
              ol.appendChild(li);
            }
            node.parentNode.replaceChild(ol, node);
            placeCaretAtEndOfElement(ol.lastElementChild);
            again = true;
            break;
          }
        }

        if (trimmed.includes("\n")) {
          continue;
        }
        let m = trimmed.match(/^\d+\.\s+(.*)$/);
        if (!m && /^\d+\.$/.test(trimmed)) {
          m = [trimmed, ""];
        }
        if (!m) {
          continue;
        }

        const items = [m[1]];
        let j = i + 1;
        while (j < kids.length) {
          const n2 = kids[j];
          if (!/^P|DIV$/i.test(n2.tagName)) {
            break;
          }
          if (n2.querySelector("pre, h1, h2, h3, h4, h5, h6, blockquote, ul, ol, table")) {
            break;
          }
          const t2 = n2.textContent.replace(/\r\n/g, "\n").trim();
          if (t2.includes("\n")) {
            break;
          }
          let m2 = t2.match(/^\d+\.\s+(.*)$/);
          if (!m2 && /^\d+\.$/.test(t2)) {
            m2 = [t2, ""];
          }
          if (!m2) {
            break;
          }
          items.push(m2[1]);
          j += 1;
        }

        const ol = document.createElement("ol");
        for (let k = 0; k < items.length; k += 1) {
          const li = document.createElement("li");
          li.textContent = items[k];
          ol.appendChild(li);
        }
        node.parentNode.insertBefore(ol, node);
        for (let k = i; k < j; k += 1) {
          kids[k].remove();
        }
        placeCaretAtEndOfElement(ol.lastElementChild);
        again = true;
        break;
      }
    }
  }

  /**
   * After "# " or "## " … is typed, turn the block into <h1>…</h1> (contenteditable-friendly).
   * Runs on `input` so Space is already in the document (no preventDefault issues).
   *
   * We do not require "simple" DOM (plain text only): Chromium often wraps a single "#" in a
   * <span>, which made isSimpleTextBlock() reject h1 while "##" still worked.
   */
  function convertAtxHeadings(root) {
    let changed = true;
    while (changed) {
      changed = false;
      const blocks = root.querySelectorAll(":scope > p, :scope > div");
      for (let i = 0; i < blocks.length; i += 1) {
        const block = blocks[i];
        if (block.closest("li")) {
          continue;
        }
        const text = block.textContent
          .replace(/\u00a0/g, " ")
          .replace(/^[\u200b\u200c\u200d\ufeff]+/, "")
          .trimStart();
        const m = text.match(/^(#{1,6})\s(.*)$/);
        if (!m) {
          continue;
        }
        const level = m[1].length;
        const rest = m[2];
        const h = document.createElement("h" + level);
        if (rest.length) {
          h.textContent = rest;
        } else {
          h.appendChild(document.createElement("br"));
        }
        block.parentNode.replaceChild(h, block);
        const sel = window.getSelection();
        if (sel) {
          const r = document.createRange();
          r.selectNodeContents(h);
          r.collapse(false);
          sel.removeAllRanges();
          sel.addRange(r);
        }
        changed = true;
        break;
      }
    }
  }

  function canTransformTextNode(textNode) {
    const p = textNode.parentElement;
    if (!p) {
      return false;
    }
    /* Note markers (fileNotes.ts) must not be touched by inline transforms — especially in
     * headings, where *…* / `…` / links would split text and drop \\uE000/\\uE001 before unwrap. */
    const raw = textNode.textContent || "";
    if (raw.indexOf("\uE000") !== -1 || raw.indexOf("\uE001") !== -1) {
      return false;
    }
    if (p.closest("pre")) {
      return false;
    }
    if (p.tagName === "CODE" && p.parentElement && p.parentElement.tagName === "PRE") {
      return false;
    }
    if (p.closest && p.closest("[data-md-editing]")) {
      return false;
    }
    if (
      p.tagName === "STRONG" ||
      p.tagName === "EM" ||
      p.tagName === "CODE" ||
      p.tagName === "DEL" ||
      p.tagName === "A" ||
      p.tagName === "IMG"
    ) {
      return false;
    }
    return true;
  }

  /** After wrapping text in <strong>, <em>, or <code>, put the caret where typing should continue. */
  function placeCaretAfterInline(inlineEl) {
    const sel = window.getSelection();
    if (!sel) {
      return;
    }
    const r = document.createRange();
    const next = inlineEl.nextSibling;
    if (next && next.nodeType === 3 && next.textContent.length > 0) {
      r.setStart(next, 0);
      r.collapse(true);
    } else {
      const tn = inlineEl.firstChild;
      if (tn && tn.nodeType === 3) {
        r.setStart(tn, tn.textContent.length);
        r.collapse(true);
      } else {
        r.setStartAfter(inlineEl);
        r.collapse(true);
      }
    }
    sel.removeAllRanges();
    sel.addRange(r);
  }

  function replaceBold(textNode) {
    const text = textNode.textContent;
    let re = /\*\*([^*]+)\*\*/;
    let m = re.exec(text);
    if (!m) {
      re = /__([^_]+)__/;
      m = re.exec(text);
    }
    if (!m) {
      return false;
    }
    const parent = textNode.parentNode;
    if (!parent) {
      return false;
    }
    const i = m.index;
    const frag = document.createDocumentFragment();
    if (i > 0) {
      frag.appendChild(document.createTextNode(text.slice(0, i)));
    }
    const strong = document.createElement("strong");
    strong.textContent = m[1];
    frag.appendChild(strong);
    const rest = text.slice(i + m[0].length);
    if (rest) {
      frag.appendChild(document.createTextNode(rest));
    }
    parent.replaceChild(frag, textNode);
    placeCaretAfterInline(strong);
    return true;
  }

  function replaceItalic(textNode) {
    const text = textNode.textContent;
    if (text.includes("**")) {
      return false;
    }
    const re = /\*([^*]+)\*/;
    const m = re.exec(text);
    if (!m) {
      return false;
    }
    const parent = textNode.parentNode;
    if (!parent) {
      return false;
    }
    const i = m.index;
    const frag = document.createDocumentFragment();
    if (i > 0) {
      frag.appendChild(document.createTextNode(text.slice(0, i)));
    }
    const em = document.createElement("em");
    em.textContent = m[1];
    frag.appendChild(em);
    const rest = text.slice(i + m[0].length);
    if (rest) {
      frag.appendChild(document.createTextNode(rest));
    }
    parent.replaceChild(frag, textNode);
    placeCaretAfterInline(em);
    return true;
  }

  function replaceCode(textNode) {
    const text = textNode.textContent;
    const re = /`([^`]+)`/;
    const m = re.exec(text);
    if (!m) {
      return false;
    }
    const parent = textNode.parentNode;
    if (!parent) {
      return false;
    }
    const i = m.index;
    const frag = document.createDocumentFragment();
    if (i > 0) {
      frag.appendChild(document.createTextNode(text.slice(0, i)));
    }
    const code = document.createElement("code");
    code.textContent = m[1];
    frag.appendChild(code);
    const rest = text.slice(i + m[0].length);
    if (rest) {
      frag.appendChild(document.createTextNode(rest));
    }
    parent.replaceChild(frag, textNode);
    placeCaretAfterInline(code);
    return true;
  }

  function safeImgSrc(src) {
    const s = String(src || "").trim();
    if (/^https?:\/\//i.test(s)) return s;
    if (/^vault:\/\//i.test(s)) return s;
    if (/^data:image\/[a-z+]+;base64,/i.test(s)) return s;
    if (s.startsWith("/") || s.startsWith("./") || s.startsWith("../")) return s;
    if (
      s &&
      !/^[a-z][a-z0-9+.-]*:/i.test(s) &&
      !/[\s<>"|?*]/.test(s)
    ) {
      return s;
    }
    return "";
  }

  function safeLinkHref(href) {
    const h = String(href || "").trim();
    if (/^https?:\/\//i.test(h)) return h;
    if (/^mailto:/i.test(h)) return h;
    if (h.startsWith("/") || h.startsWith("./") || h.startsWith("../")) return h;
    return "#";
  }

  function replaceImage(textNode) {
    const text = textNode.textContent;
    const m = /!\[([^\]]*)\]\(([^)]*)\)(?:\{(\d+)(?:x(\d+))?\})?/.exec(
      text
    );
    if (!m) {
      return false;
    }
    const src = safeImgSrc(m[2]);
    if (!src) {
      return false;
    }
    const parent = textNode.parentNode;
    if (!parent) {
      return false;
    }
    const i = m.index;
    const frag = document.createDocumentFragment();
    if (i > 0) {
      frag.appendChild(document.createTextNode(text.slice(0, i)));
    }
    const img = document.createElement("img");
    img.alt = m[1];
    img.src = src;
    img.draggable = false;
    img.className = "md-content-img";
    if (m[3]) {
      img.setAttribute("data-md-w", m[3]);
      if (m[4]) {
        img.setAttribute("data-md-h", m[4]);
        img.style.width = m[3] + "px";
        img.style.height = m[4] + "px";
      } else {
        img.style.width = m[3] + "px";
        img.style.height = "auto";
      }
    }
    frag.appendChild(img);
    const rest = text.slice(i + m[0].length);
    if (rest) {
      frag.appendChild(document.createTextNode(rest));
    }
    parent.replaceChild(frag, textNode);
    placeCaretAfterInline(img);
    return true;
  }

  function replaceLink(textNode) {
    const text = textNode.textContent;
    const re = /\[([^\]]*)\]\(([^)]*)\)/g;
    let m;
    let hit = null;
    while ((m = re.exec(text)) !== null) {
      if (m.index > 0 && text[m.index - 1] === "!") {
        continue;
      }
      hit = { index: m.index, len: m[0].length, label: m[1], href: m[2] };
      break;
    }
    if (!hit) {
      return false;
    }
    const parent = textNode.parentNode;
    if (!parent) {
      return false;
    }
    const i = hit.index;
    const frag = document.createDocumentFragment();
    if (i > 0) {
      frag.appendChild(document.createTextNode(text.slice(0, i)));
    }
    const a = document.createElement("a");
    a.href = safeLinkHref(hit.href);
    a.setAttribute("data-md-href", hit.href);
    a.rel = "noopener noreferrer";
    a.textContent = hit.label;
    frag.appendChild(a);
    const rest = text.slice(i + hit.len);
    if (rest) {
      frag.appendChild(document.createTextNode(rest));
    }
    parent.replaceChild(frag, textNode);
    placeCaretAfterInline(a);
    return true;
  }

  function replaceStrikethrough(textNode) {
    const text = textNode.textContent;
    const m = /~~([^~]+)~~/.exec(text);
    if (!m) {
      return false;
    }
    const parent = textNode.parentNode;
    if (!parent) {
      return false;
    }
    const i = m.index;
    const frag = document.createDocumentFragment();
    if (i > 0) {
      frag.appendChild(document.createTextNode(text.slice(0, i)));
    }
    const del = document.createElement("del");
    del.textContent = m[1];
    frag.appendChild(del);
    const rest = text.slice(i + m[0].length);
    if (rest) {
      frag.appendChild(document.createTextNode(rest));
    }
    parent.replaceChild(frag, textNode);
    placeCaretAfterInline(del);
    return true;
  }

  function replaceItalicUnderscore(textNode) {
    const text = textNode.textContent;
    if (text.includes("__") || text.includes("*")) {
      return false;
    }
    const m = /_([^_]+)_/.exec(text);
    if (!m) {
      return false;
    }
    const parent = textNode.parentNode;
    if (!parent) {
      return false;
    }
    const i = m.index;
    const frag = document.createDocumentFragment();
    if (i > 0) {
      frag.appendChild(document.createTextNode(text.slice(0, i)));
    }
    const em = document.createElement("em");
    em.textContent = m[1];
    frag.appendChild(em);
    const rest = text.slice(i + m[0].length);
    if (rest) {
      frag.appendChild(document.createTextNode(rest));
    }
    parent.replaceChild(frag, textNode);
    placeCaretAfterInline(em);
    return true;
  }

  function collectTextNodes(root) {
    const texts = [];
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let t;
    while ((t = w.nextNode())) {
      if (canTransformTextNode(t) && t.textContent && t.textContent.length > 1) {
        texts.push(t);
      }
    }
    return texts;
  }

  function applyInlineMarkers(root) {
    let pass = 0;
    let changed = true;
    while (changed && pass < 40) {
      changed = false;
      pass += 1;
      const texts = collectTextNodes(root);

      const tryPass = function (predicate, fn) {
        for (let j = 0; j < texts.length; j += 1) {
          const textNode = texts[j];
          if (!textNode.parentNode) {
            continue;
          }
          if (predicate(textNode.textContent) && fn(textNode)) {
            return true;
          }
        }
        return false;
      };

      if (tryPass((tx) => tx.includes("`"), replaceCode)) {
        changed = true;
        continue;
      }
      if (tryPass((tx) => /!\[[^\]]*\]\([^)]*\)/.test(tx), replaceImage)) {
        changed = true;
        continue;
      }
      if (tryPass((tx) => /\[([^\]]*)\]\([^)]*\)/.test(tx), replaceLink)) {
        changed = true;
        continue;
      }
      if (
        tryPass(
          (tx) => /\*\*[^*]+\*\*/.test(tx) || /__[^_]+__/.test(tx),
          replaceBold
        )
      ) {
        changed = true;
        continue;
      }
      if (tryPass((tx) => /~~[^~]+~~/.test(tx), replaceStrikethrough)) {
        changed = true;
        continue;
      }
      if (
        tryPass(
          (tx) => /\*[^*]+\*/.test(tx) && !/\*\*/.test(tx),
          replaceItalic
        )
      ) {
        changed = true;
        continue;
      }
      if (tryPass((tx) => /_[^_]+_/.test(tx), replaceItalicUnderscore)) {
        changed = true;
        continue;
      }
    }
  }

  function ensureTaskListCheckboxAttrs(root) {
    var nodes = root.querySelectorAll("ul.md-task-list input.md-task-cb");
    var i;
    for (i = 0; i < nodes.length; i += 1) {
      nodes[i].setAttribute("contenteditable", "false");
    }
  }

  /**
   * Run the same block + inline transforms as the editor input handler (after toolbar / execCommand).
   * @param {HTMLElement} root
   */
  window.runLiveMarkdownTransforms = function (root) {
    ensureTaskListCheckboxAttrs(root);
    convertFencedCodeBlocks(root);
    convertHorizontalRules(root);
    convertBlockquotes(root);
    convertTaskLists(root);
    convertOrderedLists(root);
    convertBulletLists(root);
    convertAtxHeadings(root);
    applyInlineMarkers(root);
    ensureTaskListCheckboxAttrs(root);
  };

  function clipboardImageBlobFromDataTransfer(dt) {
    if (!dt) {
      return null;
    }
    if (dt.files && dt.files.length) {
      for (let i = 0; i < dt.files.length; i += 1) {
        const f = dt.files[i];
        if (f.type && f.type.indexOf("image/") === 0) {
          return f;
        }
      }
    }
    if (dt.items && dt.items.length) {
      for (let j = 0; j < dt.items.length; j += 1) {
        const it = dt.items[j];
        if (it.kind === "file" && it.type && it.type.indexOf("image/") === 0) {
          const b = it.getAsFile();
          if (b) {
            return b;
          }
        }
      }
    }
    return null;
  }

  function blobToBase64Payload(blob) {
    return new Promise(function (resolve, reject) {
      const r = new FileReader();
      r.onloadend = function () {
        const s = r.result;
        if (typeof s !== "string") {
          reject(new Error("clipboard read"));
          return;
        }
        const i = s.indexOf(",");
        resolve(i >= 0 ? s.slice(i + 1) : s);
      };
      r.onerror = function () {
        reject(r.error || new Error("clipboard read"));
      };
      r.readAsDataURL(blob);
    });
  }

  /**
   * Scan markdown for remote image URLs (http/https), fetch each image,
   * save it to the vault images/ folder, and return updated markdown
   * with local paths.  Keeps the original URL on per-image failure.
   */
  function downloadRemoteImagesInMarkdown(md, noteRel) {
    var imgRe = /!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g;
    var matches = [];
    var m;
    while ((m = imgRe.exec(md)) !== null) {
      matches.push({ full: m[0], alt: m[1], url: m[2] });
    }
    if (
      !matches.length ||
      !window.bao ||
      typeof window.bao.writeBinaryFile !== "function"
    ) {
      return Promise.resolve(md);
    }
    var stamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .replace("T", "_");
    var noteParent = parentDirOfNote(noteRel);
    var result = md;
    var chain = Promise.resolve();
    matches.forEach(function (match, idx) {
      chain = chain.then(function () {
        return fetch(match.url)
          .then(function (resp) {
            if (!resp.ok) throw new Error("HTTP " + resp.status);
            return resp.blob();
          })
          .then(function (blob) {
            var mime = blob.type || "image/png";
            var ext = extFromImageMime(mime);
            var fileName =
              "paste_" +
              stamp +
              (matches.length > 1 ? "_" + idx : "") +
              ext;
            var vaultRel = noteParent
              ? noteParent + "/images/" + fileName
              : "images/" + fileName;
            return blobToBase64Payload(blob).then(function (b64) {
              return window.bao
                .writeBinaryFile(vaultRel, b64)
                .then(function () {
                  var localPath = vaultRelToMdPath(noteRel, vaultRel);
                  result = result.replace(
                    match.full,
                    "![" + match.alt + "](" + localPath + ")"
                  );
                });
            });
          })
          .catch(function (err) {
            console.warn(
              "bao: failed to download remote image, keeping URL:",
              match.url,
              err
            );
          });
      });
    });
    return chain.then(function () {
      return result;
    });
  }

  function parentDirOfNote(relPath) {
    const i = relPath.lastIndexOf("/");
    return i === -1 ? "" : relPath.slice(0, i);
  }

  function vaultRelToMdPath(noteRelPath, imageVaultRel) {
    if (!noteRelPath) {
      return imageVaultRel;
    }
    const fromDir = parentDirOfNote(noteRelPath);
    const fromParts = fromDir ? fromDir.split("/").filter(Boolean) : [];
    const toParts = imageVaultRel.split("/").filter(Boolean);
    let k = 0;
    while (
      k < fromParts.length &&
      k < toParts.length &&
      fromParts[k] === toParts[k]
    ) {
      k += 1;
    }
    const up = fromParts.length - k;
    const down = toParts.slice(k);
    const ups = [];
    for (let u = 0; u < up; u += 1) {
      ups.push("..");
    }
    const parts = ups.concat(down);
    if (parts.length === 0) {
      return ".";
    }
    if (parts[0] === "..") {
      return parts.join("/");
    }
    return "./" + parts.join("/");
  }

  function extFromImageMime(mime) {
    const m = String(mime || "").toLowerCase();
    if (m === "image/png") {
      return ".png";
    }
    if (m === "image/jpeg" || m === "image/jpg") {
      return ".jpg";
    }
    if (m === "image/gif") {
      return ".gif";
    }
    if (m === "image/webp") {
      return ".webp";
    }
    if (m === "image/svg+xml") {
      return ".svg";
    }
    return ".png";
  }

  function dispatchVaultFilesChanged() {
    try {
      window.dispatchEvent(new CustomEvent("bao-vault-files-changed"));
    } catch (_) {
      /* ignore */
    }
  }

  /**
   * @param {Blob} blob
   * @param {string} noteRel
   * @param {HTMLElement} el
   * @param {() => void} onChange
   * @param {string} fileName full filename including extension (under images/)
   * @returns {Promise<void>}
   */
  function insertImageFromFileBlob(blob, noteRel, el, onChange, fileName) {
    const noteParent = parentDirOfNote(noteRel);
    const vaultRel = noteParent
      ? noteParent + "/images/" + fileName
      : "images/" + fileName;
    return blobToBase64Payload(blob)
      .then(function (b64) {
        return window.bao.writeBinaryFile(vaultRel, b64);
      })
      .then(function () {
        const mdPath = vaultRelToMdPath(noteRel, vaultRel);
        const md = "![](" + mdPath + ")";
        el.focus();
        if (
          typeof document.queryCommandSupported === "function" &&
          document.queryCommandSupported("insertText")
        ) {
          document.execCommand("insertText", false, md);
        } else {
          const sel = window.getSelection();
          if (sel && sel.rangeCount) {
            const r = sel.getRangeAt(0);
            r.deleteContents();
            r.insertNode(document.createTextNode(md));
            r.collapse(false);
            sel.removeAllRanges();
            sel.addRange(r);
          }
        }
        convertFencedCodeBlocks(el);
        convertHorizontalRules(el);
        convertBlockquotes(el);
        convertTaskLists(el);
        convertOrderedLists(el);
        convertBulletLists(el);
        convertAtxHeadings(el);
        applyInlineMarkers(el);
        onChange();
        dispatchVaultFilesChanged();
      });
  }

  function pasteClipboardImageIntoEditor(blob, noteRel, el, onChange) {
    const ext = extFromImageMime(blob.type);
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").replace("T", "_");
    const fileName = "clipboard_" + stamp + ext;
    insertImageFromFileBlob(blob, noteRel, el, onChange, fileName).catch(
      function (err) {
        console.error("bao: clipboard image paste failed", err);
      }
    );
  }

  /**
   * @param {File[]} imageFiles
   * @param {string} noteRel
   * @param {HTMLElement} el
   * @param {() => void} onChange
   */
  function dropImagesIntoEditor(imageFiles, noteRel, el, onChange) {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").replace("T", "_");
    let chain = Promise.resolve();
    const vaultRels = [];
    imageFiles.forEach(function (file, idx) {
      chain = chain.then(function () {
        const ext = extFromImageMime(file.type);
        const fileName =
          "drop_" +
          stamp +
          (imageFiles.length > 1 ? "_" + idx : "") +
          ext;
        const noteParent = parentDirOfNote(noteRel);
        const vaultRel = noteParent
          ? noteParent + "/images/" + fileName
          : "images/" + fileName;
        return blobToBase64Payload(file).then(function (b64) {
          return window.bao.writeBinaryFile(vaultRel, b64);
        }).then(function () {
          vaultRels.push(vaultRel);
        });
      });
    });
    chain
      .then(function () {
        const md = vaultRels
          .map(function (vr) {
            return "![](" + vaultRelToMdPath(noteRel, vr) + ")";
          })
          .join("\n\n");
        el.focus();
        if (
          typeof document.queryCommandSupported === "function" &&
          document.queryCommandSupported("insertText")
        ) {
          document.execCommand("insertText", false, md);
        } else {
          const sel = window.getSelection();
          if (sel && sel.rangeCount) {
            const r = sel.getRangeAt(0);
            r.deleteContents();
            r.insertNode(document.createTextNode(md));
            r.collapse(false);
            sel.removeAllRanges();
            sel.addRange(r);
          }
        }
        convertFencedCodeBlocks(el);
        convertHorizontalRules(el);
        convertBlockquotes(el);
        convertTaskLists(el);
        convertOrderedLists(el);
        convertBulletLists(el);
        convertAtxHeadings(el);
        applyInlineMarkers(el);
        onChange();
        dispatchVaultFilesChanged();
      })
      .catch(function (err) {
        console.error("bao: drop images failed", err);
      });
  }

  function moveCaretToDropPoint(el, clientX, clientY) {
    const sel = window.getSelection();
    let range = null;
    if (typeof document.caretRangeFromPoint === "function") {
      range = document.caretRangeFromPoint(clientX, clientY);
    }
    if (range && el.contains(range.commonAncestorContainer)) {
      sel.removeAllRanges();
      sel.addRange(range);
      return true;
    }
    el.focus();
    return false;
  }

  function countTrailingChar(str, ch) {
    let n = 0;
    for (let i = str.length - 1; i >= 0 && str[i] === ch; i -= 1) {
      n += 1;
    }
    return n;
  }

  function isInInlineOrBlockCode(range, root) {
    let n = range.startContainer;
    if (n.nodeType === 3) {
      n = n.parentNode;
    }
    while (n && n !== root) {
      if (n.nodeType === 1) {
        const t = n.tagName;
        if (t === "PRE") {
          return true;
        }
        if (t === "CODE") {
          return true;
        }
      }
      n = n.parentNode;
    }
    return false;
  }

  /**
   * Wrap the current selection in markdown delimiters (e.g. *italic*, **bold**, `code`, list line).
   * Call from keydown when the user types a trigger with text selected.
   */
  function wrapSelectionWithDelimiters(range, sel, left, right) {
    const text = range.toString();
    range.deleteContents();
    const ins = left + text + right;
    const tn = document.createTextNode(ins);
    range.insertNode(tn);
    const r2 = document.createRange();
    r2.setStart(tn, ins.length);
    r2.collapse(true);
    sel.removeAllRanges();
    sel.addRange(r2);
  }

  /** Avoid `*` pairing right after list markers (`- `, `* `, `1. `) so bullets work. */
  function canAutoPairAsterisk(before) {
    if (/[-*]\s$/.test(before)) {
      return false;
    }
    if (/\d+\.\s$/.test(before)) {
      return false;
    }
    if (/>\s$/.test(before)) {
      return false;
    }
    return true;
  }

  window.wireLiveMarkdown = function (el, onChange) {
    el.setAttribute("spellcheck", "false");

    el.addEventListener(
      "blur",
      function () {
        // Exit all inline edits when editor loses focus
        if (exitInlineEdits()) {
          requestAnimationFrame(function () {
            runMarkdownPipeline();
          });
        }
      },
      true
    );

    el.addEventListener(
      "mousedown",
      function (e) {
        const t = e.target;
        if (
          t instanceof HTMLInputElement &&
          t.type === "checkbox" &&
          t.classList.contains("md-task-cb")
        ) {
          e.stopPropagation();
        }
        // Exit inline edits when clicking outside them
        if (!(t instanceof Element) || !t.closest("[data-md-editing]")) {
          if (exitInlineEdits()) {
            requestAnimationFrame(function () {
              runMarkdownPipeline();
            });
          }
        }
      },
      true
    );

    /** Selection + trigger key → wrap selection with matching delimiters. */
    el.addEventListener(
      "keydown",
      function (e) {
        if (e.defaultPrevented || e.isComposing) {
          return;
        }
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount || sel.isCollapsed) {
          return;
        }
        const range = sel.getRangeAt(0);
        if (!el.contains(range.startContainer)) {
          return;
        }
        if (isInInlineOrBlockCode(range, el)) {
          return;
        }

        // * with selection → italic; if already italic → upgrade to bold
        if (e.key === "*" && !e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          var insideEm = false;
          var _n = sel.anchorNode;
          while (_n && _n !== el) {
            if (_n.nodeType === 1 && (_n.tagName === "EM" || _n.tagName === "I")) {
              insideEm = true;
              break;
            }
            _n = _n.parentNode;
          }
          if (insideEm) {
            // Already italic → remove italic, apply bold (* + * = **)
            document.execCommand("italic");
            document.execCommand("bold");
          } else {
            document.execCommand("italic");
          }
          runMarkdownPipeline();
          onChange();
          return;
        }

        var wrapPairs = {
          "`": ["`", "`"],
          _: ["_", "_"],
          "(": ["(", ")"],
          "[": ["[", "]"],
          "{": ["{", "}"],
          '"': ['"', '"'],
          "'": ["'", "'"],
          "-": ["- ", ""],
        };
        var pair = wrapPairs[e.key];
        if (pair && !e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          wrapSelectionWithDelimiters(range, sel, pair[0], pair[1]);
          runMarkdownPipeline();
          onChange();
          return;
        }
      },
      true
    );

    /* List continuation on Enter: auto-create new list items (task or bullet). */
    el.addEventListener(
      "keydown",
      function (e) {
        if (e.key !== "Enter" || e.defaultPrevented) {
          return;
        }
        if (e.isComposing || e.shiftKey) {
          return;
        }
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount || !sel.isCollapsed) {
          return;
        }
        const range = sel.getRangeAt(0);
        if (!el.contains(range.startContainer)) {
          return;
        }
        let n = range.startContainer;
        if (n.nodeType === 3) {
          n = n.parentNode;
        }
        const li = n && n.closest && n.closest("li");
        if (!li || !el.contains(li)) {
          return;
        }
        /* Skip if inside code block within list. */
        const code = n.closest && n.closest("pre code");
        if (code && el.contains(code)) {
          return;
        }
        const ul = li.parentElement;
        if (!ul || (ul.tagName !== "UL" && ul.tagName !== "OL")) {
          return;
        }
        const isTask = ul.classList.contains("md-task-list");
        const isOrdered = ul.tagName === "OL";

        /* Get text content of the list item (for task items, just the body span). */
        let textContent = "";
        if (isTask) {
          const body = li.querySelector(".md-task-body");
          textContent = body ? body.textContent.replace(/\u200b/g, "").trim() : "";
        } else {
          textContent = li.textContent.replace(/\u200b/g, "").trim();
        }

        /* If list item is empty, exit the list by removing the item and creating a paragraph. */
        if (textContent === "") {
          e.preventDefault();
          const p = document.createElement("p");
          p.innerHTML = "<br>";
          ul.parentNode.insertBefore(p, ul.nextSibling);
          li.remove();
          /* If ul is now empty, remove it too. */
          if (ul.children.length === 0) {
            ul.remove();
          }
          placeCaretAtEndOfElement(p);
          onChange();
          return;
        }

        e.preventDefault();

        /* Create a new list item of the same type. */
        const newLi = document.createElement("li");
        if (isTask) {
          newLi.className = "md-task-item";
          const cb = document.createElement("input");
          cb.type = "checkbox";
          cb.className = "md-task-cb";
          cb.setAttribute("contenteditable", "false");
          newLi.appendChild(cb);
          const span = document.createElement("span");
          span.className = "md-task-body";
          span.textContent = "\u200b";
          newLi.appendChild(span);
          ul.insertBefore(newLi, li.nextSibling);
          placeCaretAtEndOfElement(span);
        } else if (isOrdered) {
          newLi.textContent = "\u200b";
          ul.insertBefore(newLi, li.nextSibling);
          placeCaretAtEndOfElement(newLi);
        } else {
          newLi.textContent = "\u200b";
          ul.insertBefore(newLi, li.nextSibling);
          placeCaretAtEndOfElement(newLi);
        }
        onChange();
      },
      true
    );

    /* Enter inside fenced code: insert newline, or exit on double-Enter at end. */
    el.addEventListener(
      "keydown",
      function (e) {
        if (e.key !== "Enter" || e.defaultPrevented) {
          return;
        }
        if (e.isComposing) {
          return;
        }
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) {
          return;
        }
        const range = sel.getRangeAt(0);
        if (!el.contains(range.startContainer)) {
          return;
        }
        let n = range.startContainer;
        if (n.nodeType === 3) {
          n = n.parentNode;
        }
        const code = n && n.closest && n.closest("pre code");
        if (!code || !el.contains(code)) {
          return;
        }
        e.preventDefault();

        /* Exit code block: if the last line is empty and caret is at the very end, break out. */
        var raw = code.textContent || "";
        /* Treat zero-width space as empty */
        raw = raw.replace(/\u200b/g, "");
        var lines = raw.split("\n");
        /* Compute caret offset inside the code element's text */
        var caretOff = 0;
        var found = false;
        (function walk(node) {
          if (found) return;
          if (node.nodeType === 3) {
            if (node === range.startContainer) {
              caretOff += range.startOffset;
              found = true;
            } else {
              caretOff += node.textContent.length;
            }
          } else {
            for (var ci = 0; ci < node.childNodes.length; ci++) {
              walk(node.childNodes[ci]);
              if (found) return;
            }
          }
        })(code);
        var atEnd = found && caretOff >= raw.length;
        var lastLineEmpty = lines.length > 0 && lines[lines.length - 1].trim() === "";

        if (atEnd && lastLineEmpty) {
          /* Remove trailing empty line from the code content */
          lines.pop();
          var newText = lines.join("\n");
          code.textContent = newText || "\u200b";
          /* Create a paragraph after the <pre> */
          var pre = code.closest("pre");
          var p = document.createElement("p");
          p.innerHTML = "<br>";
          pre.parentNode.insertBefore(p, pre.nextSibling);
          placeCaretAtEndOfElement(p);
          runMarkdownPipeline();
          return;
        }

        if (typeof document.queryCommandSupported === "function" && document.queryCommandSupported("insertText")) {
          document.execCommand("insertText", false, "\n");
        } else {
          range.insertNode(document.createTextNode("\n"));
          range.collapse(false);
          sel.removeAllRanges();
          sel.addRange(range);
        }
        runMarkdownPipeline();
      },
      true
    );

    /* Tab inside fenced code: insert two spaces (Shift+Tab outdents). */
    el.addEventListener(
      "keydown",
      function (e) {
        if (e.key !== "Tab" || e.defaultPrevented) {
          return;
        }
        if (e.metaKey || e.ctrlKey || e.altKey) {
          return;
        }
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) {
          return;
        }
        const range = sel.getRangeAt(0);
        if (!el.contains(range.startContainer)) {
          return;
        }
        let n = range.startContainer;
        if (n.nodeType === 3) {
          n = n.parentNode;
        }
        const code = n && n.closest && n.closest("pre code");
        if (!code || !el.contains(code)) {
          return;
        }
        e.preventDefault();
        if (e.shiftKey) {
          /* Outdent: remove up to 2 leading spaces from the current line */
          var tc = code.textContent || "";
          var off = 0;
          var fn = false;
          (function walk2(node) {
            if (fn) return;
            if (node.nodeType === 3) {
              if (node === range.startContainer) {
                off += range.startOffset;
                fn = true;
              } else {
                off += node.textContent.length;
              }
            } else {
              for (var ci = 0; ci < node.childNodes.length; ci++) {
                walk2(node.childNodes[ci]);
                if (fn) return;
              }
            }
          })(code);
          var lineStart = tc.lastIndexOf("\n", off - 1) + 1;
          var spaces = 0;
          while (spaces < 2 && lineStart + spaces < tc.length && tc[lineStart + spaces] === " ") {
            spaces++;
          }
          if (spaces > 0) {
            code.textContent = tc.slice(0, lineStart) + tc.slice(lineStart + spaces);
            /* Restore caret */
            var newOff = Math.max(lineStart, off - spaces);
            var rng = document.createRange();
            var walker = document.createTreeWalker(code, NodeFilter.SHOW_TEXT, null, false);
            var count = 0;
            var tn;
            while ((tn = walker.nextNode())) {
              if (count + tn.textContent.length >= newOff) {
                rng.setStart(tn, newOff - count);
                rng.collapse(true);
                break;
              }
              count += tn.textContent.length;
            }
            sel.removeAllRanges();
            sel.addRange(rng);
          }
        } else {
          /* Insert two spaces */
          if (typeof document.queryCommandSupported === "function" && document.queryCommandSupported("insertText")) {
            document.execCommand("insertText", false, "  ");
          } else {
            range.deleteContents();
            range.insertNode(document.createTextNode("  "));
            range.collapse(false);
            sel.removeAllRanges();
            sel.addRange(range);
          }
        }
        onChange();
      },
      true
    );

    /* Backspace in empty code block: remove the block and create a paragraph. */
    el.addEventListener(
      "keydown",
      function (e) {
        if (e.key !== "Backspace" || e.defaultPrevented) {
          return;
        }
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount || !sel.isCollapsed) {
          return;
        }
        const range = sel.getRangeAt(0);
        if (!el.contains(range.startContainer)) {
          return;
        }
        let n = range.startContainer;
        if (n.nodeType === 3) {
          n = n.parentNode;
        }
        const code = n && n.closest && n.closest("pre code");
        if (!code || !el.contains(code)) {
          return;
        }
        var raw = (code.textContent || "").replace(/\u200b/g, "");
        if (raw.length > 0) {
          return;
        }
        e.preventDefault();
        var pre = code.closest("pre");
        var p = document.createElement("p");
        p.innerHTML = "<br>";
        pre.parentNode.insertBefore(p, pre);
        pre.remove();
        placeCaretAtEndOfElement(p);
        runMarkdownPipeline();
      },
      true
    );

    /* Click on empty fenced code area: place caret inside the <code> element. */
    el.addEventListener(
      "click",
      function (e) {
        var target = e.target;
        if (!(target instanceof HTMLElement)) {
          return;
        }
        var pre = target.closest ? target.closest("pre.md-fenced-pre") : null;
        if (!pre || !el.contains(pre)) {
          return;
        }
        /* If click landed on the <code> already and it has content, let the browser handle it. */
        var codeEl = pre.querySelector("code");
        if (!codeEl) {
          return;
        }
        var rawText = (codeEl.textContent || "").replace(/\u200b/g, "");
        if (target === codeEl && rawText.length > 0) {
          return;
        }
        /* If click was on the toolbar, don't interfere. */
        if (target.closest(".md-code-toolbar")) {
          return;
        }
        /* Place caret inside the code element */
        var sel2 = window.getSelection();
        if (!sel2) {
          return;
        }
        var r = document.createRange();
        r.selectNodeContents(codeEl);
        r.collapse(false);
        sel2.removeAllRanges();
        sel2.addRange(r);
      },
      false
    );

    // --- Click-to-edit: reveal raw markdown for links & images ---

    function linkToMarkdownText(a) {
      var label = a.textContent || "";
      var href = a.getAttribute("data-md-href") || a.getAttribute("href") || "";
      return "[" + label + "](" + href + ")";
    }

    function vaultUrlToRel(vaultUrl) {
      try {
        var u = new URL(vaultUrl);
        var p = u.pathname;
        if (p.startsWith("//")) p = p.slice(1);
        if (p.startsWith("/")) p = p.slice(1);
        return p.split("/").map(decodeURIComponent).join("/");
      } catch (_) {
        return vaultUrl.replace(/^vault:\/\/localhost\//, "");
      }
    }

    function imageToMarkdownText(img) {
      var alt = img.getAttribute("alt") || "";
      var src = img.getAttribute("src") || "";
      // Convert vault:// URLs back to note-relative paths for editing
      if (src.indexOf("vault://") === 0) {
        var vaultRel = vaultUrlToRel(src);
        var noteRel = el.dataset.baoNoteRelPath || "";
        src = noteRel ? vaultRelToMdPath(noteRel, vaultRel) : vaultRel;
      }
      var w = img.getAttribute("data-md-w") || "";
      var h = img.getAttribute("data-md-h") || "";
      if (!w && img.style && img.style.width) {
        var px = parseInt(img.style.width, 10);
        if (!isNaN(px)) w = String(px);
      }
      if (!h && img.style && img.style.height && img.style.height !== "auto") {
        var px2 = parseInt(img.style.height, 10);
        if (!isNaN(px2)) h = String(px2);
      }
      var dim = "";
      if (w) {
        dim = "{" + w;
        if (h) dim += "x" + h;
        dim += "}";
      }
      return "![" + alt + "](" + src + ")" + dim;
    }

    function enterInlineEdit(element) {
      var md;
      if (element.tagName === "A") {
        md = linkToMarkdownText(element);
      } else if (element.tagName === "IMG") {
        md = imageToMarkdownText(element);
        // Clear image resize selection UI
        element.classList.remove("md-img-selected");
        var rh = document.querySelector(".md-img-resize-handle");
        if (rh) rh.remove();
      } else {
        return;
      }

      var span = document.createElement("span");
      span.setAttribute("data-md-editing", "true");
      span.className = "md-inline-editing";
      span.textContent = md;
      if (element.parentNode) {
        element.parentNode.replaceChild(span, element);
      }

      var sel = window.getSelection();
      if (sel) {
        var r = document.createRange();
        r.selectNodeContents(span);
        r.collapse(false);
        sel.removeAllRanges();
        sel.addRange(r);
      }
    }

    function exitInlineEdits() {
      var spans = el.querySelectorAll("[data-md-editing]");
      if (!spans.length) return false;

      var sel = window.getSelection();
      var caretSpan = null;
      if (sel && sel.rangeCount && sel.anchorNode) {
        for (var i = 0; i < spans.length; i++) {
          if (spans[i].contains(sel.anchorNode)) {
            caretSpan = spans[i];
            break;
          }
        }
      }

      var changed = false;
      for (var j = 0; j < spans.length; j++) {
        if (spans[j] === caretSpan) continue;
        var text = spans[j].textContent || "";
        var textNode = document.createTextNode(text);
        if (spans[j].parentNode) {
          spans[j].parentNode.replaceChild(textNode, spans[j]);
        }
        changed = true;
      }
      return changed;
    }

    el.addEventListener(
      "dblclick",
      function (e) {
        var target = e.target;
        if (!(target instanceof HTMLElement) || !el.contains(target)) return;

        var linkEl = target.closest ? target.closest("a") : null;
        if (linkEl && el.contains(linkEl)) {
          e.preventDefault();
          e.stopImmediatePropagation();
          exitInlineEdits();
          enterInlineEdit(linkEl);
          onChange();
          return;
        }
        if (target.tagName === "IMG") {
          e.preventDefault();
          e.stopImmediatePropagation();
          exitInlineEdits();
          enterInlineEdit(target);
          onChange();
          return;
        }
      },
      true
    );

    el.addEventListener(
      "keydown",
      function (e) {
        if (e.key === "Escape") {
          var spans = el.querySelectorAll("[data-md-editing]");
          if (spans.length) {
            e.preventDefault();
            for (var i = 0; i < spans.length; i++) {
              var text = spans[i].textContent || "";
              var tn = document.createTextNode(text);
              if (spans[i].parentNode) {
                spans[i].parentNode.replaceChild(tn, spans[i]);
              }
            }
            runMarkdownPipeline();
          }
        }
      },
      true
    );

    function runMarkdownPipeline() {
      exitInlineEdits();
      convertFencedCodeBlocks(el);
      convertHorizontalRules(el);
      convertBlockquotes(el);
      convertTaskLists(el);
      convertOrderedLists(el);
      convertBulletLists(el);
      convertAtxHeadings(el);
      applyInlineMarkers(el);
      onChange();
    }

    el.addEventListener(
      "beforeinput",
      function (e) {
        if (e.defaultPrevented) {
          return;
        }
        if (e.inputType !== "insertText" || !e.data) {
          return;
        }
        if (e.isComposing) {
          return;
        }
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) {
          return;
        }
        const range = sel.getRangeAt(0);
        if (!el.contains(range.startContainer)) {
          return;
        }
        if (isInInlineOrBlockCode(range, el)) {
          return;
        }

        if (!sel.isCollapsed) {
          return;
        }

        const sc = range.startContainer;
        var textNode, offset;
        if (sc.nodeType === 3) {
          textNode = sc;
          offset = range.startOffset;
        } else {
          /* Cursor is inside an element (e.g. empty <div>); create a text node so we can pair. */
          textNode = document.createTextNode("");
          if (sc.childNodes.length === 0) {
            sc.appendChild(textNode);
          } else if (range.startOffset < sc.childNodes.length) {
            sc.insertBefore(textNode, sc.childNodes[range.startOffset]);
          } else {
            sc.appendChild(textNode);
          }
          offset = 0;
          range.setStart(textNode, 0);
          range.collapse(true);
          sel.removeAllRanges();
          sel.addRange(range);
        }
        const full = textNode.textContent || "";
        const before = full.slice(0, offset);
        const after = full.slice(offset);

        /* --- Auto-pair: symmetric pairs (quotes / symbols) --- */
        var symmetricPairs = { "`": "`", "*": "*", _: "_", '"': '"', "'": "'" };
        var symClose = symmetricPairs[e.data];
        if (symClose) {
          /* Special case: ``` code fence from three consecutive backticks */
          if (e.data === "`") {
            var btTrail = countTrailingChar(before, "`");
            if (btTrail === 2) {
              e.preventDefault();
              var nb = before.slice(0, -2);
              var ins = "```\n\n```";
              textNode.textContent = nb + ins + after;
              var caret = nb.length + 4;
              range.setStart(textNode, caret);
              range.collapse(true);
              sel.removeAllRanges();
              sel.addRange(range);
              runMarkdownPipeline();
              return;
            }
          }
          /* Skip over existing closing char */
          if (after.length > 0 && after[0] === symClose) {
            e.preventDefault();
            range.setStart(textNode, offset + 1);
            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);
            return;
          }
          /* Don't auto-pair * or _ right after list markers */
          if ((e.data === "*" || e.data === "_") && !canAutoPairAsterisk(before)) {
            return;
          }
          e.preventDefault();
          textNode.textContent = before + e.data + symClose + after;
          range.setStart(textNode, offset + 1);
          range.collapse(true);
          sel.removeAllRanges();
          sel.addRange(range);
          runMarkdownPipeline();
          return;
        }

        /* --- Auto-pair: bracket pairs --- */
        var bracketPairs = { "(": ")", "[": "]", "{": "}" };
        var bracketClose = bracketPairs[e.data];
        if (bracketClose) {
          e.preventDefault();
          textNode.textContent = before + e.data + bracketClose + after;
          range.setStart(textNode, offset + 1);
          range.collapse(true);
          sel.removeAllRanges();
          sel.addRange(range);
          runMarkdownPipeline();
          return;
        }

        /* --- Skip over closing bracket --- */
        var closingBrackets = { ")": true, "]": true, "}": true };
        if (closingBrackets[e.data] && after.length > 0 && after[0] === e.data) {
          e.preventDefault();
          range.setStart(textNode, offset + 1);
          range.collapse(true);
          sel.removeAllRanges();
          sel.addRange(range);
          return;
        }
      },
      true
    );

    el.addEventListener("input", () => {
      convertFencedCodeBlocks(el);
      convertHorizontalRules(el);
      convertBlockquotes(el);
      convertTaskLists(el);
      convertOrderedLists(el);
      convertBulletLists(el);
      convertAtxHeadings(el);
      applyInlineMarkers(el);
      onChange();
    });

    el.addEventListener("paste", (e) => {
      const noteRel = el.dataset.baoNoteRelPath;
      if (
        noteRel &&
        window.bao &&
        typeof window.bao.writeBinaryFile === "function"
      ) {
        const imgBlob = clipboardImageBlobFromDataTransfer(e.clipboardData);
        if (imgBlob) {
          e.preventDefault();
          pasteClipboardImageIntoEditor(imgBlob, noteRel, el, onChange);
          return;
        }
      }

      e.preventDefault();
      const html = e.clipboardData.getData("text/html");
      const text = e.clipboardData.getData("text/plain") || "";

      if (
        html &&
        typeof window.pasteHtmlToMarkdown === "function" &&
        typeof window.parseMarkdownToHtml === "function"
      ) {
        try {
          const md = window.pasteHtmlToMarkdown(html);
          if (md && md.replace(/\s/g, "").length > 0) {
            const noteRelForImages = el.dataset.baoNoteRelPath;
            if (noteRelForImages && /!\[[^\]]*\]\(https?:\/\//.test(md)) {
              downloadRemoteImagesInMarkdown(md, noteRelForImages)
                .then(function (localMd) {
                  var rendered = window.parseMarkdownToHtml(localMd);
                  if (
                    rendered &&
                    typeof document.queryCommandSupported === "function" &&
                    document.queryCommandSupported("insertHTML")
                  ) {
                    el.focus();
                    document.execCommand("insertHTML", false, rendered);
                  }
                  convertFencedCodeBlocks(el);
                  convertHorizontalRules(el);
                  convertBlockquotes(el);
                  convertTaskLists(el);
                  convertOrderedLists(el);
                  convertBulletLists(el);
                  convertAtxHeadings(el);
                  applyInlineMarkers(el);
                  onChange();
                  dispatchVaultFilesChanged();
                })
                .catch(function (err) {
                  console.error("bao: remote image download failed", err);
                });
              return;
            }
            const rendered = window.parseMarkdownToHtml(md);
            if (
              rendered &&
              typeof document.queryCommandSupported === "function" &&
              document.queryCommandSupported("insertHTML")
            ) {
              document.execCommand("insertHTML", false, rendered);
              convertFencedCodeBlocks(el);
              convertHorizontalRules(el);
              convertBlockquotes(el);
              convertTaskLists(el);
              convertOrderedLists(el);
              convertBulletLists(el);
              convertAtxHeadings(el);
              applyInlineMarkers(el);
              onChange();
              return;
            }
          }
        } catch (_) {
          /* fall through to plain text */
        }
      }

      if (typeof document.queryCommandSupported === "function" && document.queryCommandSupported("insertText")) {
        document.execCommand("insertText", false, text);
      } else {
        const sel = window.getSelection();
        if (sel && sel.rangeCount) {
          const r = sel.getRangeAt(0);
          r.deleteContents();
          r.insertNode(document.createTextNode(text));
          r.collapse(false);
          sel.removeAllRanges();
          sel.addRange(r);
        }
      }
      convertFencedCodeBlocks(el);
      convertHorizontalRules(el);
      convertBlockquotes(el);
      convertTaskLists(el);
      convertOrderedLists(el);
      convertBulletLists(el);
      convertAtxHeadings(el);
      applyInlineMarkers(el);
      onChange();
    });

    el.addEventListener("dragenter", function (e) {
      e.preventDefault();
    });

    el.addEventListener("dragover", function (e) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    });

    el.addEventListener("drop", function (e) {
      e.preventDefault();
      moveCaretToDropPoint(el, e.clientX, e.clientY);

      const noteRel = el.dataset.baoNoteRelPath;
      const dt = e.dataTransfer;
      const files = dt.files
        ? Array.prototype.slice.call(dt.files)
        : [];
      const imageFiles = files.filter(function (f) {
        return f.type && f.type.indexOf("image/") === 0;
      });

      if (
        imageFiles.length &&
        noteRel &&
        window.bao &&
        typeof window.bao.writeBinaryFile === "function"
      ) {
        if (imageFiles.length === 1) {
          const ext = extFromImageMime(imageFiles[0].type);
          const stamp = new Date()
            .toISOString()
            .replace(/[:.]/g, "-")
            .replace("T", "_");
          const fileName = "drop_" + stamp + ext;
          insertImageFromFileBlob(
            imageFiles[0],
            noteRel,
            el,
            onChange,
            fileName
          ).catch(function (err) {
            console.error("bao: drop image failed", err);
          });
        } else {
          dropImagesIntoEditor(imageFiles, noteRel, el, onChange);
        }
        return;
      }

      const text = dt.getData("text/plain") || "";
      const html = dt.getData("text/html") || "";

      if (
        html &&
        typeof window.pasteHtmlToMarkdown === "function" &&
        typeof window.parseMarkdownToHtml === "function"
      ) {
        try {
          const md = window.pasteHtmlToMarkdown(html);
          if (md && md.replace(/\s/g, "").length > 0) {
            const noteRelForImages = el.dataset.baoNoteRelPath;
            if (noteRelForImages && /!\[[^\]]*\]\(https?:\/\//.test(md)) {
              downloadRemoteImagesInMarkdown(md, noteRelForImages)
                .then(function (localMd) {
                  var rendered = window.parseMarkdownToHtml(localMd);
                  if (
                    rendered &&
                    typeof document.queryCommandSupported === "function" &&
                    document.queryCommandSupported("insertHTML")
                  ) {
                    el.focus();
                    document.execCommand("insertHTML", false, rendered);
                  }
                  runMarkdownPipeline();
                  dispatchVaultFilesChanged();
                })
                .catch(function (err) {
                  console.error("bao: remote image download failed", err);
                });
              return;
            }
            const rendered = window.parseMarkdownToHtml(md);
            if (
              rendered &&
              typeof document.queryCommandSupported === "function" &&
              document.queryCommandSupported("insertHTML")
            ) {
              el.focus();
              document.execCommand("insertHTML", false, rendered);
              runMarkdownPipeline();
              return;
            }
          }
        } catch (_) {
          /* fall through */
        }
      }

      if (text) {
        el.focus();
        if (
          typeof document.queryCommandSupported === "function" &&
          document.queryCommandSupported("insertText")
        ) {
          document.execCommand("insertText", false, text);
        } else {
          const sel = window.getSelection();
          if (sel && sel.rangeCount) {
            const r = sel.getRangeAt(0);
            r.deleteContents();
            r.insertNode(document.createTextNode(text));
            r.collapse(false);
            sel.removeAllRanges();
            sel.addRange(r);
          }
        }
        runMarkdownPipeline();
        return;
      }
    });
  };
})();
