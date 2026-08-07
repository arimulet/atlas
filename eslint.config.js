import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["**/dist/**", "**/coverage/**", "artifacts/**", "node_modules/**", "test-results/**"]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "no-unused-vars": "off", // Apagas la regla base de JavaScript
      "@typescript-eslint/no-unused-vars": "warn" // Cambias la regla de TS a warning
    }
  },
  {
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      globals: {
        console: "readonly",
        process: "readonly"
      }
    }
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname
      }
    }
  }
);
