// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  // Your React app lives in /client
  root: resolve(__dirname, "client"),
  resolve: {
    alias: {
      "@": resolve(__dirname, "client", "src"),
      "@shared": resolve(__dirname, "shared"),
      "@assets": resolve(__dirname, "attached_assets"),
    },
  },
  build: {
    // ⬇️ This matches what your server expects
    outDir: resolve(__dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    fs: { strict: true, deny: ["**/.*"] },
  },
});
