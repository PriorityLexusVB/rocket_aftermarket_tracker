import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(process.cwd());
const guardrailsPath = path.join(repoRoot, "guardrails.json");

function die(message) {
  console.error(message);
  process.exit(1);
}

if (!fs.existsSync(guardrailsPath)) {
  die(`Missing ${path.relative(repoRoot, guardrailsPath)}`);
}

let guardrails;
try {
  guardrails = JSON.parse(fs.readFileSync(guardrailsPath, "utf8"));
} catch (e) {
  die(`Invalid JSON in ${path.relative(repoRoot, guardrailsPath)}: ${e.message}`);
}

const errors = [];

if (!guardrails || typeof guardrails !== "object" || Array.isArray(guardrails)) {
  errors.push("guardrails.json must be an object");
}

if (!guardrails.version || typeof guardrails.version !== "string") {
  errors.push("guardrails.version must be a non-empty string");
}

if (!Array.isArray(guardrails.rules) || guardrails.rules.length === 0) {
  errors.push("guardrails.rules must be a non-empty array");
}

const allowedSeverity = new Set(["error", "warn", "info"]);

if (Array.isArray(guardrails.rules)) {
  for (const [idx, rule] of guardrails.rules.entries()) {
    const prefix = `guardrails.rules[${idx}]`;

    if (!rule || typeof rule !== "object" || Array.isArray(rule)) {
      errors.push(`${prefix} must be an object`);
      continue;
    }

    for (const key of ["id", "title", "severity", "scope", "description"]) {
      if (!rule[key] || typeof rule[key] !== "string") {
        errors.push(`${prefix}.${key} must be a non-empty string`);
      }
    }

    if (rule.severity && !allowedSeverity.has(rule.severity)) {
      errors.push(`${prefix}.severity must be one of: error|warn|info`);
    }

    if (rule.references != null) {
      if (!Array.isArray(rule.references)) {
        errors.push(`${prefix}.references must be an array of strings when present`);
      } else if (rule.references.some((r) => typeof r !== "string" || !r.trim())) {
        errors.push(`${prefix}.references entries must be non-empty strings`);
      }
    }
  }
}

if (errors.length) {
  console.error("Guardrails validation failed:\n" + errors.map((e) => `- ${e}`).join("\n"));
  process.exit(1);
}

console.log(`✅ validate-guardrails: OK (${guardrails.rules.length} rules)`);
