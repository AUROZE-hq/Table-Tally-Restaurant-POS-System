export type Role = 'ADMIN' | 'CASHIER' | 'SERVER';

export interface User {
    id: number;
    name: string;
    email: string;
    role: Role;
}

export interface Category {
    id: number;
    name: string;
    description?: string | null;
    is_active: boolean;
    parent_id?: number | null;
    sort_order?: number;
    parent?: Pick<Category, 'id' | 'name'> | null;
    children?: Category[];
}

export interface Product {
    id: number;
    name: string;
    description?: string | null;
    price: string | number | null;
    price_label?: string | null;
    category_id: number;
    category?: Category;
    is_available: boolean;
    is_orderable?: boolean;
    sort_order?: number;
}

export interface RestaurantTable {
    id: number;
    name: string;
    status: 'AVAILABLE' | 'OCCUPIED';
}

export interface Shift {
    id: number;
    opening_cash: string | number;
    closing_cash?: string | number | null;
    cash_sales?: string | number;
    expected_cash_in_drawer?: string | number;
    status: 'OPEN' | 'CLOSED';
}