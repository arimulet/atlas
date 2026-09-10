import path from "path";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, "e2e/**"]
  },
  resolve: {
    alias: {
      "@atlas/web": path.resolve(__dirname, "src"),
      "@atlas/domain": path.resolve(__dirname, "src/domain/index.ts"),
      "@atlas/application": path.resolve(__dirname, "src/application/index.ts"),
      "@atlas/database": path.resolve(__dirname, "src/database/index.ts"),
      "@atlas/utils": path.resolve(__dirname, "src/utils/index.ts"),
      "@": path.resolve(__dirname, "src")
    }
  }
});
