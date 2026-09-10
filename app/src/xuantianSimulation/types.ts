export const XUANTIAN_SIMULATION_STATE_KEY = 'daoyuan_xuantian_simulation_v1';

export type XuantianRegionId = 'center' | 'east' | 'south' | 'north' | 'west';
export type XuantianFactionRank = '跨域组织' | '顶尖势力' | '大型势力' | '凡人势力' | '地下组织';
export type XuantianFactionStatus = string;
export type XuantianRelation = string;
export type XuantianEventKind = string;
export type XuantianEventPhase = '苗头' | '酝酿' | '发展' | '高潮' | '收束';

export interface XuantianRegionState { id: XuantianRegionId; name: string; alignment: string; status: string; pressure: number; summary: string; updatedAtDay: number; }
export interface XuantianFactionState { id: string; name: string; regionId: XuantianRegionId | 'cross'; rank: XuantianFactionRank; status: XuantianFactionStatus; relation: XuantianRelation; objective: string; activity: string; influence: number; updatedAtDay: number; }
export interface XuantianEventLine { id: string; name: string; kind: XuantianEventKind; regionId: XuantianRegionId | 'cross'; factionIds: string[]; phase: XuantianEventPhase; progress: number; status: 'active' | 'closed'; startedAtDay: number; updatedAtDay: number; summary: string; consequence: string; }

export interface XuantianSimulationState {
  schemaVersion: 1;
  chatId: string;
  sequence: number;
  worldDay: number;
  calendarLabel: string;
  lastCommittedFingerprint: string;
  regions: Record<XuantianRegionId, XuantianRegionState>;
  factions: Record<string, XuantianFactionState>;
  events: XuantianEventLine[];
  autoCounter: number;
  processedMessageIds: string[];
  processedMessageFingerprints: string[];
}

export type XuantianSimulationAction =
  | { type: 'advance-world-days'; days: number }
  | { type: 'set-calendar-label'; label: string }
  | { type: 'set-region-state'; regionId: XuantianRegionId; status: XuantianRegionState['status']; pressureDelta?: number; summary: string }
  | { type: 'set-faction-state'; factionId: string; status: XuantianFactionStatus; relation?: XuantianRelation; influenceDelta?: number; activity: string }
  | { type: 'create-event'; event: Omit<XuantianEventLine, 'phase' | 'progress' | 'status' | 'startedAtDay' | 'updatedAtDay'> & Partial<Pick<XuantianEventLine, 'phase' | 'progress'>> }
  | { type: 'advance-event'; eventId: string; nextPhase: XuantianEventPhase; progress: number; summary: string; consequence?: string }
  | { type: 'close-event'; eventId: string; summary: string; consequence: string };
