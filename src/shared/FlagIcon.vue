<template>
  <svg
    v-if="code === 'en'"
    class="flag"
    viewBox="0 0 60 30"
    preserveAspectRatio="xMidYMid slice"
    aria-hidden="true"
  >
    <clipPath id="flag-en-diagonals">
      <path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z" />
    </clipPath>
    <rect width="60" height="30" fill="#012169" />
    <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" stroke-width="6" />
    <path d="M0,0 L60,30 M60,0 L0,30" stroke="#c8102e" stroke-width="4" clip-path="url(#flag-en-diagonals)" />
    <path d="M30,0 v30 M0,15 h60" stroke="#fff" stroke-width="10" />
    <path d="M30,0 v30 M0,15 h60" stroke="#c8102e" stroke-width="6" />
  </svg>
  <svg v-else-if="code === 'fr'" class="flag" viewBox="0 0 3 2" aria-hidden="true">
    <rect width="1" height="2" fill="#002654" />
    <rect x="1" width="1" height="2" fill="#fff" />
    <rect x="2" width="1" height="2" fill="#ce1126" />
  </svg>
  <svg
    v-else-if="code === 'de'"
    class="flag"
    viewBox="0 0 5 3"
    preserveAspectRatio="xMidYMid slice"
    aria-hidden="true"
  >
    <rect width="5" height="1" fill="#000" />
    <rect y="1" width="5" height="1" fill="#dd0000" />
    <rect y="2" width="5" height="1" fill="#ffce00" />
  </svg>
  <svg v-else-if="code === 'es'" class="flag" viewBox="0 0 3 2" aria-hidden="true">
    <rect width="3" height="2" fill="#aa151b" />
    <rect y="0.5" width="3" height="1" fill="#f1bf00" />
  </svg>
  <svg v-else-if="code === 'it'" class="flag" viewBox="0 0 3 2" aria-hidden="true">
    <rect width="1" height="2" fill="#009246" />
    <rect x="1" width="1" height="2" fill="#fff" />
    <rect x="2" width="1" height="2" fill="#ce2b37" />
  </svg>
  <svg
    v-else-if="code === 'pt'"
    class="flag"
    viewBox="0 0 20 14"
    preserveAspectRatio="xMidYMid slice"
    aria-hidden="true"
  >
    <rect width="20" height="14" fill="#009c3b" />
    <path d="M10,1.7 L18.3,7 L10,12.3 L1.7,7 z" fill="#ffdf00" />
    <circle cx="10" cy="7" r="3.5" fill="#002776" />
  </svg>
  <span v-else class="flag flag-fallback" aria-hidden="true">{{ code.toUpperCase() }}</span>
</template>

<script setup lang="ts">
defineProps<{ code: string }>();
</script>
