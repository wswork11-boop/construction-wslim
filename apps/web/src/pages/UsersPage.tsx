import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Role } from '@construction/shared';
import { apiFetch } from '../lib/api';

export const UsersPage: React.FC = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);

  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<Role>(Role.PROJECT_MANAGER);
  const [companyId, setCompanyId] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const [uRes, pRes, cRes] = await Promise.all([
        apiFetch('/users?pageSize=100'),
        apiFetch('/projects?pageSize=100').catch(() => ({ items: [] })),
        apiFetch('/companies').catch(() => ({ items: [] })),
      ]);
      setUsers(uRes.items || []);
      setProjects(pRes.items || []);
      setCompanies(cRes.items || []);
    } catch (err: any) {
      setError(err.message);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openNew = () => {
    setEditingUser(null);
    setEmail('');
    setName('');
    setPhone('');
    setRole(Role.PROJECT_MANAGER);
    setCompanyId('');
    setCompanyName('');
    setSelectedProjectIds([]);
    setPassword('');
    setShowForm(true);
  };

  const openEdit = (u: any) => {
    setEditingUser(u);
    setEmail(u.email);
    setName(u.name);
    setPhone(u.phone || '');
    setRole(u.role);
    setCompanyId(u.companyId || '');
    setCompanyName(u.companyName || '');
    setSelectedProjectIds(u.projectIds || (u.projects || []).map((p: any) => p.id));
    setPassword('');
    setShowForm(true);
  };

  const toggleProjectSelection = (pid: string) => {
    setSelectedProjectIds((prev) =>
      prev.includes(pid) ? prev.filter((id) => id !== pid) : [...prev, pid],
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const payload: any = {
        email,
        name,
        phone: phone || null,
        role,
        companyId: companyId || null,
        companyName: companyName.trim() || null,
        projectIds: selectedProjectIds,
      };
      if (editingUser) {
        if (password) payload.password = password;
        await apiFetch(`/users/${editingUser.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      } else {
        payload.password = password;
        await apiFetch('/users', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      setShowForm(false);
      await loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const toggleActive = async (u: any) => {
    try {
      await apiFetch(`/users/${u.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !u.isActive }),
      });
      await loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div>
      <div className="top">
        <h1>Users &amp; Project Assignment</h1>
        <span className="sp" />
        <button className="btn pri" onClick={openNew}>
          New user
        </button>
      </div>
      {error && <div className="error-banner">{error}</div>}
      {showForm && (
        <div className="card">
          <h2>{editingUser ? `Edit user: ${editingUser.name}` : 'New user'}</h2>
          <form onSubmit={handleSave}>
            <div className="grid g3" style={{ gap: 10 }}>
              <div>
                <label>Name</label>
                <input required value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <label>Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div>
                <label>Phone</label>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <div>
                <label>Role</label>
                <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
                  <option value={Role.OWNER}>OWNER (All access)</option>
                  <option value={Role.OFFICE}>OFFICE (All projects)</option>
                  <option value={Role.PROJECT_MANAGER}>PROJECT_MANAGER (Assigned projects)</option>
                  <option value={Role.SITE_STAFF}>SITE_STAFF (Assigned projects, no prices)</option>
                </select>
              </div>
              <div>
                <label>Select from Your Companies (Optional)</label>
                <select
                  value={companyId}
                  onChange={(e) => {
                    const cid = e.target.value;
                    setCompanyId(cid);
                    const found = companies.find((c) => c.id === cid);
                    if (found) setCompanyName(found.name);
                  }}
                >
                  <option value="">-- External or custom company --</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code ? `[${c.code}] ` : ''}
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label>Company Name (Own or External Subcon / Partner)</label>
                <input
                  placeholder="e.g. Subcon Engineering Sdn Bhd"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                />
              </div>
              <div>
                <label>{editingUser ? 'New password (optional)' : 'Initial password'}</label>
                <input
                  type="password"
                  minLength={8}
                  required={!editingUser}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            {/* Project Assignment Checkboxes */}
            <div style={{ marginTop: 14 }}>
              <label style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
                Assign User to Projects ({selectedProjectIds.length} selected)
                {(role === Role.OWNER || role === Role.OFFICE) && (
                  <span className="small muted" style={{ fontWeight: 400, marginLeft: 8 }}>
                    (OWNER and OFFICE automatically have access to all projects, or you can still tag their primary projects)
                  </span>
                )}
              </label>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                  gap: 8,
                  padding: 10,
                  border: '1px solid var(--line)',
                  borderRadius: 6,
                  background: '#fafbfc',
                  maxHeight: 200,
                  overflowY: 'auto',
                }}
              >
                {projects.map((p) => {
                  const checked = selectedProjectIds.includes(p.id);
                  return (
                    <label
                      key={p.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '6px 8px',
                        borderRadius: 6,
                        background: checked ? 'var(--brand-soft)' : '#fff',
                        border: `1px solid ${checked ? 'var(--brand)' : 'var(--line)'}`,
                        color: 'var(--text)',
                        cursor: 'pointer',
                        margin: 0,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleProjectSelection(p.id)}
                        style={{ width: 'auto', margin: 0 }}
                      />
                      <span>
                        <b>{p.code}</b> &middot; {p.name}
                      </span>
                    </label>
                  );
                })}
                {projects.length === 0 && (
                  <span className="small muted">No projects created yet.</span>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button type="submit" className="btn pri">
                Save user &amp; project assignments
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
              <th>Name</th>
              <th>Company</th>
              <th>Email / Phone</th>
              <th>Role</th>
              <th>Assigned Projects</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td className="bold">{u.name}</td>
                <td>
                  {u.companyName ? (
                    <span className="pill">{u.companyName}</span>
                  ) : (
                    <span className="small muted">-</span>
                  )}
                </td>
                <td>
                  <div>{u.email}</div>
                  {u.phone && <div className="small muted">{u.phone}</div>}
                </td>
                <td>
                  <span className={`pill ${u.role === Role.OWNER ? 'info' : ''}`}>{u.role}</span>
                </td>
                <td>
                  {(u.projects || []).length > 0 ? (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {u.projects.map((p: any) => (
                        <Link key={p.id} to={`/projects/${p.id}`} className="pill info">
                          {p.code}
                        </Link>
                      ))}
                    </div>
                  ) : u.role === Role.OWNER || u.role === Role.OFFICE ? (
                    <span className="small muted">All projects</span>
                  ) : (
                    <span className="pill warn">None assigned</span>
                  )}
                </td>
                <td>
                  <span className={`pill ${u.isActive ? 'ok' : ''}`}>
                    {u.isActive ? 'Active' : 'Deactivated'}
                  </span>
                </td>
                <td className="right">
                  <button className="btn sm" onClick={() => openEdit(u)} style={{ marginRight: 6 }}>
                    Edit / Assign
                  </button>
                  <button className="btn sm" onClick={() => toggleActive(u)}>
                    {u.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
