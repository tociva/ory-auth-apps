#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { basename } from "node:path";

const [, , examplePath, candidatePath, suppliedLabel] = process.argv;

if (!examplePath || !candidatePath) {
  console.error(
    "Usage: node scripts/deploy/validate-env-file.mjs <example.env> <candidate.env> [label]",
  );
  process.exit(2);
}

const label = suppliedLabel ?? basename(candidatePath);

function readEnvironmentFile(path, kind) {
  try {
    return readFileSync(path, "utf8").replace(/^\uFEFF/, "");
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`cannot read ${kind} file '${path}': ${reason}`);
  }
}

function findClosingQuote(value, quote) {
  for (let index = 1; index < value.length; index += 1) {
    if (value[index] !== quote) continue;

    let backslashes = 0;
    for (let cursor = index - 1; cursor >= 0 && value[cursor] === "\\"; cursor -= 1) {
      backslashes += 1;
    }
    if (backslashes % 2 === 0) return index;
  }
  return -1;
}

function normalizedValue(rawValue) {
  const value = rawValue.trim();
  if (value === "" || value.startsWith("#")) return "";

  if (value[0] === '"' || value[0] === "'") {
    const closingQuote = findClosingQuote(value, value[0]);
    if (closingQuote >= 0) return value.slice(1, closingQuote).trim();
  }

  const commentIndex = value.search(/\s#/);
  return (commentIndex >= 0 ? value.slice(0, commentIndex) : value).trim();
}

function parseEnvironmentFile(contents, path) {
  const lines = contents.split(/\r?\n/);
  const values = new Map();
  const errors = [];

  for (let index = 0; index < lines.length; index += 1) {
    const lineNumber = index + 1;
    const line = lines[index];
    const trimmed = line.trim();

    if (trimmed === "" || trimmed.startsWith("#")) continue;

    const assignment = line.match(
      /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/,
    );
    if (!assignment) {
      errors.push(`line ${lineNumber} is not a KEY=value assignment`);
      continue;
    }

    const [, key, firstValueLine] = assignment;
    let rawValue = firstValueLine;
    const openingQuote = rawValue.trimStart()[0];

    if (
      (openingQuote === '"' || openingQuote === "'") &&
      findClosingQuote(rawValue.trimStart(), openingQuote) < 0
    ) {
      let closed = false;
      while (index + 1 < lines.length) {
        index += 1;
        rawValue += `\n${lines[index]}`;
        if (findClosingQuote(rawValue.trimStart(), openingQuote) >= 0) {
          closed = true;
          break;
        }
      }
      if (!closed) errors.push(`line ${lineNumber} has an unterminated quoted value`);
    }

    if (values.has(key)) {
      errors.push(`line ${lineNumber} defines duplicate key ${key}`);
      continue;
    }
    values.set(key, normalizedValue(rawValue));
  }

  return { values, errors: errors.map((message) => `${path}: ${message}`) };
}

function isPlaceholder(value) {
  return (
    value.toLowerCase().includes("replace-with-") ||
    /^(?:change-?me|todo)$/i.test(value) ||
    /^\$\{[A-Za-z_][A-Za-z0-9_]*(?::?-[^}]*)?\}$/.test(value)
  );
}

try {
  const example = parseEnvironmentFile(
    readEnvironmentFile(examplePath, "example"),
    examplePath,
  );
  const candidate = parseEnvironmentFile(
    readEnvironmentFile(candidatePath, "environment"),
    candidatePath,
  );
  const errors = [...example.errors, ...candidate.errors];

  for (const [key, exampleValue] of example.values) {
    if (!candidate.values.has(key)) {
      errors.push(`missing key ${key}`);
      continue;
    }

    // A blank example value explicitly marks an optional setting.
    if (exampleValue === "") continue;

    const candidateValue = candidate.values.get(key);
    if (candidateValue === "") {
      errors.push(`required key ${key} has an empty value`);
    } else if (isPlaceholder(candidateValue)) {
      errors.push(`required key ${key} still has a placeholder value`);
    }
  }

  if (errors.length > 0) {
    console.error(`Environment validation failed for ${label}:`);
    for (const error of errors) console.error(`  - ${error}`);
    process.exit(1);
  }

  console.log(`Environment OK: ${label} (${example.values.size} keys checked)`);
} catch (error) {
  const reason = error instanceof Error ? error.message : String(error);
  console.error(`Environment validation failed for ${label}: ${reason}`);
  process.exit(1);
}
