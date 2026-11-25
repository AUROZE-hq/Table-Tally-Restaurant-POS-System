export const CUSTOMER_DISPLAY_CHANNEL = 'auroze-customer-display';
export const CUSTOMER_DISPLAY_STORAGE_KEY = 'auroze-customer-display';

export type CustomerDisplayStatus = 'idle' | 'ordering' | 'paid';

export interface CustomerDisplayItem {
    name: string;
    quantity: number;
    lineTotal: number;
}

export interface CustomerDisplaySnapshot {
    status: CustomerDisplayStatus;
    label: string;
    items: CustomerDisplayItem[];
    subtotal: number;
    discount: number;
    total: number;
    updatedAt: number;
}

export const emptyCustomerDisplay = (): CustomerDisplaySnapshot => ({
    status: 'idle',
    label: 'Welcome',
    items: [],
    subtotal: 0,
    discount: 0,
    total: 0,
    updatedAt: Date.now(),
});

export function publishCustomerDisplay(snapshot: CustomerDisplaySnapshot) {
    const payload = { ...snapshot, updatedAt: Date.now() };
    try {
        localStorage.setItem(CUSTOMER_DISPLAY_STORAGE_KEY, JSON.stringify(payload));
    } catch {
        // private mode or full storage — the channel still updates an open window
    }
    try {
        const channel = new BroadcastChannel(CUSTOMER_DISPLAY_CHANNEL);
        channel.postMessage(payload);
        channel.close();
    } catch {
        // BroadcastChannel is unavailable in this browser
    }
}

export function readCustomerDisplay(): CustomerDisplaySnapshot {
    try {
        const raw = localStorage.getItem(CUSTOMER_DISPLAY_STORAGE_KEY);
        if (!raw) {
            return emptyCustomerDisplay();
        }
        const parsed = JSON.parse(raw) as CustomerDisplaySnapshot;
        if (!parsed || !Array.isArray(parsed.items)) {
            return emptyCustomerDisplay();
        }
        return parsed;
    } catch {
        return emptyCustomerDisplay();
    }
}
