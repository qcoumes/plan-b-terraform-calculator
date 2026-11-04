// Most tests use tests/fixtures/fixture-data.json, a tiny fake game. The last
// group needs the real src/assets/data.json and is skipped without it.
import assert from "node:assert/strict";
import fs from "node:fs";
import { describe, test } from "vitest";

import { CalcError, GameData, Plan, Planner, RawGameData, prepareData, toQuantities } from "../src/engine/engine";

function readJson(url: URL): unknown {
  return JSON.parse(fs.readFileSync(url, "utf8"));
}

function recipeId(data: GameData, building: string, output?: string): number {
  const found = data.recipes.find((r) => r.building === building && (!output || output in r.outputs));
  return found!.id;
}

function close(actual: number, expected: number, message: string): void {
  assert.ok(Math.abs(actual - expected) < 1e-9, `${message}: ${actual} != ${expected}`);
}

// The fixture is a hand-written, valid data file: prepareData() checks it below.
const rawFixture = readJson(new URL("fixtures/fixture-data.json", import.meta.url)) as RawGameData;
const fixture = prepareData(rawFixture);

function stepFor<P extends Plan>(result: P, building: string, output: string): P["steps"][number] {
  const step = result.steps.find((s) => s.building === building && output in s.outputs);
  assert.ok(step, `no ${building} step making ${output}`);
  return step;
}

describe("data", () => {
  function withRecipe(patch: { [field: string]: unknown }): unknown {
    const recipe = { id: 99, building: "factory", inputs: {}, outputs: { steel: 1 }, days: 10, ...patch };
    return { ...rawFixture, recipes: [...rawFixture.recipes, recipe] };
  }

  test("items get their key and defaults", () => {
    const steel = fixture.items.steel!;
    assert.equal(steel.key, "steel");
    assert.equal(steel.names.fr, "Acier");
    assert.equal(steel.isBuilding, false);
    assert.equal(fixture.recipeById[1]!.locked, true);
    assert.equal(fixture.recipeById[0]!.synthetic, false);
  });

  test("default recipes", () => {
    assert.equal(fixture.defaults.iron, null); // an extractor makes it from nothing
    assert.ok(!("carbon" in fixture.defaults)); // nothing makes it
    const steelDefault = fixture.defaults.steel!;
    assert.deepEqual(fixture.recipeById[steelDefault]!.inputs, { iron: 3 }); // first unlocked
    assert.deepEqual(fixture.producers.steel, [0, 1, 4]);
  });

  test("raw sources prefer synthetic extractor recipes", () => {
    assert.equal(fixture.sources.iron, 7);
    assert.equal(fixture.sources.crystal, 5);
    assert.equal(fixture.sources.steel, null);
  });

  test("recipe ids are keys, not positions", () => {
    const shuffled = prepareData({ ...rawFixture, recipes: [...rawFixture.recipes].reverse().map((r) => ({ ...r, id: r.id + 100 })) });
    assert.equal(shuffled.recipeById[100]!.building, "factory");
    const steelDefault = shuffled.defaults.steel!;
    assert.deepEqual(shuffled.recipeById[steelDefault]!.inputs, { scrap: 5 }); // now first in array order
    assert.deepEqual(new Planner(shuffled, { steel: 100, polymer: 102 }).plan({ gadget: 1 }).raw, { carbon: 3, iron: 3 });
  });

  test("prepared data is reused as is", () => {
    assert.equal(prepareData(fixture), fixture);
  });

  test("invalid data is reported", () => {
    const invalid: { [expectedMessage: string]: unknown } = {
      'missing "recipes"': { items: {} },
      "used twice": withRecipe({ id: 0 }),
      'unknown building "nope"': withRecipe({ building: "nope" }),
      'unknown item "nope" in inputs': withRecipe({ inputs: { nope: 1 } }),
      '"outputs" must map items to numbers > 0': withRecipe({ outputs: { steel: 0 } }),
      '"days" must be a number > 0': withRecipe({ days: null }),
      '"id" must be a whole number': withRecipe({ id: "a" }),
      'item "x" has no English name': { ...rawFixture, items: { ...rawFixture.items, x: { names: { fr: "X" } } } },
    };
    for (const [message, data] of Object.entries(invalid)) {
      assert.throws(() => prepareData(data), (err: unknown) => err instanceof CalcError && err.message.includes(message), message);
    }
  });
});

describe("totals", () => {
  const planner = new Planner(fixture);

  test("requirements with batch rounding", () => {
    const plan = planner.plan({ gadget: 3 });
    // 3 steel -> 9 iron; 3 polymer -> 2 crafts of 3 carbon (one polymer left over)
    assert.deepEqual(plan.raw, { carbon: 6, iron: 9 });
    assert.deepEqual(plan.leftover, { polymer: 1 });
  });

  test("surplus is reused across demands", () => {
    const plan = planner.plan({ gadget: 1, polymer: 1 });
    assert.equal(stepFor(plan, "factory", "polymer").crafts, 1);
    assert.equal(plan.raw.carbon, 3);
  });

  test("stock is used first", () => {
    const plan = planner.plan({ gadget: 2 }, { steel: 1, carbon: 100 });
    assert.deepEqual(plan.raw, { iron: 3 });
    assert.equal(plan.stockUsed.steel, 1);
  });

  test("recipe choice with byproducts", () => {
    const recycled = new Planner(fixture, { steel: recipeId(fixture, "recycler") });
    // 1 recycle craft -> 2 steel + 1 polymer, so only 1 polymer still needed (1 carbon craft)
    assert.deepEqual(recycled.plan({ gadget: 2 }).raw, { carbon: 3, scrap: 5 });
  });

  test("building-days", () => {
    assert.equal(planner.plan({ steel: 3 }).steps[0]!.buildingDays, 30);
  });

  test("invalid choices and levels are rejected", () => {
    assert.throws(() => new Planner(fixture, { steel: 999 }), CalcError);
    assert.throws(() => new Planner(fixture, { nope: "raw" }), CalcError);
    assert.throws(() => new Planner(fixture, {}, -1), CalcError);
  });
});

describe("per year", () => {
  const planner = new Planner(fixture);

  test("buildings per step and raw supply", () => {
    const result = planner.rates({ gadget: 60 });
    // gadget: 5-day cycle -> 60 cycles/year per building -> 1 building for 60/year
    close(stepFor(result, "factory", "gadget").buildings, 1, "gadget");
    // steel: 60/year, 10-day cycle = 30/year per building -> 2 buildings
    close(stepFor(result, "factory", "steel").buildings, 2, "steel");
    // polymer: 60/year = 30 crafts (2 per craft), no rounding up in rate mode
    close(stepFor(result, "factory", "polymer").cyclesPerYear, 30, "polymer");
    assert.deepEqual(result.raw, { carbon: 90, iron: 180 });
    close(result.rawSources.iron!.buildings, 12, "iron extractors (15/year each)");
    assert.ok(!("carbon" in result.rawSources), "nothing makes carbon");
  });

  test("available inputs are used first", () => {
    const result = planner.rates({ gadget: 60 }, { steel: 30 });
    assert.deepEqual(result.stockUsed, { steel: 30 });
    assert.equal(result.raw.iron, 90);
  });

  test("extraction upgrade boosts extractors", () => {
    const result = new Planner(fixture, {}, 5).rates({ iron: 150 });
    close(result.rawSources.iron!.buildings, 150 / 15 / 1.5, "level 5");
  });

  test("extractor as an explicit step", () => {
    const extractor = new Planner(fixture, { iron: fixture.sources.iron! }, 10);
    const step = extractor.rates({ iron: 30 }).steps[0]!;
    close(step.buildings, 1, "15/year x2");
    close(step.outputs.iron!, 30, "output");
  });
});

describe("quantities", () => {
  test("rows are summed and validated", () => {
    assert.deepEqual(toQuantities(fixture, [{ item: "steel", qty: 2 }, { item: "steel", qty: 3.7 }, { item: "", qty: 1 }]), { steel: 5 });
    assert.deepEqual(toQuantities(fixture, [{ item: "steel", qty: 1.5 }], true), { steel: 1.5 });
    assert.throws(() => toQuantities(fixture, [{ item: "nope", qty: 1 }]), CalcError);
    assert.throws(() => toQuantities(fixture, [{ item: "steel", qty: -1 }]), CalcError);
  });
});

const DATA_JSON = new URL("../src/assets/data.json", import.meta.url);
const realData = fs.existsSync(DATA_JSON) ? prepareData(readJson(DATA_JSON)) : null;

describe.skipIf(!realData)("real game data", () => {
  // Vitest still runs this callback when skipping, so look the data up in each test.
  function real(): GameData {
    return realData!;
  }

  test("game timings", () => {
    const days = new Map<string, Set<number>>();
    for (const r of real().recipes) {
      days.set(r.building, new Set([...(days.get(r.building) ?? []), r.days]));
    }
    function sorted(building: string): number[] {
      return [...(days.get(building) ?? [])].sort((a, b) => a - b);
    }
    assert.ok(days.get("factory")?.has(10));
    assert.deepEqual(sorted("factoryAssemblyPlant"), [30, 300]); // defenseShield has an explicit 300
    assert.deepEqual(sorted("factoryAtmExtractor"), [15]);
    assert.deepEqual(sorted("pumpingStation"), [10]);
    assert.deepEqual(sorted("extractor"), [20]);
  });

  test("names and UI strings", () => {
    const data = real();
    assert.equal(data.items.supraConductor?.names.en, "Superconductor");
    assert.equal(data.items.factory?.names.de, "Fabrik");
    assert.equal(data.daysPerYear, 300);
    assert.ok(data.ui.UI_Selection_Progress?.en.includes("{0}"));
  });

  test("500 robotics", () => {
    assert.deepEqual(new Planner(real()).plan({ robotics: 500 }).raw, { aluminumOre: 500, carbon: 750, supraConductor: 250 });
  });

  test("60 robotics per year", () => {
    const result = new Planner(real()).rates({ robotics: 60 });
    assert.deepEqual(result.steps.map((s) => Math.round(s.buildings * 1e6) / 1e6), [1, 1, 1, 1]);
    assert.deepEqual(result.raw, { aluminumOre: 60, carbon: 90, supraConductor: 30 });
    close(result.rawSources.aluminumOre!.buildings, 4, "extractors");
    close(result.rawSources.carbon!.buildings, 4.5, "atmospheric extractors");
    close(result.rawSources.supraConductor!.buildings, 2.5, "energy labs");
  });

  test("every item can be planned", () => {
    const data = real();
    const planner = new Planner(data);
    for (const item of Object.keys(data.producers)) {
      planner.plan({ [item]: 7 });
      planner.rates({ [item]: 7.5 });
    }
  });
});
