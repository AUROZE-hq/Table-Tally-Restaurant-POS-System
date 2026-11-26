import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { CheckCircle2, X } from 'lucide-react';

type Tone = 'success' | 'error';

interface FeedbackApi {
    notify: (message: string, tone?: Tone) => void;
    confirm: (message: string) => Promise<boolean>;
}

const FeedbackContext = createContext<FeedbackApi | null>(null);

export function FeedbackProvider({ children }: { children: ReactNode }) {
    const [toast, setToast] = useState<{ message: string; tone: Tone } | null>(null);
    const [prompt, setPrompt] = useState<string | null>(null);
    const resolveRef = useRef<((value: boolean) => void) | null>(null);

    useEffect(() => {
        if (!toast) {
            return;
        }
        const timer = window.setTimeout(() => setToast(null), 3800);
        return () => window.clearTimeout(timer);
    }, [toast]);

    function notify(message: string, tone?: Tone) {
        const resolved = tone ?? (/unable|cannot|can't|failed|error|already exists|already in use/i.test(message) ? 'error' : 'success');
        setToast({ message, tone: resolved });
    }

    function confirm(message: string) {
        return new Promise<boolean>(resolve => {
            resolveRef.current = resolve;
            setPrompt(message);
        });
    }

    function settle(value: boolean) {
        resolveRef.current?.(value);
        resolveRef.current = null;
        setPrompt(null);
    }

    return (
        <FeedbackContext.Provider value={{ notify, confirm }}>
            {children}
            {toast && (
                <div className="pointer-events-none fixed inset-x-0 top-4 z-[80] flex justify-center px-4">
                    <div
                        className={`pointer-events-auto flex max-w-md items-start gap-3 rounded-2xl px-4 py-3 text-sm text-white shadow-xl ${
                            toast.tone === 'error' ? 'bg-red-600' : 'bg-[#102b2b]'
                        }`}
                        role="status"
                    >
                        <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
                        <p className="flex-1 leading-5">{toast.message}</p>
                        <button type="button" onClick={() => setToast(null)} className="rounded-lg p-1 text-white/80 hover:bg-white/10" aria-label="Dismiss">
                            <X size={16} />
                        </button>
                    </div>
                </div>
            )}
            {prompt && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#102b2b]/45 p-4" onClick={() => settle(false)}>
                    <div
                        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl"
                        role="dialog"
                        aria-modal="true"
                        onClick={event => event.stopPropagation()}
                    >
                        <p className="text-lg font-semibold text-[#102b2b]">Please confirm</p>
                        <p className="mt-2 text-sm leading-6 text-slate-600">{prompt}</p>
                        <div className="mt-5 flex gap-2">
                            <button type="button" onClick={() => settle(false)} className="flex-1 rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-600">
                                Cancel
                            </button>
                            <button type="button" onClick={() => settle(true)} className="flex-1 rounded-xl bg-red-600 py-3 text-sm font-semibold text-white hover:bg-red-700">
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </FeedbackContext.Provider>
    );
}

export function useFeedback() {
    const value = useContext(FeedbackContext);
    if (!value) {
        throw new Error('Feedback is only available inside the admin workspace.');
    }
    return value;
}
