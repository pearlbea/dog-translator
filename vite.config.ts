import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig(({ mode }) => {
  // The API server reads PORT from .env.local; Vite doesn't expose that to process.env,
  // so load it explicitly to keep the proxy pointed at the same port.
  const env = { ...loadEnv(mode, process.cwd(), ""), ...process.env };
  return {
    server: { proxy: { "/api": `http://localhost:${env.PORT ?? 8787}` } },
    test: { include: ["src/**/*.test.ts", "server/**/*.test.ts"] },
  };
});
