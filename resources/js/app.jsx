import '../css/app.css';
import './bootstrap';

import { createInertiaApp } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { createRoot } from 'react-dom/client';
import { Toaster } from 'react-hot-toast';
import Loader from '@/Components/Loader';
const appName = import.meta.env.VITE_APP_NAME || 'Laravel';

createInertiaApp({
    title: (title) => `${title}`,
    resolve: (name) =>
        resolvePageComponent(
            `./Pages/${name}.jsx`,
            import.meta.glob('./Pages/**/*.jsx'),
        ),
    setup({ el, App, props }) {
        const root = createRoot(el);

        root.render(
            <>
                <Loader />
                <App {...props} />
                <Toaster
                    position="top-right"
                    gutter={10}
                    toastOptions={{
                        duration: 4000,
                        style: {
                            borderRadius: '12px',
                            fontFamily: 'inherit',
                            fontSize: '0.875rem',
                            fontWeight: '600',
                            padding: '12px 16px',
                            boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
                        },
                        success: {
                            style: {
                                background: '#f0fdf4',
                                color: '#15803d',
                                border: '1px solid #bbf7d0',
                            },
                            iconTheme: { primary: '#16a34a', secondary: '#f0fdf4' },
                        },
                        error: {
                            style: {
                                background: '#fef2f2',
                                color: '#b91c1c',
                                border: '1px solid #fecaca',
                            },
                            iconTheme: { primary: '#dc2626', secondary: '#fef2f2' },
                        },
                    }}
                />
            </>
    );
    },
    progress: {
        color: '#4B5563',
    },
});
