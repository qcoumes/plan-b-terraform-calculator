<template>
  <div class="result-panel">
    <PanelTabs v-model="store.resultTab" :tabs="tabs" />
    <div class="pbody" :class="{ flush: store.resultTab === 'graph' }">
      <p v-if="empty" class="muted pad">{{ t("nothingToGather") }}</p>
      <FlowGraph v-else-if="store.resultTab === 'graph'" :plan="plan" />
      <StepsTree v-else-if="store.resultTab === 'tree'" :plan="plan" />
      <ItemsTable v-else-if="store.resultTab === 'items'" :plan="plan" />
      <BuildingsTable v-else :plan="plan" />
    </div>
    <footer class="pfoot">
      {{ footer }}
      <span v-if="Object.keys(plan.leftover).length" class="pfoot-left">
        {{ t("leftover") }}: <ChipList :items="plan.leftover" sign="+" />
      </span>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

import { Plan } from "../engine/types";
import { buildingRows } from "./view_models";
import { fmt, store, t, ResultTab } from "../state/store";
import BuildingsTable from "./BuildingsTable.vue";
import ChipList from "../shared/ChipList.vue";
import FlowGraph from "./FlowGraph.vue";
import ItemsTable from "./ItemsTable.vue";
import PanelTabs, { PanelTab } from "../shared/PanelTabs.vue";
import StepsTree from "./StepsTree.vue";

const props = defineProps<{ plan: Plan }>();

const tabs = computed((): Array<PanelTab<ResultTab>> => [
  { key: "graph", icon: "⎇", label: t("viewGraph") },
  { key: "tree", icon: "☰", label: t("viewTree") },
  { key: "items", icon: "▦", label: t("resItems") },
  { key: "buildings", icon: "⌂", label: t("resBuildings") },
]);

const footer = computed(() => {
  const plan = props.plan;
  if (plan.mode === "rate") {
    const buildings = buildingRows(plan).list.reduce((n, g) => n + g.whole, 0);
    return `⌂ ${t("buildingsTotal", { n: fmt(buildings, 0) })}`;
  }
  const crafts = plan.steps.reduce((n, s) => n + s.crafts, 0);
  const days = plan.steps.reduce((n, s) => n + s.buildingDays, 0);
  return `${t("craftsShort", { n: fmt(crafts) })} · ${t("buildingDaysTotal", { d: fmt(days, 0) })}`;
});

const empty = computed(() => !props.plan.steps.length && !Object.keys(props.plan.raw).length);
</script>
