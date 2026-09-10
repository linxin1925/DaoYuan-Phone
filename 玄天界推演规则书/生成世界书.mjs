import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const worldbookPath = resolve(import.meta.dirname, '道渊·玄天界世界推演规则书.json');
const seedPath = resolve(root, 'app/src/dlc/seeds/xuantianSimulationRules.json');

const rules = [
  ['玄天界推演总纲', `定位: 本书只规定玄天界如何自行演化，不替代角色卡主世界书的具体设定。\n权威: 当前角色主世界书确定事实；当前聊天推演账本确定已发生历史；本书确定运行方法。冲突时具体事实服从主世界书。\n视角: 世界以地域、势力、资源、制度与自然周期为行动主体。主角只是世界中的一个行动者，不是默认原因、目标或观察中心。\n边界: 远方事件可在主角不知情时继续；角色只能依据自身情报行动；推演不得替玩家决定行动、台词、情绪、关系或不可逆选择。`],
  ['玄天界时间与长期跳时', `时间权威: 以连续两次已确认的故事时间为准，回复轮数不等于时间。无法解析时停止自动计时，不猜测。\n结算粒度: 七日内按日或整段；八日至九十日按旬月；三个月至三年按季度或年度节点；三年至三十年按年代压缩；更久按时代格局与遗留问题结算。\n长期规则: 一次API可批量裁决关键节点，不逐日调用。事件可跨越多个阶段，但摘要必须记录关键转折、阻碍、代价和结果。人物、势力、制度与资源都应体现时间成本。`],
  ['玄天界地域运行规则', `五域不是静态背景。每个地域以核心资源、长期矛盾、稳定力量、交通限制、周期变化、外部依赖、当前压力与恢复能力运行。\n变化类型包括贸易、迁徙、建设、人才流动、技术扩散、信仰、生态、外交、治理、灾害与战争。不得把所有地域变化缩减成争矿、偷猎和宗门冲突。\n跨域行动必须支付路途、情报、补给与协调成本；势力不能无理由同时出现在所有地域。`],
  ['玄天界势力自治规则', `每个势力依据长期目标、当前需求、恐惧、资源、限制、内部派系、决策风格、情报能力和撤退条件行动。\n势力不知道的事实不能进入决策。高阶修士提供威慑和局部破局能力，但不能替代人口、后勤、制度与基层执行。\n行动必须产生资源消耗、机会成本或政治后果。压力不足时可观望、建设、谈判和恢复；并非每轮都需升级冲突。`],
  ['玄天界事件因果与生命周期', `事件字段: 稳定ID、起因、参与者目标、推动力、阻碍、资源条件、升级条件、停滞条件、失败条件、影响范围、可见范围和历史节点。\n阶段: 苗头→酝酿→发展→高潮→收束；事件也可休眠、僵持、失败或转化。没有驱动力的事件应停滞或结束，受到强阻力时可转向。\n进度不是时间百分比。5%只表示刚出现苗头；时间跨越后必须依据因果重新裁决，不得因旧百分比长期锁死。`],
  ['玄天界事件多样性规则', `事件母题至少覆盖资源与贸易、内部路线、皇朝治理、外交联盟、技术突破、人才教育、商路税赋、信仰文化、人口迁徙、生态天象、情报渗透、执法审判、节庆交流、建设繁荣。\n同一批新事件应来自不同地域、势力或社会机制。最近已经使用的名称、参与方组合与母题降低权重。\n新聊天使用聊天ID形成稳定平行世界种子：同一聊天保持连续，不同聊天不固定复刻同三条事件。`],
  ['玄天界信息与可知性规则', `上帝账本保存客观事实、秘密行动和远方结果；正文只消费角色可知投影。\n信息必须经亲历、玉简、商路、宗门网络、调查、可靠转述或公开传播到达角色。传播存在距离、延迟、失真、封锁和误判。\n后台事实不能因写入账本就自动成为天下共识，也不能直接注入主角视角。`],
  ['玄天界推演账本提交规则', `API只返回候选变化。本地脚本必须校验时间、阶段、势力ID、地域ID、能力、信息、资源和玩家边界后原子提交。\n同一事件沿用稳定ID；名称变化不是新事件。失败、重抽、删楼、回滚与重复指纹不得重复推进。\n活跃事件保持有界；结束事件压缩为后果摘要。候选中单个非法动作可被跳过，但整轮必须至少有一项合法实质变化才能提交。`],
  ['剧情导演作品技法坐标', `以下作品只作为叙事机制坐标，严禁复制角色、专有设定、标志情节、句式、对白或世界结构，也不得声称模仿作者文风。\n《凡人修仙传》：资源约束、行动成本、弱者信息差与漫长修炼；《仙逆》：因果回响、执念与时间跨度；《遮天》《牧神记》：历史纵深、时代遗迹与认知反转；《诛仙》：宗门生活、人物感情和正魔价值冲突；《剑来》《烂柯棋缘》：地域风土、自由游历、日常关系与长线回响；《一世之尊》《问镜》：多线布局、身份信息与伏笔回收；《赤心巡天》：人物选择、制度利益与立场冲突；《大道争锋》《修真门派掌门路》：宗门战略、财政资源、地缘与现实利益；《玄鉴仙族》：家族代际、生老病死和时间流逝；《灭运图录》：修行道路、道心选择和世界规律。\n每轮只选择与当前玩法相符的二至四种技法，不得把所有标签混杂堆砌。`],
  ['剧情导演玩家意图评估', `后台只能从行为推断倾向，不能读取或定义玩家内心。证据包括玩家主动前往、寻找、询问、投入时间资源、重复选择、明确拒绝、连续忽略及愿意承担的代价。一次随口询问权重低；连续主动投入权重高；明确陈述优先，但后续行为可修正。\n分别记录兴趣、回避、节奏与置信度。置信度不足时使用观察或自由生活，不急建主线。区分“当前手段”“短期目标”“长期偏好”，不得把角色为了脱困的一次行动误判成终身追求。玩家转向后应暂停旧篇章，将仍会自行发展的部分交还世界推演。`],
  ['剧情导演自由生活规则', `没有主线是合法状态。玩家闭关、炼丹、经商、游历、交友、经营洞府、教导弟子或单纯生活时，以自然反馈维持连续性，不强塞灭门、天命、追杀、强制任务和巧合救场。\n观察期只记录行为；萌芽期提供可忽略的弱钩子；玩家持续投入后才成篇。被忽略的钩子降低权重，可自然消散、由别人处理、转化为远方后果或日后遗留问题，禁止换皮反复送到玩家面前。\n低压内容也必须有变化：季节、物价、熟人近况、资源产出、技艺进展、地方制度和人物关系均可形成回响，但不要把日常硬写成阴谋。`],
  ['剧情导演长篇分支图', `剧情图由二至八个节点构成，每个节点有戏剧问题、可观察开场、利益与代价、失效条件及二至四个行为分支。分支不是菜单选项，而是下一轮根据玩家真实行为判定。至少覆盖参与、拒绝或绕开、拖延或旁观；计划外行动应局部重写未来。\n篇章应有欲望、阻碍、升级、转折、代价、局部结果和遗留影响，但不预设胜利、失败、恋爱、战斗或接受任务。已解决与跳过节点属于历史，不得改写；只能修订锁定、可用或当前节点。拒绝路线也必须产生合理世界结果，而不是惩罚玩家。\n长期篇章允许休眠、转化和关闭。玩家不参与时，相关NPC与势力仍依自身目标行动；只有信息经亲历、通信、调查或公开传播抵达，才能成为正文素材。`],
  ['剧情导演工作流程与质量门', `按顺序执行：一、判断当前是日常、游历、经营、修炼、社交、调查或冲突；二、区分一时行为与长期兴趣；三、盘点已有角色、地点、承诺、未解矛盾和重复母题；四、从客观世界账本筛选角色可能接触的变化；五、形成多个候选方向并判断是否应保持安静；六、维护分支图；七、只投放一个强度合适的可感知推动。\n提交前自检：是否有明确欲望和阻碍；是否存在时间、资源、关系、名誉、制度或认知代价；是否延续既有因果；是否尊重信息边界；是否保留拒绝和意外行动；是否重复秘境、拍卖、争矿、偷猎、宗门大比、天降传承、无端追杀；是否体现修仙时间尺度；玩家不参与时能否合理发展；结果能否留下长期影响。任一关键项失败则降级为观察或重写。`],
  ['剧情导演正文投放规则', `完整剧情图只存后台。正文模型仅接收当前节点的戏剧问题、可观察开场、代价和允许响应方向，不得看到隐藏结果与未来节点。投放应表现为环境变化、他人自主行动、传闻、来信、需求或自然机会，不得用旁白命令玩家。\n每次只推进一小步，先给予感知和回应空间。玩家拒绝后立即尊重，不用更大灾难迫使回归；玩家做别的事时先响应其真实目标，再判断旧线是否休眠。剧情导演的内容是创作建议而非已发生事实，只有正文实际写出或世界账本提交后才成为历史。`],
  ['玄天界EJS基础路由', `@@generate_before\n@@always_enabled\n<%_\nconst twXuanBook = getvar('daoyuan_xuantian.worldbook_name', { scope: 'local', defaults: '道渊·玄天界世界推演规则书' });\nconst twXuanActive = getvar('daoyuan_xuantian.current_world', { scope: 'local', defaults: '玄天界' }) === '玄天界';\nif (twXuanActive && typeof getwi === 'function') {\n  const names = ['玄天界推演总纲', '玄天界信息与可知性规则'];\n  const loaded = [];\n  for (const name of names) { const value = await getwi(twXuanBook, name); if (value) loaded.push(value); }\n  if (loaded.length) print(loaded.join('\\n'));\n}\n_%>`],
  ['玄天界EJS事件路由', `@@generate_before\n@@always_enabled\n<%_\nconst twXuanBook = getvar('daoyuan_xuantian.worldbook_name', { scope: 'local', defaults: '道渊·玄天界世界推演规则书' });\nconst twXuanState = getvar('daoyuan_xuantian_simulation_v1', { scope: 'local', defaults: null });\nconst twXuanTopics = [];\nif (twXuanState && typeof twXuanState === 'object') {\n  const events = Array.isArray(twXuanState.events) ? twXuanState.events.filter(item => item && item.status === 'active') : [];\n  const regions = twXuanState.regions && typeof twXuanState.regions === 'object' ? Object.values(twXuanState.regions) : [];\n  const factions = twXuanState.factions && typeof twXuanState.factions === 'object' ? Object.values(twXuanState.factions) : [];\n  if (events.length) twXuanTopics.push('event');\n  if (factions.some(item => item && item.updatedAtDay === twXuanState.worldDay)) twXuanTopics.push('faction');\n  if (regions.some(item => item && item.updatedAtDay === twXuanState.worldDay)) twXuanTopics.push('region');\n  if (Number(twXuanState.worldDay || 0) >= 90) twXuanTopics.push('time');\n  if (events.length > 1) twXuanTopics.push('diversity');\n}\ntwXuanTopics.splice(3);\nif (typeof getwi === 'function' && twXuanTopics.length) {\n  const map = { time:'玄天界时间与长期跳时', region:'玄天界地域运行规则', faction:'玄天界势力自治规则', event:'玄天界事件因果与生命周期', diversity:'玄天界事件多样性规则' };\n  const loaded = [];\n  for (const topic of twXuanTopics) { const name = map[topic]; if (!name) continue; const value = await getwi(twXuanBook, name); if (value) loaded.push(value); }\n  if (loaded.length) print(loaded.join('\\n'));\n}\n_%>`],
];

function entry(comment, content, uid) {
  const ejs = comment.startsWith('玄天界EJS');
  return { key:[], keysecondary:[], comment, content, constant:ejs, vectorized:false, selective:true, selectiveLogic:0, addMemo:true, order:ejs?90:200+uid, position:0, disable:ejs, excludeRecursion:true, preventRecursion:true, probability:100, useProbability:true, depth:4, group:'', groupOverride:false, groupWeight:100, scanDepth:null, caseSensitive:null, matchWholeWords:null, useGroupScoring:false, automationId:'', role:null, sticky:0, cooldown:0, delay:0, uid, displayIndex:uid, ignoreBudget:false, outletName:'', triggers:[], characterFilter:{isExclude:false,names:[],tags:[]} };
}

const entries = Object.fromEntries(rules.map(([name, content], index) => [String(index), entry(name, content, index)]));
const worldbook = { entries };
const text = `${JSON.stringify(worldbook, null, 2)}\n`;
const seed = { schemaVersion:1, id:'daoyuan_xuantian_simulation_rules', recommendedName:'道渊·玄天界世界推演规则书', displayName:'玄天界推演规则', installType:'simulation-routed', sourceSha256:createHash('sha256').update(text).digest('hex'), entries:Object.values(entries).map(sourceEntry=>({uid:String(sourceEntry.uid),name:sourceEntry.comment,sourceEntry})) };

await mkdir(dirname(worldbookPath), { recursive:true });
await mkdir(dirname(seedPath), { recursive:true });
await writeFile(worldbookPath, text, 'utf8');
await writeFile(seedPath, `${JSON.stringify(seed, null, 2)}\n`, 'utf8');
console.log(`Wrote ${worldbookPath} and ${seedPath} (${rules.length} entries)`);
