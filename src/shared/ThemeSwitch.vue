<template>
  <button
    type="button"
    role="switch"
    class="theme-switch"
    :aria-checked="model === 'dark'"
    :aria-label="t('darkMode')"
    :title="t('darkMode')"
    @click="model = model === 'dark' ? 'light' : 'dark'"
  >
    <span class="theme-switch-knob" aria-hidden="true">
      <svg v-if="model === 'dark'" viewBox="0 0 24 24">
        <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" fill="currentColor" />
      </svg>
      <svg v-else viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="4.5" fill="currentColor" />
        <path
          d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
        />
      </svg>
    </span>
  </button>
</template>

<script setup lang="ts">
import { Theme, t } from "../state/store";

const model = defineModel<Theme>({ required: true });
</script>
