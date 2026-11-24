import { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { Head, Link, usePage } from '@inertiajs/react';
import { ArrowLeft, Check, History, Search } from 'lucide-react';
import AppShell from '../../components/layout/AppShell';
import { FLOOR_POLL_MS } from '../../lib/floorPoll';
import type { Category, Product } from '../../types';

interface Props {
    categories: Category[];
    products: Product[];
    tables: FloorTable[];
}

interface FloorTable {
    id: number;
    name: string;
    status: 'AVAILABLE' | 'OCCUPIED';
}

interface FloorItem {
    id: number;
    quantity: number;
    line_total: string | number;
    product?: { name: string };
    server?: { name: string } | null;
}

interface FloorOrder {
    id: number;
    order_number: string;
    table_id: number | null;
    status: 'OPEN' | 'READY' | 'BILLED' | 'COMPLETED';
    subtotal: string | number;
    discount: string | number;
    total: string | number;
    notes?: string | null;
    items: FloorItem[];
    server?: { name: string } | null;
    cashier?: { name: string } | null;
    table?: { name: string } | null;
    payment?: { payment_method: string } | null;
    created_at?: string;
}

type FloorStep = 'tables' | 'menu' | 'ticket' | 'history';

const money = (value: number) => `Rs. ${value.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const statusLabel: Record<string, string> = {
    OPEN: 'Ordering',
    READY: 'Closed · awaiting payment',
    BILLED: 'Billed · awaiting payment',
    COMPLETED: 'Completed',
};

function tableAvailabilityLabel(table: FloorTable, ticket: FloorOrder | null) {
    if (ticket && ticket.status !== 'COMPLETED') {
        return 'Occupied';
    }

    return table.status === 'OCCUPIED' ? 'Occupied' : 'Open';
}

function sameTable(a: number | string | null | undefined, b: number | string | null | undefined) {
    return a != null && b != null && Number(a) === Number(b);
}

function orderStatus(order: FloorOrder) {
    return String(order.status ?? '').toUpperCase();
}

function activeTableOrder(tableId: number | null, list: FloorOrder[]) {
    if (tableId == null) {
        return null;
    }

    const forTable = list.filter(order => sameTable(order.table_id, tableId));
    if (!forTable.length) {
        return null;
    }

    for (const status of ['OPEN', 'READY', 'BILLED'] as const) {
        const matches = forTable.filter(order => orderStatus(order) === status);
        if (matches.length) {
            return [...matches].sort((a, b) => b.id - a.id)[0];
        }
    }

    return null;
}

export default function Floor({ categories, products, tables: initialTables }: Props) {
    const pageUrl = usePage().url;
    const historyView = pageUrl.includes('view=history');
    const [tables, setTables] = useState<FloorTable[]>(initialTables ?? []);
    const [orders, setOrders] = useState<FloorOrder[]>([]);
    const [floorStep, setFloorStep] = useState<FloorStep>('tables');
    const [tableId, setTableId] = useState<number | null>(null);
    const [activeCategory, setActiveCategory] = useState<number | null>(null);
    const [search, setSearch] = useState('');
    const [notice, setNotice] = useState('');
    const [busy, setBusy] = useState(false);
    const [addingProductId, setAddingProductId] = useState<number | null>(null);
    const [summary, setSummary] = useState<FloorOrder | null>(null);
    const [history, setHistory] = useState<FloorOrder[]>([]);
    const floorLoadToken = useRef(0);
    const floorAbortRef = useRef<AbortController | null>(null);

    const activeOrder = activeTableOrder(tableId, orders);
    const selectedTableName =
        tables.find(table => sameTable(table.id, tableId))?.name ?? (tableId != null ? `Table #${tableId}` : 'Select a table');

    const filteredProducts = useMemo(
        () =>
            products.filter(
                product =>
                    (activeCategory == null || Number(product.category_id) === Number(activeCategory)) &&
                    product.name.toLowerCase().includes(search.toLowerCase()),
            ),
        [products, activeCategory, search],
    );

    function applyFloorOrders(nextOrders: FloorOrder[]) {
        setOrders(prev => {
            if (tableId == null) {
                return nextOrders;
            }

            const fresh = activeTableOrder(tableId, nextOrders);
            const stale = activeTableOrder(tableId, prev);

            if (fresh && stale && sameTable(fresh.table_id, stale.table_id)) {
                const freshCount = fresh.items?.length ?? 0;
                const staleCount = stale.items?.length ?? 0;

                if (staleCount > freshCount) {
                    return [
                        ...nextOrders.filter(order => !sameTable(order.table_id, stale.table_id)),
                        stale,
                    ];
                }
            }

            return nextOrders;
        });
    }

    async function loadFloor() {
        const token = ++floorLoadToken.current;
        floorAbortRef.current?.abort();
        const controller = new AbortController();
        floorAbortRef.current = controller;

        try {
            const response = await axios.get('/api/floor', { signal: controller.signal });
            if (token !== floorLoadToken.current) {
                return;
            }
            if (Array.isArray(response.data.tables) && response.data.tables.length > 0) {
                setTables(response.data.tables);
            }
            applyFloorOrders(response.data.orders ?? []);
        } catch (error) {
            if (axios.isCancel(error)) {
                return;
            }
            throw error;
        }
    }

    function upsertTableOrder(order: FloorOrder) {
        setOrders(prev => [...prev.filter(existing => !sameTable(existing.table_id, order.table_id)), order]);
    }

    async function loadHistory() {
        const response = await axios.get<FloorOrder[]>('/api/orders/mine');
        setHistory(response.data ?? []);
    }

    useEffect(() => {
        const run = () => {
            if (document.hidden) {
                return;
            }
            loadFloor().catch(() => setNotice('Unable to load tables.'));
        };

        run();
        void loadHistory().catch(() => setNotice('Unable to load order history.'));
        const timer = window.setInterval(run, FLOOR_POLL_MS);
        const onVisibility = () => {
            if (!document.hidden) {
                run();
            }
        };
        document.addEventListener('visibilitychange', onVisibility);

        return () => {
            window.clearInterval(timer);
            document.removeEventListener('visibilitychange', onVisibility);
            floorAbortRef.current?.abort();
        };
    }, []);

    useEffect(() => {
        if (historyView) {
            void loadHistory().catch(() => setNotice('Unable to load order history.'));
        }
    }, [historyView]);

    function selectTable(id: number | string) {
        setTableId(Number(id));
        setNotice('');
        setFloorStep('menu');
    }

    async function addItem(product: Product) {
        if (!tableId) {
            setNotice('Select a table first.');
            setFloorStep('tables');
            return;
        }
        setAddingProductId(product.id);
        setNotice('');
        try {
            const response = await axios.post<FloorOrder>('/api/orders', {
                table_id: tableId,
                items: [{ product_id: product.id, quantity: 1 }],
            });
            upsertTableOrder(response.data);
            setNotice(`${product.name} added to ${selectedTableName}.`);
            void loadFloor();
        } catch (error: any) {
            setNotice(error.response?.data?.message ?? 'Unable to add this item.');
        } finally {
            setAddingProductId(null);
        }
    }

    async function markReady() {
        if (!activeOrder) return;
        setBusy(true);
        try {
            const response = await axios.post<FloorOrder>(`/api/orders/${activeOrder.id}/ready`);
            upsertTableOrder(response.data);
            setTables(current =>
                current.map(table => (sameTable(table.id, tableId) ? { ...table, status: 'OCCUPIED' } : table)),
            );
            setSummary(response.data);
            setNotice(`${selectedTableName} order closed. Table stays occupied until payment.`);
            setFloorStep('ticket');
            void loadFloor();
        } catch (error: any) {
            setNotice(error.response?.data?.message ?? 'Unable to close this order.');
        } finally {
            setBusy(false);
        }
    }

    async function markPaid() {
        if (!activeOrder) return;
        setBusy(true);
        try {
            const response =
                activeOrder.status === 'BILLED'
                    ? await axios.post<FloorOrder>(`/api/orders/${activeOrder.id}/complete`)
                    : await axios.post<FloorOrder>(`/api/orders/${activeOrder.id}/paid`, {
                          payment: { method: 'CASH' },
                      });

            setOrders(current => current.filter(order => order.id !== activeOrder.id));
            setTables(current =>
                current.map(table => (sameTable(table.id, tableId) ? { ...table, status: 'AVAILABLE' } : table)),
            );
            setHistory(current => [response.data, ...current.filter(order => order.id !== response.data.id)]);
            setSummary(response.data);
            setNotice(`${selectedTableName} is paid. Table is open for the next customer.`);
            setTableId(null);
            setFloorStep('tables');
            await loadFloor();
            void loadHistory();
        } catch (error: any) {
            setNotice(error.response?.data?.message ?? 'Unable to mark this order as paid.');
        } finally {
            setBusy(false);
        }
    }

    const status = activeOrder ? orderStatus(activeOrder) : null;
    const canAddItems = tableId != null && (status === 'OPEN' || status === 'READY');

    function tableTone(table: FloorTable) {
        const ticket = activeTableOrder(Number(table.id), orders);
        if (ticket?.status === 'BILLED') return 'border-emerald-300 bg-emerald-50';
        if (ticket?.status === 'READY') return 'border-amber-300 bg-amber-50';
        if (ticket) return 'border-[#d97745] bg-[#fff4ec]';
        return 'border-slate-200 bg-white';
    }

    function renderTables(extraClass = '') {
        return (
            <section className={`min-h-0 overflow-y-auto ${extraClass}`}>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Pick a table</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-1">
                    {tables.length === 0 && (
                        <p className="col-span-full rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
                            No tables found. Ask admin to add tables, then refresh.
                        </p>
                    )}
                    {tables.map(table => {
                        const ticket = activeTableOrder(Number(table.id), orders);
                        return (
                            <button
                                key={table.id}
                                type="button"
                                onClick={() => selectTable(table.id)}
                                className={`min-h-[4.5rem] rounded-xl border px-3 py-3 text-left active:scale-[0.98] ${tableTone(table)} ${sameTable(tableId, table.id) ? 'ring-2 ring-[#102b2b]' : ''}`}
                            >
                                <span className="block text-base font-semibold">{table.name}</span>
                                <span className="text-[11px] text-slate-500">
                                    {tableAvailabilityLabel(table, ticket)}
                                    {ticket ? ` · ${statusLabel[ticket.status] ?? ticket.status}` : ''}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </section>
        );
    }

    function renderMenu(extraClass = '') {
        return (
            <section className={`flex min-h-0 min-w-0 flex-col ${extraClass}`}>
                {tableId != null && (
                    <div className="mb-2 rounded-xl bg-[#102b2b] px-3 py-2 text-sm font-semibold text-white">
                        Serving {selectedTableName}
                    </div>
                )}
                {notice && floorStep === 'menu' && (
                    <p className="mb-2 flex items-start gap-1 rounded-lg bg-[#fff4ec] px-2 py-2 text-xs font-medium text-[#a85329]">
                        <Check size={14} className="mt-0.5 shrink-0" />
                        {notice}
                    </p>
                )}
                {status === 'BILLED' && (
                    <div className="mb-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                        Cashier created the bill. Mark paid when the customer pays, then the table becomes open.
                    </div>
                )}
                {status === 'READY' && (
                    <div className="mb-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                        Order is closed. You can still add dishes or mark paid when the customer settles.
                    </div>
                )}
                <div className="relative mb-2">
                    <Search className="absolute left-3 top-3.5 text-slate-400" size={16} />
                    <input
                        value={search}
                        onChange={event => setSearch(event.target.value)}
                        placeholder="Search menu..."
                        className="min-h-12 w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-base outline-none focus:border-[#d97745]"
                    />
                </div>
                <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
                    <button type="button" onClick={() => setActiveCategory(null)} className={`min-h-11 shrink-0 rounded-full px-4 text-sm font-semibold ${activeCategory === null ? 'bg-[#d97745] text-white' : 'bg-white text-slate-500 ring-1 ring-slate-200'}`}>All</button>
                    {categories.map(category => (
                        <button key={category.id} type="button" onClick={() => setActiveCategory(category.id)} className={`min-h-11 shrink-0 rounded-full px-4 text-sm font-semibold ${activeCategory === category.id ? 'bg-[#d97745] text-white' : 'bg-white text-slate-500 ring-1 ring-slate-200'}`}>{category.name}</button>
                    ))}
                </div>
                {activeOrder && activeOrder.items.length > 0 && (
                    <div className="mb-2 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
                        <p className="font-semibold text-slate-800">Already on {selectedTableName}</p>
                        {activeOrder.items.map(item => (
                            <p key={item.id} className="flex justify-between gap-2">
                                <span>{item.quantity} × {item.product?.name}</span>
                                <span>{item.server?.name ?? ''}</span>
                            </p>
                        ))}
                    </div>
                )}
                <div className="min-h-0 flex-1 overflow-y-auto lg:pb-0">
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-3">
                        {filteredProducts.map(product => {
                            const isAdding = addingProductId === product.id;

                            return (
                                <button
                                    key={product.id}
                                    type="button"
                                    disabled={!canAddItems || isAdding}
                                    onClick={() => addItem(product)}
                                    className={`min-h-[4.25rem] rounded-xl border border-slate-200 bg-white px-3 py-3 text-left active:scale-[0.98] disabled:opacity-50 ${isAdding ? 'ring-2 ring-[#d97745]' : ''}`}
                                >
                                    <span className="block truncate text-sm font-semibold">{product.name}</span>
                                    <span className="text-xs font-medium text-[#d97745]">
                                        {isAdding ? 'Adding…' : money(Number(product.price))}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </section>
        );
    }

    function renderTicket(extraClass = '') {
        return (
            <aside className={`flex min-h-0 flex-col rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-100 lg:rounded-2xl ${extraClass}`}>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">{selectedTableName}</p>
                <div className="my-2 min-h-0 flex-1 space-y-2 overflow-y-auto">
                    {activeOrder ? activeOrder.items.map(item => (
                        <div key={item.id} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-3">
                            <span className="min-w-0">
                                <span className="block truncate text-sm font-semibold">{item.quantity} × {item.product?.name}</span>
                                <span className="text-[11px] text-slate-400">{item.server?.name ?? activeOrder.server?.name ?? 'Server'}</span>
                            </span>
                            <span className="text-sm font-semibold">{money(Number(item.line_total))}</span>
                        </div>
                    )) : <p className="flex h-16 items-center justify-center text-xs text-slate-400">Tap a dish to add it to this table</p>}
                    {activeOrder && <p className="text-right text-sm font-bold text-[#d97745]">Total {money(Number(activeOrder.total))}</p>}
                </div>
                {notice && (
                    <p className="mb-2 flex items-start gap-1 rounded-lg bg-[#fff4ec] px-2 py-2 text-xs font-medium text-[#a85329]">
                        <Check size={14} className="mt-0.5 shrink-0" />{notice}
                    </p>
                )}
                <div className="space-y-2 pb-safe">
                    {activeOrder?.status === 'OPEN' && (
                        <button type="button" disabled={busy || !activeOrder.items.length} onClick={markReady} className="min-h-12 w-full rounded-xl bg-amber-500 text-base font-bold text-white">{busy ? 'Closing...' : 'Close order'}</button>
                    )}
                    {activeOrder && (
                        <button type="button" onClick={() => setSummary(activeOrder)} className="min-h-12 w-full rounded-xl border border-slate-200 text-base font-bold text-slate-700">Order summary</button>
                    )}
                    {(activeOrder?.status === 'READY' || activeOrder?.status === 'BILLED') && (
                        <button type="button" disabled={busy} onClick={markPaid} className="min-h-12 w-full rounded-xl bg-emerald-600 text-base font-bold text-white">{busy ? 'Saving...' : 'Paid'}</button>
                    )}
                    {activeOrder?.status === 'READY' && (
                        <p className="text-center text-xs text-slate-500">Show the summary to the cashier if needed, or tap Paid when payment is collected.</p>
                    )}
                </div>
            </aside>
        );
    }

    function renderHistory(extraClass = '') {
        return (
            <section className={`min-h-0 overflow-y-auto ${extraClass}`}>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">All servers · order history</p>
                {history.length === 0 && (
                    <p className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
                        Orders from every server account appear here.
                    </p>
                )}
                <div className="space-y-2">
                    {history.map(order => (
                        <button
                            key={order.id}
                            type="button"
                            onClick={() => setSummary(order)}
                            className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3 text-left"
                        >
                            <span className="min-w-0">
                                <span className="block truncate text-sm font-semibold">{order.table?.name ?? (order.order_type === 'TAKEAWAY' ? 'Takeaway' : 'Order')}</span>
                                <span className="block truncate text-[11px] text-slate-500">{order.order_number} · {statusLabel[order.status] ?? order.status}</span>
                                <span className="block truncate text-[11px] text-slate-400">{order.server?.name ?? 'Server'}</span>
                            </span>
                            <span className="shrink-0 text-sm font-semibold text-[#d97745]">{money(Number(order.total))}</span>
                        </button>
                    ))}
                </div>
            </section>
        );
    }

    const mobileStepTitle = floorStep === 'tables' ? 'Tables' : floorStep === 'menu' ? selectedTableName : floorStep === 'history' ? 'History' : `${selectedTableName} · ticket`;

    return (
        <>
            <Head title="Server floor" />
            <AppShell>
                <div className="flex h-full min-h-0 flex-col">
                    <header className="flex shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-3 py-2">
                        {floorStep !== 'tables' && (
                            <button
                                type="button"
                                onClick={() => setFloorStep(floorStep === 'ticket' ? 'menu' : 'tables')}
                                className="flex min-h-11 min-w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700 lg:hidden"
                                aria-label="Go back"
                            >
                                <ArrowLeft size={18} />
                            </button>
                        )}
                        <div className="min-w-0 flex-1">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#d97745] lg:hidden">{mobileStepTitle}</p>
                            <p className="hidden text-[10px] font-semibold uppercase tracking-[0.16em] text-[#d97745] lg:block">Server</p>
                            <h1 className="text-base font-semibold leading-tight">{historyView ? 'Order history' : 'Table service'}</h1>
                        </div>
                        <Link
                            href={historyView ? '/server' : '/server?view=history'}
                            className={`flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl px-3 text-sm font-bold ${historyView ? 'bg-[#102b2b] text-white' : 'bg-[#fff4ec] text-[#b65b2e]'}`}
                        >
                            <History size={16} />
                            {historyView ? 'Floor' : 'History'}
                        </Link>
                    </header>
                    {historyView ? (
                        <div className="min-h-0 flex-1 overflow-hidden p-3">
                            {renderHistory('h-full')}
                        </div>
                    ) : (
                    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                        <div className="hidden min-h-0 flex-1 gap-3 overflow-hidden p-3 lg:grid lg:grid-cols-[220px_minmax(0,1fr)_320px]">
                            {renderTables('min-h-0')}
                            {renderMenu()}
                            {renderTicket()}
                        </div>

                        <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-3 lg:hidden">
                            {floorStep === 'tables' && renderTables('min-h-0 flex-1')}
                            {floorStep === 'menu' && renderMenu('min-h-0 flex-1')}
                            {floorStep === 'ticket' && renderTicket('min-h-0 flex-1 border-0 shadow-none ring-0')}
                        </div>

                        {floorStep === 'menu' && (
                            <div className="shrink-0 border-t border-slate-200 bg-white p-3 pb-safe lg:hidden">
                                <button type="button" onClick={() => setFloorStep('ticket')} className="flex min-h-12 w-full items-center justify-between rounded-xl bg-[#102b2b] px-4 text-sm font-bold text-white">
                                    <span>Table ticket · {selectedTableName}</span>
                                    <span>{activeOrder ? money(Number(activeOrder.total)) : 'Empty'}</span>
                                </button>
                            </div>
                        )}

                        <nav className="flex shrink-0 gap-1 border-t border-slate-200 bg-white p-2 pb-safe lg:hidden">
                                    {(['tables', 'menu', 'ticket'] as const).map(step => (
                                        <button
                                            key={step}
                                            type="button"
                                            disabled={step !== 'tables' && !tableId}
                                            onClick={() => (step === 'tables' ? setFloorStep(step) : tableId && setFloorStep(step))}
                                            className={`min-h-11 flex-1 rounded-lg text-xs font-bold capitalize ${floorStep === step ? 'bg-[#fff4ec] text-[#b65b2e]' : 'text-slate-500'} disabled:opacity-40`}
                                        >
                                            {step}
                                        </button>
                                    ))}
                        </nav>
                    </div>
                    )}
                </div>

                {summary && (
                    <div className="fixed inset-0 z-40 flex items-end justify-center bg-[#102b2b]/45 p-0 sm:items-center sm:p-4" onClick={() => setSummary(null)}>
                        <div className="max-h-[85dvh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:max-w-md sm:rounded-2xl" onClick={event => event.stopPropagation()}>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#d97745]">Order summary</p>
                            <h2 className="mt-1 text-xl font-semibold">{summary.table?.name ?? 'Table'} · {summary.order_number}</h2>
                            <p className="text-sm text-slate-500">{statusLabel[summary.status] ?? summary.status} · {summary.server?.name ?? 'Server'}</p>
                            <div className="mt-3 space-y-2 text-sm">
                                {summary.items.map(item => (
                                    <div key={item.id} className="flex justify-between gap-3">
                                        <span className="min-w-0">
                                            <span className="block">{item.quantity} × {item.product?.name}</span>
                                            {item.server?.name && (
                                                <span className="text-[11px] text-slate-400">Added by {item.server.name}</span>
                                            )}
                                        </span>
                                        <span className="shrink-0 font-medium">{money(Number(item.line_total))}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-3 space-y-1 border-t border-slate-100 pt-2 text-sm">
                                <div className="flex justify-between text-slate-600">
                                    <span>Subtotal</span>
                                    <span>{money(Number(summary.subtotal))}</span>
                                </div>
                                {Number(summary.discount) > 0 && (
                                    <div className="flex justify-between text-slate-600">
                                        <span>Discount</span>
                                        <span>-{money(Number(summary.discount))}</span>
                                    </div>
                                )}
                                <div className="flex justify-between text-base font-bold text-[#102b2b]">
                                    <span>Total</span>
                                    <span>{money(Number(summary.total))}</span>
                                </div>
                            </div>
                            {summary.payment && <p className="mt-1 text-xs text-slate-500">Paid by {summary.payment.payment_method}{summary.cashier ? ` · ${summary.cashier.name}` : ''}</p>}
                            <button type="button" onClick={() => setSummary(null)} className="mt-4 min-h-12 w-full rounded-xl bg-[#102b2b] text-base font-bold text-white pb-safe">Close</button>
                        </div>
                    </div>
                )}
            </AppShell>
        </>
    );
}