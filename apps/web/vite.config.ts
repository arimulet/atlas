import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@atlas/web/*': path.resolve(__dirname, './src') // Ajusta según la estructura de tu proyecto
    }
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: process.env.ATLAS_API_URL ?? "http://127.0.0.1:3000",
        changeOrigin: true
      }
    }
  }
});
