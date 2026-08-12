<script setup lang="ts">
withDefaults(defineProps<{ tone?: 'neutral' | 'accent' | 'danger'; label: string }>(), { tone: 'neutral' });
</script>

<template>
  <span class="dy-tag" :class="'dy-tag--' + tone">{{ label }}</span>
</template>
