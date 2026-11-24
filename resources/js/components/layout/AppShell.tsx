import { Link, router, usePage } from '@inertiajs/react';
import { BarChart3, ChefHat, CircleUserRound, History, LayoutDashboard, LogOut, Package, ReceiptText, ShoppingBasket, Table2, Users, UtensilsCrossed } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import type { User } from '../../types';

interface PageProps {
    children: ReactNode;
}

export default function AppShell({ children }: PageProps) {
    const { auth } = usePage<{ auth: { user: User } }>().props;
    const role = auth.user?.role;
    const isServer = role === 'SERVER';
    const [signingOut, setSigningOut] = useState(false);

    function signOut() {
        if (signingOut) {
            return;
        }

        setSigningOut(true);
        router.post('/logout', {}, {
            onFinish: () => setSigningOut(false),
        });
    }
    const navigation = role === 'ADMIN'
        ? [
            { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
            { label: 'POS', href: '/pos', icon: ShoppingBasket },
            { label: 'Categories', href: '/admin/categories', icon: Package },
            { label: 'Products', href: '/admin/products', icon: Package },
            { label: 'Tables', href: '/admin/tables', icon: Table2 },
            { label: 'Orders', href: '/admin/orders', icon: ReceiptText },
            { label: 'Expenses', href: '/admin/expenses', icon: ReceiptText },
            { label: 'Reports', href: '/admin/reports', icon: BarChart3 },
            { label: 'Users', href: '/admin/users', icon: Users },
        ]
        : isServer
        ? [
            { label: 'Floor', href: '/server', icon: UtensilsCrossed },
            { label: 'History', href: '/server?view=history', icon: History },
        ]
        : [
            { label: 'POS', href: '/pos', icon: ShoppingBasket },
            { label: 'Tables', href: '/cashier/tables', icon: Table2 },
            { label: 'Orders', href: '/cashier/orders', icon: ReceiptText },
            { label: 'Billing', href: '/cashier/billing', icon: ReceiptText },
            { label: 'Payments', href: '/cashier/payments', icon: ReceiptText },
            { label: 'Shift', href: '/cashier/shift', icon: BarChart3 },
            { label: 'Receipts', href: '/cashier/receipts', icon: ReceiptText },
            { label: 'Customers', href: '/cashier/customers', icon: Users },
        ];

    const aside = (
        <aside className="flex w-full shrink-0 flex-col bg-[#102b2b] px-3 py-2.5 text-white lg:h-dvh lg:w-[188px] lg:px-3 lg:py-3">
            <div className="flex items-center gap-2.5 border-b border-white/10 pb-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#d97745]"><ChefHat size={16} /></div>
                <div className="min-w-0"><p className="truncate text-[13px] font-semibold tracking-wide">AUROZE POS</p><p className="text-[10px] text-white/50">Restaurant POS</p></div>
            </div>
            <nav className="mt-2 grid grid-cols-2 gap-2 lg:mt-3 lg:block lg:space-y-1.5 lg:overflow-y-auto">
                {navigation.map(({ label, href, icon: Icon }) => <Link key={label} href={href} className="flex min-h-11 items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] text-white/70 transition duration-150 hover:bg-white/10 hover:text-white"><Icon size={16} className="shrink-0" /><span className="truncate">{label}</span></Link>)}
            </nav>
            <div className="mt-auto hidden border-t border-white/10 pt-3 lg:block"><div className="mb-2 flex items-center gap-2"><CircleUserRound size={16} className="shrink-0 text-[#e6a06c]" /><div className="min-w-0"><p className="truncate text-xs">{auth.user?.name}</p><p className="text-[10px] text-white/45">{auth.user?.role}</p></div></div><button type="button" disabled={signingOut} onClick={signOut} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-white/55 transition hover:bg-white/10 hover:text-white disabled:opacity-50"><LogOut size={14} />{signingOut ? 'Signing out…' : 'Sign out'}</button></div>
        </aside>
    );

    if (isServer) {
        return (
            <div className="flex h-dvh flex-col overflow-hidden bg-[#f5f7f8]">
                <header className="flex shrink-0 items-center justify-between gap-2 border-b border-white/10 bg-[#102b2b] px-3 py-2.5 text-white pt-safe lg:hidden">
                    <div className="flex min-w-0 items-center gap-2">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#d97745]"><UtensilsCrossed size={18} /></div>
                        <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">{auth.user?.name}</p>
                            <p className="text-[10px] text-white/50">Server · floor orders</p>
                        </div>
                    </div>
                    <button type="button" disabled={signingOut} onClick={signOut} className="flex min-h-11 min-w-11 items-center justify-center rounded-xl bg-white/10 text-white disabled:opacity-50" aria-label={signingOut ? 'Signing out' : 'Sign out'}>
                        <LogOut size={18} />
                    </button>
                </header>
                <div className="hidden min-h-0 flex-1 lg:flex">
                    {aside}
                    <main className="h-full min-h-0 min-w-0 flex-1 overflow-y-auto">{children}</main>
                </div>
                <main className="min-h-0 flex-1 overflow-hidden lg:hidden">{children}</main>
            </div>
        );
    }

    return (
        <div className="h-dvh overflow-hidden bg-[#f5f7f8] lg:flex">
            {aside}
            <main className="h-full min-h-0 min-w-0 flex-1 overflow-y-auto">{children}</main>
        </div>
    );
}