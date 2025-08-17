import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
	plugins: [
		react(),
		VitePWA({
			registerType: 'autoUpdate',
			injectRegister: 'auto',
			manifest: {
				name: 'FinStat — учет финансов',
				short_name: 'FinStat',
				description: 'Личное управление финансами, цели и аналитика',
				start_url: '.',
				scope: '.',
				display: 'standalone',
				background_color: '#ffffff',
				theme_color: '#0A84FF',
				icons: [
					{ src: 'manifest-icon-192.maskable.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
					{ src: 'manifest-icon-192.maskable.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
					{ src: 'manifest-icon-512.maskable.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
					{ src: 'manifest-icon-512.maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
				],
			},
			workbox: {
				runtimeCaching: [
					{
						urlPattern: /\/api\//,
						handler: 'NetworkFirst',
						options: {
							cacheName: 'api-cache',
							networkTimeoutSeconds: 5,
							cacheableResponse: { statuses: [0, 200] },
						},
					},
				],
			},
			devOptions: {
				enabled: true,
				type: 'module',
			},
		})
	],
	base: './',
	build: {
		outDir: 'dist',
		emptyOutDir: true,
	},
	server: {
		port: 5173,
	},
}) 