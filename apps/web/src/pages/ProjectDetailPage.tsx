import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Role } from '@construction/shared';
import { apiDownload, apiFetch } from '../lib/api';
import { authStore } from '../lib/auth';

export const ProjectDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = authStore.getState();
  const canEdit = user?.role === Role.OWNER || user?.role === Role.OFFICE;
  const isSiteStaff = user?.role === Role.SITE_STAFF;

  const [project, setProject] = useState<any>(null);
  const [contract, setContract] = useState<any>(null);
  const [projectSummary, setProjectSummary] = useState<any>(null);
  const [variationOrders, setVariationOrders] = useState<any[]>([]);
  const [progressReports, setProgressReports] = useState<any[]>([]);
  const [inspectionReports, setInspectionReports] = useState<any[]>([]);
  const [projectInvoices, setProjectInvoices] = useState<any[]>([]);
  const [projectExpenses, setProjectExpenses] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [tab, setTab] = useState<
    'overview' | 'contract' | 'vos' | 'claims' | 'expenses' | 'reports' | 'team'
  >('overview');

  // Variation Order form
  const [showVoForm, setShowVoForm] = useState(false);
  const [voTitle, setVoTitle] = useState('');
  const [voReason, setVoReason] = useState('');
  const [voDesc, setVoDesc] = useState('');
  const [voQty, setVoQty] = useState('1.000');
  const [voRate, setVoRate] = useState('1000.00');

  // Progress Report (PR) form
  const [showPrForm, setShowPrForm] = useState(false);
  const [prSummary, setPrSummary] = useState('');
  const [prPercent, setPrPercent] = useState('30.00');

  // Inspection Report (IR) form
  const [showIrForm, setShowIrForm] = useState(false);
  const [irTitle, setIrTitle] = useState('');
  const [irFindings, setIrFindings] = useState('');

  // Retention release
  const [retAmount, setRetAmount] = useState('');
  const [selectedPrIdForClaim, setSelectedPrIdForClaim] = useState('');

  const [error, setError] = useState<string | null>(null);

  const loadProject = async () => {
    if (!id) return;
    try {
      const p = await apiFetch(`/projects/${id}`);
      setProject(p);
      setSelectedUserIds((p.members || []).map((m: any) => m.userId));

      if (!isSiteStaff) {
        await Promise.all([
          apiFetch(`/projects/${id}/contract`)
            .then(setContract)
            .catch(() => setContract(null)),
          apiFetch(`/reports/projects/${id}/summary`)
            .then(setProjectSummary)
            .catch(() => setProjectSummary(null)),
          apiFetch(`/projects/${id}/variation-orders`)
            .then((r) => setVariationOrders(r.items || []))
            .catch(() => setVariationOrders([])),
          apiFetch(`/projects/${id}/progress-reports`)
            .then((r) => setProgressReports(r.items || []))
            .catch(() => setProgressReports([])),
          apiFetch(`/projects/${id}/inspection-reports`)
            .then((r) => setInspectionReports(r.items || []))
            .catch(() => setInspectionReports([])),
          apiFetch(`/invoices?projectId=${id}&pageSize=100`)
            .then((r) => setProjectInvoices(r.items || []))
            .catch(() => setProjectInvoices([])),
          apiFetch(`/expenses?projectId=${id}&pageSize=100`)
            .then((r) => setProjectExpenses(r.items || []))
            .catch(() => setProjectExpenses([])),
        ]);
      }

      if (user?.role === Role.OWNER) {
        const uRes = await apiFetch('/users?pageSize=100&isActive=true');
        setAllUsers(uRes.items || []);
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  useEffect(() => {
    loadProject();
  }, [id]);

  const handleSaveMembers = async () => {
    if (!id) return;
    try {
      await apiFetch(`/projects/${id}/members`, {
        method: 'PUT',
        body: JSON.stringify({ userIds: selectedUserIds }),
      });
      await loadProject();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleCreateVo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    try {
      await apiFetch(`/projects/${id}/variation-orders`, {
        method: 'POST',
        body: JSON.stringify({
          title: voTitle,
          reason: voReason || null,
          items: [
            {
              description: voDesc,
              unit: 'LS',
              quantity: Number(voQty).toFixed(3),
              rate: Number(voRate).toFixed(2),
            },
          ],
        }),
      });
      setShowVoForm(false);
      setVoTitle('');
      setVoReason('');
      setVoDesc('');
      await loadProject();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleVoAction = async (voId: string, action: 'submit' | 'approve' | 'reject') => {
    try {
      await apiFetch(`/variation-orders/${voId}/${action}`, { method: 'POST' });
      await loadProject();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleCreatePr = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    try {
      const lines = (contract?.items || []).map((ci: any) => ({
        contractItemId: ci.id,
        cumulativePercent: Number(prPercent || 0).toFixed(2),
      }));
      await apiFetch(`/projects/${id}/progress-reports`, {
        method: 'POST',
        body: JSON.stringify({
          summary: prSummary,
          overallPercent: Number(prPercent || 0).toFixed(2),
          lines,
        }),
      });
      setShowPrForm(false);
      setPrSummary('');
      await loadProject();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleCreateIr = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    try {
      await apiFetch(`/projects/${id}/inspection-reports`, {
        method: 'POST',
        body: JSON.stringify({
          title: irTitle,
          findings: irFindings || null,
          status: 'PASSED',
        }),
      });
      setShowIrForm(false);
      setIrTitle('');
      setIrFindings('');
      await loadProject();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleCreateProgressClaim = async () => {
    if (!id) return;
    try {
      const created = await apiFetch(`/projects/${id}/progress-claims`, {
        method: 'POST',
        body: JSON.stringify({
          ...(selectedPrIdForClaim ? { progressReportId: selectedPrIdForClaim } : {}),
        }),
      });
      navigate(`/invoices/${created.id}`);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleCreateRetentionRelease = async () => {
    if (!id || !retAmount) return;
    try {
      const created = await apiFetch(`/projects/${id}/retention-releases`, {
        method: 'POST',
        body: JSON.stringify({
          amount: Number(retAmount).toFixed(2),
        }),
      });
      navigate(`/invoices/${created.id}`);
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (!project) return <div>Loading...</div>;

  return (
    <div>
      <div className="top">
        <div>
          <h1>
            {project.code} {project.name}
          </h1>
          <span className="muted">
            Client: <b>{project.client?.name}</b> ({project.client?.code})
            {project.contractQuoteRef ? ` · Contract Quote: ${project.contractQuoteRef}` : ''}
            {project.siteAddress ? ` · ${project.siteAddress}` : ''}
          </span>
        </div>
        <span className="sp" />
        <span className={`pill ${project.status === 'ACTIVE' ? 'ok' : ''}`}>
          {project.status}
        </span>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="tabs">
        <span className={tab === 'overview' ? 'on' : ''} onClick={() => setTab('overview')}>
          Summary
        </span>
        {!isSiteStaff && (
          <>
            <span className={tab === 'contract' ? 'on' : ''} onClick={() => setTab('contract')}>
              Contract
            </span>
            <span className={tab === 'vos' ? 'on' : ''} onClick={() => setTab('vos')}>
              Variation orders ({variationOrders.length})
            </span>
            <span className={tab === 'claims' ? 'on' : ''} onClick={() => setTab('claims')}>
              Claims &amp; invoices ({projectInvoices.length})
            </span>
            <span className={tab === 'expenses' ? 'on' : ''} onClick={() => setTab('expenses')}>
              Expenses ({projectExpenses.length})
            </span>
            <span className={tab === 'reports' ? 'on' : ''} onClick={() => setTab('reports')}>
              Reports (PR / IR)
            </span>
          </>
        )}
        <span className={tab === 'team' ? 'on' : ''} onClick={() => setTab('team')}>
          Team ({project.members?.length || 0})
        </span>
      </div>

      {tab === 'overview' && (
        <div>
          <div className="grid g4">
            {!isSiteStaff && (
              <>
                <div className="card stat">
                  <div className="l">Current contract sum</div>
                  <div className="v">RM {contract?.currentSum || project.contractSum}</div>
                  <div className="small muted">
                    Original {projectSummary?.contractSum || contract?.originalSum || project.contractSum}{' '}
                    + VO {projectSummary?.approvedVariations || contract?.approvedVariationsTotal || '0.00'}
                  </div>
                </div>
                <div className="card stat">
                  <div className="l">Work done to date</div>
                  <div className="v">
                    RM {projectSummary?.claimedToDate || contract?.claimedToDate || '0.00'}
                  </div>
                  <div className="bar" style={{ marginTop: 6 }}>
                    <i
                      style={{
                        width: `${Math.min(100, Number(projectSummary?.percentClaimed || 0))}%`,
                      }}
                    />
                  </div>
                  <div className="small muted">
                    {projectSummary?.percentClaimed || '0.00'}% claimed &middot; Paid RM{' '}
                    {projectSummary?.paidToDate || contract?.paidToDate || '0.00'}
                  </div>
                </div>
                <div className="card stat">
                  <div className="l">Retention held</div>
                  <div className="v">
                    RM {projectSummary?.retentionHeld || contract?.retentionHeld || '0.00'}
                  </div>
                  <div className="small muted">
                    {project.retentionPercent}% (cap {project.retentionCapPercent}%)
                  </div>
                </div>
                <div className="card stat">
                  <div className="l">Outstanding</div>
                  <div className="v">RM {projectSummary?.outstanding || '0.00'}</div>
                  <div className="small muted">
                    Quote Ref: {project.contractQuoteRef || 'Not linked yet'}
                  </div>
                </div>
              </>
            )}
            {isSiteStaff && (
              <div className="card stat">
                <div className="l">Contract Quote Ref</div>
                <div className="v" style={{ fontSize: 16 }}>
                  {project.contractQuoteRef || 'Not linked yet'}
                </div>
              </div>
            )}
          </div>

          {!isSiteStaff && projectSummary && (
            <div className="grid g2">
              <div className="card">
                <div className="top" style={{ marginBottom: 8 }}>
                  <h2 style={{ margin: 0 }}>Daily Report Compliance &amp; Export</h2>
                  <span className="sp" />
                  <button
                    className="btn sm"
                    onClick={() =>
                      apiDownload(
                        `/reports/projects/${project.id}/summary?format=xlsx`,
                        `project-${project.code}-summary.xlsx`,
                      )
                    }
                  >
                    Export Summary (.xlsx)
                  </button>
                </div>
                <div className="kv">
                  <span>Reports submitted vs. Working days</span>
                  <span className="bold">
                    {projectSummary.daysWithReports} of {projectSummary.workingDays} working days
                  </span>
                </div>
                <div className="kv">
                  <span>Total Project Expenses (Purchases &amp; Bills)</span>
                  <span className="bold">RM {projectSummary.totalExpenses || '0.00'}</span>
                </div>
                <div className="kv">
                  <span>Gross Profit (Claimed to Date &minus; Expenses)</span>
                  <span className="bold">RM {projectSummary.grossProfit || '0.00'}</span>
                </div>
                <div className="kv">
                  <span>Contract Quote Reference</span>
                  <span>{project.contractQuoteRef || '-'}</span>
                </div>
                <div className="kv">
                  <span>Site Address</span>
                  <span>{project.siteAddress || '-'}</span>
                </div>
              </div>

              <div className="card">
                <div className="top" style={{ marginBottom: 8 }}>
                  <h2 style={{ margin: 0 }}>Latest site photos</h2>
                  <span className="sp" />
                  <Link to="/daily-reports" className="small">
                    View daily reports &rarr;
                  </Link>
                </div>
                {(!projectSummary.latestPhotos || projectSummary.latestPhotos.length === 0) ? (
                  <p className="small muted">No site photos uploaded yet.</p>
                ) : (
                  <div className="grid g3">
                    {projectSummary.latestPhotos.map((ph: any) => (
                      <div key={ph.fileId} className="ph">
                        <div>{ph.reportDate}</div>
                        <div className="small">{ph.caption || 'Site photo'}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'expenses' && !isSiteStaff && (
        <div className="card">
          <div className="top" style={{ marginBottom: 12 }}>
            <h2 style={{ margin: 0 }}>Project Expenses ({project.code})</h2>
            <span className="sp" />
            <Link to={`/expenses?projectId=${project.id}`} className="btn pri sm">
              + Record Expense for {project.code}
            </Link>
          </div>
          <table>
            <thead>
              <tr>
                <th>Number</th>
                <th>Date</th>
                <th>Category</th>
                <th>Vendor / Shop</th>
                <th>Description</th>
                <th className="num">Total (RM)</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {projectExpenses.map((exp: any) => (
                <tr key={exp.id}>
                  <td className="bold">{exp.number}</td>
                  <td>{exp.expenseDate}</td>
                  <td>
                    <span className="pill">{exp.category}</span>
                  </td>
                  <td>{exp.vendorName}</td>
                  <td>{exp.description}</td>
                  <td className="num bold">{exp.total}</td>
                  <td>
                    <span className="pill">{exp.status}</span>
                  </td>
                </tr>
              ))}
              {projectExpenses.length === 0 && (
                <tr>
                  <td colSpan={7} className="muted">
                    No expenses recorded for this project yet.
                  </td>
                </tr>
              )}
              {projectSummary && (
                <tr className="tot">
                  <td colSpan={5}>Total Project Expenses (RM)</td>
                  <td className="num">{projectSummary.totalExpenses || '0.00'}</td>
                  <td />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'contract' && !isSiteStaff && (
        <div className="card">
          <h2>Project Contract</h2>
          {!contract ? (
            <p className="muted">
              No contract created yet. Accept a quotation to create the project contract.
            </p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Section</th>
                  <th>Description</th>
                  <th>Unit</th>
                  <th className="num">Qty</th>
                  <th className="num">Rate (RM)</th>
                  <th className="num">Amount (RM)</th>
                </tr>
              </thead>
              <tbody>
                {contract.items.map((it: any) => (
                  <tr key={it.id}>
                    <td>{it.sectionTitle || '-'}</td>
                    <td>{it.description}</td>
                    <td>{it.unit || '-'}</td>
                    <td className="num">{it.quantity}</td>
                    <td className="num">{it.rate}</td>
                    <td className="num">{it.amount}</td>
                  </tr>
                ))}
                <tr className="tot">
                  <td colSpan={5}>Current Contract Sum (RM)</td>
                  <td className="num">{contract.currentSum}</td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'vos' && !isSiteStaff && (
        <div>
          <div className="top">
            <h2>Variation Orders</h2>
            <span className="sp" />
            <button className="btn pri sm" onClick={() => setShowVoForm(true)}>
              New variation order
            </button>
          </div>
          {showVoForm && (
            <div className="card">
              <h3>New Variation Order</h3>
              <form onSubmit={handleCreateVo} className="grid g3">
                <div>
                  <label>VO Title</label>
                  <input required value={voTitle} onChange={(e) => setVoTitle(e.target.value)} />
                </div>
                <div style={{ gridColumn: '2 / span 2' }}>
                  <label>Reason</label>
                  <input value={voReason} onChange={(e) => setVoReason(e.target.value)} />
                </div>
                <div>
                  <label>Item description</label>
                  <input required value={voDesc} onChange={(e) => setVoDesc(e.target.value)} />
                </div>
                <div>
                  <label>Qty (negative for omission)</label>
                  <input className="n" value={voQty} onChange={(e) => setVoQty(e.target.value)} />
                </div>
                <div>
                  <label>Rate (RM)</label>
                  <input
                    className="n"
                    value={voRate}
                    onChange={(e) => setVoRate(e.target.value)}
                  />
                </div>
                <div>
                  <button type="submit" className="btn pri sm" style={{ marginRight: 8 }}>
                    Save VO
                  </button>
                  <button type="button" className="btn sm" onClick={() => setShowVoForm(false)}>
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
                  <th>VO Number</th>
                  <th>Short Ref</th>
                  <th>Title</th>
                  <th className="num">Total (RM)</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {variationOrders.map((vo) => (
                  <tr key={vo.id}>
                    <td>{vo.number}</td>
                    <td>
                      <span className="pill">{vo.shortRef || '-'}</span>
                    </td>
                    <td>{vo.title}</td>
                    <td className="num">{vo.total}</td>
                    <td>
                      <span className={`pill ${vo.status === 'APPROVED' ? 'ok' : ''}`}>
                        {vo.status}
                      </span>
                    </td>
                    <td className="right">
                      {vo.status === 'DRAFT' && (
                        <button
                          className="btn sm pri"
                          onClick={() => handleVoAction(vo.id, 'submit')}
                        >
                          Submit
                        </button>
                      )}
                      {vo.status === 'SUBMITTED' && canEdit && (
                        <>
                          <button
                            className="btn sm pri"
                            onClick={() => handleVoAction(vo.id, 'approve')}
                            style={{ marginRight: 6 }}
                          >
                            Approve
                          </button>
                          <button
                            className="btn sm bad"
                            onClick={() => handleVoAction(vo.id, 'reject')}
                          >
                            Reject
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'claims' && !isSiteStaff && (
        <div>
          <div className="card">
            <div className="top" style={{ marginBottom: 0 }}>
              <div>
                <h2 style={{ margin: 0 }}>Create Progress Claim or Retention Release</h2>
                <span className="small muted">
                  Retention currently held: RM {contract?.retentionHeld || '0.00'}
                </span>
              </div>
              <span className="sp" />
              <select
                style={{ width: 220 }}
                value={selectedPrIdForClaim}
                onChange={(e) => setSelectedPrIdForClaim(e.target.value)}
              >
                <option value="">No Progress Report linked</option>
                {progressReports.map((pr) => (
                  <option key={pr.id} value={pr.id}>
                    {pr.number} ({pr.overallPercent}%)
                  </option>
                ))}
              </select>
              <button className="btn pri" onClick={handleCreateProgressClaim}>
                New Progress Claim
              </button>
            </div>
            {canEdit && (
              <div
                style={{
                  marginTop: 12,
                  paddingTop: 12,
                  borderTop: '1px solid var(--line)',
                  display: 'flex',
                  gap: 8,
                  alignItems: 'center',
                }}
              >
                <span className="small muted">Release retention amount (RM):</span>
                <input
                  className="n"
                  style={{ width: 130 }}
                  placeholder="0.00"
                  value={retAmount}
                  onChange={(e) => setRetAmount(e.target.value)}
                />
                <button className="btn sm" onClick={handleCreateRetentionRelease}>
                  Create Retention Release Invoice
                </button>
              </div>
            )}
          </div>

          <div className="card">
            <table>
              <thead>
                <tr>
                  <th>Tax Invoice No.</th>
                  <th>Type</th>
                  <th>Reference</th>
                  <th>Issued</th>
                  <th className="num">Total (RM)</th>
                  <th className="num">Paid (RM)</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {projectInvoices.map((inv) => (
                  <tr key={inv.id}>
                    <td>
                      <Link to={`/invoices/${inv.id}`}>{inv.number || 'DRAFT'}</Link>
                    </td>
                    <td>
                      {inv.type === 'PROGRESS_CLAIM'
                        ? `Claim #${inv.claimNo || '-'}`
                        : inv.type}
                    </td>
                    <td>{inv.referenceSummary || '-'}</td>
                    <td>{inv.issueDate || '-'}</td>
                    <td className="num">{inv.total}</td>
                    <td className="num">{inv.amountPaid}</td>
                    <td>
                      <span className="pill">{inv.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'reports' && !isSiteStaff && (
        <div className="grid g2">
          <div className="card">
            <div className="top">
              <h2 style={{ margin: 0 }}>Progress Reports (PR)</h2>
              <span className="sp" />
              <button className="btn sm pri" onClick={() => setShowPrForm(true)}>
                Issue PR
              </button>
            </div>
            {showPrForm && (
              <form onSubmit={handleCreatePr} style={{ marginBottom: 12 }}>
                <div className="field">
                  <label>Certified overall % complete</label>
                  <input
                    className="n"
                    value={prPercent}
                    onChange={(e) => setPrPercent(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label>Summary</label>
                  <input
                    required
                    value={prSummary}
                    onChange={(e) => setPrSummary(e.target.value)}
                    placeholder="e.g. Month 1 certified work done"
                  />
                </div>
                <button type="submit" className="btn pri sm">
                  Save PR
                </button>
              </form>
            )}
            <table>
              <thead>
                <tr>
                  <th>PR Number</th>
                  <th>Date</th>
                  <th className="num">Overall %</th>
                  <th>Summary</th>
                </tr>
              </thead>
              <tbody>
                {progressReports.map((pr) => (
                  <tr key={pr.id}>
                    <td>
                      <b>{pr.number}</b>
                    </td>
                    <td>{pr.reportDate}</td>
                    <td className="num">{pr.overallPercent}%</td>
                    <td>{pr.summary || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card">
            <div className="top">
              <h2 style={{ margin: 0 }}>Inspection Reports (IR)</h2>
              <span className="sp" />
              <button className="btn sm pri" onClick={() => setShowIrForm(true)}>
                Log IR
              </button>
            </div>
            {showIrForm && (
              <form onSubmit={handleCreateIr} style={{ marginBottom: 12 }}>
                <div className="field">
                  <label>Inspection title</label>
                  <input
                    required
                    value={irTitle}
                    onChange={(e) => setIrTitle(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label>Findings</label>
                  <input
                    value={irFindings}
                    onChange={(e) => setIrFindings(e.target.value)}
                  />
                </div>
                <button type="submit" className="btn pri sm">
                  Save IR
                </button>
              </form>
            )}
            <table>
              <thead>
                <tr>
                  <th>IR Number</th>
                  <th>Date</th>
                  <th>Title</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {inspectionReports.map((ir) => (
                  <tr key={ir.id}>
                    <td>
                      <b>{ir.number}</b>
                    </td>
                    <td>{ir.inspectionDate}</td>
                    <td>{ir.title}</td>
                    <td>
                      <span className="pill ok">{ir.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'team' && (
        <div className="card">
          <h2>Assigned project members</h2>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
              </tr>
            </thead>
            <tbody>
              {(project.members || []).map((m: any) => (
                <tr key={m.userId}>
                  <td>{m.user?.name || m.userId}</td>
                  <td>
                    <span className="pill">{m.user?.role || '-'}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {canEdit && allUsers.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <h3>Assign members</h3>
              <div className="grid g3">
                {allUsers.map((u) => (
                  <label
                    key={u.id}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text)' }}
                  >
                    <input
                      type="checkbox"
                      style={{ width: 'auto' }}
                      checked={selectedUserIds.includes(u.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedUserIds([...selectedUserIds, u.id]);
                        } else {
                          setSelectedUserIds(selectedUserIds.filter((x) => x !== u.id));
                        }
                      }}
                    />
                    {u.name} ({u.role})
                  </label>
                ))}
              </div>
              <button className="btn pri sm" onClick={handleSaveMembers} style={{ marginTop: 12 }}>
                Save team members
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
