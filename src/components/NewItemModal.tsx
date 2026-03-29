import { useEffect, useRef } from "react";
import { useAppStore } from "../store/useAppStore";

export function NewItemModal() {
  const modal = useAppStore((s) => s.modal);
  const modalInputValue = useAppStore((s) => s.modalInputValue);
  const setModalInputSync = useAppStore((s) => s.setModalInputSync);
  const closeModal = useAppStore((s) => s.closeModal);
  const confirmModal = useAppStore((s) => s.confirmModal);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (modal.open) {
      const t = window.setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 0);
      return () => window.clearTimeout(t);
    }
  }, [modal.open, modal.defaultValue]);

  if (!modal.open) {
    return null;
  }

  return (
    <div
      className="modal-backdrop"
      aria-hidden="false"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          closeModal();
        }
      }}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title-react"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="modal-title" id="modal-title-react">
          {modal.title}
        </h2>
        <p className="modal-hint">{modal.hint}</p>
        <label className="modal-label">
          Name
          <input
            ref={inputRef}
            id="modal-input-react"
            type="text"
            className="modal-input"
            autoComplete="off"
            value={modalInputValue}
            onChange={(e) => setModalInputSync(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void confirmModal(modalInputValue);
              }
            }}
          />
        </label>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={() => closeModal()}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void confirmModal(modalInputValue)}
          >
            {modal.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
