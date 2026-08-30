import { z } from 'zod';
import { fetchAuto, extractOpenAIText } from '../services/openaiProtocol.ts';
import { earthSimulationReducer } from './reducer.ts';
import { assertEarthSimulationState } from './invariants.ts';
import type { EarthSimulationAction, EarthSimulationState, EarthTimeRatio } from './types.ts';

export interface EarthApiSettings { apiBaseUrl: string; apiKey: string; apiModel: string; temperature: number; timeoutSeconds: number; maxWorldDays: number; timeRatio: EarthTimeRatio; }
export interface EarthContextFloor { index: number; content: string; }
export interface EarthWorldbookContextEntry { name: string; content: string; }

const ActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('advance-world-days'), days: z.number().int().min(1).max(30) }),
  z.object({ type: z.literal('set-world-date'), date: z.string().trim().min(1).max(80) }),
  z.object({ type: z.literal('set-region-state'), regionId: z.string().trim().min(1).max(160), status: z.enum(['平稳','异常迹象','局部应对']), summary: z.string().trim().min(1).max(1000) }),
  z.object({ type: z.literal('set-faction-state'), factionId: z.string().trim().min(1).max(160), status: z.enum(['潜伏','筹备','活跃','对抗','合作']), activity: z.string().trim().min(1).max(1000), influenceDelta: z.number().int().min(-10).max(10).optional(), contact: z.enum(['未接触','已接触']).optional() }),
  z.object({ type: z.literal('create-event'), event: z.object({ id: z.string().trim().min(1).max(160), kind: z.enum(['冲突','建设','调查']), stage: z.enum(['迹象','提议','线索']), status: z.literal('active'), summary: z.string().trim().min(1).max(500), worldDate: z.string().optional().default('2000-01-01') }) }),
  z.object({ type: z.literal('set-revival-stage'), stage: z.enum(['复苏初现','局部复苏','全球公开','全面超凡化']) }),
  z.object({ type: z.literal('set-contact-stage'), stage: z.enum(['互不知情','少数知情','势力接触','公开交流']) }),
  z.object({ type: z.literal('advance-event'), eventId: z.string().trim().min(1).max(160), nextStage: z.string().trim().min(1).max(80), summary: z.string().trim().max(1000).optional() }),
  z.object({ type: z.literal('set-secret-realm-stage'), stage: z.enum(['未激活', '信息联系', '人员携物通行', '制度化往来']) }),
  z.object({ type: z.literal('set-swarm-stage'), world: z.enum(['earth', 'xuantian']), stage: z.enum(['零星迹象', '局部虫巢', '区域战争', '双界同时入侵', '界域危机']) }),
]);
const CandidateSchema = z.object({ actions: z.array(ActionSchema).max(12), rationale: z.string().trim().max(3000).default('') });

function normalizeCandidate(value: unknown, state: EarthSimulationState): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const source = value as Record<string, unknown>;
  if (!Array.isArray(source.actions)) return value;
  const actions = source.actions.map(raw => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return raw;
    const action = { ...(raw as Record<string, unknown>) };
    if (typeof action.type === 'string') action.type = action.type.trim().toLowerCase().replaceAll('_', '-');
    if (action.regionId === undefined && typeof action.region_id === 'string') action.regionId = action.region_id;
    if (action.factionId === undefined && typeof action.faction_id === 'string') action.factionId = action.faction_id;
    if (action.eventId === undefined && typeof action.event_id === 'string') action.eventId = action.event_id;
    if (action.nextStage === undefined && typeof action.next_stage === 'string') action.nextStage = action.next_stage;
    if (action.influenceDelta === undefined && typeof action.influence_delta === 'number') action.influenceDelta = action.influence_delta;
    if (action.type === 'advance-world-days' && typeof action.days === 'string' && /^\d+$/.test(action.days.trim())) action.days = Number(action.days);
    if (action.type === 'set-region-state' && typeof action.regionId === 'string') {
      const text = String(action.status ?? '');
      action.status = text.includes('平稳') || text.includes('稳定') || text.includes('平静') ? '平稳' : text.includes('应对') || text.includes('响应') || text.includes('处置') ? '局部应对' : text.includes('异常') || text.includes('观测') || text.includes('监测') ? '异常迹象' : action.status;
    }
    if (action.type === 'set-faction-state' && typeof action.factionId === 'string') {
      const text = String(action.status ?? '');
      action.status = text.includes('合作') || text.includes('协作') || text.includes('协同') ? '合作' : text.includes('对抗') || text.includes('冲突') || text.includes('敌对') ? '对抗' : text.includes('活跃') || text.includes('行动') || text.includes('扩张') ? '活跃' : text.includes('筹备') || text.includes('准备') || text.includes('研究') ? '筹备' : text.includes('潜伏') || text.includes('静默') || text.includes('隐蔽') ? '潜伏' : action.status;
      if (typeof action.activity !== 'string' || !action.activity.trim()) {
        const fallback = [action.summary, action.description, action.currentGoal, action.objective].find(item => typeof item === 'string' && item.trim());
        const factionName = state.factions[action.factionId]?.name ?? action.factionId;
        action.activity = fallback ?? `${factionName}已进入${String(action.status || '新')}阶段，具体行动尚待后续推演确认。`;
      }
    }
    if (action.type === 'create-event' && (!action.event || typeof action.event !== 'object')) {
      const kind = action.kind === '冲突' || action.kind === '建设' || action.kind === '调查' ? action.kind : '调查';
      action.event = { id: String(action.eventId ?? action.id ?? `event_${state.sequence + 1}`), kind, stage: kind === '冲突' ? '迹象' : kind === '建设' ? '提议' : '线索', status: 'active', summary: String(action.summary ?? action.description ?? '新的地球演化事件'), worldDate: state.earthDate };
    }
    return action;
  });
  return { ...source, actions };
}

export function earthCandidateValidationMessage(error: unknown): string {
  if (error instanceof z.ZodError) return error.issues.slice(0, 4).map(issue => `${issue.path.join('.') || '根对象'}: ${issue.message}`).join('；');
  return error instanceof Error ? error.message : String(error);
}

export function selectRecentAssistantFloors(chat: readonly unknown[], limit = 5): EarthContextFloor[] {
  return chat.map((raw, index) => ({ raw: raw as { is_user?: unknown; is_system?: unknown; mes?: unknown }, index }))
    .filter(({ raw }) => raw.is_user === false && raw.is_system !== true && typeof raw.mes === 'string' && raw.mes.trim())
    .slice(-limit).map(({ raw, index }) => ({ index, content: String(raw.mes).trim() }));
}

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] ?? text;
  const start = fenced.indexOf('{'); const end = fenced.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('模型未返回 JSON 候选补丁');
  return JSON.parse(fenced.slice(start, end + 1));
}

export function applyEarthCandidate(state: EarthSimulationState, candidate: unknown, fingerprint: string, maxWorldDays = 30): { state: EarthSimulationState; actions: EarthSimulationAction[]; rationale: string } {
  const parsed = CandidateSchema.parse(normalizeCandidate(candidate, state));
  const dayActions = parsed.actions.filter((action): action is Extract<z.infer<typeof ActionSchema>, { type: 'advance-world-days' }> => action.type === 'advance-world-days');
  if (dayActions.length !== 1) throw new Error('每次推演必须且只能包含一个 advance-world-days');
  if (dayActions[0].days > maxWorldDays) throw new Error(`本次世界日推进超过设置上限 ${maxWorldDays}`);
  let next = state;
  for (const action of parsed.actions) next = earthSimulationReducer(next, action as EarthSimulationAction);
  next = earthSimulationReducer(next, { type: 'remember-fingerprint', fingerprint });
  next = assertEarthSimulationState({ ...next, sequence: state.sequence + 1, lastCommittedFingerprint: fingerprint });
  return { state: next, actions: parsed.actions as EarthSimulationAction[], rationale: parsed.rationale };
}

export function buildEarthSimulationPrompt(settings: EarthApiSettings, state: EarthSimulationState, worldbook: readonly EarthWorldbookContextEntry[], floors: readonly EarthContextFloor[], correction = ''): string {
  const lore = worldbook.map((entry, index) => `#${index + 1} ${entry.name}\n${entry.content}`).join('\n\n').slice(0, 240000);
  const recent = floors.length ? floors.map(floor => `[助手层 ${floor.index}]\n${floor.content}`).join('\n\n') : '（暂无 AI 正文；本轮仍必须根据世界书与当前状态独立演化。）';
  const regionIds = Object.keys(state.regions).join(' / ');
  const factionIds = Object.keys(state.factions).join(' / ');
  const correctionBlock = correction ? `\n\n【上次输出未通过本地校验】\n${correction}\n请重新输出完整 JSON，不要解释。` : '';
  return `你是一个独立运行的地球世界演化引擎。附属世界书是设定依据，当前状态是已确认事实，最近 AI 回复只是可能的外部证据。当前状态与玩家设置中的时间比例优先于附属世界书内“固定1:1”的旧默认描述。即使正文完全没有提到地球，地球时间、区域、势力和事件仍必须独立前进。

【输出铁律】
1. 只输出一个 JSON 对象，不要 Markdown、代码围栏、思考过程或解释。
2. 根对象只有 actions 和 rationale：{"actions":[],"rationale":""}。
3. 每次必须且只能有一个 {"type":"advance-world-days","days":1}，days 表示玄天界经过的基准日数，只能是 1 至 ${Math.max(1, settings.maxWorldDays)} 的整数；当前玩家设置为地球:玄天界=${settings.timeRatio}，本地状态机会据此换算地球日期，模型不得自行重复乘除。
4. 通常再更新 1-4 个区域、势力或事件；没有大事时也要推进时间，可以只写轻微变化。
5. 不得创造未在世界书或当前状态中有依据的重大事实，不得跨阶。

【允许的 action】
- advance-world-days: {"type":"advance-world-days","days":1}
- set-region-state: regionId 只能是 ${regionIds}；status 只能是 "平稳"/"异常迹象"/"局部应对"。
- set-faction-state: factionId 只能是 ${factionIds}；status 只能是 "潜伏"/"筹备"/"活跃"/"对抗"/"合作"；contact 只能是 "未接触"/"已接触"；activity 必须具体说明该势力本轮做了什么，并与 status 一致，不得沿用旧占位文字。
- create-event 必须嵌套 event：{"type":"create-event","event":{"id":"stable_snake_case_id","kind":"冲突","stage":"迹象","status":"active","summary":"..."}}。kind/首阶段只能是 "冲突"/"迹象"、"建设"/"提议"、"调查"/"线索"。
- advance-event: 只能把已有事件前进一个阶段。
- set-revival-stage / set-contact-stage / set-secret-realm-stage / set-swarm-stage: 仅在前置事实充足时使用，且不得跨阶。

【合法示例】
{"actions":[{"type":"advance-world-days","days":2},{"type":"set-region-state","regionId":"china","status":"异常迹象","summary":"连续观测站记录到轻微稳定读数"}],"rationale":"地球独立前进两日，暂无足以跨阶的重大变化。"}

【当前状态】
${JSON.stringify(state)}

【附属世界书实际挂载内容】
${lore}

【最近 ${floors.length} 条 AI 回复（仅作外部证据）】
${recent}${correctionBlock}`;
}

export async function generateEarthCandidate(settings: EarthApiSettings, state: EarthSimulationState, worldbook: readonly EarthWorldbookContextEntry[], floors: readonly EarthContextFloor[], correction = ''): Promise<unknown> {
  if (!settings.apiBaseUrl.trim() || !settings.apiModel.trim()) throw new Error('请先配置地球推演 API 与模型');
  if (!worldbook.length) throw new Error('当前没有可读的已挂载地球世界书');
  const prompt = buildEarthSimulationPrompt(settings, state, worldbook, floors, correction);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(5, settings.timeoutSeconds || 120) * 1000);
  try {
    const response = await fetchAuto(settings.apiBaseUrl, { method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json', ...(settings.apiKey ? { Authorization: `Bearer ${settings.apiKey}` } : {}) }, body: JSON.stringify({ model: settings.apiModel, temperature: settings.temperature, max_tokens: 4000, messages: [{ role: 'system', content: '严格执行受限状态补丁协议，只输出 JSON。' }, { role: 'user', content: prompt }] }) });
    if (!response.ok) throw new Error(`地球推演 API 请求失败：${response.status}`);
    const text = extractOpenAIText(await response.json());
    if (!text) throw new Error('地球推演 API 返回为空');
    return extractJson(text);
  } finally { clearTimeout(timer); }
}
