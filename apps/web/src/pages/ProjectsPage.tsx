import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ProjectStatus, Role } from '@construction/shared';
import { apiFetch } from '../lib/api';
import { authStore } from '../lib/auth';
import { activeProjectStore } from '../lib/active-project';

export const ProjectsPage: React.FC = () => {
  const { user } = authStore.getState();
  const canWrite = user?.role === Role.OWNER || user?.role === Role.OFFICE;
  const isSiteStaff = user?.role === Role.SITE_STAFF;

  const [projects, setProjects] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [activeProjectId, setActiveProjectId] = useState(activeProjectStore.getProjectId());

  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [companyFilter, setCompanyFilter] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [clientId, setClientId] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [siteAddress, setSiteAddress] = useState('');
  const [status, setStatus] = useState<ProjectStatus>(ProjectStatus.ACTIVE);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return activeProjectStore.subscribe(() => {
      setActiveProjectId(activeProjectStore.getProjectId());
    });
  }, []);

  const loadData = async (search = q, st = statusFilter, comp = companyFilter) => {
    try {
      const params = new URLSearchParams({ pageSize: '100' });
      if (search) params.set('q', search);
      if (st) params.set('status', st);
      if (comp) params.set('companyId', comp);
      const res = await apiFetch(`/projects?${params.toString()}`);
      setProjects(res.items || []);

      if (companies.length === 0) {
        const compRes = await apiFetch('/companies').catch(() => ({ items: [] }));
        setCompanies(compRes.items || []);
        if (compRes.items?.[0]) setCompanyId(compRes.items[0].id);
      }

      if (canWrite && clients.length === 0) {
        const cRes = await apiFetch('/clients?pageSize=100');
        setClients(cRes.items || []);
        if (cRes.items?.[0]) setClientId(cRes.items[0].id);
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await apiFetch('/projects', {
        method: 'POST',
        body: JSON.stringify({
          code,
          name,
          clientId,
          companyId: companyId || null,
          siteAddress: siteAddress || null,
          status,
        }),
      });
      setShowForm(false);
      setCode('');
      setName('');
      setSiteAddress('');
      await loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div>
      <div className="top">
        <h1>Projects</h1>
        <span className="sp" />
        <input
          style={{ width: 200 }}
          placeholder="Search code, name"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            loadData(e.target.value, statusFilter, companyFilter);
          }}
        />
        {companies.length > 1 && (
          <select
            style={{ width: 180 }}
            value={companyFilter}
            onChange={(e) => {
              setCompanyFilter(e.target.value);
              loadData(q, statusFilter, e.target.value);
            }}
          >
            <option value="">All our companies</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code ? `[${c.code}] ` : ''}
                {c.name}
              </option>
            ))}
          </select>
        )}
        <select
          style={{ width: 140 }}
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            loadData(q, e.target.value, companyFilter);
          }}
        >
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="DRAFT">Draft</option>
          <option value="ON_HOLD">On hold</option>
          <option value="COMPLETED">Completed</option>
          <option value="CLOSED">Closed</option>
        </select>
        {canWrite && (
          <button className="btn pri" onClick={() => setShowForm(true)}>
            New project
          </button>
        )}
      </div>
      {error && <div className="error-banner">{error}</div>}
      {showForm && (
        <div className="card">
          <h2>New project</h2>
          <form onSubmit={handleCreate} className="grid g3">
            <div>
              <label>Project code</label>
              <input
                required
                placeholder="P26-009"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </div>
            <div>
              <label>Project name</label>
              <input required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label>Our Company (Billing Entity)</label>
              <select value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code ? `[${c.code}] ` : ''}
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label>Client</label>
              <select
                required
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
              >
                <option value="">Select client...</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label>Site address</label>
              <input value={siteAddress} onChange={(e) => setSiteAddress(e.target.value)} />
            </div>
            <div>
              <label>Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ProjectStatus)}
              >
                <option value="DRAFT">DRAFT</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="ON_HOLD">ON_HOLD</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" className="btn pri">
                Save project
              </button>
              <button type="button" className="btn" onClick={() => setShowForm(false)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Project</th>
              <th>Our Company</th>
              <th>Client</th>
              <th>Status</th>
              {!isSiteStaff && <th className="num">Contract sum (RM)</th>}
              <th />
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => {
              const isSelected = activeProjectId === p.id;
              return (
                <tr
                  key={p.id}
                  style={isSelected ? { background: 'var(--brand-soft)' } : undefined}
                >
                  <td>
                    <Link to={`/projects/${p.id}`} className="bold">
                      {p.code}
                    </Link>
                  </td>
                  <td>{p.name}</td>
                  <td>
                    {p.company ? (
                      <span className="pill">
                        {p.company.code ? `[${p.company.code}] ` : ''}
                        {p.company.name}
                      </span>
                    ) : (
                      <span className="small muted">Primary</span>
                    )}
                  </td>
                  <td>{p.client?.name || '-'}</td>
                  <td>
                    <span className={`pill ${p.status === 'ACTIVE' ? 'ok' : ''}`}>
                      {p.status}
                    </span>
                  </td>
                  {!isSiteStaff && <td className="num">{p.contractSum ?? '0.00'}</td>}
                  <td className="right">
                    <button
                      type="button"
                      className={`btn sm ${isSelected ? 'pri' : ''}`}
                      onClick={() =>
                        activeProjectStore.setProjectId(isSelected ? '' : p.id)
                      }
                    >
                      {isSelected ? 'Selected' : 'Select project'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
