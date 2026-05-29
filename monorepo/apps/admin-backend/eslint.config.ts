import tseslint from "typescript-eslint";
import baseConfig from "../../eslint.config";

export default tseslint.config(...baseConfig, {
  files: ["**/*.ts"],
  rules: {
    // Server code legitimately logs to the console.
    "no-console": "off",
  },
});
