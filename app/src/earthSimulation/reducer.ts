import { assertEarthSimulationState } from './invariants.ts';
import type { EarthSimulationAction, EarthSimulationState } from './types.ts';

const EVENT_STAGES = {
  '冲突': ['迹象', '发酵', '逼近', '爆发', '收束'],
  '建设': ['提议', '筹备', '执行', '关键', '完成', '失败'],
  '调查': ['线索', '验证', '锁定', '揭露', '结案', '悬置'],
} as const;
const REVIVAL_STAGES = ['复苏初现', '局部复苏', '全球公开', '全面超凡化'] as const;
const CONTACT_STAGES = ['互不知情', '少数知情', '势力接触', '公开交流'] as const;
const addDays = (date: string, days: number): string => { const value = new Date(`${date}T00:00:00Z`); value.setUTCDate(value.getUTCDate() + days); return value.toISOString().slice(0, 10); };

export function earthSimulationReducer(state: EarthSimulationState, action: EarthSimulationAction): EarthSimulationState {
  let next: EarthSimulationState;
  if (action.type === 'advance-world-days') { if (!Number.isInteger(action.days) || action.days < 1 || action.days > 30) throw new Error('单次世界时间只允许推进 1-30 个玄天界基准日'); const [earthUnits, xuantianUnits] = state.timeRatio.split(':').map(Number); const accumulated = state.earthDayRemainder + action.days * earthUnits; const earthDays = Math.floor(accumulated / xuantianUnits); const earthDate = addDays(state.earthDate, earthDays); const xuantianDate = addDays(state.xuantianDate, action.days); next = { ...state, earthDate, xuantianDate, earthDayRemainder: accumulated % xuantianUnits, revivalYear: Math.floor((Date.parse(earthDate) - Date.parse(state.openingDate)) / 31536000000) }; }
  else if (action.type === 'set-world-date') next = { ...state, earthDate: action.date, xuantianDate: action.date, earthDayRemainder: 0 };
  else if (action.type === 'set-time-ratio') next = action.ratio === state.timeRatio ? state : { ...state, timeRatio: action.ratio, earthDayRemainder: 0 };
  else if (action.type === 'set-region-state') { const region = state.regions[action.regionId]; if (!region) throw new Error(`未找到区域：${action.regionId}`); next = { ...state, regions: { ...state.regions, [action.regionId]: { ...region, status: action.status, summary: action.summary.slice(0, 1000), updatedAt: state.earthDate } } }; }
  else if (action.type === 'set-faction-state') { const faction = state.factions[action.factionId]; if (!faction) throw new Error(`未找到势力：${action.factionId}`); next = { ...state, factions: { ...state.factions, [action.factionId]: { ...faction, status: action.status, activity: action.activity.slice(0, 1000), influence: Math.max(0, Math.min(100, faction.influence + Math.max(-10, Math.min(10, Math.trunc(action.influenceDelta ?? 0))))), contact: action.contact ?? faction.contact, updatedAt: state.earthDate } } }; }
  else if (action.type === 'create-event') { if (state.events.some(event => event.id === action.event.id)) throw new Error(`事件 ID 已存在：${action.event.id}`); if (state.events.filter(event => event.status === 'active').length >= 20) throw new Error('活跃事件已达上限'); const initial = EVENT_STAGES[action.event.kind][0]; if (action.event.stage !== initial || action.event.status !== 'active') throw new Error('新事件必须从该类型首阶段开始'); next = { ...state, events: [...state.events, { ...action.event, worldDate: state.earthDate }] }; }
  else if (action.type === 'set-revival-stage') { const current = REVIVAL_STAGES.indexOf(state.revivalStage); const target = REVIVAL_STAGES.indexOf(action.stage); if (target !== current + 1) throw new Error('灵力复苏阶段每次只允许前进一级'); next = { ...state, revivalStage: action.stage }; }
  else if (action.type === 'set-contact-stage') { const current = CONTACT_STAGES.indexOf(state.contactStage); const target = CONTACT_STAGES.indexOf(action.stage); if (target !== current + 1) throw new Error('双界接触阶段每次只允许前进一级'); next = { ...state, contactStage: action.stage }; }
  else if (action.type === 'set-secret-realm-stage') next = { ...state, secretRealmStage: action.stage };
  else if (action.type === 'set-swarm-stage') next = action.world === 'earth' ? { ...state, swarmEarthStage: action.stage } : { ...state, swarmXuantianStage: action.stage };
  else if (action.type === 'remember-fingerprint') next = state.processedMessageFingerprints.includes(action.fingerprint) ? state : { ...state, processedMessageFingerprints: [...state.processedMessageFingerprints, action.fingerprint].slice(-200) };
  else if (action.type === 'add-diagnostic') next = { ...state, diagnostics: [...state.diagnostics, action.diagnostic].slice(-80) };
  else {
    const event = state.events.find((item) => item.id === action.eventId);
    if (!event) throw new Error(`未找到事件：${action.eventId}`);
    const stages = EVENT_STAGES[event.kind]; const current = stages.indexOf(event.stage as never); const target = stages.indexOf(action.nextStage as never);
    if (current < 0 || target !== current + 1) throw new Error('普通 reducer 每次只允许事件前进一个阶段');
    next = { ...state, events: state.events.map((item) => item.id === action.eventId ? { ...item, stage: action.nextStage, summary: action.summary ?? item.summary } : item) };
  }
  return next === state ? state : assertEarthSimulationState(next);
}
