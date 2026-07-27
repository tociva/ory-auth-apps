#!/usr/bin/env node

import {
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";

const [, , templatePath, outputPath] = process.argv;

if (!templatePath || !outputPath) {
  console.error(
    "Usage: node scripts/deploy/render-admin-frontend-config.mjs <template> <output>",
  );
  process.exit(2);
}

const variablePattern = /\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g;
const temporaryPath = `${outputPath}.${process.pid}.tmp`;

try {
  const template = readFileSync(templatePath, "utf8");
  const rendered = template.replace(variablePattern, (_placeholder, name) => {
    const value = process.env[name];
    if (value === undefined || value === "") {
      throw new Error(`${name} is required to render the admin frontend configuration`);
    }
    return JSON.stringify(value).slice(1, -1);
  });
  const config = JSON.parse(rendered);

  if (typeof config.apiBaseUrl !== "string" || config.apiBaseUrl === "") {
    throw new Error("Rendered apiBaseUrl must be a non-empty string");
  }
  if (typeof config.authLogoutUrl !== "string" || config.authLogoutUrl === "") {
    throw new Error("Rendered authLogoutUrl must be a non-empty string");
  }

  writeFileSync(temporaryPath, `${JSON.stringify(config, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o644,
  });
  renameSync(temporaryPath, outputPath);
  console.log(`Rendered admin frontend configuration: ${outputPath}`);
} catch (error) {
  rmSync(temporaryPath, { force: true });
  const reason = error instanceof Error ? error.message : String(error);
  console.error(`Failed to render admin frontend configuration: ${reason}`);
  process.exit(1);
}
