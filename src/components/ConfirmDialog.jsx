import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

const ConfirmContext = createContext(null);

/**
 * Wrap your app with <ConfirmProvider>. Use `useConfirm()` anywhere
 * to ask the user to confirm something:
 *
 *   const confirm = useConfirm();
 *   const ok = await confirm({
 *     title: 'Delete item',
 *     body: 'Are you sure?',
 *     confirmText: 'Delete',
 *     cancelText: 'Cancel',
 *     tone: 'danger', // adds red accents
 *   });
 *   if (ok) { ... }
 */
export function ConfirmProvider({ children }) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState({});
  const resolverRef = useRef(null);
  const previouslyFocusedRef = useRef(null);
  const confirmBtnRef = useRef(null);

  const confirm = useCallback((opts = {}) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setOptions({
        title: 'Confirm',
        body: 'Are you sure?',
        confirmText: 'Confirm',
        cancelText: 'Cancel',
        tone: 'default',
        ...opts,
      });
      previouslyFocusedRef.current = document.activeElement;
      setOpen(true);
    });
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    // restore focus to whatever had focus before opening
    const el = previouslyFocusedRef.current;
    if (el && typeof el.focus === 'function') el.focus();
  }, []);

  const onConfirm = () => {
    resolverRef.current?.(true);
    close();
  };
  const onCancel = () => {
    resolverRef.current?.(false);
    close();
  };

  // ESC key + very basic focus trapping
  useEffect(() => {
    function onKeyDown(e) {
      if (!open) return;
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCancel();
      }
      if (e.key === 'Tab') {
        const scope = document.querySelector('[data-confirm-dialog]');
        if (!scope) return;
        const focusables = Array.from(scope.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'))
          .filter(el => !el.hasAttribute('disabled'));
        if (focusables.length === 0) return;
        const idx = focusables.indexOf(document.activeElement);
        let nextIdx = idx;
        if (e.shiftKey) nextIdx = idx <= 0 ? focusables.length - 1 : idx - 1;
        else nextIdx = idx === focusables.length - 1 ? 0 : idx + 1;
        if (idx === -1 || nextIdx !== idx) {
          e.preventDefault();
          focusables[nextIdx].focus();
        }
      }
    }
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [open, onCancel]);

  useEffect(() => {
    if (open && confirmBtnRef.current) {
      confirmBtnRef.current.focus();
    }
  }, [open]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {open && (
        <div
          role="presentation"
          onMouseDown={(e) => {
            // close on backdrop click (not on dialog click)
            if (e.target === e.currentTarget) onCancel();
          }}
          style={overlayStyle}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            aria-describedby="confirm-desc"
            data-confirm-dialog
            style={{
              ...dialogStyle,
              ...(options.tone === 'danger' ? dialogDanger : null),
            }}
          >
            <h3 id="confirm-title" style={{ margin: '0 0 8px' }}>
              {options.title}
            </h3>
            {options.body && (
              <div
                id="confirm-desc"
                style={{ marginBottom: 16, whiteSpace: 'pre-wrap' }}
              >
                {options.body}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={onCancel}>
                {options.cancelText || 'Cancel'}
              </button>
              <button
                ref={confirmBtnRef}
                onClick={onConfirm}
                style={options.tone === 'danger' ? dangerBtn : undefined}
              >
                {options.confirmText || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used inside a <ConfirmProvider>');
  return ctx;
}

/* ---------- Inline styles (self-contained) ---------- */

const overlayStyle = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.45)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 16,
  zIndex: 1000,
};

const dialogStyle = {
  maxWidth: 520,
  width: '100%',
  background: '#fff',
  color: '#111',
  borderRadius: 8,
  border: '1px solid #ddd',
  boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
  padding: 16,
};

const dialogDanger = {
  border: '1px solid #ffb4b4',
  boxShadow: '0 10px 30px rgba(255,0,0,0.12)',
};

const dangerBtn = {
  background: '#b00020',
  color: 'white',
  border: '1px solid #b00020',
};