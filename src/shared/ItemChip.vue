<template>
  <span class="chip" :title="itemName(item)">
    <GameIcon :item="item" :size="size" />
    <b v-if="qty != null">{{ sign }}{{ fmt(qty) }}</b>
    <span class="chip-name">{{ itemName(item) }}</span>
  </span>
</template>

<script setup lang="ts">
import { fmt, itemName } from "../state/store";
import GameIcon from "./GameIcon.vue";

withDefaults(defineProps<{ item: string; qty?: number | null; sign?: string; size?: number }>(), {
  qty: null,
  sign: "",
  size: 24,
});
</script>
