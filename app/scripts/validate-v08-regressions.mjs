import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

async function importTypescript(relativePath) {
  const source = await readFile(new URL(relativePath, import.meta.url), 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`);
}

class MemoryStorage {
  values = new Map();
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

const storage = await importTypescript('../src/services/yujianStorage.ts');
const alias = await importTypescript('../src/services/playerAlias.ts');
const location = await importTypescript('../src/services/locationFormat.ts');
const host = { localStorage: new MemoryStorage(), indexedDB: undefined };
const originalWarn = console.warn;
console.warn = () => {};

await storage.writeYujianHistories(host, 'chat-a', { 紫薇: [{ from: 'me', text: '甲对话', time: '10:00' }] });
await storage.writeYujianHistories(host, 'chat-b', { 紫薇: [{ from: 'them', text: '乙对话', time: '10:01' }] });
assert.equal((await storage.readYujianHistories(host, 'chat-a')).紫薇[0].text, '甲对话');
assert.equal((await storage.readYujianHistories(host, 'chat-b')).紫薇[0].text, '乙对话');

const legacyHost = { localStorage: new MemoryStorage(), indexedDB: undefined };
legacyHost.localStorage.setItem('daoyuan_yujian_standalone_v1', JSON.stringify({ 'legacy-chat': { 紫薇: [{ from: 'them', text: '旧记录仍可读', time: '昨日' }] } }));
assert.equal((await storage.readYujianHistories(legacyHost, 'legacy-chat')).紫薇[0].text, '旧记录仍可读');

await storage.writeYujianHistories(host, 'chat-cap', {
  道友: Array.from({ length: 130 }, (_, index) => ({ from: 'me', text: `${index}`.repeat(9000), time: '现在' })),
});
const capped = (await storage.readYujianHistories(host, 'chat-cap')).道友;
assert.equal(capped.length, 100);
assert.equal(capped.at(-1).text.length, 8000);

await storage.writeProcessedYujianStories(host, 'chat-a', Array.from({ length: 700 }, (_, index) => `floor:${index}`));
assert.equal((await storage.readProcessedYujianStories(host, 'chat-a')).length, 600);
await storage.clearAllYujianStorage(host);
assert.deepEqual(await storage.readYujianHistories(host, 'chat-a'), {});
assert.deepEqual(await storage.readYujianContacts(host, 'chat-a'), []);
assert.deepEqual(await storage.readProcessedYujianStories(host, 'chat-a'), []);

assert.equal(alias.normalizePlayerAlias('  道\u0000友  '), '道友');
assert.equal(alias.normalizePlayerAlias('   '), '我');
assert.equal(Array.from(alias.normalizePlayerAlias('甲'.repeat(40))).length, 24);
assert.equal(location.formatWorldLocation('中央神州·东南部·清风坊市·天字号客栈卧房'), '中央神州·东南部·清风坊市');
assert.equal(location.formatWorldLocation('  未知地点  '), '未知地点');
assert.equal(location.formatWorldLocation(''), '未接入');
console.warn = originalWarn;

const indexSource = await readFile(new URL('../src/index.ts', import.meta.url), 'utf8');
const yujianRuntimeSource = await readFile(new URL('../src/services/yujianRuntime.ts', import.meta.url), 'utf8');
const renderUiSource = await readFile(new URL('../src/ui/renderUi.ts', import.meta.url), 'utf8');
const earthSimulationSource = await readFile(new URL('../src/earthSimulation/runtime.ts', import.meta.url), 'utf8');
const xuantianSimulationSource = await readFile(new URL('../src/xuantianSimulation/runtime.ts', import.meta.url), 'utf8');
for (const moduleName of ['trends', 'forum', 'news']) {
  assert.match(indexSource, new RegExp(`${moduleName}: parse(?:Trends|Forum|News)Data`));
}
assert.match(indexSource, /DEFAULT_FEATURE_MODULE_FLAGS: FeatureModuleFlags = \{ yujian:false, beauty:false, xianwang:false, wanbao:false, world:false \}/, 'optional feature modules must default to closed');
assert.match(indexSource, /DEFAULT_WORLD_SIMULATION_FEATURES: WorldSimulationFeatures = \{ xuantianEnabled:false, earthEnabled:false \}/, 'world simulation entries must default to closed');
assert.match(indexSource, /xuantianEnabled: typeof value\.xuantianEnabled === 'boolean' \? value\.xuantianEnabled : DEFAULT_WORLD_SIMULATION_FEATURES\.xuantianEnabled/, 'xuantian storage fallback must use the closed default');
assert.match(indexSource, /earthEnabled: typeof value\.earthEnabled === 'boolean' \? value\.earthEnabled : DEFAULT_WORLD_SIMULATION_FEATURES\.earthEnabled/, 'earth storage fallback must use the closed default');
assert.match(renderUiSource, /let featureModuleFlags: FeatureModuleFlags = \{ yujian:false, beauty:false, xianwang:false, wanbao:false, world:false \}/, 'phone UI must start with optional modules closed before host sync');
assert.doesNotMatch(indexSource, /scrollIntoView\(/, 'settings controls must never force a scroll jump');
assert.match(renderUiSource, /const activeModule = featureModuleForApp\[active\][\s\S]{0,400}active = 'home'/, 'a persisted disabled app must return to the home screen after host sync');
assert.match(renderUiSource, /activeRealmDisabled[\s\S]{0,300}active = 'home'/, 'a persisted disabled world realm must return to the home screen after host sync');
assert.match(indexSource, /autoEnabled: typeof payload\.autoEnabled === 'boolean' \? payload\.autoEnabled : current\.autoEnabled/, 'partial beauty settings must preserve the current auto switch');
assert.match(indexSource, /transactionInjectionEnabled: typeof payload\.transactionInjectionEnabled === 'boolean' \? payload\.transactionInjectionEnabled : current\.transactionInjectionEnabled/, 'partial wanbao settings must preserve the current injection switch');
for (const setting of ['trendsAutoEnabled', 'forumAutoEnabled', 'newsAutoEnabled', 'autoAiReply', 'showHeat', 'showCommentPreview', 'jailbreakPrompt']) {
  assert.match(indexSource, new RegExp(`${setting}: typeof payload\\.${setting} === 'boolean' \\? payload\\.${setting} : current\\.${setting}`), `partial xianwang settings must preserve ${setting}`);
}
for (const forbidden of ['SAVE_REROLL_SETTINGS', 'REROLL_SETTINGS_STATUS', 'daoyuan_reroll_compat_v1', 'processedSwipeKeys', 'triggeredSwipeKeys']) {
  assert.ok(!indexSource.includes(forbidden), `重 Roll 兼容后台不应残留：${forbidden}`);
  assert.ok(!renderUiSource.includes(forbidden), `重 Roll 兼容界面不应残留：${forbidden}`);
}
assert.match(indexSource, /trendsAutoEnabled[\s\S]{0,500}!trendsData\.processedMessageIds\.includes\(messageId\)/, '仙网风闻应只按新楼层计数');
assert.match(indexSource, /beautySettings\.autoEnabled[\s\S]{0,180}beautyNewFloor/, '绝色榜应只按新楼层计数');
assert.match(yujianRuntimeSource, /getMvuData\(scope\)/);
assert.match(yujianRuntimeSource, /storyTime\.trim\(\) \|\| '未知时间'/);
assert.doesNotMatch(yujianRuntimeSource, /const now = new Date\(\);/);
assert.match(indexSource, /readYujianStoryTime\(mvuWindow, messageId\)/);
assert.match(indexSource, /this\.session\.messageId, \{ signal: controller\.signal, isEnabled: \(\) => this\.featureEnabled\('yujian'\) \}\);/, '玉简手动传讯必须绑定总开关与取消信号');
assert.match(indexSource, /key === 'yujian' && !flags\.yujian\) this\.stopYujianOperations\(\)/, '关闭玉简总模块必须立即停止全部玉简异步操作');
assert.match(indexSource, /this\.pendingYujianStoryParse = null;[\s\S]{0,180}this\.yujianStoryParseAbortController\?\.abort\(\)/, '关闭玉简正文解析必须清空队列并取消在途请求');
assert.match(yujianRuntimeSource, /signal: control\?\.signal/, '玉简网络请求必须传递取消信号');
assert.match(yujianRuntimeSource, /stopGenerationById\(generationId\)/, '玉简酒馆内置生成必须支持按任务停止');
assert.match(yujianRuntimeSource, /generation_id: generationId, should_silence: true/, '玉简酒馆内置生成必须使用独立任务标识');
assert.match(renderUiSource, /uiView\.confirm\('确定清空整个小手机的所有配置与记录吗？/, '整机清空必须使用浏览器原生二次确认');
assert.match(renderUiSource, /sendAction\('FACTORY_RESET_PHONE'\)/, '确认后必须交由宿主执行整机出厂重置');
assert.match(indexSource, /await clearAllYujianStorage\(this\.hostWindow\)/, '整机重置必须清空全部玉简联系人和聊天存储');
assert.match(indexSource, /this\.appData = await this\.repository\.clearAll\(\)/, '整机重置必须清空当前聊天的小手机账本');
assert.match(indexSource, /simulationStore\?\.set\(EARTH_SIMULATION_STATE_KEY, null\)[\s\S]{0,100}simulationStore\?\.set\(XUANTIAN_SIMULATION_STATE_KEY, null\)/, '整机重置必须清空双界推演账本');
assert.match(indexSource, /key\?\.startsWith\('daoyuan_beauty_replies:'\)[\s\S]{0,100}key\?\.startsWith\('daoyuan_app_read_state:'\)/, '整机重置必须清空所有聊天的动态本地记录');
assert.match(indexSource, /applyPendingFactoryResetForCurrentChat/, '切换到旧聊天时必须继续执行出厂重置，避免跨聊天残留');
assert.match(renderUiSource, /不会删除酒馆角色卡、原始世界书或 MVU 世界数据/, '整机重置必须明确保护酒馆原始数据');
assert.match(indexSource, /'MESSAGE_DELETED'/);
assert.match(indexSource, /tavern_events\?\.MESSAGE_DELETED/);
assert.match(indexSource, /action === 'DELETE_YUJIAN_CONTACT'/);
assert.match(yujianRuntimeSource, /daoyuan_yujian_hidden_contacts_v1/);
assert.match(yujianRuntimeSource, /hiddenContacts\.has\(name\)/);
assert.match(yujianRuntimeSource, /deleteStandaloneYujianContact/);
assert.match(renderUiSource, /确认删除联系人/);
assert.match(renderUiSource, /YUJIAN_CONTACT_DELETE_STATUS/);
assert.match(renderUiSource, /SAVE_FEATURE_MODULE_FLAGS[\s\S]{0,240}render\(\);return;/, 'module toggle must preserve settings scroll position');
assert.match(renderUiSource, /FEATURE_MODULE_FLAGS_STATUS[\s\S]{0,320}render\(\);/, 'module flag acknowledgement must preserve settings scroll position');
assert.match(indexSource, /readWorldSimulationFeatures\(this\.hostWindow\)\.xuantianEnabled/, 'xuantian generation must honor its feature switch');
assert.match(indexSource, /readWorldSimulationFeatures\(this\.hostWindow\)\.earthEnabled/, 'earth generation must honor its feature switch');
assert.match(indexSource, /generateXuantianSimulation[\s\S]{0,400}readXuantianApiSettings\(this\.hostWindow\)\.enabled/, 'manual xuantian generation must honor its API switch');
assert.match(indexSource, /generateEarthSimulation[\s\S]{0,400}readEarthApiSettings\(this\.hostWindow\)\.enabled/, 'manual earth generation must honor its API switch');
for (const marker of ['retryCount:Math.max(0,Math.min(2', 'maxRequests=1+settings.retryCount', 'requestCount,maxRequests', 'shouldRetrySimulation(error)']) assert.ok(indexSource.includes(marker), `simulation retry/call-count contract missing: ${marker}`);
assert.match(earthSimulationSource, /max_tokens:\s*65535/, 'earth simulation output token ceiling must remain 65535');
assert.match(xuantianSimulationSource, /max_tokens:65535/, 'xuantian simulation/director output token ceiling must remain 65535');
for (const marker of ['请求失败：(?:401|403|404)', '世界书.*(?:未挂载|不可读|为空)', '越权']) assert.ok(indexSource.includes(marker), `non-retryable simulation error gate missing: ${marker}`);
for (const marker of ['失败后重试次数', 'API 请求 ${Number(message.payload.requestCount)', '最多请求 ${settings.retryCount+1} 次']) assert.ok(renderUiSource.includes(marker), `simulation call disclosure missing: ${marker}`);
assert.match(indexSource, /玄天界推演已关闭，本次结果未写入/, 'xuantian results must be discarded when its switch closes in flight');
assert.match(indexSource, /地球推演已关闭，本次结果未写入/, 'earth results must be discarded when its switch closes in flight');
assert.match(indexSource, /worldSimulationFeatures\.xuantianEnabled&&xuantianSettings\.enabled/, 'xuantian auto scheduler must honor its feature switch');
assert.match(indexSource, /action === 'REQUEST_XUANTIAN_MODELS'[\s\S]{0,260}action === 'REQUEST_EARTH_MODELS'/, 'model-list requests must be blocked by realm switches');
assert.match(indexSource, /action === 'SAVE_WORLD_SIMULATION_FEATURES'/, 'world simulation feature switches must save through the host');
assert.match(indexSource, /saveWorldSimulationFeatures\(this\.hostWindow, features\)/, 'host must own world simulation switch persistence');
assert.match(indexSource, /SAVE_FEATURE_MODULE_FLAGS[\s\S]{0,800}refreshPromptInjection\(\)/, 'master switches must immediately refresh prompt injection');
assert.match(indexSource, /SAVE_WORLD_SIMULATION_FEATURES[\s\S]{0,900}refreshPromptInjection\(\)/, 'world switches must immediately refresh prompt injection');
assert.match(indexSource, /featureFlags\.world && worldFeatures\.earthEnabled && storedEarth/, 'earth injection must honor its realm switch');
assert.match(indexSource, /featureFlags\.world&&worldFeatures\.xuantianEnabled&&storedXuantian/, 'xuantian injection must honor its realm switch');
assert.match(indexSource, /if\(xuantianSimulation\)\{try\{const parsed=StoryDirectorPlanSchema\.parse\(storedStoryPlan\)/, 'story director injection must require an active xuantian ledger');
assert.match(indexSource, /store\.set\(XUANTIAN_SIMULATION_STATE_KEY,null\);store\.set\(STORY_DIRECTOR_STATE_KEY,null\)/, 'clearing xuantian simulation must also clear its story director plan');
assert.match(renderUiSource, /xuantianSimulationState=null;storyDirectorPlan=null/, 'clearing xuantian simulation must clear both UI projections');
assert.match(renderUiSource, /sendAction\('SAVE_WORLD_SIMULATION_FEATURES', worldSimulationFeatures\)/, 'iframe must bridge world simulation switch persistence');
assert.doesNotMatch(renderUiSource, /storage\.setItem\('daoyuan_world_simulation_features_v1'/, 'iframe must not write world simulation switches directly');
assert.match(renderUiSource, /WORLD_SIMULATION_FEATURES_STATUS/, 'iframe must wait for host persistence acknowledgement');
assert.match(renderUiSource, /sendAction\('SAVE_XIANWANG_SETTINGS', \{ \.\.\.xianwangApiSettings \}\)/, 'xianwang auto switches must save through the host');
assert.match(indexSource, /trendSettings\.trendsAutoEnabled/, 'trends auto scheduler must honor its switch');
assert.match(indexSource, /trendSettings\.forumAutoEnabled/, 'forum auto scheduler must honor its switch');
assert.match(indexSource, /trendSettings\.newsAutoEnabled/, 'news auto scheduler must honor its switch');
assert.match(indexSource, /featureFlags\.xianwang&&trendSettings\.forumAutoEnabled/, 'forum auto scheduler must honor xianwang master switch');
assert.match(indexSource, /featureFlags\.xianwang&&trendSettings\.newsAutoEnabled/, 'news auto scheduler must honor xianwang master switch');
assert.match(indexSource, /worldSimulationFeatures\.earthEnabled&&earthSettings\.enabled&&earthSettings\.replyInterval>0/, 'earth auto scheduler must honor both switches and reply interval');
assert.match(indexSource, /counter >= trendSettings\.autoInterval && !this\.trendsGenerationInFlight/, 'trends countdown must not consume an in-flight trigger');
assert.match(indexSource, /counter>=trendSettings\.forumAutoInterval&&!this\.forumGenerationInFlight/, 'forum countdown must not consume an in-flight trigger');
assert.match(indexSource, /counter>=trendSettings\.newsAutoInterval&&!this\.newsGenerationInFlight/, 'news countdown must not consume an in-flight trigger');
assert.match(indexSource, /counter >= beautySettings\.autoInterval && !this\.beautyGenerationInFlight/, 'beauty countdown must not consume an in-flight trigger');
assert.match(indexSource, /autoCounter: Math\.max\(0, existing\.autoCounter - settings\.autoInterval\)/, 'trends countdown must reset only after successful generation');
assert.match(indexSource, /autoCounter:Math\.max\(0,latestState\.autoCounter-settings\.replyInterval\)/, 'xuantian countdown must reset only after successful generation');
assert.match(indexSource, /autoCounter: Math\.max\(0, latestState\.autoCounter - settings\.replyInterval\)/, 'earth countdown must reset only after successful generation');
assert.match(indexSource, /processedAutoMessageFingerprints/, 'earth countdown must survive message deletion reconciliation');
assert.match(indexSource, /data\.autoCounter - removedCount/, 'message deletion must decrement the stored countdown instead of rebuilding it from capped history');
assert.doesNotMatch(indexSource, /processedMessageIds\.length % interval/, 'long-chat countdown reconciliation must not use capped history modulo');
assert.match(renderUiSource, /还有 \$\{earthRemaining\} 轮对话后自动推演/, 'earth page must display remaining turns');
assert.match(renderUiSource, /还有 \$\{xuantianRemaining\} 轮对话后自动推演/, 'xuantian page must display remaining turns');
assert.match(renderUiSource, /还有 \$\{beautyRemaining\} 轮对话后更新绝色榜/, 'beauty page must display remaining turns');
assert.match(renderUiSource, /announcement='该功能已在设置中关闭。';render\(\);return;/, 'disabled navigation warning must preserve settings scroll position');
assert.doesNotMatch(renderUiSource, /announcement='该功能已在设置中关闭。';render\(false\);return;/, 'disabled navigation must not reset settings scroll position');
assert.doesNotMatch(renderUiSource, /render\(false\)/, 'UI rerenders must never opt out of scroll preservation');
assert.match(renderUiSource, /function render\(\): void/, 'render API must not expose a scroll-reset boolean');
console.log('V0.8 regressions passed: chat isolation / caps / alias / location / floor-only auto generation / story time / delete reconciliation / contact deletion');
