import { useEffect, useId, useRef, useState } from "react";
import { openSidebarContextMenuFromEvent } from "../lib/sidebarContextMenu";
import { FileTree } from "./FileTree";
import { SearchPanel } from "./SearchPanel";
import { useAppStore } from "../store/useAppStore";
import { loadTagIndex } from "../lib/tagIndexOps";

type SidebarMode = "files" | "search" | "tags";

export function Sidebar() {
  const sidebarCollapsed = useAppStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);
  const [mode, setMode] = useState<SidebarMode>("files");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagQuery, setTagQuery] = useState("");
  const [allTags, setAllTags] = useState<string[]>([]);
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false);
  const [tagHighlight, setTagHighlight] = useState(-1);
  const tagInputRef = useRef<HTMLInputElement>(null);
  const tagFilterId = useId();

  useEffect(() => {
    loadTagIndex().then((index) => {
      setAllTags(Object.keys(index).sort());
    });
  }, []);

  const availableTags = allTags.filter((t) => !selectedTags.includes(t));

  const filteredTags = tagQuery.trim()
    ? availableTags.filter((t) => t.toLowerCase().includes(tagQuery.toLowerCase()))
    : availableTags;

  const selectTag = (tag: string) => {
    if (!selectedTags.includes(tag)) {
      setSelectedTags((prev) => [...prev, tag]);
    }
    setTagQuery("");
    setTagDropdownOpen(false);
    setTagHighlight(-1);
    tagInputRef.current?.focus();
  };

  const removeTag = (tag: string) => {
    setSelectedTags((prev) => prev.filter((t) => t !== tag));
    tagInputRef.current?.focus();
  };

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !tagQuery && selectedTags.length > 0) {
      setSelectedTags((prev) => prev.slice(0, -1));
      return;
    }
    if (!tagDropdownOpen && filteredTags.length > 0 && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      setTagDropdownOpen(true);
      setTagHighlight(0);
      e.preventDefault();
      return;
    }
    if (!tagDropdownOpen) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setTagHighlight((h) => (h + 1) % filteredTags.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setTagHighlight((h) => (h <= 0 ? filteredTags.length - 1 : h - 1));
    } else if (e.key === "Enter" && tagHighlight >= 0 && tagHighlight < filteredTags.length) {
      e.preventDefault();
      selectTag(filteredTags[tagHighlight]);
    } else if (e.key === "Escape") {
      setTagDropdownOpen(false);
      setTagHighlight(-1);
    }
  };

  useEffect(() => {
    if (mode === "tags") {
      tagInputRef.current?.focus();
    }
  }, [mode]);

  return (
    <div className="sidebar-shell">
      <aside
        className="sidebar"
        id="sidebar-panel"
        aria-label="Vault"
        onContextMenu={mode !== "search" ? openSidebarContextMenuFromEvent : undefined}
      >
        <div className="sidebar-topbar">
          <div className="sidebar-brand">
            <img src="/logo.png" alt="Bao" className="sidebar-brand-logo" draggable={false} />
            <span className="sidebar-brand-text">BAO</span>
          </div>
          <div className="sidebar-mode-btns">
            <button
              type="button"
              className={`sidebar-mode-btn${mode === "files" ? " is-active" : ""}`}
              onClick={() => setMode("files")}
              title="Browse files"
              aria-pressed={mode === "files"}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/><polyline points="14 2 14 8 20 8"/><path d="M9 2H5a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h1" opacity="0.5"/></svg>
            </button>
            <button
              type="button"
              className={`sidebar-mode-btn${mode === "search" ? " is-active" : ""}`}
              onClick={() => setMode("search")}
              title="Search in documents"
              aria-pressed={mode === "search"}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </button>
            <button
              type="button"
              className={`sidebar-mode-btn${mode === "tags" ? " is-active" : ""}`}
              onClick={() => setMode("tags")}
              title="Filter by tag"
              aria-pressed={mode === "tags"}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
            </button>
          </div>
        </div>

        {mode === "search" ? (
          <SearchPanel />
        ) : mode === "tags" ? (
          <div className="tag-filter-panel">
            <div className="search-panel-input-wrap tag-input-wrap">
              <label htmlFor={tagFilterId} className="sr-only">
                Filter by tag
              </label>
              {selectedTags.map((tag) => (
                <span key={tag} className="tag-chip">
                  <span className="tag-chip-hash">#</span>{tag}
                  <button
                    type="button"
                    className="tag-chip-remove"
                    onClick={() => removeTag(tag)}
                    aria-label={`Remove ${tag}`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </span>
              ))}
              <input
                ref={tagInputRef}
                id={tagFilterId}
                type="text"
                className="search-panel-input"
                placeholder={selectedTags.length ? "" : "Filter by tag…"}
                value={tagQuery}
                onChange={(e) => {
                  setTagQuery(e.target.value);
                  setTagDropdownOpen(true);
                  setTagHighlight(0);
                }}
                onFocus={() => setTagDropdownOpen(true)}
                onBlur={() => setTimeout(() => setTagDropdownOpen(false), 150)}
                onKeyDown={handleTagKeyDown}
                autoComplete="off"
                spellCheck={false}
              />
              {(selectedTags.length > 0 || tagQuery) && (
                <button
                  type="button"
                  className="tag-filter-clear"
                  onClick={() => { setSelectedTags([]); setTagQuery(""); tagInputRef.current?.focus(); }}
                  aria-label="Clear all tags"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              )}
            </div>
            {tagDropdownOpen && filteredTags.length > 0 && (
              <ul className="tag-autocomplete-list" role="listbox">
                {filteredTags.map((tag, i) => (
                  <li
                    key={tag}
                    role="option"
                    aria-selected={i === tagHighlight}
                    className={`tag-autocomplete-item${i === tagHighlight ? " is-highlighted" : ""}`}
                    onMouseDown={(e) => { e.preventDefault(); selectTag(tag); }}
                    onMouseEnter={() => setTagHighlight(i)}
                  >
                    <span className="tag-autocomplete-hash">#</span>
                    {tag}
                  </li>
                ))}
              </ul>
            )}
            {selectedTags.length > 0 ? (
              <FileTree vaultSearchQuery="" tagFilter={selectedTags} />
            ) : !tagDropdownOpen ? (
              <div className="search-panel-status">Type or select a tag to filter documents</div>
            ) : null}
          </div>
        ) : (
          <FileTree vaultSearchQuery="" tagFilter="" />
        )}
      </aside>
      <button
        type="button"
        className="sidebar-edge-toggle"
        aria-expanded={!sidebarCollapsed}
        aria-controls="sidebar-panel"
        title={sidebarCollapsed ? "Expand file list" : "Collapse file list"}
        onClick={() => toggleSidebar()}
      >
        <svg
          className="sidebar-edge-icon"
          xmlns="http://www.w3.org/2000/svg"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>
    </div>
  );
}
