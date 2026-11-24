import React, { useEffect, useState } from 'react';
import { Role } from '@construction/shared';
import { apiFetch } from '../lib/api';
import { authStore } from '../lib/auth';
import { activeProjectStore } from '../lib/active-project';

export const DailyReportsPage: React.FC = () => {
  const { user } = authStore.getState();
  const canReview =
    user?.role === Role.OWNER ||
    user?.role === Role.OFFICE ||
    user?.role === Role.PROJECT_MANAGER;

  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState(activeProjectStore.getProjectId());
  const [reports, setReports] = useState<any[]>([]);
  const [selectedReport, setSelectedReport] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return activeProjectStore.subscribe(() => {
      const next = activeProjectStore.getProjectId();
      if (next) setSelectedProjectId(next);
    });
  }, []);

  useEffect(() => {
    apiFetch('/projects?pageSize=100').then((res) => {
      const list = res.items || [];
      setProjects(list);
      const activeId = activeProjectStore.getProjectId();
      if (activeId && list.some((p: any) => p.id === activeId)) {
        setSelectedProjectId(activeId);
      } else if (list[0]) {
        setSelectedProjectId(list[0].id);
      }
    });
  }, []);

  const loadReports = async (projId: string) => {
    if (!projId) return;
    try {
      const res = await apiFetch(`/daily-reports?projectId=${projId}&pageSize=100`);
      const items = res.items || [];
      setReports(items);
      setSelectedReport(items[0] || null);
    } catch (err: any) {
      setError(err.message);
    }
  };

  useEffect(() => {
    if (selectedProjectId) {
      loadReports(selectedProjectId);
    }
  }, [selectedProjectId]);

  const handleMarkReviewed = async (reportId: string) => {
    try {
      const updated = await apiFetch(`/daily-reports/${reportId}/review`, {
        method: 'POST',
      });
      setSelectedReport(updated);
      await loadReports(selectedProjectId);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDownloadSitePdf = () => {
    if (!selectedProjectId) return;
    const today = new Date().toISOString().slice(0, 10);
    const from = selectedReport?.reportDate || today;
    window.open(
      `/api/v1/projects/${selectedProjectId}/site-report.pdf?from=${from}&to=${from}`,
      '_blank',
    );
  };

  const reportDates = new Set(reports.map((r) => r.reportDate));

  return (
    <div>
      <div className="top">
        <h1>Daily reports</h1>
        <span className="sp" />
        <select
          style={{ width: 280 }}
          value={selectedProjectId}
          onChange={(e) => setSelectedProjectId(e.target.value)}
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.code} {p.name}
            </option>
          ))}
        </select>
        {canReview && (
          <button className="btn" onClick={handleDownloadSitePdf}>
            Site report PDF
          </button>
        )}
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="split split-left">
        <div className="card">
          <h2>Report calendar</h2>
          <div className="cal">
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
              <div key={i} className="h">
                {d}
              </div>
            ))}
            {Array.from({ length: 28 }, (_, idx) => {
              const day = idx + 1;
              const dateStr = `2026-11-${String(day).padStart(2, '0')}`;
              const hasReport = reportDates.has(dateStr);
              const isSunday = day % 7 === 0;
              return (
                <div
                  key={day}
                  className={isSunday ? 'o' : hasReport ? 'y' : ''}
                  onClick={() => {
                    const found = reports.find((r) => r.reportDate === dateStr);
                    if (found) setSelectedReport(found);
                  }}
                >
                  {day}
                </div>
              );
            })}
          </div>
          <p className="small muted" style={{ marginTop: 10 }}>
            Green: report received. Grey: non-working day.
          </p>

          <h3 style={{ marginTop: 14 }}>Recent reports</h3>
          {reports.map((r) => (
            <div
              key={r.id}
              onClick={() => setSelectedReport(r)}
              style={{
                padding: '8px 10px',
                borderBottom: '1px solid var(--line)',
                cursor: 'pointer',
                background: selectedReport?.id === r.id ? 'var(--brand-soft)' : 'transparent',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <b>{r.reportDate}</b>
                <span className={`pill ${r.status === 'REVIEWED' ? 'info' : 'warn'}`}>
                  {r.status}
                </span>
              </div>
              <div className="small muted">{r.submittedBy?.name || 'Site staff'}</div>
            </div>
          ))}
        </div>

        <div className="card">
          {!selectedReport ? (
            <p className="muted">Select a daily report to view details.</p>
          ) : (
            <>
              <div className="top" style={{ marginBottom: 8 }}>
                <h2 style={{ margin: 0 }}>{selectedReport.reportDate}</h2>
                <span
                  className={`pill ${
                    selectedReport.status === 'REVIEWED' ? 'info' : 'warn'
                  }`}
                >
                  {selectedReport.status === 'REVIEWED' ? 'Reviewed' : 'Not reviewed'}
                </span>
                <span className="sp" />
                {canReview && selectedReport.status !== 'REVIEWED' && (
                  <button
                    className="btn pri sm"
                    onClick={() => handleMarkReviewed(selectedReport.id)}
                  >
                    Mark reviewed
                  </button>
                )}
              </div>
              <p className="small muted">
                Submitted by {selectedReport.submittedBy?.name || '-'} &middot;{' '}
                {selectedReport.weather || '-'}
                {selectedReport.latitude
                  ? ` · GPS ${selectedReport.latitude}, ${selectedReport.longitude}`
                  : ''}
              </p>
              <div className="grid g2">
                <div>
                  <h3>Work done</h3>
                  <p>{selectedReport.workDone}</p>
                  <h3>Issues / delays</h3>
                  <p>{selectedReport.issues || 'None'}</p>
                  <h3>Plan for tomorrow</h3>
                  <p>{selectedReport.nextDayPlan || '-'}</p>
                </div>
                <div>
                  <h3>Manpower</h3>
                  <table>
                    <thead>
                      <tr>
                        <th>Trade</th>
                        <th className="num">Headcount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedReport.manpower || []).map((m: any) => (
                        <tr key={m.id || m.trade}>
                          <td>{m.trade}</td>
                          <td className="num">{m.headcount}</td>
                        </tr>
                      ))}
                      <tr className="tot">
                        <td>Total</td>
                        <td className="num">
                          {(selectedReport.manpower || []).reduce(
                            (acc: number, m: any) => acc + Number(m.headcount),
                            0,
                          )}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
              <h3 style={{ marginTop: 14 }}>
                Photos ({selectedReport.photos?.length || 0})
              </h3>
              <div className="grid g4">
                {(selectedReport.photos || []).map((p: any) => (
                  <div key={p.id || p.fileId} className="card" style={{ padding: 8 }}>
                    <div
                      style={{
                        background: 'linear-gradient(135deg, #cfd6e4, #aab4c8)',
                        aspectRatio: '4/3',
                        borderRadius: 6,
                        marginBottom: 6,
                      }}
                    />
                    <div className="small">{p.caption || 'Site photo'}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
