import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

const ToastContext = createContext(null);

/**
 * Usage:
 * 1) Wrap your app with <ToastProvider>
 * 2) Call const toast = useToast();
 * 3) toast({ title: 'Saved', description: 'Book saved', variant: 'success' })
 */
export function ToastProvider({
  children,
  maxVisible = 3,      // how many to show at once
  duration = 3500,      // default auto-dismiss (ms)
  position = 'bottom-right', // 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'
}) {
  const [queue, setQueue] = useState([]); // all toasts (pending + visible)
  const [visible, setVisible] = useState([]); // subset actively shown

  // Add a toast to the queue
  const notify = useCallback((opts = {}) => {
    const id = `t_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const toast = {
      id,
      title: opts.title || '',
      description: opts.description || '',
      variant: opts.variant || 'info', // 'info' | 'success' | 'warning' | 'danger'
      duration: Number.isFinite(opts.duration) ? opts.duration : duration,
      dismissible: opts.dismissible !== false, // default true
      icon: opts.icon,
    };
    setQueue(prev => [...prev, toast]);
    return id;
  }, [duration]);

  // Remove toast (from both arrays)
  const remove = useCallback((id) => {
    setVisible(prev => prev.filter(t => t.id !== id));
    setQueue(prev => prev.filter(t => t.id !== id));
  }, []);

  // Promote from queue to visible up to maxVisible
  useEffect(() => {
    if (visible.length >= maxVisible) return;
    const candidates = queue.filter(q => !visible.find(v => v.id === q.id));
    if (candidates.length === 0) return;
    const space = maxVisible - visible.length;
    setVisible(prev => [...prev, ...candidates.slice(0, space)]);
  }, [queue, visible, maxVisible]);

  // Announce to screen readers via aria-live region
  const liveText = useMemo(() => {
    // Only announce the latest visible toast’s title + description
    const last = visible[visible.length - 1];
    if (!last) return '';
    return `${last.title || ''} ${last.description || ''}`.trim();
  }, [visible]);

  return (
    <ToastContext.Provider value={notify}>
      {/* Main app */}
      {children}

      {/* SR-only live region */}
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

      {/* Visual toasts */}
      <ToastViewport
        toasts={visible}
        onDismiss={remove}
        position={position}
      />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside a <ToastProvider>');
  return ctx;
}

/* ---------------------------- Viewport ---------------------------- */

function ToastViewport({ toasts, onDismiss, position }) {
  const posStyle = getPositionStyle(position);
  return (
    <div style={{ ...viewportStyle, ...posStyle }}>
      {toasts.map(t => (
        <ToastItem key={t.id} toast={t} onDismiss={() => onDismiss(t.id)} />
      ))}
    </div>
  );
}

const viewportStyle = {
  position: 'fixed',
  zIndex: 1100,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  padding: 12,
  pointerEvents: 'none', // allow clicks through gaps
};

function getPositionStyle(position) {
  const base = {};
  if (position.includes('bottom')) base.bottom = 12;
  if (position.includes('top')) base.top = 12;
  if (position.includes('right')) base.right = 12;
  if (position.includes('left')) base.left = 12;
  return base;
}

/* ----------------------------- Item ----------------------------- */

function ToastItem({ toast, onDismiss }) {
  const { id, title, description, variant, duration, dismissible, icon } = toast;
  const [hover, setHover] = useState(false);
  const timerRef = useRef(null);
  const startTimeRef = useRef(Date.now());
  const remainingRef = useRef(duration);

  // Auto-dismiss with pause on hover
  useEffect(() => {
    if (!Number.isFinite(duration) || duration <= 0) return;
    if (hover) return; // paused
    timerRef.current = setTimeout(() => onDismiss(), remainingRef.current);
    return () => clearTimeout(timerRef.current);
  }, [hover, duration, onDismiss]);

  // When hover toggles, recompute remaining time
  useEffect(() => {
    if (!Number.isFinite(duration) || duration <= 0) return;
    if (hover) {
      // Pause: compute remaining and clear timer
      const elapsed = Date.now() - startTimeRef.current;
      remainingRef.current = Math.max(0, duration - elapsed);
      clearTimeout(timerRef.current);
    } else {
      // Resume: reset start time
      startTimeRef.current = Date.now();
    }
  }, [hover, duration]);

  // Styles per variant
  const theme = variantStyles[variant] || variantStyles.info;

  return (
    <div
      role="status"
      aria-live={variant === 'danger' ? 'assertive' : 'polite'}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        ...itemStyle,
        ...theme.container,
      }}
    >
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <div style={{ ...iconWrap, ...theme.iconWrap }}>
          {icon ?? defaultIconFor(variant)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          {title ? <div style={{ ...titleStyle, ...theme.title }}>{title}</div> : null}
          {description ? (
            <div style={{ ...descStyle, ...theme.desc }}>{description}</div>
          ) : null}
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

/* ----------------------------- Styles ---------------------------- */

const itemStyle = {
  pointerEvents: 'auto', // interactive
  minWidth: 280,
  maxWidth: 420,
  borderRadius: 8,
  border: '1px solid #ddd',
  boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
  padding: '10px 12px',
  background: '#fff',
  color: '#111',
};

const titleStyle = { fontWeight: 600, marginBottom: 2, lineHeight: 1.3 };
const descStyle = { fontSize: 14, color: '#333' };
const iconWrap = {
  width: 22,
  height: 22,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 14,
  borderRadius: 999,
  marginTop: 2,
};
const closeBtn = {
  border: 'none',
  background: 'transparent',
  fontSize: 18,
  lineHeight: 1,
  cursor: 'pointer',
  color: '#555',
};

const variantStyles = {
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

function defaultIconFor(variant) {
  switch (variant) {
    case 'success': return '✓';
    case 'warning': return '!';
    case 'danger':  return '⚠';
    default:        return 'ℹ';
  }
}