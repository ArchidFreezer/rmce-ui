import { NavLink } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';


export type SidebarItem = {
  label: string;
  path: `/${string}`;
  isKnown?: boolean;
};

export function Sidebar({
  items,
  open,
  onClose,
  sortInside = false,
  enableResize = true,
  minWidth = 140,
  maxWidth = 420,
  persistKey = 'ui.sidebar.w',
}: {
  items: SidebarItem[];
  open: boolean;
  onClose?: () => void;
  sortInside?: boolean; // whether to sort items inside the sidebar (default: false, i.e. rely on pre-sorted input)
  enableResize?: boolean;
  minWidth?: number;
  maxWidth?: number;
  persistKey?: string;
}) {
  
  
  const list = sortInside
    ? [...items].sort((a, b) => a.label.localeCompare(b.label))
    : items;

  useEffect(() => {
    const raw = localStorage.getItem(persistKey);
    const val = raw ? Number(raw) : NaN;
    if (!Number.isNaN(val) && val > 0) {
      document.documentElement.style.setProperty('--sidebar-w', `${val}px`);
    }
    return () => { };
  }, [persistKey]);
  const dragRef = useRef<{ startX: number; startW: number } | null>(null);

  const onPointerDown: React.PointerEventHandler<HTMLSpanElement> = (e) => {
    if (!enableResize || window.matchMedia('(max-width: 899px)').matches) return; // desktop only
    e.preventDefault();
    e.stopPropagation();

    const cur = getComputedStyle(document.documentElement).getPropertyValue('--sidebar-w').trim();
    const startW = cur.endsWith('px') ? parseFloat(cur) : 240;

    dragRef.current = { startX: e.clientX, startW: startW || 240 };
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);

    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const onMove = (e: PointerEvent) => {
    const ctx = dragRef.current;
    if (!ctx) return;
    const next = Math.max(minWidth, Math.min(maxWidth, Math.round(ctx.startW + (e.clientX - ctx.startX))));
    document.documentElement.style.setProperty('--sidebar-w', `${next}px`);
  };

  const onUp = () => {
    const ctx = dragRef.current;
    dragRef.current = null;

    document.body.style.userSelect = '';
    document.body.style.cursor = '';

    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);

    // persist final value
    const cur = getComputedStyle(document.documentElement).getPropertyValue('--sidebar-w').trim();
    const px = cur.endsWith('px') ? parseFloat(cur) : NaN;
    if (!Number.isNaN(px)) localStorage.setItem(persistKey, String(px));
  };

  return (

    <aside className={`sidebar ${open ? 'open' : ''}`} aria-label="Resource navigation">
      <div className="sidebar__header">
        <div className="sidebar__title">RMCE Objects</div>
      </div>

      <nav className="sidebar__nav" role="navigation" aria-label="Resources">
        <ul className="sidebar__list">
          {list.map((it) => (
            <li key={it.path} className="sidebar__item">
              <NavLink
                to={it.path}
                className={({ isActive }) =>
                  [
                    'sidebar__link',
                    isActive ? 'active' : '',
                    it.isKnown ? 'sidebar__link--known' : 'sidebar__link--unknown', // color by kind
                  ].join(' ').trim()
                }
                onClick={onClose}
                title={it.isKnown ? 'Known resource' : 'Discovered resource'}
              >
                {it.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="sidebar__footer">
        <small style={{ color: 'var(--muted)' }}>v1 · {new Date().getFullYear()}</small>
      </div>

      {/* Desktop-only resizer grip */}
      {enableResize && <span className="sidebar__grip" onPointerDown={onPointerDown} role="separator" aria-orientation="vertical" aria-label="Resize sidebar" />}

    </aside>
  );
}