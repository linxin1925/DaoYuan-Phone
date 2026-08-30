import { z } from 'zod';
import { fetchAuto, extractOpenAIText } from '../services/openaiProtocol.ts';
import { xuantianSimulationReducer } from './reducer.ts';
import { XuantianSimulationStateSchema } from './schema.ts';
import type { XuantianSimulationAction, XuantianSimulationState } from './types.ts';

export interface XuantianApiSettings { apiBaseUrl:string; apiKey:string; apiModel:string; temperature:number; timeoutSeconds:number; maxWorldDays:number; }
export interface XuantianContextFloor { index:number; content:string; }
export interface XuantianWorldbookEntry { name:string; content:string; }

const regionId=z.enum(['center','east','south','north','west']);
const actionSchema=z.discriminatedUnion('type',[
  z.object({type:z.literal('advance-world-days'),days:z.number().int().min(1).max(30)}),
  z.object({type:z.literal('set-calendar-label'),label:z.string().trim().min(1).max(120)}),
  z.object({type:z.literal('set-region-state'),regionId,status:z.string().trim().min(1).max(60),pressureDelta:z.number().int().min(-15).max(15).optional(),summary:z.string().trim().min(1).max(1000)}),
  z.object({type:z.literal('set-faction-state'),factionId:z.string().trim().min(1).max(180),status:z.string().trim().min(1).max(60),relation:z.string().trim().min(1).max(60).optional(),influenceDelta:z.number().int().min(-10).max(10).optional(),activity:z.string().trim().min(1).max(1000)}),
  z.object({type:z.literal('create-event'),event:z.object({id:z.string().trim().regex(/^[a-z0-9_\-]+$/).max(120),name:z.string().trim().min(1).max(120),kind:z.string().trim().min(1).max(80),regionId:z.union([regionId,z.literal('cross')]),factionIds:z.array(z.string().trim().min(1).max(180)).max(12),summary:z.string().trim().min(1).max(1000),consequence:z.string().max(1000).default('尚未形成已确认后果')})}),
  z.object({type:z.literal('advance-event'),eventId:z.string().trim().min(1).max(120),nextPhase:z.enum(['酝酿','发展','高潮','收束']),progress:z.number().int().min(6).max(99),summary:z.string().trim().min(1).max(1000),consequence:z.string().max(1000).optional()}),
  z.object({type:z.literal('close-event'),eventId:z.string().trim().min(1).max(120),summary:z.string().trim().min(1).max(1000),consequence:z.string().trim().min(1).max(1000)}),
]);
const candidateSchema=z.object({actions:z.array(z.unknown()).min(1).max(30),rationale:z.string().trim().max(3000).default('')});

const repairTruncatedJson=(body:string):unknown=>{const start=body.indexOf('{');if(start<0)return null;const stack:string[]=[];const candidates:Array<{end:number;suffix:string}>=[];let quoted=false,escaped=false;for(let index=start;index<body.length;index+=1){const char=body[index];if(quoted){if(escaped)escaped=false;else if(char==='\\')escaped=true;else if(char==='"')quoted=false;continue;}if(char==='"')quoted=true;else if(char==='{'||char==='[')stack.push(char);else if(char==='}'||char===']')stack.pop();else if(char===','&&stack.length)candidates.push({end:index,suffix:[...stack].reverse().map(open=>open==='{'?'}':']').join('')});}for(let index=candidates.length-1;index>=0;index-=1){try{return JSON.parse(body.slice(start,candidates[index].end)+candidates[index].suffix);}catch{}}return null;};
const extractJson=(text:string):unknown=>{const body=text.replace(/^```json\s*/i,'').replace(/\s*```\s*$/,'').trim();try{return JSON.parse(body);}catch{}let depth=0,start=-1,quoted=false,escaped=false,result:unknown=null;for(let index=0;index<body.length;index+=1){const char=body[index];if(quoted){if(escaped)escaped=false;else if(char==='\\')escaped=true;else if(char==='"')quoted=false;continue;}if(char==='"')quoted=true;else if(char==='{'){if(depth===0)start=index;depth+=1;}else if(char==='}'&&depth>0){depth-=1;if(depth===0&&start>=0){try{result=JSON.parse(body.slice(start,index+1));}catch{}start=-1;}}}const repaired=result??repairTruncatedJson(body);if(repaired)return repaired;throw new Error('模型未返回可解析的JSON世界补丁');};
export const xuantianCandidateValidationMessage=(error:unknown):string=>error instanceof z.ZodError?error.issues.slice(0,5).map(issue=>`${issue.path.join('.')||'根对象'}: ${issue.message}`).join('；'):error instanceof Error?error.message:String(error);

const actionTypeAliases:Record<string,string>={
  'advance-time':'advance-world-days','advance-days':'advance-world-days','advance-day':'advance-world-days','推进世界时间':'advance-world-days','推进时间':'advance-world-days',
  'set-calendar':'set-calendar-label','update-calendar':'set-calendar-label','设置历法':'set-calendar-label',
  'update-region':'set-region-state','update-region-state':'set-region-state','region-state':'set-region-state','更新地域':'set-region-state',
  'update-faction':'set-faction-state','update-faction-state':'set-faction-state','faction-state':'set-faction-state','更新势力':'set-faction-state',
  'new-event':'create-event','add-event':'create-event','create-event-line':'create-event','创建事件':'create-event',
  'update-event':'advance-event','progress-event':'advance-event','advance-event-line':'advance-event','推进事件':'advance-event',
  'finish-event':'close-event','complete-event':'close-event','resolve-event':'close-event','关闭事件':'close-event',
};
const phaseAliases:Record<string,string>={brewing:'酝酿',incubation:'酝酿','准备':'酝酿',developing:'发展',development:'发展','推进':'发展',climax:'高潮',peak:'高潮','爆发':'高潮',closing:'收束',resolution:'收束',ending:'收束','结束':'收束'};
const toFiniteNumber=(value:unknown):unknown=>typeof value==='string'&&/^-?\d+(?:\.\d+)?$/.test(value.trim())?Number(value):value;
const stableEventId=(value:string):string=>{const ascii=value.trim().toLowerCase().replace(/[^a-z0-9_-]+/g,'-').replace(/^-+|-+$/g,'');if(ascii)return ascii.slice(0,100);let hash=2166136261;for(const char of value)hash=Math.imul(hash^char.charCodeAt(0),16777619);return `event_${(hash>>>0).toString(36)}`;};
const resolveRegionId=(value:unknown,state?:XuantianSimulationState):unknown=>{if(typeof value!=='string')return value;const key=value.trim();if(['center','east','south','north','west','cross'].includes(key))return key;return Object.values(state?.regions??{}).find(region=>region.name===key)?.id??value;};
const resolveFactionId=(value:unknown,state?:XuantianSimulationState):unknown=>{if(typeof value!=='string')return value;const key=value.trim();return state?.factions[key]?.id??Object.values(state?.factions??{}).find(faction=>faction.name===key)?.id??value;};
const normalizeActionType=(action:Record<string,unknown>):void=>{
  if(typeof action.type==='string')action.type=action.type.trim().toLowerCase().replaceAll('_','-');
  if(typeof action.type==='string'&&actionTypeAliases[action.type])action.type=actionTypeAliases[action.type];
  if(typeof action.type==='string'&&['advance-world-days','set-calendar-label','set-region-state','set-faction-state','create-event','advance-event','close-event'].includes(action.type))return;
  if(action.event&&typeof action.event==='object')action.type='create-event';
  else if(action.eventId!==undefined&&(action.nextPhase!==undefined||action.progress!==undefined))action.type='advance-event';
  else if(action.factionId!==undefined)action.type='set-faction-state';
  else if(action.regionId!==undefined&&action.status!==undefined)action.type='set-region-state';
  else if(action.days!==undefined)action.type='advance-world-days';
};

const firstText=(...values:unknown[]):string|undefined=>values.find(value=>typeof value==='string'&&value.trim()!=='')?.toString().trim();
function normalizeCandidate(value:unknown,state?:XuantianSimulationState):unknown {
  if(!value||typeof value!=='object'||Array.isArray(value))return value;
  const source=value as Record<string,unknown>;if(!Array.isArray(source.actions))return value;
  return {...source,actions:source.actions.map(raw=>{if(!raw||typeof raw!=='object'||Array.isArray(raw))return raw;const action={...(raw as Record<string,unknown>)};if(action.regionId===undefined&&typeof action.region_id==='string')action.regionId=action.region_id;if(action.factionId===undefined&&typeof action.faction_id==='string')action.factionId=action.faction_id;if(action.eventId===undefined&&typeof action.event_id==='string')action.eventId=action.event_id;if(action.nextPhase===undefined&&typeof action.next_phase==='string')action.nextPhase=action.next_phase;if(action.pressureDelta===undefined)action.pressureDelta=toFiniteNumber(action.pressure_delta);if(action.influenceDelta===undefined)action.influenceDelta=toFiniteNumber(action.influence_delta);action.days=toFiniteNumber(action.days);action.progress=toFiniteNumber(action.progress);action.regionId=resolveRegionId(action.regionId,state);action.factionId=resolveFactionId(action.factionId,state);if(typeof action.eventId==='string'){const byName=state?.events.find(event=>event.name===action.eventId);action.eventId=byName?.id??action.eventId;}if(typeof action.pressureDelta==='number')action.pressureDelta=Math.max(-15,Math.min(15,Math.trunc(action.pressureDelta)));if(typeof action.influenceDelta==='number')action.influenceDelta=Math.max(-10,Math.min(10,Math.trunc(action.influenceDelta)));if(typeof action.progress==='number')action.progress=Math.trunc(action.progress);normalizeActionType(action);if(action.type==='set-region-state'){const current=typeof action.regionId==='string'&&action.regionId in (state?.regions??{})?state?.regions[action.regionId as keyof XuantianSimulationState['regions']]:undefined;action.status=firstText(action.status,current?.status,'局势未明');action.summary=firstText(action.summary,action.description,action.detail,action.content,current?.summary,'暂无新增可确认地域变化。');}if(action.type==='set-faction-state'){const current=typeof action.factionId==='string'?state?.factions[action.factionId]:undefined;action.status=firstText(action.status,current?.status,'动向未明');action.activity=firstText(action.activity,action.summary,action.description,action.detail,action.content,current?.activity,'暂无新增可确认势力行动。');}if(typeof action.relation==='string')action.relation=action.relation.trim();if(typeof action.nextPhase==='string'){const key=action.nextPhase.trim().toLowerCase().replaceAll('_','-');action.nextPhase=phaseAliases[key]??action.nextPhase.trim();}
    if(action.type==='create-event'&&(!action.event||typeof action.event!=='object'||Array.isArray(action.event)))action.event={...action};
    if(action.event&&typeof action.event==='object'&&!Array.isArray(action.event)){const event={...(action.event as Record<string,unknown>)};if(event.regionId===undefined)event.regionId=firstText(event.region_id,event.region,event.location,event.scope,'cross');if(event.factionIds===undefined)event.factionIds=event.faction_ids??event.factions??event.participants??[];if(typeof event.factionIds==='string')event.factionIds=event.factionIds.split(/[、,，;；/]/).map(item=>item.trim()).filter(Boolean);event.regionId=resolveRegionId(event.regionId,state);if(!['center','east','south','north','west','cross'].includes(String(event.regionId)))event.regionId='cross';if(Array.isArray(event.factionIds))event.factionIds=[...new Set(event.factionIds.map(value=>resolveFactionId(value,state)).filter((value):value is string=>typeof value==='string'&&Boolean(state?.factions[value])))].slice(0,12);else event.factionIds=[];event.name=firstText(event.name,event.title,event.summary,event.description,'未命名事件');event.id=stableEventId(firstText(event.id,event.name,'未命名事件')??'未命名事件');event.kind=firstText(event.kind,event.category,event.type,'未分类事件');if(typeof event.summary!=='string'||!event.summary.trim()){const fallback=[event.description,event.desc,event.detail,event.content,event.name].find(item=>typeof item==='string'&&item.trim()) as string|undefined;event.summary=fallback?.trim()||'出现新的可确认迹象，具体影响仍待观察。';}if(typeof event.consequence!=='string')event.consequence=firstText(event.result,event.impact,'尚未形成已确认后果')??'尚未形成已确认后果';action.event=event;}
    if(typeof action.days==='number')action.days=Math.max(1,Math.min(30,Math.trunc(action.days)));
    return action;})};
}

export function applyXuantianCandidate(state:XuantianSimulationState,candidate:unknown,fingerprint:string,maxWorldDays=30):{state:XuantianSimulationState;actions:XuantianSimulationAction[];rationale:string;skipped:string[]}{
  const envelope=candidateSchema.parse(normalizeCandidate(candidate,state));const skipped:string[]=[];const valid:XuantianSimulationAction[]=[];for(const [index,raw] of envelope.actions.entries()){const parsed=actionSchema.safeParse(raw);if(parsed.success)valid.push(parsed.data as XuantianSimulationAction);else skipped.push(`actions.${index}: ${xuantianCandidateValidationMessage(parsed.error)}`);}
  const requestedDay=valid.find(action=>action.type==='advance-world-days');const days=Math.max(1,Math.min(maxWorldDays,requestedDay?.type==='advance-world-days'?requestedDay.days:1));const ordered:XuantianSimulationAction[]=[{type:'advance-world-days',days},...valid.filter(action=>action.type!=='advance-world-days')];if(valid.filter(action=>action.type==='advance-world-days').length>1)skipped.push('多余的时间推进动作已忽略');
  let next=state;const committed:XuantianSimulationAction[]=[];for(const action of ordered){try{next=xuantianSimulationReducer(next,action);committed.push(action);}catch(error){skipped.push(`${action.type}: ${xuantianCandidateValidationMessage(error)}`);}}
  if(!committed.some(action=>action.type!=='advance-world-days'))throw new Error(`模型未返回可依据剧情落账的实质变化${skipped.length?`：${skipped.slice(0,4).join('；')}`:''}`);
  next=XuantianSimulationStateSchema.parse({...next,sequence:state.sequence+1,lastCommittedFingerprint:fingerprint}) as XuantianSimulationState;return {state:next,actions:committed,rationale:envelope.rationale,skipped};
}

export function buildXuantianSimulationPrompt(settings:XuantianApiSettings,state:XuantianSimulationState,worldbook:readonly XuantianWorldbookEntry[],floors:readonly XuantianContextFloor[],correction=''):string {
  const lore=worldbook.map((entry,index)=>`#${index+1} ${entry.name}\n${entry.content}`).join('\n\n').slice(0,260000);const recent=floors.length?floors.map(floor=>`[助手层 ${floor.index}]\n${floor.content}`).join('\n\n'):'（暂无可见AI正文，本轮只允许依据原版世界书做低强度演化。）';const factionIds=Object.values(state.factions).map(f=>`${f.id}=${f.name}`).join('；');const eventIds=state.events.filter(e=>e.status==='active').map(e=>`${e.id}=${e.name}/${e.phase}/${e.progress}%`).join('；')||'无';
  return `你是玄天界后台世界推演引擎。原版主世界书是唯一设定依据；附属DLC、地球世界书和地球推演状态不得作为玄天界核心事实。玄天界是自主运转的世界，主角只是其中一个普通观察点，绝不是世界推进中心。当前账本只保存已确认事实。最近五条可见AI回复是低权限的“主角行动备忘”，只能提醒你主角做了什么、身在何处、是否直接参与某条已有事件；它不是世界演化依据，不能取代世界书，也不能阻止远方世界自主运行。必须允许多条独立事件线同时存在和分别推进。

【输出格式】
只输出一个JSON对象：{"actions":[],"rationale":""}，不要Markdown或思考过程。action.type使用 advance-world-days / set-calendar-label / set-region-state / set-faction-state / create-event / advance-event / close-event。建议包含一个1至${Math.max(1,settings.maxWorldDays)}日的时间推进；若遗漏，程序会按1日处理。

创建事件使用：{"type":"create-event","event":{"id":null,"name":"事件名","kind":"自然语言分类","regionId":"地域ID或中文地域名","factionIds":["势力ID或势力名"],"summary":"当前具体进展","consequence":"已确认后果；没有则写尚未形成"}}。新事件id可填null，由本地分配；不要把event写成字符串。更新已有事件必须使用advance-event并返回当前eventId，不能重复创建。

地域status、势力status、relation和事件kind都可以使用符合世界观的自然语言，例如“封山观望”“全面备战”“若即若离”“灵潮异变”，无需迁就固定词表。summary、activity若无必要可省略，程序会从描述或当前账本补全。单个动作格式不完整时，程序会跳过该动作，不影响其他合法动作提交。

【因果与连续性硬规则】
1. 每轮至少返回一项除时间外的实质变化；通常推进2至5项来自不同地域或势力的后台变化，但禁止为了凑数制造无关内容。
2. 后台世界变化必须追溯到“原版主世界书条目”与“当前账本”，并在rationale中用“世界书#序号”说明依据。世界书中势力的长期目标、资源需求、地域矛盾、宗门竞争和周期机制，本身就是后台自主行动的合法依据。
3. 已有事件的步骤、阻碍、代价、局部结果和善后必须沿用原事件ID推进，禁止仅因名称或描述变化另开事件。
4. 新事件只允许来自世界书既有势力目标、地域结构、资源矛盾、周期秘境或剧情中已经出现的公开苗头；禁止凭空加入势力、人物、地点、秘境或冲突。
5. 主角行动备忘默认不得创建事件、改变地域、改变势力动向或改变玩家关系。只有正文明确表明主角直接参与、介入、目击或公开影响了某条已有事件，或直接与某个已知势力发生了会被该势力知晓的互动，才允许把该正文作为对应对象的补充依据，并在rationale中同时标明“助手层 序号”。
6. 优先推进已有事件线。若当前没有活跃事件，必须依据不同世界书条目建立2至4条彼此独立的早期事件线，并同步更新直接参与势力或地域的当前动向。
7. 主角未与某势力发生被该势力知晓的直接接触时，不得改变该势力与玩家的关系；仅仅身处其地盘、谈论该势力、与私人角色相处或知道某件事，都不构成关系变化。世界变化不需要与主角产生联系，也不需要让主角立刻得知。
8. 不要复述主角当前行为作为世界摘要，不要把所有事件汇聚到主角所在地，不要安排天下势力无理由关注主角。

事件阶段仍按苗头→酝酿→发展→高潮→收束顺序推进；只有收束后才能关闭。不得创造原版没有依据的新顶尖势力、固定“五城”或DLC事实。factionId只能使用下列ID；relation表示该势力与玩家的当前关系。

【地域ID】center中央神州 / east东极青木域 / south南离火洲 / north北冥雪原 / west西漠佛国 / cross跨域
【势力ID】${factionIds}
【当前活跃事件】${eventIds}
【当前账本】${JSON.stringify(state)}

【原版主世界书内容】
${lore}

【主角行动备忘｜低权限｜最近${floors.length}条可见AI回复】
${recent}${correction?`\n\n【上次输出存在无法识别的结构】\n${correction}\n请重新输出完整JSON。`:''}`;
}

export async function generateXuantianCandidate(settings:XuantianApiSettings,state:XuantianSimulationState,worldbook:readonly XuantianWorldbookEntry[],floors:readonly XuantianContextFloor[],correction=''):Promise<unknown>{
  if(!settings.apiBaseUrl.trim()||!settings.apiModel.trim())throw new Error('请先配置玄天界推演API与模型');if(!worldbook.length)throw new Error('当前角色主世界书不可读或内容为空');const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),Math.max(5,settings.timeoutSeconds||120)*1000);try{const response=await fetchAuto(settings.apiBaseUrl,{method:'POST',signal:controller.signal,headers:{'Content-Type':'application/json',...(settings.apiKey?{Authorization:`Bearer ${settings.apiKey}`}:{})},body:JSON.stringify({model:settings.apiModel,temperature:settings.temperature,max_tokens:5000,messages:[{role:'system',content:'严格执行玄天界受限状态补丁协议，只输出JSON。'},{role:'user',content:buildXuantianSimulationPrompt(settings,state,worldbook,floors,correction)}]})});if(!response.ok)throw new Error(`玄天界推演API请求失败：${response.status}`);const text=extractOpenAIText(await response.json());if(!text)throw new Error('玄天界推演API返回为空');return extractJson(text);}finally{clearTimeout(timer);}}
