import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

export type ToastVariant = 'info' | 'success' | 'warning' | 'danger';

export interface ToastOptions {
  title?: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number; // ms, <=0 disables auto-dismiss
  dismissible?: boolean;
  icon?: ReactNode;
}

interface ToastItemData extends Required<Omit<ToastOptions, 'icon'>> {
  id: string;
  icon?: ReactNode;
}

type ToastFn = (opts: ToastOptions) => string;
const ToastContext = createContext<ToastFn | null>(null);

export function ToastProvider({
  children,
  maxVisible = 3,
  duration = 3500,
  position = 'bottom-right',
}: {
  children: ReactNode;
  maxVisible?: number;
  duration?: number;
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
}) {
  const [queue, setQueue] = useState<ToastItemData[]>([]);
  const [visible, setVisible] = useState<ToastItemData[]>([]);

  const notify = useCallback<ToastFn>(
    (opts) => {
      const id = `t_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const item: ToastItemData = {
        id,
        title: opts.title ?? '',
        description: opts.description ?? '',
        variant: opts.variant ?? 'info',
        duration: Number.isFinite(opts.duration) ? (opts.duration as number) : duration,
        dismissible: opts.dismissible !== false,
        icon: opts.icon,
      };
      setQueue((prev) => [...prev, item]);
      return id;
    },
    [duration]
  );

  const remove = useCallback((id: string) => {
    setVisible((prev) => prev.filter((t) => t.id !== id));
    setQueue((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    if (visible.length >= maxVisible) return;
    const candidates = queue.filter((q) => !visible.find((v) => v.id === q.id));
    if (candidates.length === 0) return;
    const space = maxVisible - visible.length;
    setVisible((prev) => [...prev, ...candidates.slice(0, space)]);
  }, [queue, visible, maxVisible]);

  const liveText = useMemo(() => {
    const last = visible[visible.length - 1];
    if (!last) return '';
    return `${last.title || ''} ${last.description || ''}`.trim();
  }, [visible]);

  return (
    <ToastContext.Provider value={notify}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          whiteSpace: 'nowrap',
          border: 0,
        }}
      >
        {liveText}
      </div>

      <ToastViewport toasts={visible} onDismiss={remove} position={position} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastFn {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside a <ToastProvider>');
  return ctx;
}

/* Viewport */
function ToastViewport({
  toasts,
  onDismiss,
  position,
}: {
  toasts: ToastItemData[];
  onDismiss: (id: string) => void;
  position: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
}) {
  const posStyle = getPositionStyle(position);
  return (
    <div style={{ ...viewportStyle, ...posStyle }}>
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={() => onDismiss(t.id)} />
      ))}
    </div>
  );
}

const viewportStyle: React.CSSProperties = {
  position: 'fixed',
  zIndex: 1100,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  padding: 12,
  pointerEvents: 'none',
};

function getPositionStyle(position: Parameters<typeof ToastViewport>[0]['position']) {
  const base: React.CSSProperties = {};
  if (position.includes('bottom')) base.bottom = 12;
  if (position.includes('top')) base.top = 12;
  if (position.includes('right')) base.right = 12;
  if (position.includes('left')) base.left = 12;
  return base;
}

/* Individual toast */
function ToastItem({
  toast,
  onDismiss,
}: {
  toast: ToastItemData;
  onDismiss: () => void;
}) {
  const { title, description, variant, duration, dismissible, icon } = toast;
  const [hover, setHover] = useState(false);
  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const remainingRef = useRef<number>(duration);

  useEffect(() => {
    if (!Number.isFinite(duration) || duration <= 0) return;
    if (hover) return;
    timerRef.current = window.setTimeout(onDismiss, remainingRef.current);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [hover, duration, onDismiss]);

  useEffect(() => {
    if (!Number.isFinite(duration) || duration <= 0) return;
    if (hover) {
      const elapsed = Date.now() - startTimeRef.current;
      remainingRef.current = Math.max(0, duration - elapsed);
      if (timerRef.current) window.clearTimeout(timerRef.current);
    } else {
      startTimeRef.current = Date.now();
    }
  }, [hover, duration]);

  const theme = variantStyles[variant] ?? variantStyles.info;

  return (
    <div
      role="status"
      aria-live={variant === 'danger' ? 'assertive' : 'polite'}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ ...itemStyle, ...theme.container }}
    >
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <div style={{ ...iconWrap, ...theme.iconWrap }}>
          {icon ?? defaultIconFor(variant)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          {title ? <div style={{ ...titleStyle, ...theme.title }}>{title}</div> : null}
          {description ? <div style={{ ...descStyle, ...theme.desc }}>{description}</div> : null}
        </div>
        {dismissible && (
          <button
            aria-label="Dismiss notification"
            onClick={onDismiss}
            style={{ ...closeBtn, ...theme.closeBtn }}
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}

/* Styles */
const itemStyle: React.CSSProperties = {
  pointerEvents: 'auto',
  minWidth: 280,
  maxWidth: 420,
  borderRadius: 8,
  border: '1px solid #ddd',
  boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
  padding: '10px 12px',
  background: '#fff',
  color: '#111',
};
const titleStyle: React.CSSProperties = { fontWeight: 600, marginBottom: 2, lineHeight: 1.3 };
const descStyle: React.CSSProperties = { fontSize: 14, color: '#333' };
const iconWrap: React.CSSProperties = {
  width: 22,
  height: 22,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 14,
  borderRadius: 999,
  marginTop: 2,
};
const closeBtn: React.CSSProperties = {
  border: 'none',
  background: 'transparent',
  fontSize: 18,
  lineHeight: 1,
  cursor: 'pointer',
  color: '#555',
};
const variantStyles: Record<
  ToastVariant,
  {
    container: React.CSSProperties;
    iconWrap: React.CSSProperties;
    title: React.CSSProperties;
    desc: React.CSSProperties;
    closeBtn: React.CSSProperties;
  }
> = {
  info: {
    container: { borderColor: '#cfe8ff', background: '#f3f9ff' },
    iconWrap: { background: '#e1f0ff', color: '#0b63c4' },
    title: { color: '#0b63c4' },
    desc: {},
    closeBtn: { color: '#0b63c4' },
  },
  success: {
    container: { borderColor: '#bfe5c6', background: '#f1fbf3' },
    iconWrap: { background: '#e0f5e4', color: '#007a3d' },
    title: { color: '#007a3d' },
    desc: {},
    closeBtn: { color: '#007a3d' },
  },
  warning: {
    container: { borderColor: '#ffe0a6', background: '#fff9ed' },
    iconWrap: { background: '#fff1cf', color: '#9a6b00' },
    title: { color: '#9a6b00' },
    desc: {},
    closeBtn: { color: '#9a6b00' },
  },
  danger: {
    container: { borderColor: '#ffc8c8', background: '#fff2f2' },
    iconWrap: { background: '#ffe0e0', color: '#b00020' },
    title: { color: '#b00020' },
    desc: {},
    closeBtn: { color: '#b00020' },
  },
};

function defaultIconFor(variant: ToastVariant) {
  switch (variant) {
    case 'success': return '✓';
    case 'warning': return '!';
    case 'danger':  return '⚠';
    default:        return 'ℹ';
  }
}
``