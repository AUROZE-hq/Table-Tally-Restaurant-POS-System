import { FormEvent } from 'react';
import { Banknote, CreditCard, QrCode, X } from 'lucide-react';

type PaymentMethod = 'CASH' | 'CARD' | 'LANKAQR';

interface Props {
    open: boolean;
    method: PaymentMethod;
    total: number;
    money: (value: number) => string;
    received: string;
    onReceivedChange: (value: string) => void;
    busy: boolean;
    itemCount: number;
    orderLabel: string;
    onClose: () => void;
    onConfirm: () => void;
}

const methodMeta: Record<PaymentMethod, { title: string; Icon: typeof Banknote }> = {
    CASH: { title: 'Cash payment', Icon: Banknote },
    CARD: { title: 'Card payment', Icon: CreditCard },
    LANKAQR: { title: 'LankaQR payment', Icon: QrCode },
};

export default function CheckoutPaymentModal({
    open,
    method,
    total,
    money,
    received,
    onReceivedChange,
    busy,
    itemCount,
    orderLabel,
    onClose,
    onConfirm,
}: Props) {
    if (!open) {
        return null;
    }

    const { title, Icon } = methodMeta[method];
    const receivedAmount = received === '' ? 0 : Number(received);
    const change = method === 'CASH' ? Math.max(0, receivedAmount - total) : 0;
    const cashValid = method !== 'CASH' || (received !== '' && receivedAmount >= total);

    function handleSubmit(event: FormEvent) {
        event.preventDefault();
        if (!cashValid || busy) {
            return;
        }
        onConfirm();
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#102b2b]/50 p-4">
            <form
                onSubmit={handleSubmit}
                className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"
            >
                <button
                    type="button"
                    onClick={onClose}
                    className="absolute right-4 top-4 rounded-lg p-2 text-slate-400 hover:bg-slate-100"
                    aria-label="Close"
                >
                    <X size={18} />
                </button>
                <div className="flex items-center gap-3">
                    <span className="rounded-xl bg-[#fff0e5] p-2.5 text-[#c26435]">
                        <Icon size={22} />
                    </span>
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#d97745]">{orderLabel}</p>
                        <h2 className="text-xl font-semibold">{title}</h2>
                    </div>
                </div>
                <p className="mt-2 text-sm text-slate-500">
                    {itemCount} item{itemCount === 1 ? '' : 's'} · Amount due {money(total)}
                </p>

                {method === 'CASH' && (
                    <div className="mt-6 space-y-3">
                        <label className="block text-sm font-medium text-slate-600">
                            Cash received
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                autoFocus
                                value={received}
                                onChange={(e) => onReceivedChange(e.target.value)}
                                placeholder={total.toFixed(2)}
                                className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-[#d97745]"
                            />
                        </label>
                        {received !== '' && receivedAmount < total && (
                            <p className="text-xs font-medium text-red-600">
                                Need at least {money(total)} — short {money(total - receivedAmount)}
                            </p>
                        )}
                        {cashValid && (
                            <div className="rounded-xl bg-[#eff6ef] px-4 py-3 text-sm">
                                <div className="flex justify-between text-slate-600">
                                    <span>Change to give</span>
                                    <span className="font-bold text-[#2c7150]">{money(change)}</span>
                                </div>
                            </div>
                        )}
                        <p className="text-xs text-slate-400">Collect cash, then confirm to print the receipt.</p>
                    </div>
                )}

                {method === 'CARD' && (
                    <div className="mt-6 space-y-4">
                        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center">
                            <CreditCard className="mx-auto text-[#d97745]" size={36} />
                            <p className="mt-3 text-sm font-semibold text-slate-700">Process on card terminal</p>
                            <p className="mt-1 text-sm text-slate-500">
                                Charge <span className="font-bold text-[#d97745]">{money(total)}</span> on the EFT/card machine.
                            </p>
                        </div>
                        <ol className="list-decimal space-y-1 pl-5 text-xs text-slate-500">
                            <li>Enter amount on terminal</li>
                            <li>Customer taps, inserts, or swipes card</li>
                            <li>Wait for approved message</li>
                        </ol>
                    </div>
                )}

                {method === 'LANKAQR' && (
                    <div className="mt-6 space-y-4">
                        <div className="flex flex-col items-center rounded-2xl border border-slate-200 bg-white p-6">
                            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Scan to pay</p>
                            <div className="flex h-40 w-40 items-center justify-center rounded-xl bg-slate-900 text-white">
                                <QrCode size={100} strokeWidth={1.25} />
                            </div>
                            <p className="mt-4 text-lg font-bold text-[#d97745]">{money(total)}</p>
                            <p className="mt-1 text-center text-xs text-slate-500">
                                Ask the customer to scan with their bank app (LankaQR).
                            </p>
                        </div>
                    </div>
                )}

                <div className="mt-6 flex gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="min-h-12 flex-1 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                    >
                        Back
                    </button>
                    <button
                        type="submit"
                        disabled={busy || !cashValid}
                        className="min-h-12 flex-1 rounded-xl bg-[#d97745] text-sm font-bold text-white shadow-lg shadow-[#d97745]/20 hover:bg-[#bf6335] disabled:opacity-50"
                    >
                        {busy
                            ? 'Saving…'
                            : method === 'CASH'
                              ? 'Confirm & print'
                              : method === 'CARD'
                                ? 'Payment approved'
                                : 'Payment received'}
                    </button>
                </div>
            </form>
        </div>
    );
}