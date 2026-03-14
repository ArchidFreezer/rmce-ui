// src/App.tsx
import { Suspense, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { endpoints, DEFAULT_PATH } from './endpoints/registry';
import { ConfirmProvider } from './components/ConfirmDialog';
import { ToastProvider } from './components/Toast';
import { Sidebar } from './components/Sidebar';
import { ThemeProvider, useTheme } from './components/ThemeProvider';
import './layout.css';

function ThemeSwitch() {
  const { theme, effective, setTheme, toggle } = useTheme();
  const icon = effective === 'dark' ? '☀️' : '🌙';
  const title = effective === 'dark' ? 'Switch to light' : 'Switch to dark';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <button
        aria-label={title}
        title={title}
        onClick={toggle}
        className="topbar__menu"
        style={{ minWidth: 40, textAlign: 'center' }}
      >
        {icon}
      </button>
      <select
        aria-label="Theme"
        value={theme}
        onChange={(e) => setTheme(e.target.value as any)}
        className="topbar__menu"
        style={{ padding: '6px 8px' }}
        title="Theme"
      >
        <option value="system">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </div>
  );
}

function Shell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
          <ThemeSwitch />
        </div>
      </header>

      {/* Sidebar (persistent on desktop, overlay on mobile) */}
      <Sidebar
        endpoints={endpoints}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main content area */}
      <main className="content" role="main">
        <Suspense fallback={<div>Loading UI…</div>}>
          <Routes>
            {endpoints.map((ep) => (
              <Route key={ep.id} path={ep.path} element={<ep.Component />} />
            ))}
            <Route path="*" element={<Navigate to={DEFAULT_PATH} replace />} />
          </Routes>
        </Suspense>
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
      <ThemeProvider>
        <ConfirmProvider>
          <BrowserRouter>
            <Shell />
          </BrowserRouter>
        </ConfirmProvider>
      </ThemeProvider>
    </ToastProvider>
  );
}