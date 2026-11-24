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
    is_active: boolean;
}

export interface Product {
    id: number;
    name: string;
    price: string | number;
    category_id: number;
    category?: Category;
    is_available: boolean;
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