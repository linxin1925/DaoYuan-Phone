import { z } from 'zod';
import { ForumPostSchema, NewsPaperSchema, type ForumPost, type NewsPaper } from '../contract/appData';
import type { XianwangApiSettings } from './xianwangTrendsRuntime';

const Comment = z.object({ author: z.string().min(1).max(120), content: z.string().min(1).max(3000), storyTime: z.string().max(120).default('') }).strict();
const ForumResponse = z.object({ schemaVersion: z.literal(1), posts: z.array(z.object({ tag: z.string().min(1).max(40), title: z.string().min(1).max(240), content: z.string().min(1).max(8000), author: z.string().min(1).max(120), storyTime: z.string().min(1).max(120), likes: z.number().int().nonnegative(), comments: z.array(Comment).min(1).max(10) }).strict()).min(1).max(6) }).strict();
const Article = z.object({ tag: z.string().min(1).max(40), source: z.string().min(1).max(120), title: z.string().min(1).max(240), content: z.string().min(1).max(10000) }).strict();
const NewsResponse = z.object({ schemaVersion: z.literal(1), papers: z.array(z.object({ title: z.string().min(1).max(120), issue: z.string().min(1).max(120), editor: z.string().min(1).max(120), editorNote: z.string().min(1).max(3000), storyTime: z.string().min(1).max(120), likes: z.number().int().nonnegative(), articles: z.array(Article).min(2).max(8), letters: z.array(z.object({ author: z.string().min(1).max(120), content: z.string().min(1).max(3000) }).strict()).max(12) }).strict()).min(1).max(3) }).strict();

const FORUM_PROMPT = `你是修仙世界“仙网论坛”的内容编辑器。依据剧情与世界资料生成论坛帖子及楼内评论。帖子应像真实论坛：不同板块、不同作者、观点冲突自然；正文完整、有信息量，评论回应具体内容。不得提前泄露剧情，不得把猜测写成确定事实。只能返回合法JSON，无Markdown和额外字段。格式：{"schemaVersion":1,"posts":[{"tag":"论道","title":"标题","content":"完整正文","author":"用户名","storyTime":"故事内时间","likes":100,"comments":[{"author":"用户名","content":"完整评论","storyTime":"故事内时间"}]}]}`;
const NEWS_PROMPT = `你是修仙世界“天机日报”的总编辑。依据剧情与世界资料生成完整一期报纸。第一篇articles必须是头条；其余文章应分属不同栏目。主编寄语、文章和读者来信必须完整，不得用省略号代替正文。不得提前泄露剧情，不得虚构资料明确否定的事实。issue只需返回“待编排”，最终期号由本地系统连续编号。只能返回合法JSON，无Markdown和额外字段。格式：{"schemaVersion":1,"papers":[{"title":"天机日报","issue":"待编排","editor":"主编名","editorNote":"主编寄语","storyTime":"故事内时间","likes":100,"articles":[{"tag":"头条","source":"记者名","title":"标题","content":"完整正文"},{"tag":"宗门","source":"记者名","title":"标题","content":"完整正文"}],"letters":[{"author":"读者名","content":"来信"}]}]}`;

function endpoint(url: string): string { const u=url.trim().replace(/\/+$/, ''); return u.endsWith('/chat/completions') ? u : `${u}/chat/completions`; }
function textOf(v: unknown): string { const c=(v as any)?.choices?.[0]?.message?.content; return typeof c==='string' ? c.trim() : ''; }
function json(text: string): unknown { try { return JSON.parse(text.replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/i,'').trim()); } catch { throw new Error('返回不是合法 JSON'); } }
async function call(settings: XianwangApiSettings, system: string, user: string, max_tokens=7000): Promise<string> {
  if (!settings.apiBaseUrl.trim() || !settings.apiModel.trim()) throw new Error('请先配置仙网内容 API 地址和模型');
  const response=await fetch(endpoint(settings.apiBaseUrl), { method:'POST', headers:{'Content-Type':'application/json',...(settings.apiKey?{Authorization:`Bearer ${settings.apiKey}`}:{})}, body:JSON.stringify({model:settings.apiModel.trim(),temperature:.82,max_tokens,messages:[{role:'system',content:system},{role:'user',content:user}]}) });
  if (!response.ok) throw new Error(`仙网内容 API 请求失败：${response.status} ${(await response.text()).slice(0,160)}`);
  const t=textOf(await response.json()); if (!t) throw new Error('仙网内容 API 返回为空'); return t;
}
type Input={worldTime:string;location:string;recentStory:string;worldFacts:string;lore:string;existingTitles:string[];sourceMessageId?:string};
function task(input:Input,count:string):string { return `【任务】${count}\n【故事时间】${input.worldTime||'未知'}\n【地点】${input.location||'未知'}\n【最近正文】\n${input.recentStory.slice(0,12000)||'无'}\n【世界事实】\n${input.worldFacts.slice(0,10000)||'无'}\n【世界书】\n${input.lore.slice(0,14000)||'无'}\n【已有标题，禁止重复】\n${input.existingTitles.slice(-50).join('\n')||'无'}`; }
export async function generateForumPosts(settings:XianwangApiSettings,input:Input,count:number):Promise<ForumPost[]> { const n=Math.max(1,Math.min(6,Math.floor(count))); const r=ForumResponse.safeParse(json(await call(settings,FORUM_PROMPT,task(input,`生成恰好${n}个帖子。`)))); if(!r.success) throw new Error(`仙网论坛返回格式错误：${r.error.issues[0]?.path.join(' → ')||'根对象'}`); if(r.data.posts.length!==n) throw new Error(`仙网论坛必须返回 ${n} 个帖子`); const now=new Date().toISOString(); return r.data.posts.map((p,i)=>ForumPostSchema.parse({...p,id:`forum:${Date.now()}:${i}:${Math.random().toString(36).slice(2,7)}`,comments:p.comments.map((c,j)=>({...c,id:`forum-comment:${Date.now()}:${i}:${j}`})),createdAt:now,sourceMessageId:input.sourceMessageId})); }
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
