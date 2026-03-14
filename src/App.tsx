import { Suspense, useEffect, useMemo, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfirmProvider } from './components/ConfirmDialog';
import { ToastProvider } from './components/Toast';
import { Sidebar } from './components/Sidebar';
import { ThemeProvider } from './components/ThemeProvider';
import { fetchPrefixes } from './api/prefixes';
import { buildResources, FALLBACK_RESOURCES, type ResourceDef } from './resources/registry';
import './layout.css';

function Shell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resources, setResources] = useState<ResourceDef[]>([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const px = await fetchPrefixes();
        if (!mounted) return;
        const defs = buildResources(px);
        if (defs.length === 0) {
          // Optional: fallback if backend returns empty or unknowns only
          setResources(FALLBACK_RESOURCES);
        } else {
          setResources(defs);
        }
      } catch (e) {
        if (!mounted) return;
        // Optional: fallback on error
        setResources(FALLBACK_RESOURCES);
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const defaultPath = useMemo(
    () => (resources[0]?.path ?? '/'),
    [resources]
  );

  return (
    <div className="app">
      {/* Mobile top bar */}
      <header className="topbar">
        <button
          className="topbar__menu"
          aria-label="Toggle navigation"
          onClick={() => setSidebarOpen((o) => !o)}
        >
          ☰
        </button>
        <div className="topbar__brand" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>RMCE Objects</span>
          {/* Optional: Theme switch if you added it */}
          {/* <ThemeSwitch /> */}
        </div>
      </header>

      {/* Sidebar (fully dynamic) */}
      <Sidebar
        items={resources.map(({ label, path }) => ({ label, path }))}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main content */}
      <main className="content" role="main">
        {error && (
          <div style={{ marginBottom: 8, color: 'var(--muted)' }}>
            {/* Non-blocking: we already fell back to static routes */}
            Unable to load resources from server. Using fallback. ({error})
          </div>
        )}

        {loading ? (
          <div>Loading UI…</div>
        ) : resources.length === 0 ? (
          <div>No resources available.</div>
        ) : (
          <Suspense fallback={<div>Loading view…</div>}>
            <Routes>
              {resources.map((r) => (
                <Route key={r.path} path={r.path} element={<r.Component />} />
              ))}
              <Route path="*" element={<Navigate to={defaultPath} replace />} />
            </Routes>
          </Suspense>
        )}
      </main>

      {/* Backdrop on mobile when sidebar is open */}
      {sidebarOpen && (
        <div
          className="backdrop"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
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
``