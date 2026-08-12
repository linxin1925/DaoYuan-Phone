<script setup lang="ts">
defineProps<{ title?: string; description?: string }>();
</script>

<template>
  <section class="dy-card">
    <header v-if="title || description" class="dy-card__header">
      <h2 v-if="title" class="dy-card__title">{{ title }}</h2>
      <p v-if="description" class="dy-card__description">{{ description }}</p>
    </header>
    <div class="dy-card__body"><slot /></div>
  </section>
</template>
