<template>
  <li class="tree-node">
    <div class="tree-row">
      <button
        v-if="node.children.length"
        type="button"
        class="twisty"
        :aria-expanded="open"
        @click="open = !open"
      >
        {{ open ? "▾" : "▸" }}
      </button>
      <span v-else class="twisty spacer" />
      <span class="tree-item">
        <GameIcon :item="node.item" :size="34" />
        <span><b>{{ qty(node.qty) }}</b> {{ itemName(node.item) }}</span>
      </span>
      <span v-if="node.step && amount" class="tree-by">
        <span class="tree-arrow" aria-hidden="true">←</span>
        <GameIcon :item="node.step.building" :size="28" />
        <span v-if="rate">
          <b class="tree-count">{{ amount.approx ? "≈ " : "" }}{{ fmt(amount.value) }} ×</b> {{ itemName(node.step.building) }}
          <span class="muted"> · {{ gameText("UI_Selection_Progress", fmt(node.step.days)) }}</span>
        </span>
        <span v-else>
          {{ itemName(node.step.building) }} ·
          <b class="tree-count">{{ amount.approx ? "≈ " : "" }}{{ t("craftsShort", { n: fmt(amount.value) }) }}</b>
          <span class="muted"> · {{ gameText("UI_Selection_Progress", fmt(node.step.days)) }}</span>
        </span>
      </span>
      <span v-if="node.raw > EPSILON" class="badge raw">
        {{ t("treeRaw") }}<template v-if="node.fromStock > EPSILON || node.byproduct > EPSILON || node.step"> {{ qty(node.raw) }}</template>
        <template v-if="node.source">
          · ≈ {{ fmt(node.source.buildings) }} × <GameIcon :item="node.source.building" :size="18" /> {{ itemName(node.source.building) }}
        </template>
      </span>
      <span v-if="node.fromStock > EPSILON" class="badge stock">{{ t("treeStock") }} {{ fmt(node.fromStock) }}</span>
      <span v-if="node.byproduct > EPSILON" class="badge">{{ t("treeByproduct") }}</span>
      <span v-if="node.loop" class="badge warn">{{ t("treeLoop") }}</span>
    </div>
    <ul v-if="open && node.children.length" class="tree-children">
      <TreeNode v-for="child in node.children" :key="child.id" :node="child" :rate="rate" />
    </ul>
  </li>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";

import { EPSILON } from "../engine/engine";
import { TreeBranch, stepAmount } from "./view_models";
import { fmt, gameText, itemName, perYear, store, t } from "../state/store";
import GameIcon from "../shared/GameIcon.vue";

defineOptions({ name: "TreeNode" });

const props = defineProps<{ node: TreeBranch; rate: boolean }>();

const open = ref(true);
watch(
  () => store.treeGeneration,
  (generation) => {
    open.value = generation >= 0;
  },
);

// This branch's share of the step: buildings per year, or crafts.
const amount = computed(() => {
  const step = props.node.step;
  if (!step) return null;
  const value = stepAmount(step) * props.node.share;
  return { value, approx: Math.abs(value - Math.round(value)) >= 1e-6 };
});
function qty(n: number): string {
  return props.rate ? perYear(n) : fmt(n);
}
</script>
