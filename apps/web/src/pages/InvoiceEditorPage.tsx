import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ClaimCalculator, Role } from '@construction/shared';
import { apiFetch } from '../lib/api';
import { authStore } from '../lib/auth';
import { activeProjectStore } from '../lib/active-project';

export const InvoiceEditorPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = !id || id === 'new';
  const { user } = authStore.getState();
  const canIssue = user?.role === Role.OWNER || user?.role === Role.OFFICE;

  const [invoice, setInvoice] = useState<any>(null);
  const [project, setProject] = useState<any>(null);
  const [companies, setCompanies] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [taxRates, setTaxRates] = useState<any[]>([]);

  // Simple invoice fields
  const [companyId, setCompanyId] = useState(activeProjectStore.getCompanyId());
  const [clientId, setClientId] = useState('');
  const [projectId, setProjectId] = useState(activeProjectStore.getProjectId());
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [quotePoRef, setQuotePoRef] = useState('');
  const [claimReportRef, setClaimReportRef] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<
    Array<{ description: string; unit: string; quantity: string; rate: string; taxRateId: string }>
  >([{ description: 'General construction service', unit: 'LS', quantity: '1.000', rate: '1000.00', taxRateId: '' }]);

  // Progress claim fields
  const [periodFrom, setPeriodFrom] = useState('');
  const [periodTo, setPeriodTo] = useState('');
  const [claimInputs, setClaimInputs] = useState<Record<string, string>>({});

  // Credit note / Void modals
  const [showVoidBox, setShowVoidBox] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [showCreditBox, setShowCreditBox] = useState(false);
  const [cnReason, setCnReason] = useState('');
  const [cnSubtotal, setCnSubtotal] = useState('0.00');
  const [error, setError] = useState<string | null>(null);

  const isEditable = isNew || invoice?.status === 'DRAFT';

  const loadLookups = async () => {
    const [compRes, pRes, tRes] = await Promise.all([
      apiFetch('/companies').catch(() => ({ items: [] })),
      apiFetch('/projects?pageSize=100'),
      apiFetch('/tax-rates?pageSize=100').catch(() => ({ items: [] })),
    ]);
    const compList = compRes.items || [];
    setCompanies(compList);
    setProjects(pRes.items || []);
    setTaxRates(tRes.items || []);
    if (isNew && !companyId && compList[0]) {
      setCompanyId(compList[0].id);
    }
    if (canIssue) {
      const cRes = await apiFetch('/clients?pageSize=100');
      setClients(cRes.items || []);
      if (isNew && cRes.items?.[0]) setClientId(cRes.items[0].id);
    }
  };

  const loadInvoice = async (targetId: string) => {
    try {
      const inv = await apiFetch(`/invoices/${targetId}`);
      setInvoice(inv);
      setCompanyId(inv.companyId || '');
      setClientId(inv.clientId);
      setProjectId(inv.projectId || '');
      setIssueDate(inv.issueDate || new Date().toISOString().slice(0, 10));
      setQuotePoRef(inv.quotePoRef || '');
      setClaimReportRef(inv.claimReportRef || '');
      setNotes(inv.notes || '');
      setPeriodFrom(inv.periodFrom || '');
      setPeriodTo(inv.periodTo || '');

      if (inv.type === 'SIMPLE' || inv.type === 'RETENTION_RELEASE') {
        setLines(
          (inv.lines || []).map((l: any) => ({
            description: l.description,
            unit: l.unit || '',
            quantity: l.quantity,
            rate: l.rate,
            taxRateId: '',
          })),
        );
      } else if (inv.type === 'PROGRESS_CLAIM') {
        const map: Record<string, string> = {};
        for (const cl of inv.claimLines || []) {
          map[cl.contractItemId] = cl.cumulativePercent;
        }
        setClaimInputs(map);
        if (inv.projectId) {
          const p = await apiFetch(`/projects/${inv.projectId}`);
          setProject(p);
        }
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  useEffect(() => {
    loadLookups();
    if (!isNew && id) {
      loadInvoice(id);
    }
  }, [id]);

  // Live calculation for Progress Claim using shared ClaimCalculator (Spec 04 T15)
  const liveClaim = useMemo(() => {
    if (!invoice || invoice.type !== 'PROGRESS_CLAIM') return null;
    try {
      const contractItems = (invoice.claimLines || []).map((cl: any) => ({
        id: cl.contractItemId,
        quantity: cl.contractItem?.quantity || '1.000',
        rate: cl.contractItem?.rate || '0.00',
        amount: cl.contractItem?.amount || '0.00',
      }));
      const prevMap: Record<string, { cumulativePercent: string; cumulativeAmount: string }> = {};
      for (const cl of invoice.claimLines || []) {
        const cAmt = Number(cl.contractItem?.amount || 0);
        const pAmt = Number(cl.previousAmount || 0);
        const pPct = cAmt !== 0 ? ((pAmt / cAmt) * 100).toFixed(2) : '0.00';
        prevMap[cl.contractItemId] = {
          cumulativePercent: pPct,
          cumulativeAmount: cl.previousAmount || '0.00',
        };
      }
      return ClaimCalculator.calculate({
        contractItems,
        previousClaim: {
          previousNetCertified: invoice.previousNetCertified || '0.00',
          lineByContractItemId: prevMap,
        },
        inputs: Object.entries(claimInputs).map(([contractItemId, cumulativePercent]) => ({
          contractItemId,
          cumulativePercent: cumulativePercent || '0.00',
        })),
        retentionPercent: project?.retentionPercent || '10.00',
        retentionCapPercent: project?.retentionCapPercent || '5.00',
        taxPercent: invoice.taxPercent || '6.00',
      });
    } catch {
      return null;
    }
  }, [invoice, claimInputs, project]);

  const handleSave = async () => {
    setError(null);
    try {
      if (isNew) {
        const created = await apiFetch('/invoices', {
          method: 'POST',
          body: JSON.stringify({
            type: 'SIMPLE',
            clientId,
            companyId: companyId || null,
            projectId: projectId || null,
            issueDate: issueDate || null,
            quotePoRef: quotePoRef || null,
            claimReportRef: claimReportRef || null,
            notes: notes || null,
            lines: lines.map((l) => ({
              description: l.description,
              unit: l.unit || null,
              quantity: Number(l.quantity || 1).toFixed(3),
              rate: Number(l.rate || 0).toFixed(2),
              taxRateId: l.taxRateId || null,
            })),
          }),
        });
        navigate(`/invoices/${created.id}`);
      } else if (id && invoice?.type === 'SIMPLE') {
        const updated = await apiFetch(`/invoices/${id}`, {
          method: 'PUT',
          body: JSON.stringify({
            clientId,
            companyId: companyId || null,
            projectId: projectId || null,
            issueDate: issueDate || null,
            quotePoRef: quotePoRef || null,
            claimReportRef: claimReportRef || null,
            notes: notes || null,
            lines: lines.map((l) => ({
              description: l.description,
              unit: l.unit || null,
              quantity: Number(l.quantity || 1).toFixed(3),
              rate: Number(l.rate || 0).toFixed(2),
              taxRateId: l.taxRateId || null,
            })),
          }),
        });
        setInvoice(updated);
      } else if (id && invoice?.type === 'PROGRESS_CLAIM') {
        const updated = await apiFetch(`/invoices/${id}`, {
          method: 'PUT',
          body: JSON.stringify({
            issueDate: issueDate || null,
            periodFrom: periodFrom || null,
            periodTo: periodTo || null,
            quotePoRef: quotePoRef || null,
            claimReportRef: claimReportRef || null,
            notes: notes || null,
            claimLines: Object.entries(claimInputs).map(([contractItemId, cumulativePercent]) => ({
              contractItemId,
              cumulativePercent: Number(cumulativePercent || 0).toFixed(2),
            })),
          }),
        });
        setInvoice(updated);
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleIssue = async () => {
    if (!id || isNew) return;
    setError(null);
    try {
      if (isEditable) {
        await handleSave();
      }
      await apiFetch(`/invoices/${id}/issue`, { method: 'POST' });
      await loadInvoice(id);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleVoid = async () => {
    if (!id || !voidReason) return;
    try {
      await apiFetch(`/invoices/${id}/void`, {
        method: 'POST',
        body: JSON.stringify({ reason: voidReason }),
      });
      setShowVoidBox(false);
      await loadInvoice(id);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleCreateCreditNote = async () => {
    if (!id || !cnReason) return;
    try {
      await apiFetch(`/invoices/${id}/credit-notes`, {
        method: 'POST',
        body: JSON.stringify({
          reason: cnReason,
          subtotal: Number(cnSubtotal || 0).toFixed(2),
          taxRateId: taxRates.find((t) => t.isDefault)?.id || null,
        }),
      });
      setShowCreditBox(false);
      await loadInvoice(id);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handlePreviewPdf = async () => {
    if (!id || isNew) return;
    try {
      const res = await apiFetch(`/invoices/${id}/pdf`);
      window.open(res.url, '_blank');
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div>
      <div className="top">
        <div>
          <h1>
            {isNew
              ? 'New Simple Invoice'
              : invoice?.type === 'PROGRESS_CLAIM'
                ? `${invoice.number || 'DRAFT'} · Progress Claim #${invoice.claimNo || ''}`
                : `${invoice?.number || 'DRAFT'} · ${invoice?.type}`}{' '}
            {invoice && <span className="pill">{invoice.status}</span>}
          </h1>
          {invoice?.referenceSummary && (
            <div className="small muted">
              Ref: <b>{invoice.referenceSummary}</b>
              {invoice.quotePoRef ? ` · Quote/PO: ${invoice.quotePoRef}` : ''}
            </div>
          )}
        </div>
        <span className="sp" />
        {!isNew && (
          <button className="btn" onClick={handlePreviewPdf}>
            Preview PDF
          </button>
        )}
        {isEditable && (
          <button className="btn" onClick={handleSave}>
            Save draft
          </button>
        )}
        {!isNew && invoice?.status === 'DRAFT' && canIssue && (
          <button className="btn pri" onClick={handleIssue}>
            Issue invoice
          </button>
        )}
        {!isNew &&
          (invoice?.status === 'ISSUED' || invoice?.status === 'PARTIALLY_PAID') &&
          canIssue && (
            <>
              <button className="btn" onClick={() => setShowCreditBox(true)}>
                Issue credit note
              </button>
              {invoice?.status === 'ISSUED' && (
                <button className="btn bad" onClick={() => setShowVoidBox(true)}>
                  Void
                </button>
              )}
            </>
          )}
      </div>

      {error && <div className="error-banner">{error}</div>}

      {showVoidBox && (
        <div className="card">
          <h3>Void invoice</h3>
          <div className="field">
            <label>Void reason</label>
            <input value={voidReason} onChange={(e) => setVoidReason(e.target.value)} />
          </div>
          <button className="btn bad sm" onClick={handleVoid} style={{ marginRight: 8 }}>
            Confirm void
          </button>
          <button className="btn sm" onClick={() => setShowVoidBox(false)}>
            Cancel
          </button>
        </div>
      )}

      {showCreditBox && (
        <div className="card">
          <h3>Issue credit note</h3>
          <div className="grid g2">
            <div>
              <label>Reason</label>
              <input value={cnReason} onChange={(e) => setCnReason(e.target.value)} />
            </div>
            <div>
              <label>Amount before tax (RM)</label>
              <input
                className="n"
                value={cnSubtotal}
                onChange={(e) => setCnSubtotal(e.target.value)}
              />
            </div>
          </div>
          <div style={{ marginTop: 10 }}>
            <button
              className="btn pri sm"
              onClick={handleCreateCreditNote}
              style={{ marginRight: 8 }}
            >
              Create credit note
            </button>
            <button className="btn sm" onClick={() => setShowCreditBox(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {!isNew && invoice?.type === 'PROGRESS_CLAIM' ? (
        <div className="split">
          <div className="card">
            <div className="grid g3" style={{ gap: 10, marginBottom: 12 }}>
              <div>
                <label>Work done from</label>
                <input
                  type="date"
                  disabled={!isEditable}
                  value={periodFrom}
                  onChange={(e) => setPeriodFrom(e.target.value)}
                />
              </div>
              <div>
                <label>to</label>
                <input
                  type="date"
                  disabled={!isEditable}
                  value={periodTo}
                  onChange={(e) => setPeriodTo(e.target.value)}
                />
              </div>
              <div>
                <label>Claim date</label>
                <input
                  type="date"
                  disabled={!isEditable}
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                />
              </div>
              <div>
                <label>Project Code Ref</label>
                <input disabled value={invoice.projectCodeRef || ''} />
              </div>
              <div>
                <label>Quote / PO Ref</label>
                <input
                  disabled={!isEditable}
                  value={quotePoRef}
                  onChange={(e) => setQuotePoRef(e.target.value)}
                />
              </div>
              <div>
                <label>Claim / Report Ref</label>
                <input
                  disabled={!isEditable}
                  value={claimReportRef}
                  onChange={(e) => setClaimReportRef(e.target.value)}
                />
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th>Section / Item</th>
                  <th className="num">Contract (RM)</th>
                  <th className="num">Prev (RM)</th>
                  <th className="num">Site says %</th>
                  <th style={{ width: 95 }} className="num">
                    To date %
                  </th>
                  <th className="num">To date (RM)</th>
                  <th className="num">This claim (RM)</th>
                </tr>
              </thead>
              <tbody>
                {(invoice.claimLines || []).map((cl: any, idx: number) => {
                  const liveLine = liveClaim?.claimLines[idx];
                  return (
                    <tr key={cl.id}>
                      <td>
                        <div className="small muted">{cl.contractItem?.sectionTitle}</div>
                        <div>{cl.contractItem?.description}</div>
                      </td>
                      <td className="num">{cl.contractItem?.amount}</td>
                      <td className="num">{cl.previousAmount}</td>
                      <td className="num muted">{cl.siteReportedPercent || '-'}</td>
                      <td>
                        <input
                          className="n"
                          disabled={!isEditable}
                          value={claimInputs[cl.contractItemId] ?? cl.cumulativePercent}
                          onChange={(e) =>
                            setClaimInputs({
                              ...claimInputs,
                              [cl.contractItemId]: e.target.value,
                            })
                          }
                        />
                      </td>
                      <td className="num">{liveLine?.cumulativeAmount || cl.cumulativeAmount}</td>
                      <td className="num">{liveLine?.thisClaimAmount || cl.thisClaimAmount}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="card" style={{ position: 'sticky', top: 14 }}>
            <h2>This claim</h2>
            <div className="kv">
              <span>Current contract sum</span>
              <span className="num">{liveClaim?.currentContractSum || '-'}</span>
            </div>
            <div className="kv">
              <span>Work done to date</span>
              <span className="num">{liveClaim?.grossToDate || invoice.grossToDate}</span>
            </div>
            <div className="kv">
              <span>Less retention ({project?.retentionPercent || '10.00'}%)</span>
              <span className="num">({liveClaim?.retentionToDate || invoice.retentionToDate})</span>
            </div>
            <div className="kv small muted">
              <span>Retention limit ({project?.retentionCapPercent || '5.00'}%)</span>
              <span className="num">{liveClaim?.retentionLimit || '-'}</span>
            </div>
            <div className="kv">
              <span>Net to date</span>
              <span className="num">{liveClaim?.netToDate || '-'}</span>
            </div>
            <div className="kv">
              <span>Less previously certified</span>
              <span className="num">
                ({liveClaim?.previousNetCertified || invoice.previousNetCertified})
              </span>
            </div>
            <div className="kv bold">
              <span>Amount this claim</span>
              <span className="num">{liveClaim?.subtotal || invoice.subtotal}</span>
            </div>
            <div className="kv">
              <span>SST ({invoice.taxPercent || '6.00'}%)</span>
              <span className="num">{liveClaim?.taxAmount || invoice.taxAmount}</span>
            </div>
            <div className="kv big">
              <span>Amount due (RM)</span>
              <span className="num">{liveClaim?.total || invoice.total}</span>
            </div>
            <div className="kv small muted">
              <span>Paid to date</span>
              <span className="num">{invoice.amountPaid}</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="grid g3" style={{ gap: 10, marginBottom: 14 }}>
            <div>
              <label>Our Company (Billing Entity)</label>
              <select
                disabled={!isEditable}
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
              >
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code ? `[${c.code}] ` : ''}
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label>Client</label>
              <select
                disabled={!isEditable}
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label>Project (optional)</label>
              <select
                disabled={!isEditable}
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
              >
                <option value="">None</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} - {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label>Issue date</label>
              <input
                type="date"
                disabled={!isEditable}
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
              />
            </div>
            <div>
              <label>Quote / PO Ref</label>
              <input
                disabled={!isEditable}
                value={quotePoRef}
                onChange={(e) => setQuotePoRef(e.target.value)}
              />
            </div>
            <div>
              <label>Claim / Report Ref</label>
              <input
                disabled={!isEditable}
                value={claimReportRef}
                onChange={(e) => setClaimReportRef(e.target.value)}
              />
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Description</th>
                <th style={{ width: 80 }}>Unit</th>
                <th style={{ width: 100 }} className="num">
                  Qty
                </th>
                <th style={{ width: 120 }} className="num">
                  Rate (RM)
                </th>
                <th style={{ width: 120 }}>Tax</th>
                <th style={{ width: 120 }} className="num">
                  Amount (RM)
                </th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, idx) => (
                <tr key={idx}>
                  <td>
                    <input
                      disabled={!isEditable}
                      value={l.description}
                      onChange={(e) => {
                        const next = [...lines];
                        next[idx] = { ...l, description: e.target.value };
                        setLines(next);
                      }}
                    />
                  </td>
                  <td>
                    <input
                      disabled={!isEditable}
                      value={l.unit}
                      onChange={(e) => {
                        const next = [...lines];
                        next[idx] = { ...l, unit: e.target.value };
                        setLines(next);
                      }}
                    />
                  </td>
                  <td>
                    <input
                      className="n"
                      disabled={!isEditable}
                      value={l.quantity}
                      onChange={(e) => {
                        const next = [...lines];
                        next[idx] = { ...l, quantity: e.target.value };
                        setLines(next);
                      }}
                    />
                  </td>
                  <td>
                    <input
                      className="n"
                      disabled={!isEditable}
                      value={l.rate}
                      onChange={(e) => {
                        const next = [...lines];
                        next[idx] = { ...l, rate: e.target.value };
                        setLines(next);
                      }}
                    />
                  </td>
                  <td>
                    <select
                      disabled={!isEditable}
                      value={l.taxRateId}
                      onChange={(e) => {
                        const next = [...lines];
                        next[idx] = { ...l, taxRateId: e.target.value };
                        setLines(next);
                      }}
                    >
                      <option value="">No tax</option>
                      {taxRates.map((tr) => (
                        <option key={tr.id} value={tr.id}>
                          {tr.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="num">
                    {(Number(l.quantity || 0) * Number(l.rate || 0)).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {isEditable && (
            <div style={{ marginTop: 10 }}>
              <a
                className="small"
                onClick={() =>
                  setLines([
                    ...lines,
                    { description: '', unit: 'LS', quantity: '1.000', rate: '0.00', taxRateId: '' },
                  ])
                }
              >
                + Add line
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
