import React, { useEffect, useState } from 'react';
import { Role } from '@construction/shared';
import { apiFetch } from '../lib/api';
import { authStore } from '../lib/auth';

export const CompanySettingsPage: React.FC = () => {
  const { user } = authStore.getState();
  const isOwner = user?.role === Role.OWNER;
  const [company, setCompany] = useState<any>(null);
  const [taxRates, setTaxRates] = useState<any[]>([]);
  const [newTaxName, setNewTaxName] = useState('');
  const [newTaxPercent, setNewTaxPercent] = useState('6.00');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const comp = await apiFetch('/company');
      setCompany(comp);
      if (user?.role === Role.OWNER || user?.role === Role.OFFICE) {
        const tr = await apiFetch('/tax-rates');
        setTaxRates(tr.items || []);
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveCompany = async () => {
    setError(null);
    setMessage(null);
    try {
      const updated = await apiFetch('/company', {
        method: 'PATCH',
        body: JSON.stringify({
          name: company.name,
          registrationNo: company.registrationNo || null,
          tin: company.tin || null,
          sstNo: company.sstNo || null,
          msicCode: company.msicCode || null,
          address: company.address || null,
          phone: company.phone || null,
          email: company.email || null,
          bankDetails: company.bankDetails || null,
          defaultPaymentTermDays: Number(company.defaultPaymentTermDays),
          defaultRetentionPercent: company.defaultRetentionPercent,
          defaultRetentionCapPercent: company.defaultRetentionCapPercent,
        }),
      });
      setCompany(updated);
      setMessage('Company settings saved.');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleAddTaxRate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/tax-rates', {
        method: 'POST',
        body: JSON.stringify({
          name: newTaxName,
          percent: newTaxPercent,
          isDefault: false,
          isActive: true,
        }),
      });
      setNewTaxName('');
      await loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (!company) return <div>Loading...</div>;

  return (
    <div>
      <div className="top">
        <h1>Company settings</h1>
        <span className="sp" />
        {isOwner && (
          <button className="btn pri" onClick={handleSaveCompany}>
            Save
          </button>
        )}
      </div>
      {error && <div className="error-banner">{error}</div>}
      {message && (
        <div className="card" style={{ background: 'var(--ok-soft)', color: 'var(--ok)' }}>
          {message}
        </div>
      )}
      <div className="grid g2">
        <div className="card">
          <h2>Company details (shown on documents)</h2>
          <div className="field">
            <label>Company name</label>
            <input
              disabled={!isOwner}
              value={company.name || ''}
              onChange={(e) => setCompany({ ...company, name: e.target.value })}
            />
          </div>
          <div className="grid g2" style={{ gap: 10 }}>
            <div className="field">
              <label>SSM registration no.</label>
              <input
                disabled={!isOwner}
                value={company.registrationNo || ''}
                onChange={(e) => setCompany({ ...company, registrationNo: e.target.value })}
              />
            </div>
            <div className="field">
              <label>TIN</label>
              <input
                disabled={!isOwner}
                value={company.tin || ''}
                onChange={(e) => setCompany({ ...company, tin: e.target.value })}
              />
            </div>
            <div className="field">
              <label>SST registration no.</label>
              <input
                disabled={!isOwner}
                value={company.sstNo || ''}
                onChange={(e) => setCompany({ ...company, sstNo: e.target.value })}
              />
            </div>
            <div className="field">
              <label>MSIC code</label>
              <input
                disabled={!isOwner}
                value={company.msicCode || ''}
                onChange={(e) => setCompany({ ...company, msicCode: e.target.value })}
              />
            </div>
          </div>
          <div className="field">
            <label>Address</label>
            <textarea
              rows={2}
              disabled={!isOwner}
              value={company.address || ''}
              onChange={(e) => setCompany({ ...company, address: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Bank details (printed on invoices)</label>
            <textarea
              rows={2}
              disabled={!isOwner}
              value={company.bankDetails || ''}
              onChange={(e) => setCompany({ ...company, bankDetails: e.target.value })}
            />
          </div>
        </div>
        <div>
          <div className="card">
            <h2>Defaults for new projects</h2>
            <div className="grid g3" style={{ gap: 10 }}>
              <div>
                <label>Payment term (days)</label>
                <input
                  className="n"
                  disabled={!isOwner}
                  value={company.defaultPaymentTermDays}
                  onChange={(e) =>
                    setCompany({ ...company, defaultPaymentTermDays: e.target.value })
                  }
                />
              </div>
              <div>
                <label>Retention %</label>
                <input
                  className="n"
                  disabled={!isOwner}
                  value={company.defaultRetentionPercent}
                  onChange={(e) =>
                    setCompany({ ...company, defaultRetentionPercent: e.target.value })
                  }
                />
              </div>
              <div>
                <label>Retention limit %</label>
                <input
                  className="n"
                  disabled={!isOwner}
                  value={company.defaultRetentionCapPercent}
                  onChange={(e) =>
                    setCompany({ ...company, defaultRetentionCapPercent: e.target.value })
                  }
                />
              </div>
            </div>
          </div>
          <div className="card">
            <h2>Tax rates</h2>
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th className="num">Percent</th>
                  <th>Default</th>
                  <th>Active</th>
                </tr>
              </thead>
              <tbody>
                {taxRates.map((tr) => (
                  <tr key={tr.id}>
                    <td>{tr.name}</td>
                    <td className="num">{tr.percent}</td>
                    <td>{tr.isDefault ? 'Yes' : '-'}</td>
                    <td>{tr.isActive ? 'Yes' : 'No'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {isOwner && (
              <form
                onSubmit={handleAddTaxRate}
                style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'flex-end' }}
              >
                <div style={{ flex: 1 }}>
                  <label>Rate name</label>
                  <input
                    required
                    placeholder="e.g. SST 8%"
                    value={newTaxName}
                    onChange={(e) => setNewTaxName(e.target.value)}
                  />
                </div>
                <div style={{ width: 100 }}>
                  <label>Percent</label>
                  <input
                    className="n"
                    required
                    value={newTaxPercent}
                    onChange={(e) => setNewTaxPercent(e.target.value)}
                  />
                </div>
                <button type="submit" className="btn sm pri">
                  Add tax rate
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
