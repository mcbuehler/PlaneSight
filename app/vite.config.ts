import { defineConfig } from "vite";

// The art lives in the repository's public/ folder, next to the Remotion promo.
// The client imports the files it needs, so only those end up in the build.
export default defineConfig({
  publicDir: false,
  server: {
    port: 5173,
    fs: { allow: [".."] },
    proxy: {
      "/events": "http://127.0.0.1:7777",
      "/api": "http://127.0.0.1:7777",
    },
  },
  build: { outDir: "dist", emptyOutDir: true },
});
