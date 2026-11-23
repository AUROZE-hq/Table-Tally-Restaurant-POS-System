import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { Head, usePage } from '@inertiajs/react';
import { Banknote, Check, ChevronDown, CreditCard, Minus, Plus, QrCode, Search, ShoppingBag, Trash2, X } from 'lucide-react';
import AppShell from '../../components/layout/AppShell';
import { FLOOR_POLL_MS } from '../../lib/floorPoll';
import CheckoutPaymentModal from '../../components/pos/CheckoutPaymentModal';
import PosCategoryNav from '../../components/pos/PosCategoryNav';
import type { Category, Product, RestaurantTable, Shift } from '../../types';

interface Props {
    categories: Category[];
    products: Product[];
    tables: RestaurantTable[];
    shift: Shift | null;
}

interface CartItem extends Product { quantity: number; notes?: string; }

const money = (value: number) => `Rs. ${value.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

type DiscountType = 'amount' | 'percent';

export default function POS({ categories, products, tables, shift: initialShift }: Props) {
    const { auth } = usePage<{ auth: { user: { role: 'ADMIN' | 'CASHIER' } } }>().props;
    const [activeCategory, setActiveCategory] = useState<number | null>(null);
    const [search, setSearch] = useState('');
    const [cart, setCart] = useState<CartItem[]>([]);
    const [orderType, setOrderType] = useState<'DINE_IN' | 'TAKEAWAY'>('DINE_IN');
    const [tableId, setTableId] = useState<number | ''>('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [discountType, setDiscountType] = useState<DiscountType>('amount');
    const [discountInput, setDiscountInput] = useState('');
    const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD' | 'LANKAQR'>('CASH');
    const [received, setReceived] = useState('');
    const [shift, setShift] = useState<Shift | null>(initialShift ?? (auth.user?.role === 'ADMIN' ? { id: 0, opening_cash: 0, status: 'OPEN' } : null));
    const [openingCash, setOpeningCash] = useState('');
    const [notice, setNotice] = useState('');
    const [busy, setBusy] = useState(false);
    const [checkoutOpen, setCheckoutOpen] = useState(false);
    const [floorOrders, setFloorOrders] = useState<any[]>([]);
    const [billOrder, setBillOrder] = useState<any | null>(null);
    const floorAbortRef = useRef<AbortController | null>(null);

    const filteredProducts = useMemo(
        () =>
            products.filter(
                product =>
                    (activeCategory == null || Number(product.category_id) === Number(activeCategory)) &&
                    product.name.toLowerCase().includes(search.toLowerCase()),
            ),
        [products, activeCategory, search],
    );

    const activeCategoryName = activeCategory
        ? categories.find(c => c.id === activeCategory)?.name ?? 'Category'
        : 'All menu';
    const cartSubtotal = cart.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);
    const subtotal = billOrder ? Number(billOrder.subtotal) : cartSubtotal;
    const discount = useMemo(() => {
        const raw = discountInput === '' ? 0 : Number(discountInput);
        if (!Number.isFinite(raw) || raw <= 0) {
            return 0;
        }
        const amount =
            discountType === 'percent'
                ? subtotal * (Math.min(100, raw) / 100)
                : raw;
        return Math.min(amount, subtotal);
    }, [subtotal, discountType, discountInput]);
    const total = Math.max(0, subtotal - discount);
    const cashChange = useMemo(() => {
        if (paymentMethod !== 'CASH' || received === '') {
            return 0;
        }
        const paid = Number(received);
        return Number.isFinite(paid) && paid >= total ? paid - total : 0;
    }, [paymentMethod, received, total]);
    const addToCart = (product: Product) => setCart(current => current.some(item => item.id === product.id) ? current.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item) : [...current, { ...product, quantity: 1 }]);

    async function loadFloor() {
        floorAbortRef.current?.abort();
        const controller = new AbortController();
        floorAbortRef.current = controller;

        try {
            const response = await axios.get('/api/floor', { signal: controller.signal });
            setFloorOrders(response.data.orders ?? []);
        } catch (error) {
            if (axios.isCancel(error)) {
                return;
            }
            setFloorOrders([]);
        }
    }

    useEffect(() => {
        const run = () => {
            if (document.hidden) {
                return;
            }
            void loadFloor();
        };

        run();
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
    const changeQuantity = (id: number, amount: number) => setCart(current => current.map(item => item.id === id ? { ...item, quantity: item.quantity + amount } : item).filter(item => item.quantity > 0));

    function printReceipt(order: any) {
        const receiptWindow = window.open('', '_blank', 'width=360,height=640');
        if (!receiptWindow) return;
        const pay = order.payment;
        const changeRow = pay?.payment_method === 'CASH' && Number(pay.change_amount) > 0
            ? `<div class="row"><span>Change</span><span>${money(Number(pay.change_amount))}</span></div>`
            : '';
        const customerLine = order.order_type === 'TAKEAWAY' && order.customer?.phone
            ? `<p>Customer: ${order.customer.phone}</p>`
            : '';
        const tableLine = order.table?.name ? `<p>Table: ${order.table.name}</p>` : '';
        const serverLine = order.server?.name ? `<p>Server: ${order.server.name}</p>` : '';
        receiptWindow.document.write(`<html><head><title>${order.order_number}</title><style>body{font:12px monospace;width:72mm;margin:8mm auto;color:#111}h2{text-align:center;font-size:15px}p{margin:5px 0}.row{display:flex;justify-content:space-between;border-bottom:1px dashed #999;padding:4px 0}.total{font-weight:bold;font-size:14px;margin-top:8px}</style></head><body><h2>AUROZE POS<br/>RESTAURANT POS</h2><p>Order: ${order.order_number}</p>${tableLine}${serverLine}${customerLine}${order.items.map((item: any) => `<div class="row"><span>${item.quantity} x ${item.product.name}</span><span>${money(Number(item.line_total))}</span></div>`).join('')}<div class="row"><span>Subtotal</span><span>${money(Number(order.subtotal))}</span></div><div class="row"><span>Discount</span><span>${money(Number(order.discount))}</span></div><div class="row total"><span>TOTAL</span><span>${money(Number(order.total))}</span></div>${changeRow}<p>Payment: ${pay?.payment_method ?? 'Unpaid'}</p><p style="text-align:center;margin-top:18px">Thank you!</p></body></html>`);
        receiptWindow.document.close();
        receiptWindow.print();
    }

    async function startShift(event: FormEvent) {
        event.preventDefault();
        try { const response = await axios.post('/api/shift', { opening_cash: Number(openingCash) }); setShift(response.data); setOpeningCash(''); setNotice('Shift opened successfully.'); } catch (error: any) { setNotice(error.response?.data?.message ?? 'Unable to open shift.'); }
    }

    function openCheckout() {
        if (billOrder) {
            if (!shift) {
                setNotice('Open a shift before taking payment.');
                return;
            }
            setNotice('');
            setCheckoutOpen(true);
            return;
        }
        if (!cart.length) {
            setNotice('Add at least one product.');
            return;
        }
        if (orderType === 'DINE_IN' && !tableId) {
            setNotice('Select a table for dine-in.');
            return;
        }
        if (orderType === 'TAKEAWAY' && customerPhone.trim() === '') {
            setNotice('Enter customer phone number for takeaway.');
            return;
        }
        if (!shift) {
            setNotice('Open a shift before taking payment.');
            return;
        }
        setNotice('');
        setCheckoutOpen(true);
    }

    async function finalizeCheckout() {
        const chargeTotal = total;
        const cashReceived = paymentMethod === 'CASH' ? Number(received || chargeTotal) : null;
        if (paymentMethod === 'CASH' && (cashReceived === null || cashReceived < chargeTotal)) {
            setNotice('Cash received must cover the total.');
            return;
        }
        setBusy(true);
        try {
            if (billOrder) {
                const response = await axios.post(`/api/orders/${billOrder.id}/bill`, {
                    discount,
                    payment: { method: paymentMethod, received_amount: cashReceived },
                });
                printReceipt(response.data);
                setBillOrder(null);
                setDiscountInput('');
                setDiscountType('amount');
                setReceived('');
                setCheckoutOpen(false);
                setNotice(`Bill created for ${response.data.table?.name ?? 'table'}. The server can mark the customer completed.`);
                await loadFloor();
                return;
            }
            const response = await axios.post('/api/orders', {
                order_type: orderType,
                table_id: orderType === 'DINE_IN' ? tableId : null,
                customer_phone: orderType === 'TAKEAWAY' ? customerPhone.trim() : null,
                discount,
                items: cart.map(item => ({ product_id: item.id, quantity: item.quantity, notes: item.notes })),
                payment: { method: paymentMethod, received_amount: cashReceived },
            });
            printReceipt(response.data);
            setCart([]);
            setDiscountInput('');
            setDiscountType('amount');
            setReceived('');
            setTableId('');
            setCustomerPhone('');
            setCheckoutOpen(false);
            setNotice('Order completed.');
        } catch (error: any) {
            setNotice(error.response?.data?.message ?? 'Unable to complete order.');
        } finally {
            setBusy(false);
        }
    }

    return (
        <>
            <Head title="POS" />
            <AppShell>
                <div className="flex h-full min-h-0 flex-col">
                    <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-3 py-2">
                        <div>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#d97745]">Point of sale</p>
                            <h1 className="text-base font-semibold leading-tight">Service counter</h1>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${shift ? 'bg-[#eff6ef] text-[#2c7150]' : 'bg-amber-50 text-amber-700'}`}>
                                <span className={`h-1.5 w-1.5 rounded-full ${shift ? 'bg-[#47a96f]' : 'bg-amber-500'}`} />
                                {shift ? 'Shift open' : 'Shift required'}
                            </div>
                            <div className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-600">LKR <ChevronDown size={12} className="ml-0.5 inline" /></div>
                        </div>
                    </header>
                    <div className="grid min-h-0 flex-1 gap-3 p-3 lg:grid-cols-[minmax(0,1fr)_340px]">
                        <section className="flex min-h-0 min-w-0 gap-3">
                            <div className="hidden min-h-0 shrink-0 lg:flex">
                                <PosCategoryNav
                                    variant="sidebar"
                                    categories={categories}
                                    products={products}
                                    activeCategory={activeCategory}
                                    onSelect={setActiveCategory}
                                />
                            </div>
                            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                            <div className="mb-2 flex items-center gap-2">
                                <div className="relative min-w-0 flex-1">
                                    <Search className="absolute left-3 top-3.5 text-slate-400" size={16} />
                                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search menu..." className="min-h-11 w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-[#d97745]" />
                                </div>
                                <span className="hidden shrink-0 text-[11px] text-slate-400 sm:inline">{filteredProducts.length} items</span>
                            </div>
                            <div className="lg:hidden">
                                <PosCategoryNav
                                    variant="mobile"
                                    categories={categories}
                                    products={products}
                                    activeCategory={activeCategory}
                                    onSelect={setActiveCategory}
                                />
                            </div>
                            <p className="mb-2 hidden text-xs font-semibold text-slate-500 lg:block">{activeCategoryName}</p>
                            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                                    {filteredProducts.map(product => (
                                        <button key={product.id} onClick={() => addToCart(product)} className="group flex min-h-14 items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3 text-left shadow-sm transition duration-150 hover:border-[#d97745] hover:shadow-md active:scale-[0.98]">
                                            <span className="min-w-0">
                                                <span className="block truncate text-[13px] font-semibold text-slate-800">{product.name}</span>
                                                <span className="mt-0.5 block text-xs font-medium text-[#d97745]">{money(Number(product.price))}</span>
                                            </span>
                                            <Plus size={14} className="shrink-0 text-slate-300 transition group-hover:text-[#d97745]" />
                                        </button>
                                    ))}
                                </div>
                            </div>
                            </div>
                        </section>
                        <aside className="flex min-h-0 flex-col rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-100">
                            {floorOrders.filter((order: any) => order.status === 'OPEN' || order.status === 'READY' || order.status === 'BILLED').length > 0 && (
                                <div className="mb-2 max-h-28 space-y-1 overflow-y-auto">
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Server tables</p>
                                    {floorOrders.filter((order: any) => order.status !== 'COMPLETED').map((order: any) => (
                                        <button key={order.id} type="button" disabled={order.status === 'BILLED'} onClick={() => { setBillOrder(order); setNotice(''); }} className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs ${billOrder?.id === order.id ? 'bg-[#fff4ec] ring-1 ring-[#d97745]' : 'bg-slate-50'} disabled:opacity-70`}>
                                            <span className="font-semibold">{order.table?.name ?? 'Table'} · {order.status === 'BILLED' ? 'Billed' : order.status === 'READY' ? 'Ready' : 'Open'}</span>
                                            <span>{money(Number(order.total))}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                            <div className="flex items-center justify-between">
                                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">{billOrder ? `Bill ${billOrder.table?.name ?? 'table'}` : 'Current order'}</p>
                                <button onClick={() => { setCart([]); setBillOrder(null); }} className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-400 transition hover:bg-red-50 hover:text-red-500" title="Clear order"><Trash2 size={18} /></button>
                            </div>
                            <div className="mt-2 flex w-full gap-2 rounded-xl bg-slate-100 p-1">
                                <button type="button" onClick={() => { setOrderType('DINE_IN'); setCustomerPhone(''); }} className={`min-h-11 flex-1 rounded-lg text-sm font-semibold transition ${orderType === 'DINE_IN' ? 'bg-white text-[#102b2b] shadow-sm' : 'text-slate-500'}`}>Dine in</button>
                                <button type="button" onClick={() => { setOrderType('TAKEAWAY'); setTableId(''); }} className={`min-h-11 flex-1 rounded-lg text-sm font-semibold transition ${orderType === 'TAKEAWAY' ? 'bg-white text-[#102b2b] shadow-sm' : 'text-slate-500'}`}>Takeaway</button>
                            </div>
                            {orderType === 'DINE_IN' && (
                                <select value={tableId} onChange={e => setTableId(e.target.value ? Number(e.target.value) : '')} className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800 outline-none focus:border-[#d97745]">
                                    <option value="">Select table</option>
                                    {tables.filter(table => table.status === 'AVAILABLE').map(table => <option key={table.id} value={table.id}>{table.name}</option>)}
                                </select>
                            )}
                            {orderType === 'TAKEAWAY' && (
                                <input type="tel" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="Customer phone" className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-[#d97745]" autoComplete="tel" />
                            )}
                            <div className="my-2 min-h-0 flex-1 space-y-2 overflow-y-auto">
                                {cart.length === 0 ? (
                                    <div className="flex h-full min-h-16 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 text-center">
                                        <ShoppingBag className="mb-1 text-slate-300" size={16} />
                                        <p className="text-xs text-slate-400">Tap a menu item</p>
                                    </div>
                                ) : cart.map(item => (
                                    <div key={item.id} className="rounded-xl bg-slate-50 px-2.5 py-2">
                                        <div className="flex items-center justify-between gap-2">
                                            <p className="truncate text-sm font-semibold">{item.name}</p>
                                            <button onClick={() => setCart(cart.filter(cartItem => cartItem.id !== item.id))} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500"><X size={16} /></button>
                                        </div>
                                        <div className="mt-1 flex items-center justify-between">
                                            <span className="text-xs text-slate-500">{money(Number(item.price) * item.quantity)}</span>
                                            <div className="flex items-center gap-2">
                                                <button onClick={() => changeQuantity(item.id, -1)} className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-slate-600 shadow-sm ring-1 ring-slate-200"><Minus size={16} /></button>
                                                <span className="w-6 text-center text-sm font-semibold">{item.quantity}</span>
                                                <button onClick={() => changeQuantity(item.id, 1)} className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-slate-600 shadow-sm ring-1 ring-slate-200"><Plus size={16} /></button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {notice && <div className="mb-2 flex items-start gap-1.5 rounded-lg bg-[#fff4ec] px-2 py-1.5 text-[11px] font-medium text-[#a85329]"><Check size={13} className="mt-0.5 shrink-0" />{notice}</div>}
                            <div className="shrink-0 space-y-1.5 border-t border-dashed border-slate-200 pt-2 text-xs">
                                <div className="flex justify-between text-slate-500"><span>Subtotal</span><span>{money(subtotal)}</span></div>
                                <div className="flex items-center justify-between gap-2 text-slate-500">
                                    <span>Discount</span>
                                    <div className="flex items-center gap-1">
                                        <div className="flex gap-1 rounded-lg bg-slate-100 p-1 text-xs font-bold">
                                            <button type="button" onClick={() => setDiscountType('amount')} className={`min-h-9 min-w-11 rounded-md px-2 ${discountType === 'amount' ? 'bg-white text-[#102b2b] shadow-sm' : 'text-slate-400'}`}>Rs.</button>
                                            <button type="button" onClick={() => setDiscountType('percent')} className={`min-h-9 min-w-11 rounded-md px-2 ${discountType === 'percent' ? 'bg-white text-[#102b2b] shadow-sm' : 'text-slate-400'}`}>%</button>
                                        </div>
                                        <input type="number" min="0" max={discountType === 'percent' ? 100 : undefined} step={discountType === 'percent' ? '0.01' : '1'} value={discountInput} onChange={e => setDiscountInput(e.target.value)} className="min-h-11 w-20 rounded-lg border border-slate-200 px-2 text-right text-sm outline-none focus:border-[#d97745]" placeholder="0" />
                                    </div>
                                </div>
                                {discount > 0 && <p className="text-right text-[11px] text-slate-400">−{money(discount)}{discountType === 'percent' && discountInput ? ` (${discountInput}%)` : ''}</p>}
                                <div className="flex justify-between border-t border-slate-100 pt-1.5 text-sm font-bold"><span>Total</span><span className="text-[#d97745]">{money(total)}</span></div>
                                <div className="grid grid-cols-3 gap-2">
                                    {([['CASH', Banknote], ['CARD', CreditCard], ['LANKAQR', QrCode]] as const).map(([method, Icon]) => (
                                        <button key={method} onClick={() => setPaymentMethod(method)} className={`flex min-h-12 items-center justify-center gap-1 rounded-xl border text-[11px] font-bold transition ${paymentMethod === method ? 'border-[#d97745] bg-[#fff4ec] text-[#b65b2e]' : 'border-slate-200 text-slate-400 hover:bg-slate-50'}`}><Icon size={15} />{method}</button>
                                    ))}
                                </div>
                                {paymentMethod === 'CASH' && <input type="number" min="0" value={received} onChange={e => setReceived(e.target.value)} placeholder={`Cash received (${total.toFixed(2)})`} className="min-h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-[#d97745]" />}
                                {paymentMethod === 'CASH' && cashChange > 0 && <p className="text-[11px] font-medium text-[#2c7150]">Change: {money(cashChange)}</p>}
                                <button type="button" disabled={busy || !shift || billOrder?.status === 'BILLED'} onClick={openCheckout} className="min-h-12 w-full rounded-xl bg-[#d97745] text-sm font-bold text-white shadow-md shadow-[#d97745]/20 transition hover:bg-[#bf6335] disabled:opacity-50">{busy ? 'Processing...' : !shift ? 'Open a shift to sell' : billOrder ? 'Create table bill' : 'Charge & complete'}</button>
                            </div>
                        </aside>
                    </div>
                </div>
                <CheckoutPaymentModal open={checkoutOpen} method={paymentMethod} total={total} money={money} received={received} onReceivedChange={setReceived} busy={busy} itemCount={billOrder ? (billOrder.items?.length ?? 0) : cart.length} orderLabel={billOrder ? (billOrder.table?.name ?? 'Table bill') : (orderType === 'DINE_IN' ? 'Dine-in' : 'Takeaway')} onClose={() => setCheckoutOpen(false)} onConfirm={finalizeCheckout} />
                {!shift && (
                    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#102b2b]/45 p-4">
                        <form onSubmit={startShift} className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#d97745]">Start service</p>
                            <h2 className="mt-1 text-xl font-semibold">Open your shift</h2>
                            <p className="mt-1 text-sm text-slate-500">Enter the opening cash before taking the first order.</p>
                            <input required min="0" type="number" value={openingCash} onChange={e => setOpeningCash(e.target.value)} placeholder="Opening cash · Rs." className="mt-4 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#d97745]" />
                            <button className="mt-3 w-full rounded-xl bg-[#102b2b] py-2.5 text-sm font-bold text-white">Start shift</button>
                        </form>
                    </div>
                )}
            </AppShell>
        </>
    );
}