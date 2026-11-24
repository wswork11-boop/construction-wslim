import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Role } from '@construction/shared';
import { apiFetch } from '../lib/api';
import { authStore } from '../lib/auth';
import { activeProjectStore } from '../lib/active-project';

export const InvoicesPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = authStore.getState();
  const canWrite = user?.role === Role.OWNER || user?.role === Role.OFFICE;

  const [invoices, setInvoices] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [companyFilter, setCompanyFilter] = useState(activeProjectStore.getCompanyId());
  const [projectFilter, setProjectFilter] = useState(activeProjectStore.getProjectId());
  const [error, setError] = useState<string | null>(null);

  const loadInvoices = async (
    search = q,
    st = statusFilter,
    comp = companyFilter,
    proj = projectFilter,
  ) => {
    try {
      const params = new URLSearchParams({ pageSize: '100' });
      if (search) params.set('q', search);
      if (st) params.set('status', st);
      if (comp) params.set('companyId', comp);
      if (proj) params.set('projectId', proj);
      const res = await apiFetch(`/invoices?${params.toString()}`);
      setInvoices(res.items || []);
    } catch (err: any) {
      setError(err.message);
    }
  };

  useEffect(() => {
    loadInvoices();
  }, []);

  useEffect(() => {
    return activeProjectStore.subscribe(() => {
      const nextComp = activeProjectStore.getCompanyId();
      const nextProj = activeProjectStore.getProjectId();
      setCompanyFilter(nextComp);
      setProjectFilter(nextProj);
      loadInvoices(q, statusFilter, nextComp, nextProj);
    });
  }, [q, statusFilter]);

  const handleExportCsv = () => {
    const year = new Date().getFullYear();
    window.open(`/api/v1/exports/invoices.csv?from=${year}-01-01&to=${year}-12-31`, '_blank');
  };

  const statusPill = (st: string) => {
    if (st === 'PAID') return 'ok';
    if (st === 'ISSUED') return 'info';
    if (st === 'PARTIALLY_PAID') return 'warn';
    if (st === 'VOID') return 'bad';
    return '';
  };

  return (
    <div>
      <div className="top">
        <h1>Invoices &amp; Progress Claims</h1>
        <span className="sp" />
        <input
          style={{ width: 220 }}
          placeholder="Search number, ref, client"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            loadInvoices(e.target.value, statusFilter);
          }}
        />
        <select
          style={{ width: 150 }}
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            loadInvoices(q, e.target.value);
          }}
        >
          <option value="">All statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="ISSUED">Issued</option>
          <option value="PARTIALLY_PAID">Partially Paid</option>
          <option value="PAID">Paid</option>
          <option value="VOID">Void</option>
        </select>
        {canWrite && (
          <>
            <button className="btn" onClick={handleExportCsv}>
              Export CSV
            </button>
            <button className="btn" onClick={() => navigate('/payments')}>
              Record payment
            </button>
            <button className="btn pri" onClick={() => navigate('/invoices/new')}>
              New simple invoice
            </button>
          </>
        )}
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Tax Invoice No.</th>
              <th>Our Company</th>
              <th>Type</th>
              <th>Reference (Project / Claim / Report)</th>
              <th>Client</th>
              <th>Issued</th>
              <th>Due</th>
              <th className="num">Total (RM)</th>
              <th className="num">Paid (RM)</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv.id}>
                <td>
                  <Link to={`/invoices/${inv.id}`}>{inv.number || 'DRAFT'}</Link>
                </td>
                <td>
                  {inv.company ? (
                    <span className="pill">
                      {inv.company.code ? `[${inv.company.code}] ` : ''}
                      {inv.company.name}
                    </span>
                  ) : (
                    <span className="small muted">-</span>
                  )}
                </td>
                <td>
                  {inv.type === 'PROGRESS_CLAIM'
                    ? `Claim #${inv.claimNo || '-'}`
                    : inv.type === 'RETENTION_RELEASE'
                      ? 'Retention Release'
                      : 'Simple Invoice'}
                </td>
                <td>
                  <span className="small bold">{inv.referenceSummary || '-'}</span>
                  {inv.quotePoRef && (
                    <div className="small muted">Quote/PO: {inv.quotePoRef}</div>
                  )}
                </td>
                <td>{inv.client?.name || '-'}</td>
                <td>{inv.issueDate || '-'}</td>
                <td>{inv.dueDate || '-'}</td>
                <td className="num">{inv.total}</td>
                <td className="num">{inv.amountPaid}</td>
                <td>
                  <span className={`pill ${statusPill(inv.status)}`}>{inv.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
