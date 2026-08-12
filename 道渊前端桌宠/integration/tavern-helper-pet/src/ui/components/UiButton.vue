<script setup lang="ts">
withDefaults(defineProps<{ label: string; variant?: 'primary' | 'ghost' | 'danger'; disabled?: boolean }>(), {
  variant: 'primary',
  disabled: false,
});
</script>

<template>
  <button class="dy-button" :class="'dy-button--' + variant" type="button" :disabled="disabled" :aria-label="label">
    <slot>{{ label }}</slot>
  </button>
</template>
