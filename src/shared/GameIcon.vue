<template>
  <img
    v-if="src"
    class="game-icon"
    :src="src"
    :width="size"
    :height="size"
    alt=""
    draggable="false"
  >
  <span
    v-else
    class="game-icon fallback"
    :class="'g-' + itemGroup(item)"
    :style="{ width: size + 'px', height: size + 'px', fontSize: size * 0.38 + 'px' }"
  >{{ monogram }}</span>
</template>

<script setup lang="ts">
// Falls back to a monogram when the item has no icon.
import { computed } from "vue";

import { iconUrl } from "./icons";
import { itemGroup, itemName, store } from "../state/store";

const props = withDefaults(defineProps<{ item: string; size?: number }>(), { size: 28 });

const src = computed(() => iconUrl(store.data?.items[props.item]?.icon));
const monogram = computed(() =>
  itemName(props.item)
    .split(/\s+/)
    .map((w) => w[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase(),
);
</script>
