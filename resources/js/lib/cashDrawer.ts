import axios from 'axios';

function paymentMethod(order: { payment?: { payment_method?: string } | null; payment_method?: string } | null | undefined): string | null {
    if (!order) {
        return null;
    }

    return order.payment?.payment_method ?? order.payment_method ?? null;
}

export function isCashPayment(order: { payment?: { payment_method?: string } | null; payment_method?: string } | null | undefined): boolean {
    return paymentMethod(order) === 'CASH';
}

export async function kickCashDrawerForOrder(
    order: { payment?: { payment_method?: string } | null; payment_method?: string } | null | undefined,
): Promise<void> {
    const method = paymentMethod(order);
    if (method !== 'CASH') {
        return;
    }

    try {
        await axios.post('/api/cash-drawer/kick', { payment_method: 'CASH' });
    } catch {
        // Drawer is optional when the printer is unavailable or not configured.
    }
}

export async function kickCashDrawerIfCash(method: 'CASH' | 'CARD' | 'LANKAQR'): Promise<void> {
    if (method !== 'CASH') {
        return;
    }

    try {
        await axios.post('/api/cash-drawer/kick', { payment_method: 'CASH' });
    } catch {
        // Optional hardware.
    }
}