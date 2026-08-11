import { z } from 'zod';
import { TrendPostSchema, type TrendPost } from '../contract/appData';

export interface XianwangApiSettings {
  apiBaseUrl: string;
  apiKey: string;
  apiModel: string;
  trendsAutoEnabled: boolean;
  autoInterval: number;
  batchMin: number;
  batchMax: number;
  maxPosts: number;
  forumAutoEnabled: boolean; forumAutoInterval: number; forumBatchSize: number; forumMaxPosts: number;
  newsAutoEnabled: boolean; newsAutoInterval: number; newsBatchSize: number; newsMaxPapers: number;
}

const AiCommentSchema = z.object({
  author: z.string().trim().min(1).max(120),
  content: z.string().trim().min(1).max(2000),
}).strict();

const TREND_TYPES = ['爆料', '求证', '目击', '流言', '警示', '异象', '宗门秘闻'] as const;

function normalizeTrendType(value: unknown): typeof TREND_TYPES[number] {
  if (typeof value !== 'string') return '流言';
  const normalized = value.trim();
  const exact = TREND_TYPES.find(type => type === normalized);
  if (exact) return exact;
  if (/爆|曝|揭秘|秘闻|内幕|瓜/.test(normalized)) return '爆料';
  if (/求证|询问|真假|确认|考证/.test(normalized)) return '求证';
  if (/目击|亲眼|见闻|现场/.test(normalized)) return '目击';
  if (/警|危险|注意|避雷|通缉/.test(normalized)) return '警示';
  if (/异象|异变|异常|怪事|奇观/.test(normalized)) return '异象';
  if (/宗门|门派|仙宗/.test(normalized)) return '宗门秘闻';
  return '流言';
}

function normalizeTrendTitle(value: string): string {
  return value
    .replace(/^\s*(?:【\s*(?:爆料|求证|目击|流言|警示|异象|宗门秘闻|树洞|传闻|秘闻)\s*】|\[\s*(?:爆料|求证|目击|流言|警示|异象|宗门秘闻|树洞|传闻|秘闻)\s*\])\s*/u, '')
    .trim();
}

const AiRumorSchema = z.object({
  // Models occasionally invent a synonymous category. Normalize that single
  // presentation field while keeping all factual/content fields strict.
  type: z.preprocess(normalizeTrendType, z.enum(TREND_TYPES)),
  title: z.string().trim().transform(normalizeTrendTitle).pipe(z.string().min(1).max(200)),
  description: z.string().trim().min(1).max(4000),
  location: z.string().trim().min(1).max(200),
  source: z.string().trim().min(1).max(120),
  storyTime: z.string().trim().min(1).max(120),
  credibility: z.number().int().min(0).max(100),
  heat: z.number().int().nonnegative().max(100000000),
  comments: z.array(AiCommentSchema).max(5),
}).strict();

const AiResponseSchema = z.object({
  schemaVersion: z.literal(1),
  rumors: z.array(AiRumorSchema).min(1).max(8),
}).strict();

export const XIANWANG_TRENDS_SYSTEM_PROMPT = `你是修仙世界“仙网风闻”的内容编辑器。你的任务是依据给定剧情、世界资料和既有风闻，创作尚未证实的仙网爆料、目击、求证、流言与舆情线索。

铁律：
1. 风闻不等于世界事实。可以误读、夸张、猜测或互相矛盾，但不得把未知内容宣称为已经确认的官方事实。
2. 不得提前泄露尚未发生的剧情，不得虚构输入资料明确否定的设定。
3. 大多数风闻应来自世界中的普通修士、商贩、弟子、旅人或匿名用户，不得全部围绕主角。
4. 同批标题与主题必须明显不同；评论应包含相信、质疑、调侃或补充等不同立场。
5. storyTime必须使用故事内时间。credibility为0至100整数，heat为非负整数。
6. 只能返回一个合法JSON对象，不得输出Markdown、代码围栏、解释、思考过程或额外字段。
7. type只能逐字使用以下七项之一：爆料、求证、目击、流言、警示、异象、宗门秘闻；禁止自创分类。
8. title只写标题正文，开头不得重复添加【爆料】【求证】【目击】等分类标签。

返回格式：
{"schemaVersion":1,"rumors":[{"type":"爆料","title":"标题","description":"正文","location":"地点","source":"来源用户","storyTime":"故事内时间","credibility":50,"heat":100,"comments":[{"author":"用户ID","content":"评论"}]}]}`;

function endpoint(url: string): string {
  const normalized = url.trim().replace(/\/+$/, '');
  return normalized.endsWith('/chat/completions') ? normalized : `${normalized}/chat/completions`;
}

function extractText(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (!value || typeof value !== 'object') return '';
  const record = value as Record<string, unknown>;
  const choices = Array.isArray(record.choices) ? record.choices : [];
  const first = choices[0] && typeof choices[0] === 'object' ? choices[0] as Record<string, unknown> : {};
  const message = first.message && typeof first.message === 'object' ? first.message as Record<string, unknown> : {};
  return typeof message.content === 'string' ? message.content.trim() : '';
}

function parseJson(text: string): unknown {
  const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try { return JSON.parse(stripped); } catch { throw new Error('仙网风闻返回不是合法 JSON'); }
}

export function parseTrendGeneration(text: string, expectedMin: number, expectedMax: number, sourceMessageId?: string): TrendPost[] {
  const result = AiResponseSchema.safeParse(parseJson(text));
  if (!result.success) {
    const issue = result.error.issues[0];
    const field = issue?.path.length ? issue.path.map(part => typeof part === 'number' ? `第${part + 1}项` : String(part)).join(' → ') : '根对象';
    throw new Error(`仙网风闻返回格式错误：${field}${issue?.message ? `（${issue.message}）` : ''}`);
  }
  const parsed = result.data;
  if (parsed.rumors.length < expectedMin || parsed.rumors.length > expectedMax) throw new Error(`仙网风闻返回数量必须为 ${expectedMin}～${expectedMax} 条`);
  const titles = parsed.rumors.map(item => item.title.toLocaleLowerCase());
  if (new Set(titles).size !== titles.length) throw new Error('仙网风闻同批标题不得重复');
  const now = new Date().toISOString();
  return parsed.rumors.map((item, index) => TrendPostSchema.parse({
    ...item,
    id: `trend:${Date.now()}:${index}:${Math.random().toString(36).slice(2, 8)}`,
    comments: item.comments.map((comment, commentIndex) => ({ ...comment, id: `trend-comment:${Date.now()}:${index}:${commentIndex}` })),
    generatedBy: 'ai',
    createdAt: now,
    sourceMessageId,
  }));
}

export async function generateTrends(
  settings: XianwangApiSettings,
  input: { worldTime: string; location: string; recentStory: string; worldFacts: string; lore: string; existingTitles: string[]; sourceMessageId?: string },
): Promise<TrendPost[]> {
  if (!settings.apiBaseUrl.trim() || !settings.apiModel.trim()) throw new Error('请先配置仙网内容 API 地址和模型');
  const min = Math.max(1, Math.min(8, Math.floor(settings.batchMin)));
  const max = Math.max(min, Math.min(8, Math.floor(settings.batchMax)));
  const user = `【本次任务】生成${min}～${max}条全新的仙网风闻。

【当前故事时间】${input.worldTime || '未知'}
【当前地点】${input.location || '未知'}

【最近正文，只作素材】
${input.recentStory.slice(0, 12000) || '无'}

【世界事实只读快照，只作素材】
${input.worldFacts.slice(0, 12000) || '无'}

【世界书资料，只作身份与设定校准】
${input.lore.slice(0, 16000) || '无'}

【已有标题，禁止重复】
${input.existingTitles.slice(-40).join('\n') || '无'}

返回前检查数量、字段、时间线、主题差异和观点冲突。`;
  const response = await fetch(endpoint(settings.apiBaseUrl), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(settings.apiKey ? { Authorization: `Bearer ${settings.apiKey}` } : {}) },
    body: JSON.stringify({ model: settings.apiModel.trim(), temperature: 0.85, max_tokens: 5000, messages: [
      { role: 'system', content: XIANWANG_TRENDS_SYSTEM_PROMPT },
      { role: 'user', content: user },
    ] }),
  });
  if (!response.ok) throw new Error(`仙网内容 API 请求失败：${response.status} ${(await response.text()).slice(0, 200)}`);
  const raw = extractText(await response.json());
  if (!raw) throw new Error('仙网内容 API 返回为空');
  return parseTrendGeneration(raw, min, max, input.sourceMessageId);
}

export function retainTrendPosts(posts: TrendPost[], maxGeneratedPosts: number): TrendPost[] {
  const limit = Math.max(1, Math.min(500, Math.floor(maxGeneratedPosts)));
  const manual = posts.filter(post => post.generatedBy === 'manual');
  const generated = posts.filter(post => post.generatedBy === 'ai').slice(-limit);
  return [...manual, ...generated].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}
