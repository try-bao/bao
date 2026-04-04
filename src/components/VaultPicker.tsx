import { useEffect, useState } from "react";
import { useAppStore } from "../store/useAppStore";
import { getApi } from "../lib/api";

export function VaultPicker() {
  const openVault = useAppStore((s) => s.openVault);
  const changeVault = useAppStore((s) => s.changeVault);
  const [recentVaults, setRecentVaults] = useState<string[]>([]);

  useEffect(() => {
    const api = getApi();
    api.getRecentVaults().then(setRecentVaults).catch(() => {});
  }, []);

  const removeRecent = (dir: string) => {
    setRecentVaults((prev) => prev.filter((v) => v !== dir));
  };

  return (
    <div className="vault-picker">
      <div className="vault-picker-inner">
        <h1 className="vault-picker-title">Bao</h1>
        <p className="vault-picker-subtitle">Open a folder to get started</p>

        <button
          type="button"
          className="btn btn-primary vault-picker-open-btn"
          onClick={() => changeVault()}
        >
          Open folder…
        </button>

        {recentVaults.length > 0 && (
          <div className="vault-picker-recent">
            <h2 className="vault-picker-recent-title">Recent</h2>
            <ul className="vault-picker-recent-list">
              {recentVaults.map((dir) => (
                <li key={dir} className="vault-picker-recent-item">
                  <button
                    type="button"
                    className="vault-picker-recent-btn"
                    onClick={() => openVault(dir)}
                    title={dir}
                  >
                    <span className="vault-picker-recent-icon">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
                      </svg>
                    </span>
                    <span className="vault-picker-recent-path">{dir}</span>
                  </button>
                  <button
                    type="button"
                    className="vault-picker-recent-remove"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeRecent(dir);
                    }}
                    title="Remove from recent"
                    aria-label={`Remove ${dir} from recent`}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
