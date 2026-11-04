<template>
  <div class="items-table">
    <section v-for="g in groups" :key="g.key">
      <h4>{{ t(SECTION_TITLES[g.key]) }}</h4>
      <div v-for="r in g.rows" :key="r.item" class="irow">
        <GameIcon :item="r.item" :size="36" />
        <div class="irow-main">
          <div><b>{{ qty(g.key === "leftover" ? r.leftover : r.needed) }}</b> {{ itemName(r.item) }}</div>
          <div class="irow-src">
            <span v-if="r.step" class="tree-by">
              <GameIcon :item="r.step.building" :size="22" />
              <template v-if="isRateStep(r.step)"><BuildingCount :value="r.step.buildings" /> {{ itemName(r.step.building) }}</template>
              <template v-else>
                {{ itemName(r.step.building) }} · <b class="tree-count">{{ t("craftsShort", { n: fmt(r.step.crafts) }) }}</b>
              </template>
              <span class="muted">· ⏱ {{ shortDays(r.step.days) }}</span>
            </span>
            <span
              v-if="r.raw > EPSILON"
              class="badge raw"
            >{{ t("treeRaw") }}
              <template v-if="r.source">
                · ≈ {{ fmt(r.source.buildings) }} × <GameIcon :item="sourceBuilding(r.source.recipe)" :size="18" />
                {{ itemName(sourceBuilding(r.source.recipe)) }}
              </template>
            </span>
            <span v-if="r.stock > EPSILON" class="badge stock">{{ t("treeStock") }} {{ qty(r.stock) }}</span>
            <span v-if="r.leftover > EPSILON && g.key !== 'leftover'" class="badge">{{ t("leftover") }} +{{ qty(r.leftover) }}</span>
          </div>
        </div>
        <RecipeChoice :item="r.item" />
      </div>
    </section>
  </div>
</template>

<script lang="ts">
import { MessageKey } from "../i18n/messages";
import { ItemSection } from "./view_models";

const SECTION_TITLES: Record<ItemSection, MessageKey> = {
  outputs: "sec_outputs",
  intermediates: "sec_intermediates",
  raw: "sec_raw",
  stock: "sec_stock",
  leftover: "sec_leftover",
};
</script>

<script setup lang="ts">
import { computed } from "vue";

import { EPSILON, Plan } from "../engine/engine";
import { isRateStep, itemRows } from "./view_models";
import { fmt, itemName, perYear, recipe, shortDays, t } from "../state/store";
import BuildingCount from "./BuildingCount.vue";
import GameIcon from "../shared/GameIcon.vue";
import RecipeChoice from "../shared/RecipeChoice.vue";

const props = defineProps<{ plan: Plan }>();

const groups = computed(() => itemRows(props.plan));
function qty(n: number): string {
  return props.plan.mode === "rate" ? perYear(n) : fmt(n);
}

function sourceBuilding(recipeId: number): string {
  return recipe(recipeId).building;
}
</script>
