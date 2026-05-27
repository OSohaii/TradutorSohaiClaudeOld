import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// SECURITY NOTE
// -------------
// This file used to inject `process.env.API_KEY` and
// `process.env.GEMINI_API_KEY` via Vite's `define`, which embedded the
// Gemini key directly into the production JS bundle. Anyone could open
// DevTools and read it.
//
// As of Phase 1b the frontend talks only to the BFF (`/api/*`); provider
// keys live in environment variables on the backend, never on the client.
// Users may still supply their own keys via the in-app settings panel —
// those values stay in localStorage and are sent as `X-Byok-*` headers
// per request.

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const backendTarget = env.BACKEND_URL || 'http://localhost:8000';
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        allowedHosts: ['.preview.emergentagent.com', 'localhost'],
        // Forward /api/* to the FastAPI BFF during development.
        // Set BACKEND_URL in .env if your backend runs elsewhere.
        proxy: {
          '/api': {
            target: backendTarget,
            changeOrigin: true,
          },
        },
      },
      plugins: [react()],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
