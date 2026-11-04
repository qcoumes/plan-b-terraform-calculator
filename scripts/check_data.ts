// yarn check-data [path/to/data.json]
//
// Errors (exit code 1): anything that stops the app loading data.json, and
// items that can't be planned (e.g. recipes looping on each other).
// Warnings: missing icon files, unused items, missing translations.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { GameData, Planner, prepareData } from "../src/engine/engine";
import { LANGUAGES } from "../src/i18n/messages";

const DEFAULT_FILE = fileURLToPath(new URL("../src/assets/data.json", import.meta.url));

function describeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function relative(file: string): string {
  return path.relative(process.cwd(), file) || file;
}

function load(file: string): GameData {
  try {
    return prepareData(JSON.parse(fs.readFileSync(file, "utf8")));
  } catch (err) {
    console.error(`error: ${describeError(err)}`);
    process.exit(1);
  }
}

function findWarnings(data: GameData, dataDir: string): string[] {
  const used = new Set<string>();
  for (const recipe of data.recipes) {
    used.add(recipe.building);
    for (const item of [...Object.keys(recipe.inputs), ...Object.keys(recipe.outputs)]) {
      used.add(item);
    }
  }

  const warnings: string[] = [];
  for (const [key, item] of Object.entries(data.items)) {
    if (!used.has(key)) warnings.push(`item "${key}" is not used by any recipe`);
    const missing = LANGUAGES.map((l) => l.code).filter((lang) => !item.names[lang]);
    if (missing.length > 0) warnings.push(`item "${key}" has no name in: ${missing.join(", ")} (English is used)`);
    if (item.icon) {
      const icon = path.join(dataDir, item.icon);
      if (!fs.existsSync(icon)) warnings.push(`item "${key}": icon file ${relative(icon)} not found`);
    }
  }
  return warnings;
}

function findUnplannable(data: GameData): string[] {
  const planner = new Planner(data);
  const errors: string[] = [];
  for (const item of Object.keys(data.producers)) {
    try {
      planner.plan({ [item]: 1 });
      planner.rates({ [item]: 1 });
    } catch (err) {
      errors.push(`cannot plan "${item}": ${describeError(err)}`);
    }
  }
  return errors;
}

const file = path.resolve(process.argv[2] ?? DEFAULT_FILE);
const data = load(file);
const errors = findUnplannable(data);
const warnings = findWarnings(data, path.dirname(file));

for (const error of errors) {
  console.error(`error: ${error}`);
}
for (const warning of warnings) {
  console.warn(`warning: ${warning}`);
}
const { version, build } = data.game;
const game = version ? `game ${version}${build ? ` (build ${build})` : ""}: ` : "";
const counts = `${data.recipes.length} recipes, ${Object.keys(data.items).length} items`;
console.log(`${relative(file)}: ${game}${counts}, ${errors.length} error(s), ${warnings.length} warning(s)`);
if (errors.length > 0) process.exitCode = 1;
