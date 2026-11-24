import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Head } from '@inertiajs/react';
import { ArrowUpRight, Banknote, BarChart3, CreditCard, Loader2, ReceiptText } from 'lucide-react';
import AppShell from '../components/layout/AppShell';

type SalesRange = 'day' | 'week' | 'month';

interface RhythmPoint {
    label: string;
    sales: number;
    orders: number;
}

interface Props {
    metrics: {
        sales: number;
        orders: number;
        cash: number;
        card: number;
        expenses: { category: string; total: number }[];
    };
}

const money = (value: number) => `Rs. ${value.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const rangeOptions: { id: SalesRange; label: string }[] = [
    { id: 'day', label: 'Day' },
    { id: 'week', label: 'Week' },
    { id: 'month', label: 'Month' },
];

const CHART_BAR_AREA_PX = 192;

export default function Dashboard({ metrics }: Props) {
    const [salesRange, setSalesRange] = useState<SalesRange>('week');
    const [rhythmTitle, setRhythmTitle] = useState('This week · daily sales');
    const [rhythmPoints, setRhythmPoints] = useState<RhythmPoint[]>([]);
    const [rhythmLoading, setRhythmLoading] = useState(true);
    const [rhythmError, setRhythmError] = useState('');

    const cards = [
        { label: "Today's sales", value: money(metrics.sales), icon: BarChart3, tint: 'bg-[#fff0e5] text-[#c26435]' },
        { label: "Today's orders", value: metrics.orders.toString(), icon: ReceiptText, tint: 'bg-[#eaf4ef] text-[#32805b]' },
        { label: 'Cash sales', value: money(metrics.cash), icon: Banknote, tint: 'bg-[#eef1fb] text-[#5968a8]' },
        { label: 'Card sales', value: money(metrics.card), icon: CreditCard, tint: 'bg-[#f3edf8] text-[#8a5e9f]' },
    ];

    const maxSales = useMemo(() => Math.max(0, ...rhythmPoints.map(point => point.sales)), [rhythmPoints]);
    const rhythmTotal = useMemo(() => rhythmPoints.reduce((sum, point) => sum + point.sales, 0), [rhythmPoints]);
    const peakIndex = useMemo(() => {
        if (!rhythmPoints.length) {
            return -1;
        }

        let index = 0;
        rhythmPoints.forEach((point, i) => {
            if (point.sales > rhythmPoints[index].sales) {
                index = i;
            }
        });

        return rhythmPoints[index].sales > 0 ? index : -1;
    }, [rhythmPoints]);

    const paymentTotal = metrics.cash + metrics.card;
    const cashShare = paymentTotal > 0 ? (metrics.cash / paymentTotal) * 100 : 0;
    const cardShare = paymentTotal > 0 ? (metrics.card / paymentTotal) * 100 : 0;
    const cashOfSales = metrics.sales > 0 ? (metrics.cash / metrics.sales) * 100 : 0;
    const cardOfSales = metrics.sales > 0 ? (metrics.card / metrics.sales) * 100 : 0;

    const paymentMethods = [
        {
            label: 'Cash',
            value: metrics.cash,
            share: cashShare,
            ofSales: cashOfSales,
            barClass: 'bg-[#e6a06c]',
            icon: Banknote,
            iconBg: 'bg-[#e6a06c]/20 text-[#e6a06c]',
        },
        {
            label: 'Card',
            value: metrics.card,
            share: cardShare,
            ofSales: cardOfSales,
            barClass: 'bg-[#82a8b1]',
            icon: CreditCard,
            iconBg: 'bg-[#82a8b1]/25 text-[#a8d4de]',
        },
    ] as const;

    useEffect(() => {
        const controller = new AbortController();
        setRhythmLoading(true);
        setRhythmError('');

        axios
            .get<{ title: string; points: RhythmPoint[] }>(`/api/dashboard/sales-rhythm?range=${salesRange}`, {
                signal: controller.signal,
            })
            .then(response => {
                setRhythmTitle(response.data.title);
                setRhythmPoints(response.data.points ?? []);
            })
            .catch(error => {
                if (axios.isCancel(error)) {
                    return;
                }
                setRhythmPoints([]);
                setRhythmError('Unable to load sales rhythm.');
            })
            .finally(() => setRhythmLoading(false));

        return () => controller.abort();
    }, [salesRange]);

    return (
        <>
            <Head title="Dashboard" />
            <AppShell>
                <div className="min-h-screen">
                    <header className="border-b border-slate-200 bg-white px-5 py-5 lg:px-8">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#d97745]">Overview</p>
                        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Good morning, Sir</h1>
                        <p className="mt-1 text-sm text-slate-500">Here is today&apos;s service at a glance.</p>
                    </header>
                    <div className="space-y-6 p-5 lg:p-8">
                        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                            {cards.map(({ label, value, icon: Icon, tint }) => (
                                <div key={label} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
                                    <div className="flex items-start justify-between">
                                        <span className={`rounded-xl p-2.5 ${tint}`}>
                                            <Icon size={19} />
                                        </span>
                                        <ArrowUpRight size={17} className="text-slate-300" />
                                    </div>
                                    <p className="mt-6 text-sm text-slate-500">{label}</p>
                                    <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
                                </div>
                            ))}
                        </div>
                        <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Today&apos;s expenses</p>
                            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                {metrics.expenses.length ? (
                                    metrics.expenses.map(expense => (
                                        <div key={expense.category} className="rounded-xl bg-[#fff7f2] p-4">
                                            <p className="text-sm text-slate-500">{expense.category}</p>
                                            <p className="mt-1 text-xl font-semibold text-[#c26435]">{money(expense.total)}</p>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-sm text-slate-400">No expenses recorded today.</p>
                                )}
                            </div>
                        </section>
                        <div className="grid items-start gap-6 xl:grid-cols-[1.4fr_0.8fr]">
                            <section className="flex flex-col rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div>
                                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Sales rhythm</p>
                                        <h2 className="mt-1 text-lg font-semibold">{rhythmTitle}</h2>
                                        <p className="mt-1 text-sm text-slate-500">
                                            {rhythmLoading ? 'Loading…' : `Total ${money(rhythmTotal)} from billed & completed orders`}
                                        </p>
                                    </div>
                                    <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
                                        {rangeOptions.map(option => (
                                            <button
                                                key={option.id}
                                                type="button"
                                                onClick={() => setSalesRange(option.id)}
                                                className={`min-h-9 rounded-lg px-3 text-xs font-bold transition ${
                                                    salesRange === option.id
                                                        ? 'bg-white text-[#102b2b] shadow-sm'
                                                        : 'text-slate-500 hover:text-slate-700'
                                                }`}
                                            >
                                                {option.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {rhythmError && <p className="mt-4 text-sm text-red-600">{rhythmError}</p>}

                                <div className="relative mt-6 border-b border-l border-slate-100 px-2 pb-2 pt-2">
                                    {rhythmLoading && (
                                        <div className="flex h-56 items-center justify-center text-slate-400">
                                            <Loader2 className="animate-spin" size={22} />
                                        </div>
                                    )}
                                    {!rhythmLoading && rhythmPoints.length === 0 && (
                                        <p className="flex h-56 items-center justify-center text-sm text-slate-400">No sales in this period yet.</p>
                                    )}
                                    {!rhythmLoading && rhythmPoints.length > 0 && (
                                        <div
                                            className={`flex items-end gap-1 sm:gap-2 ${salesRange === 'month' ? 'overflow-x-auto' : ''}`}
                                            style={{ minHeight: CHART_BAR_AREA_PX + 28 }}
                                        >
                                            {rhythmPoints.map((point, index) => {
                                                const barHeightPx =
                                                    point.sales > 0 && maxSales > 0
                                                        ? Math.max(6, Math.round((point.sales / maxSales) * CHART_BAR_AREA_PX))
                                                        : 0;
                                                const isPeak = index === peakIndex;

                                                return (
                                                    <div
                                                        key={`${point.label}-${index}`}
                                                        className={`flex shrink-0 flex-col items-center ${salesRange === 'month' ? 'min-w-[1.35rem]' : 'flex-1'}`}
                                                        title={`${point.label}: ${money(point.sales)} · ${point.orders} order${point.orders === 1 ? '' : 's'}`}
                                                    >
                                                        <div
                                                            className="flex w-full max-w-10 items-end"
                                                            style={{ height: CHART_BAR_AREA_PX }}
                                                        >
                                                            <div
                                                                className={`w-full rounded-t-lg transition-all ${isPeak ? 'bg-[#d97745]' : point.sales > 0 ? 'bg-[#f3d5c2]' : 'bg-transparent'}`}
                                                                style={{ height: barHeightPx }}
                                                            />
                                                        </div>
                                                        <span className="mt-2 text-[10px] text-slate-400 sm:text-xs">{point.label}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </section>
                            <section className="flex flex-col rounded-2xl bg-gradient-to-b from-[#102b2b] to-[#0d2424] p-4 text-white shadow-sm ring-1 ring-[#1a3838] xl:p-5">
                                <div className="flex items-center justify-between gap-2">
                                    <div>
                                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45">Payment mix</p>
                                        <h2 className="text-base font-semibold">Today&apos;s collections</h2>
                                    </div>
                                    <span className="rounded-lg bg-white/10 p-2">
                                        <CreditCard className="text-[#e6a06c]" size={16} />
                                    </span>
                                </div>

                                <div className="mt-3 rounded-xl bg-white/5 px-3 py-2.5 ring-1 ring-white/10">
                                    <div className="flex items-baseline justify-between gap-2">
                                        <p className="text-[11px] text-white/50">Total received</p>
                                        <p className="text-xl font-bold tracking-tight">{money(paymentTotal)}</p>
                                    </div>
                                    <p className="mt-1 text-[11px] text-white/45">
                                        {metrics.orders} orders · sales {money(metrics.sales)}
                                    </p>
                                </div>

                                {paymentTotal > 0 ? (
                                    <>
                                        <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-white/10">
                                            <div
                                                className="h-full bg-[#e6a06c] transition-all"
                                                style={{ width: `${cashShare}%` }}
                                                title={`Cash ${cashShare.toFixed(0)}%`}
                                            />
                                            <div
                                                className="h-full bg-[#82a8b1] transition-all"
                                                style={{ width: `${cardShare}%` }}
                                                title={`Card ${cardShare.toFixed(0)}%`}
                                            />
                                        </div>
                                        <div className="mt-1 flex justify-between text-[10px] text-white/50">
                                            <span>Cash {cashShare.toFixed(0)}%</span>
                                            <span>Card {cardShare.toFixed(0)}%</span>
                                        </div>

                                        <div className="mt-3 space-y-2">
                                            {paymentMethods.map(method => {
                                                const Icon = method.icon;
                                                return (
                                                    <div
                                                        key={method.label}
                                                        className="flex items-center gap-2.5 rounded-lg bg-white/5 px-2.5 py-2 ring-1 ring-white/10"
                                                    >
                                                        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${method.iconBg}`}>
                                                            <Icon size={15} />
                                                        </span>
                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex items-center justify-between gap-2">
                                                                <span className="text-sm font-semibold">{method.label}</span>
                                                                <span className="text-sm font-bold">{money(method.value)}</span>
                                                            </div>
                                                            <p className="text-[10px] text-white/45">
                                                                {method.share.toFixed(0)}% of payments
                                                            </p>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </>
                                ) : (
                                    <div className="mt-3 rounded-xl border border-dashed border-white/15 bg-white/5 px-3 py-4 text-center">
                                        <Banknote className="mx-auto text-white/25" size={22} />
                                        <p className="mt-2 text-xs font-medium text-white/70">No payments yet today</p>
                                    </div>
                                )}
                            </section>
                        </div>
                    </div>
                </div>
            </AppShell>
        </>
    );
}