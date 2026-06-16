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
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes("node_modules")) {
              return undefined;
            }

            if (/[\\/]node_modules[\\/](react|react-dom|wouter)[\\/]/.test(id)) {
              return "vendor-react";
            }

            if (/[\\/]node_modules[\\/](recharts|d3-[^\\/]+)[\\/]/.test(id)) {
              return "vendor-charts";
            }

            if (/[\\/]node_modules[\\/]framer-motion[\\/]/.test(id)) {
              return "vendor-motion";
            }

            if (/[\\/]node_modules[\\/]@tanstack[\\/]react-query[\\/]/.test(id)) {
              return "vendor-query";
            }

            if (/[\\/]node_modules[\\/](date-fns|lodash)[\\/]/.test(id)) {
              return "vendor-utils";
            }

            return "vendor";
          },
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
