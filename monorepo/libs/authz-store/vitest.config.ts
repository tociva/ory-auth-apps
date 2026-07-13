import { defineConfig } from "vitest/config";

export default defineConfig({
  cacheDir: "../../node_modules/.vite/authz-store",
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
