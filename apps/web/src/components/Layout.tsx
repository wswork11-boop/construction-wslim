import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Role } from '@construction/shared';
import { authStore } from '../lib/auth';
import { apiFetch } from '../lib/api';

export const Layout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, refreshToken } = authStore.getState();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname, location.search]);

  const handleLogout = async () => {
    try {
      if (refreshToken) {
        await apiFetch('/auth/logout', {
          method: 'POST',
          body: JSON.stringify({ refreshToken }),
        });
      }
    } catch {
      // ignore logout error
    } finally {
      authStore.clearSession();
      navigate('/login');
    }
  };

  return (
    <div className="app">
      <header className="mobile-header">
        <button
          type="button"
          className="mobile-menu-btn"
          aria-label="Toggle navigation menu"
          onClick={() => setMenuOpen((prev) => !prev)}
        >
          {menuOpen ? '\u2715' : '\u2630'}
        </button>
        <div className="mobile-logo">Construction System</div>
        <div className="mobile-user small">{user?.name}</div>
      </header>

      {menuOpen && <div className="side-backdrop" onClick={() => setMenuOpen(false)} />}

      <nav className={`side ${menuOpen ? 'open' : ''}`}>
        <div className="logo">Construction System</div>
        {(user?.role === Role.OWNER || user?.role === Role.OFFICE) && (
          <NavLink to="/dashboard" className={({ isActive }) => (isActive ? 'on' : '')}>
            Dashboard
          </NavLink>
        )}
        <div className="grp">Work</div>
        <NavLink to="/projects" className={({ isActive }) => (isActive ? 'on' : '')}>
          Projects
        </NavLink>
        <NavLink to="/daily-reports" className={({ isActive }) => (isActive ? 'on' : '')}>
          Daily reports
        </NavLink>
        {user?.role !== Role.SITE_STAFF && (
          <NavLink to="/reports" className={({ isActive }) => (isActive ? 'on' : '')}>
            Reports
          </NavLink>
        )}

        {user?.role !== Role.SITE_STAFF && (
          <>
            <div className="grp">Sales</div>
            <NavLink to="/quotations" className={({ isActive }) => (isActive ? 'on' : '')}>
              Quotations
            </NavLink>
            <div className="grp">Billing &amp; Costs</div>
            <NavLink to="/invoices" className={({ isActive }) => (isActive ? 'on' : '')}>
              Invoices &amp; Claims
            </NavLink>
            {(user?.role === Role.OWNER || user?.role === Role.OFFICE) && (
              <NavLink to="/payments" className={({ isActive }) => (isActive ? 'on' : '')}>
                Payments
              </NavLink>
            )}
            <NavLink to="/expenses" className={({ isActive }) => (isActive ? 'on' : '')}>
              Expenses &amp; Purchases
            </NavLink>
          </>
        )}

        <div className="grp">Setup</div>
        {(user?.role === Role.OWNER || user?.role === Role.OFFICE) && (
          <NavLink to="/clients" className={({ isActive }) => (isActive ? 'on' : '')}>
            Clients
          </NavLink>
        )}
        {user?.role === Role.OWNER && (
          <NavLink to="/users" className={({ isActive }) => (isActive ? 'on' : '')}>
            Users
          </NavLink>
        )}
        <NavLink to="/settings" className={({ isActive }) => (isActive ? 'on' : '')}>
          Company settings
        </NavLink>

        <div style={{ marginTop: 'auto', padding: '16px 18px', borderTop: '1px solid #28344f' }}>
          <div className="small" style={{ color: '#fff', fontWeight: 600 }}>
            {user?.name}
          </div>
          <div className="small muted" style={{ marginBottom: 8 }}>
            {user?.role}
          </div>
          <button className="btn sm" onClick={handleLogout} style={{ width: '100%' }}>
            Log out
          </button>
        </div>
      </nav>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
};
