import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import path from 'path'
import fs from 'fs'
// PWA disabled temporarily - service workers can interfere with WebSocket connections
// import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    // PWA disabled temporarily - service workers can interfere with WebSocket connections
    // VitePWA({
    //   registerType: 'autoUpdate',
    //   includeAssets: ['favicon.ico', 'icons/*.png'],
    //   manifest: {
    //     name: 'Dragvertising Messenger',
    //     short_name: 'Messenger',
    //     description: 'Real-time messaging platform for the drag entertainment industry',
    //     theme_color: '#FD0290',
    //     background_color: '#000000',
    //     display: 'standalone',
    //     orientation: 'portrait-primary',
    //     start_url: '/',
    //     icons: [
    //       {
    //         src: 'icons/icon192.png',
    //         sizes: '192x192',
    //         type: 'image/png',
    //         purpose: 'any maskable'
    //       },
    //       {
    //         src: 'icons/icon512.png',
    //         sizes: '512x512',
    //         type: 'image/png',
    //         purpose: 'any maskable'
    //       }
    //     ],
    //     shortcuts: [
    //       {
    //         name: 'New Message',
    //         short_name: 'New',
    //         description: 'Start a new conversation',
    //         url: '/?action=new',
    //         icons: [{ src: 'icons/icon192.png', sizes: '192x192' }]
    //       }
    //     ],
    //     categories: ['social', 'communication']
    //   },
    //   workbox: {
    //     globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
    //     runtimeCaching: [
    //       {
    //         urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
    //         handler: 'NetworkFirst',
    //         options: {
    //           cacheName: 'supabase-cache',
    //           expiration: {
    //             maxEntries: 50,
    //             maxAgeSeconds: 60 * 60 * 24 // 24 hours
    //           }
    //         }
    //       },
    //       {
    //         urlPattern: /^https:\/\/.*\.supabase\.storage\/.*/i,
    //         handler: 'CacheFirst',
    //         options: {
    //           cacheName: 'supabase-storage-cache',
    //           expiration: {
    //             maxEntries: 100,
    //             maxAgeSeconds: 60 * 60 * 24 * 7 // 7 days
    //           }
    //         }
    //       }
    //     ]
    //   }
    // })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Fallback to stub when messenger package isn't available (e.g., in Vercel)
      // Always use stub in production builds (Vercel) since the package directory won't be available
      // In development, check if package is installed in node_modules, otherwise use stub
      '@dragvertising/messenger': (() => {
        const isProduction = mode === 'production';
        const nodeModulesPath = path.resolve(__dirname, './node_modules/@dragvertising/messenger');
        const sourcePath = path.resolve(__dirname, '../dragvertising-messenger-package/src/index.ts');
        const stubPath = path.resolve(__dirname, './src/lib/messenger-stub.tsx');
        
        // In production/Vercel, always use stub
        if (isProduction) {
          return stubPath;
        }
        
        // In development, check if package exists in node_modules or source
        if (fs.existsSync(nodeModulesPath)) {
          // Package is installed via npm, let Vite resolve it normally
          return nodeModulesPath;
        }
        
        if (fs.existsSync(sourcePath)) {
          return sourcePath;
        }
        
        // Fallback to stub if nothing found
        return stubPath;
      })(),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-supabase': ['@supabase/supabase-js', '@supabase/ssr'],
          'vendor-ui': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-popover',
            '@radix-ui/react-avatar',
            '@radix-ui/react-scroll-area'
          ],
          'vendor-utils': ['date-fns', 'zod', 'clsx', 'tailwind-merge'],
          'vendor-query': ['@tanstack/react-query', '@tanstack/react-query-devtools']
        },
      },
    },
    chunkSizeWarningLimit: 500,
    sourcemap: false, // Disable sourcemaps in production for smaller bundles
  },
  server: {
    port: parseInt(process.env.PORT || '5173'),
    host: true,
    strictPort: false,
    hmr: {
      // When accessed through proxy, use the proxy hostname
      host: process.env.VITE_HMR_HOST || 'messenger.localhost',
      port: parseInt(process.env.VITE_HMR_PORT || '8080'),
      protocol: 'ws',
    },
  },
}))

