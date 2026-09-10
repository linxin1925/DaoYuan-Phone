import seedJson from '../dlc/seeds/xuantianSimulationRules.json' with { type: 'json' };
import { toRuntimeEntry } from '../dlc/worldbookAdapter.ts';

export const XUANTIAN_RULE_BOOK_NAME = '道渊·玄天界世界推演规则书';
export const XUANTIAN_RULE_BOOK_SEED = seedJson;
export const xuantianRulebookEntries = () => seedJson.entries.map(entry => toRuntimeEntry(entry.sourceEntry));
