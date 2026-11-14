import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

/** Accessible modal: Escape closes, focus moves in and returns, sheet-style on phones. */
export default function Modal({ title, onClose, children, size = 'md', footer }) {
  const panel = useRef(null);
  const previous = useRef(null);

  useEffect(() => {
    previous.current = document.activeElement;
    const el = panel.current;
    const focusable = el && el.querySelector('[autofocus], input, select, textarea, button:not(.modal-close)');
    (focusable || el)?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab' && el) {
        const items = el.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    document.body.classList.add('modal-open');
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('modal-open');
      if (previous.current && previous.current.focus) previous.current.focus();
    };
  }, [onClose]);

  return createPortal(
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal modal-${size}`} role="dialog" aria-modal="true" aria-labelledby="modal-title" ref={panel} tabIndex={-1}>
        <header className="modal-head">
          <h2 id="modal-title">{title}</h2>
          <button type="button" className="icon-btn modal-close" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-foot">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}
