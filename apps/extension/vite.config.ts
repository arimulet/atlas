import { defineConfig } from "vite";

export default defineConfig({
  publicDir: "public",
  build: {
    emptyOutDir: true,
    outDir: "dist",
    rollupOptions: {
      input: {
        background: "src/background.ts",
        content: "src/content.ts",
        popup: "popup.html"
      },
      output: {
        assetFileNames: "[name][extname]",
        chunkFileNames: "[name].js",
        entryFileNames: "[name].js"
      }
    }
  }
});
