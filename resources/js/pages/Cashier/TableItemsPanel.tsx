import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Minus, Plus, Search, Send } from 'lucide-react';
import { canOrderProduct } from '../../lib/menuPrice';
import { openReceipt } from '../../lib/receipt';
import type { Product } from '../../types';

const money = (value: number) =>
    `Rs. ${Number(value || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

type CartLine = Product & { quantity: number };

export default function CashierTableItemsPanel() {
    const [orders, setOrders] = useState<any[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [cart, setCart] = useState<CartLine[]>([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [notice, setNotice] = useState('');
    const [confirmBill, setConfirmBill] = useState(false);
    const [checkoutOpen, setCheckoutOpen] = useState(false);
    const [shift, setShift] = useState<any>(null);
    const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD'>('CASH');
    const [received, setReceived] = useState('');
    const [discountType, setDiscountType] = useState<'amount' | 'percent'>('amount');
    const [discountInput, setDiscountInput] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [floor, productRes, shiftRes] = await Promise.all([
                axios.get('/api/floor'),
                axios.get('/api/products'),
                axios.get('/api/shift/current'),
            ]);
            const live = (floor.data.orders ?? []).filter((order: any) => ['OPEN', 'READY'].includes(order.status));
            setOrders(live);
            setProducts(productRes.data.data ?? productRes.data ?? []);
            setShift(shiftRes.data);
            setSelectedId(current => {
                if (current && live.some((order: any) => order.id === current)) {
                    return current;
                }
                return live[0]?.id ?? null;
            });
        } catch {
            setNotice('Unable to load table orders.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    const selected = useMemo(
        () => orders.find(order => order.id === selectedId) ?? null,
        [orders, selectedId],
    );

    const subtotal = selected ? Number(selected.subtotal ?? 0) : 0;
    const discount = useMemo(() => {
        const raw = discountInput === '' ? 0 : Number(discountInput);
        if (!Number.isFinite(raw) || raw <= 0) {
            return 0;
        }
        const amount = discountType === 'percent' ? subtotal * (Math.min(100, raw) / 100) : raw;
        return Math.min(amount, subtotal);
    }, [subtotal, discountType, discountInput]);
    const total = Math.max(0, subtotal - discount);

    const visibleProducts = useMemo(() => {
        const q = search.trim().toLowerCase();
        return products.filter(product => {
            if (!canOrderProduct(product)) {
                return false;
            }
            return !q || `${product.name} ${product.description ?? ''}`.toLowerCase().includes(q);
        }).slice(0, 24);
    }, [products, search]);

    function addProduct(product: Product) {
        setCart(current => current.some(line => line.id === product.id)
            ? current.map(line => line.id === product.id ? { ...line, quantity: line.quantity + 1 } : line)
            : [...current, { ...product, quantity: 1 }]);
    }

    async function sendNewItems() {
        if (!selected?.table_id || cart.length === 0) {
            setNotice('Add at least one new dish.');
            return;
        }
        if (!shift) {
            setNotice('Open a shift before sending items to the kitchen.');
            return;
        }
        setBusy(true);
        setNotice('');
        try {
            const response = await axios.post('/api/orders/kitchen', {
                table_id: selected.table_id,
                items: cart.map(line => ({ product_id: line.id, quantity: line.quantity })),
            });
            setCart([]);
            const print = response.data.kitchen_print;
            const queue = response.data.kitchen_ticket?.queue_number;
            const queueLabel = queue ? ` Kitchen queue #${queue}.` : '';
            setNotice(print?.printed
                ? `New items sent to kitchen for ${selected.table?.name ?? 'the table'}.${queueLabel} Ticket printed.`
                : `Items saved.${queueLabel} Kitchen printer not used.`);
            await load();
        } catch (error: any) {
            setNotice(error.response?.data?.message ?? 'Unable to send items to the kitchen.');
        } finally {
            setBusy(false);
        }
    }

    function openBillFlow() {
        if (!selected) {
            return;
        }
        if (!shift) {
            setNotice('Open a shift before billing.');
            return;
        }
        setConfirmBill(true);
    }

    async function finalizeBill() {
        if (!selected) {
            return;
        }
        const cashReceived = paymentMethod === 'CASH' ? Number(received || total) : null;
        if (paymentMethod === 'CASH' && (cashReceived === null || cashReceived < total)) {
            setNotice('Cash received must cover the total.');
            return;
        }
        setBusy(true);
        try {
            const response = await axios.post(`/api/orders/${selected.id}/bill`, {
                discount,
                payment: { method: paymentMethod, received_amount: cashReceived },
            });
            await openReceipt(response.data);
            setCheckoutOpen(false);
            setConfirmBill(false);
            setDiscountInput('');
            setDiscountType('amount');
            setReceived('');
            setCart([]);
            setSelectedId(null);
            setNotice(`Bill printed for ${response.data.table?.name ?? 'table'}. Moved to Orders.`);
            await load();
        } catch (error: any) {
            setNotice(error.response?.data?.message ?? 'Unable to create the bill.');
        } finally {
            setBusy(false);
        }
    }

    if (loading) {
        return <p className="rounded-2xl bg-white p-12 text-center text-sm text-slate-400 shadow-sm ring-1 ring-slate-100">Loading tables…</p>;
    }

    return (
        <div className="space-y-4">
            <p className="text-sm text-slate-500">
                Open dine-in tables appear here when POS sends items to the kitchen. Add more dishes, send to the LAN kitchen printer, then bill when the guest is ready.
            </p>
            {notice && <p className="rounded-xl bg-[#fff4ec] p-3 text-sm font-medium text-[#a85329]">{notice}</p>}
            <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
                <div className="space-y-2 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-100">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Dining tables</p>
                    {orders.length === 0 ? (
                        <p className="py-6 text-center text-xs text-slate-400">No open dine-in tables.</p>
                    ) : orders.map(order => (
                        <button
                            key={order.id}
                            type="button"
                            onClick={() => { setSelectedId(order.id); setCart([]); setNotice(''); }}
                            className={`w-full rounded-xl px-3 py-2.5 text-left transition ${selectedId === order.id ? 'bg-[#fff4ec] ring-1 ring-[#d97745]' : 'bg-slate-50 hover:bg-slate-100'}`}
                        >
                            <p className="font-semibold">{order.table?.name ?? 'Table'}</p>
                            {order.latest_kitchen_ticket?.queue_number ? (
                                <p className="text-[10px] font-bold uppercase tracking-wide text-[#d97745]">Queue #{order.latest_kitchen_ticket.queue_number}</p>
                            ) : null}
                            <p className="text-xs text-slate-500">{order.order_number}</p>
                            <p className="mt-1 text-xs font-medium text-[#d97745]">{money(Number(order.subtotal ?? 0))}</p>
                        </button>
                    ))}
                </div>

                {selected ? (
                    <div className="space-y-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                                <h2 className="text-lg font-semibold">{selected.table?.name ?? 'Table'}</h2>
                                {selected.latest_kitchen_ticket?.queue_number ? (
                                    <p className="text-xs font-bold text-[#d97745]">Kitchen queue #{selected.latest_kitchen_ticket.queue_number} today</p>
                                ) : null}
                                <p className="text-xs text-slate-500">{selected.order_number}</p>
                            </div>
                            <button
                                type="button"
                                disabled={busy}
                                onClick={openBillFlow}
                                className="rounded-xl bg-[#102b2b] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                            >
                                Guest finished — bill table
                            </button>
                        </div>

                        <section>
                            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">On the table</p>
                            <ul className="space-y-1.5">
                                {(selected.items ?? []).map((item: any) => (
                                    <li key={item.id} className="flex justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                                        <span className="min-w-0 truncate font-medium">{item.product?.name ?? item.product_name}</span>
                                        <span className="shrink-0 text-slate-500">×{item.quantity} · {money(Number(item.line_total))}</span>
                                    </li>
                                ))}
                            </ul>
                        </section>

                        <section>
                            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Add more items</p>
                            <div className="relative mb-2">
                                <Search className="absolute left-3 top-3 text-slate-400" size={16} />
                                <input
                                    value={search}
                                    onChange={event => setSearch(event.target.value)}
                                    placeholder="Search menu to add…"
                                    className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-[#d97745]"
                                />
                            </div>
                            <div className="grid max-h-40 grid-cols-2 gap-1.5 overflow-y-auto sm:grid-cols-3">
                                {visibleProducts.map(product => (
                                    <button
                                        key={product.id}
                                        type="button"
                                        onClick={() => addProduct(product)}
                                        className="rounded-lg border border-slate-200 px-2 py-2 text-left text-xs font-semibold hover:border-[#d97745] hover:bg-[#fff4ec]"
                                    >
                                        {product.name}
                                    </button>
                                ))}
                            </div>
                            {cart.length > 0 && (
                                <div className="mt-3 space-y-2 rounded-xl bg-[#f6f7f5] p-3">
                                    {cart.map(line => (
                                        <div key={line.id} className="flex items-center justify-between gap-2 text-sm">
                                            <span className="min-w-0 truncate font-medium">{line.name}</span>
                                            <div className="flex items-center gap-1">
                                                <button type="button" onClick={() => setCart(c => c.map(x => x.id === line.id ? { ...x, quantity: x.quantity - 1 } : x).filter(x => x.quantity > 0))} className="flex h-8 w-8 items-center justify-center rounded-lg bg-white ring-1 ring-slate-200"><Minus size={14} /></button>
                                                <span className="w-5 text-center font-bold">{line.quantity}</span>
                                                <button type="button" onClick={() => setCart(c => c.map(x => x.id === line.id ? { ...x, quantity: x.quantity + 1 } : x))} className="flex h-8 w-8 items-center justify-center rounded-lg bg-white ring-1 ring-slate-200"><Plus size={14} /></button>
                                            </div>
                                        </div>
                                    ))}
                                    <button
                                        type="button"
                                        disabled={busy}
                                        onClick={() => void sendNewItems()}
                                        className="flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#d97745] text-sm font-bold text-white disabled:opacity-50"
                                    >
                                        <Send size={16} /> Send new items to kitchen
                                    </button>
                                </div>
                            )}
                        </section>
                    </div>
                ) : (
                    <p className="rounded-2xl bg-white p-12 text-center text-sm text-slate-400 shadow-sm ring-1 ring-slate-100">Select a table to manage items.</p>
                )}
            </div>

            {confirmBill && selected && !checkoutOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#102b2b]/45 p-4">
                    <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#d97745]">Confirm</p>
                        <h3 className="mt-1 text-xl font-semibold">Bill {selected.table?.name ?? 'this table'}?</h3>
                        <p className="mt-2 text-sm text-slate-500">The guest has finished eating. You can add a discount on the next step before printing the final bill.</p>
                        <p className="mt-4 text-2xl font-bold text-[#d97745]">{money(subtotal)}</p>
                        <p className="text-xs text-slate-400">Current subtotal for all items on this table.</p>
                        <div className="mt-5 flex gap-2">
                            <button type="button" onClick={() => setConfirmBill(false)} className="flex-1 rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-600">Cancel</button>
                            <button type="button" onClick={() => { setConfirmBill(false); setCheckoutOpen(true); }} className="flex-1 rounded-xl bg-[#d97745] py-3 text-sm font-bold text-white">Continue to bill</button>
                        </div>
                    </div>
                </div>
            )}

            {checkoutOpen && selected && (
                <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#102b2b]/45 p-4">
                    <div className="my-4 w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
                        <h3 className="text-xl font-semibold">Final bill · {selected.table?.name}</h3>
                        <div className="mt-4 space-y-2 text-sm">
                            <div className="flex justify-between text-slate-600"><span>Subtotal</span><span>{money(subtotal)}</span></div>
                            <div className="flex items-center justify-between gap-2">
                                <span className="text-slate-600">Discount</span>
                                <div className="flex items-center gap-1">
                                    <div className="flex gap-0.5 rounded-lg bg-slate-100 p-0.5 text-xs font-bold">
                                        <button type="button" onClick={() => setDiscountType('amount')} className={`rounded-md px-2 py-1 ${discountType === 'amount' ? 'bg-white shadow-sm' : ''}`}>Rs.</button>
                                        <button type="button" onClick={() => setDiscountType('percent')} className={`rounded-md px-2 py-1 ${discountType === 'percent' ? 'bg-white shadow-sm' : ''}`}>%</button>
                                    </div>
                                    <input type="number" min="0" value={discountInput} onChange={e => setDiscountInput(e.target.value)} className="w-16 rounded-lg border border-slate-200 px-2 py-1 text-right text-sm" placeholder="0" />
                                </div>
                            </div>
                            <div className="flex justify-between border-t border-slate-100 pt-2 text-lg font-bold">
                                <span>Total</span>
                                <span className="text-[#d97745]">{money(total)}</span>
                            </div>
                        </div>
                        <div className="mt-4 grid grid-cols-2 gap-2">
                            {(['CASH', 'CARD'] as const).map(method => (
                                <button key={method} type="button" onClick={() => setPaymentMethod(method)} className={`min-h-10 rounded-lg border text-xs font-bold ${paymentMethod === method ? 'border-[#d97745] bg-[#fff4ec] text-[#b65b2e]' : 'border-slate-200'}`}>{method}</button>
                            ))}
                        </div>
                        {paymentMethod === 'CASH' && (
                            <input type="number" min="0" value={received} onChange={e => setReceived(e.target.value)} placeholder={`Cash received (${total.toFixed(2)})`} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
                        )}
                        <div className="mt-4 flex gap-2">
                            <button type="button" onClick={() => setCheckoutOpen(false)} className="flex-1 rounded-xl border border-slate-200 py-3 text-sm font-semibold">Back</button>
                            <button type="button" disabled={busy} onClick={() => void finalizeBill()} className="flex-1 rounded-xl bg-[#d97745] py-3 text-sm font-bold text-white disabled:opacity-50">{busy ? 'Printing…' : 'Bill & print'}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}