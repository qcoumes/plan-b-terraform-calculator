<template>
  <div class="lang-flags" role="group" aria-label="Language">
    <button
      v-for="language in LANGUAGES"
      :key="language.code"
      type="button"
      class="lang-flag"
      :class="{ current: language.code === model }"
      :title="language.name"
      :aria-label="language.name"
      :aria-pressed="language.code === model"
      @click="model = language.code"
    >
      <FlagIcon :code="language.code" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { LANGUAGES } from "../i18n/messages";
import FlagIcon from "./FlagIcon.vue";

const model = defineModel<string>({ required: true });
</script>
