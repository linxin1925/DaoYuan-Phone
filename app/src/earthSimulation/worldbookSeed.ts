import type { WorldbookEntryLike } from '../dlc/diagnostics.ts';
import earthSeedJson from '../dlc/seeds/lingLiFuSuEarth.json' with { type: 'json' };
import { toRuntimeEntry } from '../dlc/worldbookAdapter.ts';
import { EARTH_WORLD_BOOK_ID, EARTH_WORLD_BOOK_NAME } from './types.ts';

export interface EarthWorldbookSeed { schemaVersion: 1; id: typeof EARTH_WORLD_BOOK_ID; recommendedName: typeof EARTH_WORLD_BOOK_NAME; displayName: '灵力复苏地球'; installType: 'simulation-routed'; sourceSha256: string; entries: Array<{ uid: string; name: string; sourceEntry: Record<string, unknown> }>; }
export const EARTH_WORLD_BOOK_SEED = earthSeedJson as EarthWorldbookSeed;
export const earthWorldbookEntries = (): WorldbookEntryLike[] => EARTH_WORLD_BOOK_SEED.entries.map((entry) => toRuntimeEntry(entry.sourceEntry));
