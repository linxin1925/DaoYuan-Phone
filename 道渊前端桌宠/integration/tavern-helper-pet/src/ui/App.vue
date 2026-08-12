<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import type { BridgeAction } from '../contract/bridge';
import { createBridgeClient, type BridgeClient } from './bridgeClient';
import UiCard from './components/UiCard.vue';
import UiButton from './components/UiButton.vue';
import UiTag from './components/UiTag.vue';
import SettingsPage from './pages/SettingsPage.vue';

const props = defineProps<{ view: Window; sendToHost: (action: BridgeAction, payload?: Record<string, unknown>) => void }>();
const bridge = ref<BridgeClient | null>(null);
const ready = ref(false);
const contextReceived = ref(false);
const chatId = ref('未接入');
const layoutMode = ref<'auto' | 'desktop-tablet' | 'phone'>('auto');
const petSize = ref<'small' | 'medium' | 'large'>('large');
const rerollEnabled = ref(false);
const yujian = ref({ apiBaseUrl: '', apiKey: '', apiModel: '', customPrompt: '', storyParseEnabled: false });
const beauty = ref({ apiBaseUrl: '', apiKey: '', apiModel: '', autoEnabled: true, autoInterval: 1 });
const xianwang = ref({
  apiBaseUrl: '', apiKey: '', apiModel: '', generatedCommentCount: 0,
  trendsAutoEnabled: true, autoInterval: 1, batchMin: 1, batchMax: 3, maxPosts: 100,
  forumAutoEnabled: true, forumAutoInterval: 1, forumBatchSize: 1, forumMaxPosts: 100,
  newsAutoEnabled: true, newsAutoInterval: 1, newsBatchSize: 1, newsMaxPapers: 30,
  decentralizedMode: true, autoAiReply: false, showHeat: true, showCommentPreview: false, jailbreakPrompt: false,
});
const injection = ref({ yujian: false, trends: false, forum: false, news: false });
const settingsOpen = ref(false);

onMounted(() => {
  const client = createBridgeClient(props.view, props.sendToHost);
  bridge.value = client;
  client.subscribe(message => {
    if (message.action !== 'REQUEST_CONTEXT') return;
    contextReceived.value = true;
    if (message.payload.shellMode === 'auto' || message.payload.shellMode === 'desktop-tablet' || message.payload.shellMode === 'phone') layoutMode.value = message.payload.shellMode;
    const context = message.payload.context;
    if (message.payload.petSize === 'small' || message.payload.petSize === 'medium' || message.payload.petSize === 'large') petSize.value = message.payload.petSize;
    rerollEnabled.value = message.payload.rerollCompatibilityEnabled === true;
    if (message.payload.yujianSettings && typeof message.payload.yujianSettings === 'object') yujian.value = { ...yujian.value, ...(message.payload.yujianSettings as typeof yujian.value) };
    if (message.payload.beautyApiSettings && typeof message.payload.beautyApiSettings === 'object') beauty.value = { ...beauty.value, ...(message.payload.beautyApiSettings as typeof beauty.value) };
    if (message.payload.xianwangApiSettings && typeof message.payload.xianwangApiSettings === 'object') xianwang.value = { ...xianwang.value, ...(message.payload.xianwangApiSettings as typeof xianwang.value) };
    if (message.payload.promptInjectionSettings && typeof message.payload.promptInjectionSettings === 'object') injection.value = { ...injection.value, ...(message.payload.promptInjectionSettings as typeof injection.value) };
    if (context && typeof context === 'object' && typeof (context as { chatId?: unknown }).chatId === 'string') {
      chatId.value = (context as { chatId: string }).chatId;
    }
  });
  client.send('APP_READY');
  client.send('REQUEST_CONTEXT');
  ready.value = true;
});

onBeforeUnmount(() => {
  bridge.value?.destroy();
  bridge.value = null;
});
</script>

<template>
  <aside class="v15-vue-shell" aria-label="V1.5 Vue 重构状态">
    <SettingsPage v-if="settingsOpen" :layout-mode="layoutMode" :pet-size="petSize" :reroll-enabled="rerollEnabled" :yujian="yujian" :beauty="beauty" :xianwang="xianwang" :injection="injection" :save="(action, payload) => { bridge?.send(action, payload); }" :request="(action, payload) => { bridge?.send(action, payload); }" :close="() => { settingsOpen = false; }" />
    <UiCard title="V1.5 Vue" :description="contextReceived ? chatId : ready ? '等待上下文' : '挂载中'">
      <span class="v15-vue-shell__status-row" aria-live="polite">
        <span class="v15-vue-shell__dot" :data-ready="ready && contextReceived" aria-hidden="true"></span>
        <span>{{ contextReceived ? '已接入' : '连接中' }}</span>
      </span>
      <UiTag :label="contextReceived ? 'Bridge' : '等待'" :tone="contextReceived ? 'accent' : 'neutral'" />
      <UiButton label="打开设置" variant="ghost" @click="settingsOpen = true">设置</UiButton>
    </UiCard>
  </aside>
</template>
