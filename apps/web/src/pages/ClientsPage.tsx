import React, { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';

export const ClientsPage: React.FC = () => {
  const [clients, setClients] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [registrationNo, setRegistrationNo] = useState('');
  const [tin, setTin] = useState('');
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [error, setError] = useState<string | null>(null);

  const loadClients = async (search = q) => {
    try {
      const res = await apiFetch(
        `/clients?pageSize=100${search ? `&q=${encodeURIComponent(search)}` : ''}`,
      );
      setClients(res.items || []);
    } catch (err: any) {
      setError(err.message);
    }
  };

  useEffect(() => {
    loadClients();
  }, []);

  const openNew = () => {
    setEditing(null);
    setCode('');
    setName('');
    setRegistrationNo('');
    setTin('');
    setContactName('');
    setPhone('');
    setEmail('');
    setAddress('');
    setShowForm(true);
  };

  const openEdit = (c: any) => {
    setEditing(c);
    setCode(c.code || '');
    setName(c.name || '');
    setRegistrationNo(c.registrationNo || '');
    setTin(c.tin || '');
    setContactName(c.contactName || '');
    setPhone(c.phone || '');
    setEmail(c.email || '');
    setAddress(c.address || '');
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const payload = {
      code: code || null,
      name,
      registrationNo: registrationNo || null,
      tin: tin || null,
      contactName: contactName || null,
      phone: phone || null,
      email: email || null,
      address: address || null,
    };
    try {
      if (editing) {
        await apiFetch(`/clients/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch('/clients', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      setShowForm(false);
      await loadClients();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div>
      <div className="top">
        <h1>Clients</h1>
        <span className="sp" />
        <input
          style={{ width: 220 }}
          placeholder="Search"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            loadClients(e.target.value);
          }}
        />
        <button className="btn pri" onClick={openNew}>
          New client
        </button>
      </div>
      {error && <div className="error-banner">{error}</div>}
      {showForm && (
        <div className="card">
          <h2>{editing ? 'Edit client' : 'New client'}</h2>
          <form onSubmit={handleSave} className="grid g3">
            <div>
              <label>Client code (e.g. ACM)</label>
              <input
                maxLength={10}
                placeholder="Auto-derived if blank"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
              />
            </div>
            <div>
              <label>Client name</label>
              <input required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label>Registration no. (SSM)</label>
              <input value={registrationNo} onChange={(e) => setRegistrationNo(e.target.value)} />
            </div>
            <div>
              <label>TIN</label>
              <input value={tin} onChange={(e) => setTin(e.target.value)} />
            </div>
            <div>
              <label>Contact person</label>
              <input value={contactName} onChange={(e) => setContactName(e.target.value)} />
            </div>
            <div>
              <label>Phone</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div>
              <label>Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div style={{ gridColumn: '2 / span 2' }}>
              <label>Address</label>
              <input value={address} onChange={(e) => setAddress(e.target.value)} />
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
              <th>Code</th>
              <th>Name</th>
              <th>Registration no.</th>
              <th>TIN</th>
              <th>Contact</th>
              <th>Phone</th>
              <th>Email</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {clients.map((c) => (
              <tr key={c.id}>
                <td>
                  <span className="pill info">{c.code}</span>
                </td>
                <td>{c.name}</td>
                <td>{c.registrationNo || '-'}</td>
                <td>{c.tin ? c.tin : <span className="pill warn">Missing</span>}</td>
                <td>{c.contactName || '-'}</td>
                <td>{c.phone || '-'}</td>
                <td>{c.email || '-'}</td>
                <td className="right">
                  <button className="btn sm" onClick={() => openEdit(c)}>
                    Edit
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
