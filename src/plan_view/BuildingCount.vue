<template>
  <span class="bcount">
    <b>{{ fmt(whole, 0) }} ×</b>
    <span v-if="Math.abs(value - whole) > 1e-6" class="muted">{{ fmt(value) }} · {{ t("load", { p: load }) }}</span>
  </span>
</template>

<script setup lang="ts">
// Rounded up, with the exact figure and the load.
import { computed } from "vue";

import { fmt, t } from "../state/store";

const props = defineProps<{ value: number }>();

const whole = computed(() => Math.max(1, Math.ceil(props.value - 1e-9)));
const load = computed(() => Math.round((props.value / whole.value) * 100));
</script>
