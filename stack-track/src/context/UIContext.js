import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import Modal from '../components/ui/Modal';

const UIContext = createContext(null);

let toastId = 0;

/**
 * Toasts and confirm dialogs. Replaces window.alert / window.confirm, which
 * block the page and look out of place in an installed app.
 */
export function UIProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [dialog, setDialog] = useState(null);
  const resolver = useRef(null);

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const toast = useCallback((message, { type = 'success', action, duration = 3800 } = {}) => {
    toastId += 1;
    const id = toastId;
    setToasts((t) => [...t.slice(-2), { id, message, type, action }]);
    if (duration) setTimeout(() => dismiss(id), duration);
    return id;
  }, [dismiss]);

  const confirm = useCallback((opts) => new Promise((resolve) => {
    resolver.current = resolve;
    setDialog({ confirmLabel: 'Confirm', cancelLabel: 'Cancel', danger: false, ...opts });
  }), []);

  const close = (result) => {
    if (resolver.current) resolver.current(result);
    resolver.current = null;
    setDialog(null);
  };

  // Service worker update → toast with a reload action
  useEffect(() => {
    const onUpdate = (e) => {
      const reg = e.detail;
      toast('A new version of StackTrack is ready.', {
        type: 'info',
        duration: 0,
        action: {
          label: 'Reload',
          onClick: () => {
            if (reg && reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
            setTimeout(() => window.location.reload(), 300);
          },
        },
      });
    };
    window.addEventListener('stacktrack:update', onUpdate);
    return () => window.removeEventListener('stacktrack:update', onUpdate);
  }, [toast]);

  const value = useMemo(() => ({ toast, confirm }), [toast, confirm]);

  const icons = { success: CheckCircle2, error: AlertCircle, info: Info };

  return (
    <UIContext.Provider value={value}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => {
          const Icon = icons[t.type] || Info;
          return (
            <div key={t.id} className={`toast toast-${t.type}`}>
              <Icon size={18} aria-hidden="true" />
              <span className="toast-msg">{t.message}</span>
              {t.action && (
                <button
                  type="button"
                  className="toast-action"
                  onClick={() => {
                    t.action.onClick();
                    dismiss(t.id);
                  }}
                >
                  {t.action.label}
                </button>
              )}
              <button type="button" className="icon-btn toast-close" onClick={() => dismiss(t.id)} aria-label="Dismiss">
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>
      {dialog && (
        <Modal title={dialog.title} onClose={() => close(false)} size="sm">
          {dialog.body && <p className="dialog-body">{dialog.body}</p>}
          <div className="dialog-actions">
            <button type="button" className="btn btn-ghost" onClick={() => close(false)}>
              {dialog.cancelLabel}
            </button>
            <button
              type="button"
              className={`btn ${dialog.danger ? 'btn-danger' : 'btn-primary'}`}
              onClick={() => close(true)}
              autoFocus
            >
              {dialog.confirmLabel}
            </button>
          </div>
        </Modal>
      )}
    </UIContext.Provider>
  );
}

export function useUI() {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error('useUI must be used inside <UIProvider>');
  return ctx;
}
