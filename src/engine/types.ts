export interface Quantities {
  [itemKey: string]: number;
}

/** A recipe id, or "raw" to treat the item as a raw resource. */
export type Choice = number | "raw";

export interface Names {
  en: string;
  [languageCode: string]: string;
}

export interface GameVersion {
  version?: string;
  build?: string;
}

// data.json, as written by hand.

export interface RawItem {
  names: Names;
  /** The game's `uiGroup`. Sets the colour and section. */
  group?: string;
  isBuilding?: boolean;
  /** Relative to src/assets/, e.g. "icons/steel.png". */
  icon?: string | null;
}

export interface RawRecipe {
  /** Saved recipe choices refer to it, so never renumber. */
  id: number;
  building: string;
  /** Per production cycle. */
  inputs: Quantities;
  /** Per production cycle. */
  outputs: Quantities;
  /** Length of one cycle, in in-game days. */
  days: number;
  /** Never picked as the default recipe. */
  locked?: boolean;
  /** Output boosted by the extraction tech (+10% per level). */
  extraction?: boolean;
  /** Not in the game's Lua files: ground and floating Extractors. */
  synthetic?: boolean;
}

export interface RawGameData {
  game?: GameVersion;
  daysPerYear?: number;
  ui?: { [stringKey: string]: Names };
  items: { [itemKey: string]: RawItem };
  recipes: RawRecipe[];
}

// After prepareData().

export interface Item {
  key: string;
  names: Names;
  group: string;
  isBuilding: boolean;
  icon: string | null;
}

export interface Recipe extends RawRecipe {
  locked: boolean;
  extraction: boolean;
  synthetic: boolean;
}

export interface GameData {
  game: GameVersion;
  daysPerYear: number;
  ui: { [stringKey: string]: Names };
  items: { [itemKey: string]: Item };
  recipes: Recipe[];
  recipeById: { [recipeId: number]: Recipe };
  /** In data.json order. */
  producers: { [itemKey: string]: number[] };
  /** null for raw resources. */
  defaults: { [itemKey: string]: number | null };
  /** The recipe making the item from nothing, used to size raw supply. */
  sources: { [itemKey: string]: number | null };
}

// Solver results.

interface StepBase {
  recipe: number;
  building: string;
  /** 0 for the steps making the targets, then +1 per level down the chain. */
  depth: number;
  days: number;
  inputs: Quantities;
  outputs: Quantities;
}

export interface TotalStep extends StepBase {
  crafts: number;
  /** Days of work for one building to do all the crafts. */
  buildingDays: number;
}

export interface RateStep extends StepBase {
  cyclesPerYear: number;
  /** Not rounded: the UI rounds up. */
  buildings: number;
}

export type Step = TotalStep | RateStep;

export interface RawSource {
  recipe: number;
  buildings: number;
}

export interface TotalPlan {
  mode: "total";
  targets: Quantities;
  steps: TotalStep[];
  raw: Quantities;
  stockUsed: Quantities;
  /** Surplus from the last batches. */
  leftover: Quantities;
}

/** Everything is per in-game year. */
export interface RatePlan {
  mode: "rate";
  targets: Quantities;
  steps: RateStep[];
  raw: Quantities;
  rawSources: { [itemKey: string]: RawSource };
  stockUsed: Quantities;
  leftover: Quantities;
  extractionFactor: number;
}

export type Plan = TotalPlan | RatePlan;

/** `qty` stays a string while it's being typed. */
export interface QuantityRow {
  item: string;
  qty: number | string;
}
