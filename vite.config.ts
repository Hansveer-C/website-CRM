import { defineConfig } from 'vite';

export default defineConfig({
  build: {
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
