import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8787",
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    // Mismo baseline que Vite, con Safari 14.1 en lugar de 14.0:
    // esbuild 0.28 ya no transpila destructuring para Safari 14.0.
    target: ["chrome87", "edge88", "es2020", "firefox78", "safari14.1"],
  },
});
