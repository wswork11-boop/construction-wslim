import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ExpenseCategory, ExpenseStatus, Role } from '@construction/shared';
import { apiDownload, apiFetch } from '../lib/api';
import { authStore } from '../lib/auth';
import { activeProjectStore } from '../lib/active-project';

const CATEGORY_LABELS: Record<string, string> = {
  MATERIALS: 'Materials & Hardware',
  SUBCONTRACTOR: 'Subcontractor',
  TOOLS_EQUIPMENT: 'Tools & Equipment',
  LABOUR: 'Direct Labour',
  TRANSPORT: 'Transport & Delivery',
  SITE_PETTY_CASH: 'Site Petty Cash',
  OFFICE_OVERHEAD: 'Office Overhead',
  OTHER: 'Other',
};

export const ExpensesPage: React.FC = () => {
  const { user } = authStore.getState();
  const isOwnerOrOffice = user?.role === Role.OWNER || user?.role === Role.OFFICE;
  const [searchParams] = useSearchParams();

  const today = new Date().toISOString().slice(0, 10);
  const yearStart = `${today.slice(0, 4)}-01-01`;

  const [expenses, setExpenses] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({
    totalExpenses: '0.00',
    totalPaid: '0.00',
    totalUnpaid: '0.00',
  });
  const [projects, setProjects] = useState<any[]>([]);
  const [taxRates, setTaxRates] = useState<any[]>([]);

  // Filters
  const [q, setQ] = useState('');
  const [projectIdFilter, setProjectIdFilter] = useState(
    searchParams.get('projectId') || activeProjectStore.getProjectId(),
  );
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [fromFilter, setFromFilter] = useState('');
  const [toFilter, setToFilter] = useState('');

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [projectId, setProjectId] = useState(
    searchParams.get('projectId') || activeProjectStore.getProjectId(),
  );

  useEffect(() => {
    return activeProjectStore.subscribe(() => {
      const next = activeProjectStore.getProjectId();
      setProjectIdFilter(next);
      if (next) setProjectId(next);
    });
  }, []);
  const [category, setCategory] = useState<string>(ExpenseCategory.MATERIALS);
  const [expenseDate, setExpenseDate] = useState(today);
  const [vendorName, setVendorName] = useState('');
  const [billReference, setBillReference] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('100.00');
  const [taxRateId, setTaxRateId] = useState<string>('');
  const [initialStatus, setInitialStatus] = useState<'PAID' | 'UNPAID' | 'REIMBURSED'>('PAID');
  const [paymentMethod, setPaymentMethod] = useState('BANK_TRANSFER');
  const [paymentReference, setPaymentReference] = useState('');
  const [notes, setNotes] = useState('');

  const [error, setError] = useState<string | null>(null);

  const loadLookups = async () => {
    try {
      const [pRes, tRes] = await Promise.all([
        apiFetch('/projects?pageSize=100'),
        apiFetch('/tax-rates'),
      ]);
      setProjects(pRes.items || []);
      setTaxRates(tRes.items || []);
    } catch {
      // ignore lookup error
    }
  };

  const loadExpenses = async () => {
    setError(null);
    try {
      const params = new URLSearchParams({ pageSize: '100' });
      if (q.trim()) params.set('q', q.trim());
      if (projectIdFilter) params.set('projectId', projectIdFilter);
      if (categoryFilter) params.set('category', categoryFilter);
      if (statusFilter) params.set('status', statusFilter);
      if (fromFilter) params.set('from', fromFilter);
      if (toFilter) params.set('to', toFilter);

      const res = await apiFetch(`/expenses?${params.toString()}`);
      setExpenses(res.items || []);
      if (res.summary) setSummary(res.summary);
    } catch (err: any) {
      setError(err.message);
    }
  };

  useEffect(() => {
    loadLookups();
  }, []);

  useEffect(() => {
    loadExpenses();
  }, [q, projectIdFilter, categoryFilter, statusFilter, fromFilter, toFilter]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await apiFetch('/expenses', {
        method: 'POST',
        body: JSON.stringify({
          projectId: projectId || null,
          category,
          status: initialStatus,
          expenseDate,
          vendorName,
          billReference: billReference || null,
          description,
          amount: Number(amount || 0).toFixed(2),
          taxRateId: taxRateId || null,
          paidDate: initialStatus !== 'UNPAID' ? expenseDate : null,
          paymentMethod: initialStatus !== 'UNPAID' ? paymentMethod : null,
          paymentReference: initialStatus !== 'UNPAID' ? paymentReference || null : null,
          notes: notes || null,
        }),
      });
      setShowCreate(false);
      setVendorName('');
      setBillReference('');
      setDescription('');
      setAmount('100.00');
      setPaymentReference('');
      setNotes('');
      await loadExpenses();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleMarkPaid = async (exp: any) => {
    setError(null);
    try {
      await apiFetch(`/expenses/${exp.id}/pay`, {
        method: 'POST',
        body: JSON.stringify({
          status: 'PAID',
          paidDate: today,
          paymentMethod: 'BANK_TRANSFER',
        }),
      });
      await loadExpenses();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleVoid = async (exp: any) => {
    const reason = window.prompt(`Reason for voiding ${exp.number}:`, 'Entered in error');
    if (!reason) return;
    setError(null);
    try {
      await apiFetch(`/expenses/${exp.id}/void`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });
      await loadExpenses();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const selectedTaxPct = taxRateId
    ? Number(taxRates.find((t) => t.id === taxRateId)?.percent || 0)
    : 0;
  const previewSub = Number(amount || 0);
  const previewTax = (previewSub * selectedTaxPct) / 100;
  const previewTotal = (previewSub + previewTax).toFixed(2);

  const statusPillClass = (st: string) => {
    if (st === ExpenseStatus.PAID || st === ExpenseStatus.REIMBURSED) return 'ok';
    if (st === ExpenseStatus.UNPAID) return 'warn';
    if (st === ExpenseStatus.VOID) return 'bad';
    return '';
  };

  return (
    <div>
      <div className="top">
        <h1>Expenses &amp; Purchases</h1>
        <span className="sp" />
        {isOwnerOrOffice && (
          <>
            <button
              className="btn"
              onClick={() =>
                apiDownload(
                  `/exports/expenses.csv?from=${fromFilter || yearStart}&to=${toFilter || today}`,
                  `expenses-${fromFilter || yearStart}-${toFilter || today}.csv`,
                )
              }
            >
              Export CSV
            </button>
            <button
              className="btn"
              onClick={() =>
                apiDownload('/reports/expenses?format=xlsx', 'expenses-report.xlsx')
              }
            >
              Export Excel
            </button>
          </>
        )}
        <button className="btn pri" onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? 'Close form' : '+ Record Expense'}
        </button>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid g3">
        <div className="card stat">
          <div className="l">Total Expenses (Filtered)</div>
          <div className="v">RM {summary.totalExpenses}</div>
        </div>
        <div className="card stat">
          <div className="l">Paid / Reimbursed</div>
          <div className="v">RM {summary.totalPaid}</div>
        </div>
        <div className="card stat">
          <div className="l">Unpaid Bills (Payable)</div>
          <div className="v">RM {summary.totalUnpaid}</div>
        </div>
      </div>

      {error && (
        <div className="card" style={{ borderColor: '#b42318', color: '#b42318' }}>
          {error}
        </div>
      )}

      {showCreate && (
        <div className="card">
          <h2>Record Expense / Purchase</h2>
          <form onSubmit={handleCreate} className="grid g4" style={{ gap: 10 }}>
            <div>
              <label>Project (Link to P26-NNN)</label>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                required={user?.role === Role.PROJECT_MANAGER}
              >
                {isOwnerOrOffice && <option value="">General Company Overhead</option>}
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} &middot; {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label>Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                {Object.entries(CATEGORY_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label>Expense date</label>
              <input
                type="date"
                required
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
              />
            </div>
            <div>
              <label>Shop / Supplier / Subcontractor</label>
              <input
                required
                placeholder="e.g. Hardware Shop Sdn Bhd"
                value={vendorName}
                onChange={(e) => setVendorName(e.target.value)}
              />
            </div>
            <div>
              <label>Receipt / Supplier Invoice No.</label>
              <input
                placeholder="e.g. RCP-2026-102"
                value={billReference}
                onChange={(e) => setBillReference(e.target.value)}
              />
            </div>
            <div style={{ gridColumn: '2 / span 3' }}>
              <label>Description (Items bought / work done)</label>
              <input
                required
                placeholder="e.g. 50 bags cement, timber & nails for site formwork"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div>
              <label>Subtotal Amount (RM)</label>
              <input
                className="n"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div>
              <label>Tax</label>
              <select value={taxRateId} onChange={(e) => setTaxRateId(e.target.value)}>
                <option value="">No tax (0%)</option>
                {taxRates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.percent}%)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label>Payment Status</label>
              <select
                value={initialStatus}
                onChange={(e) => setInitialStatus(e.target.value as any)}
              >
                <option value="PAID">Paid immediately</option>
                <option value="UNPAID">Unpaid supplier bill (Pay later)</option>
                <option value="REIMBURSED">Reimbursed to staff</option>
              </select>
            </div>
            {initialStatus !== 'UNPAID' && (
              <div>
                <label>Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                >
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                  <option value="CASH">Cash / Petty Cash</option>
                  <option value="CARD">Company Card</option>
                  <option value="CHEQUE">Cheque</option>
                </select>
              </div>
            )}
            <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 12 }}>
              <span className="bold">Total with tax: RM {previewTotal}</span>
              <span className="sp" />
              <button type="button" className="btn" onClick={() => setShowCreate(false)}>
                Cancel
              </button>
              <button type="submit" className="btn pri">
                Save Expense
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filter Bar */}
      <div className="card grid g4" style={{ gap: 10 }}>
        <div>
          <label>Search</label>
          <input
            placeholder="Search number, shop, item, ref..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div>
          <label>Project</label>
          <select value={projectIdFilter} onChange={(e) => setProjectIdFilter(e.target.value)}>
            <option value="">All projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} &middot; {p.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label>Category</label>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="">All categories</option>
            {Object.entries(CATEGORY_LABELS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label>Status</label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            <option value="PAID">PAID</option>
            <option value="UNPAID">UNPAID</option>
            <option value="REIMBURSED">REIMBURSED</option>
            <option value="VOID">VOID</option>
          </select>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Number</th>
              <th>Date</th>
              <th>Project Ref</th>
              <th>Category</th>
              <th>Vendor / Shop</th>
              <th>Description &amp; Bill Ref</th>
              <th className="num">Total (RM)</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {expenses.map((exp) => (
              <tr key={exp.id}>
                <td className="bold">{exp.number}</td>
                <td>{exp.expenseDate}</td>
                <td>
                  {exp.projectId ? (
                    <Link to={`/projects/${exp.projectId}`} className="pill info">
                      {exp.projectCodeRef}
                    </Link>
                  ) : (
                    <span className="small muted">Overhead</span>
                  )}
                </td>
                <td>
                  <span className="pill">{CATEGORY_LABELS[exp.category] || exp.category}</span>
                </td>
                <td>{exp.vendorName}</td>
                <td>
                  <div>{exp.description}</div>
                  {exp.billReference && (
                    <div className="small muted">Bill/Receipt: {exp.billReference}</div>
                  )}
                </td>
                <td className="num bold">{exp.total}</td>
                <td>
                  <span className={`pill ${statusPillClass(exp.status)}`}>{exp.status}</span>
                </td>
                <td className="right">
                  {isOwnerOrOffice && exp.status === ExpenseStatus.UNPAID && (
                    <button
                      className="btn pri sm"
                      style={{ marginRight: 6 }}
                      onClick={() => handleMarkPaid(exp)}
                    >
                      Mark Paid
                    </button>
                  )}
                  {isOwnerOrOffice && exp.status !== ExpenseStatus.VOID && (
                    <button className="btn sm" onClick={() => handleVoid(exp)}>
                      Void
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {expenses.length === 0 && (
              <tr>
                <td colSpan={9} className="muted">
                  No expenses recorded yet. Click "+ Record Expense" above to log a purchase.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
