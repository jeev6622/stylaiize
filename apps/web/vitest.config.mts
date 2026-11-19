import path from "node:path";
import { defineConfig } from "vitest/config";

const root = import.meta.dirname;

export default defineConfig({
  oxc: {
    jsx: "automatic",
  },
  resolve: {
    alias: {
      "@": path.resolve(root, "src"),
      "@stylaiize/shared": path.resolve(root, "../../packages/shared/dist/index.js"),
    },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["src/test/setup.ts"],
  },
});
