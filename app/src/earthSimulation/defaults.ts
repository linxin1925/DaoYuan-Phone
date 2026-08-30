import earthSeed from '../dlc/seeds/lingLiFuSuEarth.json' with { type: 'json' };
import { assertEarthSimulationState } from './invariants.ts';
import { EarthSimulationStateSchema } from './schema.ts';
import type { CityState, EarthSimulationState, FactionState, NpcState, RegionState } from './types.ts';

const slug = (prefix: string, uid: string): string => `${prefix}_${uid.padStart(3, '0')}`;
const openingIdentity = (content: unknown): string => {
  const text = typeof content === 'string' ? content : '';
  const identity = text.split('\n').find((line) => /(?:开局身份|职位|身份|归属):/.test(line));
  return (identity?.replace(/^\s*-?\s*/, '').trim() || '依世界书开局档案载入').slice(0, 240);
};

function seedRecords(): Pick<EarthSimulationState, 'npcs' | 'cities'> {
  const npcs: Record<string, NpcState> = {};
  const cities: Record<string, CityState> = {};
  for (const entry of earthSeed.entries) {
    if (entry.name.endsWith('人物档案')) {
      const id = slug('npc', entry.uid); npcs[id] = { id, name: entry.name.slice(0, -4), openingIdentity: openingIdentity(entry.sourceEntry.content), status: '开局身份', sourceEntryName: entry.name };
    }
    if (entry.name.endsWith('城市节点')) {
      const id = slug('city', entry.uid); const intersection = Number(entry.uid) >= 172;
      cities[id] = { id, name: entry.name.slice(0, -4), kind: intersection ? 'intersection-zone' : 'earth-city', stage: intersection ? '不存在' : '开局现状', sourceEntryName: entry.name };
    }
  }
  return { npcs, cities };
}

const PREVIEW_EVENT_CLEANUP = 'preview_events_removed_v12';

function removeLegacyPreviewEvents(state: EarthSimulationState): EarthSimulationState {
  if (state.diagnostics.some((item) => item.code === PREVIEW_EVENT_CLEANUP)) return state;
  const events = state.events.filter((event) => !(
    event.id === 'first_school'
    || event.id === 'anomaly_biology'
    || /first.school|school.prep|anomaly.trace/i.test(event.id)
    || event.summary.includes('第一所灵力学校')
    || event.summary.includes('未确认异常生物')
  ));
  return assertEarthSimulationState({
    ...state,
    events,
    diagnostics: [...state.diagnostics, {
      id: PREVIEW_EVENT_CLEANUP,
      code: PREVIEW_EVENT_CLEANUP,
      level: 'info',
      message: '已清除 V1.2 早期演示事件；后续只展示 reducer 实际提交的数据。',
      createdAt: `${state.earthDate}T00:00:00.000Z`,
    }],
  });
}

export function createDefaultEarthSimulationState(chatId: string, openingDate: string): EarthSimulationState {
  const { npcs, cities } = seedRecords();
  const regions: Record<string, RegionState> = Object.fromEntries(['china', 'usa', 'russia', 'eu'].map((id, index) => [id, { id, name: ['中国', '美国', '俄罗斯', '欧盟'][index], status: '异常迹象', summary: '刚开始确认灵力现象，正在建立观测与应对机制。', updatedAt: openingDate }]));
  const groups: Array<[string, FactionState['category'], string]> = [
    ['中国','国家与区域','控制复苏灾害，保护人口并建立受监管的修真教育'],['美国','国家与区域','掌握个体灵能、企业研发与军事项目'],['俄罗斯','国家与区域','控制天然裂隙并建立虫潮防线'],['欧盟','国家与区域','建立跨界协议、术式标准与超凡法律'],
    ['九州灵工联合体','财团与跨国组织','转化符箓、阵法与灵能电网技术'],['普罗米修斯生命集团','财团与跨国组织','研究觉醒药物、人工灵根与虫群生物技术'],['赫尔墨斯以太工业','财团与跨国组织','控制术式标准、结界与跨界门市场'],['极冠重工','财团与跨国组织','发展共鸣装甲、重型灵能武器与虫巢攻坚'],['天穹轨道集团','财团与跨国组织','建立全球裂隙、灵脉与孢子预警'],['全球异常响应理事会','财团与跨国组织','共享灾害情报并协调跨境危机'],
    ['新人类互助网络','民间与地下组织','为觉醒者提供控制训练与法律援助'],['地球守望阵线','民间与地下组织','维护地球文明主权并打击虫群与非法异界据点'],['开门者联盟','民间与地下组织','推动两界公开交流并反对通道垄断'],['零号港','民间与地下组织','经营跨国超凡黑市与裂隙坐标'],['纯净人类阵线','民间与地下组织','排斥灵力、觉醒者与异界生灵'],['血肉升格会','民间与地下组织','以虫群改造追求生命升格'],
    ['天机阁','玄天界势力','垄断跨界情报并防止单一宗门控制地球'],['万宝楼','玄天界势力','维持地球稳定并建立长期合法贸易'],['大周仙朝','玄天界势力','册封代理并建立政治控制'],['蜀山剑门','玄天界势力','保护无辜、传授基础剑道并阻止魔道掠夺'],['昆仑道门','玄天界势力','限制高阶功法传播并处理失控裂隙'],['万法宗','玄天界势力','研究科技、灵能与法则的融合'],['合欢宗','玄天界势力','通过娱乐、社交与关系扩大影响'],['大雷音寺','玄天界势力','镇压精神污染并传播安神法门'],
    ['东亚协作圈','国家与区域','发展灵能电子、精密装备与地方术式'],['南亚灵性联盟','国家与区域','研究精神、生命能量与古老仪式'],['中东能源集团','国家与区域','以能源资本投资灵能工业、遗迹与安保'],['非洲复苏共同体','国家与区域','保护新生灵脉、特殊生态与本土觉醒传统'],['拉丁美洲联合防卫区','国家与区域','应对雨林虫巢与妖化生态'],['大洋洲隔离区','国家与区域','研究海洋裂隙、异变生物与远洋防线'],
    ['世界灵能研究共同体','财团与跨国组织','公开灵能医学、虫群生物与跨界物理基础知识'],['跨界生命权利委员会','财团与跨国组织','处理觉醒者、智慧妖族与异界来客的人格权'],
    ['华夏复苏道统议会','民间与地下组织','协调地球本土修真传承与现代监管'],['自然之约','民间与地下组织','保护复苏生态与智慧妖化生物'],['白手套公司','民间与地下组织','经营代理行动、遗迹盗掘与样本运输'],['静默区','民间与地下组织','庇护脱离母巢并产生自我意识的虫族个体'],
    ['黑金阁','玄天界势力','走私功法、样本、武器、身份与裂隙坐标'],['广寒宫','玄天界势力','关注冰系灵脉、特殊体质与封闭传承点'],['太阳神宫','玄天界势力','研究现代训练、能源、武器与体修结合'],['血神宫','玄天界势力','获取人口、精血、血脉与生命数据库'],['万魂殿','玄天界势力','获取神魂、精神网络、死亡残念与意识技术'],['尸魔宗','玄天界势力','获取尸体、医疗技术、肉身改造与虫尸材料'],['妖族势力','玄天界势力','保护或收编地球本土妖化生物并争夺生态领地']
  ];
  const factions: Record<string, FactionState> = Object.fromEntries(groups.map(([name, category, objective], index) => { const id = `faction_${String(index + 1).padStart(2, '0')}`; return [id, { id, name, category, contact: '未接触', status: '潜伏', objective, activity: '尚未进入公开行动阶段。', influence: category === '国家与区域' ? 35 : 15, updatedAt: openingDate }]; }));
  return assertEarthSimulationState({
    schemaVersion: 1, chatId, sequence: 0, lastCommittedFingerprint: '', openingDate, earthDate: openingDate, xuantianDate: openingDate, timeRatio: '1:1', earthDayRemainder: 0, revivalYear: 0,
    revivalStage: '复苏初现', contactStage: '互不知情', secretRealmStage: '未激活', swarmEarthStage: '零星迹象', swarmXuantianStage: '零星迹象', swarmPassageOpen: true,
    regions, factions, schools: { first_school: { id: 'first_school', name: '第一所灵力学校', stage: '筹备启动' } }, npcs, cities, events: [], checkpoints: [], diagnostics: [{ id: PREVIEW_EVENT_CLEANUP, code: PREVIEW_EVENT_CLEANUP, level: 'info', message: '默认状态不包含演示事件。', createdAt: `${openingDate}T00:00:00.000Z` }], autoCounter: 0, processedMessageIds: [], processedAutoMessageFingerprints: [], processedMessageFingerprints: [],
  });
}

export function initializeEarthSimulationState(existing: unknown, chatId: string, openingDate: string): EarthSimulationState {
  const parsed = EarthSimulationStateSchema.safeParse(existing);
  if (parsed.success && parsed.data.chatId === chatId) {
    const latest = createDefaultEarthSimulationState(chatId, parsed.data.openingDate);
    const complete = Object.keys(latest.factions).every((key) => key in parsed.data.factions)
      ? existing as EarthSimulationState
      : assertEarthSimulationState({ ...parsed.data, factions: { ...latest.factions, ...parsed.data.factions } });
    return removeLegacyPreviewEvents(complete);
  }
  const fallback = createDefaultEarthSimulationState(chatId, openingDate);
  if (!existing || typeof existing !== 'object' || Array.isArray(existing)) return fallback;
  const legacy = existing as Partial<EarthSimulationState>;
  if (legacy.schemaVersion !== 1 || legacy.chatId !== chatId) return fallback;
  const regions = { ...fallback.regions };
  for (const [key, value] of Object.entries(legacy.regions ?? {})) if (regions[key] && value && typeof value === 'object') regions[key] = { ...regions[key], ...(value as Partial<RegionState>), summary: typeof (value as Partial<RegionState>).summary === 'string' ? (value as Partial<RegionState>).summary! : regions[key].summary, updatedAt: typeof (value as Partial<RegionState>).updatedAt === 'string' ? (value as Partial<RegionState>).updatedAt! : fallback.earthDate };
  const candidate = { ...fallback, ...legacy, openingDate: typeof legacy.openingDate === 'string' ? legacy.openingDate : fallback.openingDate, earthDate: typeof legacy.earthDate === 'string' ? legacy.earthDate : fallback.earthDate, xuantianDate: typeof legacy.xuantianDate === 'string' ? legacy.xuantianDate : fallback.xuantianDate, regions, factions: { ...fallback.factions, ...(legacy.factions ?? {}) } };
  const migrated = EarthSimulationStateSchema.safeParse(candidate);
  return migrated.success ? removeLegacyPreviewEvents(migrated.data as EarthSimulationState) : fallback;
}
