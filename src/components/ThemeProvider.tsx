import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextValue {
  theme: Theme;               // user's selected mode
  effective: 'light' | 'dark';// actual applied theme after resolving 'system'
  setTheme: (t: Theme) => void;
  toggle: () => void;         // flips light/dark (ignores 'system')
}

const ThemeContext = createContext<ThemeContextValue | null>(null);
const STORAGE_KEY = 'rmce.theme';

function getSystemPreference(): 'light' | 'dark' {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'system';
    const saved = window.localStorage.getItem(STORAGE_KEY) as Theme | null;
    return saved ?? 'system';
  });

  const system = getSystemPreference();
  const effective = theme === 'system' ? system : theme;

  // Apply body class on change
  useEffect(() => {
    const body = document.body;
    body.classList.remove('theme-light', 'theme-dark');
    body.classList.add(effective === 'dark' ? 'theme-dark' : 'theme-light');
  }, [effective]);

  // Persist selection
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  // React to system changes if in 'system' mode
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (theme !== 'system') return;

    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      const body = document.body;
      const eff = mql.matches ? 'theme-dark' : 'theme-light';
      body.classList.remove('theme-light', 'theme-dark');
      body.classList.add(eff);
    };
    mql.addEventListener?.('change', handler);
    return () => mql.removeEventListener?.('change', handler);
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      return next;
    });
  }, []);

  const value = useMemo<ThemeContextValue>(() => ({
    theme,
    effective,
    setTheme,
    toggle,
  }), [theme, effective, setTheme, toggle]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}