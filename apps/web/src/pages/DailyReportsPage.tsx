import React, { useEffect, useState } from 'react';
import { Role } from '@construction/shared';
import { apiDownload, apiFetch, apiUploadFile, getFileContentUrl } from '../lib/api';
import { authStore } from '../lib/auth';
import { activeProjectStore } from '../lib/active-project';

function generateUuidV4(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function getKlTodayYmd(): string {
  const now = new Date();
  const klMs = now.getTime() + 8 * 60 * 60 * 1000;
  return new Date(klMs).toISOString().slice(0, 10);
}

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

  // Submit / Edit Daily Report form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingReportId, setEditingReportId] = useState<string | null>(null);
  const [reportDate, setReportDate] = useState(getKlTodayYmd());
  const [weather, setWeather] = useState<'SUNNY' | 'CLOUDY' | 'RAIN' | 'HEAVY_RAIN'>('SUNNY');
  const [workDone, setWorkDone] = useState('');
  const [issues, setIssues] = useState('');
  const [nextDayPlan, setNextDayPlan] = useState('');
  const [manpowerRows, setManpowerRows] = useState<Array<{ trade: string; headcount: number }>>([
    { trade: 'General Worker', headcount: 4 },
  ]);
  const [uploadedPhotos, setUploadedPhotos] = useState<
    Array<{ fileId: string; caption: string; fileName: string }>
  >([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [submittingReport, setSubmittingReport] = useState(false);

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
    const today = getKlTodayYmd();
    const from = selectedReport?.reportDate || today;
    apiDownload(
      `/projects/${selectedProjectId}/site-report.pdf?from=${from}&to=${from}`,
      `site-report-${from}.pdf`,
    ).catch((err) => setError(err.message));
  };

  const openNewReportForm = () => {
    setEditingReportId(null);
    setReportDate(getKlTodayYmd());
    setWeather('SUNNY');
    setWorkDone('');
    setIssues('');
    setNextDayPlan('');
    setManpowerRows([{ trade: 'General Worker', headcount: 4 }]);
    setUploadedPhotos([]);
    setShowCreateForm(true);
  };

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setUploadingPhoto(true);
    setError(null);
    try {
      for (const file of files) {
        const res = await apiUploadFile(file, 'DAILY_REPORT_PHOTO');
        setUploadedPhotos((prev) => [
          ...prev,
          { fileId: res.fileId, caption: file.name.replace(/\.[^.]+$/, ''), fileName: file.name },
        ]);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploadingPhoto(false);
      e.target.value = '';
    }
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId) {
      setError('Please select a project first.');
      return;
    }
    setSubmittingReport(true);
    setError(null);
    try {
      const reportId = editingReportId || generateUuidV4();
      const saved = await apiFetch(`/daily-reports/${reportId}`, {
        method: 'PUT',
        body: JSON.stringify({
          projectId: selectedProjectId,
          reportDate,
          weather,
          workDone,
          issues: issues.trim() || null,
          nextDayPlan: nextDayPlan.trim() || null,
          manpower: manpowerRows.filter((m) => m.trade.trim() && Number(m.headcount) > 0),
          photos: uploadedPhotos.map((p) => ({
            fileId: p.fileId,
            caption: p.caption.trim() || null,
            takenAt: new Date().toISOString(),
          })),
        }),
      });
      setShowCreateForm(false);
      await loadReports(selectedProjectId);
      setSelectedReport(saved);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmittingReport(false);
    }
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
        <button
          className="btn pri"
          onClick={() => (showCreateForm ? setShowCreateForm(false) : openNewReportForm())}
        >
          {showCreateForm ? 'Close form' : '+ Submit Daily Report & Photos'}
        </button>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {showCreateForm && (
        <div className="card">
          <h2>Submit Daily Site Report &amp; Upload Site Photos</h2>
          <form onSubmit={handleSubmitReport}>
            <div className="grid g3" style={{ gap: 10 }}>
              <div>
                <label>Report Date (today or up to 2 days back)</label>
                <input
                  type="date"
                  required
                  value={reportDate}
                  onChange={(e) => setReportDate(e.target.value)}
                />
              </div>
              <div>
                <label>Weather</label>
                <select value={weather} onChange={(e) => setWeather(e.target.value as any)}>
                  <option value="SUNNY">SUNNY</option>
                  <option value="CLOUDY">CLOUDY</option>
                  <option value="RAIN">RAIN</option>
                  <option value="HEAVY_RAIN">HEAVY_RAIN</option>
                </select>
              </div>
            </div>

            <div className="grid g3" style={{ gap: 10, marginTop: 10 }}>
              <div>
                <label>Work Done Today</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Describe site progress and completed work..."
                  value={workDone}
                  onChange={(e) => setWorkDone(e.target.value)}
                />
              </div>
              <div>
                <label>Issues / Delays (Optional)</label>
                <textarea
                  rows={3}
                  placeholder="Any material delay, rain stoppage, or site issue..."
                  value={issues}
                  onChange={(e) => setIssues(e.target.value)}
                />
              </div>
              <div>
                <label>Plan for Next Working Day (Optional)</label>
                <textarea
                  rows={3}
                  placeholder="Tomorrow's planned activities..."
                  value={nextDayPlan}
                  onChange={(e) => setNextDayPlan(e.target.value)}
                />
              </div>
            </div>

            <div className="grid g2" style={{ gap: 16, marginTop: 12 }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label style={{ margin: 0, fontWeight: 600, color: 'var(--text)' }}>Manpower on Site</label>
                  <button
                    type="button"
                    className="btn sm"
                    onClick={() =>
                      setManpowerRows((prev) => [...prev, { trade: '', headcount: 1 }])
                    }
                  >
                    + Add Trade
                  </button>
                </div>
                {manpowerRows.map((row, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                    <input
                      placeholder="Trade (e.g. Electrician, Carpenter)"
                      value={row.trade}
                      onChange={(e) => {
                        const next = [...manpowerRows];
                        next[idx] = { ...next[idx], trade: e.target.value };
                        setManpowerRows(next);
                      }}
                    />
                    <input
                      type="number"
                      min={1}
                      style={{ width: 90 }}
                      value={row.headcount}
                      onChange={(e) => {
                        const next = [...manpowerRows];
                        next[idx] = { ...next[idx], headcount: Number(e.target.value) };
                        setManpowerRows(next);
                      }}
                    />
                    {manpowerRows.length > 1 && (
                      <button
                        type="button"
                        className="btn sm"
                        onClick={() =>
                          setManpowerRows((prev) => prev.filter((_, i) => i !== idx))
                        }
                      >
                        &times;
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div>
                <label style={{ fontWeight: 600, color: 'var(--text)' }}>
                  Upload Site Photos (stored in S3 / R2 bucket)
                </label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  disabled={uploadingPhoto}
                  onChange={handlePhotoSelect}
                />
                {uploadingPhoto && (
                  <div className="small muted" style={{ marginTop: 4 }}>
                    Uploading photo(s) to S3 bucket...
                  </div>
                )}
                {uploadedPhotos.length > 0 && (
                  <div className="grid g2" style={{ gap: 8, marginTop: 8 }}>
                    {uploadedPhotos.map((p, idx) => (
                      <div key={p.fileId} className="card" style={{ padding: 8, margin: 0 }}>
                        <img
                          src={getFileContentUrl(p.fileId)}
                          alt={p.caption}
                          style={{
                            width: '100%',
                            height: 90,
                            objectFit: 'cover',
                            borderRadius: 4,
                            marginBottom: 6,
                          }}
                        />
                        <input
                          placeholder="Photo caption"
                          value={p.caption}
                          onChange={(e) => {
                            const next = [...uploadedPhotos];
                            next[idx] = { ...next[idx], caption: e.target.value };
                            setUploadedPhotos(next);
                          }}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button
                type="submit"
                className="btn pri"
                disabled={submittingReport || uploadingPhoto}
              >
                {submittingReport ? 'Submitting...' : 'Save Daily Report'}
              </button>
              <button type="button" className="btn" onClick={() => setShowCreateForm(false)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

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
                    {p.fileId ? (
                      <a
                        href={getFileContentUrl(p.fileId)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <img
                          src={getFileContentUrl(p.fileId)}
                          alt={p.caption || 'Site photo'}
                          style={{
                            width: '100%',
                            aspectRatio: '4/3',
                            objectFit: 'cover',
                            borderRadius: 6,
                            marginBottom: 6,
                            background: '#eef1f6',
                          }}
                        />
                      </a>
                    ) : (
                      <div
                        style={{
                          background: 'linear-gradient(135deg, #cfd6e4, #aab4c8)',
                          aspectRatio: '4/3',
                          borderRadius: 6,
                          marginBottom: 6,
                        }}
                      />
                    )}
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
