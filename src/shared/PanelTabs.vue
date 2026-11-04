<template>
  <nav class="ptabs" role="tablist">
    <button
      v-for="tab in tabs"
      :key="tab.key"
      type="button"
      role="tab"
      :class="{ active: model === tab.key }"
      :aria-selected="model === tab.key"
      @click="model = tab.key"
    >
      <span class="ptab-icon" aria-hidden="true">{{ tab.icon }}</span>{{ tab.label }}
    </button>
  </nav>
</template>

<script lang="ts">
export interface PanelTab<Key extends string = string> {
  key: Key;
  icon: string;
  label: string;
}
</script>

<script setup lang="ts" generic="K extends string">
defineProps<{ tabs: Array<PanelTab<K>> }>();
const model = defineModel<K>({ required: true });
</script>
