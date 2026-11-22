import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { QuotationCalculator } from '@construction/shared';
import { apiFetch } from '../lib/api';

interface EditableItem {
  id?: string;
  description: string;
  unit: string;
  quantity: string;
  rate: string;
  taxRateId: string;
}

interface EditableSection {
  id?: string;
  title: string;
  items: EditableItem[];
}

export const QuotationEditorPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = !id || id === 'new';

  const [quotation, setQuotation] = useState<any>(null);
  const [revisions, setRevisions] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [taxRates, setTaxRates] = useState<any[]>([]);

  const [clientId, setClientId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [title, setTitle] = useState('');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [validUntil, setValidUntil] = useState('');
  const [terms, setTerms] = useState(
    '1. Payment by progress claim, 30 days from invoice date.\n2. 10% retention, limit 5% of contract sum.',
  );
  const [discountAmount, setDiscountAmount] = useState('0.00');
  const [sections, setSections] = useState<EditableSection[]>([
    {
      title: 'A. Preliminaries',
      items: [{ description: 'Mobilisation and site setup', unit: 'LS', quantity: '1.000', rate: '1000.00', taxRateId: '' }],
    },
  ]);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectBox, setShowRejectBox] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditable = isNew || quotation?.status === 'DRAFT';

  const loadLookups = async () => {
    const [cRes, pRes, tRes] = await Promise.all([
      apiFetch('/clients?pageSize=100'),
      apiFetch('/projects?pageSize=100'),
      apiFetch('/tax-rates?pageSize=100'),
    ]);
    setClients(cRes.items || []);
    setProjects(pRes.items || []);
    setTaxRates(tRes.items || []);
    if (isNew && cRes.items?.[0]) {
      setClientId(cRes.items[0].id);
    }
  };

  const loadQuotation = async (targetId: string) => {
    try {
      const q = await apiFetch(`/quotations/${targetId}`);
      setQuotation(q);
      setClientId(q.clientId);
      setProjectId(q.projectId || '');
      setTitle(q.title);
      setIssueDate(q.issueDate || '');
      setValidUntil(q.validUntil || '');
      setTerms(q.terms || '');
      setDiscountAmount(q.discountAmount || '0.00');
      setSections(
        (q.sections || []).map((s: any) => ({
          id: s.id,
          title: s.title,
          items: (s.items || []).map((i: any) => ({
            id: i.id,
            description: i.description,
            unit: i.unit || '',
            quantity: i.quantity,
            rate: i.rate,
            taxRateId: i.taxRateId || '',
          })),
        })),
      );
      const revRes = await apiFetch(`/quotations/${targetId}/revisions`);
      setRevisions(revRes.items || []);
    } catch (err: any) {
      setError(err.message);
    }
  };

  useEffect(() => {
    loadLookups();
    if (!isNew && id) {
      loadQuotation(id);
    }
  }, [id]);

  // Live totals calculated with shared QuotationCalculator (Spec 02 T10)
  const calculated = useMemo(() => {
    const taxMap = new Map(taxRates.map((tr) => [tr.id, tr.percent]));
    try {
      return QuotationCalculator.calculate({
        discountAmount: discountAmount || '0.00',
        sections: sections.map((s) => ({
          title: s.title,
          items: s.items.map((it) => ({
            description: it.description || 'Item',
            unit: it.unit || null,
            quantity: Number.isNaN(Number(it.quantity)) ? '0' : it.quantity || '0',
            rate: Number.isNaN(Number(it.rate)) ? '0' : it.rate || '0',
            taxRateId: it.taxRateId || null,
            taxPercent: it.taxRateId ? taxMap.get(it.taxRateId) || '0.00' : '0.00',
          })),
        })),
      });
    } catch {
      return { subtotal: '0.00', discountAmount: '0.00', taxAmount: '0.00', total: '0.00', sections: [] };
    }
  }, [sections, discountAmount, taxRates]);

  const buildPayload = () => ({
    clientId,
    projectId: projectId || null,
    title,
    issueDate: issueDate || null,
    validUntil: validUntil || null,
    terms: terms || null,
    discountAmount: Number(discountAmount || 0).toFixed(2),
    sections: sections.map((s) => ({
      id: s.id,
      title: s.title,
      items: s.items.map((it) => ({
        id: it.id,
        description: it.description,
        unit: it.unit || null,
        quantity: Number(it.quantity || 0).toFixed(3),
        rate: Number(it.rate || 0).toFixed(2),
        taxRateId: it.taxRateId || null,
      })),
    })),
  });

  const handleSave = async () => {
    setError(null);
    try {
      if (isNew) {
        const created = await apiFetch('/quotations', {
          method: 'POST',
          body: JSON.stringify(buildPayload()),
        });
        navigate(`/quotations/${created.id}`);
      } else if (id) {
        const updated = await apiFetch(`/quotations/${id}`, {
          method: 'PUT',
          body: JSON.stringify(buildPayload()),
        });
        setQuotation(updated);
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleSend = async () => {
    if (!id || isNew) return;
    setError(null);
    try {
      await handleSave();
      await apiFetch(`/quotations/${id}/send`, { method: 'POST' });
      await loadQuotation(id);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleAccept = async () => {
    if (!id) return;
    try {
      const accepted = await apiFetch(`/quotations/${id}/accept`, {
        method: 'POST',
        body: JSON.stringify({ createProject: true }),
      });
      await loadQuotation(id);
      if (accepted.projectId) {
        navigate(`/projects/${accepted.projectId}`);
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleReject = async () => {
    if (!id || !rejectReason) return;
    try {
      await apiFetch(`/quotations/${id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason: rejectReason }),
      });
      setShowRejectBox(false);
      await loadQuotation(id);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleRevise = async () => {
    if (!id) return;
    try {
      const nextRev = await apiFetch(`/quotations/${id}/revise`, { method: 'POST' });
      navigate(`/quotations/${nextRev.id}`);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDuplicate = async () => {
    if (!id) return;
    try {
      const dup = await apiFetch(`/quotations/${id}/duplicate`, { method: 'POST' });
      navigate(`/quotations/${dup.id}`);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handlePreviewPdf = async () => {
    if (!id || isNew) return;
    try {
      const res = await apiFetch(`/quotations/${id}/pdf`);
      window.open(res.url, '_blank');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const moveItem = (secIdx: number, itemIdx: number, dir: -1 | 1) => {
    const next = [...sections];
    const items = [...next[secIdx].items];
    const targetIdx = itemIdx + dir;
    if (targetIdx < 0 || targetIdx >= items.length) return;
    const [removed] = items.splice(itemIdx, 1);
    items.splice(targetIdx, 0, removed);
    next[secIdx] = { ...next[secIdx], items };
    setSections(next);
  };

  return (
    <div>
      <div className="top">
        <div>
          <h1>
            {isNew
              ? 'New Quotation'
              : quotation?.displayNumber ||
                `${quotation?.number}-R${quotation?.revisionNo ?? 0}`}{' '}
            {quotation && <span className="pill">{quotation.status}</span>}
          </h1>
        </div>
        <span className="sp" />
        {!isNew && (
          <>
            <button className="btn" onClick={handleDuplicate}>
              Duplicate
            </button>
            <button className="btn" onClick={handlePreviewPdf}>
              Preview PDF
            </button>
          </>
        )}
        {isEditable && (
          <button className="btn pri" onClick={handleSave}>
            Save draft
          </button>
        )}
        {!isNew && quotation?.status === 'DRAFT' && (
          <button className="btn pri" onClick={handleSend}>
            Send
          </button>
        )}
        {!isNew && quotation?.status === 'SENT' && (
          <>
            <button className="btn pri" onClick={handleAccept}>
              Accept
            </button>
            <button className="btn bad" onClick={() => setShowRejectBox(true)}>
              Reject
            </button>
            <button className="btn" onClick={handleRevise}>
              Revise
            </button>
          </>
        )}
        {!isNew && quotation?.status === 'REJECTED' && (
          <button className="btn pri" onClick={handleRevise}>
            Revise
          </button>
        )}
      </div>

      {error && <div className="error-banner">{error}</div>}

      {showRejectBox && (
        <div className="card">
          <h3>Reject quotation</h3>
          <div className="field">
            <label>Reason for rejection</label>
            <input
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Client requested lower price..."
            />
          </div>
          <button className="btn bad sm" onClick={handleReject} style={{ marginRight: 8 }}>
            Confirm reject
          </button>
          <button className="btn sm" onClick={() => setShowRejectBox(false)}>
            Cancel
          </button>
        </div>
      )}

      <div className="split">
        <div>
          <div className="card grid g3" style={{ gap: 10 }}>
            <div>
              <label>Client</label>
              <select
                disabled={!isEditable}
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
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
              <label>Valid until</label>
              <input
                type="date"
                disabled={!isEditable}
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
              />
            </div>
            <div style={{ gridColumn: '1 / span 2' }}>
              <label>Title</label>
              <input
                disabled={!isEditable}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
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
          </div>

          <div className="card">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 50 }}>Order</th>
                  <th>Description</th>
                  <th style={{ width: 70 }}>Unit</th>
                  <th style={{ width: 95 }} className="num">
                    Qty
                  </th>
                  <th style={{ width: 110 }} className="num">
                    Rate (RM)
                  </th>
                  <th style={{ width: 110 }}>Tax</th>
                  <th style={{ width: 115 }} className="num">
                    Amount (RM)
                  </th>
                  <th style={{ width: 32 }} />
                </tr>
              </thead>
              <tbody>
                {sections.map((sec, sIdx) => (
                  <React.Fragment key={sIdx}>
                    <tr className="sec">
                      <td>Sec {sIdx + 1}</td>
                      <td colSpan={5}>
                        <input
                          disabled={!isEditable}
                          value={sec.title}
                          onChange={(e) => {
                            const next = [...sections];
                            next[sIdx] = { ...sec, title: e.target.value };
                            setSections(next);
                          }}
                        />
                      </td>
                      <td className="num">{calculated.sections[sIdx]?.subtotal || '0.00'}</td>
                      <td>
                        {isEditable && sections.length > 1 && (
                          <a
                            onClick={() =>
                              setSections(sections.filter((_, idx) => idx !== sIdx))
                            }
                          >
                            &times;
                          </a>
                        )}
                      </td>
                    </tr>
                    {sec.items.map((item, iIdx) => (
                      <tr key={iIdx}>
                        <td>
                          {isEditable && (
                            <span>
                              <a onClick={() => moveItem(sIdx, iIdx, -1)}>&uarr;</a>{' '}
                              <a onClick={() => moveItem(sIdx, iIdx, 1)}>&darr;</a>
                            </span>
                          )}
                        </td>
                        <td>
                          <input
                            disabled={!isEditable}
                            value={item.description}
                            onChange={(e) => {
                              const next = [...sections];
                              const items = [...sec.items];
                              items[iIdx] = { ...item, description: e.target.value };
                              next[sIdx] = { ...sec, items };
                              setSections(next);
                            }}
                          />
                        </td>
                        <td>
                          <input
                            disabled={!isEditable}
                            value={item.unit}
                            onChange={(e) => {
                              const next = [...sections];
                              const items = [...sec.items];
                              items[iIdx] = { ...item, unit: e.target.value };
                              next[sIdx] = { ...sec, items };
                              setSections(next);
                            }}
                          />
                        </td>
                        <td>
                          <input
                            className="n"
                            disabled={!isEditable}
                            value={item.quantity}
                            onChange={(e) => {
                              const next = [...sections];
                              const items = [...sec.items];
                              items[iIdx] = { ...item, quantity: e.target.value };
                              next[sIdx] = { ...sec, items };
                              setSections(next);
                            }}
                          />
                        </td>
                        <td>
                          <input
                            className="n"
                            disabled={!isEditable}
                            value={item.rate}
                            onChange={(e) => {
                              const next = [...sections];
                              const items = [...sec.items];
                              items[iIdx] = { ...item, rate: e.target.value };
                              next[sIdx] = { ...sec, items };
                              setSections(next);
                            }}
                          />
                        </td>
                        <td>
                          <select
                            disabled={!isEditable}
                            value={item.taxRateId}
                            onChange={(e) => {
                              const next = [...sections];
                              const items = [...sec.items];
                              items[iIdx] = { ...item, taxRateId: e.target.value };
                              next[sIdx] = { ...sec, items };
                              setSections(next);
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
                          {calculated.sections[sIdx]?.items[iIdx]?.amount || '0.00'}
                        </td>
                        <td>
                          {isEditable && (
                            <a
                              onClick={() => {
                                const next = [...sections];
                                next[sIdx] = {
                                  ...sec,
                                  items: sec.items.filter((_, idx) => idx !== iIdx),
                                };
                                setSections(next);
                              }}
                            >
                              &times;
                            </a>
                          )}
                        </td>
                      </tr>
                    ))}
                    {isEditable && (
                      <tr>
                        <td />
                        <td colSpan={7}>
                          <a
                            className="small"
                            onClick={() => {
                              const next = [...sections];
                              next[sIdx] = {
                                ...sec,
                                items: [
                                  ...sec.items,
                                  {
                                    description: '',
                                    unit: 'LS',
                                    quantity: '1.000',
                                    rate: '0.00',
                                    taxRateId: taxRates.find((t) => t.isDefault)?.id || '',
                                  },
                                ],
                              };
                              setSections(next);
                            }}
                          >
                            + Add item
                          </a>
                          {sIdx === sections.length - 1 && (
                            <>
                              {' '}
                              &nbsp;{' '}
                              <a
                                className="small"
                                onClick={() =>
                                  setSections([
                                    ...sections,
                                    { title: 'New Section', items: [] },
                                  ])
                                }
                              >
                                + Add section
                              </a>
                            </>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card">
            <label>Terms and conditions</label>
            <textarea
              rows={3}
              disabled={!isEditable}
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
            />
          </div>
        </div>

        <div className="card" style={{ position: 'sticky', top: 14 }}>
          <h2>Totals</h2>
          <div className="kv">
            <span>Subtotal</span>
            <span className="num">{calculated.subtotal}</span>
          </div>
          <div className="kv">
            <span>Discount</span>
            <span style={{ width: 110 }}>
              <input
                className="n"
                disabled={!isEditable}
                value={discountAmount}
                onChange={(e) => setDiscountAmount(e.target.value)}
              />
            </span>
          </div>
          <div className="kv">
            <span className="muted">Tax amount</span>
            <span className="num">{calculated.taxAmount}</span>
          </div>
          <div className="kv big">
            <span>Total (RM)</span>
            <span className="num">{calculated.total}</span>
          </div>
          <p className="small muted">
            Totals update as you type. The server recalculates on save.
          </p>

          {revisions.length > 0 && (
            <>
              <h2 style={{ marginTop: 14 }}>Revisions</h2>
              {revisions.map((r) => (
                <div key={r.id} className="small" style={{ marginBottom: 4 }}>
                  <a onClick={() => navigate(`/quotations/${r.id}`)}>
                    Rev {r.revisionNo} ({r.status})
                  </a>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
