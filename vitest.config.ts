import path from "path";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, "e2e/**"]
  },
  resolve: {
    alias: {
      "@atlas/web": path.resolve(__dirname, "apps/web/src")
    }
  }
});
