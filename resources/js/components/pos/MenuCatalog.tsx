import { useMemo } from 'react';
import { Plus } from 'lucide-react';
import { canOrderProduct, menuPriceText } from '../../lib/menuPrice';
import type { Category, Product } from '../../types';

interface Props {
    categories: Category[];
    products: Product[];
    activeCategory: number | null;
    search: string;
    canAdd?: boolean;
    flashingId?: number | null;
    onAdd: (product: Product) => void;
    onBlocked?: (message: string) => void;
}

interface Group {
    id: number;
    title: string;
    description: string | null;
    sort: number;
    products: Product[];
}

function groupsFor(products: Product[], activeCategory: number | null, search: string): Group[] {
    const query = search.trim().toLowerCase();
    const matched = products.filter(product => {
        const haystack = `${product.name} ${product.description ?? ''}`.toLowerCase();
        if (query && !haystack.includes(query)) {
            return false;
        }
        if (activeCategory == null) {
            return true;
        }

        return product.category_id === activeCategory || product.category?.parent_id === activeCategory;
    });

    const groups = new Map<number, Group>();
    for (const product of [...matched].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))) {
        const category = product.category;
        const id = category?.id ?? 0;
        if (!groups.has(id)) {
            const parentName = category?.parent?.name;
            const title = activeCategory == null && parentName ? `${parentName} · ${category?.name ?? 'Menu'}` : (category?.name ?? 'Menu');
            groups.set(id, {
                id,
                title,
                description: category?.description ?? null,
                sort: category?.sort_order ?? 0,
                products: [],
            });
        }
        groups.get(id)?.products.push(product);
    }

    return [...groups.values()].sort((a, b) => a.sort - b.sort);
}

export default function MenuCatalog({ categories, products, activeCategory, search, canAdd = true, flashingId = null, onAdd, onBlocked }: Props) {
    const groups = useMemo(
        () => groupsFor(products, activeCategory, search),
        [products, activeCategory, search],
    );
    const activeName = categories.find(category => category.id === activeCategory)?.name;

    if (groups.length === 0) {
        return <p className="px-1 py-8 text-center text-sm text-slate-400">No dishes in this section.</p>;
    }

    return (
        <div className="space-y-5">
            {groups.map(group => {
                const hideTitle = activeCategory != null && groups.length === 1 && group.title === activeName && !group.description;

                return (
                    <section key={group.id}>
                        {!hideTitle && (
                            <div className="mb-2">
                                <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{group.title}</h3>
                                {group.description && <p className="mt-1 text-xs leading-5 text-slate-500">{group.description}</p>}
                            </div>
                        )}
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
                            {group.products.map(product => {
                                const orderable = canOrderProduct(product);
                                const className = `min-h-[4.25rem] rounded-xl border border-slate-200 bg-white px-3 py-3 text-left shadow-sm ${
                                    flashingId === product.id ? 'ring-2 ring-[#d97745] bg-[#fff8f3]' : ''
                                } ${orderable ? 'transition hover:border-[#d97745] hover:shadow-md active:scale-[0.98]' : ''}`;
                                const body = (
                                    <span className="flex items-start justify-between gap-2">
                                        <span className="min-w-0">
                                            <span className="block text-[13px] font-semibold leading-snug text-slate-800">{product.name}</span>
                                            {product.description && <span className="mt-1 block text-[11px] leading-4 text-slate-500">{product.description}</span>}
                                            <span className={`mt-1 block text-xs font-medium ${orderable ? 'text-[#d97745]' : 'text-slate-500'}`}>{menuPriceText(product)}</span>
                                        </span>
                                        {orderable && <Plus size={14} className="mt-0.5 shrink-0 text-slate-300" />}
                                    </span>
                                );

                                if (!orderable) {
                                    return (
                                        <div key={product.id} className={className}>
                                            {body}
                                        </div>
                                    );
                                }

                                return (
                                    <button
                                        key={product.id}
                                        type="button"
                                        disabled={!canAdd}
                                        onClick={() => {
                                            if (!canAdd) {
                                                onBlocked?.('Select a table before adding food.');
                                                return;
                                            }
                                            onAdd(product);
                                        }}
                                        className={`${className} disabled:opacity-50`}
                                    >
                                        {body}
                                    </button>
                                );
                            })}
                        </div>
                    </section>
                );
            })}
            <div className="rounded-xl bg-[#102b2b] px-4 py-3 text-white">
                <p className="text-sm font-semibold">Vaavikkarai Restaurant</p>
                <p className="text-xs text-white/70">34/4, Kannakai amman Road, Poombukar, Batticaloa</p>
                <p className="mt-1 text-xs font-semibold tracking-wide text-[#e6a06c]">You Are What You Eat</p>
                <p className="mt-2 text-[11px] leading-5 text-white/75">
                    100% Vegetarian • Egg Available • Naturally Coloured Foods • No Preservatives • No MSG • Prepared with cold-pressed coconut oil
                </p>
                <p className="mt-2 text-[11px] leading-5 text-white/60">Thank you for choosing traditional food and mindful eating. YOU ARE WHAT YOU EAT</p>
            </div>
        </div>
    );
}
