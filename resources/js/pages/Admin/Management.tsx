import { FormEvent, useCallback, useEffect, useState, type ReactNode } from 'react';
import axios from 'axios';
import { Head } from '@inertiajs/react';
import { AlertTriangle, Download, Package, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import AppShell from '../../components/layout/AppShell';
import { FeedbackProvider, useFeedback } from '../../components/ui/Feedback';
import { menuPriceText } from '../../lib/menuPrice';

type Resource = 'products' | 'categories' | 'tables' | 'orders' | 'inventory' | 'expenses' | 'reports' | 'users' | 'shift-history';
interface Props { resource: Resource }
interface InventoryRow { id: number; current_stock: number | string; minimum_stock: number | string; unit: string; product?: { name: string }; is_low_stock?: boolean }
const titles: Record<Resource, string> = { products: 'Products', categories: 'Categories', tables: 'Tables', orders: 'Orders', inventory: 'Inventory', expenses: 'Expenses', reports: 'Reports', users: 'Users', 'shift-history': 'Shift History' };
const units = ['kg', 'g', 'L', 'ml', 'pcs'];
const money = (value: number) => `Rs. ${Number(value || 0).toLocaleString('en-LK', { minimumFractionDigits: 2 })}`;

export default function Management(props: Props) {
    return (
        <FeedbackProvider>
            <ManagementScreen {...props} />
        </FeedbackProvider>
    );
}

function ManagementScreen({ resource }: Props) {
    const { notify, confirm } = useFeedback();
    const [rows, setRows] = useState<any[]>([]);
    const [report, setReport] = useState<any>(null);
    const [name, setName] = useState('');
    const [search, setSearch] = useState('');
    const [period, setPeriod] = useState('month');
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const load = () => axios.get(`/api/${resource}`, { params: resource === 'reports' ? { period, from, to } : {} }).then(response => {
        if (resource === 'reports') setReport(response.data);
        else setRows(response.data.data ?? response.data);
    }).catch(() => notify('Unable to load this section.', 'error'));

    useEffect(() => {
        if (resource === 'shift-history' || resource === 'categories' || resource === 'products' || resource === 'expenses') {
            return;
        }
        load();
    }, [resource]);

    async function create(event: FormEvent) {
        event.preventDefault();
        if (!name.trim()) return;
        const payload = { name };
        try {
            await axios.post(`/api/${resource}`, payload);
            setName('');
            notify(`${titles[resource]} updated.`);
            load();
        } catch (error: any) {
            notify(error.response?.data?.message ?? 'Unable to save.', 'error');
        }
    }

    async function remove(id: number) {
        if (!(await confirm('Delete this item?'))) return;
        await axios.delete(`/api/${resource}/${id}`);
        load();
    }

    return <>
        <Head title={titles[resource]} />
        <AppShell>
            <div className="min-h-screen">
                <header className="border-b border-slate-200 bg-white px-5 py-5 lg:px-8">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#d97745]">Admin workspace</p>
                    <h1 className="mt-1 text-2xl font-semibold tracking-tight">{titles[resource]}</h1>
                </header>
                <div className="space-y-6 p-5 lg:p-8">
                    <div className="flex flex-col justify-between gap-4 sm:flex-row">
                        <div className="relative max-w-md flex-1">
                            <Search className="absolute left-3 top-3 text-slate-400" size={18} />
                            <input value={search} onChange={event => setSearch(event.target.value)} placeholder={`Search ${titles[resource].toLowerCase()}...`} className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-3 text-sm outline-none focus:border-[#d97745]" />
                        </div>
                        {resource === 'tables' && <form onSubmit={create} className="flex flex-wrap gap-2">
                            <input value={name} onChange={event => setName(event.target.value)} placeholder="New table name" className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-[#d97745]" />
                            <button className="flex items-center gap-2 rounded-xl bg-[#d97745] px-4 py-3 text-sm font-semibold text-white"><Plus size={17} />Add</button>
                        </form>}
                    </div>
                    {resource === 'users' ? (
                        <UsersPanel rows={rows} search={search} onRefresh={load} onNotice={notify} />
                    ) : resource === 'categories' ? (
                        <CategoriesPanel search={search} onNotice={notify} />
                    ) : resource === 'products' ? (
                        <ProductsPanel search={search} onNotice={notify} />
                    ) : resource === 'inventory' ? (
                        <InventoryTable rows={rows as InventoryRow[]} search={search} onUpdated={load} onNotice={notify} />
                    ) : resource === 'reports' && report ? (
                        <ReportTable report={report} period={period} from={from} to={to} onPeriodChange={setPeriod} onFromChange={setFrom} onToChange={setTo} onApply={load} />
                    ) : resource === 'expenses' ? (
                        <ExpensesPanel search={search} onNotice={notify} />
                    ) : resource === 'orders' ? (
                        <OrdersLogTable rows={rows} search={search} />
                    ) : resource === 'shift-history' ? (
                        <ShiftHistoryPanel search={search} onNotice={notify} />
                    ) : (
                        <DataTable resource={resource} rows={rows} search={search} onRemove={remove} />
                    )}
                </div>
            </div>
        </AppShell>
    </>;
}

function InventoryTable({ rows, search, onUpdated, onNotice }: { rows: InventoryRow[]; search: string; onUpdated: () => void; onNotice: (message: string) => void }) {
    const [type, setType] = useState<Record<number, string>>({});
    const [quantity, setQuantity] = useState<Record<number, string>>({});
    const [minimum, setMinimum] = useState<Record<number, string>>({});
    const [unit, setUnit] = useState<Record<number, string>>({});
    const filtered = rows.filter(row => JSON.stringify(row).toLowerCase().includes(search.toLowerCase()));

    async function submit(row: InventoryRow) {
        try {
            await axios.post(`/api/inventory/${row.id}/movement`, {
                movement_type: type[row.id] ?? 'STOCK_IN',
                quantity: Number(quantity[row.id] ?? 0),
                minimum_stock: Number(minimum[row.id] ?? row.minimum_stock),
                unit: unit[row.id] ?? row.unit,
            });
            onNotice('Inventory updated successfully.');
            onUpdated();
        } catch (error: any) {
            onNotice(error.response?.data?.message ?? 'Unable to update inventory.');
        }
    }

    return <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-100"><div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wider text-slate-400"><tr><th className="px-5 py-4">Product</th><th className="px-5 py-4">Current stock</th><th className="px-5 py-4">Minimum</th><th className="px-5 py-4">Unit</th><th className="px-5 py-4">Movement</th><th className="px-5 py-4 text-right">Save</th></tr></thead><tbody className="divide-y divide-slate-100">{filtered.map(row => { const low = row.is_low_stock ?? Number(row.current_stock) <= Number(row.minimum_stock); return <tr key={row.id} className="hover:bg-slate-50"><td className="px-5 py-4 font-semibold"><div className="flex items-center gap-2"><Package size={17} className="text-[#d97745]" />{row.product?.name ?? 'Product'}</div></td><td className={`px-5 py-4 font-semibold ${low ? 'text-red-600' : 'text-slate-700'}`}>{row.current_stock} {row.unit}{low && <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-1 text-[10px] font-bold uppercase text-red-600"><AlertTriangle size={12} />Low</span>}</td><td className="px-5 py-4"><input type="number" min="0" value={minimum[row.id] ?? row.minimum_stock} onChange={event => setMinimum({ ...minimum, [row.id]: event.target.value })} className="w-24 rounded-lg border border-slate-200 px-2 py-2" /></td><td className="px-5 py-4"><select value={unit[row.id] ?? row.unit} onChange={event => setUnit({ ...unit, [row.id]: event.target.value })} className="rounded-lg border border-slate-200 px-2 py-2">{units.map(option => <option key={option}>{option}</option>)}</select></td><td className="px-5 py-4"><div className="flex gap-2"><select value={type[row.id] ?? 'STOCK_IN'} onChange={event => setType({ ...type, [row.id]: event.target.value })} className="rounded-lg border border-slate-200 px-2 py-2"><option value="STOCK_IN">Stock in</option><option value="STOCK_OUT">Stock out</option><option value="ADJUSTMENT">Adjustment</option></select><input type="number" min="0.001" step="0.001" value={quantity[row.id] ?? ''} onChange={event => setQuantity({ ...quantity, [row.id]: event.target.value })} placeholder="Qty" className="w-20 rounded-lg border border-slate-200 px-2 py-2" /></div></td><td className="px-5 py-4 text-right"><button onClick={() => submit(row)} className="rounded-lg bg-[#102b2b] px-3 py-2 text-xs font-semibold text-white">Save</button></td></tr>; })}</tbody></table>{filtered.length === 0 && <p className="p-10 text-center text-sm text-slate-400">No inventory records found.</p>}</div></div>;
}

function ReportTable({ report, period, from, to, onPeriodChange, onFromChange, onToChange, onApply }: { report: any; period: string; from: string; to: string; onPeriodChange: (value: string) => void; onFromChange: (value: string) => void; onToChange: (value: string) => void; onApply: () => void }) {
    function downloadReport() {
        const header = 'Period,Orders,Revenue,Expenses,Profit';
        const lines = (report.rows ?? []).map((row: any) => [row.period, row.orders, row.revenue ?? row.sales, row.expenses, row.profit].join(','));
        const blob = new Blob([[header, ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `profit-report-${period}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    }

    return <div className="space-y-5"><div className="flex flex-wrap items-end justify-between gap-3"><FilterBar from={from} to={to} onFromChange={onFromChange} onToChange={onToChange} onApply={onApply}><select value={period} onChange={event => onPeriodChange(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm"><option value="date">Day by day</option><option value="week">Week by week</option><option value="month">Month by month</option><option value="year">Year by year</option></select></FilterBar><button onClick={downloadReport} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600 hover:border-[#d97745] hover:text-[#c26435]"><Download size={17} />Download profit CSV</button></div><div className="grid gap-4 sm:grid-cols-3"><Metric label="Revenue" value={money(report.revenue ?? report.sales)} /><Metric label="Expenses" value={money(report.expenses)} /><Metric label="Profit" value={money(report.profit ?? 0)} /></div><div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-100"><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wider text-slate-400"><tr><th className="px-5 py-4">Period</th><th className="px-5 py-4">Orders</th><th className="px-5 py-4">Revenue</th><th className="px-5 py-4">Expenses</th><th className="px-5 py-4">Profit</th></tr></thead><tbody className="divide-y divide-slate-100">{(report.rows ?? []).map((row: any) => <tr key={row.period}><td className="px-5 py-4 font-semibold">{row.period}</td><td className="px-5 py-4">{row.orders}</td><td className="px-5 py-4 text-emerald-700">{money(row.revenue ?? row.sales)}</td><td className="px-5 py-4 text-red-600">{money(row.expenses)}</td><td className="px-5 py-4 font-semibold text-[#c26435]">{money(row.profit)}</td></tr>)}</tbody></table></div></div></div>;
}

const EXPENSE_CATEGORY_PRESETS = ['Gas', 'Electricity', 'Transport', 'Maintenance', 'Cleaning', 'Labour', 'Other'];

function isoDate(date: Date) {
    return date.toISOString().slice(0, 10);
}

function startOfMonthIso() {
    const now = new Date();
    return isoDate(new Date(now.getFullYear(), now.getMonth(), 1));
}

interface ExpenseRow {
    id: number;
    category: string;
    amount: string | number;
    description?: string | null;
    expense_date: string;
    user?: { id: number; name: string } | null;
}

function ExpensesPanel({ search, onNotice }: { search: string; onNotice: (message: string) => void }) {
    const { confirm } = useFeedback();
    const [rows, setRows] = useState<ExpenseRow[]>([]);
    const [page, setPage] = useState(1);
    const [from, setFrom] = useState(startOfMonthIso);
    const [to, setTo] = useState(isoDate(new Date()));
    const [category, setCategory] = useState('');
    const [minAmount, setMinAmount] = useState('');
    const [maxAmount, setMaxAmount] = useState('');
    const [categoryOptions, setCategoryOptions] = useState<string[]>(EXPENSE_CATEGORY_PRESETS);
    const [filteredTotal, setFilteredTotal] = useState(0);
    const [meta, setMeta] = useState<PaginatedMeta>({
        current_page: 1,
        last_page: 1,
        per_page: 10,
        total: 0,
        from: null,
        to: null,
    });
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState<ExpenseRow | null>(null);
    const [filtersDirty, setFiltersDirty] = useState(false);

    const load = useCallback(() => {
        setLoading(true);
        setFiltersDirty(false);
        return axios
            .get('/api/expenses', {
                params: {
                    page,
                    per_page: 10,
                    from: from || undefined,
                    to: to || undefined,
                    category: category || undefined,
                    search: search.trim() || undefined,
                    min_amount: minAmount === '' ? undefined : minAmount,
                    max_amount: maxAmount === '' ? undefined : maxAmount,
                },
            })
            .then(response => {
                setRows(response.data.data ?? []);
                setFilteredTotal(Number(response.data.filtered_total ?? 0));
                setMeta({
                    current_page: response.data.current_page ?? 1,
                    last_page: response.data.last_page ?? 1,
                    per_page: response.data.per_page ?? 10,
                    total: response.data.total ?? 0,
                    from: response.data.from ?? null,
                    to: response.data.to ?? null,
                });
                const fromRows = (response.data.data ?? []).map((row: ExpenseRow) => row.category).filter(Boolean);
                setCategoryOptions(prev => [...new Set([...EXPENSE_CATEGORY_PRESETS, ...fromRows, ...prev])]);
            })
            .catch(() => onNotice('Unable to load expenses.'))
            .finally(() => setLoading(false));
    }, [page, from, to, category, minAmount, maxAmount, search, onNotice]);

    useEffect(() => {
        setPage(1);
    }, [search]);

    useEffect(() => {
        void load();
    }, [load]);

    function applyFilters() {
        setPage(1);
        void load();
    }

    function applyPreset(preset: 'week' | 'month' | 'last30') {
        const now = new Date();
        const end = isoDate(now);
        let start = startOfMonthIso();
        if (preset === 'week') {
            const weekStart = new Date(now);
            weekStart.setDate(now.getDate() - now.getDay());
            start = isoDate(weekStart);
        } else if (preset === 'last30') {
            const past = new Date(now);
            past.setDate(now.getDate() - 29);
            start = isoDate(past);
        }
        setFrom(start);
        setTo(end);
        setPage(1);
        setFiltersDirty(false);
    }

    function clearFilters() {
        setFrom('');
        setTo('');
        setCategory('');
        setMinAmount('');
        setMaxAmount('');
        setPage(1);
        setFiltersDirty(false);
    }

    async function removeExpense(expense: ExpenseRow) {
        if (!(await confirm(`Delete expense "${expense.category}" (${money(Number(expense.amount))})?`))) {
            return;
        }
        try {
            await axios.delete(`/api/expenses/${expense.id}`);
            onNotice('Expense deleted.');
            if (rows.length === 1 && page > 1) {
                setPage(current => current - 1);
            } else {
                await load();
            }
        } catch (error: any) {
            onNotice(apiErrorMessage(error, 'Unable to delete expense.'));
        }
    }

    return (
        <div className="space-y-5">
            <ExpenseRecordForm
                onCreated={async () => {
                    onNotice('Expense added.');
                    setPage(1);
                    await load();
                }}
                onError={onNotice}
            />
            <div className="space-y-3 rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Filters</p>
                <div className="flex flex-wrap gap-2">
                    {[
                        ['This week', 'week'],
                        ['This month', 'month'],
                        ['Last 30 days', 'last30'],
                    ].map(([label, preset]) => (
                        <button
                            key={preset}
                            type="button"
                            onClick={() => applyPreset(preset as 'week' | 'month' | 'last30')}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-[#d97745] hover:text-[#c26435]"
                        >
                            {label}
                        </button>
                    ))}
                    <button
                        type="button"
                        onClick={clearFilters}
                        className="rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-500"
                    >
                        Clear all
                    </button>
                </div>
                <FilterBar from={from} to={to} onFromChange={value => { setFrom(value); setFiltersDirty(true); }} onToChange={value => { setTo(value); setFiltersDirty(true); }} onApply={applyFilters}>
                    <select value={category} onChange={event => { setCategory(event.target.value); setFiltersDirty(true); }} className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm">
                        <option value="">All categories</option>
                        {categoryOptions.map(option => (
                            <option key={option} value={option}>
                                {option}
                            </option>
                        ))}
                    </select>
                    <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={minAmount}
                        onChange={event => { setMinAmount(event.target.value); setFiltersDirty(true); }}
                        placeholder="Min Rs."
                        className="w-28 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm"
                    />
                    <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={maxAmount}
                        onChange={event => { setMaxAmount(event.target.value); setFiltersDirty(true); }}
                        placeholder="Max Rs."
                        className="w-28 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm"
                    />
                </FilterBar>
                {filtersDirty && <p className="text-xs text-amber-700">Filters changed — click Apply filters to refresh the list.</p>}
                <p className="text-sm text-slate-600">
                    Filtered total: <span className="font-semibold text-red-600">{money(filteredTotal)}</span>
                    {' · '}
                    {meta.total} record{meta.total === 1 ? '' : 's'}
                </p>
            </div>
            <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px] text-left text-sm">
                        <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wider text-slate-400">
                            <tr>
                                <th className="px-5 py-4">Date</th>
                                <th className="px-5 py-4">Category</th>
                                <th className="px-5 py-4">Description</th>
                                <th className="px-5 py-4">Recorded by</th>
                                <th className="px-5 py-4">Amount</th>
                                <th className="px-5 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading && (
                                <tr>
                                    <td colSpan={6} className="px-5 py-14 text-center text-slate-400">
                                        Loading…
                                    </td>
                                </tr>
                            )}
                            {!loading &&
                                rows.map(row => (
                                    <tr key={row.id} className="hover:bg-slate-50">
                                        <td className="px-5 py-4">{new Date(row.expense_date).toLocaleDateString('en-GB')}</td>
                                        <td className="px-5 py-4 font-semibold">{row.category}</td>
                                        <td className="max-w-[200px] truncate px-5 py-4 text-slate-500">{row.description ?? '—'}</td>
                                        <td className="px-5 py-4 text-slate-500">{row.user?.name ?? '—'}</td>
                                        <td className="px-5 py-4 font-semibold text-red-600">{money(Number(row.amount))}</td>
                                        <td className="px-5 py-4">
                                            <div className="flex justify-end gap-1">
                                                <button type="button" onClick={() => setEditing(row)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" title="Edit">
                                                    <Pencil size={16} />
                                                </button>
                                                <button type="button" onClick={() => removeExpense(row)} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-500" title="Delete">
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            {!loading && rows.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-5 py-14 text-center text-slate-400">
                                        No expenses found for these filters.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                <PaginationBar meta={meta} page={page} onPageChange={setPage} entityLabel="expenses" />
            </div>
            {editing && (
                <ExpenseEditModal
                    expense={editing}
                    categoryOptions={categoryOptions}
                    onClose={() => setEditing(null)}
                    onSaved={async () => {
                        onNotice('Expense updated.');
                        setEditing(null);
                        await load();
                    }}
                    onError={onNotice}
                />
            )}
        </div>
    );
}

function ExpenseRecordForm({ onCreated, onError }: { onCreated: () => void; onError: (message: string) => void }) {
    const [category, setCategory] = useState('');
    const [amount, setAmount] = useState('');
    const [date, setDate] = useState(isoDate(new Date()));
    const [description, setDescription] = useState('');
    const [busy, setBusy] = useState(false);

    async function submit(event: FormEvent) {
        event.preventDefault();
        setBusy(true);
        try {
            await axios.post('/api/expenses', {
                category: category.trim(),
                amount: Number(amount),
                expense_date: date,
                description: description.trim() || null,
            });
            setCategory('');
            setAmount('');
            setDescription('');
            onCreated();
        } catch (error: any) {
            onError(apiErrorMessage(error, 'Unable to add expense.'));
        } finally {
            setBusy(false);
        }
    }

    return (
        <form onSubmit={submit} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
            <div className="mb-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#d97745]">Record an expense</p>
                <h2 className="mt-1 text-lg font-semibold">Add gas, electricity, labour, or any other cost</h2>
            </div>
            <div className="grid gap-3 md:grid-cols-4">
                <input
                    required
                    list="expense-category-suggestions"
                    value={category}
                    onChange={event => setCategory(event.target.value)}
                    placeholder="Category e.g. Labour"
                    className="rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-[#d97745]"
                />
                <datalist id="expense-category-suggestions">
                    {EXPENSE_CATEGORY_PRESETS.map(option => (
                        <option key={option} value={option} />
                    ))}
                </datalist>
                <input required min="0.01" type="number" step="0.01" value={amount} onChange={event => setAmount(event.target.value)} placeholder="Amount (Rs.)" className="rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-[#d97745]" />
                <input required type="date" value={date} onChange={event => setDate(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-[#d97745]" />
                <input value={description} onChange={event => setDescription(event.target.value)} placeholder="Description (optional)" className="rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-[#d97745]" />
            </div>
            <button disabled={busy} className="mt-3 rounded-xl bg-[#d97745] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">
                {busy ? 'Saving…' : 'Add expense'}
            </button>
        </form>
    );
}

function ExpenseEditModal({
    expense,
    categoryOptions,
    onClose,
    onSaved,
    onError,
}: {
    expense: ExpenseRow;
    categoryOptions: string[];
    onClose: () => void;
    onSaved: () => void;
    onError: (message: string) => void;
}) {
    const [category, setCategory] = useState(expense.category);
    const [amount, setAmount] = useState(String(expense.amount));
    const [date, setDate] = useState(expense.expense_date.slice(0, 10));
    const [description, setDescription] = useState(expense.description ?? '');
    const [busy, setBusy] = useState(false);

    async function submit(event: FormEvent) {
        event.preventDefault();
        setBusy(true);
        try {
            await axios.put(`/api/expenses/${expense.id}`, {
                category: category.trim(),
                amount: Number(amount),
                expense_date: date,
                description: description.trim() || null,
            });
            onSaved();
        } catch (error: any) {
            onError(apiErrorMessage(error, 'Unable to update expense.'));
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#102b2b]/40 p-4" onClick={onClose}>
            <form onSubmit={submit} onClick={event => event.stopPropagation()} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
                <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#d97745]">Edit expense</p>
                        <h2 className="mt-1 text-xl font-semibold">{expense.category}</h2>
                    </div>
                    <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
                        <X size={18} />
                    </button>
                </div>
                <div className="space-y-3">
                    <select value={category} onChange={event => setCategory(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm">
                        {[...new Set([category, ...categoryOptions])].map(option => (
                            <option key={option} value={option}>
                                {option}
                            </option>
                        ))}
                    </select>
                    <input type="number" min="0.01" step="0.01" required value={amount} onChange={event => setAmount(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm" />
                    <input type="date" required value={date} onChange={event => setDate(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm" />
                    <textarea value={description} onChange={event => setDescription(event.target.value)} rows={3} placeholder="Description" className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm" />
                </div>
                <div className="mt-5 flex gap-2">
                    <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-600">
                        Cancel
                    </button>
                    <button type="submit" disabled={busy} className="flex-1 rounded-xl bg-[#102b2b] py-3 text-sm font-semibold text-white disabled:opacity-50">
                        {busy ? 'Saving…' : 'Save changes'}
                    </button>
                </div>
            </form>
        </div>
    );
}

function FilterBar({ from, to, onFromChange, onToChange, onApply, children }: { from: string; to: string; onFromChange: (value: string) => void; onToChange: (value: string) => void; onApply: () => void; children?: ReactNode }) {
    return <div className="flex flex-wrap items-end gap-2 rounded-2xl bg-slate-50 p-4"><label className="text-xs font-semibold text-slate-500">From<input type="date" value={from} onChange={event => onFromChange(event.target.value)} className="mt-1 block rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm" /></label><label className="text-xs font-semibold text-slate-500">To<input type="date" value={to} onChange={event => onToChange(event.target.value)} className="mt-1 block rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm" /></label>{children}<button onClick={onApply} className="rounded-xl bg-[#102b2b] px-4 py-3 text-sm font-semibold text-white">Apply filters</button></div>;
}

type UserRow = { id: number; name: string; email: string; role: 'ADMIN' | 'CASHIER' | 'SERVER'; is_active: boolean };

function apiErrorMessage(error: any, fallback: string) {
    const data = error?.response?.data;
    if (typeof data?.message === 'string' && /SQLSTATE|duplicate key/i.test(data.message)) {
        return /unique|already exists/i.test(data.message) ? 'That name is already in use.' : fallback;
    }
    if (data?.message && !/SQLSTATE/i.test(data.message)) return data.message;
    const errors = data?.errors;
    if (errors && typeof errors === 'object') {
        const first = Object.values(errors)[0];
        if (Array.isArray(first) && first[0]) return String(first[0]);
    }
    return fallback;
}

interface CategoryRow {
    id: number;
    name: string;
    description?: string | null;
    is_active: boolean;
    parent_id?: number | null;
    products_count?: number;
    children_count?: number;
    parent?: { id: number; name: string } | null;
}

interface PaginatedMeta {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
}

function PaginationBar({ meta, page, onPageChange, entityLabel = 'records' }: { meta: PaginatedMeta; page: number; onPageChange: (page: number) => void; entityLabel?: string }) {
    if (meta.last_page <= 1) {
        return null;
    }

    const windowStart = Math.max(1, page - 2);
    const windowEnd = Math.min(meta.last_page, page + 2);
    const pages: number[] = [];
    for (let i = windowStart; i <= windowEnd; i++) {
        pages.push(i);
    }

    return (
        <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-500">
                Showing {meta.from ?? 0}–{meta.to ?? 0} of {meta.total} {entityLabel}
            </p>
            <div className="flex flex-wrap items-center gap-1">
                <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => onPageChange(page - 1)}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 disabled:opacity-40"
                >
                    Previous
                </button>
                {pages.map(p => (
                    <button
                        key={p}
                        type="button"
                        onClick={() => onPageChange(p)}
                        className={`min-w-[2.25rem] rounded-lg px-2 py-1.5 text-xs font-bold ${p === page ? 'bg-[#102b2b] text-white' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                    >
                        {p}
                    </button>
                ))}
                <button
                    type="button"
                    disabled={page >= meta.last_page}
                    onClick={() => onPageChange(page + 1)}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 disabled:opacity-40"
                >
                    Next
                </button>
            </div>
        </div>
    );
}

function CategoriesPanel({ search, onNotice }: { search: string; onNotice: (message: string) => void }) {
    const { confirm } = useFeedback();
    const [rows, setRows] = useState<CategoryRow[]>([]);
    const [page, setPage] = useState(1);
    const [meta, setMeta] = useState<PaginatedMeta>({
        current_page: 1,
        last_page: 1,
        per_page: 10,
        total: 0,
        from: null,
        to: null,
    });
    const [editing, setEditing] = useState<CategoryRow | null>(null);
    const [presetParentId, setPresetParentId] = useState('');
    const [loading, setLoading] = useState(true);

    const load = useCallback(() => {
        setLoading(true);
        return axios
            .get('/api/categories', { params: { page, per_page: 50 } })
            .then(response => {
                setRows(response.data.data ?? []);
                setMeta({
                    current_page: response.data.current_page ?? 1,
                    last_page: response.data.last_page ?? 1,
                    per_page: response.data.per_page ?? 10,
                    total: response.data.total ?? 0,
                    from: response.data.from ?? null,
                    to: response.data.to ?? null,
                });
            })
            .catch(() => onNotice('Unable to load categories.'))
            .finally(() => setLoading(false));
    }, [page, onNotice]);

    useEffect(() => {
        void load();
    }, [load]);

    const query = search.trim().toLowerCase();
    const visible = rows.filter(category => {
        const label = `${category.parent?.name ?? ''} ${category.name} ${category.description ?? ''}`.toLowerCase();
        return query === '' || label.includes(query);
    });

    async function removeCategory(category: CategoryRow) {
        const subs = category.children_count ?? 0;
        const childDishes = rows
            .filter(row => row.parent_id === category.id)
            .reduce((sum, row) => sum + (row.products_count ?? 0), 0);
        const dishes = (category.products_count ?? 0) + childDishes;
        const extra = [
            subs > 0 ? `${subs} sub-categor${subs === 1 ? 'y' : 'ies'}` : '',
            dishes > 0 ? `${dishes} dish${dishes === 1 ? '' : 'es'}` : '',
        ].filter(Boolean).join(' and ');
        const warning = extra ? ` This also removes ${extra} from the menu.` : '';
        if (!(await confirm(`Delete "${category.name}"?${warning}`))) {
            return;
        }
        try {
            await axios.delete(`/api/categories/${category.id}`);
            onNotice(`Category "${category.name}" deleted.`);
            if (rows.length === 1 && page > 1) {
                setPage(current => current - 1);
            } else {
                await load();
            }
        } catch (error: any) {
            onNotice(apiErrorMessage(error, 'Unable to delete this category.'));
        }
    }

    async function toggleActive(category: CategoryRow) {
        try {
            await axios.put(`/api/categories/${category.id}`, { is_active: !category.is_active });
            onNotice(category.is_active ? `"${category.name}" hidden from menus.` : `"${category.name}" is active again.`);
            await load();
        } catch (error: any) {
            onNotice(apiErrorMessage(error, 'Unable to update this category.'));
        }
    }

    return (
        <div className="space-y-5">
            <CategoryForm
                parents={rows.filter(category => !category.parent_id)}
                parentId={presetParentId}
                onParentChange={setPresetParentId}
                onCreated={async () => {
                    onNotice('Category created.');
                    setPage(1);
                    await load();
                }}
                onError={onNotice}
            />
            <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px] text-left text-sm">
                        <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wider text-slate-400">
                            <tr>
                                <th className="px-5 py-4">Name</th>
                                <th className="px-5 py-4">Type</th>
                                <th className="px-5 py-4">Products</th>
                                <th className="px-5 py-4">Status</th>
                                <th className="px-5 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading && rows.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-5 py-14 text-center text-slate-400">
                                        Loading…
                                    </td>
                                </tr>
                            )}
                            {visible.map(category => (
                                    <tr key={category.id} className="hover:bg-slate-50">
                                        <td className="px-5 py-4 font-semibold">{category.parent?.name ? `${category.parent.name} / ${category.name}` : category.name}</td>
                                        <td className="px-5 py-4 text-slate-600">{category.parent_id ? 'Sub-category' : 'Main category'}</td>
                                        <td className="px-5 py-4 text-slate-600">{category.products_count ?? 0}</td>
                                        <td className="px-5 py-4">
                                            <button
                                                type="button"
                                                onClick={() => toggleActive(category)}
                                                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${category.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}
                                            >
                                                {category.is_active ? 'Active' : 'Inactive'}
                                            </button>
                                        </td>
                                        <td className="px-5 py-4">
                                            <div className="flex justify-end gap-1">
                                                {!category.parent_id && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setPresetParentId(String(category.id));
                                                            document.getElementById('category-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                                        }}
                                                        className="rounded-lg px-2 py-1 text-xs font-semibold text-[#b65b2e] hover:bg-[#fff4ec]"
                                                    >
                                                        Add sub
                                                    </button>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() => setEditing(category)}
                                                    className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                                                    title="Edit"
                                                >
                                                    <Pencil size={16} />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => removeCategory(category)}
                                                    className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-500"
                                                    title="Delete"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            {!loading && visible.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-5 py-14 text-center text-slate-400">
                                        No categories found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                <PaginationBar meta={meta} page={page} onPageChange={setPage} entityLabel="categories" />
            </div>
            {editing && (
                <CategoryEditModal
                    category={editing}
                    parents={rows.filter(category => !category.parent_id && category.id !== editing.id)}
                    onClose={() => setEditing(null)}
                    onSaved={async () => {
                        onNotice('Category updated.');
                        setEditing(null);
                        await load();
                    }}
                    onError={onNotice}
                />
            )}
        </div>
    );
}

function CategoryForm({
    parents,
    parentId,
    onParentChange,
    onCreated,
    onError,
}: {
    parents: CategoryRow[];
    parentId: string;
    onParentChange: (value: string) => void;
    onCreated: () => void;
    onError: (message: string) => void;
}) {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [busy, setBusy] = useState(false);

    async function submit(event: FormEvent) {
        event.preventDefault();
        if (!name.trim()) {
            return;
        }
        setBusy(true);
        try {
            await axios.post('/api/categories', {
                name: name.trim(),
                description: description.trim() || null,
                parent_id: parentId ? Number(parentId) : null,
                is_active: true,
            });
            setName('');
            onParentChange('');
            setDescription('');
            onCreated();
        } catch (error: any) {
            onError(apiErrorMessage(error, 'Unable to create category.'));
        } finally {
            setBusy(false);
        }
    }

    return (
        <form id="category-form" onSubmit={submit} className="scroll-mt-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
            <div className="mb-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#d97745]">Menu categories</p>
                <h2 className="mt-1 text-lg font-semibold">Add a category</h2>
                <p className="mt-1 text-sm text-slate-500">Leave the parent as “Main category”, or choose one to add a sub-category such as Idly under Breakfast.</p>
            </div>
            <div className="grid gap-2 lg:grid-cols-[minmax(0,1.2fr)_minmax(14rem,0.8fr)_auto]">
                <input
                    required
                    value={name}
                    onChange={event => setName(event.target.value)}
                    placeholder="Category name"
                    className="rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-[#d97745]"
                />
                <select
                    value={parentId}
                    onChange={event => onParentChange(event.target.value)}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-[#d97745]"
                >
                    <option value="">Main category</option>
                    {parents.map(parent => (
                        <option key={parent.id} value={parent.id}>
                            Under {parent.name}
                        </option>
                    ))}
                </select>
                <button disabled={busy} className="flex items-center justify-center gap-2 rounded-xl bg-[#d97745] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">
                    <Plus size={17} />
                    {busy ? 'Saving…' : parentId ? 'Add sub-category' : 'Add category'}
                </button>
            </div>
            <input
                value={description}
                onChange={event => setDescription(event.target.value)}
                placeholder="Note shown under this section (optional)"
                className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-[#d97745]"
            />
        </form>
    );
}

function CategoryEditModal({
    category,
    parents,
    onClose,
    onSaved,
    onError,
}: {
    category: CategoryRow;
    parents: CategoryRow[];
    onClose: () => void;
    onSaved: () => void;
    onError: (message: string) => void;
}) {
    const [name, setName] = useState(category.name);
    const [parentId, setParentId] = useState(category.parent_id ? String(category.parent_id) : '');
    const [description, setDescription] = useState(category.description ?? '');
    const [isActive, setIsActive] = useState(category.is_active);
    const [busy, setBusy] = useState(false);
    const lockedAsMain = (category.children_count ?? 0) > 0;

    async function submit(event: FormEvent) {
        event.preventDefault();
        setBusy(true);
        try {
            await axios.put(`/api/categories/${category.id}`, {
                name: name.trim(),
                description: description.trim() || null,
                parent_id: lockedAsMain ? null : parentId ? Number(parentId) : null,
                is_active: isActive,
            });
            onSaved();
        } catch (error: any) {
            onError(apiErrorMessage(error, 'Unable to update category.'));
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#102b2b]/40 p-4" onClick={onClose}>
            <form
                onSubmit={submit}
                onClick={event => event.stopPropagation()}
                className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
            >
                <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#d97745]">Edit category</p>
                        <h2 className="mt-1 text-xl font-semibold">{category.name}</h2>
                    </div>
                    <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
                        <X size={18} />
                    </button>
                </div>
                <div className="space-y-3">
                    <input
                        required
                        value={name}
                        onChange={event => setName(event.target.value)}
                        className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-[#d97745]"
                    />
                    <select
                        value={lockedAsMain ? '' : parentId}
                        disabled={lockedAsMain}
                        onChange={event => setParentId(event.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-[#d97745] disabled:bg-slate-50"
                    >
                        <option value="">Main category</option>
                        {parents.map(parent => (
                            <option key={parent.id} value={parent.id}>
                                Sub-category under {parent.name}
                            </option>
                        ))}
                    </select>
                    {lockedAsMain && (
                        <p className="text-xs text-slate-500">This main category has sub-categories, so it cannot be moved under another category.</p>
                    )}
                    <input
                        value={description}
                        onChange={event => setDescription(event.target.value)}
                        placeholder="Note shown under this section (optional)"
                        className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-[#d97745]"
                    />
                    <label className="flex items-center gap-2 text-sm text-slate-600">
                        <input
                            type="checkbox"
                            checked={isActive}
                            onChange={event => setIsActive(event.target.checked)}
                            className="h-4 w-4 rounded border-slate-300"
                        />
                        Show on server & POS menus
                    </label>
                </div>
                <div className="mt-5 flex gap-2">
                    <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-600">
                        Cancel
                    </button>
                    <button type="submit" disabled={busy} className="flex-1 rounded-xl bg-[#102b2b] py-3 text-sm font-semibold text-white disabled:opacity-50">
                        {busy ? 'Saving…' : 'Save changes'}
                    </button>
                </div>
            </form>
        </div>
    );
}

interface ProductRow {
    id: number;
    name: string;
    price: string | number | null;
    price_label?: string | null;
    description?: string | null;
    is_available: boolean;
    is_orderable?: boolean;
    category_id: number;
    category?: { id: number; name: string; parent?: { id: number; name: string } | null } | null;
}

function ProductsPanel({ search, onNotice }: { search: string; onNotice: (message: string) => void }) {
    const { confirm } = useFeedback();
    const [rows, setRows] = useState<ProductRow[]>([]);
    const [categories, setCategories] = useState<CategoryRow[]>([]);
    const [page, setPage] = useState(1);
    const [meta, setMeta] = useState<PaginatedMeta>({
        current_page: 1,
        last_page: 1,
        per_page: 10,
        total: 0,
        from: null,
        to: null,
    });
    const [editing, setEditing] = useState<ProductRow | null>(null);
    const [loading, setLoading] = useState(true);

    const load = useCallback(() => {
        setLoading(true);
        return axios
            .get('/api/products', { params: { page, per_page: 10, search: search.trim() || undefined } })
            .then(response => {
                setRows(response.data.data ?? []);
                setMeta({
                    current_page: response.data.current_page ?? 1,
                    last_page: response.data.last_page ?? 1,
                    per_page: response.data.per_page ?? 10,
                    total: response.data.total ?? 0,
                    from: response.data.from ?? null,
                    to: response.data.to ?? null,
                });
            })
            .catch(() => onNotice('Unable to load products.'))
            .finally(() => setLoading(false));
    }, [page, search, onNotice]);

    useEffect(() => {
        axios
            .get('/api/categories', { params: { page: 1, per_page: 100 } })
            .then(response => setCategories(response.data.data ?? response.data ?? []))
            .catch(() => undefined);
    }, []);

    useEffect(() => {
        setPage(1);
    }, [search]);

    useEffect(() => {
        void load();
    }, [load]);

    async function removeProduct(product: ProductRow) {
        if (!(await confirm(`Delete "${product.name}"? This cannot be undone if the item was never sold.`))) {
            return;
        }
        try {
            await axios.delete(`/api/products/${product.id}`);
            onNotice(`Product "${product.name}" deleted.`);
            if (rows.length === 1 && page > 1) {
                setPage(current => current - 1);
            } else {
                await load();
            }
        } catch (error: any) {
            onNotice(apiErrorMessage(error, 'Unable to delete this product.'));
        }
    }

    async function toggleAvailable(product: ProductRow) {
        try {
            await axios.put(`/api/products/${product.id}`, { is_available: !product.is_available });
            onNotice(product.is_available ? `"${product.name}" hidden from menus.` : `"${product.name}" is available again.`);
            await load();
        } catch (error: any) {
            onNotice(apiErrorMessage(error, 'Unable to update this product.'));
        }
    }

    return (
        <div className="space-y-5">
            <ProductForm
                categories={categories}
                onCreated={async () => {
                    onNotice('Product created.');
                    setPage(1);
                    await load();
                }}
                onError={onNotice}
            />
            <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[800px] text-left text-sm">
                        <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wider text-slate-400">
                            <tr>
                                <th className="px-5 py-4">Product</th>
                                <th className="px-5 py-4">Category</th>
                                <th className="px-5 py-4">Price</th>
                                <th className="px-5 py-4">Status</th>
                                <th className="px-5 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading && (
                                <tr>
                                    <td colSpan={5} className="px-5 py-14 text-center text-slate-400">
                                        Loading…
                                    </td>
                                </tr>
                            )}
                            {!loading &&
                                rows.map(product => (
                                    <tr key={product.id} className="hover:bg-slate-50">
                                        <td className="px-5 py-4 font-semibold">
                                            <div className="flex items-center gap-2">
                                                <Package size={17} className="shrink-0 text-[#d97745]" />
                                                {product.name}
                                            </div>
                                        </td>
                                        <td className="px-5 py-4 text-slate-600">{product.category?.parent?.name ? `${product.category.parent.name} / ${product.category.name}` : product.category?.name ?? '—'}</td>
                                        <td className="px-5 py-4 font-medium text-[#c26435]">{menuPriceText(product)}</td>
                                        <td className="px-5 py-4">
                                            <button
                                                type="button"
                                                onClick={() => toggleAvailable(product)}
                                                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${product.is_available ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}
                                            >
                                                {product.is_available ? 'Available' : 'Unavailable'}
                                            </button>
                                        </td>
                                        <td className="px-5 py-4">
                                            <div className="flex justify-end gap-1">
                                                <button
                                                    type="button"
                                                    onClick={() => setEditing(product)}
                                                    className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                                                    title="Edit"
                                                >
                                                    <Pencil size={16} />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => removeProduct(product)}
                                                    className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-500"
                                                    title="Delete"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            {!loading && rows.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-5 py-14 text-center text-slate-400">
                                        No products found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                <PaginationBar meta={meta} page={page} onPageChange={setPage} entityLabel="products" />
            </div>
            {editing && (
                <ProductEditModal
                    product={editing}
                    categories={categories}
                    onClose={() => setEditing(null)}
                    onSaved={async () => {
                        onNotice('Product updated.');
                        setEditing(null);
                        await load();
                    }}
                    onError={onNotice}
                />
            )}
        </div>
    );
}

function ProductForm({
    categories,
    onCreated,
    onError,
}: {
    categories: CategoryRow[];
    onCreated: () => void;
    onError: (message: string) => void;
}) {
    const [name, setName] = useState('');
    const [categoryId, setCategoryId] = useState('');
    const [price, setPrice] = useState('');
    const [description, setDescription] = useState('');
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (!categoryId && categories.length > 0) {
            setCategoryId(String(categories[0].id));
        }
    }, [categories, categoryId]);

    async function submit(event: FormEvent) {
        event.preventDefault();
        if (!name.trim() || !categoryId || !price) {
            return;
        }
        setBusy(true);
        try {
            await axios.post('/api/products', {
                name: name.trim(),
                category_id: Number(categoryId),
                price: Number(price),
                description: description.trim() || null,
                is_available: true,
            });
            setName('');
            setPrice('');
            setDescription('');
            onCreated();
        } catch (error: any) {
            onError(apiErrorMessage(error, 'Unable to create product.'));
        } finally {
            setBusy(false);
        }
    }

    return (
        <form onSubmit={submit} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
            <div className="mb-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#d97745]">Menu products</p>
                <h2 className="mt-1 text-lg font-semibold">Add a product</h2>
                <p className="mt-1 text-sm text-slate-500">Items appear on server and cashier menus under the chosen category.</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
                <input
                    required
                    value={name}
                    onChange={event => setName(event.target.value)}
                    placeholder="Product name"
                    className="rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-[#d97745] lg:col-span-2"
                />
                <select
                    required
                    value={categoryId}
                    onChange={event => setCategoryId(event.target.value)}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-[#d97745]"
                >
                    <option value="" disabled>
                        Category
                    </option>
                    {categories.map(category => (
                        <option key={category.id} value={category.id}>
                            {category.parent?.name ? `${category.parent.name} / ${category.name}` : category.name}
                        </option>
                    ))}
                </select>
                <input
                    required
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={price}
                    onChange={event => setPrice(event.target.value)}
                    placeholder="Price (Rs.)"
                    className="rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-[#d97745]"
                />
                <button
                    disabled={busy || categories.length === 0}
                    className="flex items-center justify-center gap-2 rounded-xl bg-[#d97745] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
                >
                    <Plus size={17} />
                    {busy ? 'Saving…' : 'Add product'}
                </button>
            </div>
            <input
                value={description}
                onChange={event => setDescription(event.target.value)}
                placeholder="Description (optional)"
                className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-[#d97745]"
            />
            {categories.length === 0 && (
                <p className="mt-2 text-sm text-amber-700">Create a category first, then add products.</p>
            )}
        </form>
    );
}

function ProductEditModal({
    product,
    categories,
    onClose,
    onSaved,
    onError,
}: {
    product: ProductRow;
    categories: CategoryRow[];
    onClose: () => void;
    onSaved: () => void;
    onError: (message: string) => void;
}) {
    const [name, setName] = useState(product.name);
    const [categoryId, setCategoryId] = useState(String(product.category_id));
    const [price, setPrice] = useState(product.price == null ? '' : String(product.price));
    const [description, setDescription] = useState(product.description ?? '');
    const [isAvailable, setIsAvailable] = useState(product.is_available);
    const [busy, setBusy] = useState(false);

    async function submit(event: FormEvent) {
        event.preventDefault();
        setBusy(true);
        try {
            await axios.put(`/api/products/${product.id}`, {
                name: name.trim(),
                category_id: Number(categoryId),
                price: price.trim() === '' ? null : Number(price),
                price_label: price.trim() === '' ? (product.price_label || 'Price to be confirmed') : null,
                is_orderable: price.trim() !== '',
                description: description.trim() || null,
                is_available: isAvailable,
            });
            onSaved();
        } catch (error: any) {
            onError(apiErrorMessage(error, 'Unable to update product.'));
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#102b2b]/40 p-4" onClick={onClose}>
            <form
                onSubmit={submit}
                onClick={event => event.stopPropagation()}
                className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
            >
                <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#d97745]">Edit product</p>
                        <h2 className="mt-1 text-xl font-semibold">{product.name}</h2>
                    </div>
                    <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
                        <X size={18} />
                    </button>
                </div>
                <div className="space-y-3">
                    <input
                        required
                        value={name}
                        onChange={event => setName(event.target.value)}
                        className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-[#d97745]"
                    />
                    <select
                        required
                        value={categoryId}
                        onChange={event => setCategoryId(event.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm"
                    >
                        {categories.map(category => (
                            <option key={category.id} value={category.id}>
                                {category.parent?.name ? `${category.parent.name} / ${category.name}` : category.name}
                            </option>
                        ))}
                    </select>
                    <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={price}
                        onChange={event => setPrice(event.target.value)}
                        placeholder="Leave blank if the price is not confirmed"
                        className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-[#d97745]"
                    />
                    <textarea
                        value={description}
                        onChange={event => setDescription(event.target.value)}
                        placeholder="Description"
                        rows={3}
                        className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-[#d97745]"
                    />
                    <label className="flex items-center gap-2 text-sm text-slate-600">
                        <input
                            type="checkbox"
                            checked={isAvailable}
                            onChange={event => setIsAvailable(event.target.checked)}
                            className="h-4 w-4 rounded border-slate-300"
                        />
                        Available on server & POS menus
                    </label>
                </div>
                <div className="mt-5 flex gap-2">
                    <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-600">
                        Cancel
                    </button>
                    <button type="submit" disabled={busy} className="flex-1 rounded-xl bg-[#102b2b] py-3 text-sm font-semibold text-white disabled:opacity-50">
                        {busy ? 'Saving…' : 'Save changes'}
                    </button>
                </div>
            </form>
        </div>
    );
}

function UsersPanel({ rows, search, onRefresh, onNotice }: { rows: UserRow[]; search: string; onRefresh: () => void; onNotice: (message: string) => void }) {
    const { confirm } = useFeedback();
    const [editing, setEditing] = useState<UserRow | null>(null);

    const filtered = rows.filter(row => `${row.name} ${row.email} ${row.role}`.toLowerCase().includes(search.toLowerCase()));

    async function removeUser(user: UserRow) {
        if (!(await confirm(`Delete ${user.name}? Accounts with order history are deactivated instead of removed.`))) return;
        try {
            const response = await axios.delete(`/api/users/${user.id}`);
            onNotice(response.data?.message ?? 'User removed.');
            onRefresh();
        } catch (error: any) {
            onNotice(apiErrorMessage(error, 'Unable to remove this user.'));
        }
    }

    async function toggleActive(user: UserRow) {
        try {
            await axios.put(`/api/users/${user.id}`, { is_active: !user.is_active });
            onNotice(user.is_active ? `${user.name} deactivated.` : `${user.name} activated.`);
            onRefresh();
        } catch (error: any) {
            onNotice(apiErrorMessage(error, 'Unable to update this user.'));
        }
    }

    return (
        <div className="space-y-5">
            <UserForm onCreated={() => { onNotice('User created.'); onRefresh(); }} onError={onNotice} />
            <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px] text-left text-sm">
                        <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wider text-slate-400">
                            <tr>
                                <th className="px-5 py-4">Name</th>
                                <th className="px-5 py-4">Email</th>
                                <th className="px-5 py-4">Role</th>
                                <th className="px-5 py-4">Status</th>
                                <th className="px-5 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filtered.map(user => (
                                <tr key={user.id} className="hover:bg-slate-50">
                                    <td className="px-5 py-4 font-semibold">{user.name}</td>
                                    <td className="px-5 py-4 text-slate-600">{user.email}</td>
                                    <td className="px-5 py-4">
                                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{user.role}</span>
                                    </td>
                                    <td className="px-5 py-4">
                                        <button
                                            type="button"
                                            onClick={() => toggleActive(user)}
                                            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${user.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}
                                        >
                                            {user.is_active ? 'Active' : 'Inactive'}
                                        </button>
                                    </td>
                                    <td className="px-5 py-4">
                                        <div className="flex justify-end gap-1">
                                            <button type="button" onClick={() => setEditing(user)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" title="Edit">
                                                <Pencil size={16} />
                                            </button>
                                            <button type="button" onClick={() => removeUser(user)} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-500" title="Delete">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filtered.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-5 py-14 text-center text-slate-400">
                                        No users found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            {editing && <UserEditModal user={editing} onClose={() => setEditing(null)} onSaved={() => { onNotice('User updated.'); setEditing(null); onRefresh(); }} onError={onNotice} />}
        </div>
    );
}

function UserForm({ onCreated, onError }: { onCreated: () => void; onError: (message: string) => void }) {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState<UserRow['role']>('SERVER');
    const [busy, setBusy] = useState(false);

    async function submit(event: FormEvent) {
        event.preventDefault();
        setBusy(true);
        try {
            await axios.post('/api/users', { name, email, password, role, is_active: true });
            setName('');
            setEmail('');
            setPassword('');
            setRole('SERVER');
            onCreated();
        } catch (error: any) {
            onError(apiErrorMessage(error, 'Unable to create user.'));
        } finally {
            setBusy(false);
        }
    }

    return (
        <form onSubmit={submit} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
            <div className="mb-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#d97745]">Staff accounts</p>
                <h2 className="mt-1 text-lg font-semibold">Add admin, cashier, or server login</h2>
                <p className="mt-1 text-sm text-slate-500">Password must be at least 8 characters. Each person signs in with their email, password, and role.</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
                <input required value={name} onChange={event => setName(event.target.value)} placeholder="Full name" className="rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-[#d97745]" />
                <input required type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="Email" className="rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-[#d97745]" />
                <input required minLength={8} type="password" value={password} onChange={event => setPassword(event.target.value)} placeholder="Password (min 8)" className="rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-[#d97745]" />
                <select value={role} onChange={event => setRole(event.target.value as UserRow['role'])} className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm">
                    <option value="SERVER">SERVER</option>
                    <option value="CASHIER">CASHIER</option>
                    <option value="ADMIN">ADMIN</option>
                </select>
                <button disabled={busy} className="rounded-xl bg-[#d97745] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Saving…' : 'Create user'}</button>
            </div>
        </form>
    );
}

function UserEditModal({ user, onClose, onSaved, onError }: { user: UserRow; onClose: () => void; onSaved: () => void; onError: (message: string) => void }) {
    const [name, setName] = useState(user.name);
    const [email, setEmail] = useState(user.email);
    const [password, setPassword] = useState('');
    const [role, setRole] = useState(user.role);
    const [isActive, setIsActive] = useState(user.is_active);
    const [busy, setBusy] = useState(false);

    async function submit(event: FormEvent) {
        event.preventDefault();
        setBusy(true);
        try {
            await axios.put(`/api/users/${user.id}`, {
                name,
                email,
                role,
                is_active: isActive,
                ...(password ? { password } : {}),
            });
            onSaved();
        } catch (error: any) {
            onError(apiErrorMessage(error, 'Unable to update user.'));
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#102b2b]/40 p-4" onClick={onClose}>
            <form
                onSubmit={submit}
                onClick={event => event.stopPropagation()}
                className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
            >
                <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#d97745]">Edit user</p>
                        <h2 className="mt-1 text-xl font-semibold">{user.name}</h2>
                    </div>
                    <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
                        <X size={18} />
                    </button>
                </div>
                <div className="space-y-3">
                    <input required value={name} onChange={event => setName(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-[#d97745]" />
                    <input required type="email" value={email} onChange={event => setEmail(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-[#d97745]" />
                    <input type="password" minLength={8} value={password} onChange={event => setPassword(event.target.value)} placeholder="New password (leave blank to keep)" className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-[#d97745]" />
                    <select value={role} onChange={event => setRole(event.target.value as UserRow['role'])} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm">
                        <option value="SERVER">SERVER</option>
                        <option value="CASHIER">CASHIER</option>
                        <option value="ADMIN">ADMIN</option>
                    </select>
                    <label className="flex items-center gap-2 text-sm text-slate-600">
                        <input type="checkbox" checked={isActive} onChange={event => setIsActive(event.target.checked)} className="h-4 w-4 rounded border-slate-300" />
                        Account is active (can sign in)
                    </label>
                </div>
                <div className="mt-5 flex gap-2">
                    <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-600">
                        Cancel
                    </button>
                    <button type="submit" disabled={busy} className="flex-1 rounded-xl bg-[#102b2b] py-3 text-sm font-semibold text-white disabled:opacity-50">
                        {busy ? 'Saving…' : 'Save changes'}
                    </button>
                </div>
            </form>
        </div>
    );
}

interface ShiftHistoryRow {
    id: number;
    opening_time: string;
    closing_time: string | null;
    opening_cash: number | string;
    closing_cash: number | string | null;
    status: 'OPEN' | 'CLOSED';
    expected_cash_in_drawer?: number | string;
    cashier?: { id: number; name: string; email?: string } | null;
}

const formatShiftWhen = (value: string | null | undefined) =>
    value ? new Date(value).toLocaleString('en-LK', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

function ShiftHistoryPanel({ search, onNotice }: { search: string; onNotice: (message: string) => void }) {
    const [rows, setRows] = useState<ShiftHistoryRow[]>([]);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [meta, setMeta] = useState<PaginatedMeta>({
        current_page: 1,
        last_page: 1,
        per_page: 10,
        total: 0,
        from: null,
        to: null,
    });

    const load = useCallback(() => {
        setLoading(true);
        return axios
            .get('/api/shift-history', {
                params: {
                    page,
                    per_page: 10,
                    search: search.trim() || undefined,
                },
            })
            .then(response => {
                setRows(response.data.data ?? []);
                setMeta({
                    current_page: response.data.current_page ?? 1,
                    last_page: response.data.last_page ?? 1,
                    per_page: response.data.per_page ?? 10,
                    total: response.data.total ?? 0,
                    from: response.data.from ?? null,
                    to: response.data.to ?? null,
                });
            })
            .catch(() => onNotice('Unable to load shift history.'))
            .finally(() => setLoading(false));
    }, [page, search, onNotice]);

    useEffect(() => {
        setPage(1);
    }, [search]);

    useEffect(() => {
        void load();
    }, [load]);

    return (
        <div className="space-y-4">
            <p className="text-sm text-slate-500">
                Cashier shift on/off times with opening and closing cash in the box (10 per page).
            </p>
            <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[920px] text-left text-sm">
                        <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wider text-slate-400">
                            <tr>
                                <th className="px-5 py-4">Cashier</th>
                                <th className="px-5 py-4">Shift on</th>
                                <th className="px-5 py-4">Cash in box (open)</th>
                                <th className="px-5 py-4">Shift off</th>
                                <th className="px-5 py-4">Cash in box (close)</th>
                                <th className="px-5 py-4">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="px-5 py-12 text-center text-slate-400">
                                        Loading shifts…
                                    </td>
                                </tr>
                            ) : (
                                rows.map(row => (
                                    <tr key={row.id} className="hover:bg-slate-50">
                                        <td className="px-5 py-4">
                                            <p className="font-semibold text-[#102b2b]">{row.cashier?.name ?? 'Cashier'}</p>
                                            {row.cashier?.email ? <p className="text-xs text-slate-400">{row.cashier.email}</p> : null}
                                        </td>
                                        <td className="px-5 py-4 font-medium text-slate-700">{formatShiftWhen(row.opening_time)}</td>
                                        <td className="px-5 py-4 font-semibold text-[#102b2b]">{money(Number(row.opening_cash))}</td>
                                        <td className="px-5 py-4 font-medium text-slate-700">
                                            {row.status === 'OPEN' ? (
                                                <span className="text-amber-600">Still on shift</span>
                                            ) : (
                                                formatShiftWhen(row.closing_time)
                                            )}
                                        </td>
                                        <td className="px-5 py-4">
                                            {row.closing_cash != null && row.closing_cash !== '' ? (
                                                <span className="font-semibold text-[#102b2b]">{money(Number(row.closing_cash))}</span>
                                            ) : row.status === 'OPEN' ? (
                                                <span className="text-slate-400">—</span>
                                            ) : (
                                                <span className="font-medium text-slate-400">Not recorded</span>
                                            )}
                                            {row.status === 'CLOSED' && (row.closing_cash == null || row.closing_cash === '') && row.expected_cash_in_drawer != null ? (
                                                <p className="mt-0.5 text-[11px] text-slate-400">
                                                    Expected: {money(Number(row.expected_cash_in_drawer))}
                                                </p>
                                            ) : null}
                                        </td>
                                        <td className="px-5 py-4">
                                            <span
                                                className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
                                                    row.status === 'OPEN' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'
                                                }`}
                                            >
                                                {row.status === 'OPEN' ? 'Open' : 'Closed'}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                    {!loading && rows.length === 0 && (
                        <p className="p-10 text-center text-sm text-slate-400">No shift records found.</p>
                    )}
                </div>
                <PaginationBar meta={meta} page={page} onPageChange={setPage} entityLabel="shifts" />
            </div>
        </div>
    );
}

function OrdersLogTable({ rows, search }: { rows: any[]; search: string }) {
    const filtered = rows.filter(row => JSON.stringify(row).toLowerCase().includes(search.toLowerCase()));
    return (
        <div className="space-y-4">
            <p className="text-sm text-slate-500">Full dine-in and POS history with table, server, cashier, and line items.</p>
            <div className="space-y-3">
                {filtered.map(row => (
                    <div key={row.id} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                                <p className="font-semibold">{row.order_number}</p>
                                <p className="text-xs text-slate-500">
                                    {row.table?.name ? `Table ${row.table.name}` : row.order_type}
                                    {' · '}
                                    {row.server?.name ? `Server: ${row.server.name}` : 'Server: —'}
                                    {' · '}
                                    {row.cashier?.name ? `Cashier: ${row.cashier.name}` : 'Cashier: —'}
                                </p>
                                <p className="text-xs text-slate-400">{row.created_at ? new Date(row.created_at).toLocaleString() : ''} · {row.status}</p>
                            </div>
                            <p className="text-lg font-semibold text-[#d97745]">{money(row.total)}</p>
                        </div>
                        <ul className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-sm">
                            {(row.items ?? []).map((item: any) => (
                                <li key={item.id} className="flex justify-between gap-2 text-slate-600">
                                    <span>
                                        {item.quantity} × {item.product?.name ?? 'Item'}
                                        {item.server?.name ? <span className="text-xs text-slate-400"> · {item.server.name}</span> : null}
                                    </span>
                                    <span className="font-medium">{money(item.line_total)}</span>
                                </li>
                            ))}
                        </ul>
                        {row.payment && <p className="mt-2 text-xs text-slate-500">Payment: {row.payment.payment_method}</p>}
                    </div>
                ))}
                {filtered.length === 0 && <p className="rounded-2xl bg-white p-10 text-center text-sm text-slate-400 shadow-sm ring-1 ring-slate-100">No orders found.</p>}
            </div>
        </div>
    );
}

function DataTable({ resource, rows, search, onRemove }: { resource: Resource; rows: any[]; search: string; onRemove: (id: number) => void }) { const filtered = rows.filter(row => JSON.stringify(row).toLowerCase().includes(search.toLowerCase())); return <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-100"><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wider text-slate-400"><tr><th className="px-5 py-4">Name / item</th><th className="px-5 py-4">Status / detail</th><th className="px-5 py-4 text-right">Action</th></tr></thead><tbody className="divide-y divide-slate-100">{filtered.map(row => <tr key={row.id} className="hover:bg-slate-50"><td className="px-5 py-4 font-semibold">{row.name ?? row.order_number ?? row.product?.name ?? row.email ?? `#${row.id}`}</td><td className="px-5 py-4 text-slate-500">{row.price ? money(row.price) : row.status ?? row.role ?? row.current_stock ?? row.category ?? 'Active'}</td><td className="px-5 py-4 text-right">{['products', 'categories', 'tables', 'expenses'].includes(resource) && <button onClick={() => onRemove(row.id)} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-500" title="Delete"><Trash2 size={16} /></button>}</td></tr>)}{filtered.length === 0 && <tr><td colSpan={3} className="px-5 py-14 text-center text-slate-400">No records yet.</td></tr>}</tbody></table></div></div>; }

function Metric({ label, value }: { label: string; value: string | number }) {
    return <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-2xl font-semibold">{value}</p></div>;
}
