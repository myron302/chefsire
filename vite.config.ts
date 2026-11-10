// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

// __dirname equivalent for ESM
const __dirname = dirname(fileURLToPath(import.meta.url));

// Use an async config so we can await dynamic imports safely
export default defineConfig(async ({ mode }) => {
  const plugins = [react(), runtimeErrorOverlay()];

  // Only load Cartographer in non-prod Replit environments
  if (mode !== "production" && process.env.REPL_ID !== undefined) {
    const { cartographer } = await import("@replit/vite-plugin-cartographer");
    plugins.push(cartographer());
  }

  return {
    plugins,
    resolve: {
      alias: {
        "@": resolve(__dirname, "client", "src"),
        "@shared": resolve(__dirname, "shared"),
        "@assets": resolve(__dirname, "attached_assets"),
      },
    },
    root: resolve(__dirname, "client"),
    build: {
      outDir: resolve(__dirname, "dist/public"),
      emptyOutDir: true,
      rollupOptions: {
        // The customer app, and the staff portal page served only on the ops host (see server/lib/ops-host.ts).
        input: {
          main: resolve(__dirname, "client", "index.html"),
          ops: resolve(__dirname, "client", "ops.html"),
        },
      },
    },
    server: {
      fs: {
        strict: true,
        deny: ["**/.*"],
      },
    },
  };
});
