import { FormEvent, useState } from 'react';
import { Head, useForm } from '@inertiajs/react';
import { Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, UserRound, UtensilsCrossed } from 'lucide-react';

type LoginRole = 'ADMIN' | 'CASHIER' | 'SERVER';

const ROLE_OPTIONS: { id: LoginRole; label: string; icon: typeof UserRound }[] = [
    { id: 'CASHIER', label: 'Cashier', icon: UserRound },
    { id: 'SERVER', label: 'Server', icon: UtensilsCrossed },
    { id: 'ADMIN', label: 'Admin', icon: ShieldCheck },
];

export default function Login() {
    const [role, setRole] = useState<LoginRole>('CASHIER');
    const [showPassword, setShowPassword] = useState(false);
    const { data, setData, post, processing, errors } = useForm({
        email: '',
        password: '',
        role,
    });

    function selectRole(next: LoginRole) {
        setRole(next);
        setData('role', next);
    }

    function submit(event: FormEvent) {
        event.preventDefault();
        post('/login');
    }

    return (
        <>
            <Head title="Sign in" />
            <div data-app-scroll className="flex min-h-dvh flex-col overflow-y-auto bg-[#102b2b] pb-8 text-[#102b2b] lg:grid lg:min-h-dvh lg:grid-cols-[1.05fr_0.95fr]">
                <section className="hidden flex-col justify-between bg-[#102b2b] p-12 text-white lg:flex">
                    <div className="flex flex-col items-start gap-3">
                        <img src="/images/vavikarai-logo.png" alt="வழிக்கரை" className="h-40 w-40 rounded-3xl bg-white object-contain p-1" />
                        <span className="text-3xl font-semibold tracking-[0.18em]">Vaavikkarai</span>
                    </div>
                    <div>
                        <p className="mb-4 max-w-md text-5xl font-semibold leading-[1.05] tracking-tight">
                            Every service,
                            <br />
                            <span className="text-[#e6a06c]">beautifully balanced.</span>
                        </p>
                        <p className="max-w-sm text-sm leading-6 text-white/55">
                            A calm, fast workspace for the people who keep your restaurant moving.
                        </p>
                    </div>
                    <p className="text-xs text-white/35">Sri Lanka · POS · AUROZE</p>
                </section>

                <section className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-[#f7f5ef] px-4 py-6 pt-safe pb-safe sm:px-6 sm:py-8 lg:items-center lg:justify-center">
                    <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center lg:flex-initial">
                        <header className="mb-5 text-center sm:mb-8 lg:mb-8">
                            <img src="/images/vavikarai-logo.png" alt="வழிக்கரை" className="mx-auto h-40 w-40 rounded-3xl bg-white object-contain p-1 shadow-sm sm:h-48 sm:w-48 lg:hidden" />
                            <h1 className="mt-3 text-3xl font-semibold tracking-[0.12em] sm:mt-4 sm:text-4xl lg:hidden">Vaavikkarai</h1>
                            <p className="mx-auto mt-2 max-w-xs text-xs leading-relaxed text-slate-500 lg:hidden">
                                Sign in on phone or tablet — same workspace as desktop.
                            </p>
                        </header>

                        <div className="rounded-2xl bg-white p-5 shadow-xl shadow-[#102b2b]/5 ring-1 ring-slate-100 sm:rounded-3xl sm:p-8 sm:ring-0 lg:p-10">
                            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#d97745] sm:text-sm sm:font-medium sm:normal-case sm:tracking-normal">
                                Welcome back
                            </p>
                            <h2 className="mt-1.5 text-2xl font-semibold tracking-tight sm:mt-2 sm:text-3xl">Sign in to your workspace</h2>
                            <p className="mt-1.5 text-sm text-slate-500">Choose the role attached to your account.</p>

                            <form onSubmit={submit} className="mt-6 space-y-4 sm:mt-8 sm:space-y-5">
                                <label className="block text-sm font-medium">
                                    Email
                                    <div className="relative mt-2">
                                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                        <input
                                            value={data.email}
                                            onChange={e => setData('email', e.target.value)}
                                            type="email"
                                            inputMode="email"
                                            autoComplete="username email"
                                            className="min-h-12 w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-3 text-base outline-none focus:border-[#d97745] sm:text-sm"
                                            placeholder="admin@restaurant.com"
                                        />
                                    </div>
                                    {errors.email ? <span className="mt-1 block text-xs text-red-600">{errors.email}</span> : null}
                                </label>

                                <label className="block text-sm font-medium">
                                    Password
                                    <div className="relative mt-2">
                                        <LockKeyhole className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                        <input
                                            value={data.password}
                                            onChange={e => setData('password', e.target.value)}
                                            type={showPassword ? 'text' : 'password'}
                                            autoComplete="current-password"
                                            className="min-h-12 w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-12 text-base outline-none focus:border-[#d97745] sm:text-sm"
                                            placeholder="••••••••"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(current => !current)}
                                            className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                                        >
                                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                        </button>
                                    </div>
                                    {errors.password ? <span className="mt-1 block text-xs text-red-600">{errors.password}</span> : null}
                                </label>

                                <div>
                                    <p className="mb-2 text-sm font-medium">Login as</p>
                                    <div className="grid grid-cols-3 gap-2 max-[380px]:grid-cols-1">
                                        {ROLE_OPTIONS.map(option => {
                                            const Icon = option.icon;
                                            const active = role === option.id;
                                            return (
                                                <button
                                                    key={option.id}
                                                    type="button"
                                                    onClick={() => selectRole(option.id)}
                                                    className={`flex min-h-12 items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-semibold transition active:scale-[0.98] ${
                                                        active
                                                            ? 'border-[#d97745] bg-[#fff4ec] text-[#b65b2e] shadow-sm'
                                                            : 'border-slate-200 bg-white text-slate-600'
                                                    }`}
                                                >
                                                    <Icon size={18} className="shrink-0" />
                                                    <span className="truncate">{option.label}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                    {errors.role ? <span className="mt-1 block text-xs text-red-600">{errors.role}</span> : null}
                                </div>

                                <button
                                    type="submit"
                                    disabled={processing}
                                    className="min-h-12 w-full rounded-xl bg-[#d97745] py-3.5 text-base font-semibold text-white shadow-lg shadow-[#d97745]/20 transition hover:bg-[#bf6335] active:scale-[0.99] disabled:opacity-60 sm:text-sm"
                                >
                                    {processing ? 'Signing in…' : 'Sign in'}
                                </button>
                            </form>

                            <p className="mt-5 text-center text-xs leading-relaxed text-slate-400 sm:mt-6">
                                Accounts for explore the workspace.
                            </p>
                        </div>
                    </div>
                </section>
            </div>
        </>
    );
}