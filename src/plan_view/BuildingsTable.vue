<template>
  <div class="buildings-table">
    <div v-for="g in rows.list" :key="g.building" class="brow">
      <GameIcon :item="g.building" :size="40" />
      <div class="brow-name">
        <template v-if="rate">
          <b class="tree-count">{{ fmt(g.whole, 0) }} ×</b> {{ itemName(g.building) }}
          <div v-if="Math.abs(g.exact - g.whole) > 1e-6" class="muted small">{{ fmt(g.exact) }}</div>
        </template>
        <template v-else>
          {{ itemName(g.building) }}
          <div class="muted small">
            {{ t("craftsShort", { n: fmt(g.crafts) }) }} · {{ t("oneBuilding", { d: fmt(g.days, 0), y: fmt(years(g.days), 1) }) }}
          </div>
        </template>
      </div>
      <div class="brow-parts">
        <span v-for="p in g.parts" :key="p.item" class="mini-part" :title="itemName(p.item)">
          {{ rate ? "×" : "" }}{{ fmt(p.value) }} <GameIcon :item="p.item" :size="22" />
        </span>
      </div>
    </div>
    <section v-if="Object.keys(rows.cost).length" class="bcost">
      <h4>{{ t("constructionCost") }}</h4>
      <p class="muted small">{{ t("constructionHint") }}</p>
      <ChipList :items="rows.cost" />
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

import { Plan } from "../engine/types";
import { buildingRows } from "./view_models";
import { fmt, gameData, itemName, t } from "../state/store";
import ChipList from "../shared/ChipList.vue";
import GameIcon from "../shared/GameIcon.vue";

const props = defineProps<{ plan: Plan }>();

const rate = computed(() => props.plan.mode === "rate");
const rows = computed(() => buildingRows(props.plan));
function years(days: number): number {
  return days / gameData().daysPerYear;
}
</script>
