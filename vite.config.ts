import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Node's env, typed locally (the project has no @types/node).
const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};

// gamma-api.polymarket.com answers `access-control-allow-origin: *`, so the browser calls it directly.
export default defineConfig({
  // "/" in dev; GitHub Pages builds set PAGES_BASE=/<repo>/.
  base: env.PAGES_BASE ?? '/',
  plugins: [react(), tailwindcss()],
  // Bound to IPv4 loopback: Node's default resolves `localhost` to [::1] only, which refuses clients that
  // dial 127.0.0.1; browsers still reach this one through `localhost`, falling back to IPv4.
  server: { host: '127.0.0.1' },
  preview: { host: '127.0.0.1' },
});
