import { z } from 'zod';

export const BRIDGE_PROTOCOL = 1;

export const BridgeActionSchema = z.enum([
  'APP_READY',
  'REQUEST_CONTEXT',
  'SET_LAYOUT',
  'SET_ACTIVE_APP',
  'SET_PET_SIZE',
  'SET_MAP_VIEW',
  'CLOSE_SHELL',
  'REQUEST_DIAGNOSTIC',
  'REQUEST_MVU_CHANNEL',
  'MVU_CHANNEL_SNAPSHOT',
  'REPLACE_MVU_CHANNEL_STAT_DATA',
  'MVU_CHANNEL_WRITE_STATUS',
  'SEND_YUJIAN_MESSAGE',
  'YUJIAN_SEND_STATUS',
  'REQUEST_YUJIAN_LORE',
  'YUJIAN_LORE_DATA',
  'REQUEST_YUJIAN_MODELS',
  'YUJIAN_MODELS_DATA',
  'SAVE_YUJIAN_SETTINGS',
  'IMPORT_STATUS_YUJIAN_HISTORY',
  'YUJIAN_HISTORY_IMPORT_STATUS',
  'DELETE_YUJIAN_MESSAGE',
  'CLEAR_YUJIAN_HISTORY',
  'YUJIAN_HISTORY_DELETE_STATUS',
  'SAVE_REROLL_SETTINGS',
  'REROLL_SETTINGS_STATUS',
  'REQUEST_BEAUTY_MODELS',
  'BEAUTY_MODELS_DATA',
  'SAVE_BEAUTY_SETTINGS',
  'BEAUTY_SETTINGS_STATUS',
  'REQUEST_XIANWANG_MODELS',
  'XIANWANG_MODELS_DATA',
  'SAVE_XIANWANG_SETTINGS',
  'XIANWANG_SETTINGS_STATUS',
  'REQUEST_WANBAO_MODELS', 'WANBAO_MODELS_DATA', 'SAVE_WANBAO_API_SETTINGS', 'WANBAO_SETTINGS_STATUS',
  'SAVE_PROMPT_INJECTION_SETTINGS',
  'PROMPT_INJECTION_SETTINGS_STATUS',
  'GENERATE_TRENDS',
  'TRENDS_GENERATION_STATUS',
  'DELETE_TREND',
  'TREND_DELETE_STATUS',
  'GENERATE_FORUM', 'FORUM_GENERATION_STATUS', 'DELETE_FORUM_POST', 'FORUM_DELETE_STATUS',
  'TOGGLE_TREND_LIKE', 'TOGGLE_FORUM_LIKE', 'TOGGLE_NEWS_LIKE',
  'SUBMIT_FORUM_COMMENT', 'FORUM_COMMENT_STATUS',
  'GENERATE_NEWS', 'NEWS_GENERATION_STATUS', 'DELETE_NEWS_PAPER', 'NEWS_DELETE_STATUS',
  'GENERATE_BEAUTY_RANK',
  'BEAUTY_GENERATION_STATUS',
  'GENERATE_BEAUTY_REPLY',
  'BEAUTY_REPLY_STATUS',
  'GENERATE_WANBAO', 'WANBAO_GENERATION_STATUS', 'ESTIMATE_WANBAO', 'WANBAO_ESTIMATE_STATUS', 'BUY_WANBAO', 'SELL_WANBAO', 'WANBAO_TRADE_STATUS', 'DELETE_WANBAO_PRODUCT', 'DELETE_WANBAO_TRANSACTION', 'CLEAR_WANBAO_TRANSACTIONS',
]);

export type BridgeAction = z.infer<typeof BridgeActionSchema>;

export const BridgeEnvelopeSchema = z.object({
  protocol: z.literal(BRIDGE_PROTOCOL),
  kind: z.enum(['request', 'event', 'response']),
  action: BridgeActionSchema,
  payload: z.record(z.string(), z.unknown()).default({}),
  contextRevision: z.number().int().nonnegative().default(0),
});

export type BridgeEnvelope = z.infer<typeof BridgeEnvelopeSchema>;

export function makeBridgeMessage(
  kind: BridgeEnvelope['kind'],
  action: BridgeAction,
  payload: Record<string, unknown> = {},
  contextRevision = 0,
): BridgeEnvelope {
  return { protocol: BRIDGE_PROTOCOL, kind, action, payload, contextRevision };
}

export function parseBridgeMessage(value: unknown): BridgeEnvelope | null {
  const result = BridgeEnvelopeSchema.safeParse(value);
  return result.success ? result.data : null;
}
