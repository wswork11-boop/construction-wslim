import React, { useEffect, useState } from 'react';
import { Role } from '@construction/shared';
import { apiFetch, apiUploadFile, getFileContentUrl } from '../lib/api';
import { authStore } from '../lib/auth';

export const CompanySettingsPage: React.FC = () => {
  const { user } = authStore.getState();
  const isOwner = user?.role === Role.OWNER;

  const [companies, setCompanies] = useState<any[]>([]);
  const [company, setCompany] = useState<any>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [showNewCompany, setShowNewCompany] = useState(false);
  const [newCompCode, setNewCompCode] = useState('');
  const [newCompName, setNewCompName] = useState('');
  const [newCompRegNo, setNewCompRegNo] = useState('');
  const [newCompTin, setNewCompTin] = useState('');
  const [newCompAddress, setNewCompAddress] = useState('');
  const [newCompBank, setNewCompBank] = useState('');

  const [taxRates, setTaxRates] = useState<any[]>([]);
  const [newTaxName, setNewTaxName] = useState('');
  const [newTaxPercent, setNewTaxPercent] = useState('6.00');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = async (selectId?: string) => {
    try {
      const [compListRes, defaultComp] = await Promise.all([
        apiFetch('/companies').catch(() => ({ items: [] })),
        apiFetch('/company'),
      ]);
      const list = compListRes.items?.length ? compListRes.items : [defaultComp];
      setCompanies(list);
      const active =
        (selectId && list.find((c: any) => c.id === selectId)) ||
        (company && list.find((c: any) => c.id === company.id)) ||
        defaultComp;
      setCompany(active);

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
    if (!company) return;
    setError(null);
    setMessage(null);
    try {
      const updated = await apiFetch(`/companies/${company.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          code: company.code || null,
          name: company.name,
          registrationNo: company.registrationNo || null,
          tin: company.tin || null,
          sstNo: company.sstNo || null,
          msicCode: company.msicCode || null,
          address: company.address || null,
          phone: company.phone || null,
          email: company.email || null,
          logoFileId: company.logoFileId || null,
          bankDetails: company.bankDetails || null,
          defaultPaymentTermDays: Number(company.defaultPaymentTermDays),
          defaultRetentionPercent: company.defaultRetentionPercent,
          defaultRetentionCapPercent: company.defaultRetentionCapPercent,
        }),
      });
      setCompany(updated);
      await loadData(updated.id);
      setMessage(`Saved settings for ${updated.name}.`);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    try {
      const created = await apiFetch('/companies', {
        method: 'POST',
        body: JSON.stringify({
          code: newCompCode || null,
          name: newCompName,
          registrationNo: newCompRegNo || null,
          tin: newCompTin || null,
          address: newCompAddress || null,
          bankDetails: newCompBank || null,
        }),
      });
      setShowNewCompany(false);
      setNewCompCode('');
      setNewCompName('');
      setNewCompRegNo('');
      setNewCompTin('');
      setNewCompAddress('');
      setNewCompBank('');
      await loadData(created.id);
      setMessage(`Added company "${created.name}".`);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !company) return;
    setUploadingLogo(true);
    setError(null);
    setMessage(null);
    try {
      const uploaded = await apiUploadFile(file, 'COMPANY_LOGO');
      const updated = await apiFetch(`/companies/${company.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ logoFileId: uploaded.fileId }),
      });
      setCompany(updated);
      await loadData(updated.id);
      setMessage(`Uploaded and saved company logo for ${updated.name}.`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploadingLogo(false);
      e.target.value = '';
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
          <>
            <button className="btn" onClick={() => setShowNewCompany(!showNewCompany)}>
              {showNewCompany ? 'Close form' : '+ Add Another Company'}
            </button>
            <button className="btn pri" onClick={handleSaveCompany}>
              Save {company.code ? `(${company.code})` : ''}
            </button>
          </>
        )}
      </div>

      {/* Multi-Company Switcher Bar */}
      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span className="small muted bold">Your Companies ({companies.length}):</span>
        {companies.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`btn sm ${c.id === company.id ? 'pri' : ''}`}
            onClick={() => {
              setCompany(c);
              setMessage(null);
            }}
          >
            {c.code ? `[${c.code}] ` : ''}
            {c.name}
            {c.isDefault ? ' (Primary)' : ''}
          </button>
        ))}
      </div>

      {error && <div className="error-banner">{error}</div>}
      {message && (
        <div className="card" style={{ background: 'var(--ok-soft)', color: 'var(--ok)' }}>
          {message}
        </div>
      )}

      {showNewCompany && isOwner && (
        <div className="card">
          <h2>Add Another Company Profile</h2>
          <form onSubmit={handleCreateCompany} className="grid g3" style={{ gap: 10 }}>
            <div>
              <label>Company Short Code</label>
              <input
                placeholder="e.g. CB2"
                value={newCompCode}
                onChange={(e) => setNewCompCode(e.target.value)}
              />
            </div>
            <div style={{ gridColumn: '2 / span 2' }}>
              <label>Company Legal Name</label>
              <input
                required
                placeholder="e.g. Contoh Maju Engineering Sdn Bhd"
                value={newCompName}
                onChange={(e) => setNewCompName(e.target.value)}
              />
            </div>
            <div>
              <label>SSM Registration No.</label>
              <input
                placeholder="e.g. 202301011223"
                value={newCompRegNo}
                onChange={(e) => setNewCompRegNo(e.target.value)}
              />
            </div>
            <div>
              <label>TIN</label>
              <input
                placeholder="e.g. C9988776655"
                value={newCompTin}
                onChange={(e) => setNewCompTin(e.target.value)}
              />
            </div>
            <div>
              <label>Address</label>
              <input
                placeholder="Office address"
                value={newCompAddress}
                onChange={(e) => setNewCompAddress(e.target.value)}
              />
            </div>
            <div style={{ gridColumn: '1 / span 2' }}>
              <label>Bank Details (printed on invoices for this company's projects)</label>
              <input
                placeholder="Bank name, account name, account number"
                value={newCompBank}
                onChange={(e) => setNewCompBank(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
              <button type="submit" className="btn pri">
                Create Company
              </button>
              <button type="button" className="btn" onClick={() => setShowNewCompany(false)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid g2">
        <div className="card">
          <h2>Company details: {company.name} (shown on documents)</h2>
          <div className="grid g2" style={{ gap: 10 }}>
            <div className="field">
              <label>Company name</label>
              <input
                disabled={!isOwner}
                value={company.name || ''}
                onChange={(e) => setCompany({ ...company, name: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Short code</label>
              <input
                disabled={!isOwner}
                placeholder="e.g. CB"
                value={company.code || ''}
                onChange={(e) => setCompany({ ...company, code: e.target.value })}
              />
            </div>
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
          <div className="field" style={{ marginTop: 10 }}>
            <label>Company Logo (stored in S3 / R2 bucket, printed on documents)</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6, flexWrap: 'wrap' }}>
              {company.logoFileId ? (
                <img
                  src={getFileContentUrl(company.logoFileId)}
                  alt={`${company.name} logo`}
                  style={{
                    height: 54,
                    maxWidth: 160,
                    objectFit: 'contain',
                    border: '1px solid var(--line)',
                    borderRadius: 6,
                    padding: 4,
                    background: '#fff',
                  }}
                />
              ) : (
                <div
                  className="small muted"
                  style={{
                    padding: '12px 16px',
                    border: '1px dashed var(--line)',
                    borderRadius: 6,
                    background: '#fafbfc',
                  }}
                >
                  No logo uploaded yet
                </div>
              )}
              {isOwner && (
                <div>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    disabled={uploadingLogo}
                    onChange={handleLogoUpload}
                  />
                  {uploadingLogo && <div className="small muted">Uploading to S3 bucket...</div>}
                </div>
              )}
            </div>
          </div>
        </div>
        <div>
          <div className="card">
            <h2>Defaults for new projects under {company.name}</h2>
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
