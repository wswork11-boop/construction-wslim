import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Role } from '@construction/shared';
import { apiDownload, apiFetch } from '../lib/api';
import { authStore } from '../lib/auth';
import { activeProjectStore } from '../lib/active-project';

type ReportTab = 'ageing' | 'pipeline' | 'billing' | 'retention' | 'compliance';

export const ReportsPage: React.FC = () => {
  const { user } = authStore.getState();
  const isOwnerOrOffice = user?.role === Role.OWNER || user?.role === Role.OFFICE;
  const [searchParams, setSearchParams] = useSearchParams();

  const initialTab = (searchParams.get('tab') as ReportTab) || (isOwnerOrOffice ? 'ageing' : 'retention');
  const [tab, setTab] = useState<ReportTab>(initialTab);

  const today = new Date().toISOString().slice(0, 10);
  const firstOfMonth = `${today.slice(0, 8)}01`;
  const yearStart = `${today.slice(0, 4)}-01-01`;

  const [asOf, setAsOf] = useState(today);
  const [from, setFrom] = useState(firstOfMonth);
  const [to, setTo] = useState(today);
  const [companyId, setCompanyId] = useState(activeProjectStore.getCompanyId());
  const [clientId, setClientId] = useState('');
  const [projectId, setProjectId] = useState(activeProjectStore.getProjectId());

  useEffect(() => {
    return activeProjectStore.subscribe(() => {
      setCompanyId(activeProjectStore.getCompanyId());
      setProjectId(activeProjectStore.getProjectId());
    });
  }, []);

  const [clients, setClients] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);

  const [ageingData, setAgeingData] = useState<any>(null);
  const [pipelineData, setPipelineData] = useState<any>(null);
  const [billingData, setBillingData] = useState<any>(null);
  const [retentionData, setRetentionData] = useState<any>(null);
  const [complianceData, setComplianceData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch('/projects?pageSize=100')
      .then((res) => setProjects(res.items || []))
      .catch(() => {});
    if (isOwnerOrOffice) {
      apiFetch('/clients?pageSize=100')
        .then((res) => setClients(res.items || []))
        .catch(() => {});
    }
  }, [isOwnerOrOffice]);

  const buildQueryString = (params: Record<string, string | undefined>) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v) qs.set(k, v);
    }
    const str = qs.toString();
    return str ? `?${str}` : '';
  };

  const loadActiveReport = async () => {
    setError(null);
    try {
      if (tab === 'ageing' && isOwnerOrOffice) {
        const qs = buildQueryString({
          asOf,
          companyId: companyId || undefined,
          clientId: clientId || undefined,
          projectId: projectId || undefined,
        });
        const res = await apiFetch(`/reports/receivables-ageing${qs}`);
        setAgeingData(res);
      } else if (tab === 'pipeline' && isOwnerOrOffice) {
        const qs = buildQueryString({
          from: from || undefined,
          to: to || undefined,
          companyId: companyId || undefined,
          clientId: clientId || undefined,
        });
        const res = await apiFetch(`/reports/quotation-pipeline${qs}`);
        setPipelineData(res);
      } else if (tab === 'billing' && isOwnerOrOffice) {
        const qs = buildQueryString({
          from: from || yearStart,
          to: to || today,
          companyId: companyId || undefined,
          clientId: clientId || undefined,
          projectId: projectId || undefined,
        });
        const res = await apiFetch(`/reports/billing-collections${qs}`);
        setBillingData(res);
      } else if (tab === 'retention') {
        const qs = buildQueryString({
          companyId: companyId || undefined,
          clientId: clientId || undefined,
          projectId: projectId || undefined,
        });
        const res = await apiFetch(`/reports/retention${qs}`);
        setRetentionData(res);
      } else if (tab === 'compliance') {
        const qs = buildQueryString({
          from: from || firstOfMonth,
          to: to || today,
          companyId: companyId || undefined,
          projectId: projectId || undefined,
        });
        const res = await apiFetch(`/reports/daily-report-compliance${qs}`);
        setComplianceData(res);
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  useEffect(() => {
    loadActiveReport();
  }, [tab, asOf, from, to, companyId, clientId, projectId]);

  const switchTab = (next: ReportTab) => {
    setTab(next);
    setSearchParams({ tab: next });
  };

  const handleExportXlsx = async () => {
    try {
      if (tab === 'ageing') {
        const qs = buildQueryString({
          asOf,
          companyId: companyId || undefined,
          clientId: clientId || undefined,
          projectId: projectId || undefined,
          format: 'xlsx',
        });
        await apiDownload(`/reports/receivables-ageing${qs}`, `receivables-ageing-${asOf}.xlsx`);
      } else if (tab === 'pipeline') {
        const qs = buildQueryString({
          from: from || undefined,
          to: to || undefined,
          companyId: companyId || undefined,
          clientId: clientId || undefined,
          format: 'xlsx',
        });
        await apiDownload(`/reports/quotation-pipeline${qs}`, 'quotation-pipeline.xlsx');
      } else if (tab === 'billing') {
        const qs = buildQueryString({
          from: from || yearStart,
          to: to || today,
          companyId: companyId || undefined,
          clientId: clientId || undefined,
          projectId: projectId || undefined,
          format: 'xlsx',
        });
        await apiDownload(`/reports/billing-collections${qs}`, 'billing-collections.xlsx');
      } else if (tab === 'retention') {
        const qs = buildQueryString({
          companyId: companyId || undefined,
          clientId: clientId || undefined,
          projectId: projectId || undefined,
          format: 'xlsx',
        });
        await apiDownload(`/reports/retention${qs}`, 'retention-register.xlsx');
      } else if (tab === 'compliance') {
        const qs = buildQueryString({
          from: from || firstOfMonth,
          to: to || today,
          companyId: companyId || undefined,
          projectId: projectId || undefined,
          format: 'xlsx',
        });
        await apiDownload(
          `/reports/daily-report-compliance${qs}`,
          `daily-report-compliance-${from}-${to}.xlsx`,
        );
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div>
      <div className="top">
        <h1>Reports</h1>
        <span className="sp" />
        <button className="btn pri" onClick={handleExportXlsx}>
          Export Excel (.xlsx)
        </button>
      </div>

      <div className="tabs">
        {isOwnerOrOffice && (
          <>
            <span className={tab === 'ageing' ? 'on' : ''} onClick={() => switchTab('ageing')}>
              Receivables Ageing
            </span>
            <span className={tab === 'pipeline' ? 'on' : ''} onClick={() => switchTab('pipeline')}>
              Quotation Pipeline
            </span>
            <span className={tab === 'billing' ? 'on' : ''} onClick={() => switchTab('billing')}>
              Billing &amp; Collections
            </span>
          </>
        )}
        <span className={tab === 'retention' ? 'on' : ''} onClick={() => switchTab('retention')}>
          Retention Register
        </span>
        <span
          className={tab === 'compliance' ? 'on' : ''}
          onClick={() => switchTab('compliance')}
        >
          Daily Report Compliance
        </span>
      </div>

      {/* Filters Bar */}
      <div className="card grid g4" style={{ gap: 10, alignItems: 'end' }}>
        {tab === 'ageing' && (
          <div>
            <label>As of date</label>
            <input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} />
          </div>
        )}

        {(tab === 'pipeline' || tab === 'billing' || tab === 'compliance') && (
          <>
            <div>
              <label>From date</label>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <label>To date</label>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </>
        )}

        {isOwnerOrOffice && tab !== 'compliance' && (
          <div>
            <label>Client filter</label>
            <select value={clientId} onChange={(e) => setClientId(e.target.value)}>
              <option value="">All clients</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code ? `[${c.code}] ` : ''}
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {tab !== 'pipeline' && (
          <div>
            <label>Project filter</label>
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">All projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} &middot; {p.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {error && (
        <div className="card" style={{ borderColor: '#b42318', color: '#b42318' }}>
          {error}
        </div>
      )}

      {/* 1. Receivables Ageing */}
      {tab === 'ageing' && ageingData && (
        <div className="card">
          <h2>Receivables Ageing (as of {ageingData.asOf})</h2>
          <table>
            <thead>
              <tr>
                <th>Client</th>
                <th>TIN</th>
                <th className="num">Current (RM)</th>
                <th className="num">1-30 Days</th>
                <th className="num">31-60 Days</th>
                <th className="num">61-90 Days</th>
                <th className="num">90+ Days</th>
                <th className="num">Total (RM)</th>
              </tr>
            </thead>
            <tbody>
              {(ageingData.rows || []).map((r: any) => (
                <tr key={r.client.id}>
                  <td>
                    {r.client.code ? <span className="pill">{r.client.code}</span> : null}{' '}
                    {r.client.name}
                  </td>
                  <td>{r.client.tin || '-'}</td>
                  <td className="num">{r.current}</td>
                  <td className="num">{r.days1To30}</td>
                  <td className="num">{r.days31To60}</td>
                  <td className="num">{r.days61To90}</td>
                  <td className="num">{r.days90Plus}</td>
                  <td className="num bold">{r.total}</td>
                </tr>
              ))}
              {(!ageingData.rows || ageingData.rows.length === 0) && (
                <tr>
                  <td colSpan={8} className="muted">
                    No outstanding receivables for the selected filters.
                  </td>
                </tr>
              )}
              {ageingData.totals && (
                <tr className="tot">
                  <td colSpan={2}>Total</td>
                  <td className="num">{ageingData.totals.current}</td>
                  <td className="num">{ageingData.totals.days1To30}</td>
                  <td className="num">{ageingData.totals.days31To60}</td>
                  <td className="num">{ageingData.totals.days61To90}</td>
                  <td className="num">{ageingData.totals.days90Plus}</td>
                  <td className="num">RM {ageingData.totals.total}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* 2. Quotation Pipeline */}
      {tab === 'pipeline' && pipelineData && (
        <div className="grid g2">
          <div className="card">
            <div className="top" style={{ marginBottom: 8 }}>
              <h2 style={{ margin: 0 }}>Pipeline by Status (Latest Revisions)</h2>
              <span className="sp" />
              <span className="pill info">
                Win Rate: {pipelineData.winRate !== null ? `${pipelineData.winRate}%` : 'N/A'}
              </span>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Status</th>
                  <th className="num">Count</th>
                  <th className="num">Total Value (RM)</th>
                </tr>
              </thead>
              <tbody>
                {(pipelineData.byStatus || []).map((row: any) => (
                  <tr key={row.status}>
                    <td>
                      <span className="pill">{row.status}</span>
                    </td>
                    <td className="num">{row.count}</td>
                    <td className="num">{row.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card">
            <h2>Pipeline by Month</h2>
            <table>
              <thead>
                <tr>
                  <th>Month</th>
                  <th className="num">Accepted (RM)</th>
                  <th className="num">Sent (RM)</th>
                  <th className="num">Win Rate</th>
                </tr>
              </thead>
              <tbody>
                {(pipelineData.byMonth || []).map((m: any) => {
                  const acc = m.byStatus.find((s: any) => s.status === 'ACCEPTED');
                  const sent = m.byStatus.find((s: any) => s.status === 'SENT');
                  return (
                    <tr key={m.month}>
                      <td>{m.month}</td>
                      <td className="num">
                        {acc?.count || 0} ({acc?.value || '0.00'})
                      </td>
                      <td className="num">
                        {sent?.count || 0} ({sent?.value || '0.00'})
                      </td>
                      <td className="num">{m.winRate !== null ? `${m.winRate}%` : '-'}</td>
                    </tr>
                  );
                })}
                {(!pipelineData.byMonth || pipelineData.byMonth.length === 0) && (
                  <tr>
                    <td colSpan={4} className="muted">
                      No quotations in this date range.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. Billing & Collections */}
      {tab === 'billing' && billingData && (
        <div className="card">
          <h2>Billing &amp; Collections by Month</h2>
          <table>
            <thead>
              <tr>
                <th>Month</th>
                <th className="num">Invoiced (RM)</th>
                <th className="num">Received (RM)</th>
                <th className="num">Net Difference (RM)</th>
              </tr>
            </thead>
            <tbody>
              {(billingData.months || []).map((m: any) => {
                const diff = (Number(m.invoiced || 0) - Number(m.received || 0)).toFixed(2);
                return (
                  <tr key={m.month}>
                    <td>{m.month}</td>
                    <td className="num">{m.invoiced}</td>
                    <td className="num">{m.received}</td>
                    <td className="num">{diff}</td>
                  </tr>
                );
              })}
              {billingData.totals && (
                <tr className="tot">
                  <td>Total</td>
                  <td className="num">RM {billingData.totals.invoiced}</td>
                  <td className="num">RM {billingData.totals.received}</td>
                  <td className="num">
                    RM{' '}
                    {(
                      Number(billingData.totals.invoiced || 0) -
                      Number(billingData.totals.received || 0)
                    ).toFixed(2)}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* 4. Retention Register */}
      {tab === 'retention' && retentionData && (
        <div className="card">
          <h2>Retention Register</h2>
          <table>
            <thead>
              <tr>
                <th>Project</th>
                <th>Client</th>
                <th className="num">Held (RM)</th>
                <th className="num">Released (RM)</th>
                <th className="num">Balance (RM)</th>
                <th>Expected Release Schedule</th>
              </tr>
            </thead>
            <tbody>
              {(retentionData.rows || []).map((r: any) => (
                <tr key={r.project.id}>
                  <td>
                    <Link to={`/projects/${r.project.id}`} className="bold">
                      {r.project.code}
                    </Link>{' '}
                    &middot; {r.project.name}
                  </td>
                  <td>{r.client.name}</td>
                  <td className="num">{r.held}</td>
                  <td className="num">{r.released}</td>
                  <td className="num bold">{r.balance}</td>
                  <td>
                    {(r.expectedReleases || []).length === 0 ? (
                      <span className="small muted">Set project end date to calculate milestones</span>
                    ) : (
                      (r.expectedReleases || []).map((er: any, idx: number) => (
                        <div key={idx} className="small">
                          <span className="pill">{er.milestone}</span> {er.date}: RM {er.amount}
                        </div>
                      ))
                    )}
                  </td>
                </tr>
              ))}
              {(!retentionData.rows || retentionData.rows.length === 0) && (
                <tr>
                  <td colSpan={6} className="muted">
                    No retention records found.
                  </td>
                </tr>
              )}
              {retentionData.totals && (
                <tr className="tot">
                  <td colSpan={2}>Total</td>
                  <td className="num">RM {retentionData.totals.held}</td>
                  <td className="num">RM {retentionData.totals.released}</td>
                  <td className="num">RM {retentionData.totals.balance}</td>
                  <td />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* 5. Daily Report Compliance */}
      {tab === 'compliance' && complianceData && (
        <div className="grid g2">
          <div className="card">
            <h2>Compliance by Project ({complianceData.from} to {complianceData.to})</h2>
            <table>
              <thead>
                <tr>
                  <th>Project</th>
                  <th className="num">Expected Days</th>
                  <th className="num">Submitted</th>
                  <th className="num">Compliance</th>
                </tr>
              </thead>
              <tbody>
                {(complianceData.byProject || []).map((row: any) => (
                  <tr key={row.project.id}>
                    <td>
                      <Link to={`/projects/${row.project.id}`} className="bold">
                        {row.project.code}
                      </Link>{' '}
                      &middot; {row.project.name}
                    </td>
                    <td className="num">{row.expected}</td>
                    <td className="num">{row.submitted}</td>
                    <td className="num">
                      <span
                        className={`pill ${
                          Number(row.compliancePercent) >= 80
                            ? 'ok'
                            : Number(row.compliancePercent) >= 50
                              ? 'warn'
                              : 'bad'
                        }`}
                      >
                        {row.compliancePercent}%
                      </span>
                    </td>
                  </tr>
                ))}
                {(!complianceData.byProject || complianceData.byProject.length === 0) && (
                  <tr>
                    <td colSpan={4} className="muted">
                      No active projects in this period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="card">
            <h2>Compliance by Site Staff</h2>
            <table>
              <thead>
                <tr>
                  <th>Site Staff</th>
                  <th>Project</th>
                  <th className="num">Expected</th>
                  <th className="num">Submitted</th>
                  <th className="num">Compliance</th>
                </tr>
              </thead>
              <tbody>
                {(complianceData.bySiteStaff || []).map((row: any, idx: number) => (
                  <tr key={`${row.user.id}-${row.project.id}-${idx}`}>
                    <td>{row.user.name}</td>
                    <td>{row.project.code}</td>
                    <td className="num">{row.expected}</td>
                    <td className="num">{row.submitted}</td>
                    <td className="num">
                      <span className="pill">{row.compliancePercent}%</span>
                    </td>
                  </tr>
                ))}
                {(!complianceData.bySiteStaff || complianceData.bySiteStaff.length === 0) && (
                  <tr>
                    <td colSpan={5} className="muted">
                      No site staff assigned to projects in this period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
