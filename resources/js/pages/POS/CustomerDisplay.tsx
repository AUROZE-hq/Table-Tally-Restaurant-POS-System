import { useEffect, useRef, useState } from 'react';
import { Head } from '@inertiajs/react';
import {
    CUSTOMER_DISPLAY_CHANNEL,
    CUSTOMER_DISPLAY_STORAGE_KEY,
    type CustomerDisplaySnapshot,
    emptyCustomerDisplay,
    readCustomerDisplay,
} from '../../lib/customerDisplay';

const money = (value: number) =>
    `Rs. ${Number(value || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function CustomerDisplay() {
    const [bill, setBill] = useState<CustomerDisplaySnapshot>(emptyCustomerDisplay);
    const [showingThanks, setShowingThanks] = useState(false);
    const latest = useRef<CustomerDisplaySnapshot>(emptyCustomerDisplay());
    const thanksUntil = useRef(0);

    useEffect(() => {
        function apply(next: CustomerDisplaySnapshot) {
            if (!next || !Array.isArray(next.items)) {
                return;
            }
            latest.current = next;
            if (next.status === 'paid') {
                thanksUntil.current = Date.now() + 4000;
                setShowingThanks(true);
                setBill(next);
                return;
            }
            if (Date.now() < thanksUntil.current) {
                return;
            }
            setShowingThanks(false);
            setBill(next);
        }

        apply(readCustomerDisplay());

        let channel: BroadcastChannel | null = null;
        try {
            channel = new BroadcastChannel(CUSTOMER_DISPLAY_CHANNEL);
            channel.onmessage = (event: MessageEvent<CustomerDisplaySnapshot>) => apply(event.data);
        } catch {
            channel = null;
        }

        const onStorage = (event: StorageEvent) => {
            if (event.key !== CUSTOMER_DISPLAY_STORAGE_KEY || !event.newValue) {
                return;
            }
            try {
                apply(JSON.parse(event.newValue) as CustomerDisplaySnapshot);
            } catch {
                // ignore malformed snapshots
            }
        };
        window.addEventListener('storage', onStorage);

        const clock = window.setInterval(() => {
            if (thanksUntil.current && Date.now() >= thanksUntil.current) {
                thanksUntil.current = 0;
                setShowingThanks(false);
                setBill(latest.current);
            }
        }, 400);

        return () => {
            channel?.close();
            window.removeEventListener('storage', onStorage);
            window.clearInterval(clock);
        };
    }, []);
    const hasItems = bill.items.length > 0 && !showingThanks;

    return (
        <>
            <Head title="Customer display" />
            <div className="flex min-h-dvh flex-col bg-[#102b2b] text-white">
                <header className="flex items-center gap-3 border-b border-white/10 px-6 py-4 pt-safe">
                    <img src="/images/vavikarai-logo.png" alt="வழிக்கரை" className="h-24 w-24 rounded-2xl object-contain sm:h-28 sm:w-28" />
                    <div>
                        <p className="text-sm font-semibold tracking-[0.18em]">VAVIKKARAI</p>
                        <p className="text-xs text-white/55">{showingThanks ? 'Payment received' : bill.label || 'Welcome'}</p>
                    </div>
                </header>

                {showingThanks ? (
                    <main className="flex flex-1 flex-col items-center justify-center px-6 text-center">
                        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#e6a06c]">Thank you</p>
                        <p className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">Paid</p>
                        <p className="mt-4 text-3xl font-semibold text-white">{money(bill.total)}</p>
                        <p className="mt-3 max-w-sm text-sm text-white/55">Please collect your receipt from the cashier.</p>
                    </main>
                ) : hasItems ? (
                    <main className="flex min-h-0 flex-1 flex-col">
                        <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto px-5 py-4">
                            {bill.items.map((item, index) => (
                                <li
                                    key={`${item.name}-${index}`}
                                    className="flex items-center justify-between gap-4 rounded-2xl bg-white/5 px-4 py-3"
                                >
                                    <div className="min-w-0">
                                        <p className="truncate text-lg font-semibold">{item.name}</p>
                                        <p className="text-sm text-white/50">Qty {item.quantity}</p>
                                    </div>
                                    <p className="shrink-0 text-lg font-semibold text-[#e6a06c]">{money(item.lineTotal)}</p>
                                </li>
                            ))}
                        </ul>
                        <footer className="border-t border-white/10 px-6 py-5 pb-safe">
                            <div className="flex items-center justify-between text-sm text-white/60">
                                <span>Subtotal</span>
                                <span>{money(bill.subtotal)}</span>
                            </div>
                            {bill.discount > 0 ? (
                                <div className="mt-1 flex items-center justify-between text-sm text-white/60">
                                    <span>Discount</span>
                                    <span>- {money(bill.discount)}</span>
                                </div>
                            ) : null}
                            <div className="mt-3 flex items-end justify-between">
                                <span className="text-sm font-semibold uppercase tracking-[0.16em] text-white/50">Total</span>
                                <span className="text-4xl font-semibold tracking-tight text-[#e6a06c]">{money(bill.total)}</span>
                            </div>
                        </footer>
                    </main>
                ) : (
                    <main className="flex flex-1 flex-col items-center justify-center px-6 text-center">
                        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#e6a06c]">Welcome</p>
                        <p className="mt-3 max-w-md text-3xl font-semibold tracking-tight sm:text-4xl">Your order will appear here</p>
                        <p className="mt-3 text-sm text-white/50">Items added at the counter show on this screen.</p>
                    </main>
                )}
            </div>
        </>
    );
}
