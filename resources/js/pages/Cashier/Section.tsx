import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, Banknote, ClipboardList, CreditCard, Phone, Printer, ReceiptText, ShoppingBag, Table2, Users } from 'lucide-react';
import AppShell from '../../components/layout/AppShell';
import { openReceipt } from '../../lib/receipt';

type Section = 'tables' | 'orders' | 'billing' | 'payments' | 'shift' | 'receipts' | 'customers';
type OrderFilter = 'all' | 'cash' | 'card' | 'paid';
type CustomerFilter = 'all' | 'phone' | 'repeat';

interface Props {
    section: Section;
}

const titles: Record<Section, string> = {
    tables: 'Tables',
    orders: 'Orders',
    billing: 'Billing',
    payments: 'Payments',
    shift: 'Shift',
    receipts: 'Receipts',
    customers: 'Customers',
};

const money = (value: number) =>
    `Rs. ${Number(value || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const FILTER_OPTIONS: { id: OrderFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'cash', label: 'Cash' },
    { id: 'card', label: 'Card' },
    { id: 'paid', label: 'Paid' },
];

const CUSTOMER_FILTER_OPTIONS: { id: CustomerFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'phone', label: 'With phone' },
    { id: 'repeat', label: 'Repeat buyers' },
];

function customerInitials(name: string) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) {
        return '?';
    }
    if (parts.length === 1) {
        return parts[0].slice(0, 2).toUpperCase();
    }
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

interface PaginatedMeta {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
}

export default function Section({ section }: Props) {
    const [rows, setRows] = useState<any[]>([]);
    const [shift, setShift] = useState<any>(null);
    const [error, setError] = useState('');
    const endpoint = section === 'tables' ? '/api/tables' : section === 'customers' ? '/api/customers' : '/api/orders';

    useEffect(() => {
        if (section === 'shift') {
            axios
                .get('/api/shift/current')
                .then(response => setShift(response.data))
                .catch(() => setError('Unable to load shift.'));
            return;
        }
        if (section === 'orders' || section === 'receipts' || section === 'customers') {
            return;
        }
        axios
            .get(endpoint)
            .then(response => setRows(response.data.data ?? response.data))
            .catch(() => setError('Unable to load this section.'));
    }, [section, endpoint]);

    return (
        <>
            <Head title={titles[section]} />
            <AppShell>
                <div className="min-h-screen">
                    <header className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-5 lg:px-8">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#d97745]">Cashier workspace</p>
                            <h1 className="mt-1 text-2xl font-semibold tracking-tight">{titles[section]}</h1>
                        </div>
                        {section === 'billing' || section === 'payments' ? (
                            <Link href="/pos" className="rounded-xl bg-[#d97745] px-4 py-3 text-sm font-semibold text-white">
                                Open POS
                            </Link>
                        ) : null}
                    </header>
                    <div className="space-y-6 p-5 lg:p-8">
                        {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</p>}
                        {section === 'shift' ? (
                            <ShiftCard shift={shift} />
                        ) : section === 'billing' || section === 'payments' ? (
                            <EmptyAction
                                title={section === 'billing' ? 'Ready to bill' : 'Payment methods'}
                                text="Select an order in the POS to continue checkout and payment."
                                icon={section === 'billing' ? ReceiptText : CreditCard}
                            />
                        ) : section === 'receipts' ? (
                            <CashierReceiptsPanel />
                        ) : section === 'orders' ? (
                            <CashierOrdersPanel />
                        ) : section === 'customers' ? (
                            <CashierCustomersPanel />
                        ) : (
                            <ListSection section={section} rows={rows} />
                        )}
                    </div>
                </div>
            </AppShell>
        </>
    );
}

function CashierOrdersPanel() {
    const [rows, setRows] = useState<any[]>([]);
    const [filter, setFilter] = useState<OrderFilter>('all');
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
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
        setError('');
        return axios
            .get('/api/orders', {
                params: {
                    page,
                    per_page: 10,
                    filter: filter === 'all' ? undefined : filter,
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
            .catch(() => setError('Unable to load orders.'))
            .finally(() => setLoading(false));
    }, [page, filter, search]);

    useEffect(() => {
        setPage(1);
    }, [filter, search]);

    useEffect(() => {
        void load();
    }, [load]);

    function paymentLabel(order: any): string {
        if (order.payment?.payment_method) {
            return order.payment.payment_method === 'CASH' ? 'Cash' : 'Card';
        }
        if (order.status === 'COMPLETED') {
            return 'Paid';
        }
        return 'Unpaid';
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                <div className="flex flex-wrap gap-2">
                    {FILTER_OPTIONS.map(option => (
                        <button
                            key={option.id}
                            type="button"
                            onClick={() => setFilter(option.id)}
                            className={`rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
                                filter === option.id
                                    ? 'bg-[#102b2b] text-white shadow-sm'
                                    : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
                            }`}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
                <input
                    type="search"
                    value={search}
                    onChange={event => setSearch(event.target.value)}
                    placeholder="Search order # or table…"
                    className="w-full max-w-xs rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#d97745] sm:w-56"
                />
            </div>

            {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</p>}

            <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">
                <div className="divide-y divide-slate-100">
                    {loading ? (
                        <p className="p-12 text-center text-sm text-slate-400">Loading orders…</p>
                    ) : (
                        rows.map(row => (
                            <div key={row.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                                <div className="flex min-w-0 items-center gap-3">
                                    <span className="rounded-xl bg-[#fff0e5] p-2 text-[#c26435]">
                                        <ClipboardList size={18} />
                                    </span>
                                    <div className="min-w-0">
                                        <p className="font-semibold">{row.order_number}</p>
                                        <p className="text-xs text-slate-500">
                                            {row.table?.name ? `Table ${row.table.name}` : row.order_type}
                                            {' · '}
                                            {row.created_at ? new Date(row.created_at).toLocaleString('en-LK') : ''}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                                    <span
                                        className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
                                            row.status === 'COMPLETED'
                                                ? 'bg-emerald-50 text-emerald-700'
                                                : row.status === 'BILLED'
                                                  ? 'bg-amber-50 text-amber-700'
                                                  : 'bg-slate-100 text-slate-600'
                                        }`}
                                    >
                                        {row.status}
                                    </span>
                                    <span
                                        className={`inline-flex items-center gap-1 text-xs font-semibold ${
                                            row.payment?.payment_method === 'CASH'
                                                ? 'text-[#102b2b]'
                                                : row.payment?.payment_method === 'CARD'
                                                  ? 'text-indigo-700'
                                                  : 'text-slate-400'
                                        }`}
                                    >
                                        {row.payment?.payment_method === 'CASH' ? (
                                            <Banknote size={14} />
                                        ) : row.payment?.payment_method === 'CARD' ? (
                                            <CreditCard size={14} />
                                        ) : null}
                                        {paymentLabel(row)}
                                    </span>
                                    <span className="text-sm font-semibold text-[#d97745]">{row.total ? money(Number(row.total)) : ''}</span>
                                </div>
                            </div>
                        ))
                    )}
                    {!loading && rows.length === 0 && (
                        <p className="p-12 text-center text-sm text-slate-400">No orders match this filter.</p>
                    )}
                </div>
                <ListPagination meta={meta} page={page} onPageChange={setPage} entityLabel="orders" />
            </div>
        </div>
    );
}

interface CustomerOrderItem {
    id: number;
    quantity: number;
    line_total: number | string;
    product_name?: string | null;
    product?: { id: number; name: string } | null;
}

interface CustomerOrderRow {
    id: number;
    order_number: string;
    order_type: string;
    total?: number | string;
    status?: string;
    created_at?: string;
    items?: CustomerOrderItem[];
}

interface CustomerRow {
    id: number;
    name: string;
    phone: string | null;
    created_at?: string;
    updated_at?: string;
    orders_count?: number;
    orders?: CustomerOrderRow[];
}

function CashierCustomersPanel() {
    const [rows, setRows] = useState<CustomerRow[]>([]);
    const [filter, setFilter] = useState<CustomerFilter>('all');
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
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
        setError('');
        return axios
            .get('/api/customers', {
                params: {
                    page,
                    per_page: 10,
                    filter: filter === 'all' ? undefined : filter,
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
            .catch(() => setError('Unable to load customers.'))
            .finally(() => setLoading(false));
    }, [page, filter, search]);

    useEffect(() => {
        setPage(1);
    }, [filter, search]);

    useEffect(() => {
        void load();
    }, [load]);

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                <div className="flex flex-wrap gap-2">
                    {CUSTOMER_FILTER_OPTIONS.map(option => (
                        <button
                            key={option.id}
                            type="button"
                            onClick={() => setFilter(option.id)}
                            className={`rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
                                filter === option.id
                                    ? 'bg-[#102b2b] text-white shadow-sm'
                                    : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
                            }`}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
                <input
                    type="search"
                    value={search}
                    onChange={event => setSearch(event.target.value)}
                    placeholder="Search name or phone…"
                    className="w-full max-w-xs rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#d97745] sm:w-64"
                />
            </div>

            {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</p>}

            {loading ? (
                <p className="rounded-2xl bg-white p-12 text-center text-sm text-slate-400 shadow-sm ring-1 ring-slate-100">
                    Loading customers…
                </p>
            ) : rows.length === 0 ? (
                <p className="rounded-2xl bg-white p-12 text-center text-sm text-slate-400 shadow-sm ring-1 ring-slate-100">
                    No customers match this filter.
                </p>
            ) : (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {rows.map(customer => {
                        const orderCount = customer.orders_count ?? 0;
                        const isRepeat = orderCount > 0;
                        return (
                            <article
                                key={customer.id}
                                className="flex flex-col rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100 transition hover:shadow-md hover:ring-[#d97745]/20"
                            >
                                <div className="flex items-start gap-3">
                                    <div
                                        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#fff0e5] to-[#ffe8d8] text-sm font-bold tracking-wide text-[#c26435]"
                                        aria-hidden
                                    >
                                        {customerInitials(customer.name)}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <h2 className="truncate text-base font-semibold text-[#102b2b]">{customer.name}</h2>
                                        <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-slate-400">
                                            Customer #{customer.id}
                                        </p>
                                    </div>
                                    {isRepeat ? (
                                        <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                                            Repeat
                                        </span>
                                    ) : (
                                        <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                                            New
                                        </span>
                                    )}
                                </div>

                                {customer.phone?.trim() ? (
                                    <p className="mt-3 flex items-center gap-2 text-sm font-medium text-slate-700">
                                        <Phone size={15} className="shrink-0 text-[#d97745]" />
                                        <span className="min-w-0 break-all">{customer.phone.trim()}</span>
                                    </p>
                                ) : null}

                                <div className="mt-4 border-t border-slate-100 pt-4">
                                    <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                                        <ShoppingBag size={13} className="text-[#c26435]" />
                                        Order items
                                        {orderCount > 0 ? (
                                            <span className="font-semibold normal-case tracking-normal text-slate-500">
                                                · {orderCount} order{orderCount === 1 ? '' : 's'}
                                            </span>
                                        ) : null}
                                    </p>
                                    {(customer.orders ?? []).length > 0 ? (
                                        <div className="space-y-2">
                                            {(customer.orders ?? []).map(order => (
                                                <div key={order.id} className="rounded-xl bg-slate-50/90 px-3 py-2.5 ring-1 ring-slate-100">
                                                    <div className="flex flex-wrap items-center justify-between gap-1 text-xs">
                                                        <span className="font-semibold text-[#102b2b]">{order.order_number}</span>
                                                        <span className="text-slate-500">
                                                            {order.order_type === 'TAKEAWAY' ? 'Takeaway' : order.order_type}
                                                            {order.created_at
                                                                ? ` · ${new Date(order.created_at).toLocaleDateString('en-LK', { dateStyle: 'medium' })}`
                                                                : ''}
                                                        </span>
                                                    </div>
                                                    <ul className="mt-2 space-y-1">
                                                        {(order.items ?? []).map(item => (
                                                            <li
                                                                key={item.id}
                                                                className="flex items-center justify-between gap-2 text-sm text-slate-600"
                                                            >
                                                                <span className="min-w-0 truncate">
                                                                    {item.quantity} × {item.product?.name ?? item.product_name ?? 'Item'}
                                                                </span>
                                                                <span className="shrink-0 text-xs font-semibold text-slate-500">
                                                                    {money(Number(item.line_total))}
                                                                </span>
                                                            </li>
                                                        ))}
                                                        {(order.items ?? []).length === 0 ? (
                                                            <li className="text-xs text-slate-400">No line items</li>
                                                        ) : null}
                                                    </ul>
                                                    {order.total != null ? (
                                                        <p className="mt-2 border-t border-slate-200/80 pt-2 text-right text-xs font-semibold text-[#d97745]">
                                                            Total {money(Number(order.total))}
                                                        </p>
                                                    ) : null}
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-slate-400">No orders yet.</p>
                                    )}
                                    {customer.created_at ? (
                                        <p className="mt-3 text-xs text-slate-400">
                                            Customer since{' '}
                                            {new Date(customer.created_at).toLocaleDateString('en-LK', { dateStyle: 'medium' })}
                                        </p>
                                    ) : null}
                                </div>
                            </article>
                        );
                    })}
                </div>
            )}

            {!loading && rows.length > 0 ? (
                <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">
                    <ListPagination meta={meta} page={page} onPageChange={setPage} entityLabel="customers" />
                </div>
            ) : null}
        </div>
    );
}

function CashierReceiptsPanel() {
    const [rows, setRows] = useState<any[]>([]);
    const [filter, setFilter] = useState<OrderFilter>('all');
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
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
        setError('');
        return axios
            .get('/api/orders', {
                params: {
                    scope: 'receipts',
                    page,
                    per_page: 10,
                    filter: filter === 'all' ? undefined : filter,
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
            .catch(() => setError('Unable to load receipts.'))
            .finally(() => setLoading(false));
    }, [page, filter, search]);

    useEffect(() => {
        setPage(1);
    }, [filter, search]);

    useEffect(() => {
        void load();
    }, [load]);

    function paymentMethodLabel(method: string | undefined) {
        if (method === 'CASH') return 'Cash';
        if (method === 'CARD') return 'Card';
        return 'Paid';
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                <div className="flex flex-wrap gap-2">
                    {FILTER_OPTIONS.map(option => (
                        <button
                            key={option.id}
                            type="button"
                            onClick={() => setFilter(option.id)}
                            className={`rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
                                filter === option.id
                                    ? 'bg-[#102b2b] text-white shadow-sm'
                                    : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
                            }`}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
                <input
                    type="search"
                    value={search}
                    onChange={event => setSearch(event.target.value)}
                    placeholder="Search order # or table…"
                    className="w-full max-w-xs rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#d97745] sm:w-56"
                />
            </div>

            {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</p>}

            <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">
                <div className="divide-y divide-slate-100">
                    {loading ? (
                        <p className="p-12 text-center text-sm text-slate-400">Loading receipts…</p>
                    ) : (
                        rows.map(row => (
                            <div key={row.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                                <div className="flex min-w-0 items-center gap-3">
                                    <span className="rounded-xl bg-[#fff0e5] p-2 text-[#c26435]">
                                        <ReceiptText size={18} />
                                    </span>
                                    <div className="min-w-0">
                                        <p className="font-semibold">{row.order_number}</p>
                                        <p className="text-xs text-slate-500">
                                            {row.table?.name ? `Table ${row.table.name}` : row.order_type}
                                            {' · '}
                                            {row.created_at ? new Date(row.created_at).toLocaleString('en-LK') : ''}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                                    <span
                                        className={`inline-flex items-center gap-1 text-xs font-semibold ${
                                            row.payment?.payment_method === 'CASH'
                                                ? 'text-[#102b2b]'
                                                : row.payment?.payment_method === 'CARD'
                                                  ? 'text-indigo-700'
                                                  : 'text-slate-600'
                                        }`}
                                    >
                                        {row.payment?.payment_method === 'CASH' ? (
                                            <Banknote size={14} />
                                        ) : row.payment?.payment_method === 'CARD' ? (
                                            <CreditCard size={14} />
                                        ) : null}
                                        {paymentMethodLabel(row.payment?.payment_method)}
                                    </span>
                                    <span className="text-sm font-semibold text-[#d97745]">{money(Number(row.total ?? 0))}</span>
                                    <button
                                        type="button"
                                        onClick={() => printReceipt(row)}
                                        className="rounded-lg p-2 text-slate-500 ring-1 ring-slate-200 hover:bg-[#fff0e5] hover:text-[#c26435]"
                                        title="Print receipt"
                                    >
                                        <Printer size={18} />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                    {!loading && rows.length === 0 && (
                        <p className="p-12 text-center text-sm text-slate-400">No receipts match this filter.</p>
                    )}
                </div>
                <ListPagination meta={meta} page={page} onPageChange={setPage} entityLabel="receipts" />
            </div>
        </div>
    );
}

function ListPagination({
    meta,
    page,
    onPageChange,
    entityLabel,
}: {
    meta: PaginatedMeta;
    page: number;
    onPageChange: (page: number) => void;
    entityLabel: string;
}) {
    if (meta.last_page <= 1) {
        return (
            <div className="border-t border-slate-100 px-5 py-3 text-sm text-slate-500">
                {meta.total > 0 ? `${meta.total} ${entityLabel}` : null}
            </div>
        );
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
                        className={`min-w-9 rounded-lg px-2 py-1.5 text-xs font-semibold ${
                            p === page ? 'bg-[#102b2b] text-white' : 'border border-slate-200 text-slate-600'
                        }`}
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

function ListSection({ section, rows }: { section: Section; rows: any[] }) {
    const Icon = section === 'tables' ? Table2 : section === 'customers' ? Users : ClipboardList;
    return (
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">
            <div className="divide-y divide-slate-100">
                {rows.map(row => (
                    <div key={row.id} className="flex items-center justify-between px-5 py-4">
                        <div className="flex items-center gap-3">
                            <span className="rounded-xl bg-[#fff0e5] p-2 text-[#c26435]">
                                <Icon size={18} />
                            </span>
                            <div>
                                <p className="font-semibold">{row.name ?? row.order_number ?? `#${row.id}`}</p>
                                <p className="text-xs text-slate-500">{row.phone ?? row.order_type ?? row.status ?? 'Available'}</p>
                            </div>
                        </div>
                        <span className="text-sm font-medium text-slate-500">
                            {row.total ? money(Number(row.total)) : ''}
                        </span>
                    </div>
                ))}
                {rows.length === 0 && <p className="p-12 text-center text-sm text-slate-400">No records found.</p>}
            </div>
        </div>
    );
}

function printReceipt(order: any) {
    openReceipt(order);
}

function ShiftCard({ shift }: { shift: any }) {
    return (
        <div className="max-w-lg rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
            <Banknote className="text-[#d97745]" />
            <h2 className="mt-4 text-xl font-semibold">{shift ? 'Current shift is open' : 'No open shift'}</h2>
            <p className="mt-2 text-sm text-slate-500">
                {shift
                    ? `Opening cash: ${money(Number(shift.opening_cash))}`
                    : 'Open a shift from the POS before processing sales.'}
            </p>
            <Link
                href="/pos"
                className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#102b2b] px-4 py-3 text-sm font-semibold text-white"
            >
                <ArrowLeft size={16} />
                Go to POS
            </Link>
        </div>
    );
}

function EmptyAction({ title, text, icon: Icon }: { title: string; text: string; icon: typeof ReceiptText }) {
    return (
        <div className="max-w-lg rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-100">
            <Icon className="text-[#d97745]" size={28} />
            <h2 className="mt-4 text-xl font-semibold">{title}</h2>
            <p className="mt-2 text-sm text-slate-500">{text}</p>
            <Link href="/pos" className="mt-6 inline-block rounded-xl bg-[#d97745] px-4 py-3 text-sm font-semibold text-white">
                Open POS
            </Link>
        </div>
    );
}