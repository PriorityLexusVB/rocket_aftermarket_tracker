import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(process.cwd());
const skillsRoot = path.join(repoRoot, ".github", "skills");

function die(message) {
  console.error(message);
  process.exit(1);
}

function listSkillDirs() {
  if (!fs.existsSync(skillsRoot)) {
    die(`Missing skills directory: ${skillsRoot}`);
  }

  return fs
    .readdirSync(skillsRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
}

function parseSkillFrontMatter(text) {
  const lines = text.split(/\r?\n/);

  // We intentionally keep this parser very small and strict.
  // Expected header:
  // name: <value>
  // description: <value>
  //
  // ---

  const nameLine = lines.find((l) => l.startsWith("name:"));
  const descriptionLine = lines.find((l) => l.startsWith("description:"));

  const name = nameLine ? nameLine.slice("name:".length).trim() : "";
  const description = descriptionLine
    ? descriptionLine.slice("description:".length).trim()
    : "";

  return { name, description };
}

function validateSkillDir(dirName) {
  const skillPath = path.join(skillsRoot, dirName, "SKILL.md");
  if (!fs.existsSync(skillPath)) {
    return [`Missing ${path.relative(repoRoot, skillPath)}`];
  }

  const text = fs.readFileSync(skillPath, "utf8");
  const { name, description } = parseSkillFrontMatter(text);

  const errors = [];
  if (!name) errors.push(`${path.relative(repoRoot, skillPath)}: missing 'name:' header`);
  if (!description)
    errors.push(`${path.relative(repoRoot, skillPath)}: missing 'description:' header`);
  if (name && name !== dirName)
    errors.push(
      `${path.relative(repoRoot, skillPath)}: name '${name}' must match folder '${dirName}'`
    );

  if (!text.includes("\n---\n")) {
    errors.push(
      `${path.relative(repoRoot, skillPath)}: expected a '---' divider after headers (format consistency)`
    );
  }

  return errors;
}

const skillDirs = listSkillDirs();
if (skillDirs.length === 0) {
  die(`No skill directories found under ${path.relative(repoRoot, skillsRoot)}`);
}

const allErrors = [];
for (const dirName of skillDirs) {
  allErrors.push(...validateSkillDir(dirName));
}

if (allErrors.length) {
  console.error("Skill validation failed:\n" + allErrors.map((e) => `- ${e}`).join("\n"));
  process.exit(1);
}

console.log(`✅ validate-skills: OK (${skillDirs.length} skills)`);
