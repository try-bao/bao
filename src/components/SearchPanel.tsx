import { useCallback, useEffect, useId, useRef, useState } from "react";
import { getApi } from "../lib/api";
import { useAppStore } from "../store/useAppStore";
import * as note from "../lib/noteUtils";

export interface SearchMatch {
  relPath: string;
  lineNumber: number;
  lineContent: string;
  matchStart: number;
  matchEnd: number;
}

export interface SearchResult {
  relPath: string;
  matches: SearchMatch[];
}

export function SearchPanel() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [expandedFiles, setExpandedFiles] = useState<Record<string, boolean>>(
    {}
  );
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchId = useId();
  const tryOpenFile = useAppStore((s) => s.tryOpenFile);
  const setSearchHighlightQuery = useAppStore((s) => s.setSearchHighlightQuery);

  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const api = getApi();
      const searchResults = await (api as any).searchInVault(q);
      setResults(searchResults);
      // Auto-expand all files with results
      const expanded: Record<string, boolean> = {};
      for (const r of searchResults) {
        expanded[r.relPath] = true;
      }
      setExpandedFiles(expanded);
    } catch (err) {
      console.error("Search error:", err);
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      doSearch(query);
      setSearchHighlightQuery(query);
    }, 300);
    return () => clearTimeout(timeout);
  }, [query, doSearch, setSearchHighlightQuery]);

  useEffect(() => {
    return () => {
      setSearchHighlightQuery("");
    };
  }, [setSearchHighlightQuery]);

  const toggleFile = (relPath: string) => {
    setExpandedFiles((prev) => ({ ...prev, [relPath]: !prev[relPath] }));
  };

  const handleMatchClick = async (match: SearchMatch) => {
    await tryOpenFile(match.relPath);
    // Signal the editor to scroll to the line
    window.dispatchEvent(
      new CustomEvent("bao-goto-line", {
        detail: { lineNumber: match.lineNumber },
      })
    );
  };

  const totalMatches = results.reduce((sum, r) => sum + r.matches.length, 0);

  return (
    <div className="search-panel">
      <div className="search-panel-input-wrap">
        <label htmlFor={searchId} className="sr-only">
          Search in documents
        </label>
        <svg
          className="search-panel-input-icon"
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          ref={searchInputRef}
          id={searchId}
          type="search"
          className="search-panel-input"
          placeholder="Search in documents…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
      </div>

      <div className="search-panel-results">
        {searching && (
          <div className="search-panel-status">Searching…</div>
        )}
        {!searching && query && results.length === 0 && (
          <div className="search-panel-status">No results found</div>
        )}
        {!searching && results.length > 0 && (
          <div className="search-panel-status">
            {totalMatches} result{totalMatches !== 1 ? "s" : ""} in{" "}
            {results.length} file{results.length !== 1 ? "s" : ""}
          </div>
        )}

        {results.map((result) => (
          <div key={result.relPath} className="search-result-file">
            <button
              type="button"
              className="search-result-file-header"
              onClick={() => toggleFile(result.relPath)}
            >
              <span className="search-result-toggle">
                {expandedFiles[result.relPath] ? "▾" : "▸"}
              </span>
              <span className="search-result-file-info">
                {result.relPath.includes("/") && (
                  <span className="search-result-filepath">
                    {result.relPath.substring(
                      0,
                      result.relPath.lastIndexOf("/")
                    )}
                  </span>
                )}
                <span className="search-result-filename">
                  {note.basenameNoMd(result.relPath)}
                </span>
              </span>
              <span className="search-result-count">
                {result.matches.length}
              </span>
            </button>

            {expandedFiles[result.relPath] && (
              <ul className="search-result-matches">
                {result.matches.map((match, idx) => (
                  <li key={idx}>
                    <button
                      type="button"
                      className="search-result-match"
                      onClick={() => handleMatchClick(match)}
                    >
                      <span className="search-result-line-num">
                        {match.lineNumber}
                      </span>
                      <span className="search-result-line-content">
                        {match.lineContent.substring(0, match.matchStart)}
                        <mark className="search-highlight">
                          {match.lineContent.substring(
                            match.matchStart,
                            match.matchEnd
                          )}
                        </mark>
                        {match.lineContent.substring(match.matchEnd)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
