import path from 'path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const basePath = (() => {
      const raw = env.VITE_BASE_PATH ?? env.BASE_PATH;
      if (!raw) {
        return '/';
      }

      const withLeadingSlash = raw.startsWith('/') ? raw : `/${raw}`;
      return withLeadingSlash.endsWith('/') ? withLeadingSlash : `${withLeadingSlash}/`;
    })();

    return {
      base: basePath,
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      test: {
        environment: 'node',
        include: ['services/**/*.test.ts'],
      },
    };
});
