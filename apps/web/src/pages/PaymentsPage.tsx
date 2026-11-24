import React, { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';
import { activeProjectStore } from '../lib/active-project';

export const PaymentsPage: React.FC = () => {
  const [payments, setPayments] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [clientInvoices, setClientInvoices] = useState<any[]>([]);
  const [activeCompanyId, setActiveCompanyId] = useState(activeProjectStore.getCompanyId());

  const [clientId, setClientId] = useState('');
  const [receivedDate, setReceivedDate] = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState('BANK_TRANSFER');
  const [reference, setReference] = useState('');
  const [amount, setAmount] = useState('0.00');
  const [allocMap, setAllocMap] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return activeProjectStore.subscribe(() => {
      setActiveCompanyId(activeProjectStore.getCompanyId());
    });
  }, []);

  const loadData = async (compId = activeCompanyId) => {
    try {
      const compQs = compId ? `&companyId=${compId}` : '';
      const [pRes, cRes] = await Promise.all([
        apiFetch(`/payments?pageSize=100${compQs}`),
        apiFetch('/clients?pageSize=100'),
      ]);
      setPayments(pRes.items || []);
      setClients(cRes.items || []);
      if (cRes.items?.[0] && !clientId) {
        setClientId(cRes.items[0].id);
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  useEffect(() => {
    loadData(activeCompanyId);
  }, [activeCompanyId]);

  useEffect(() => {
    if (!clientId) return;
    const compQs = activeCompanyId ? `&companyId=${activeCompanyId}` : '';
    apiFetch(`/invoices?clientId=${clientId}&pageSize=100${compQs}`).then((res) => {
      const payable = (res.items || []).filter(
        (i: any) => i.status === 'ISSUED' || i.status === 'PARTIALLY_PAID',
      );
      setClientInvoices(payable);
      setAllocMap({});
    });
  }, [clientId, activeCompanyId]);

  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const allocations = Object.entries(allocMap)
        .filter(([_, val]) => Number(val) > 0)
        .map(([invoiceId, val]) => ({
          invoiceId,
          amount: Number(val).toFixed(2),
        }));

      await apiFetch('/payments', {
        method: 'POST',
        body: JSON.stringify({
          clientId,
          receivedDate,
          method,
          reference: reference || null,
          amount: Number(amount).toFixed(2),
          allocations,
        }),
      });
      setReference('');
      setAmount('0.00');
      setAllocMap({});
      await loadData();
      if (clientId) {
        const res = await apiFetch(`/invoices?clientId=${clientId}&pageSize=100`);
        setClientInvoices(
          (res.items || []).filter(
            (i: any) => i.status === 'ISSUED' || i.status === 'PARTIALLY_PAID',
          ),
        );
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleExportCsv = () => {
    const year = new Date().getFullYear();
    window.open(`/api/v1/exports/payments.csv?from=${year}-01-01&to=${year}-12-31`, '_blank');
  };

  return (
    <div>
      <div className="top">
        <h1>Payments</h1>
        <span className="sp" />
        <button className="btn" onClick={handleExportCsv}>
          Export Payments CSV
        </button>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="card">
        <h2>Record payment</h2>
        <form onSubmit={handleSavePayment}>
          <div className="grid g4" style={{ gap: 10 }}>
            <div>
              <label>Client</label>
              <select value={clientId} onChange={(e) => setClientId(e.target.value)}>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label>Date received</label>
              <input
                type="date"
                value={receivedDate}
                onChange={(e) => setReceivedDate(e.target.value)}
              />
            </div>
            <div>
              <label>Method</label>
              <select value={method} onChange={(e) => setMethod(e.target.value)}>
                <option value="BANK_TRANSFER">Bank transfer</option>
                <option value="CHEQUE">Cheque</option>
                <option value="CASH">Cash</option>
              </select>
            </div>
            <div>
              <label>Amount (RM)</label>
              <input
                className="n"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label>Reference</label>
              <input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="e.g. IBG 20261119-88213"
              />
            </div>
          </div>

          {clientInvoices.length > 0 && (
            <>
              <h3 style={{ marginTop: 14 }}>Apply to open invoices</h3>
              <table>
                <thead>
                  <tr>
                    <th>Invoice</th>
                    <th>Ref</th>
                    <th>Due</th>
                    <th className="num">Total (RM)</th>
                    <th className="num">Paid (RM)</th>
                    <th style={{ width: 140 }} className="num">
                      Apply (RM)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {clientInvoices.map((inv) => (
                    <tr key={inv.id}>
                      <td>{inv.number}</td>
                      <td>{inv.referenceSummary || '-'}</td>
                      <td>{inv.dueDate || '-'}</td>
                      <td className="num">{inv.total}</td>
                      <td className="num">{inv.amountPaid}</td>
                      <td>
                        <input
                          className="n"
                          value={allocMap[inv.id] || ''}
                          placeholder="0.00"
                          onChange={(e) =>
                            setAllocMap({ ...allocMap, [inv.id]: e.target.value })
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          <div className="right" style={{ marginTop: 14 }}>
            <button type="submit" className="btn pri">
              Save payment
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <h2>Payment history</h2>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Client</th>
              <th>Method</th>
              <th>Reference</th>
              <th className="num">Amount (RM)</th>
              <th>Allocated to</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id}>
                <td>{p.receivedDate}</td>
                <td>{p.client?.name || '-'}</td>
                <td>{p.method}</td>
                <td>{p.reference || '-'}</td>
                <td className="num">{p.amount}</td>
                <td>
                  {(p.allocations || [])
                    .map((a: any) => `${a.invoiceNumber || a.invoiceId} (RM ${a.amount})`)
                    .join(', ') || 'Unallocated'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
