<template>
  <div class="tree">
    <div class="tree-tools">
      <span class="muted">{{ t("treeHint") }}</span>
      <span class="tree-buttons">
        <button type="button" class="link-btn" @click="setAll(true)">{{ t("expandAll") }}</button>
        <button type="button" class="link-btn" @click="setAll(false)">{{ t("collapseAll") }}</button>
      </span>
    </div>
    <ul class="tree-root">
      <TreeNode v-for="root in roots" :key="root.id" :node="root" :rate="rate" />
    </ul>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

import { Plan } from "../engine/types";
import { buildTree } from "./view_models";
import { store, t } from "../state/store";
import TreeNode from "./TreeNode.vue";

const props = defineProps<{ plan: Plan }>();

const roots = computed(() => buildTree(props.plan));
const rate = computed(() => props.plan.mode === "rate");

function setAll(open: boolean) {
  const g = Math.abs(store.treeGeneration) + 1;
  store.treeGeneration = open ? g : -g;
}
</script>
