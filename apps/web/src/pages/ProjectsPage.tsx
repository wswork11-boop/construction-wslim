import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ProjectStatus, Role } from '@construction/shared';
import { apiFetch } from '../lib/api';
import { authStore } from '../lib/auth';

export const ProjectsPage: React.FC = () => {
  const { user } = authStore.getState();
  const canWrite = user?.role === Role.OWNER || user?.role === Role.OFFICE;
  const isSiteStaff = user?.role === Role.SITE_STAFF;

  const [projects, setProjects] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [clientId, setClientId] = useState('');
  const [siteAddress, setSiteAddress] = useState('');
  const [status, setStatus] = useState<ProjectStatus>(ProjectStatus.ACTIVE);
  const [error, setError] = useState<string | null>(null);

  const loadData = async (search = q, st = statusFilter) => {
    try {
      const params = new URLSearchParams({ pageSize: '100' });
      if (search) params.set('q', search);
      if (st) params.set('status', st);
      const res = await apiFetch(`/projects?${params.toString()}`);
      setProjects(res.items || []);

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
          style={{ width: 220 }}
          placeholder="Search code, name"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            loadData(e.target.value, statusFilter);
          }}
        />
        <select
          style={{ width: 140 }}
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            loadData(q, e.target.value);
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
                placeholder="P-2026-009"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </div>
            <div>
              <label>Project name</label>
              <input required value={name} onChange={(e) => setName(e.target.value)} />
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
            <div style={{ gridColumn: '1 / span 2' }}>
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
              <th>Client</th>
              <th>Status</th>
              {!isSiteStaff && <th className="num">Contract sum (RM)</th>}
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => (
              <tr key={p.id}>
                <td>
                  <Link to={`/projects/${p.id}`}>{p.code}</Link>
                </td>
                <td>{p.name}</td>
                <td>{p.client?.name || '-'}</td>
                <td>
                  <span className={`pill ${p.status === 'ACTIVE' ? 'ok' : ''}`}>
                    {p.status}
                  </span>
                </td>
                {!isSiteStaff && <td className="num">{p.contractSum ?? '0.00'}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
