<script setup lang="ts">
import { computed, ref } from 'vue';
import UiButton from '../components/UiButton.vue';
import UiCard from '../components/UiCard.vue';
import UiField from '../components/UiField.vue';
import UiTag from '../components/UiTag.vue';
import type { BridgeAction } from '../../contract/bridge';

const props = defineProps<{
  petSize: 'small' | 'medium' | 'large';
  layoutMode: 'auto' | 'desktop-tablet' | 'phone';
  rerollEnabled: boolean;
  yujian: { apiBaseUrl: string; apiKey: string; apiModel: string; customPrompt: string; storyParseEnabled: boolean };
  beauty: { apiBaseUrl: string; apiKey: string; apiModel: string; autoEnabled: boolean; autoInterval: number };
  xianwang: {
    apiBaseUrl: string; apiKey: string; apiModel: string; generatedCommentCount: number;
    trendsAutoEnabled: boolean; autoInterval: number; batchMin: number; batchMax: number; maxPosts: number;
    forumAutoEnabled: boolean; forumAutoInterval: number; forumBatchSize: number; forumMaxPosts: number;
    newsAutoEnabled: boolean; newsAutoInterval: number; newsBatchSize: number; newsMaxPapers: number;
    decentralizedMode: boolean; autoAiReply: boolean; showHeat: boolean; showCommentPreview: boolean; jailbreakPrompt: boolean;
  };
  injection: { yujian: boolean; trends: boolean; forum: boolean; news: boolean };
  save: (action: BridgeAction, payload: Record<string, unknown>) => void;
  request: (action: BridgeAction, payload?: Record<string, unknown>) => void;
  close: () => void;
}>();
const draftPetSize = ref(props.petSize);
const draftLayoutMode = ref(props.layoutMode);
const draftReroll = ref(props.rerollEnabled);
const yujianDraft = ref({ ...props.yujian });
const beautyDraft = ref({ ...props.beauty });
const xianwangDraft = ref({ ...props.xianwang });
const injectionDraft = ref({ ...props.injection });
const saved = ref(false);
const petSizeLabel = computed(() => ({ small: '小', medium: '中', large: '大' }[draftPetSize.value]));

function saveSettings(): void {
  props.save('SET_PET_SIZE', { size: draftPetSize.value });
  props.save('SET_LAYOUT', { layoutMode: draftLayoutMode.value });
  props.save('SAVE_REROLL_SETTINGS', { enabled: draftReroll.value });
  props.save('SAVE_YUJIAN_SETTINGS', yujianDraft.value);
  props.save('SAVE_BEAUTY_SETTINGS', beautyDraft.value);
  props.save('SAVE_XIANWANG_SETTINGS', xianwangDraft.value);
  props.save('SAVE_PROMPT_INJECTION_SETTINGS', injectionDraft.value);
  saved.value = true;
}
</script>

<template>
  <section class="dy-settings-page" aria-labelledby="dy-settings-title">
    <header class="dy-settings-page__header">
      <div>
        <p class="dy-settings-page__eyebrow">天机阁 · 偏好</p>
        <h1 id="dy-settings-title">设置</h1>
      </div>
      <UiButton label="关闭设置" variant="ghost" @click="close">×</UiButton>
    </header>
    <UiCard title="桌宠显示" description="只影响当前前端的显示偏好，不写入 MVU。">
      <UiField input-id="dy-layout-mode" label="布局模式" hint="自动模式在手机与桌面平板之间切换，保留当前页面状态。">
        <select id="dy-layout-mode" v-model="draftLayoutMode" class="dy-control" aria-label="布局模式">
          <option value="auto">自动</option>
          <option value="desktop-tablet">桌面平板（16:9）</option>
          <option value="phone">手机</option>
        </select>
      </UiField>
      <UiField input-id="dy-pet-size" label="桌宠尺寸" hint="可随时调整，不需要重新导入脚本。">
        <select id="dy-pet-size" v-model="draftPetSize" class="dy-control" aria-label="桌宠尺寸">
          <option value="small">小</option>
          <option value="medium">中</option>
          <option value="large">大</option>
        </select>
      </UiField>
      <UiTag :label="'当前：' + petSizeLabel" tone="accent" />
    </UiCard>
    <UiCard title="仙网重 Roll 兼容" description="保留 V0.7 行为开关，默认关闭。">
      <label class="dy-switch-row" for="dy-reroll">
        <input id="dy-reroll" v-model="draftReroll" type="checkbox" />
        <span>允许同一楼层重 Roll 兼容处理</span>
      </label>
    </UiCard>
    <UiCard title="玉简传讯 API" description="独立于绝色榜与仙网内容。">
      <UiField input-id="dy-yujian-url" label="Endpoint"><input id="dy-yujian-url" v-model="yujianDraft.apiBaseUrl" class="dy-control" type="url" /></UiField>
      <UiField input-id="dy-yujian-key" label="API Key"><input id="dy-yujian-key" v-model="yujianDraft.apiKey" class="dy-control" type="password" autocomplete="off" /></UiField>
      <UiField input-id="dy-yujian-model" label="Model"><input id="dy-yujian-model" v-model="yujianDraft.apiModel" class="dy-control" /></UiField>
      <UiField input-id="dy-yujian-prompt" label="传讯指引"><textarea id="dy-yujian-prompt" v-model="yujianDraft.customPrompt" class="dy-control" rows="3" /></UiField>
      <label class="dy-switch-row"><input v-model="yujianDraft.storyParseEnabled" type="checkbox" />解析正文中的玉简通信</label>
      <div class="dy-settings-actions">
        <UiButton label="获取模型" variant="ghost" @click="request('REQUEST_YUJIAN_MODELS')">获取模型</UiButton>
        <UiButton label="导入旧状态" variant="ghost" @click="request('IMPORT_STATUS_YUJIAN_HISTORY')">导入旧状态</UiButton>
      </div>
    </UiCard>
    <UiCard title="绝色榜 API" description="只服务绝色榜生成和回帖。">
      <UiField input-id="dy-beauty-url" label="Endpoint"><input id="dy-beauty-url" v-model="beautyDraft.apiBaseUrl" class="dy-control" type="url" /></UiField>
      <UiField input-id="dy-beauty-key" label="API Key"><input id="dy-beauty-key" v-model="beautyDraft.apiKey" class="dy-control" type="password" autocomplete="off" /></UiField>
      <UiField input-id="dy-beauty-model" label="Model"><input id="dy-beauty-model" v-model="beautyDraft.apiModel" class="dy-control" /></UiField>
      <label class="dy-switch-row"><input v-model="beautyDraft.autoEnabled" type="checkbox" />启用绝色榜自动推演</label>
      <UiField input-id="dy-beauty-interval" label="自动更新间隔"><input id="dy-beauty-interval" v-model.number="beautyDraft.autoInterval" class="dy-control" type="number" min="0" max="999" /></UiField>
      <UiButton label="获取模型" variant="ghost" @click="request('REQUEST_BEAUTY_MODELS')">获取模型</UiButton>
    </UiCard>
    <UiCard title="仙网内容 API" description="风闻、论坛、日报共用。">
      <UiField input-id="dy-xianwang-url" label="Endpoint"><input id="dy-xianwang-url" v-model="xianwangDraft.apiBaseUrl" class="dy-control" type="url" /></UiField>
      <UiField input-id="dy-xianwang-key" label="API Key"><input id="dy-xianwang-key" v-model="xianwangDraft.apiKey" class="dy-control" type="password" autocomplete="off" /></UiField>
      <UiField input-id="dy-xianwang-model" label="Model"><input id="dy-xianwang-model" v-model="xianwangDraft.apiModel" class="dy-control" /></UiField>
      <UiField input-id="dy-xianwang-comments" label="每帖生成评论数"><input id="dy-xianwang-comments" v-model.number="xianwangDraft.generatedCommentCount" class="dy-control" type="number" min="0" max="10" /></UiField>
      <label class="dy-switch-row"><input v-model="xianwangDraft.trendsAutoEnabled" type="checkbox" />启用风闻自动推演</label>
      <UiField input-id="dy-xianwang-interval" label="风闻更新间隔"><input id="dy-xianwang-interval" v-model.number="xianwangDraft.autoInterval" class="dy-control" type="number" min="0" /></UiField>
      <UiField input-id="dy-xianwang-batch-min" label="风闻批次下限"><input id="dy-xianwang-batch-min" v-model.number="xianwangDraft.batchMin" class="dy-control" type="number" min="1" /></UiField>
      <UiField input-id="dy-xianwang-batch-max" label="风闻批次上限"><input id="dy-xianwang-batch-max" v-model.number="xianwangDraft.batchMax" class="dy-control" type="number" min="1" /></UiField>
      <UiField input-id="dy-xianwang-max-posts" label="风闻最大帖子数"><input id="dy-xianwang-max-posts" v-model.number="xianwangDraft.maxPosts" class="dy-control" type="number" min="1" /></UiField>
      <label class="dy-switch-row"><input v-model="xianwangDraft.forumAutoEnabled" type="checkbox" />启用论坛自动推演</label>
      <UiField input-id="dy-forum-interval" label="论坛更新间隔"><input id="dy-forum-interval" v-model.number="xianwangDraft.forumAutoInterval" class="dy-control" type="number" min="0" /></UiField>
      <UiField input-id="dy-forum-batch" label="论坛批次大小"><input id="dy-forum-batch" v-model.number="xianwangDraft.forumBatchSize" class="dy-control" type="number" min="1" /></UiField>
      <UiField input-id="dy-forum-max" label="论坛最大帖子数"><input id="dy-forum-max" v-model.number="xianwangDraft.forumMaxPosts" class="dy-control" type="number" min="1" /></UiField>
      <label class="dy-switch-row"><input v-model="xianwangDraft.newsAutoEnabled" type="checkbox" />启用日报自动推演</label>
      <UiField input-id="dy-news-interval" label="日报更新间隔"><input id="dy-news-interval" v-model.number="xianwangDraft.newsAutoInterval" class="dy-control" type="number" min="0" /></UiField>
      <UiField input-id="dy-news-batch" label="日报批次大小"><input id="dy-news-batch" v-model.number="xianwangDraft.newsBatchSize" class="dy-control" type="number" min="1" /></UiField>
      <UiField input-id="dy-news-max" label="日报最大条数"><input id="dy-news-max" v-model.number="xianwangDraft.newsMaxPapers" class="dy-control" type="number" min="1" /></UiField>
      <label class="dy-switch-row"><input v-model="xianwangDraft.decentralizedMode" type="checkbox" />启用去中心化模式</label>
      <label class="dy-switch-row"><input v-model="xianwangDraft.autoAiReply" type="checkbox" />自动生成 AI 回帖</label>
      <label class="dy-switch-row"><input v-model="xianwangDraft.showHeat" type="checkbox" />显示热度</label>
      <label class="dy-switch-row"><input v-model="xianwangDraft.showCommentPreview" type="checkbox" />显示评论预览</label>
      <label class="dy-switch-row"><input v-model="xianwangDraft.jailbreakPrompt" type="checkbox" />启用扩展提示词</label>
      <UiButton label="获取模型" variant="ghost" @click="request('REQUEST_XIANWANG_MODELS')">获取模型</UiButton>
    </UiCard>
    <UiCard title="主线注入" description="默认关闭；只影响后续剧情可感知内容。">
      <label v-for="key in (['yujian', 'trends', 'forum', 'news'] as const)" :key="key" class="dy-switch-row">
        <input v-model="injectionDraft[key]" type="checkbox" />{{ key === 'yujian' ? '玉简传讯' : key === 'trends' ? '仙网风闻' : key === 'forum' ? '仙网论坛' : '天机日报' }}
      </label>
    </UiCard>
    <p v-if="saved" class="dy-settings-page__saved" role="status">设置已发送</p>
    <UiButton label="保存设置" @click="saveSettings">保存设置</UiButton>
  </section>
</template>
