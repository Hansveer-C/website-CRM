import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    // The route-based CRM remains one intentional 533 kB (135 kB gzip) entry chunk.
    // Keep the ceiling close to that measured size while flagging material growth.
    chunkSizeWarningLimit: 550,
    rollupOptions: {
      external: [
        'better-sqlite3',
        'module',
        'fs',
        'path',
        'os',
        'crypto',
        'util',
        'src/database.ts',
        './src/database.ts',
        './database',
        'database'
      ]
    }
  }
});
