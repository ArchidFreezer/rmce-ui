// src/App.tsx
import { Suspense, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { endpoints, DEFAULT_PATH } from './endpoints/registry';
import { ConfirmProvider } from './components/ConfirmDialog';
import { ToastProvider } from './components/Toast';
import { Sidebar } from './components/Sidebar';
import './layout.css';

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
        <div className="topbar__brand">RMCE Objects</div>
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
      <ConfirmProvider>
        <BrowserRouter>
          <Shell />
        </BrowserRouter>
      </ConfirmProvider>
    </ToastProvider>
  );
}