import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfirmProvider } from './components/ConfirmDialog';
import { ToastProvider } from './components/Toast';
import { ThemeProvider } from './components/ThemeProvider';
import { Sidebar, SidebarItem } from './components/Sidebar';
import { fetchPrefixes } from './api/prefix';
import { splitResources, FALLBACK_RESOURCES, type ResourceDef } from './resources/registry';
import GenericResourceView from './endpoints/generic/GenericResourceView'; // <-- generic

const CharacterCreationView = lazy(() => import('./endpoints/character/CharacterCreationView'));

import './layout.css';

function Shell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resources, setResources] = useState<ResourceDef[]>([]);
  const [unknown, setUnknown] = useState<string[]>([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const px = await fetchPrefixes();
        if (!mounted) return;
        const { known, unknown } = splitResources(px);
        if (known.length === 0 && unknown.length === 0) {
          setResources(FALLBACK_RESOURCES);
          setUnknown([]);
        } else {
          setResources(known);
          setUnknown(unknown);
        }
      } catch (e) {
        if (!mounted) return;
        setResources(FALLBACK_RESOURCES);
        setUnknown([]);
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Build sidebar items: known → their paths; unknown → generic /r/:prefix
  // Build sidebar items with isKnown flag
  const sidebarItems: SidebarItem[] = useMemo(() => {
    const knownItems = resources.map(({ label, path, prefix }) => ({
      label, path, prefix, isKnown: true,
    }));
    const unknownItems = unknown.map((p) => ({
      label: toTitle(p),
      path: `/r/${p}` as `/${string}`,
      prefix: p,
      isKnown: false,
    }));
    return [...knownItems, ...unknownItems].sort((a, b) => a.label.localeCompare(b.label));
  }, [resources, unknown]);

  const workflowItems: SidebarItem[] = useMemo(() => ([
    {
      label: 'Character Creation',
      path: '/character/create',
      isKnown: true,
      prefix: '',
    },
  ]), []);


  // Default redirect path
  const defaultPath = useMemo(() => {
    if (resources[0]?.path) return resources[0].path;
    if (unknown[0]) return `/r/${unknown[0]}` as `/${string}`;
    return '/';
  }, [resources, unknown]);

  return (
    <div className="app">
      <header className="topbar">
        <button
          className="topbar__menu"
          aria-label="Toggle navigation"
          onClick={() => setSidebarOpen((o) => !o)}
        >
          ☰
        </button>
        <div className="topbar__brand" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>RMCE</span>
          {/* <ThemeSwitch /> if you added it */}
        </div>
      </header>

      <Sidebar
        sections={[
          { heading: 'Workflow', items: workflowItems, collapsible: true },
          { heading: 'Resources', items: sidebarItems, collapsible: true },
        ]}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <main className="content" role="main">
        {error && (
          <div style={{ marginBottom: 8, color: 'var(--muted)' }}>
            Unable to load resources from server. Using fallback. ({error})
          </div>
        )}

        {loading ? (
          <div>Loading UI…</div>
        ) : sidebarItems.length === 0 ? (
          <div>No resources available.</div>
        ) : (
          <Suspense fallback={<div>Loading view…</div>}>
            <Routes>
              <Route path="/character/create" element={<CharacterCreationView />} />
              {/* Known resource screens */}
              {resources.map((r) => (
                <Route key={r.path} path={r.path} element={<r.Component />} />
              ))}
              {/* Generic catch-all for unknown prefixes */}
              <Route path="/r/:prefix" element={<GenericResourceView />} />
              {/* Default redirect */}
              <Route path="*" element={<Navigate to={defaultPath} replace />} />
            </Routes>
          </Suspense>
        )}
      </main>

      {sidebarOpen && (
        <div className="backdrop" onClick={() => setSidebarOpen(false)} aria-hidden="true" />
      )}
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider position="bottom-right" duration={3500} maxVisible={3}>
      <ConfirmProvider>
        <ThemeProvider>
          <BrowserRouter>
            <Shell />
          </BrowserRouter>
        </ThemeProvider>
      </ConfirmProvider>
    </ToastProvider>
  );
}

function toTitle(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
``