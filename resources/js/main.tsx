/// <reference types="vite/client" />
import '../css/app.css';
import './bootstrap';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { createInertiaApp, router } from '@inertiajs/react';

const pages = import.meta.glob('./pages/**/*.tsx', { eager: true }) as Record<string, { default: React.ComponentType }>; 

createInertiaApp({
    resolve: (name) => {
        const page = pages[`./pages/${name}.tsx`];

        if (!page) {
            throw new Error(`Inertia page not found: ${name}`);
        }

        return page.default;
    },
    setup({ el, App, props }) {
        const syncCsrf = (token: unknown) => {
            if (typeof token !== 'string' || token === '') {
                return;
            }
            document.querySelector('meta[name="csrf-token"]')?.setAttribute('content', token);
            window.axios.defaults.headers.common['X-CSRF-TOKEN'] = token;
        };

        syncCsrf(props.initialPage.props.csrf_token);
        router.on('success', event => syncCsrf(event.detail.page.props.csrf_token));

        createRoot(el).render(
            <React.StrictMode>
                <App {...props} />
            </React.StrictMode>,
        );
    },
    progress: { color: '#d97745' },
});