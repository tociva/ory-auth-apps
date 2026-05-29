import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.{test,spec}.ts"],
    // The route handlers capture these from process.env at module load, so they
    // must be present before the test files import them.
    env: {
      HYDRA_ADMIN_URL: "http://hydra-admin.test",
      KRATOS_ADMIN_URL: "http://kratos-admin.test",
    },
  },
});
