// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  root: resolve(__dirname, "client"),
  resolve: {
    alias: {
      "@": resolve(__dirname, "client", "src"),
      "@shared": resolve(__dirname, "shared"),
      "@assets": resolve(__dirname, "attached_assets"),
    },
  },
  build: {
    // ⬇️ Put the built SPA exactly where server/dist/index.js serves from
    outDir: resolve(__dirname, "server", "dist", "public"),
    // ⬇️ Keep this false so Vite doesn’t delete server/dist/index.js when cleaning
    emptyOutDir: false,
  },
  server: {
    fs: { strict: true, deny: ["**/.*"] },
  },
});
