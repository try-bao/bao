import { useAppStore } from "../store/useAppStore";

export function SettingsPage() {
  const settingsOpen = useAppStore((s) => s.settingsOpen);
  const closeSettings = useAppStore((s) => s.closeSettings);
  const vaultPathDisplay = useAppStore((s) => s.vaultPathDisplay);
  const changeVault = useAppStore((s) => s.changeVault);
  const closeVault = useAppStore((s) => s.closeVault);
  const sidebarCollapsed = useAppStore((s) => s.sidebarCollapsed);
  const setSidebarCollapsed = useAppStore((s) => s.setSidebarCollapsed);
  const chatOpen = useAppStore((s) => s.chatOpen);
  const setChatOpen = useAppStore((s) => s.setChatOpen);

  return (
    <section
      className={`settings-page${settingsOpen ? "" : " hidden"}`}
      aria-label="Settings"
      aria-hidden={!settingsOpen}
    >
      <header className="settings-page-header">
        <div className="settings-page-header-inner">
          <h1 className="settings-page-title">Settings</h1>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => closeSettings()}
          >
            Done
          </button>
        </div>
      </header>
      <div className="settings-page-body">
        <section className="settings-group" aria-labelledby="settings-vault-heading">
          <h2 className="settings-group-title" id="settings-vault-heading">
            Vault
          </h2>
          <p className="settings-text">
            Notes are saved to this folder on your computer:
          </p>
          <p className="settings-vault-path">{vaultPathDisplay}</p>
          <div className="settings-vault-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => changeVault()}
            >
              Change folder…
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => { closeSettings(); closeVault(); }}
            >
              Close vault
            </button>
          </div>
        </section>
        <section className="settings-group" aria-labelledby="settings-general-heading">
          <h2 className="settings-group-title" id="settings-general-heading">
            General
          </h2>
          <label className="settings-row">
            <input
              type="checkbox"
              checked={sidebarCollapsed}
              onChange={(e) => setSidebarCollapsed(e.target.checked)}
            />
            <span>Start with sidebar collapsed</span>
          </label>
          <label className="settings-row">
            <input
              type="checkbox"
              checked={chatOpen}
              onChange={(e) => setChatOpen(e.target.checked)}
            />
            <span>Open assistant panel when Bao launches</span>
          </label>
        </section>
      </div>
    </section>
  );
}
