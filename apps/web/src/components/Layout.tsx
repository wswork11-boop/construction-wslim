import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Role } from '@construction/shared';
import { authStore } from '../lib/auth';
import { apiFetch } from '../lib/api';
import { activeProjectStore } from '../lib/active-project';

export const Layout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, refreshToken } = authStore.getState();
  const [menuOpen, setMenuOpen] = useState(false);
  const [companies, setCompanies] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [activeCompanyId, setActiveCompanyId] = useState(activeProjectStore.getCompanyId());
  const [activeProjectId, setActiveProjectId] = useState(activeProjectStore.getProjectId());

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    return activeProjectStore.subscribe(() => {
      setActiveCompanyId(activeProjectStore.getCompanyId());
      setActiveProjectId(activeProjectStore.getProjectId());
    });
  }, []);

  useEffect(() => {
    Promise.all([
      apiFetch('/companies').catch(() => ({ items: [] })),
      apiFetch('/projects?pageSize=100').catch(() => ({ items: [] })),
    ]).then(([cRes, pRes]) => {
      const compList = cRes.items || [];
      const projList = pRes.items || [];
      setCompanies(compList);
      setProjects(projList);

      let curCompanyId = activeProjectStore.getCompanyId();
      if (curCompanyId && !compList.some((c: any) => c.id === curCompanyId)) {
        curCompanyId = '';
        activeProjectStore.setCompanyId('');
      }
      if (!curCompanyId && compList.length === 1 && user?.role !== Role.OWNER) {
        curCompanyId = compList[0].id;
        activeProjectStore.setCompanyId(curCompanyId);
      }

      const visibleProjects = curCompanyId
        ? projList.filter((p: any) => p.companyId === curCompanyId)
        : projList;

      const curProjId = activeProjectStore.getProjectId();
      if (curProjId && !visibleProjects.some((p: any) => p.id === curProjId)) {
        activeProjectStore.setProjectId('');
      } else if (
        !curProjId &&
        visibleProjects.length === 1 &&
        (user?.role === Role.PROJECT_MANAGER || user?.role === Role.SITE_STAFF)
      ) {
        activeProjectStore.setProjectId(visibleProjects[0].id);
      }
    });
  }, [location.pathname]);

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

  const filteredProjects = activeCompanyId
    ? projects.filter((p) => p.companyId === activeCompanyId)
    : projects;
  const activeProject = projects.find((p) => p.id === activeProjectId);
  const activeCompany = companies.find((c) => c.id === activeCompanyId);

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
        <div className="mobile-logo">
          {activeProject
            ? `${activeProject.code} · ${activeProject.name}`
            : activeCompany
              ? activeCompany.name
              : 'Construction System'}
        </div>
        <div className="mobile-user small">{user?.name}</div>
      </header>

      {menuOpen && <div className="side-backdrop" onClick={() => setMenuOpen(false)} />}

      <nav className={`side ${menuOpen ? 'open' : ''}`}>
        <div className="logo">Construction System</div>

        {/* Active Company & Project Selector */}
        <div style={{ padding: '0 14px 10px' }}>
          {companies.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div
                style={{
                  fontSize: 11,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: '#8e9ab5',
                  marginBottom: 4,
                }}
              >
                Active Company
              </div>
              <select
                aria-label="Select active company"
                value={activeCompanyId}
                onChange={(e) => {
                  const nextCompId = e.target.value;
                  activeProjectStore.setCompanyId(nextCompId);
                  if (
                    nextCompId &&
                    activeProject &&
                    activeProject.companyId &&
                    activeProject.companyId !== nextCompId
                  ) {
                    activeProjectStore.setProjectId('');
                  }
                }}
                style={{
                  background: '#222f49',
                  color: '#fff',
                  border: '1px solid #35466b',
                  fontSize: 12,
                  padding: '6px 8px',
                }}
              >
                {(user?.role === Role.OWNER || companies.length > 1) && (
                  <option value="">
                    All Assigned Companies ({companies.length})
                  </option>
                )}
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code ? `[${c.code}] ` : ''}
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div
            style={{
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: '#8e9ab5',
              marginBottom: 4,
            }}
          >
            Active Project
          </div>
          <select
            aria-label="Select active project"
            value={activeProjectId}
            onChange={(e) => {
              const nextId = e.target.value;
              activeProjectStore.setProjectId(nextId);
              if (nextId && location.pathname.startsWith('/projects/')) {
                navigate(`/projects/${nextId}`);
              }
            }}
            style={{
              background: '#222f49',
              color: '#fff',
              border: '1px solid #35466b',
              fontSize: 12,
              padding: '6px 8px',
            }}
          >
            <option value="">All Projects ({filteredProjects.length})</option>
            {filteredProjects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} · {p.name}
              </option>
            ))}
          </select>
          {activeProject && (
            <button
              type="button"
              className="btn sm"
              onClick={() => navigate(`/projects/${activeProject.id}`)}
              style={{
                width: '100%',
                marginTop: 6,
                background: '#283959',
                color: '#cfe0ff',
                borderColor: '#3a4f78',
              }}
            >
              Open {activeProject.code} Detail &rarr;
            </button>
          )}
        </div>

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
            Users &amp; Assignments
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
