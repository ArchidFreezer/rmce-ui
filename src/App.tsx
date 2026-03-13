import { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, NavLink, useLocation } from 'react-router-dom';
import { endpoints } from './endpoints/registry';
import { ConfirmProvider } from './components/ConfirmDialog';
import { ToastProvider } from './components/Toast';

function Shell() {
  const location = useLocation();
  return (
    <div style={{ padding: 16 }}>
      <h1>RMCE Objects</h1>
      <nav style={{ display: 'flex', gap: 8, margin: '12px 0 20px' }}>
        {endpoints.map((ep) => (
          <NavLink
            key={ep.id}
            to={ep.path}
            style={({ isActive }) => ({
              padding: '8px 12px',
              borderRadius: 6,
              border: isActive ? '1px solid #4a90e2' : '1px solid #ccc',
              background: isActive ? '#e8f2ff' : '#f7f7f7',
              textDecoration: 'none',
              color: 'inherit',
            })}
          >
            {ep.label}
          </NavLink>
        ))}
      </nav>

      <Suspense fallback={<div>Loading UI…</div>}>
        <Routes location={location}>
          {endpoints.map((ep) => (
            <Route key={ep.id} path={ep.path} element={<ep.Component />} />
          ))}
          <Route
            path="*"
            element={
              endpoints[0]
                ? <Navigate to={endpoints[0].path} replace />
                : <div>No endpoints configured</div>
            }
          />
        </Routes>
      </Suspense>
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