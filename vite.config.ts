import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Read the package.json version at build time so the UI can display the
// running app version without us having to keep a hand-edited constant in
// sync with package.json. The value is injected as a global at build time
// via `define` and consumed in App.tsx through the typed declaration in
// `vite-env.d.ts` (declare const __APP_VERSION__: string).
//
// Convention: package.json `version` is bumped to match the next git tag
// (e.g. 0.1.7-alpha for the v0.1.7-alpha tag) BEFORE merging the PR that
// introduces the version. After merge we create the matching tag.
const pkg = JSON.parse(
  readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8'),
) as { version: string };

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
      define: {
        // Expose package.json `version` to client code as `__APP_VERSION__`.
        // JSON.stringify is required because `define` does a raw text
        // substitution; without it the value would be parsed as code.
        __APP_VERSION__: JSON.stringify(pkg.version),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
