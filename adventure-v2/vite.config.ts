import { defineConfig } from "vite";

export default defineConfig({
  root: "apps/web",
  server: {
    port: 5173,
    strictPort: false
  }
});
