// Production solver. Two modes:
// - plan(): totals in whole crafts, since the game produces in batches. Surplus
//   from a batch (3 carbon make 2 polymer when only 1 is needed) is used before
//   crafting again.
// - rates(): steady flows per in-game year (300 days), like the game's UI.
//   Buildings for a step = crafts per year / (300 / days per cycle).
import {
  Choice,
  GameData,
  GameVersion,
  Item,
  Names,
  Quantities,
  QuantityRow,
  RatePlan,
  RateStep,
  RawSource,
  Recipe,
  TotalPlan,
  TotalStep,
} from "./types";

export * from "./types";

// Gives up when the chosen recipes feed each other forever.
const MAX_EVENTS = 50000;
const MAX_EXTRACTION_LEVEL = 1000;
const DEFAULT_DAYS_PER_YEAR = 300;

// Anything smaller is rounding noise.
export const EPSILON = 1e-9;

export const RAW = "raw";

// Errors the user can fix: bad data.json, recipe choices or quantities.
export class CalcError extends Error {
  override name = "CalcError";
}

// Drops entries <= min and sorts by item id.
function clean(values: Quantities, min = 0): Quantities {
  const out: Quantities = {};
  const entries = Object.entries(values).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  for (const [key, value] of entries) {
    if (value > min) out[key] = value;
  }
  return out;
}

function add(map: Quantities, key: string, qty: number): void {
  map[key] = (map[key] ?? 0) + qty;
}

function scale(list: Quantities, factor: number): Quantities {
  const out: Quantities = {};
  for (const [key, value] of Object.entries(list)) {
    out[key] = value * factor;
  }
  return out;
}

function isObject(value: unknown): value is { [key: string]: unknown } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPrepared(value: unknown): value is GameData {
  return isObject(value) && isObject(value.recipeById);
}

function dataError(message: string): CalcError {
  return new CalcError(`data.json: ${message}`);
}

function checkNames(value: unknown, where: string): Names {
  if (!isObject(value) || typeof value.en !== "string" || !value.en) {
    throw dataError(`${where} has no English name (names.en)`);
  }
  const names: Names = { en: value.en };
  for (const [lang, name] of Object.entries(value)) {
    if (typeof name !== "string") throw dataError(`${where}: the "${lang}" name is not a string`);
    names[lang] = name;
  }
  return names;
}

function checkQuantities(
  value: unknown,
  where: string,
  side: "inputs" | "outputs",
  items: { [itemKey: string]: Item },
): Quantities {
  const invalid = dataError(`${where}: "${side}" must map items to numbers > 0`);
  if (!isObject(value)) throw invalid;
  const quantities: Quantities = {};
  for (const [item, qty] of Object.entries(value)) {
    if (typeof qty !== "number" || !Number.isFinite(qty) || qty <= 0) throw invalid;
    if (!(item in items)) throw dataError(`${where}: unknown item "${item}" in ${side}`);
    quantities[item] = qty;
  }
  return quantities;
}

function checkItems(value: unknown): { [itemKey: string]: Item } {
  if (!isObject(value)) throw dataError('missing "items" object');
  const items: { [itemKey: string]: Item } = {};
  for (const [key, item] of Object.entries(value)) {
    if (!isObject(item)) throw dataError(`item "${key}" is not an object`);
    items[key] = {
      key,
      names: checkNames(item.names, `item "${key}"`),
      group: typeof item.group === "string" && item.group ? item.group : "other",
      isBuilding: Boolean(item.isBuilding),
      icon: typeof item.icon === "string" && item.icon ? item.icon : null,
    };
  }
  return items;
}

function checkRecipe(value: unknown, index: number, items: { [itemKey: string]: Item }): Recipe {
  const id = isObject(value) ? value.id : undefined;
  const where = `recipe #${index}${id != null ? ` (id ${JSON.stringify(id)})` : ""}`;
  if (!isObject(value)) throw dataError(`${where} is not an object`);
  if (typeof id !== "number" || !Number.isInteger(id) || id < 0) {
    throw dataError(`${where}: "id" must be a whole number ≥ 0`);
  }
  const building = value.building;
  if (typeof building !== "string" || !(building in items)) {
    throw dataError(`${where}: unknown building "${String(building)}"`);
  }
  const days = value.days;
  if (typeof days !== "number" || !Number.isFinite(days) || days <= 0) {
    throw dataError(`${where}: "days" must be a number > 0`);
  }
  return {
    id,
    building,
    inputs: checkQuantities(value.inputs, where, "inputs", items),
    outputs: checkQuantities(value.outputs, where, "outputs", items),
    days,
    locked: Boolean(value.locked),
    extraction: Boolean(value.extraction),
    synthetic: Boolean(value.synthetic),
  };
}

function checkGame(value: unknown): GameVersion {
  if (!isObject(value)) return {};
  const game: GameVersion = {};
  if (typeof value.version === "string") game.version = value.version;
  if (typeof value.build === "string") game.build = value.build;
  return game;
}

function checkUi(value: unknown): { [stringKey: string]: Names } {
  const ui: { [stringKey: string]: Names } = {};
  if (!isObject(value)) return ui;
  for (const [key, names] of Object.entries(value)) {
    ui[key] = checkNames(names, `ui string "${key}"`);
  }
  return ui;
}

// Validates data.json and builds the lookup tables. An item is a raw resource
// by default (null) when nothing makes it or something makes it from nothing;
// otherwise its default is its first non-locked recipe, in data.json order.
export function prepareData(raw: unknown): GameData {
  if (isPrepared(raw)) return raw;
  if (!isObject(raw)) throw dataError("not a JSON object");
  const items = checkItems(raw.items);
  if (!Array.isArray(raw.recipes)) throw dataError('missing "recipes" array');
  const rawRecipes: unknown[] = raw.recipes;

  const recipes: Recipe[] = [];
  const recipeById: { [recipeId: number]: Recipe } = {};
  const producing = new Map<string, Recipe[]>();
  for (const [index, value] of rawRecipes.entries()) {
    const recipe = checkRecipe(value, index, items);
    if (recipe.id in recipeById) throw dataError(`recipe #${index}: id ${recipe.id} is used twice`);
    recipes.push(recipe);
    recipeById[recipe.id] = recipe;
    for (const item of Object.keys(recipe.outputs)) {
      producing.set(item, [...(producing.get(item) ?? []), recipe]);
    }
  }

  const producers: { [itemKey: string]: number[] } = {};
  const defaults: { [itemKey: string]: number | null } = {};
  const sources: { [itemKey: string]: number | null } = {};
  for (const [item, made] of producing) {
    producers[item] = made.map((r) => r.id);
    const fromNothing = made.filter((r) => Object.keys(r.inputs).length === 0);
    const preferred = made.find((r) => !r.locked) ?? made[0];
    defaults[item] = fromNothing.length > 0 || !preferred ? null : preferred.id;
    fromNothing.sort((a, b) => Number(b.synthetic) - Number(a.synthetic) || Number(a.locked) - Number(b.locked) || a.id - b.id);
    sources[item] = fromNothing[0]?.id ?? null;
  }

  const daysPerYear = raw.daysPerYear;
  return {
    game: checkGame(raw.game),
    daysPerYear: typeof daysPerYear === "number" && daysPerYear > 0 ? daysPerYear : DEFAULT_DAYS_PER_YEAR,
    ui: checkUi(raw.ui),
    items,
    recipes,
    recipeById,
    producers,
    defaults,
    sources,
  };
}

interface Solved {
  targets: Quantities;
  crafts: Map<number, number>;
  depth: Map<number, number>;
  raw: Quantities;
  stockUsed: Quantities;
  leftover: Quantities;
}

export class Planner {
  readonly data: GameData;
  readonly extractionFactor: number;
  readonly choices: { [itemKey: string]: Choice } = {};

  constructor(data: unknown, choices: { [itemKey: string]: number | string | null } = {}, extractionLevel = 0) {
    this.data = prepareData(data);
    if (!(extractionLevel >= 0 && extractionLevel <= MAX_EXTRACTION_LEVEL)) {
      throw new CalcError(`Extraction upgrade level must be between 0 and ${MAX_EXTRACTION_LEVEL}`);
    }
    // CItem_ContentFactory/Extractor.Update01s: each level of the infinite
    // "extraction" tech adds a 10% chance of an extra output per cycle.
    this.extractionFactor = 1 + 0.1 * extractionLevel;
    for (const [item, value] of Object.entries(choices)) {
      if (!(item in this.data.items)) throw new CalcError(`Unknown item "${item}"`);
      const recipeId: Choice = value === RAW || value == null ? RAW : Number(value);
      if (recipeId !== RAW && !(this.data.producers[item] ?? []).includes(recipeId)) {
        throw new CalcError(`Recipe ${String(value)} does not produce "${item}"`);
      }
      this.choices[item] = recipeId;
    }
  }

  recipeFor(item: string): Choice {
    return this.choices[item] ?? this.data.defaults[item] ?? RAW;
  }

  outputFactor(recipe: Recipe): number {
    return recipe.extraction ? this.extractionFactor : 1;
  }

  buildingsNeeded(recipe: Recipe, craftsPerYear: number): number {
    return (craftsPerYear * recipe.days) / this.data.daysPerYear;
  }

  // Stock is used first; what can't be crafted ends up in `raw`.
  plan(targets: Quantities, stock: Quantities = {}): TotalPlan {
    const solved = this.solve(targets, stock, true);
    const steps: TotalStep[] = [];
    for (const [recipeId, crafts] of solved.crafts) {
      const recipe = this.data.recipeById[recipeId]!;
      steps.push({
        recipe: recipeId,
        building: recipe.building,
        crafts,
        depth: solved.depth.get(recipeId) ?? 0,
        days: recipe.days,
        buildingDays: crafts * recipe.days,
        inputs: scale(recipe.inputs, crafts),
        outputs: scale(recipe.outputs, crafts),
      });
    }
    steps.sort((a, b) => a.depth - b.depth || a.recipe - b.recipe);
    return {
      mode: "total",
      targets: solved.targets,
      steps,
      raw: clean(solved.raw),
      stockUsed: clean(solved.stockUsed),
      leftover: clean(solved.leftover),
    };
  }

  // `available`: flows already produced elsewhere, used before building anything.
  rates(targetsPerYear: Quantities, available: Quantities = {}): RatePlan {
    const solved = this.solve(targetsPerYear, available, false);
    const steps: RateStep[] = [];
    for (const [recipeId, crafts] of solved.crafts) {
      const recipe = this.data.recipeById[recipeId]!;
      steps.push({
        recipe: recipeId,
        building: recipe.building,
        depth: solved.depth.get(recipeId) ?? 0,
        days: recipe.days,
        cyclesPerYear: crafts,
        buildings: this.buildingsNeeded(recipe, crafts),
        inputs: scale(recipe.inputs, crafts),
        outputs: scale(recipe.outputs, crafts * this.outputFactor(recipe)),
      });
    }
    steps.sort((a, b) => a.depth - b.depth || a.recipe - b.recipe);

    const raw = clean(solved.raw, EPSILON);
    const rawSources: { [itemKey: string]: RawSource } = {};
    for (const [item, perYear] of Object.entries(raw)) {
      const sourceId = this.data.sources[item];
      if (sourceId == null) continue;
      const source = this.data.recipeById[sourceId]!;
      const crafts = perYear / (source.outputs[item]! * this.outputFactor(source));
      rawSources[item] = { recipe: sourceId, buildings: this.buildingsNeeded(source, crafts) };
    }

    return {
      mode: "rate",
      targets: solved.targets,
      steps,
      raw,
      rawSources,
      stockUsed: clean(solved.stockUsed, EPSILON),
      leftover: clean(solved.leftover, EPSILON),
      extractionFactor: this.extractionFactor,
    };
  }

  // Breadth-first: each demand is met from surplus, then stock, then by crafting
  // (whose inputs become new demands), and what's left is a raw resource.
  private solve(targets: Quantities, stock: Quantities, discrete: boolean): Solved {
    const result: Solved = { targets: { ...targets }, crafts: new Map(), depth: new Map(), raw: {}, stockUsed: {}, leftover: {} };
    const stockLeft: Quantities = { ...stock };
    const surplus: Quantities = {}; // produced but not consumed yet

    // [item, quantity, depth]. Grows while we iterate over it.
    const queue: Array<[string, number, number]> = [];
    for (const [item, qty] of Object.entries(targets)) {
      if (qty > 0) queue.push([item, qty, 0]);
    }
    let events = 0;
    for (const [item, wanted, depth] of queue) {
      events++;
      if (events > MAX_EVENTS) {
        throw new CalcError(
          "The selected recipes loop on each other and never converge. " +
            "Pick a different recipe for one of the items involved.",
        );
      }
      let needed = wanted;

      const fromSurplus = Math.min(surplus[item] ?? 0, needed);
      add(surplus, item, -fromSurplus);
      needed -= fromSurplus;

      const fromStock = Math.min(stockLeft[item] ?? 0, needed);
      add(stockLeft, item, -fromStock);
      add(result.stockUsed, item, fromStock);
      needed -= fromStock;

      if (needed <= EPSILON) continue;

      const recipeId = this.recipeFor(item);
      if (recipeId === RAW) {
        add(result.raw, item, needed);
        continue;
      }

      const recipe = this.data.recipeById[recipeId]!;
      const perCraft = recipe.outputs[item]!;
      // The extraction bonus is random per cycle: only use its average for rates.
      const factor = discrete ? 1 : this.outputFactor(recipe);
      const crafts = discrete ? Math.ceil(needed / perCraft) : needed / (perCraft * factor);
      result.crafts.set(recipeId, (result.crafts.get(recipeId) ?? 0) + crafts);
      result.depth.set(recipeId, Math.max(result.depth.get(recipeId) ?? 0, depth));
      for (const [output, qty] of Object.entries(recipe.outputs)) {
        add(surplus, output, qty * crafts * factor);
      }
      add(surplus, item, -needed);
      for (const [input, qty] of Object.entries(recipe.inputs)) {
        queue.push([input, qty * crafts, depth + 1]);
      }
    }

    result.leftover = surplus;
    return result;
  }
}

// Sums duplicate items and skips empty rows. Floors quantities unless allowFraction.
export function toQuantities(data: GameData, rows: readonly QuantityRow[], allowFraction = false): Quantities {
  const out: Quantities = {};
  for (const { item, qty } of rows) {
    if (!item) continue;
    if (!(item in data.items)) throw new CalcError(`Unknown item "${item}"`);
    const value = allowFraction ? Number(qty) : Math.floor(Number(qty));
    if (!Number.isFinite(value) || value < 0) throw new CalcError(`Invalid quantity for "${item}"`);
    if (value > 0) add(out, item, value);
  }
  return out;
}
