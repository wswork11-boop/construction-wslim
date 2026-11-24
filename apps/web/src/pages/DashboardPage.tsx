import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Role } from '@construction/shared';
import { apiDownload, apiFetch } from '../lib/api';
import { authStore } from '../lib/auth';
import { activeProjectStore } from '../lib/active-project';

export const DashboardPage: React.FC = () => {
  const { user } = authStore.getState();
  const isOwnerOrOffice = user?.role === Role.OWNER || user?.role === Role.OFFICE;

  const [activeCompanyId, setActiveCompanyId] = useState(activeProjectStore.getCompanyId());
  const [dashboard, setDashboard] = useState<any>(null);
  const [ageing, setAgeing] = useState<any>(null);
  const [billing, setBilling] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return activeProjectStore.subscribe(() => {
      setActiveCompanyId(activeProjectStore.getCompanyId());
    });
  }, []);

  const loadDashboard = async (compId = activeCompanyId) => {
    if (!isOwnerOrOffice) return;
    try {
      const qs = compId ? `?companyId=${compId}` : '';
      const [d, a, b] = await Promise.all([
        apiFetch(`/reports/dashboard${qs}`),
        apiFetch(`/reports/receivables-ageing${qs}`),
        apiFetch(`/reports/billing-collections${qs}`),
      ]);
      setDashboard(d);
      setAgeing(a);
      setBilling(b);
    } catch (err: any) {
      setError(err.message);
    }
  };

  useEffect(() => {
    loadDashboard(activeCompanyId);
  }, [activeCompanyId]);

  if (!isOwnerOrOffice) {
    return (
      <div className="card">
        <h2>Dashboard</h2>
        <p className="muted">
          Welcome, {user?.name}. Use the <Link to="/projects">Projects</Link> or{' '}
          <Link to="/daily-reports">Daily Reports</Link> menu on the left to view your assigned
          projects.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="top">
        <h1>Dashboard</h1>
        <span className="sp" />
        <Link to="/reports" className="btn">
          View All Reports
        </Link>
        <button
          className="btn pri"
          onClick={() =>
            apiDownload(
              `/reports/dashboard?format=xlsx${activeCompanyId ? `&companyId=${activeCompanyId}` : ''}`,
              'dashboard-report.xlsx',
            )
          }
        >
          Export Excel
        </button>
      </div>

      {error && (
        <div className="card" style={{ borderColor: '#b42318', color: '#b42318' }}>
          {error}
        </div>
      )}

      {dashboard && (
        <>
          <div className="grid g4">
            <div className="card stat">
              <div className="l">Active projects</div>
              <div className="v">{dashboard.activeProjects}</div>
            </div>
            <div className="card stat">
              <div className="l">Quotations awaiting reply</div>
              <div className="v">
                {dashboard.quotationsAwaitingReply?.count || 0}{' '}
                <span className="small muted">
                  RM {dashboard.quotationsAwaitingReply?.value || '0.00'}
                </span>
              </div>
            </div>
            <div className="card stat">
              <div className="l">Invoiced this month</div>
              <div className="v">RM {dashboard.invoicedThisMonth}</div>
            </div>
            <div className="card stat">
              <div className="l">Received this month</div>
              <div className="v">RM {dashboard.receivedThisMonth}</div>
            </div>
          </div>

          <div className="grid g2">
            <div className="card">
              <div className="top" style={{ marginBottom: 8 }}>
                <h2 style={{ margin: 0 }}>Outstanding by age</h2>
                <span className="sp" />
                <Link to="/reports?tab=ageing" className="small">
                  Full ageing report &rarr;
                </Link>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Client</th>
                    <th className="num">Current</th>
                    <th className="num">1-30 d</th>
                    <th className="num">31-60 d</th>
                    <th className="num">61+ d</th>
                    <th className="num">Total (RM)</th>
                  </tr>
                </thead>
                <tbody>
                  {(ageing?.rows || []).map((r: any) => {
                    const over60 = (
                      Number(r.days61To90 || 0) + Number(r.days90Plus || 0)
                    ).toFixed(2);
                    return (
                      <tr key={r.client.id}>
                        <td>{r.client.name}</td>
                        <td className="num">{r.current}</td>
                        <td className="num">
                          {Number(r.days1To30) > 0 ? (
                            <span className="pill warn">{r.days1To30}</span>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="num">
                          {Number(r.days31To60) > 0 ? (
                            <span className="pill bad">{r.days31To60}</span>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="num">
                          {Number(over60) > 0 ? <span className="pill bad">{over60}</span> : '-'}
                        </td>
                        <td className="num bold">{r.total}</td>
                      </tr>
                    );
                  })}
                  {(!ageing?.rows || ageing.rows.length === 0) && (
                    <tr>
                      <td colSpan={6} className="muted">
                        No outstanding receivables.
                      </td>
                    </tr>
                  )}
                  {ageing?.totals && (
                    <tr className="tot">
                      <td>Total Outstanding</td>
                      <td className="num">{ageing.totals.current}</td>
                      <td className="num">{ageing.totals.days1To30}</td>
                      <td className="num">{ageing.totals.days31To60}</td>
                      <td className="num">
                        {(
                          Number(ageing.totals.days61To90 || 0) +
                          Number(ageing.totals.days90Plus || 0)
                        ).toFixed(2)}
                      </td>
                      <td className="num">RM {dashboard.totalOutstanding}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="card">
              <h2>No daily report yesterday</h2>
              <table>
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Project</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(dashboard.projectsWithNoReportYesterday || []).map((p: any) => (
                    <tr key={p.id}>
                      <td>
                        <Link to={`/projects/${p.id}`} className="bold">
                          {p.code}
                        </Link>
                      </td>
                      <td>{p.name}</td>
                      <td>
                        <span className="pill warn">Missing report</span>
                      </td>
                    </tr>
                  ))}
                  {(!dashboard.projectsWithNoReportYesterday ||
                    dashboard.projectsWithNoReportYesterday.length === 0) && (
                    <tr>
                      <td colSpan={3} className="muted">
                        All active projects submitted daily reports yesterday (or yesterday was Sunday).
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              <h2 style={{ marginTop: 18 }}>Retention &amp; Receivables Summary</h2>
              <div className="kv">
                <span>Total Outstanding Receivables</span>
                <span className="bold">RM {dashboard.totalOutstanding}</span>
              </div>
              <div className="kv">
                <span>Total Retention Held Across Projects</span>
                <span className="bold">RM {dashboard.totalRetentionHeld}</span>
              </div>
              <div className="kv">
                <span>Expenses Recorded This Month</span>
                <span className="bold">
                  RM {dashboard.expensesThisMonth || '0.00'}{' '}
                  <Link to="/expenses" className="small">
                    (Manage &rarr;)
                  </Link>
                </span>
              </div>
            </div>
          </div>

          {billing?.months && (
            <div className="card">
              <div className="top" style={{ marginBottom: 8 }}>
                <h2 style={{ margin: 0 }}>Billing vs. Collections (Last 12 Months)</h2>
                <span className="sp" />
                <Link to="/reports?tab=billing" className="small">
                  Full report &rarr;
                </Link>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Month</th>
                    <th className="num">Invoiced (RM)</th>
                    <th className="num">Received (RM)</th>
                    <th style={{ width: '40%' }}>Comparison</th>
                  </tr>
                </thead>
                <tbody>
                  {billing.months.slice(-6).map((m: any) => {
                    const invNum = Number(m.invoiced || 0);
                    const recNum = Number(m.received || 0);
                    const pct =
                      invNum > 0 ? Math.min(100, Math.round((recNum / invNum) * 100)) : 0;
                    return (
                      <tr key={m.month}>
                        <td>{m.month}</td>
                        <td className="num">{m.invoiced}</td>
                        <td className="num">{m.received}</td>
                        <td>
                          <div className="bar">
                            <i style={{ width: `${pct}%` }} />
                          </div>
                          <span className="small muted">{pct}% collected</span>
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="tot">
                    <td>12-Month Total</td>
                    <td className="num">RM {billing.totals?.invoiced || '0.00'}</td>
                    <td className="num">RM {billing.totals?.received || '0.00'}</td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
};
