import { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { Head, usePage } from '@inertiajs/react';
import { Banknote, Check, ChevronDown, CreditCard, Minus, Monitor, Plus, Search, ShoppingBag, Trash2, X } from 'lucide-react';
import AppShell from '../../components/layout/AppShell';
import { FLOOR_POLL_MS } from '../../lib/floorPoll';
import CashierShiftControl from '../../components/pos/CashierShiftControl';
import CheckoutPaymentModal from '../../components/pos/CheckoutPaymentModal';
import MenuCatalog from '../../components/pos/MenuCatalog';
import PosCategoryNav from '../../components/pos/PosCategoryNav';
import { canOrderProduct } from '../../lib/menuPrice';
import { publishCustomerDisplay, type CustomerDisplayItem } from '../../lib/customerDisplay';
import { openReceipt } from '../../lib/receipt';
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
    const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD'>('CASH');
    const [received, setReceived] = useState('');
    const isCashier = auth.user?.role === 'CASHIER';
    const [shift, setShift] = useState<Shift | null>(
        initialShift ?? (auth.user?.role === 'ADMIN' ? { id: 0, opening_cash: 0, status: 'OPEN' } : null),
    );
    const [notice, setNotice] = useState('');
    const [busy, setBusy] = useState(false);
    const [checkoutOpen, setCheckoutOpen] = useState(false);
    const [floorOrders, setFloorOrders] = useState<any[]>([]);
    const [billOrder, setBillOrder] = useState<any | null>(null);
    const floorAbortRef = useRef<AbortController | null>(null);

    async function refreshShift() {
        if (!isCashier) {
            return;
        }
        try {
            const response = await axios.get<Shift | null>('/api/shift/current');
            setShift(response.data);
        } catch {
            setShift(null);
        }
    }

    useEffect(() => {
        void refreshShift();
    }, [isCashier]);

    const visibleCount = useMemo(() => {
        const query = search.trim().toLowerCase();
        return products.filter(product => {
            const matchesSearch = !query || `${product.name} ${product.description ?? ''}`.toLowerCase().includes(query);
            const matchesCategory = activeCategory == null || product.category_id === activeCategory || product.category?.parent_id === activeCategory;
            return matchesSearch && matchesCategory;
        }).length;
    }, [products, activeCategory, search]);

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
    const canAddMenuItems = orderType === 'TAKEAWAY' || (orderType === 'DINE_IN' && tableId !== '' && !billOrder);

    const addToCart = (product: Product) => {
        if (orderType === 'DINE_IN' && !tableId) {
            setNotice('Select a table before adding food.');
            return;
        }
        if (billOrder) {
            setNotice('Clear the table bill or finish payment before adding dishes.');
            return;
        }
        if (!canOrderProduct(product)) {
            setNotice(product.price_label || 'Price to be confirmed.');
            return;
        }
        setCart(current => current.some(item => item.id === product.id) ? current.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item) : [...current, { ...product, quantity: 1 }]);
    };

    const displayItems = useMemo<CustomerDisplayItem[]>(() => (
        billOrder
            ? (billOrder.items ?? []).map((item: { product?: { name?: string }; quantity: number; line_total: number | string }) => ({
                name: item.product?.name ?? item.product_name ?? 'Item',
                quantity: Number(item.quantity),
                lineTotal: Number(item.line_total),
            }))
            : cart.map(item => ({
                name: item.name,
                quantity: item.quantity,
                lineTotal: Number(item.price) * item.quantity,
            }))
    ), [billOrder, cart]);

    const displayLabel = useMemo(() => {
        if (billOrder) {
            return billOrder.table?.name ? `Table ${billOrder.table.name}` : 'Table bill';
        }
        if (orderType === 'DINE_IN') {
            const tableName = tables.find(table => table.id === tableId)?.name;
            return tableName ? `Table ${tableName}` : 'Dine in';
        }
        return 'Takeaway';
    }, [billOrder, orderType, tableId, tables]);

    useEffect(() => {
        publishCustomerDisplay({
            status: displayItems.length > 0 ? 'ordering' : 'idle',
            label: displayItems.length > 0 ? displayLabel : 'Welcome',
            items: displayItems,
            subtotal,
            discount,
            total,
            updatedAt: Date.now(),
        });
    }, [displayItems, displayLabel, subtotal, discount, total]);

    function showPaidOnCustomerDisplay(paidTotal: number, label: string) {
        publishCustomerDisplay({
            status: 'paid',
            label,
            items: [],
            subtotal: paidTotal,
            discount: 0,
            total: paidTotal,
            updatedAt: Date.now(),
        });
    }

    function openCustomerDisplay() {
        const features = `width=900,height=700,left=${window.screen.availWidth},top=0`;
        const popup = window.open('/customer-display', 'auroze-customer-display', features);
        popup?.focus();
    }

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
        return openReceipt(order);
    }

    const activeTableOrder = orderType === 'DINE_IN' && tableId
        ? floorOrders.find((order: any) => order.table_id === tableId && ['OPEN', 'READY', 'BILLED'].includes(order.status))
        : null;
    const kitchenMode = orderType === 'DINE_IN' && !billOrder;

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
        if (orderType === 'DINE_IN') {
            setNotice('Send dine-in dishes to the kitchen first. Bill the table when the customer is ready to pay.');
            return;
        }
        setNotice('');
        setCheckoutOpen(true);
    }

    async function sendToKitchen() {
        if (!cart.length) {
            if (activeTableOrder && activeTableOrder.status !== 'BILLED') {
                if (!shift) {
                    setNotice('Open a shift before taking payment.');
                    return;
                }
                setBillOrder(activeTableOrder);
                setNotice('');
                setCheckoutOpen(true);
                return;
            }
            setNotice('Add at least one new dish.');
            return;
        }
        if (!tableId) {
            setNotice('Select a table for dine-in.');
            return;
        }
        if (activeTableOrder?.status === 'BILLED') {
            setNotice('This table is waiting for payment. Settle the bill before adding more dishes.');
            return;
        }
        if (!shift) {
            setNotice('Open a shift before sending orders to the kitchen.');
            return;
        }
        setBusy(true);
        setNotice('');
        try {
            const response = await axios.post('/api/orders/kitchen', {
                table_id: tableId,
                items: cart.map(item => ({ product_id: item.id, quantity: item.quantity, notes: item.notes })),
            });
            setCart([]);
            const print = response.data.kitchen_print;
            const tableName = response.data.order?.table?.name ?? 'the table';
            const queue = response.data.kitchen_ticket?.queue_number;
            const queueLabel = queue ? ` Queue #${queue}.` : '';
            setNotice(print?.printed
                ? `Sent to kitchen for ${tableName}.${queueLabel} Ticket printed.`
                : print?.message
                    ? `Saved for ${tableName}.${queueLabel} ${print.message}`
                    : print?.skipped
                        ? `Saved for ${tableName}.${queueLabel} Kitchen printer not used.`
                        : `Sent to kitchen for ${tableName}.${queueLabel}`);
            await loadFloor();
        } catch (error: any) {
            setNotice(error.response?.data?.message ?? 'Unable to send the order to the kitchen.');
        } finally {
            setBusy(false);
        }
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
                await printReceipt(response.data);
                showPaidOnCustomerDisplay(Number(response.data.total ?? chargeTotal), response.data.table?.name ? `Table ${response.data.table.name}` : 'Table bill');
                const clearedTableId = response.data.table_id ?? billOrder.table_id;
                setBillOrder(null);
                if (clearedTableId && tableId === clearedTableId) {
                    setTableId('');
                }
                setDiscountInput('');
                setDiscountType('amount');
                setReceived('');
                setCheckoutOpen(false);
                setNotice(`Payment complete for ${response.data.table?.name ?? 'table'}. Table is free.`);
                await loadFloor();
                void refreshShift();
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
            await printReceipt(response.data);
            const ticketId = response.data.kitchen_ticket?.id;
            if (ticketId) {
                try {
                    await axios.post(`/api/kitchen-tickets/${ticketId}/print`);
                } catch {
                    // Kitchen print is optional when the printer is unavailable.
                }
            }
            showPaidOnCustomerDisplay(Number(response.data.total ?? chargeTotal), orderType === 'TAKEAWAY' ? 'Takeaway' : displayLabel);
            setCart([]);
            setDiscountInput('');
            setDiscountType('amount');
            setReceived('');
            setTableId('');
            setCustomerPhone('');
            setCheckoutOpen(false);
            setNotice('Order completed.');
            void refreshShift();
        } catch (error: any) {
            setNotice(error.response?.data?.message ?? 'Unable to complete order.');
        } finally {
            setBusy(false);
        }
    }

    return (
        <>
            <Head title="Vaavikkarai-POS" />
            <AppShell>
                <div className="flex h-full min-h-0 flex-col">
                    <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-3 py-2">
                        <div>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#d97745]">Point of sale</p>
                            <h1 className="text-base font-semibold leading-tight">Service counter</h1>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={openCustomerDisplay}
                                className="flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 hover:border-[#d97745] hover:text-[#b65b2e]"
                                title="Open the customer-facing screen"
                            >
                                <Monitor size={14} />
                                <span className="hidden sm:inline">Customer screen</span>
                            </button>
                            {isCashier ? (
                                <CashierShiftControl shift={shift} onShiftChange={setShift} onNotice={setNotice} />
                            ) : (
                                <div className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-600">
                                    LKR <ChevronDown size={12} className="ml-0.5 inline" />
                                </div>
                            )}
                        </div>
                    </header>
                    {isCashier && !shift && (
                        <div className="shrink-0 border-b border-amber-100 bg-amber-50 px-3 py-2 text-center text-xs font-medium text-amber-900">
                            Turn <strong>Shift</strong> on and enter opening cash in the box before taking payments.
                        </div>
                    )}
                    <div className="grid min-h-0 flex-1 gap-3 p-3 lg:grid-cols-[minmax(0,1fr)_340px] lg:grid-rows-[minmax(0,1fr)] lg:overflow-hidden">
                        <section className="flex h-full min-h-0 min-w-0 gap-3">
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
                                <span className="hidden shrink-0 text-[11px] text-slate-400 sm:inline">{visibleCount} items</span>
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
                                <MenuCatalog
                                    categories={categories}
                                    products={products}
                                    activeCategory={activeCategory}
                                    search={search}
                                    canAdd={canAddMenuItems}
                                    onAdd={addToCart}
                                    onBlocked={message => setNotice(message || 'Select a table before adding food.')}
                                />
                            </div>
                            </div>
                        </section>
                        <aside className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-100">
                            {floorOrders.filter((order: any) => order.status === 'OPEN' || order.status === 'READY' || order.status === 'BILLED').length > 0 && (
                                <div className="mb-2 max-h-16 shrink-0 space-y-1 overflow-y-auto">
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Server tables</p>
                                    {floorOrders.filter((order: any) => order.status !== 'COMPLETED').map((order: any) => (
                                        <button key={order.id} type="button" disabled={order.status === 'BILLED'} onClick={() => { setBillOrder(order); setNotice(''); }} className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs ${billOrder?.id === order.id ? 'bg-[#fff4ec] ring-1 ring-[#d97745]' : 'bg-slate-50'} disabled:opacity-70`}>
                                            <span className="font-semibold">{order.table?.name ?? 'Table'} · {order.status === 'BILLED' ? 'Billed' : order.status === 'READY' ? 'Ready' : 'Open'}</span>
                                            <span>{money(Number(order.total))}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                            <div className="flex shrink-0 items-center justify-between">
                                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">{billOrder ? `Bill ${billOrder.table?.name ?? 'table'}` : 'Current order'}</p>
                                <button onClick={() => { setCart([]); setBillOrder(null); }} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-500" title="Clear order"><Trash2 size={16} /></button>
                            </div>
                            <div className="mt-1.5 flex w-full shrink-0 gap-1 rounded-xl bg-slate-100 p-1">
                                <button type="button" onClick={() => { setOrderType('DINE_IN'); setCustomerPhone(''); }} className={`min-h-9 flex-1 rounded-lg text-sm font-semibold transition ${orderType === 'DINE_IN' ? 'bg-white text-[#102b2b] shadow-sm' : 'text-slate-500'}`}>Dine in</button>
                                <button type="button" onClick={() => { setOrderType('TAKEAWAY'); setTableId(''); }} className={`min-h-9 flex-1 rounded-lg text-sm font-semibold transition ${orderType === 'TAKEAWAY' ? 'bg-white text-[#102b2b] shadow-sm' : 'text-slate-500'}`}>Takeaway</button>
                            </div>
                            {orderType === 'DINE_IN' && (
                                <select value={tableId} onChange={e => { setTableId(e.target.value ? Number(e.target.value) : ''); setBillOrder(null); }} className="mt-1.5 min-h-9 w-full shrink-0 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800 outline-none focus:border-[#d97745]">
                                    <option value="">Select table</option>
                                    {tables.map(table => {
                                        const ticket = floorOrders.find((order: any) => order.table_id === table.id && ['OPEN', 'READY', 'BILLED'].includes(order.status));
                                        const state = ticket?.status === 'BILLED' ? 'bill pending' : ticket ? 'occupied' : '';
                                        return <option key={table.id} value={table.id}>{state ? `${table.name} · ${state}` : table.name}</option>;
                                    })}
                                </select>
                            )}
                            {orderType === 'TAKEAWAY' && (
                                <input type="tel" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="Customer phone" className="mt-1.5 min-h-9 w-full shrink-0 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-[#d97745]" autoComplete="tel" />
                            )}
                            <div className="mt-2 flex min-h-[8.5rem] flex-1 flex-col overflow-hidden rounded-xl bg-[#f6f7f5] ring-1 ring-slate-100">
                                <div className="flex shrink-0 items-center justify-between px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                                    <span>{kitchenMode ? 'Table items' : 'Added items'}</span>
                                    <span>{billOrder ? (billOrder.items?.length ?? 0) : cart.reduce((sum, item) => sum + item.quantity, 0)}</span>
                                </div>
                                <div className="min-h-0 flex-1 space-y-1 overflow-y-auto px-1.5 pb-1.5">
                                    {billOrder ? (
                                        (billOrder.items ?? []).length === 0 ? (
                                            <p className="px-2 py-4 text-center text-xs text-slate-400">No dishes on this table</p>
                                        ) : (billOrder.items ?? []).map((item: any) => (
                                            <div key={item.id} className="flex items-center gap-2 rounded-lg bg-white px-2.5 py-2 shadow-sm">
                                                <div className="min-w-0 flex-1">
                                                    <p className="truncate text-[13px] font-semibold leading-tight text-[#102b2b]">{item.product?.name ?? item.product_name ?? 'Item'}</p>
                                                    <p className="text-[11px] font-medium text-[#d97745]">{money(Number(item.line_total))}</p>
                                                </div>
                                                <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">×{item.quantity}</span>
                                            </div>
                                        ))
                                    ) : kitchenMode && activeTableOrder ? (
                                        <>
                                            {(activeTableOrder.items ?? []).map((item: any) => (
                                                <div key={`sent-${item.id}`} className="flex items-center gap-2 rounded-lg bg-white/80 px-2.5 py-1.5">
                                                    <div className="min-w-0 flex-1">
                                                        <p className="truncate text-[13px] font-semibold leading-tight text-[#102b2b]">{item.product?.name ?? item.product_name ?? 'Item'}</p>
                                                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Already sent</p>
                                                    </div>
                                                    <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">×{item.quantity}</span>
                                                </div>
                                            ))}
                                            {cart.map(item => (
                                                <div key={item.id} className="flex items-center gap-1.5 rounded-lg bg-white px-2 py-1.5 shadow-sm ring-1 ring-[#d97745]/30">
                                                    <div className="min-w-0 flex-1">
                                                        <p className="truncate text-[13px] font-semibold leading-tight text-[#102b2b]">{item.name}</p>
                                                        <p className="text-[10px] font-semibold uppercase tracking-wide text-[#d97745]">New</p>
                                                    </div>
                                                    <div className="flex shrink-0 items-center rounded-lg bg-slate-50 ring-1 ring-slate-200">
                                                        <button type="button" onClick={() => changeQuantity(item.id, -1)} className="flex h-8 w-8 items-center justify-center text-slate-600" aria-label={`Decrease ${item.name}`}><Minus size={14} /></button>
                                                        <span className="w-5 text-center text-sm font-bold">{item.quantity}</span>
                                                        <button type="button" onClick={() => changeQuantity(item.id, 1)} className="flex h-8 w-8 items-center justify-center text-slate-600" aria-label={`Increase ${item.name}`}><Plus size={14} /></button>
                                                    </div>
                                                    <button type="button" onClick={() => setCart(cart.filter(cartItem => cartItem.id !== item.id))} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500" aria-label={`Remove ${item.name}`}><X size={14} /></button>
                                                </div>
                                            ))}
                                        </>
                                    ) : cart.length === 0 ? (
                                        <div className="flex h-full min-h-16 flex-col items-center justify-center text-center">
                                            <ShoppingBag className="mb-1 text-slate-300" size={16} />
                                            <p className="text-xs text-slate-400">Tap a menu item to add it</p>
                                        </div>
                                    ) : cart.map(item => (
                                        <div key={item.id} className="flex items-center gap-1.5 rounded-lg bg-white px-2 py-1.5 shadow-sm">
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-[13px] font-semibold leading-tight text-[#102b2b]">{item.name}</p>
                                                <p className="text-[11px] font-medium text-[#d97745]">{money(Number(item.price) * item.quantity)}</p>
                                            </div>
                                            <div className="flex shrink-0 items-center rounded-lg bg-slate-50 ring-1 ring-slate-200">
                                                <button type="button" onClick={() => changeQuantity(item.id, -1)} className="flex h-8 w-8 items-center justify-center text-slate-600" aria-label={`Decrease ${item.name}`}><Minus size={14} /></button>
                                                <span className="w-5 text-center text-sm font-bold">{item.quantity}</span>
                                                <button type="button" onClick={() => changeQuantity(item.id, 1)} className="flex h-8 w-8 items-center justify-center text-slate-600" aria-label={`Increase ${item.name}`}><Plus size={14} /></button>
                                            </div>
                                            <button type="button" onClick={() => setCart(cart.filter(cartItem => cartItem.id !== item.id))} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500" aria-label={`Remove ${item.name}`}><X size={14} /></button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            {notice && <div className="mt-1.5 flex shrink-0 items-start gap-1.5 rounded-lg bg-[#fff4ec] px-2 py-1.5 text-[11px] font-medium text-[#a85329]"><Check size={13} className="mt-0.5 shrink-0" />{notice}</div>}
                            <div className="mt-1.5 shrink-0 space-y-1.5 border-t border-dashed border-slate-200 pt-1.5 text-xs">
                                <div className="flex justify-between text-slate-500"><span>{kitchenMode ? 'New items' : 'Subtotal'}</span><span>{money(kitchenMode ? cartSubtotal : subtotal)}</span></div>
                                {!kitchenMode && <div className="flex items-center justify-between gap-2 text-slate-500">
                                    <span>Discount</span>
                                    <div className="flex items-center gap-1">
                                        <div className="flex gap-0.5 rounded-lg bg-slate-100 p-0.5 text-xs font-bold">
                                            <button type="button" onClick={() => setDiscountType('amount')} className={`min-h-8 min-w-9 rounded-md px-2 ${discountType === 'amount' ? 'bg-white text-[#102b2b] shadow-sm' : 'text-slate-400'}`}>Rs.</button>
                                            <button type="button" onClick={() => setDiscountType('percent')} className={`min-h-8 min-w-9 rounded-md px-2 ${discountType === 'percent' ? 'bg-white text-[#102b2b] shadow-sm' : 'text-slate-400'}`}>%</button>
                                        </div>
                                        <input type="number" min="0" max={discountType === 'percent' ? 100 : undefined} step={discountType === 'percent' ? '0.01' : '1'} value={discountInput} onChange={e => setDiscountInput(e.target.value)} className="min-h-8 w-16 rounded-lg border border-slate-200 px-2 text-right text-sm outline-none focus:border-[#d97745]" placeholder="0" />
                                    </div>
                                </div>}
                                {!kitchenMode && discount > 0 && <p className="text-right text-[11px] text-slate-400">−{money(discount)}{discountType === 'percent' && discountInput ? ` (${discountInput}%)` : ''}</p>}
                                <div className="flex justify-between text-sm font-bold"><span>Total</span><span className="text-[#d97745]">{money(kitchenMode ? cartSubtotal : total)}</span></div>
                                {!kitchenMode && <div className="grid grid-cols-2 gap-1.5">
                                    {([['CASH', Banknote], ['CARD', CreditCard]] as const).map(([method, Icon]) => (
                                        <button key={method} onClick={() => setPaymentMethod(method)} className={`flex min-h-9 items-center justify-center gap-1 rounded-lg border text-[11px] font-bold transition ${paymentMethod === method ? 'border-[#d97745] bg-[#fff4ec] text-[#b65b2e]' : 'border-slate-200 text-slate-400 hover:bg-slate-50'}`}><Icon size={14} />{method}</button>
                                    ))}
                                </div>}
                                {!kitchenMode && paymentMethod === 'CASH' && <input type="number" min="0" value={received} onChange={e => setReceived(e.target.value)} placeholder={`Cash received (${total.toFixed(2)})`} className="min-h-9 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-[#d97745]" />}
                                {!kitchenMode && paymentMethod === 'CASH' && cashChange > 0 && <p className="text-[11px] font-medium text-[#2c7150]">Change: {money(cashChange)}</p>}
                                <button type="button" disabled={busy || !shift || billOrder?.status === 'BILLED' || activeTableOrder?.status === 'BILLED'} onClick={kitchenMode ? sendToKitchen : openCheckout} className="min-h-11 w-full rounded-xl bg-[#d97745] text-sm font-bold text-white shadow-md shadow-[#d97745]/20 transition hover:bg-[#bf6335] disabled:opacity-50">{busy ? 'Sending…' : !shift ? 'Open a shift to sell' : billOrder ? 'Create table bill' : kitchenMode ? (cart.length ? 'Send to kitchen' : activeTableOrder ? 'Bill this table' : 'Send to kitchen') : 'Charge & complete'}</button>
                            </div>
                        </aside>
                    </div>
                </div>
                <CheckoutPaymentModal open={checkoutOpen} method={paymentMethod} total={total} money={money} received={received} onReceivedChange={setReceived} busy={busy} itemCount={billOrder ? (billOrder.items?.length ?? 0) : cart.length} orderLabel={billOrder ? (billOrder.table?.name ?? 'Table bill') : (orderType === 'DINE_IN' ? 'Dine-in' : 'Takeaway')} onClose={() => setCheckoutOpen(false)} onConfirm={finalizeCheckout} />
            </AppShell>
        </>
    );
}