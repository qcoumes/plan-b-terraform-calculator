<template>
  <div class="options">
    <label class="opt">
      <span class="opt-label">{{ t("extractionLevel") }}</span>
      <input
        v-model.number="store.extractionLevel"
        class="qty-input level-input"
        type="number"
        min="0"
        step="1"
      >
      <span class="hint">{{ t("extractionHint") }}</span>
    </label>
    <div class="opt">
      <span class="opt-label">{{ t("recipeChoices") }}</span>
      <span class="hint">{{ customCount ? t("customChoices", { n: customCount }) : t("noCustomChoices") }}</span>
      <button v-if="customCount" class="link-btn" type="button" @click="resetChoices">{{ t("resetChoices") }}</button>
    </div>
    <div class="opt">
      <span class="opt-label">{{ t("dataSource") }}</span>
      <span class="hint">
        {{ t("recipesLoaded", { r: data.recipes.length, i: Object.keys(data.items).length }) }} <code>data.json</code>
      </span>
      <span v-if="data.game.version" class="hint">
        {{ t("gameVersion", { v: data.game.version, b: data.game.build ?? "?" }) }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

import { gameData, store, t } from "../state/store";

const customCount = computed(() => Object.keys(store.choices).length);
function resetChoices(): void {
  for (const item of Object.keys(store.choices)) {
    delete store.choices[item];
  }
}
const data = computed(() => gameData());
</script>
