import { EPSILON, Plan, Quantities, RateStep, RawSource, Step } from "../engine/engine";
import { currentChoice, gameData, recipe } from "../state/store";

// Deeper branches are cut and flagged as a loop.
const MAX_TREE_DEPTH = 20;

export function isRateStep(step: Step): step is RateStep {
  return "buildings" in step;
}

// Buildings for a per-year step, crafts for a totals step.
export function stepAmount(step: Step): number {
  return isRateStep(step) ? step.buildings : step.crafts;
}

export function rawSourceOf(plan: Plan, item: string): RawSource | null {
  return plan.mode === "rate" ? (plan.rawSources[item] ?? null) : null;
}

function addTo(map: Quantities, key: string, qty: number): void {
  map[key] = (map[key] ?? 0) + qty;
}

function demandOf(plan: Plan): Quantities {
  const demand: Quantities = {};
  for (const [item, qty] of Object.entries(plan.targets)) {
    addTo(demand, item, qty);
  }
  for (const step of plan.steps) {
    for (const [item, qty] of Object.entries(step.inputs)) {
      addTo(demand, item, qty);
    }
  }
  return demand;
}

export function makeProducerOf(plan: Plan): (item: string) => Step | null {
  const stepByRecipe = new Map<number, Step>(plan.steps.map((s) => [s.recipe, s]));
  return (item) => {
    const chosen = currentChoice(item);
    const step = chosen === "raw" ? undefined : stepByRecipe.get(chosen);
    return step ?? plan.steps.find((s) => item in s.outputs) ?? null;
  };
}

export interface SupplyBuilding {
  building: string;
  buildings: number;
}

export interface TreeBranch {
  id: number;
  item: string;
  qty: number;
  fromStock: number;
  raw: number;
  /** Covered by another step's surplus. */
  byproduct: number;
  /** The item already appears higher in this branch. */
  loop: boolean;
  step: Step | null;
  /** Fraction of `step` used by this branch. */
  share: number;
  children: TreeBranch[];
  /** Per year only. */
  source: SupplyBuilding | null;
}

// The solver gives one step per recipe, with totals. When several products use
// the same intermediate, its step is split between them in proportion to what
// each one consumes, so the branches add up to the totals.
export function buildTree(plan: Plan): TreeBranch[] {
  const producerOf = makeProducerOf(plan);
  const demand = demandOf(plan);
  const stock = plan.stockUsed;
  const raw = plan.raw;
  let nextId = 0;

  function branch(item: string, qty: number, path: string[]): TreeBranch {
    const total = demand[item] ?? qty;
    const fraction = total > 0 ? qty / total : 0;
    const rawTotal = raw[item] ?? 0;
    const node: TreeBranch = {
      id: nextId++,
      item,
      qty,
      fromStock: (stock[item] ?? 0) * fraction,
      raw: rawTotal * fraction,
      byproduct: 0,
      loop: false,
      step: null,
      share: 0,
      children: [],
      source: null,
    };
    const src = rawSourceOf(plan, item);
    if (src && node.raw > EPSILON && rawTotal > 0) {
      node.source = { building: recipe(src.recipe).building, buildings: (src.buildings * node.raw) / rawTotal };
    }
    const craftedDemand = total - (stock[item] ?? 0) - rawTotal;
    const crafted = craftedDemand * fraction;
    if (crafted <= EPSILON) return node;

    const step = producerOf(item);
    if (!step) {
      node.byproduct = crafted;
    } else if (path.includes(item) || path.length > MAX_TREE_DEPTH) {
      node.loop = true;
    } else {
      node.step = step;
      node.share = crafted / craftedDemand;
      node.children = Object.entries(step.inputs).map(([input, inputQty]) =>
        branch(input, inputQty * node.share, [...path, item]),
      );
    }
    return node;
  }

  return Object.entries(plan.targets).map(([item, qty]) => branch(item, qty, []));
}

export type ItemSection = "outputs" | "intermediates" | "raw" | "stock" | "leftover";
const SECTION_ORDER: readonly ItemSection[] = ["outputs", "intermediates", "raw", "stock", "leftover"];

export interface ItemRow {
  item: string;
  needed: number;
  step: Step | null;
  raw: number;
  stock: number;
  leftover: number;
  source: RawSource | null;
  section: ItemSection;
}

export interface ItemSectionRows {
  key: ItemSection;
  rows: ItemRow[];
}

function sectionOf(plan: Plan, item: string, step: Step | null): ItemSection {
  if (item in plan.targets) return "outputs";
  if (step) return "intermediates";
  if ((plan.raw[item] ?? 0) > EPSILON) return "raw";
  if ((plan.stockUsed[item] ?? 0) > EPSILON) return "stock";
  return "leftover";
}

export function itemRows(plan: Plan): ItemSectionRows[] {
  const stepByRecipe = new Map<number, Step>(plan.steps.map((s) => [s.recipe, s]));
  const demand = demandOf(plan);
  const keys = new Set([...Object.keys(demand), ...Object.keys(plan.leftover)]);
  const rows = [...keys].map((item): ItemRow => {
    const chosen = currentChoice(item);
    const step = (chosen === "raw" ? undefined : stepByRecipe.get(chosen)) ?? null;
    return {
      item,
      needed: demand[item] ?? 0,
      step,
      raw: plan.raw[item] ?? 0,
      stock: plan.stockUsed[item] ?? 0,
      leftover: plan.leftover[item] ?? 0,
      source: rawSourceOf(plan, item),
      section: sectionOf(plan, item, step),
    };
  });
  rows.sort((a, b) => SECTION_ORDER.indexOf(a.section) - SECTION_ORDER.indexOf(b.section) || b.needed - a.needed);
  return SECTION_ORDER.map((key) => ({ key, rows: rows.filter((r) => r.section === key) })).filter((g) => g.rows.length > 0);
}

export interface BuildingPart {
  item: string;
  /** Buildings per year, or crafts in totals. */
  value: number;
}

export interface BuildingGroup {
  building: string;
  exact: number;
  /** Each step rounded up to whole buildings. */
  whole: number;
  crafts: number;
  /** Building-days of work. */
  days: number;
  parts: BuildingPart[];
}

export interface BuildingTable {
  list: BuildingGroup[];
  cost: Quantities;
}

function wholeBuildings(exact: number): number {
  return Math.max(1, Math.ceil(exact - EPSILON));
}

export function buildingRows(plan: Plan): BuildingTable {
  const groups = new Map<string, BuildingGroup>();
  function groupFor(building: string): BuildingGroup {
    let group = groups.get(building);
    if (!group) {
      group = { building, exact: 0, whole: 0, crafts: 0, days: 0, parts: [] };
      groups.set(building, group);
    }
    return group;
  }

  for (const step of plan.steps) {
    const group = groupFor(step.building);
    const main = Object.keys(step.outputs)[0] ?? step.building;
    if (isRateStep(step)) {
      group.exact += step.buildings;
      group.whole += wholeBuildings(step.buildings);
      group.parts.push({ item: main, value: step.buildings });
    } else {
      group.crafts += step.crafts;
      group.days += step.buildingDays;
      group.parts.push({ item: main, value: step.crafts });
    }
  }
  if (plan.mode === "rate") {
    for (const [item, src] of Object.entries(plan.rawSources)) {
      const group = groupFor(recipe(src.recipe).building);
      group.exact += src.buildings;
      group.whole += wholeBuildings(src.buildings);
      group.parts.push({ item, value: src.buildings });
    }
  }
  const rate = plan.mode === "rate";
  const list = [...groups.values()].sort((a, b) => (rate ? b.whole - a.whole : b.days - a.days));

  // Construction cost of the rounded-up buildings, using their default recipes.
  const cost: Quantities = {};
  if (rate) {
    for (const group of list) {
      const id = gameData().defaults[group.building];
      if (id == null) continue;
      const built = recipe(id);
      const perCraft = built.outputs[group.building] ?? 1;
      for (const [item, qty] of Object.entries(built.inputs)) {
        addTo(cost, item, (qty * group.whole) / perCraft);
      }
    }
  }
  return { list, cost };
}
