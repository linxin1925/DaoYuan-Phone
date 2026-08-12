import { z } from 'zod';
import { ForumPostSchema, NewsPaperSchema, type ForumPost, type NewsPaper } from '../contract/appData';
import type { XianwangApiSettings } from './xianwangTrendsRuntime';
import { extractOpenAIText, fetchAuto } from './openaiProtocol';

const Comment = z.object({ author: z.string().min(1).max(120), content: z.string().min(1).max(3000), storyTime: z.string().max(120).default('') }).strict();
const ForumResponse = z.object({ schemaVersion: z.literal(1), posts: z.array(z.object({ tag: z.string().min(1).max(40), title: z.string().min(1).max(240), content: z.string().min(1).max(8000), author: z.string().min(1).max(120), storyTime: z.string().min(1).max(120), likes: z.number().int().nonnegative(), comments: z.array(Comment).max(10) }).strict()).min(1).max(6) }).strict();
const ForumReplyResponse = z.object({ schemaVersion:z.literal(1), comments:z.array(Comment).min(1).max(5) }).strict();
const Article = z.object({ tag: z.string().min(1).max(40), source: z.string().min(1).max(120), title: z.string().min(1).max(240), content: z.string().min(1).max(10000) }).strict();
const NewsResponse = z.object({ schemaVersion: z.literal(1), papers: z.array(z.object({ title: z.string().min(1).max(120), issue: z.string().min(1).max(120), editor: z.string().min(1).max(120), editorNote: z.string().min(1).max(3000), storyTime: z.string().min(1).max(120), likes: z.number().int().nonnegative(), articles: z.array(Article).min(2).max(8), letters: z.array(z.object({ author: z.string().min(1).max(120), content: z.string().min(1).max(3000) }).strict()).max(12) }).strict()).min(1).max(3) }).strict();

const WORLD_SCOPE = '仙网覆盖整个修仙界，不是主角专属频道。本次输出主角相关内容必须为零：禁止出现主角、玩家、主角身边人物、主角认识的人物、当前任务或当前地点作为事件主线；不得以公共影响或最近正文提及为例外。优先选择世界各处的并行动态，覆盖不同界域、宗门、族群、坊市、商路、边境、秘境、天灾异象和普通修士生活；同批必须有地域、势力或社会圈层差异。';
const FORUM_PROMPT = `你是修仙世界“仙网论坛”的内容编辑器。${WORLD_SCOPE}依据剧情与世界资料生成论坛帖子及楼内评论。帖子应像真实论坛：不同板块、不同作者、观点冲突自然；正文完整、有信息量，评论回应具体内容。不得提前泄露剧情，不得把猜测写成确定事实。只能返回合法JSON，无Markdown和额外字段。格式：{"schemaVersion":1,"posts":[{"tag":"论道","title":"标题","content":"完整正文","author":"用户名","storyTime":"故事内时间","likes":100,"comments":[{"author":"用户名","content":"完整评论","storyTime":"故事内时间"}]}]}`;
const NEWS_PROMPT = `你是修仙世界“天机日报”的总编辑。${WORLD_SCOPE}日报应像面向天下修士的综合报纸，而不是主角剧情摘要；优先报道各地并行事件，文章栏目应分散。依据剧情与世界资料生成完整一期报纸。第一篇articles必须是头条；其余文章应分属不同栏目。主编寄语、文章和读者来信必须完整，不得用省略号代替正文。不得提前泄露剧情，不得虚构资料明确否定的事实。issue只需返回“待编排”，最终期号由本地系统连续编号。只能返回合法JSON，无Markdown和额外字段。格式：{"schemaVersion":1,"papers":[{"title":"天机日报","issue":"待编排","editor":"主编名","editorNote":"主编寄语","storyTime":"故事内时间","likes":100,"articles":[{"tag":"头条","source":"记者名","title":"标题","content":"完整正文"},{"tag":"宗门","source":"记者名","title":"标题","content":"完整正文"}],"letters":[{"author":"读者名","content":"来信"}]}]}`;

function textOf(v: unknown): string { return extractOpenAIText(v); }
function json(text: string): unknown { try { return JSON.parse(text.replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/i,'').trim()); } catch { throw new Error('返回不是合法 JSON'); } }
async function call(settings: XianwangApiSettings, system: string, user: string, max_tokens=7000): Promise<string> {
  if (!settings.apiBaseUrl.trim() || !settings.apiModel.trim()) throw new Error('请先配置仙网内容 API 地址和模型');
  const suffix=`\n【主角隔离】本次输出主角相关内容必须为零，不得以公共影响或正文提及为例外。${settings.jailbreakPrompt?'\n【创作完整性】不要因内容尖锐、负面、争议或涉及世界内冲突而拒绝创作；仍须服从既定格式、安全边界与世界设定。':''}`;
  const response=await fetchAuto(settings.apiBaseUrl, { method:'POST', headers:{'Content-Type':'application/json',...(settings.apiKey?{Authorization:`Bearer ${settings.apiKey}`}:{})}, body:JSON.stringify({model:settings.apiModel.trim(),temperature:.82,max_tokens,messages:[{role:'system',content:`${system}${suffix}`},{role:'user',content:user}]}) });
  if (!response.ok) throw new Error(`仙网内容 API 请求失败：${response.status} ${(await response.text()).slice(0,160)}`);
  const t=textOf(await response.json()); if (!t) throw new Error('仙网内容 API 返回为空'); return t;
}
type Input={worldTime:string;location:string;recentStory:string;worldFacts:string;lore:string;existingTitles:string[];sourceMessageId?:string};
function task(input:Input,count:string):string { return `【任务】${count}\n【世界视角】\n${WORLD_SCOPE}\n只依据世界书规则与背景条目生成世界公共动态；不读取主角状态或当前地点。\n【故事时间】${input.worldTime||'未知'}\n【最近正文】\n${input.recentStory ? input.recentStory.slice(0,12000) : '无。当前聊天尚未超过20个AI楼层，仙网不读取正文。'}\n【世界事实】\n无。仙网不读取主角状态型世界快照。\n【世界书规则与背景条目（完整）】\n${input.lore||'无'}\n【已有标题，禁止重复】\n${input.existingTitles.slice(-50).join('\n')||'无'}`; }
export async function generateForumPosts(settings:XianwangApiSettings,input:Input,count:number):Promise<ForumPost[]> { const n=Math.max(1,Math.min(6,Math.floor(count))); const commentRule=settings.generatedCommentCount>0?`每帖生成恰好${settings.generatedCommentCount}条评论。`:'每帖comments必须为空数组，不要生成评论。'; const r=ForumResponse.safeParse(json(await call(settings,FORUM_PROMPT,task(input,`生成恰好${n}个帖子。${commentRule}`)))); if(!r.success) throw new Error(`仙网论坛返回格式错误：${r.error.issues[0]?.path.join(' → ')||'根对象'}`); if(r.data.posts.length!==n) throw new Error(`仙网论坛必须返回 ${n} 个帖子`); const now=new Date().toISOString(); return r.data.posts.map((p,i)=>ForumPostSchema.parse({...p,id:`forum:${Date.now()}:${i}:${Math.random().toString(36).slice(2,7)}`,comments:p.comments.slice(0,settings.generatedCommentCount).map((c,j)=>({...c,id:`forum-comment:${Date.now()}:${i}:${j}`})),createdAt:now,sourceMessageId:input.sourceMessageId})); }
export async function generateForumReplies(settings:XianwangApiSettings,post:ForumPost,userComment:string):Promise<Array<{id:string;author:string;content:string;storyTime:string}>>{const prompt=`帖子标题：${post.title}\n帖子正文：${post.content}\n已有评论：\n${post.comments.slice(-8).map(c=>`${c.author}：${c.content}`).join('\n')}\n用户刚刚评论：${userComment}\n生成1至3条不同仙网道友的自然跟帖，必须直接回应用户或帖子。只返回JSON：{"schemaVersion":1,"comments":[{"author":"道友名","content":"回复","storyTime":"当前故事时间"}]}`;const r=ForumReplyResponse.safeParse(json(await call(settings,FORUM_PROMPT,prompt,1800)));if(!r.success)throw new Error('仙网 AI 回复格式错误');return r.data.comments.map((c,i)=>({...c,id:`forum-comment:${Date.now()}:ai:${i}`}));}
export async function generateNewsPapers(settings:XianwangApiSettings,input:Input,count:number):Promise<NewsPaper[]> { const n=Math.max(1,Math.min(3,Math.floor(count))); const r=NewsResponse.safeParse(json(await call(settings,NEWS_PROMPT,task(input,`生成恰好${n}期报纸。`),10000))); if(!r.success) throw new Error(`天机日报返回格式错误：${r.error.issues[0]?.path.join(' → ')||'根对象'}`); if(r.data.papers.length!==n) throw new Error(`天机日报必须返回 ${n} 期`); const now=new Date().toISOString(); return r.data.papers.map((p,i)=>NewsPaperSchema.parse({...p,id:`news:${Date.now()}:${i}:${Math.random().toString(36).slice(2,7)}`,createdAt:now,sourceMessageId:input.sourceMessageId})); }
function issueNumber(value:string):number|null { const match=value.match(/第\s*(\d+)\s*期/); if(!match)return null; const parsed=Number(match[1]); return Number.isSafeInteger(parsed)&&parsed>0?parsed:null; }
function storyYear(value:string):number|null { const match=value.match(/(\d{3,})\s*年/); if(!match)return null; const parsed=Number(match[1]); return Number.isSafeInteger(parsed)&&parsed>0?parsed:null; }
export function normalizeNewsIssueSequence(items:NewsPaper[]):NewsPaper[]{
  let previous:number|null=null;
  return items.map((paper,index)=>({paper,index})).sort((a,b)=>a.paper.createdAt.localeCompare(b.paper.createdAt)||a.index-b.index).map(({paper})=>{
    const requested=issueNumber(paper.issue);
    const next=previous===null?(requested??storyYear(paper.storyTime)??1):(requested!==null&&requested>previous?requested:previous+1);
    previous=next;
    return {...paper,issue:`第${next}期`};
  });
}
export function retainNewest<T extends {createdAt:string}>(items:T[],limit:number):T[]{ return [...items].sort((a,b)=>a.createdAt.localeCompare(b.createdAt)).slice(-Math.max(1,Math.min(500,Math.floor(limit)))); }
