import { useEffect, useMemo, useState } from 'react';
import { LayoutGrid, Star } from 'lucide-react';
import type { Category, Product } from '../../types';

const STORAGE_KEY = 'pos-favorite-categories';

const SHORT_LABELS: Record<string, string> = {
    Breakfast: 'Breakfast',
    'Traditional Lunch': 'Lunch',
    'Pittu & Idiyappam Bar': 'Pittu bar',
    'Curries & Accompaniments': 'Curries',
    'Healthy Starters & Light Bites': 'Starters',
    'Aaniver Wellness Meals': 'Wellness',
    'Special Orders & Beverages': 'Specials',
};

const ACCENT: Record<string, string> = {
    Breakfast: 'bg-amber-100 text-amber-900 ring-amber-200',
    'Traditional Lunch': 'bg-emerald-100 text-emerald-900 ring-emerald-200',
    'Pittu & Idiyappam Bar': 'bg-orange-100 text-orange-900 ring-orange-200',
    'Curries & Accompaniments': 'bg-rose-100 text-rose-900 ring-rose-200',
    'Healthy Starters & Light Bites': 'bg-lime-100 text-lime-900 ring-lime-200',
    'Aaniver Wellness Meals': 'bg-teal-100 text-teal-900 ring-teal-200',
    'Special Orders & Beverages': 'bg-sky-100 text-sky-900 ring-sky-200',
};

function shortLabel(name: string) {
    return SHORT_LABELS[name] ?? (name.length > 16 ? `${name.slice(0, 14)}…` : name);
}

function initials(name: string) {
    const label = shortLabel(name);
    const words = label.split(/\s+/).filter(Boolean);
    if (words.length >= 2) {
        return (words[0][0] + words[1][0]).toUpperCase();
    }

    return label.slice(0, 2).toUpperCase();
}

function timeSuggestedNames(hour: number): string[] {
    if (hour < 11) {
        return ['Breakfast', 'Special Orders & Beverages'];
    }
    if (hour < 15) {
        return ['Traditional Lunch', 'Aaniver Wellness Meals', 'Healthy Starters & Light Bites', 'Curries & Accompaniments'];
    }

    return ['Pittu & Idiyappam Bar', 'Traditional Lunch', 'Special Orders & Beverages'];
}

function useFavoriteCategoryIds() {
    const [ids, setIds] = useState<number[]>([]);

    useEffect(() => {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                setIds(JSON.parse(raw));
            }
        } catch {
            setIds([]);
        }
    }, []);

    function toggle(id: number) {
        setIds(current => {
            const next = current.includes(id) ? current.filter(x => x !== id) : [...current, id].slice(0, 8);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
            return next;
        });
    }

    return { favoriteIds: ids, toggleFavorite: toggle };
}

interface Props {
    categories: Category[];
    products: Product[];
    activeCategory: number | null;
    onSelect: (categoryId: number | null) => void;
    variant: 'sidebar' | 'mobile';
}

export default function PosCategoryNav({ categories, products, activeCategory, onSelect, variant }: Props) {
    const { favoriteIds, toggleFavorite } = useFavoriteCategoryIds();
    const [showAll, setShowAll] = useState(false);

    const counts = useMemo(() => {
        const map = new Map<number, number>();
        for (const category of categories) {
            const childIds = new Set((category.children ?? []).map(child => child.id));
            map.set(
                category.id,
                products.filter(product => product.category_id === category.id || childIds.has(product.category_id) || product.category?.parent_id === category.id).length,
            );
        }

        return map;
    }, [categories, products]);

    const suggested = useMemo(() => {
        const names = timeSuggestedNames(new Date().getHours());
        return categories.filter(c => names.includes(c.name));
    }, [categories]);

    const favorites = useMemo(
        () => categories.filter(c => favoriteIds.includes(c.id)),
        [categories, favoriteIds],
    );

    const quickTiles = useMemo(() => {
        const seen = new Set<number>();
        const list: Category[] = [];
        for (const c of [...favorites, ...suggested, ...categories]) {
            if (!seen.has(c.id)) {
                seen.add(c.id);
                list.push(c);
            }
            if (list.length >= 8) {
                break;
            }
        }

        return list;
    }, [categories, favorites, suggested]);

    function renderCategoryButton(category: Category, compact = false) {
        const selected = activeCategory === category.id;
        const accent = ACCENT[category.name] ?? 'bg-white text-slate-700 ring-slate-200';
        const isFavorite = favoriteIds.includes(category.id);

        return (
            <div key={category.id} className="relative">
                <button
                    type="button"
                    onClick={() => onSelect(category.id)}
                    className={`w-full text-left transition active:scale-[0.98] ${
                        compact
                            ? `flex min-h-[4.25rem] flex-col justify-between rounded-xl border px-3 py-2.5 ring-1 ${selected ? 'border-[#d97745] bg-[#fff4ec] ring-[#d97745]' : `border-transparent ${accent}`}`
                            : `flex items-center gap-2 rounded-xl py-2.5 pl-3 pr-9 text-sm font-semibold ${selected ? 'bg-[#102b2b] text-white' : 'text-slate-600 hover:bg-slate-100'}`
                    }`}
                >
                    {compact ? (
                        <>
                            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/80 text-xs font-bold text-[#102b2b] shadow-sm">
                                {initials(category.name)}
                            </span>
                            <span className="line-clamp-2 text-[11px] font-bold leading-tight">{shortLabel(category.name)}</span>
                            <span className="text-[10px] font-medium opacity-70">{counts.get(category.id) ?? 0} items</span>
                        </>
                    ) : (
                        <>
                            <span className="min-w-0 flex-1 truncate">{shortLabel(category.name)}</span>
                            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${selected ? 'bg-white/15' : 'bg-slate-100 text-slate-500'}`}>
                                {counts.get(category.id) ?? 0}
                            </span>
                        </>
                    )}
                </button>
                {!compact && (
                    <button
                        type="button"
                        onClick={event => {
                            event.stopPropagation();
                            toggleFavorite(category.id);
                        }}
                        className={`absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-lg ${isFavorite ? 'text-amber-500' : 'text-slate-300 hover:text-amber-400'}`}
                        aria-label={isFavorite ? 'Remove from quick access' : 'Pin to quick access'}
                    >
                        <Star size={14} fill={isFavorite ? 'currentColor' : 'none'} />
                    </button>
                )}
            </div>
        );
    }

    if (variant === 'sidebar') {
        return (
            <nav className="flex w-[11.5rem] shrink-0 flex-col gap-1 overflow-y-auto rounded-2xl bg-white p-2 shadow-sm ring-1 ring-slate-100">
                <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Menu</p>
                <button
                    type="button"
                    onClick={() => onSelect(null)}
                    className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold ${activeCategory === null ? 'bg-[#d97745] text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                >
                    <LayoutGrid size={16} />
                    All items
                    <span className="ml-auto text-[10px] font-bold opacity-80">{products.length}</span>
                </button>
                {categories.map(category => renderCategoryButton(category))}
            </nav>
        );
    }

    return (
        <div className="mb-2 space-y-2">
            <div className="flex items-center justify-between gap-2 px-0.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Quick categories</p>
                <button
                    type="button"
                    onClick={() => onSelect(null)}
                    className={`rounded-full px-3 py-1 text-[11px] font-bold ${activeCategory === null ? 'bg-[#d97745] text-white' : 'bg-slate-100 text-slate-600'}`}
                >
                    All
                </button>
            </div>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-4">
                {quickTiles.map(category => renderCategoryButton(category, true))}
            </div>
            <button
                type="button"
                onClick={() => setShowAll(value => !value)}
                className="flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 text-xs font-semibold text-slate-600"
            >
                <LayoutGrid size={14} />
                {showAll ? 'Hide full category list' : `Browse all ${categories.length} categories`}
            </button>
            {showAll && (
                <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-2 sm:grid-cols-3">
                    {categories.map(category => (
                        <button
                            key={category.id}
                            type="button"
                            onClick={() => {
                                onSelect(category.id);
                                setShowAll(false);
                            }}
                            className={`min-h-11 rounded-lg px-2 py-2 text-left text-xs font-semibold ${
                                activeCategory === category.id ? 'bg-[#102b2b] text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200'
                            }`}
                        >
                            <span className="line-clamp-2">{shortLabel(category.name)}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}