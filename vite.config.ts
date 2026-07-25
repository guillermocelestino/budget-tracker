import { sveltekit } from '@sveltejs/kit/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		sveltekit(),
		SvelteKitPWA({
			// Enable PWA features during dev so manifest is visible in DevTools
			devOptions: {
				enabled: true,
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
				start_url: '/',
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
				// Include patterns starting with prerendered/ and client/ to prevent the
				// plugin from adding its own defaults that don't match dev-dist structure
				globPatterns: [
					'**/*.{js,css,html,ico,png,svg,woff2}',
					'prerendered/_',
					'client/_'
				],
				globIgnores: ['**/node_modules/**/*'],
				runtimeCaching: [
					{
						urlPattern: /^\/api\/.*/i,
						handler: 'NetworkFirst',
						options: {
							cacheName: 'api-cache',
							expiration: {
								maxEntries: 50,
								maxAgeSeconds: 60 * 60 * 24
							},
							networkTimeoutSeconds: 10
						}
					}
				]
			}
		})
	],
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}']
	}
});
