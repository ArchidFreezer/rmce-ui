import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';

// ---------------------------------------------------------------------------
// Option type
// ---------------------------------------------------------------------------

export interface RichSelectOption {
  value: string;
  /** ReactNode label rendered inside both the trigger and the dropdown. */
  label: ReactNode;
  /**
   * Plain-text equivalent of `label`. Used for keyboard type-ahead and
   * accessible `aria-label` on each option. Required when `label` is not a
   * plain string.
   */
  searchText?: string;
  disabled?: boolean;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface RichSelectProps {
  label: string;
  hideLabel?: boolean | undefined;
  ariaLabel?: string | undefined;
  value: string;
  onChange: (val: string) => void;
  options: readonly RichSelectOption[];
  disabled?: boolean | undefined;
  id?: string | undefined;
  required?: boolean | undefined;
  error?: string | undefined;
  helperText?: string | undefined;
  placeholderOption?: string | undefined;
}

// ---------------------------------------------------------------------------
// Convenience label component
// ---------------------------------------------------------------------------

/**
 * A two-part option label: `primary` text is shown normally and `secondary`
 * text is shown in a smaller muted style to the right.
 *
 * Example:
 *   <RichOptionLabel primary="Firebolt" secondary="Own Realm Open Lists" />
 */
export function RichOptionLabel({ primary, secondary }: { primary: string; secondary?: string }) {
  return (
    <>
      <span>{primary}</span>
      {secondary && (
        <span
          style={{
            color: 'inherit',
            opacity: 0.65,
            fontSize: '0.85em',
            marginLeft: 8,
          }}
        >
          — {secondary}
        </span>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// RichSelect
// ---------------------------------------------------------------------------

export function RichSelect({
  label,
  hideLabel = false,
  ariaLabel,
  value,
  onChange,
  options,
  disabled = false,
  id,
  required,
  error,
  helperText,
  placeholderOption = '— Select —',
}: RichSelectProps) {
  const autoId = useId();
  const selectId = id ?? `rs-${autoId}`;
  const listboxId = `${selectId}-listbox`;
  const errorId = error ? `${selectId}-error` : undefined;
  const helperId = helperText ? `${selectId}-help` : undefined;
  const describedBy = [errorId, helperId].filter(Boolean).join(' ') || undefined;

  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selectedIndex = options.findIndex((o) => o.value === value);
  const selectedOption = selectedIndex >= 0 ? options[selectedIndex] : undefined;

  const computedAriaLabel = !label || hideLabel ? (ariaLabel ?? label ?? undefined) : undefined;

  /** Resolve the plain-text name of an option for type-ahead / a11y. */
  function optionText(opt: RichSelectOption): string {
    if (typeof opt.label === 'string') return opt.label;
    return opt.searchText ?? opt.value;
  }

  // ── Close on outside click ────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // ── Scroll active item into view ──────────────────────────────────────────
  useEffect(() => {
    if (!open || activeIndex < 0) return;
    const li = listRef.current?.children[activeIndex] as HTMLElement | undefined;
    li?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  function openList() {
    if (disabled) return;
    setOpen(true);
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : firstEnabledIndex());
  }

  function firstEnabledIndex(): number {
    return options.findIndex((o) => !o.disabled);
  }

  function lastEnabledIndex(): number {
    return options.reduce((acc: number, o, i) => (!o.disabled ? i : acc), -1);
  }

  function nextEnabled(from: number): number {
    let i = from + 1;
    while (i < options.length && options[i]?.disabled) i++;
    return i < options.length ? i : from;
  }

  function prevEnabled(from: number): number {
    let i = from - 1;
    while (i >= 0 && options[i]?.disabled) i--;
    return i >= 0 ? i : from;
  }

  function selectOption(opt: RichSelectOption) {
    if (opt.disabled) return;
    onChange(opt.value);
    setOpen(false);
  }

  // ── Keyboard type-ahead ───────────────────────────────────────────────────
  const typeaheadRef = useRef('');
  const typeaheadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleTypeahead(char: string) {
    typeaheadRef.current += char.toLowerCase();
    if (typeaheadTimerRef.current) clearTimeout(typeaheadTimerRef.current);
    typeaheadTimerRef.current = setTimeout(() => { typeaheadRef.current = ''; }, 500);

    const prefix = typeaheadRef.current;
    const match = options.findIndex((o) => !o.disabled && optionText(o).toLowerCase().startsWith(prefix));
    if (match >= 0) setActiveIndex(match);
  }

  // ── Keyboard handler on the trigger button ────────────────────────────────
  function handleKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;
    switch (e.key) {
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (!open) { openList(); }
        else if (activeIndex >= 0 && options[activeIndex]) { selectOption(options[activeIndex]!); }
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (!open) { openList(); break; }
        setActiveIndex((i) => nextEnabled(i));
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (!open) { openList(); break; }
        setActiveIndex((i) => prevEnabled(i));
        break;
      case 'Home':
        e.preventDefault();
        setActiveIndex(firstEnabledIndex());
        break;
      case 'End':
        e.preventDefault();
        setActiveIndex(lastEnabledIndex());
        break;
      case 'Escape':
        e.preventDefault();
        setOpen(false);
        break;
      case 'Tab':
        setOpen(false);
        break;
      default:
        if (e.key.length === 1) {
          if (!open) openList();
          handleTypeahead(e.key);
        }
    }
  }

  // ── Styles ────────────────────────────────────────────────────────────────
  const triggerStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    padding: 8,
    border: error ? '1px solid #b00020' : '1px solid var(--border)',
    background: 'var(--bg)',
    color: disabled ? 'var(--muted)' : 'var(--text)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    textAlign: 'left',
    fontSize: 14,
    boxSizing: 'border-box',
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div ref={containerRef} style={{ display: 'grid', gap: 6, fontSize: 14, width: '100%' }}>
      {!hideLabel && (
        <label htmlFor={selectId}>
          {label}
          {required ? ' *' : ''}
        </label>
      )}

      <div style={{ position: 'relative' }}>
        <button
          id={selectId}
          type="button"
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-activedescendant={open && activeIndex >= 0 ? `${selectId}-opt-${activeIndex}` : undefined}
          aria-label={computedAriaLabel}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          aria-required={required}
          disabled={disabled}
          onClick={() => (open ? setOpen(false) : openList())}
          onKeyDown={handleKeyDown}
          style={triggerStyle}
        >
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {selectedOption
              ? selectedOption.label
              : <span style={{ color: 'var(--muted)' }}>{placeholderOption}</span>}
          </span>
          <span aria-hidden="true" style={{ marginLeft: 8, fontSize: '0.7em', flexShrink: 0 }}>
            {open ? '▲' : '▼'}
          </span>
        </button>

        {open && (
          <ul
            id={listboxId}
            ref={listRef}
            role="listbox"
            aria-label={label}
            style={{
              position: 'absolute',
              zIndex: 1000,
              top: '100%',
              left: 0,
              right: 0,
              maxHeight: 260,
              overflowY: 'auto',
              margin: 0,
              padding: 0,
              listStyle: 'none',
              border: '1px solid var(--border)',
              background: 'var(--bg)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.18)',
            }}
          >
            {options.map((opt, i) => {
              const isSelected = opt.value === value;
              const isActive = i === activeIndex;
              const text = optionText(opt);

              let bg: string;
              if (isActive) bg = 'var(--primary, #0078d4)';
              else if (isSelected) bg = 'var(--primary-subtle, rgba(0,120,212,0.12))';
              else bg = 'transparent';

              const optStyle: CSSProperties = {
                padding: '7px 8px',
                cursor: opt.disabled ? 'not-allowed' : 'pointer',
                background: bg,
                color: isActive ? '#fff' : opt.disabled ? 'var(--muted)' : 'var(--text)',
                fontSize: 14,
                userSelect: 'none',
              };

              return (
                <li
                  key={opt.value}
                  id={`${selectId}-opt-${i}`}
                  role="option"
                  aria-selected={isSelected}
                  aria-disabled={opt.disabled}
                  aria-label={text}
                  onMouseEnter={() => !opt.disabled && setActiveIndex(i)}
                  onMouseLeave={() => setActiveIndex(-1)}
                  onMouseDown={(e) => { e.preventDefault(); selectOption(opt); }}
                  style={optStyle}
                >
                  {opt.label}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {helperText && !error && (
        <span id={helperId} style={{ color: 'var(--muted)', fontSize: 12 }}>
          {helperText}
        </span>
      )}
      {error && (
        <span id={errorId} style={{ color: '#b00020', fontSize: 12 }}>
          {error}
        </span>
      )}
    </div>
  );
}
