import { z } from 'zod';

export const APP_DATA_SCHEMA_VERSION = 1;

export const BeautyRankEntrySchema = z.object({
  id: z.string().trim().min(1).max(160),
  name: z.string().trim().min(1).max(120),
  rank: z.string().trim().min(1).max(20),
  title: z.string().trim().max(200).default(''),
  xianzi: z.string().trim().max(4000).default(''),
  qunfangpu: z.string().trim().max(4000).default(''),
  portrait: z.string().trim().max(2000).optional(),
  updatedAt: z.string().datetime().optional(),
});

export type BeautyRankEntry = z.infer<typeof BeautyRankEntrySchema>;

export const BeautyRankReplySchema = z.object({
  id: z.string().trim().min(1).max(160),
  name: z.string().trim().min(1).max(120),
  content: z.string().trim().min(1).max(4000),
  floor: z.number().int().positive(),
  time: z.string().trim().max(80),
  likes: z.number().int().nonnegative().default(0),
  liked: z.boolean().default(false),
  replyTo: z.number().int().nonnegative().optional(),
});

export type BeautyRankReply = z.infer<typeof BeautyRankReplySchema>;

export const BeautyRankDataSchema = z.object({
  entries: z.array(BeautyRankEntrySchema).max(500),
  replies: z.array(BeautyRankReplySchema).max(2000).default([]),
  source: z.literal('daoyuan-beauty-api').default('daoyuan-beauty-api'),
});

export type BeautyRankData = z.infer<typeof BeautyRankDataSchema>;

export const TrendCommentSchema = z.object({
  id: z.string().trim().min(1).max(160),
  author: z.string().trim().min(1).max(120),
  content: z.string().trim().min(1).max(2000),
});

export const TrendPostSchema = z.object({
  id: z.string().trim().min(1).max(160),
  type: z.enum(['爆料', '求证', '目击', '流言', '警示', '异象', '宗门秘闻']),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(4000),
  location: z.string().trim().min(1).max(200),
  source: z.string().trim().min(1).max(120),
  storyTime: z.string().trim().min(1).max(120),
  credibility: z.number().int().min(0).max(100),
  heat: z.number().int().nonnegative().max(100000000),
  liked: z.boolean().default(false),
  comments: z.array(TrendCommentSchema).max(8).default([]),
  generatedBy: z.enum(['ai', 'manual']).default('ai'),
  createdAt: z.string().datetime(),
  sourceMessageId: z.string().max(80).optional(),
  sourceFingerprint: z.string().max(80).optional(),
});

export const TrendsDataSchema = z.object({
  posts: z.array(TrendPostSchema).max(500).default([]),
  autoCounter: z.number().int().nonnegative().default(0),
  processedMessageIds: z.array(z.string().max(80)).max(200).default([]),
  processedSwipeKeys: z.array(z.string().max(120)).max(400).default([]),
  triggeredMessageIds: z.array(z.string().max(80)).max(200).default([]),
  triggeredSwipeKeys: z.array(z.string().max(180)).max(200).default([]),
});

export type TrendPost = z.infer<typeof TrendPostSchema>;
export type TrendsData = z.infer<typeof TrendsDataSchema>;

export const ForumCommentSchema = z.object({ id: z.string().min(1), author: z.string().min(1).max(120), content: z.string().min(1).max(3000), storyTime: z.string().max(120).default('') });
export const ForumPostSchema = z.object({
  id: z.string().min(1), tag: z.string().min(1).max(40), title: z.string().min(1).max(240), content: z.string().min(1).max(8000),
  author: z.string().min(1).max(120), storyTime: z.string().min(1).max(120), likes: z.number().int().nonnegative().max(100000000),
  liked: z.boolean().optional(),
  comments: z.array(ForumCommentSchema).max(20).default([]), generatedBy: z.enum(['ai', 'manual']).default('ai'), createdAt: z.string().datetime(), sourceMessageId: z.string().max(80).optional(), sourceFingerprint: z.string().max(80).optional(),
});
export const ForumDataSchema = z.object({ posts: z.array(ForumPostSchema).max(500).default([]), autoCounter: z.number().int().nonnegative().default(0), processedMessageIds: z.array(z.string().max(80)).max(200).default([]), processedSwipeKeys: z.array(z.string().max(120)).max(400).default([]), triggeredMessageIds: z.array(z.string().max(80)).max(200).default([]), triggeredSwipeKeys: z.array(z.string().max(180)).max(200).default([]) });
export type ForumPost = z.infer<typeof ForumPostSchema>;
export type ForumData = z.infer<typeof ForumDataSchema>;

export const NewsArticleSchema = z.object({ tag: z.string().min(1).max(40), source: z.string().min(1).max(120), title: z.string().min(1).max(240), content: z.string().min(1).max(10000) });
export const ReaderLetterSchema = z.object({ author: z.string().min(1).max(120), content: z.string().min(1).max(3000) });
export const NewsPaperSchema = z.object({
  id: z.string().min(1), title: z.string().min(1).max(120), issue: z.string().min(1).max(120), editor: z.string().min(1).max(120), editorNote: z.string().min(1).max(3000), storyTime: z.string().min(1).max(120), likes: z.number().int().nonnegative().max(100000000),
  liked: z.boolean().optional(),
  articles: z.array(NewsArticleSchema).min(2).max(8), letters: z.array(ReaderLetterSchema).max(12).default([]), generatedBy: z.literal('ai').default('ai'), createdAt: z.string().datetime(), sourceMessageId: z.string().max(80).optional(), sourceFingerprint: z.string().max(80).optional(),
});
export const NewsDataSchema = z.object({ papers: z.array(NewsPaperSchema).max(200).default([]), autoCounter: z.number().int().nonnegative().default(0), processedMessageIds: z.array(z.string().max(80)).max(200).default([]), processedSwipeKeys: z.array(z.string().max(120)).max(400).default([]), triggeredMessageIds: z.array(z.string().max(80)).max(200).default([]), triggeredSwipeKeys: z.array(z.string().max(180)).max(200).default([]) });
export type NewsPaper = z.infer<typeof NewsPaperSchema>;
export type NewsData = z.infer<typeof NewsDataSchema>;

export const CHAT_VARIABLE_KEYS = [
  'daoyuan_yujian_data',
  'daoyuan_web_beauty_data',
  'daoyuan_web_trends_data',
  'daoyuan_forum_data',
  'daoyuan_news_data',
  'daoyuan_map_state',
] as const;

export type ChatVariableKey = (typeof CHAT_VARIABLE_KEYS)[number];

const StringValue = z.string().trim().max(4000);

export const AppDataSchema = z.object({
  schemaVersion: z.number().int().positive(),
  revision: z.number().int().nonnegative(),
  yujian: z.object({ unread: z.number().int().nonnegative(), contacts: z.number().int().nonnegative() }),
  webBeauty: z.object({ entries: z.number().int().nonnegative(), label: z.literal('绝色榜') }),
  webTrends: z.object({ entries: z.number().int().nonnegative(), label: z.literal('仙网风闻，可能失真') }),
  forum: z.object({ posts: z.number().int().nonnegative(), unread: z.number().int().nonnegative() }),
  news: z.object({ headlines: z.number().int().nonnegative() }),
  map: z.object({ selectedRealm: z.enum(['玄天界', '仙界']), selectedNode: StringValue }),
});

export type AppData = z.infer<typeof AppDataSchema>;

export const emptyAppData: AppData = {
  schemaVersion: APP_DATA_SCHEMA_VERSION,
  revision: 0,
  yujian: { unread: 0, contacts: 0 },
  webBeauty: { entries: 0, label: '绝色榜' },
  webTrends: { entries: 0, label: '仙网风闻，可能失真' },
  forum: { posts: 0, unread: 0 },
  news: { headlines: 0 },
  map: { selectedRealm: '玄天界', selectedNode: 'center' },
};

export const AppDataEnvelopeSchema = z.object({
  schemaVersion: z.number().int().positive(),
  revision: z.number().int().nonnegative(),
  updatedAt: z.string().datetime().optional(),
  data: z.record(z.string(), z.unknown()),
});

export type AppDataEnvelope = z.infer<typeof AppDataEnvelopeSchema>;

export const emptyChatVariableData: Record<ChatVariableKey, Record<string, unknown>> = {
  daoyuan_yujian_data: { contacts: [], messages: {}, unread: 0 },
  daoyuan_web_beauty_data: { entries: [], replies: [], source: 'daoyuan-beauty-api' },
  daoyuan_web_trends_data: { posts: [] },
  daoyuan_forum_data: { posts: [] },
  daoyuan_news_data: { papers: [] },
  daoyuan_map_state: { selectedRealm: '玄天界', selectedNode: 'center' },
};

export const previewAppData: AppData = {
  schemaVersion: APP_DATA_SCHEMA_VERSION,
  revision: 12,
  yujian: { unread: 3, contacts: 8 },
  webBeauty: { entries: 24, label: '绝色榜' },
  webTrends: { entries: 17, label: '仙网风闻，可能失真' },
  forum: { posts: 38, unread: 5 },
  news: { headlines: 6 },
  map: { selectedRealm: '玄天界', selectedNode: 'center' },
};

export function parseAppData(value: unknown): AppData {
  const result = AppDataSchema.safeParse(value);
  return result.success ? result.data : emptyAppData;
}

export function parseChatVariableEnvelope(value: unknown, key: ChatVariableKey): AppDataEnvelope {
  const result = AppDataEnvelopeSchema.safeParse(value);
  if (result.success) return result.data;
  return {
    schemaVersion: APP_DATA_SCHEMA_VERSION,
    revision: 0,
    data: { ...emptyChatVariableData[key] },
  };
}

export function parseBeautyRankData(value: unknown): BeautyRankData {
  const result = BeautyRankDataSchema.safeParse(value);
  return result.success ? result.data : { entries: [], replies: [], source: 'daoyuan-beauty-api' };
}

export function parseTrendsData(value: unknown): TrendsData {
  const result = TrendsDataSchema.safeParse(value);
  return result.success ? result.data : { posts: [], autoCounter: 0, processedMessageIds: [], processedSwipeKeys: [], triggeredMessageIds: [], triggeredSwipeKeys: [] };
}

export function parseForumData(value: unknown): ForumData {
  const result = ForumDataSchema.safeParse(value);
  return result.success ? result.data : { posts: [], autoCounter: 0, processedMessageIds: [], processedSwipeKeys: [], triggeredMessageIds: [], triggeredSwipeKeys: [] };
}

export function parseNewsData(value: unknown): NewsData {
  const result = NewsDataSchema.safeParse(value);
  return result.success ? result.data : { papers: [], autoCounter: 0, processedMessageIds: [], processedSwipeKeys: [], triggeredMessageIds: [], triggeredSwipeKeys: [] };
}

export function projectAppData(values: Partial<Record<ChatVariableKey, unknown>>): AppData {
  const yujian = parseChatVariableEnvelope(values.daoyuan_yujian_data, 'daoyuan_yujian_data').data;
  const beauty = parseChatVariableEnvelope(values.daoyuan_web_beauty_data, 'daoyuan_web_beauty_data').data;
  const beautyEntries = parseBeautyRankData(beauty).entries;
  const trends = parseChatVariableEnvelope(values.daoyuan_web_trends_data, 'daoyuan_web_trends_data').data;
  const forum = parseChatVariableEnvelope(values.daoyuan_forum_data, 'daoyuan_forum_data').data;
  const news = parseChatVariableEnvelope(values.daoyuan_news_data, 'daoyuan_news_data').data;
  const map = parseChatVariableEnvelope(values.daoyuan_map_state, 'daoyuan_map_state').data;
  const count = (value: unknown): number => Array.isArray(value) ? value.length : 0;
  const number = (value: unknown): number => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
  const selectedRealm = map.selectedRealm === '仙界' ? '仙界' : '玄天界';
  const selectedNode = typeof map.selectedNode === 'string' && map.selectedNode.trim() ? map.selectedNode.trim() : 'center';
  return {
    schemaVersion: APP_DATA_SCHEMA_VERSION,
    revision: Math.max(...Object.values(values).map(value => parseChatVariableEnvelope(value, 'daoyuan_map_state').revision), 0),
    yujian: { unread: number(yujian.unread), contacts: count(yujian.contacts) },
    webBeauty: { entries: beautyEntries.length, label: '绝色榜' },
    webTrends: { entries: count(trends.posts), label: '仙网风闻，可能失真' },
    forum: { posts: count(forum.posts), unread: number(forum.unread) },
    news: { headlines: count(news.papers) },
    map: { selectedRealm, selectedNode },
  };
}
