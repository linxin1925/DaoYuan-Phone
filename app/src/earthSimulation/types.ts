export const EARTH_SIMULATION_STATE_KEY = 'daoyuan_earth_simulation_v1';
export const EARTH_WORLD_BOOK_ID = 'ling_li_fu_su_earth' as const;
export const EARTH_WORLD_BOOK_NAME = '灵力复苏地球附属世界书' as const;

export type RevivalStage = '复苏初现' | '局部复苏' | '全球公开' | '全面超凡化';
export type ContactStage = '互不知情' | '少数知情' | '势力接触' | '公开交流';
export type SecretRealmStage = '未激活' | '信息联系' | '人员携物通行' | '制度化往来';
export type SwarmStage = '零星迹象' | '局部虫巢' | '区域战争' | '双界同时入侵' | '界域危机';
export type EventKind = '冲突' | '建设' | '调查';
export type EventStatus = 'active' | 'closed';
export type EarthTimeRatio = '1:5' | '1:2' | '1:1' | '2:1' | '5:1' | '10:1';

export interface RegionState { id: string; name: string; status: '平稳' | '异常迹象' | '局部应对'; summary: string; updatedAt: string; }
export interface FactionState { id: string; name: string; category: '国家与区域' | '财团与跨国组织' | '民间与地下组织' | '玄天界势力'; contact: '未接触' | '已接触'; status: '潜伏' | '筹备' | '活跃' | '对抗' | '合作'; objective: string; activity: string; influence: number; updatedAt: string; }
export interface SchoolState { id: string; name: string; stage: '筹备启动' | '选址' | '建设' | '试运行' | '正式运行'; }
export interface NpcState { id: string; name: string; openingIdentity: string; status: '开局身份'; sourceEntryName: string; }
export interface CityState { id: string; name: string; kind: 'earth-city' | 'intersection-zone'; stage: '开局现状' | '不存在'; sourceEntryName: string; }
export interface SimulationEvent { id: string; kind: EventKind; stage: string; status: EventStatus; summary: string; worldDate: string; }
export interface CheckpointMeta { id: string; sequence: number; worldDate: string; fingerprint: string; }
export interface DiagnosticEntry { id: string; level: 'info' | 'warning' | 'error'; code: string; message: string; createdAt: string; }

export interface EarthSimulationState {
  schemaVersion: 1;
  chatId: string;
  sequence: number;
  lastCommittedFingerprint: string;
  openingDate: string;
  earthDate: string;
  xuantianDate: string;
  timeRatio: EarthTimeRatio;
  earthDayRemainder: number;
  revivalYear: number;
  revivalStage: RevivalStage;
  contactStage: ContactStage;
  secretRealmStage: SecretRealmStage;
  swarmEarthStage: SwarmStage;
  swarmXuantianStage: SwarmStage;
  swarmPassageOpen: boolean;
  regions: Record<string, RegionState>;
  factions: Record<string, FactionState>;
  schools: Record<string, SchoolState>;
  npcs: Record<string, NpcState>;
  cities: Record<string, CityState>;
  events: SimulationEvent[];
  checkpoints: CheckpointMeta[];
  diagnostics: DiagnosticEntry[];
  autoCounter: number;
  processedMessageIds: string[];
  processedAutoMessageFingerprints: string[];
  processedMessageFingerprints: string[];
}

export type EarthSimulationAction =
  | { type: 'advance-world-days'; days: number }
  | { type: 'set-world-date'; date: string }
  | { type: 'set-time-ratio'; ratio: EarthTimeRatio }
  | { type: 'set-region-state'; regionId: string; status: RegionState['status']; summary: string }
  | { type: 'set-faction-state'; factionId: string; status: FactionState['status']; activity: string; influenceDelta?: number; contact?: FactionState['contact'] }
  | { type: 'create-event'; event: SimulationEvent }
  | { type: 'set-revival-stage'; stage: RevivalStage }
  | { type: 'set-contact-stage'; stage: ContactStage }
  | { type: 'advance-event'; eventId: string; nextStage: string; summary?: string }
  | { type: 'set-secret-realm-stage'; stage: SecretRealmStage }
  | { type: 'set-swarm-stage'; world: 'earth' | 'xuantian'; stage: SwarmStage }
  | { type: 'remember-fingerprint'; fingerprint: string }
  | { type: 'add-diagnostic'; diagnostic: DiagnosticEntry };
