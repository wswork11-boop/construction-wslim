import React, { useEffect, useState } from 'react';
import { Role } from '@construction/shared';
import { apiFetch } from '../lib/api';

export const UsersPage: React.FC = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<Role>(Role.OFFICE);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const loadUsers = async () => {
    try {
      const res = await apiFetch('/users?pageSize=100');
      setUsers(res.items || []);
    } catch (err: any) {
      setError(err.message);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const openNew = () => {
    setEditingUser(null);
    setEmail('');
    setName('');
    setPhone('');
    setRole(Role.OFFICE);
    setPassword('');
    setShowForm(true);
  };

  const openEdit = (u: any) => {
    setEditingUser(u);
    setEmail(u.email);
    setName(u.name);
    setPhone(u.phone || '');
    setRole(u.role);
    setPassword('');
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      if (editingUser) {
        await apiFetch(`/users/${editingUser.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            email,
            name,
            phone: phone || null,
            role,
            ...(password ? { password } : {}),
          }),
        });
      } else {
        await apiFetch('/users', {
          method: 'POST',
          body: JSON.stringify({
            email,
            name,
            phone: phone || null,
            role,
            password,
          }),
        });
      }
      setShowForm(false);
      await loadUsers();
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
      await loadUsers();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div>
      <div className="top">
        <h1>Users</h1>
        <span className="sp" />
        <button className="btn pri" onClick={openNew}>
          New user
        </button>
      </div>
      {error && <div className="error-banner">{error}</div>}
      {showForm && (
        <div className="card">
          <h2>{editingUser ? 'Edit user' : 'New user'}</h2>
          <form onSubmit={handleSave} className="grid g3">
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
                <option value={Role.OWNER}>OWNER</option>
                <option value={Role.OFFICE}>OFFICE</option>
                <option value={Role.PROJECT_MANAGER}>PROJECT_MANAGER</option>
                <option value={Role.SITE_STAFF}>SITE_STAFF</option>
              </select>
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
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
              <button type="submit" className="btn pri">
                Save
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
              <th>Email</th>
              <th>Phone</th>
              <th>Role</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td>{u.phone || '-'}</td>
                <td>
                  <span className={`pill ${u.role === Role.OWNER ? 'info' : ''}`}>{u.role}</span>
                </td>
                <td>
                  <span className={`pill ${u.isActive ? 'ok' : ''}`}>
                    {u.isActive ? 'Active' : 'Deactivated'}
                  </span>
                </td>
                <td className="right">
                  <button className="btn sm" onClick={() => openEdit(u)} style={{ marginRight: 6 }}>
                    Edit
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
