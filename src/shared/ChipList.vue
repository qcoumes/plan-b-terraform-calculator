<template>
  <div class="chips">
    <ItemChip
      v-for="(qty, item) in items"
      :key="item"
      :item="String(item)"
      :qty="qty"
      :sign="sign"
      :size="size"
    />
    <span v-if="!Object.keys(items).length && empty" class="muted">{{ empty }}</span>
  </div>
</template>

<script setup lang="ts">
import { Quantities } from "../engine/types";
import ItemChip from "./ItemChip.vue";

withDefaults(defineProps<{ items: Quantities; sign?: string; empty?: string; size?: number }>(), {
  sign: "",
  empty: "",
  size: 24,
});
</script>
