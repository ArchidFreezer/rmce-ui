import { NavLink } from 'react-router-dom';
import * as React from 'react';
// import { useEffect, useRef, useState } from 'react';
import { useResourceCounts, inferPrefixFromPath } from '../hooks/useResourceCounts';


export type SidebarItem = {
  label: string;
  path: `/${string}`;
  isKnown?: boolean;
  prefix?: string;
};

export type SidebarSection = {
  id?: string;
  heading?: string;
  items: SidebarItem[];
  collapsible?: boolean;
  defaultCollapsed?: boolean;
};

type SidebarProps = {
  items?: SidebarItem[];
  sections?: SidebarSection[];
  open: boolean;
  onClose?: () => void;
  sortInside?: boolean;
  enableResize?: boolean;
  minWidth?: number;
  maxWidth?: number;
  persistKey?: string;
};

export function Sidebar({
  items = [],
  sections,
  open,
  onClose,
  sortInside = false,
  enableResize = true,
  minWidth = 140,
  maxWidth = 420,
  persistKey = 'ui.sidebar.w',
}: SidebarProps) {

  const normalizedSections = React.useMemo(() => {
    const sourceSections = sections?.length
      ? sections
      : [{ id: 'default', items } satisfies SidebarSection];

    return sourceSections.map((section, index) => ({
      ...section,
      _key: section.id ?? section.heading ?? `section-${index}`,
      items: sortInside
        ? [...section.items].sort((a, b) => a.label.localeCompare(b.label))
        : section.items,
    }));
  }, [items, sections, sortInside]);

  const [collapsedSections, setCollapsedSections] = React.useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const section of (sections?.length ? sections : [{ id: 'default', items }])) {
      const key = section.id ?? section.heading ?? 'default';
      initial[key] = !!section.defaultCollapsed;
    }
    return initial;
  });

  React.useEffect(() => {
    setCollapsedSections((current) => {
      const next = { ...current };
      for (const section of normalizedSections) {
        if (!(section._key in next)) {
          next[section._key] = !!section.defaultCollapsed;
        }
      }
      return next;
    });
  }, [normalizedSections]);

  React.useEffect(() => {
    const raw = localStorage.getItem(persistKey);
    const val = raw ? Number(raw) : NaN;
    if (!Number.isNaN(val) && val > 0) {
      document.documentElement.style.setProperty('--sidebar-w', `${val}px`);
    }
    return () => { };
  }, [persistKey]);

  const dragRef = React.useRef<{ startX: number; startW: number } | null>(null);

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

  // Build a lightweight list with "path" and "prefix" only for the hook
  const countTargets = React.useMemo(
    () => normalizedSections.flatMap((section) =>
      section.items.map(({ path, prefix }: { path: `/${string}`; prefix?: string }) => ({ path, prefix }))
    ),
    [normalizedSections]
  );

  const counts = useResourceCounts(countTargets); // Map<prefix, CountEntry>

  const getBadge = (it: SidebarItem) => {
    const prefix = it.prefix ?? inferPrefixFromPath(it.path);
    if (!prefix) return null;
    const entry = counts.get(prefix);
    if (!entry) return <span className="sidebar__count sidebar__count--loading" aria-label="loading count">…</span>;
    if (entry.loading) {
      return <span className="sidebar__count sidebar__count--loading" aria-label="loading count">…</span>;
    }
    if (entry.count == null) {
      return <span className="sidebar__count sidebar__count--error" title="Unable to load count">—</span>;
    }
    return <span className="sidebar__count" aria-label={`${it.label} items`}>{entry.count}</span>;
  };

  const toggleSection = (key: string) => {
    setCollapsedSections((current) => ({
      ...current,
      [key]: !current[key],
    }));
  };

  return (

    <aside className={`sidebar ${open ? 'open' : ''}`} aria-label="Resource navigation">

      {/* Sidebar header */}
      <div className="sidebar__header">
        <div className="sidebar__title">RMCE Objects</div>
        <button
          aria-label="Refresh resource counts"
          title="Refresh counts"
          onClick={() => {
            counts.clear?.();
            location.reload();
          }}
          style={{ marginLeft: 'auto' }}
        >
          ↻
        </button>
      </div>

      <nav className="sidebar__nav" role="navigation" aria-label="Resources">
        {normalizedSections.map((section) => {
          const isCollapsed = !!collapsedSections[section._key];
          const isCollapsible = !!section.collapsible;

          return (
            <section key={section._key} className="sidebar__section">
              {section.heading && (
                isCollapsible ? (
                  <button
                    type="button"
                    className="sidebar__section-heading sidebar__section-heading--button"
                    onClick={() => toggleSection(section._key)}
                    aria-expanded={!isCollapsed}
                  >
                    <span>{section.heading}</span>
                    <span className="sidebar__section-chevron" aria-hidden="true">{isCollapsed ? '▸' : '▾'}</span>
                  </button>
                ) : (
                  <div className="sidebar__section-heading">
                    <span>{section.heading}</span>
                  </div>
                )
              )}

              {!isCollapsed && (
                <ul className="sidebar__list">
                  {section.items.map((it) => (
                    <li key={it.path} className="sidebar__item">
                      <NavLink
                        to={it.path}
                        className={({ isActive }) =>
                          [
                            'sidebar__link',
                            isActive ? 'active' : '',
                            it.isKnown ? 'sidebar__link--known' : 'sidebar__link--unknown',
                          ].join(' ').trim()
                        }
                        onClick={onClose}
                        title={it.isKnown ? 'Known resource' : 'Discovered resource'}
                      >
                        <span>{it.label}</span>
                        {getBadge(it)}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </nav>

      <div className="sidebar__footer">
        <small style={{ color: 'var(--muted)' }}>v1 · {new Date().getFullYear()}</small>
      </div>

      {/* Desktop-only resizer grip */}
      {enableResize && <span className="sidebar__grip" onPointerDown={onPointerDown} role="separator" aria-orientation="vertical" aria-label="Resize sidebar" />}

    </aside>
  );
}