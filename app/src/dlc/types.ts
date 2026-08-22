export type DlcId = 'wan_nian_chou_yuan' | 'he_huan_zong' | 'luo_yang' | 'shu_shan';
export type DlcEntryClass = 'core' | 'detail' | 'stage' | 'unmanaged';

export interface DlcEntrySeed { uid: string; name: string; entryClass: DlcEntryClass; sourceEntry: Record<string, unknown>; }
export interface DlcSeed { schemaVersion: 1; id: DlcId; recommendedName: string; entries: DlcEntrySeed[]; }

export interface DlcSettings { wan_nian_chou_yuan: boolean; he_huan_zong: boolean; luo_yang: boolean; shu_shan: boolean; }
export const DEFAULT_DLC_SETTINGS: DlcSettings = { wan_nian_chou_yuan: false, he_huan_zong: false, luo_yang: false, shu_shan: false };
