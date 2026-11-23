import { defineConfig, loadEnv } from 'vite';
import laravel from 'laravel-vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');
    const appUrl = env.APP_URL ?? 'http://localhost:8000';

    return {
        plugins: [
            laravel({
                input: [
                    'resources/css/app.css',
                    'resources/js/main.tsx',
                ],
                refresh: true,
            }),
            tailwindcss(),
            react(),
            {
                name: 'redirect-vite-root-to-laravel',
                enforce: 'pre',
                configureServer(server) {
                    server.middlewares.use((req, res, next) => {
                        const path = req.url?.split('?')[0] ?? '';

                        if (path === '/' || path === '/index.html') {
                            res.writeHead(302, { Location: appUrl });
                            res.end();
                            return;
                        }

                        next();
                    });
                },
            },
        ],
        server: {
            open: appUrl,
            watch: {
                ignored: ['**/storage/framework/views/**'],
            },
        },
    };
});