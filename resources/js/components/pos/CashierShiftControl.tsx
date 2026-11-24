import { FormEvent, useState } from 'react';
import axios from 'axios';
import { Banknote } from 'lucide-react';
import type { Shift } from '../../types';

const money = (value: number) => `Rs. ${value.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface Props {
    shift: Shift | null;
    onShiftChange: (shift: Shift | null) => void;
    onNotice?: (message: string) => void;
}

export default function CashierShiftControl({ shift, onShiftChange, onNotice }: Props) {
    const [openModal, setOpenModal] = useState(false);
    const [closeModal, setCloseModal] = useState(false);
    const [openingCash, setOpeningCash] = useState('');
    const [closingCash, setClosingCash] = useState('');
    const [busy, setBusy] = useState(false);

    const isOpen = shift?.status === 'OPEN';
    const drawerCash = Number(shift?.expected_cash_in_drawer ?? shift?.opening_cash ?? 0);

    async function submitOpen(event: FormEvent) {
        event.preventDefault();
        setBusy(true);
        try {
            const response = await axios.post<Shift>('/api/shift', { opening_cash: Number(openingCash) });
            onShiftChange(response.data);
            setOpeningCash('');
            setOpenModal(false);
            onNotice?.('Shift is on. Cash box float recorded.');
        } catch (error: any) {
            onNotice?.(error.response?.data?.message ?? 'Unable to open shift.');
        } finally {
            setBusy(false);
        }
    }

    async function submitClose(event: FormEvent) {
        event.preventDefault();
        if (!shift) {
            return;
        }
        setBusy(true);
        try {
            const payload = closingCash.trim() === '' ? {} : { closing_cash: Number(closingCash) };
            const response = await axios.post<Shift>(`/api/shift/${shift.id}/close`, payload);
            onShiftChange(null);
            setClosingCash('');
            setCloseModal(false);
            onNotice?.(
                response.data.closing_cash != null
                    ? `Shift closed. Cash box count: ${money(Number(response.data.closing_cash))}`
                    : 'Shift turned off. You can sign out safely.',
            );
        } catch (error: any) {
            onNotice?.(error.response?.data?.message ?? 'Unable to close shift.');
        } finally {
            setBusy(false);
        }
    }

    function onToggle() {
        if (isOpen) {
            setCloseModal(true);
            return;
        }
        setOpenModal(true);
    }

    return (
        <>
            <div className="flex flex-wrap items-center justify-end gap-2">
                {isOpen && (
                    <div className="flex items-center gap-1.5 rounded-xl bg-[#eff6ef] px-2.5 py-1.5 text-[11px] font-semibold text-[#2c7150]">
                        <Banknote size={14} className="shrink-0" />
                        <span>Cash in box {money(drawerCash)}</span>
                    </div>
                )}
                <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-2 py-1">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Shift</span>
                    <button
                        type="button"
                        role="switch"
                        aria-checked={isOpen}
                        onClick={onToggle}
                        className={`relative h-7 w-12 rounded-full transition ${isOpen ? 'bg-[#47a96f]' : 'bg-slate-300'}`}
                    >
                        <span
                            className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition ${isOpen ? 'left-[1.35rem]' : 'left-0.5'}`}
                        />
                    </button>
                    <span className={`min-w-[2.25rem] text-[11px] font-bold ${isOpen ? 'text-[#2c7150]' : 'text-amber-700'}`}>
                        {isOpen ? 'On' : 'Off'}
                    </span>
                </div>
            </div>

            {openModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#102b2b]/45 p-4">
                    <form onSubmit={submitOpen} className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#d97745]">Turn shift on</p>
                        <h2 className="mt-1 text-xl font-semibold">Cash in the box</h2>
                        <p className="mt-1 text-sm text-slate-500">Count the starting float in the drawer and enter it before you take sales.</p>
                        <label className="mt-4 block text-sm font-medium text-slate-600">
                            Opening cash (Rs.)
                            <input
                                required
                                min="0"
                                step="0.01"
                                autoFocus
                                type="number"
                                value={openingCash}
                                onChange={event => setOpeningCash(event.target.value)}
                                placeholder="0.00"
                                className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#d97745]"
                            />
                        </label>
                        <div className="mt-4 flex gap-2">
                            <button type="button" onClick={() => setOpenModal(false)} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600">
                                Cancel
                            </button>
                            <button type="submit" disabled={busy} className="flex-1 rounded-xl bg-[#102b2b] py-2.5 text-sm font-bold text-white disabled:opacity-50">
                                {busy ? 'Starting…' : 'Turn shift on'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {closeModal && shift && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#102b2b]/45 p-4">
                    <form onSubmit={submitClose} className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#d97745]">Turn shift off</p>
                        <h2 className="mt-1 text-xl font-semibold">Close shift</h2>
                        <p className="mt-1 text-sm text-slate-500">
                            Expected in drawer: <span className="font-semibold text-[#102b2b]">{money(drawerCash)}</span>
                        </p>
                        <label className="mt-4 block text-sm font-medium text-slate-600">
                            Actual cash counted (optional)
                            <input
                                min="0"
                                step="0.01"
                                type="number"
                                value={closingCash}
                                onChange={event => setClosingCash(event.target.value)}
                                placeholder="Leave blank to skip"
                                className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#d97745]"
                            />
                        </label>
                        <p className="mt-2 text-xs text-slate-400">Turn the shift off before signing out. Counting cash is optional but helps reconciliation.</p>
                        <div className="mt-4 flex gap-2">
                            <button type="button" onClick={() => setCloseModal(false)} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600">
                                Cancel
                            </button>
                            <button type="submit" disabled={busy} className="flex-1 rounded-xl bg-[#102b2b] py-2.5 text-sm font-bold text-white disabled:opacity-50">
                                {busy ? 'Closing…' : 'Turn shift off'}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </>
    );
}