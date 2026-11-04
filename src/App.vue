<template>
  <header class="topbar">
    <h1>
      <GameIcon v-if="store.data" item="spaceliftGroundbase" :size="32" />
      {{ APP_TITLE }}
    </h1>
    <nav v-if="store.data" class="tabs">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        type="button"
        :class="{ active: store.tab === tab.key }"
        @click="store.tab = tab.key"
      >
        <GameIcon :item="tab.icon" :size="22" />
        {{ t(tab.label) }}
      </button>
    </nav>
    <div class="topbar-settings">
      <LanguageFlags v-model="store.lang" />
      <span class="topbar-separator" aria-hidden="true" />
      <ThemeSwitch :model-value="store.theme" @update:model-value="setTheme" />
    </div>
  </header>

  <main :class="{ 'main-planner': store.tab !== 'recipes' }">
    <p v-if="store.loadError || !store.data" class="error">{{ t("noData", { e: store.loadError ?? "?" }) }}</p>
    <template v-else>
      <NeedTab v-show="store.tab === 'need'" />
      <RecipesTab v-if="store.tab === 'recipes'" />
    </template>
  </main>

  <footer class="app-footer">
    <p v-if="store.data && store.tab === 'recipes'">
      {{ t("recipesLoaded", { r: store.data.recipes.length, i: Object.keys(store.data.items).length }) }}
      <code>data.json</code>
    </p>
    <p>{{ t("copyright", { developer: GAME_DEVELOPER }) }}</p>
  </footer>
</template>

<script lang="ts">
// Not translated.
const APP_TITLE = "Plan B: Terraform - Calculator";

// As named in the game's Plan B Terraform_Data/app.info.
const GAME_DEVELOPER = "Gaddy Games";
</script>

<script setup lang="ts">
import rawData from "./assets/data.json";
import { prepareData } from "./engine/engine";
import { MessageKey } from "./i18n/messages";
import { iconUrl } from "./shared/icons";
import { MainTab, setTheme, store, t } from "./state/store";
import GameIcon from "./shared/GameIcon.vue";
import NeedTab from "./need/NeedTab.vue";
import RecipesTab from "./recipes/RecipesTab.vue";
import LanguageFlags from "./shared/LanguageFlags.vue";
import ThemeSwitch from "./shared/ThemeSwitch.vue";

const tabs: Array<{ key: MainTab; icon: string; label: MessageKey }> = [
  { key: "need", icon: "robotics", label: "tabNeed" },
  { key: "recipes", icon: "factoryAssemblyPlant", label: "tabRecipes" },
];

// data.json is edited by hand, so it's still checked even though it's bundled.
try {
  store.data = prepareData(rawData);
  store.loadError = null;
} catch (err) {
  store.data = null;
  store.loadError = err instanceof Error ? err.message : String(err);
}

const favicon = iconUrl(store.data?.items.factory?.icon);
const link = document.getElementById("favicon");
if (favicon && link instanceof HTMLLinkElement) link.href = favicon;
</script>
