<template>
  <select
    v-if="options.length > 1"
    v-model="value"
    class="recipe-choice"
    :class="{ custom }"
    :title="itemName(item)"
  >
    <option v-for="o in options" :key="o.value" :value="o.value">{{ o.label }}</option>
  </select>
</template>

<script setup lang="ts">
import { computed } from "vue";

import { Choice, Quantities } from "../engine/types";
import { currentChoice, defaultChoice, fmt, gameData, gameText, itemName, recipe, setChoice, store, t } from "../state/store";

const props = defineProps<{ item: string }>();

// "3 Iron Ore + 1 Carbon"
function describe(quantities: Quantities): string {
  return Object.entries(quantities)
    .map(([item, qty]) => `${qty} ${itemName(item)}`)
    .join(" + ");
}

// "Factory: 3 Iron Ore → 1 Steel Bar · Process duration: 10 days (default)"
function label(id: number, defaultId: Choice): string {
  const r = recipe(id);
  const flags = [id === defaultId ? t("default") : null, r.locked ? t("locked") : null].filter(Boolean);
  const duration = ` · ${gameText("UI_Selection_Progress", fmt(r.days))}`;
  const suffix = flags.length > 0 ? ` (${flags.join(", ")})` : "";
  return `${itemName(r.building)}: ${describe(r.inputs) || t("fromNothing")} → ${describe(r.outputs)}${duration}${suffix}`;
}

const options = computed(() => {
  const defaultId = defaultChoice(props.item);
  return [
    { value: "raw", label: t("raw") + (defaultId === "raw" ? ` (${t("default")})` : "") },
    ...(gameData().producers[props.item] ?? []).map((id) => ({ value: id, label: label(id, defaultId) })),
  ];
});

const value = computed<Choice>({
  get: () => currentChoice(props.item),
  set: (v) => { setChoice(props.item, v === "raw" ? "raw" : Number(v)); },
});

const custom = computed(() => props.item in store.choices);
</script>
