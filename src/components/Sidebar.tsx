import { NavLink } from 'react-router-dom';
import type { EndpointDef } from '../endpoints/registry';

export function Sidebar({
  endpoints,
  open,
  onClose,
}: {
  endpoints: EndpointDef[];
  open: boolean;
  onClose?: () => void;
}) {
  return (
    <aside
      className={`sidebar ${open ? 'open' : ''}`}
      aria-label="Resource navigation"
    >
      <div className="sidebar__header">
        <div className="sidebar__title">RMCE Objects</div>
      </div>

      <nav className="sidebar__nav" role="navigation" aria-label="Resources">
        <ul className="sidebar__list">
          {endpoints.map((ep) => (
            <li key={ep.id} className="sidebar__item">
              <NavLink
                to={ep.path}
                className={({ isActive }) =>
                  `sidebar__link ${isActive ? 'active' : ''}`
                }
                onClick={onClose}
              >
                {ep.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="sidebar__footer">
        <small style={{ color: 'var(--muted)' }}>
          v1 · {new Date().getFullYear()}
        </small>
      </div>
    </aside>
  );
}