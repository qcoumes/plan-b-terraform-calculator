<template>
  <div ref="root" class="picker" @keydown.esc.stop="open = false">
    <button
      type="button"
      class="picker-button"
      :class="{ empty: !model }"
      :aria-expanded="open"
      :title="model ? itemName(model) : ''"
      @click="toggle"
    >
      <GameIcon v-if="model" :item="model" :size="28" />
      <span class="picker-label">{{ model ? itemName(model) : t("pickItem") }}</span>
      <span class="caret" aria-hidden="true">▾</span>
    </button>
    <div v-if="open" class="picker-pop" role="dialog" :style="popStyle">
      <input
        ref="search"
        v-model="query"
        type="search"
        class="picker-search"
        :placeholder="t('searchItems')"
        @keydown.enter.prevent="pickFirst"
      >
      <div class="picker-scroll">
        <section v-for="g in filteredGroups" :key="g.key">
          <h4>{{ g.label }}</h4>
          <div class="picker-grid">
            <button
              v-for="k in g.items"
              :key="k"
              type="button"
              class="picker-tile"
              :class="{ current: k === model }"
              :title="itemName(k)"
              @click="pick(k)"
            >
              <GameIcon :item="k" :size="40" />
              <span>{{ itemName(k) }}</span>
            </button>
          </div>
        </section>
        <p v-if="!filteredGroups.length" class="muted">{{ t("noMatch") }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, CSSProperties } from "vue";

import { groupedItems, itemName, normalize, t } from "../state/store";
import GameIcon from "./GameIcon.vue";

const model = defineModel<string>({ default: "" });

const open = ref(false);
const query = ref("");
const root = ref<HTMLElement | null>(null);
const search = ref<HTMLInputElement | null>(null);
const popStyle = ref<CSSProperties>({});

// Fixed positioning so the popover isn't clipped by scrolling side panels.
function place() {
  const rect = root.value?.getBoundingClientRect();
  if (!rect) return;
  const below = window.innerHeight - rect.bottom - 16;
  const up = below < 320 && rect.top > below;
  popStyle.value = {
    position: "fixed",
    left: `${Math.min(rect.left, window.innerWidth - 456)}px`,
    ...(up ? { bottom: `${window.innerHeight - rect.top + 6}px` } : { top: `${rect.bottom + 6}px` }),
    "--pop-max": `${Math.min(420, (up ? rect.top : below) - 70)}px`,
  };
}

const filteredGroups = computed(() => {
  const q = normalize(query.value.trim());
  return groupedItems.value
    .map((g) => ({
      ...g,
      items: q ? g.items.filter((k) => normalize(itemName(k)).includes(q) || k.toLowerCase().includes(q)) : g.items,
    }))
    .filter((g) => g.items.length);
});

async function toggle() {
  open.value = !open.value;
  if (open.value) {
    place();
    query.value = "";
    await nextTick();
    search.value?.focus();
  }
}

function pick(key: string) {
  model.value = key;
  open.value = false;
}

function pickFirst() {
  const first = filteredGroups.value[0]?.items[0];
  if (first) pick(first);
}

function onDocClick(e: MouseEvent) {
  if (open.value && root.value && !root.value.contains(e.target as Node)) open.value = false;
}

function onScroll(e: Event) {
  const target = e.target instanceof Element ? e.target : null;
  if (open.value && !target?.closest(".picker-pop")) open.value = false;
}

onMounted(() => {
  document.addEventListener("mousedown", onDocClick);
  window.addEventListener("scroll", onScroll, true);
  window.addEventListener("resize", onScroll);
});
onBeforeUnmount(() => {
  document.removeEventListener("mousedown", onDocClick);
  window.removeEventListener("scroll", onScroll, true);
  window.removeEventListener("resize", onScroll);
});
</script>
