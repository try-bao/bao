import { useAppStore } from "../store/useAppStore";

export function ShortcutsPage() {
  const shortcutsOpen = useAppStore((s) => s.shortcutsOpen);
  const closeShortcuts = useAppStore((s) => s.closeShortcuts);

  return (
    <section
      className={`shortcuts-page${shortcutsOpen ? "" : " hidden"}`}
      aria-label="Keyboard shortcuts"
      aria-hidden={!shortcutsOpen}
    >
      <header className="settings-page-header">
        <div className="settings-page-header-inner">
          <h1 className="settings-page-title">Keyboard shortcuts</h1>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => closeShortcuts()}
          >
            Done
          </button>
        </div>
      </header>
      <div className="settings-page-body shortcuts-page-body">
        <p className="settings-text shortcuts-intro">
          Modifier keys are shown for macOS (<kbd className="kbd">⌘</kbd>) and
          Windows / Linux (<kbd className="kbd">Ctrl</kbd>).
        </p>
        <section className="settings-group" aria-labelledby="shortcuts-general">
          <h2 className="settings-group-title" id="shortcuts-general">
            General
          </h2>
          <ul className="shortcuts-list">
            <li className="shortcuts-row">
              <span className="shortcuts-desc">Save current note</span>
              <span className="shortcuts-keys">
                <kbd className="kbd">⌘</kbd>
                <kbd className="kbd">S</kbd> / <kbd className="kbd">Ctrl</kbd>
                <kbd className="kbd">S</kbd>
              </span>
            </li>
            <li className="shortcuts-row">
              <span className="shortcuts-desc">Close current tab</span>
              <span className="shortcuts-keys">
                <kbd className="kbd">⌘</kbd>
                <kbd className="kbd">W</kbd> / <kbd className="kbd">Ctrl</kbd>
                <kbd className="kbd">W</kbd>
              </span>
            </li>
            <li className="shortcuts-row">
              <span className="shortcuts-desc">New document</span>
              <span className="shortcuts-keys">
                <kbd className="kbd">⌘</kbd>
                <kbd className="kbd">T</kbd> / <kbd className="kbd">Ctrl</kbd>
                <kbd className="kbd">T</kbd>
              </span>
            </li>
            <li className="shortcuts-row">
              <span className="shortcuts-desc">
                Toggle file list (sidebar, when editor not focused)
              </span>
              <span className="shortcuts-keys">
                <kbd className="kbd">⌘</kbd>
                <kbd className="kbd">B</kbd> / <kbd className="kbd">Ctrl</kbd>
                <kbd className="kbd">B</kbd>
              </span>
            </li>
            <li className="shortcuts-row">
              <span className="shortcuts-desc">Open settings</span>
              <span className="shortcuts-keys">
                <kbd className="kbd">⌘</kbd>
                <kbd className="kbd">,</kbd> / <kbd className="kbd">Ctrl</kbd>
                <kbd className="kbd">,</kbd>
              </span>
            </li>
            <li className="shortcuts-row">
              <span className="shortcuts-desc">
                Close assistant, settings, or this screen
              </span>
              <span className="shortcuts-keys">
                <kbd className="kbd">Esc</kbd>
              </span>
            </li>
          </ul>
        </section>
        <section className="settings-group" aria-labelledby="shortcuts-notes">
          <h2 className="settings-group-title" id="shortcuts-notes">
            Notes &amp; tree
          </h2>
          <ul className="shortcuts-list">
            <li className="shortcuts-row">
              <span className="shortcuts-desc">Toggle assistant panel</span>
              <span className="shortcuts-keys">
                <kbd className="kbd">⌘</kbd>
                <kbd className="kbd">⇧</kbd>
                <kbd className="kbd">C</kbd> / <kbd className="kbd">Ctrl</kbd>
                <kbd className="kbd">⇧</kbd>
                <kbd className="kbd">C</kbd>
              </span>
            </li>
            <li className="shortcuts-row">
              <span className="shortcuts-desc">
                Rename selected item (sidebar)
              </span>
              <span className="shortcuts-keys">
                <kbd className="kbd">F2</kbd>
              </span>
            </li>
            <li className="shortcuts-row">
              <span className="shortcuts-desc">
                Copy path of selected note (sidebar, not in editor)
              </span>
              <span className="shortcuts-keys">
                <kbd className="kbd">⌘</kbd>
                <kbd className="kbd">C</kbd> / <kbd className="kbd">Ctrl</kbd>
                <kbd className="kbd">C</kbd>
              </span>
            </li>
            <li className="shortcuts-row">
              <span className="shortcuts-desc">
                Duplicate copied note in same folder
              </span>
              <span className="shortcuts-keys">
                <kbd className="kbd">⌘</kbd>
                <kbd className="kbd">V</kbd> / <kbd className="kbd">Ctrl</kbd>
                <kbd className="kbd">V</kbd>
              </span>
            </li>
          </ul>
        </section>
        <section className="settings-group" aria-labelledby="shortcuts-md">
          <h2 className="settings-group-title" id="shortcuts-md">
            Markdown (note editor)
          </h2>
          <p className="settings-text shortcuts-intro">
            Typing triggers live transforms (for example{" "}
            <kbd className="kbd">#</kbd> + Space for headings,{" "}
            <kbd className="kbd">-</kbd> + Space for lists). Use the shortcuts
            below to apply formatting with the keyboard. Requires focus in the
            note editor.
          </p>
          <ul className="shortcuts-list">
            <li className="shortcuts-row">
              <span className="shortcuts-desc">Bold</span>
              <span className="shortcuts-keys">
                <kbd className="kbd">⌘</kbd>
                <kbd className="kbd">B</kbd> / <kbd className="kbd">Ctrl</kbd>
                <kbd className="kbd">B</kbd>
              </span>
            </li>
            <li className="shortcuts-row">
              <span className="shortcuts-desc">Italic</span>
              <span className="shortcuts-keys">
                <kbd className="kbd">⌘</kbd>
                <kbd className="kbd">I</kbd> / <kbd className="kbd">Ctrl</kbd>
                <kbd className="kbd">I</kbd>
              </span>
            </li>
            <li className="shortcuts-row">
              <span className="shortcuts-desc">Inline code</span>
              <span className="shortcuts-keys">
                <kbd className="kbd">⌘</kbd>
                <kbd className="kbd">`</kbd> / <kbd className="kbd">Ctrl</kbd>
                <kbd className="kbd">`</kbd>
              </span>
            </li>
            <li className="shortcuts-row">
              <span className="shortcuts-desc">Insert link</span>
              <span className="shortcuts-keys">
                <kbd className="kbd">⌘</kbd>
                <kbd className="kbd">K</kbd> / <kbd className="kbd">Ctrl</kbd>
                <kbd className="kbd">K</kbd>
              </span>
            </li>
            <li className="shortcuts-row">
              <span className="shortcuts-desc">Add note on selection</span>
              <span className="shortcuts-keys">
                <kbd className="kbd">⌘</kbd>
                <kbd className="kbd">⌥</kbd>
                <kbd className="kbd">M</kbd> / <kbd className="kbd">Ctrl</kbd>
                <kbd className="kbd">Alt</kbd>
                <kbd className="kbd">M</kbd>
              </span>
            </li>
            <li className="shortcuts-row">
              <span className="shortcuts-desc">Strikethrough</span>
              <span className="shortcuts-keys">
                <kbd className="kbd">⌘</kbd>
                <kbd className="kbd">⇧</kbd>
                <kbd className="kbd">X</kbd> / <kbd className="kbd">Ctrl</kbd>
                <kbd className="kbd">⇧</kbd>
                <kbd className="kbd">X</kbd>
              </span>
            </li>
            <li className="shortcuts-row">
              <span className="shortcuts-desc">Bulleted list</span>
              <span className="shortcuts-keys">
                <kbd className="kbd">⌘</kbd>
                <kbd className="kbd">⇧</kbd>
                <kbd className="kbd">8</kbd> / <kbd className="kbd">Ctrl</kbd>
                <kbd className="kbd">⇧</kbd>
                <kbd className="kbd">8</kbd>
              </span>
            </li>
            <li className="shortcuts-row">
              <span className="shortcuts-desc">Numbered list</span>
              <span className="shortcuts-keys">
                <kbd className="kbd">⌘</kbd>
                <kbd className="kbd">⇧</kbd>
                <kbd className="kbd">7</kbd> / <kbd className="kbd">Ctrl</kbd>
                <kbd className="kbd">⇧</kbd>
                <kbd className="kbd">7</kbd>
              </span>
            </li>
            <li className="shortcuts-row">
              <span className="shortcuts-desc">Block quote</span>
              <span className="shortcuts-keys">
                <kbd className="kbd">⌘</kbd>
                <kbd className="kbd">⇧</kbd>
                <kbd className="kbd">9</kbd> / <kbd className="kbd">Ctrl</kbd>
                <kbd className="kbd">⇧</kbd>
                <kbd className="kbd">9</kbd>
              </span>
            </li>
            <li className="shortcuts-row">
              <span className="shortcuts-desc">Horizontal rule</span>
              <span className="shortcuts-keys">
                <kbd className="kbd">⌘</kbd>
                <kbd className="kbd">⇧</kbd>
                <kbd className="kbd">-</kbd> / <kbd className="kbd">Ctrl</kbd>
                <kbd className="kbd">⇧</kbd>
                <kbd className="kbd">-</kbd>
              </span>
            </li>
            <li className="shortcuts-row">
              <span className="shortcuts-desc">Heading 1–6</span>
              <span className="shortcuts-keys">
                <kbd className="kbd">⌘</kbd>
                <kbd className="kbd">⌥</kbd>
                <kbd className="kbd">1</kbd>–<kbd className="kbd">6</kbd> /{" "}
                <kbd className="kbd">Ctrl</kbd>
                <kbd className="kbd">Alt</kbd>
                <kbd className="kbd">1</kbd>–<kbd className="kbd">6</kbd>
              </span>
            </li>
            <li className="shortcuts-row">
              <span className="shortcuts-desc">
                Insert task list prefix (<code>- [ ] </code>)
              </span>
              <span className="shortcuts-keys">
                <kbd className="kbd">⌘</kbd>
                <kbd className="kbd">⇧</kbd>
                <kbd className="kbd">L</kbd> / <kbd className="kbd">Ctrl</kbd>
                <kbd className="kbd">⇧</kbd>
                <kbd className="kbd">L</kbd>
              </span>
            </li>
          </ul>
        </section>
      </div>
    </section>
  );
}
