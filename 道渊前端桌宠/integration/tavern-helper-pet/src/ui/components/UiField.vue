<script setup lang="ts">
defineProps<{ label: string; hint?: string; error?: string; inputId: string }>();
</script>

<template>
  <label class="dy-field" :for="inputId">
    <span class="dy-field__label">{{ label }}</span>
    <span v-if="hint" class="dy-field__hint">{{ hint }}</span>
    <slot />
    <span v-if="error" class="dy-field__error" role="alert">{{ error }}</span>
  </label>
</template>
