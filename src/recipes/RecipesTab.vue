<template>
  <section class="card">
    <div class="filters">
      <input v-model="query" type="search" :placeholder="t('search')">
      <div class="segmented recipes-unit">
        <button type="button" :class="{ active: yearly }" @click="yearly = true">{{ t("modeRate") }}</button>
        <button type="button" :class="{ active: !yearly }" @click="yearly = false">{{ t("recipesPerCycle") }}</button>
      </div>
    </div>
    <p class="hint recipes-caption">
      {{ yearly ? t("recipesUnitYear") : t("recipesUnitCycle") }}
      <template v-if="yearly && level"> · {{ t("recipesExtraction", { n: level }) }}</template>
    </p>
    <div class="building-filter">
      <button type="button" class="bf" :class="{ current: !building }" @click="building = ''">{{ t("allBuildings") }}</button>
      <button
        v-for="b in buildings"
        :key="b"
        type="button"
        class="bf"
        :class="{ current: building === b }"
        :title="itemName(b)"
        @click="building = building === b ? '' : b"
      >
        <GameIcon :item="b" :size="32" />
        <span v-if="building === b">{{ itemName(b) }}</span>
      </button>
    </div>
    <ul class="recipe-list">
      <li v-for="r in filtered" :key="r.id" class="recipe-row">
        <div class="step-building">
          <GameIcon :item="r.building" :size="40" />
          <div>
            <div class="step-building-name">{{ itemName(r.building) }}</div>
            <div class="step-crafts">
              <span>
                {{ gameText("UI_Selection_Progress", fmt(r.days)) }} ·
                {{ gameText("UI_Selection_Factory_Progress", fmt(data.daysPerYear / r.days)) }}
              </span>
              <span v-if="r.synthetic" class="tag">{{ t("gameDerived") }}</span>
              <span v-if="r.locked" class="tag">{{ t("locked") }}</span>
            </div>
          </div>
        </div>
        <div class="step-flow">
          <ChipList :items="scaled(r, 'inputs')" :empty="t('fromNothing')" />
          <span class="flow-arrow" aria-hidden="true">→</span>
          <ChipList :items="scaled(r, 'outputs')" />
        </div>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";

import { Quantities, Recipe } from "../engine/types";
import { storageGet, storageSet } from "../state/storage";
import { extractionLevel, fmt, gameData, gameText, intlLocale, itemName, normalize, t } from "../state/store";
import ChipList from "../shared/ChipList.vue";
import GameIcon from "../shared/GameIcon.vue";

const data = computed(() => gameData());
const query = ref("");
const building = ref("");

const buildings = computed(() => {
  const keys = [...new Set(data.value.recipes.map((r) => r.building))];
  const collator = new Intl.Collator(intlLocale());
  return keys.sort((a, b) => collator.compare(itemName(a), itemName(b)));
});

const filtered = computed(() => {
  const q = normalize(query.value.trim());
  return data.value.recipes.filter((r) => {
    if (building.value && r.building !== building.value) return false;
    if (!q) return true;
    const keys = [r.building, ...Object.keys(r.inputs), ...Object.keys(r.outputs)];
    return keys.some((k) => normalize(itemName(k)).includes(q) || k.toLowerCase().includes(q));
  });
});

const yearly = ref(storageGet("planb.recipes.perYear", true));
watch(yearly, (v) => { storageSet("planb.recipes.perYear", v); });
const level = computed(() => extractionLevel());

// One building running all year: cycles per year x quantity per cycle, plus the
// extraction bonus (+10% per level) on extractor outputs.
function scaled(r: Recipe, side: "inputs" | "outputs"): Quantities {
  const list = r[side];
  if (!yearly.value || !r.days) return list;
  const cycles = data.value.daysPerYear / r.days;
  const bonus = side === "outputs" && r.extraction ? 1 + 0.1 * level.value : 1;
  return Object.fromEntries(Object.entries(list).map(([k, v]) => [k, v * cycles * bonus]));
}
</script>
