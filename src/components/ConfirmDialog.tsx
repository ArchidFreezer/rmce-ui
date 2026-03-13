import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

type ConfirmTone = 'default' | 'danger';
export interface ConfirmOptions {
  title?: string;
  body?: string;
  confirmText?: string;
  cancelText?: string;
  tone?: ConfirmTone;
}

type ConfirmFn = (opts?: ConfirmOptions) => Promise<boolean>;
const ConfirmContext = createContext<ConfirmFn | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions>({});
  const resolverRef = useRef<((ok: boolean) => void) | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const confirmBtnRef = useRef<HTMLButtonElement | null>(null);

  const confirm = useCallback<ConfirmFn>((opts = {}) => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setOptions({
        title: 'Confirm',
        body: 'Are you sure?',
        confirmText: 'Confirm',
        cancelText: 'Cancel',
        tone: 'default',
        ...opts,
      });
      previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
      setOpen(true);
    });
  }, []);

  const close = useCallback(() => {
    setOpen(false);
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

  // ESC + simple focus trap
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!open) return;

      if (e.key === 'Escape') {
        e.stopPropagation();
        onCancel();
        return;
      }

      if (e.key === 'Tab') {
        const scope = document.querySelector('[data-confirm-dialog]');
        if (!scope) return;

        const focusables: HTMLElement[] = Array.from(
          scope.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          )
        ).filter((el) => !el.hasAttribute('disabled'));

        if (focusables.length === 0) return;

        const current = document.activeElement as HTMLElement | null;
        const idx = focusables.indexOf(current ?? (null as unknown as HTMLElement));

        let nextIdx = idx;
        if (e.shiftKey) {
          nextIdx = idx <= 0 ? focusables.length - 1 : idx - 1;
        } else {
          nextIdx = idx === focusables.length - 1 ? 0 : idx + 1;
        }

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
              <div id="confirm-desc" style={{ marginBottom: 16, whiteSpace: 'pre-wrap' }}>
                {options.body}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={onCancel}>
                {options.cancelText ?? 'Cancel'}
              </button>
              <button
                ref={confirmBtnRef}
                onClick={onConfirm}
                style={options.tone === 'danger' ? dangerBtn : undefined}
              >
                {options.confirmText ?? 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used inside a <ConfirmProvider>');
  return ctx;
}

/* ---------- styles (same as before) ---------- */
const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.45)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 16,
  zIndex: 1000,
};
const dialogStyle: React.CSSProperties = {
  maxWidth: 520,
  width: '100%',
  background: '#fff',
  color: '#111',
  borderRadius: 8,
  border: '1px solid #ddd',
  boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
  padding: 16,
};
const dialogDanger: React.CSSProperties = {
  border: '1px solid #ffb4b4',
  boxShadow: '0 10px 30px rgba(255,0,0,0.12)',
};
const dangerBtn: React.CSSProperties = {
  background: '#b00020',
  color: 'white',
  border: '1px solid #b00020',
};