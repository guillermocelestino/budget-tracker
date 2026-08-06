/// <reference types="vitest" />
import { sveltekit } from '@sveltejs/kit/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		sveltekit(),
		SvelteKitPWA({
			// PWA only activates in production build — never in dev mode
			// This avoids the caching issues that plagued our dev workflow
			devOptions: {
				enabled: false,
				type: 'module'
			},
			registerType: 'autoUpdate',
			includeAssets: ['icon-192.png', 'icon-512.png', 'icon.svg'],
			manifest: {
				name: 'Budget Tracker',
				short_name: 'Budget',
				description: 'Track your personal budget and expenses',
				theme_color: '#1e293b',
				background_color: '#ffffff',
				display: 'standalone',
				scope: '/',
				start_url: '/dashboard',
				orientation: 'portrait-primary',
				icons: [
					{
						src: '/icon-192.png',
						sizes: '192x192',
						type: 'image/png'
					},
					{
						src: '/icon-512.png',
						sizes: '512x512',
						type: 'image/png'
					},
					{
						src: '/icon-512.png',
						sizes: '512x512',
						type: 'image/png',
						purpose: 'maskable'
					}
				]
			},
			workbox: {
				// Smart caching for production — NetworkFirst ensures fresh data, cache as fallback
				runtimeCaching: [
					{
						// API routes: always try network first, cache as fallback
						urlPattern: /^\/api\/.*/i,
						handler: 'NetworkFirst',
						options: {
							cacheName: 'api-cache',
							expiration: {
								maxEntries: 50,
								maxAgeSeconds: 60 * 60 * 24 // 24 hours
							},
							networkTimeoutSeconds: 10
						}
					},
					{
						// Page navigations: always try network, cache for offline fallback
						urlPattern: /^\/(dashboard|transactions|categories|reports|login).*/,
						handler: 'NetworkFirst',
						options: {
							cacheName: 'page-cache',
							expiration: {
								maxEntries: 20,
								maxAgeSeconds: 60 * 60 * 24 // 24 hours
							},
						}
					}
				]
			}
		})
	],
	optimizeDeps: {
		include: ['read-excel-file/universal']
	},
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}', 'tests/unit-test/**/*.{test,spec}.{js,ts}']
	}
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any);
