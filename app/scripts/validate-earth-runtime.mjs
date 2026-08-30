import assert from 'node:assert/strict';
import { createDefaultEarthSimulationState } from '../src/earthSimulation/defaults.ts';
import { applyEarthCandidate, buildEarthSimulationPrompt, selectRecentAssistantFloors } from '../src/earthSimulation/runtime.ts';

const chat = [
  { is_user: false, mes: 'AI-0' }, { is_user: true, mes: '用户-1' }, { is_user: false, mes: 'AI-2' },
  { is_system: true, is_user: false, mes: '系统-3' }, { is_user: false, mes: 'AI-4' }, { is_user: true, mes: '用户-5' },
  { is_user: false, mes: 'AI-6' }, { is_user: false, mes: 'AI-7' }, { is_user: false, mes: 'AI-8' },
];
const floors = selectRecentAssistantFloors(chat, 5);
assert.deepEqual(floors.map(row => row.index), [2, 4, 6, 7, 8]);
assert.deepEqual(floors.map(row => row.content), ['AI-2', 'AI-4', 'AI-6', 'AI-7', 'AI-8']);
assert.deepEqual(selectRecentAssistantFloors([{ is_user: true, mes: '只有用户输入' }]), []);

const initial = createDefaultEarthSimulationState('chat-test', '2026-08-26');
const committed = applyEarthCandidate(initial, { actions: [{ type: 'advance-world-days', days: 3 }, { type: 'set-secret-realm-stage', stage: '信息联系' }, { type: 'set-faction-state', factionId: 'faction_05', status: '筹备', activity: '建立符箓印刷实验组', influenceDelta: 2 }], rationale: '测试' }, 'fp-1');
assert.equal(committed.state.secretRealmStage, '信息联系');
assert.equal(committed.state.sequence, 1);
assert.equal(committed.state.lastCommittedFingerprint, 'fp-1');
assert.equal(committed.state.earthDate, '2026-08-29');
assert.equal(committed.state.factions.faction_05.activity, '建立符箓印刷实验组');
assert.deepEqual(committed.state.processedMessageFingerprints, ['fp-1']);
assert.throws(() => applyEarthCandidate(initial, { actions: [{ type: 'advance-world-days', days: 3 }, { type: 'set-secret-realm-stage', stage: '不存在' }] }, 'fp-bad'));
assert.throws(() => applyEarthCandidate(initial, { actions: [{ type: 'advance-world-days', days: 3 }, { type: 'overwrite-state', state: {} }] }, 'fp-bad'));
assert.throws(() => applyEarthCandidate(initial, { actions: [{ type: 'set-faction-state', factionId: 'faction_05', status: '活跃', activity: '测试' }] }, 'fp-no-clock'));
const normalized = applyEarthCandidate(initial, { actions: [
  { type: 'advance-world-days', days: 1 },
  { type: 'set-region-state', regionId: 'china', status: '观测中', summary: '建立连续观测点' },
  { type: 'set-faction-state', factionId: 'faction_05', status: '研究准备', activity: '组建小组' },
  { type: 'create-event', eventId: 'evt_flat', kind: '调查', summary: '对异常读数开展调查' },
] }, 'fp-normalized');
assert.equal(normalized.state.regions.china.status, '异常迹象');
assert.equal(normalized.state.factions.faction_05.status, '筹备');
assert.ok(normalized.state.events.some(event => event.id === 'evt_flat'));
const aliasNormalized = applyEarthCandidate(initial, { actions: [
  { type: 'advance_world_days', days: '2' },
  { type: 'set_region_state', region_id: 'china', status: '稳定', summary: '观测网稳定运行' },
  { type: 'set_faction_state', faction_id: 'faction_05', status: '协同研究', activity: '与高校共建实验组' },
] }, 'fp-alias');
assert.equal(aliasNormalized.state.earthDate, '2026-08-28');
assert.equal(aliasNormalized.state.regions.china.status, '平稳');
assert.equal(aliasNormalized.state.factions.faction_05.status, '合作');
const missingActivity = applyEarthCandidate(initial, { actions: [
  { type: 'advance-world-days', days: 1 },
  { type: 'set-faction-state', factionId: 'faction_05', status: '筹备', summary: '组建符箓试验小组' },
] }, 'fp-missing-activity');
assert.equal(missingActivity.state.factions.faction_05.activity, '组建符箓试验小组');
const retainedActivity = applyEarthCandidate(initial, { actions: [
  { type: 'advance-world-days', days: 1 },
  { type: 'set-faction-state', factionId: 'faction_05', status: '筹备' },
] }, 'fp-retained-activity');
assert.equal(retainedActivity.state.factions.faction_05.activity, '九州灵工联合体已进入筹备阶段，具体行动尚待后续推演确认。');
assert.throws(() => applyEarthCandidate(initial, { actions: [{ type: 'advance-world-days', days: 1 }, { type: 'set-region-state', regionId: 'china', status: '完全失控', summary: '不可确定语义' }] }, 'fp-unsafe'));
const prompt = buildEarthSimulationPrompt({ apiBaseUrl: 'https://example.invalid', apiKey: '', apiModel: 'test', temperature: 0.3, timeoutSeconds: 120, maxWorldDays: 30, timeRatio: '5:1' }, initial, [{ name: '双界基准监控', content: '世界书测试内容' }], []);
assert.match(prompt, /世界书测试内容/);
assert.match(prompt, /暂无 AI 正文；本轮仍必须/);
assert.match(prompt, /regionId 只能是 china \/ usa \/ russia \/ eu/);
assert.match(prompt, /只输出一个 JSON 对象/);
assert.match(prompt, /地球:玄天界=5:1/);
assert.throws(() => createDefaultEarthSimulationState('chat-test', '元会历3726年·腊月廿四'));

console.log('Earth runtime context/candidate gate: OK (last 5 assistant-only floors, schema + reducer commit)');
