import type { Product } from '../types';

export function canOrderProduct(product: Pick<Product, 'price' | 'is_orderable'>): boolean {
    const amount = product.price === null || product.price === undefined || product.price === '' ? null : Number(product.price);

    return product.is_orderable !== false && amount !== null && Number.isFinite(amount) && amount > 0;
}

export function menuPriceText(product: Pick<Product, 'price' | 'price_label' | 'is_orderable'>): string {
    const amount = product.price === null || product.price === undefined || product.price === '' ? null : Number(product.price);

    if (amount !== null && Number.isFinite(amount) && amount > 0) {
        return `Rs. ${amount.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    if (product.is_orderable === false && !product.price_label) {
        return 'Info only';
    }

    return product.price_label || 'Price to be confirmed';
}
