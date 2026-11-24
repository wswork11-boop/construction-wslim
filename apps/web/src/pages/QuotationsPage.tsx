import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Role } from '@construction/shared';
import { apiFetch } from '../lib/api';
import { authStore } from '../lib/auth';
import { activeProjectStore } from '../lib/active-project';

export const QuotationsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = authStore.getState();
  const canWrite = user?.role === Role.OWNER || user?.role === Role.OFFICE;

  const [quotations, setQuotations] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [companyFilter, setCompanyFilter] = useState(activeProjectStore.getCompanyId());
  const [projectFilter, setProjectFilter] = useState(activeProjectStore.getProjectId());
  const [error, setError] = useState<string | null>(null);

  const loadQuotations = async (
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
      const res = await apiFetch(`/quotations?${params.toString()}`);
      setQuotations(res.items || []);
    } catch (err: any) {
      setError(err.message);
    }
  };

  useEffect(() => {
    loadQuotations();
  }, []);

  useEffect(() => {
    return activeProjectStore.subscribe(() => {
      const nextComp = activeProjectStore.getCompanyId();
      const nextProj = activeProjectStore.getProjectId();
      setCompanyFilter(nextComp);
      setProjectFilter(nextProj);
      loadQuotations(q, statusFilter, nextComp, nextProj);
    });
  }, [q, statusFilter]);

  const statusBadgeClass = (st: string) => {
    if (st === 'ACCEPTED') return 'ok';
    if (st === 'SENT') return 'info';
    if (st === 'REJECTED') return 'bad';
    if (st === 'EXPIRED') return 'warn';
    return '';
  };

  return (
    <div>
      <div className="top">
        <h1>Quotations</h1>
        <span className="sp" />
        <input
          style={{ width: 220 }}
          placeholder="Search number, client, title"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            loadQuotations(e.target.value, statusFilter);
          }}
        />
        <select
          style={{ width: 150 }}
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            loadQuotations(q, e.target.value);
          }}
        >
          <option value="">All statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="SENT">Sent</option>
          <option value="ACCEPTED">Accepted</option>
          <option value="REJECTED">Rejected</option>
          <option value="EXPIRED">Expired</option>
        </select>
        {canWrite && (
          <button className="btn pri" onClick={() => navigate('/quotations/new')}>
            New quotation
          </button>
        )}
      </div>
      {error && <div className="error-banner">{error}</div>}
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Number</th>
              <th>Our Company</th>
              <th>Client</th>
              <th>Title</th>
              <th>Date</th>
              <th>Valid until</th>
              <th className="num">Total (RM)</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {quotations.map((qt) => (
              <tr key={qt.id}>
                <td>
                  <Link to={`/quotations/${qt.id}`}>
                    {qt.displayNumber || `${qt.number}-R${qt.revisionNo}`}
                  </Link>
                </td>
                <td>
                  {qt.company ? (
                    <span className="pill">
                      {qt.company.code ? `[${qt.company.code}] ` : ''}
                      {qt.company.name}
                    </span>
                  ) : (
                    <span className="small muted">-</span>
                  )}
                </td>
                <td>{qt.client?.name || '-'}</td>
                <td>{qt.title}</td>
                <td>{qt.issueDate || '-'}</td>
                <td>{qt.validUntil || '-'}</td>
                <td className="num">{qt.total}</td>
                <td>
                  <span className={`pill ${statusBadgeClass(qt.status)}`}>{qt.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
