import path from "node:path";
import { defineConfig } from "vitest/config";

const root = import.meta.dirname;

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(root, "src"),
      "@stylaiize/shared": path.resolve(root, "../../packages/shared/dist/index.js"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    setupFiles: ["src/test/env.setup.ts"],
    testTimeout: 20_000,
  },
});
