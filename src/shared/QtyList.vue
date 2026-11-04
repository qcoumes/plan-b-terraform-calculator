<template>
  <div class="qty-list">
    <div v-for="(row, i) in rows" :key="i" class="qty-row">
      <ItemPicker :model-value="row.item" @update:model-value="update(i, { item: $event })" />
      <input
        class="qty-input"
        type="number"
        min="0"
        :step="fraction ? 'any' : 1"
        :value="row.qty"
        @input="onQty(i, $event)"
      >
      <button
        class="icon-btn"
        type="button"
        :title="t('remove')"
        :aria-label="t('remove')"
        @click="remove(i)"
      >
        ×
      </button>
    </div>
    <button class="link-btn" type="button" @click="add">+ {{ t("addItem") }}</button>
  </div>
</template>

<script setup lang="ts">
// Every change emits a new array instead of mutating the prop.
import { QuantityRow } from "../engine/types";
import { t } from "../state/store";
import ItemPicker from "./ItemPicker.vue";

defineProps<{ fraction?: boolean }>();
const rows = defineModel<QuantityRow[]>("rows", { required: true });

function add(): void {
  rows.value = [...rows.value, { item: "", qty: 1 }];
}

function remove(index: number): void {
  rows.value = rows.value.toSpliced(index, 1);
}

function update(index: number, patch: Partial<QuantityRow>): void {
  rows.value = rows.value.map((row, i) => (i === index ? { ...row, ...patch } : row));
}

// Like v-model.number: keeps the raw text while it isn't a number yet ("1.").
function onQty(index: number, event: Event): void {
  const input = event.target;
  if (!(input instanceof HTMLInputElement)) return;
  update(index, { qty: Number.isNaN(input.valueAsNumber) ? input.value : input.valueAsNumber });
}
</script>
