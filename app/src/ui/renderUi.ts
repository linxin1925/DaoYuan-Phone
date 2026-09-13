import { parseBridgeMessage, type BridgeAction } from '../contract/bridge';
import { emptyAppData, parseAppData, type AppData, type BeautyRankEntry, type BeautyRankReply, type TrendPost, type ForumPost, type NewsPaper } from '../contract/appData';
import { loadUiPreferences, saveUiPreferences } from '../services/storageService';
import { getConnections, MAPS, mapNodeClass, mapNodeColor, normalizeMapNode, resolveWorldMapLocation, type MapFaction, type MapRealm } from '../services/mapService';
import type { EarthSimulationState, EarthTimeRatio } from '../earthSimulation/types';
import type { XuantianSimulationState } from '../xuantianSimulation/types';
import type { StoryDirectorPlan, XuantianFaultLog } from '../storyDirector/types';
import beautyPlaqueUrl from '../assets/beauty-plaque.png?inline';
import {
  getDefaultPortraitUrl,
  getFemalePortraitUrl,
  getPortraitSets,
  getPortraitUrl,
  getSelectedSetIndex,
  getSpecialPortraitUrl,
  hasFemalePortrait,
  hasSpecialPortrait,
  isCustomPortrait,
  isFemalePreferred,
  onPortraitsUpdated,
  removeCustomPortrait,
  setCustomPortrait,
  setFemalePortrait,
  setSelectedSetIndex,
} from '../services/portraitService';

type AppKey = 'home' | 'world' | 'xuantian' | 'earth' | 'yujian' | 'beauty' | 'trends' | 'wanbao' | 'inventory' | 'map' | 'forum' | 'news' | 'settings' | 'diagnostic';
type WanbaoSection = 'market' | 'owned';
type Layout = 'phone';

interface AppItem { key: AppKey; icon: string; label: string; note: string; }
interface UiMount { destroy(): void; }
interface ContactPreview { name: string; avatar: string; portrait?: string; affection?: string; affectionLabel?: '好感度' | '亲密度'; preview: string; time: string; detail: string; unread?: number; history?: ChatMessagePreview[]; tone: 'jade' | 'gold' | 'violet' | 'blue' | 'red'; }
interface ChatMessagePreview { from: 'them' | 'me'; text: string; time: string; }
interface ForumPostPreview { tag: string; title: string; excerpt: string; author: string; likes: number; comments: number; time: string; replies: Array<{ author: string; content: string }>; }
interface NewsArticlePreview { tag: string; source: string; title: string; body: string; }
interface ReaderLetterPreview { author: string; time: string; body: string; }
interface NewsPreview { id: string; title: string; issue: string; editor: string; likes: number; intro: string; articles: NewsArticlePreview[]; letters: ReaderLetterPreview[]; }
interface BeautyRankView extends BeautyRankEntry { portrait?: string; }
interface WorldYujianContact { name: string; portrait?: string; affection?: string; affectionLabel?: '好感度' | '亲密度'; preview: string; time: string; detail: string; unread: number; history?: ChatMessagePreview[]; }
interface InventoryItem { name: string; quantity: number | null; description: string; category: string; status: string; }
interface WanbaoCurrencyPayload { mode?: string; balances?: Array<{ grade?: string; quantity?: number; source?: string }>; warning?: string; }
interface WanbaoSettingsDraft { batchSize: number; maxItems: number; refreshInterval: number; currencyMode: 'auto' | 'legacy-bag' | 'combat-separate'; itemDataMode: 'legacy' | 'combat'; }
interface WanbaoApiSettingsDraft { enabled: boolean; transactionInjectionEnabled: boolean; apiBaseUrl: string; apiKey: string; apiModel: string; }
interface WanbaoProductPayload { id: string; name: string; category: string; grade: string; description: string; priceGrade: string; price: number; stock: number; itemDataMode?: 'legacy' | 'combat'; 战斗属性?: Record<string, unknown>; }
interface WanbaoSellPayload { id: string; name: string; category: string; quantity: number; description: string; quote?: { priceGrade: string; price: number; reason: string }; }
interface WanbaoTransactionPayload { id: string; kind: 'buy' | 'sell'; itemName: string; quantity: number; description: string; amount: number; grade: string; storyTime: string; createdAt: string; }
interface WanbaoGenerationState { status: 'idle' | 'running' | 'success' | 'error'; message?: string; startedAt?: string; finishedAt?: string; count?: number; }
interface WorldStatus { time: string; location: string; energy: string; }
interface YujianSettingsDraft { customPrompt: string; apiBaseUrl: string; apiKey: string; apiModel: string; storyParseEnabled: boolean; }
interface BeautyApiSettingsDraft { apiBaseUrl: string; apiKey: string; apiModel: string; autoEnabled: boolean; autoInterval: number; }
interface EarthApiSettingsDraft { enabled: boolean; apiBaseUrl: string; apiKey: string; apiModel: string; temperature: number; timeoutSeconds: number; replyInterval: number; retryCount: number; maxWorldDays: number; timeRatio: EarthTimeRatio; }
interface XuantianApiSettingsDraft { enabled: boolean; apiBaseUrl: string; apiKey: string; apiModel: string; temperature: number; timeoutSeconds: number; replyInterval: number; retryCount: number; maxWorldDays: number; }
const EARTH_TIME_RATIO_OPTIONS: Array<{ value: EarthTimeRatio; label: string; note: string }> = [
  { value: '1:5', label: '地球 1 天＝玄天界 5 天', note: '地球较慢：玄天界累计经过 5 天，地球推进 1 天。' },
  { value: '1:2', label: '地球 1 天＝玄天界 2 天', note: '地球较慢：玄天界累计经过 2 天，地球推进 1 天。' },
  { value: '1:1', label: '地球 1 天＝玄天界 1 天', note: '两界同速：两边经过的天数完全相同。' },
  { value: '2:1', label: '地球 2 天＝玄天界 1 天', note: '地球较快：玄天界每经过 1 天，地球推进 2 天。' },
  { value: '5:1', label: '地球 5 天＝玄天界 1 天', note: '地球较快：玄天界每经过 1 天，地球推进 5 天。' },
  { value: '10:1', label: '地球 10 天＝玄天界 1 天', note: '地球很快：玄天界每经过 1 天，地球推进 10 天。' },
];
const earthTimeRatioNote = (ratio: EarthTimeRatio): string => EARTH_TIME_RATIO_OPTIONS.find(option => option.value === ratio)?.note ?? EARTH_TIME_RATIO_OPTIONS[2].note;
type ApiSettingsDraft = Pick<BeautyApiSettingsDraft, 'apiBaseUrl' | 'apiKey' | 'apiModel'>;
interface XianwangSettingsDraft extends ApiSettingsDraft { playerAlias:string; trendsAutoEnabled:boolean; autoInterval: number; batchMin: number; batchMax: number; maxPosts: number; forumAutoEnabled:boolean; forumAutoInterval:number; forumBatchSize:number; forumMaxPosts:number; newsAutoEnabled:boolean; newsAutoInterval:number; newsBatchSize:number; newsMaxPapers:number; decentralizedMode:boolean; autoAiReply:boolean; showHeat:boolean; showCommentPreview:boolean; jailbreakPrompt:boolean; generatedCommentCount:number; }
type XianwangNumberSetting = 'autoInterval'|'batchMin'|'batchMax'|'maxPosts'|'forumAutoInterval'|'forumBatchSize'|'forumMaxPosts'|'newsAutoInterval'|'newsBatchSize'|'newsMaxPapers'|'generatedCommentCount';
interface PromptInjectionSettingsDraft { yujian: boolean; trends: boolean; forum: boolean; news: boolean; }
type FeatureModuleKey = 'yujian' | 'beauty' | 'xianwang' | 'wanbao' | 'world';
type FeatureModuleFlags = Record<FeatureModuleKey, boolean>;
interface UserScriptView { id: string; name: string; enabled: boolean; dlcId: string | null; active: boolean; }
interface UserDlcStatusView { id: string; name: string; worldbookName: string; scriptId: string | null; scriptName: string | null; importedAt: string; worldbookExists: boolean; mounted: boolean; scriptStored: boolean; scriptEnabled: boolean; scriptActive: boolean; }
interface EarthWorldbookStatusView { status: 'not-installed' | 'installed-unmounted' | 'mounted' | 'missing-entries' | 'duplicate-entries' | 'conflict' | 'empty-snapshot' | 'user-modified'; mounted: boolean; entryCount: number; missingEntries: string[]; duplicateEntries: string[]; userModified: boolean; canCreate: boolean; canRepairMissing: boolean; canAttach: boolean; reason: string; }
type SettingsSection = 'home' | 'yujian' | 'beauty' | 'xianwang' | 'wanbao' | 'injection' | 'dlc' | 'earth' | 'xuantian' | 'world' | 'pet' | 'content-beautifier' | 'config-helper';
type EarthSettingsTab = 'overview' | 'regions' | 'forces' | 'events';
type XuantianSettingsTab = 'overview' | 'regions' | 'forces' | 'events';
type PetSize = 'small' | 'medium' | 'large';
type PhoneDisplayMode = 'drawer' | 'floating';
interface YujianLoreEntry { uid: string; name: string; content: string; keys: string[]; }

const mapFactionPortraits: Record<string, string[]> = {
  五色孔雀族: ['https://p.uuu.ovh/2026/08/03/a1NqLky4.png', 'https://p.uuu.ovh/2026/08/03/GbyfM394.png'],
  天机阁: ['https://p.uuu.ovh/2026/08/03/9l7MFIS4.png'],
  广寒宫: ['https://p.uuu.ovh/2026/08/03/hg7cuzZt.png', 'https://p.uuu.ovh/2026/08/03/hhd5tD8r.png'],
  桃花宗: [
    'https://p.uuu.ovh/2026/08/03/rJkIxsTF.png',
    'https://p.uuu.ovh/2026/08/03/WfghhLTr.png',
  ],
  太阳神宫: ['https://p.uuu.ovh/2026/08/03/bhVLUFGT.png', 'https://p.uuu.ovh/2026/08/03/rWGfkBqO.png'],
  蜀山剑门: ['https://p.uuu.ovh/2026/08/03/uPacwxoc.png', 'https://p.uuu.ovh/2026/08/03/YCZG5IHn.png'],
  尸魔宗: ['https://p.uuu.ovh/2026/08/03/pyzoHdUs.png', 'https://p.uuu.ovh/2026/08/03/zbUoOzSs.png'],
  南梁古国: ['https://p.uuu.ovh/2026/08/03/NXsoiOn1.png', 'https://p.uuu.ovh/2026/08/03/q1U5n3KL.png'],
  昆仑道门: ['https://p.uuu.ovh/2026/08/03/tyEXInS8.png'],
  大周仙朝: ['https://p.uuu.ovh/2026/08/03/dq2jNInL.png', 'https://p.uuu.ovh/2026/08/03/Kp0xZnFC.png'],
  大雷音寺: ['https://p.uuu.ovh/2026/08/03/bL0D9HSd.png', 'https://p.uuu.ovh/2026/08/03/Z43fxr52.png'],
  神猿族: ['https://p.uuu.ovh/2026/08/03/g5WuRsdy.png', 'https://p.uuu.ovh/2026/08/03/YumaXVFl.png'],
  九尾天狐族: ['https://p.uuu.ovh/2026/08/03/7N2vS4oz.png', 'https://p.uuu.ovh/2026/08/03/xdnmbp3Y.png'],
  蛟龙一族: ['https://p.uuu.ovh/2026/08/11/1tNmHXte.png', 'https://p.uuu.ovh/2026/08/11/X00WwctT.png'],
  血神宫: ['https://p.uuu.ovh/2026/08/11/urcMSdjE.png'],
  万魂殿: ['https://p.uuu.ovh/2026/08/11/H9vPdRuy.png', 'https://p.uuu.ovh/2026/08/11/jWSywXMY.png'],
  万法宗: ['https://p.uuu.ovh/2026/08/11/eqrI0vkj.png', 'https://p.uuu.ovh/2026/08/11/KjWtUAH0.png'],
  合欢宗: ['https://p.uuu.ovh/2026/08/11/7qt9qryz.png'],
  星道宗: ['https://p.uuu.ovh/2026/08/11/CCD46Jp7.png', 'https://p.uuu.ovh/2026/08/11/JRxh0Mdg.png'],
  湮丹宗: ['https://p.uuu.ovh/2026/08/11/akqKe4R4.png', 'https://p.uuu.ovh/2026/08/11/YkLGDt9T.png'],
  灵墟宗: ['https://p.uuu.ovh/2026/08/11/wERQsnj6.png', 'https://p.uuu.ovh/2026/08/11/OYaxY20m.png'],
  青玉宗: ['https://p.uuu.ovh/2026/08/11/5IVWVpib.png', 'https://p.uuu.ovh/2026/08/11/Qx6999De.png'],
  符韵门: ['https://p.uuu.ovh/2026/08/11/2hneHNgT.png', 'https://p.uuu.ovh/2026/08/11/j6LSFjp8.png'],
  阵天宗: ['https://p.uuu.ovh/2026/08/11/xQURXXUv.png'],
};

const apps: AppItem[] = [
  { key: 'yujian', icon: '⌁', label: '玉简传讯', note: '联系人与未读' },
  { key: 'beauty', icon: '✦', label: '绝色榜', note: '群芳谱与仙姿' },
  { key: 'trends', icon: '◌', label: '仙网风闻', note: '传闻可能失真' },
  { key: 'forum', icon: '☷', label: '仙网论坛', note: '道友讨论' },
  { key: 'news', icon: '▤', label: '天机日报', note: '头条与邸报' },
  { key: 'wanbao', icon: '♢', label: '万宝商行', note: '坊市货单与寄售' },
  { key: 'map', icon: '⌖', label: '地图', note: '界域与节点' },
  { key: 'inventory', icon: '◇', label: '储物袋', note: '世界数据只读' },
  { key: 'settings', icon: '⚙', label: '设置', note: '外壳与偏好' },
];

const wanbaoBalanceGrades = [
  { label: '极品灵石', tone: '极' },
  { label: '上品灵石', tone: '上' },
  { label: '中品灵石', tone: '中' },
  { label: '下品灵石', tone: '下' },
];

const previewContacts: ContactPreview[] = [
  { name: '紫薇', avatar: '紫', portrait: 'https://free-img.400040.xyz/4/2026/04/25/69ec20dbb6bcc.png', preview: '群芳榜上的新消息，你看到了吗？', time: '刚刚', detail: '玄天界 · 仙网传讯', unread: 2, tone: 'violet' },
  { name: '大衍', avatar: '衍', portrait: 'https://free-img.400040.xyz/4/2026/04/25/69ec2109303d4.png', preview: '天机阁的灯还亮着。', time: '巳时', detail: '天机阁 · 灵犀传音', unread: 1, tone: 'gold' },
  { name: '林欣', avatar: '欣', portrait: 'https://free-img.400040.xyz/4/2026/05/13/6a0416f8adcb1.png', preview: '北境的风雪比往年早了三日。', time: '辰时', detail: '北境 · 传讯', tone: 'blue' },
  { name: '许千寻', avatar: '寻', portrait: 'https://free-img.400040.xyz/4/2026/06/10/6a28ceb9ac6ff.png', preview: '那艘陌生舟影，确实停在青冥海。', time: '昨日', detail: '青冥海 · 传讯', tone: 'jade' },
  { name: '白薇', avatar: '薇', portrait: 'https://i.postimg.cc/Hk9YxRMJ/image-1b289e6c-1e72-45c7-9683-d404647d326a.png', preview: '你的玉简灵力今日尚余七成。', time: '昨日', detail: '天机阁 · 通知', tone: 'gold' },
  { name: '云舒窈', avatar: '云', portrait: 'https://free-img.400040.xyz/4/2026/04/25/69ec2056498fc.png', preview: '道友可曾听说落霞城的新传闻？', time: '周一', detail: '落霞城 · 传讯', tone: 'red' },
  { name: '苏清雪', avatar: '清', portrait: 'https://free-img.400040.xyz/4/2026/04/25/69ec1fc67ce4e.png', preview: '改日再与你论剑。', time: '周日', detail: '剑阁 · 传讯', tone: 'blue' },
  { name: '南宫婉', avatar: '婉', portrait: 'https://free-img.400040.xyz/4/2026/05/13/6a041db20d918.png', preview: '师兄，晚膳记得回来。', time: '周日', detail: '玄天界 · 传讯', tone: 'jade' },
];

const previewChats: Record<string, ChatMessagePreview[]> = {
  紫薇: [
    { from: 'them', text: '群芳榜上的新消息，你看到了吗？', time: '刚刚' },
    { from: 'me', text: '刚看到，似乎又有一位新道友上榜。', time: '刚刚' },
    { from: 'them', text: '我把相关的仙网风闻整理好了，稍后传给你。', time: '刚刚' },
  ],
  大衍: [
    { from: 'them', text: '天机阁的灯还亮着。', time: '巳时' },
    { from: 'me', text: '我还在看今日的天机日报，马上就回去。', time: '巳时' },
  ],
  林欣: [
    { from: 'them', text: '北境的风雪比往年早了三日。', time: '辰时' },
    { from: 'me', text: '路上小心，记得带上避寒符。', time: '辰时' },
  ],
};

interface BeautyRankPreview { name: string; portrait: string; title: string; rank: number | string; xianzi: string; qunfangpu: string; }

const previewForumPosts: ForumPostPreview[] = [
  { tag: '求助', title: '万宝楼新出的“悟道红茶”到底是不是智商税？', excerpt: '一两要五十枚中品灵石！说是能增加对火系法则的亲和力，我喝了三壶除了尿频没感觉啊。有没有炼丹师出来鉴定一下成分？', author: 'AAA建材王哥', likes: 45, comments: 3, time: '元会历3727年·初一·中午', replies: [{ author: '咖啡续命中', content: '喝了三壶才有效果？那是你灵根太杂。' }, { author: '煎饼果子来一套', content: '确实是智商税。我表哥是万法宗搞批发的。' }, { author: '卜霸气测漏工', content: '楼上的别瞎说，我喝了之后感觉神识清明了许多。' }] },
  { tag: '深度分析', title: '大周神策军最近的动作是不是太频繁了？', excerpt: '从去年月底到现在，我这一路走来，南边已经有三个小宗门被贴封条了。所谓的“庇护乱法修士”只是借口吧？我怀疑大周在找什么特定的上古遗物。', author: '卖情报的老王', likes: 892, comments: 3, time: '元会历3727年·初一·上午', replies: [{ author: '一笑红尘', content: '官方巡狩，散修避散。前天在怨骨荒原边上看到李牧的战车了。' }, { author: 'dark\\lord', content: '怕什么，大周又不敢去惹那几个顶级宗门。' }] },
  { tag: '吐槽', title: '元会历3727年的第一天，我被家里的噬金兽尿了一床', excerpt: '本来想着新年讨个好彩头，结果一睁眼发现灵石和被褥全没了。各位道友有没有驯养灵兽的好办法？在线等，挺急的。', author: '灵石保卫战', likes: 128, comments: 6, time: '元会历3727年·初一·清晨', replies: [{ author: '养兽三百年', content: '先把它从储物袋里请出来，噬金兽不是这么养的。' }, { author: '青冥海钓鱼佬', content: '建议换成不含灵气的普通棉被。' }] },
];

const previewNews: NewsPreview[] = [
  {
    id: 'news-3727-first',
    title: '《天机报》元会历3727年首刊：风云突变，诸域并起',
    issue: '第327期 · 元会历3727年·初一·清晨',
    editor: '天机老人',
    likes: 2100,
    intro: '辞旧迎新之际，中州局势并未如新春般祥和。大周仙朝的铁骑踏碎了数个宗门的晨钟，昆仑的微尘阵亦在扩张。本报主编在此提醒各路道友：岁末年初，慎行、慎言、慎食。本期将带您直击中州最前线的博弈。',
    articles: [
      { tag: '头条', source: '灵犀记者', title: '【要闻】昆仑两仪阵扩张百里，玄虚掌教苏醒密会蜀山', body: '针对大周巡狩李牧近期的激进扩张，隐世已久的昆仑道门昨日正式扩大胆御结界。据悉，一封带有太上气息的密信已飞往蜀山剑门。专家预测，正道宗门与仙朝的权力边界可能在今年迎来正面碰撞。' },
      { tag: '修真秘辛', source: '求生专家老默', title: '【攻略】神策军哨卡生存指南：别和穿黑甲的讲道理', body: '如果你在路途中遭遇神策军拦截，切记以下三点：第一，立刻收敛神识，任何窥探动作都可能被视为攻击；第二，准备好“通行步贡”，通常是三枚特定年份的朱果；第三，如果对方提到“乱法修士”，哪怕那人是你亲爹也要划清界限。' },
      { tag: '坊间趣闻', source: '八卦小能手', title: '【八卦】万法宗长老因“人傀情未了”被关禁闭，抗议声不断', body: '万法宗昨日传出惊人消息：一名执掌百艺堂的长老被发现在闭关室中试图为其“九天玄女傀儡”注册道侣身份。宗门随后以“扰乱纲常”为由对其施以禁闭，多名机关系弟子联名抗议，要求给傀儡个人权。' },
    ],
    letters: [
      { author: '隔壁小花', time: '元会历3727年·初一·上午', body: '大周太霸道了，连我们镇上的符纸店都要抽三成税，这日子没法过了。' },
      { author: 'xX_DarkSlayer_Xx', time: '元会历3727年·初一·下午', body: '万法宗那个长老是吾辈楷模啊！傀儡多听话，不吵架不吃灵石，建议推广。' },
      { author: '醉卧沙场', time: '元会历3727年·初一·傍晚', body: '玄虚老祖都醒了？看来大难将至，我得赶紧去国点辟谷丹和疗伤药了。' },
    ],
  },
];

function element<K extends keyof HTMLElementTagNameMap>(doc: Document, tag: K, className?: string, content?: string): HTMLElementTagNameMap[K] {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  if (content !== undefined) node.textContent = content;
  return node;
}

function button(doc: Document, className: string, label: string, action: string, key?: string): HTMLButtonElement {
  const node = element(doc, 'button', className, label);
  node.type = 'button';
  node.dataset.action = action;
  if (key) node.dataset.key = key;
  return node;
}

async function copyTextWithFallback(doc:Document,text:string):Promise<boolean>{
  const clipboards=[doc.defaultView?.navigator?.clipboard,(()=>{try{return doc.defaultView?.parent?.navigator?.clipboard;}catch{return undefined;}})()];
  for(const clipboard of clipboards){try{if(clipboard?.writeText){await clipboard.writeText(text);return true;}}catch{}}
  const documents=[doc,(()=>{try{return doc.defaultView?.parent?.document;}catch{return undefined;}})()].filter((item):item is Document=>Boolean(item));
  for(const targetDoc of documents){const area=targetDoc.createElement('textarea');try{area.value=text;area.readOnly=true;area.style.cssText='position:fixed;left:-9999px;top:0;opacity:0';targetDoc.body.append(area);area.focus();area.select();area.setSelectionRange(0,text.length);if(targetDoc.execCommand?.('copy'))return true;}catch{}finally{area.remove();}}
  return false;
}

function appendListItem(doc: Document, list: HTMLElement, title: string, meta: string, value: string): void {
  const item = element(doc, 'li', 'list-item');
  const main = element(doc, 'div', 'list-main');
  main.append(element(doc, 'div', 'list-title', title), element(doc, 'div', 'list-meta', meta));
  item.append(main, element(doc, 'span', 'list-value', value));
  list.append(item);
}

function appendPageHeading(doc: Document, parent: HTMLElement, title: string, description: string, tag: string, rumor = false): void {
  const heading = element(doc, 'div', 'page-heading');
  const copy = element(doc, 'div');
  copy.append(element(doc, 'h1', undefined, title), element(doc, 'p', undefined, description));
  heading.append(copy, element(doc, 'span', `source-tag${rumor ? ' rumor' : ''}`, tag));
  parent.append(heading);
}

function upgradeNativeSelects(doc: Document, root: HTMLElement): void {
  root.querySelectorAll<HTMLSelectElement>('select').forEach((select) => {
    if (select.dataset.inlineSelectReady === 'true') return;
    select.dataset.inlineSelectReady = 'true'; select.hidden = true; select.tabIndex = -1;
    const wrapper = element(doc, 'div', 'inline-select');
    const trigger = element(doc, 'button', 'inline-select-trigger'); trigger.type = 'button'; trigger.setAttribute('aria-haspopup', 'listbox'); trigger.setAttribute('aria-expanded', 'false');
    const menu = element(doc, 'div', 'inline-select-menu'); menu.hidden = true; menu.setAttribute('role', 'listbox');
    const sync = (): void => {
      trigger.textContent = select.selectedOptions[0]?.textContent ?? '请选择';
      menu.querySelectorAll<HTMLElement>('[data-inline-select-value]').forEach((item) => { const active = item.dataset.inlineSelectValue === select.value; item.classList.toggle('selected', active); item.setAttribute('aria-selected', String(active)); });
    };
    for (const option of Array.from(select.options)) {
      const item = element(doc, 'button', 'inline-select-option', option.textContent ?? option.value); item.type = 'button'; item.dataset.inlineSelectValue = option.value; item.setAttribute('role', 'option'); item.disabled = option.disabled;
      item.addEventListener('click', (event) => { event.stopPropagation(); select.value = option.value; sync(); menu.hidden = true; trigger.setAttribute('aria-expanded', 'false'); select.dispatchEvent(new Event('change', { bubbles: true })); }); menu.append(item);
    }
    trigger.addEventListener('click', (event) => { event.stopPropagation(); menu.hidden = !menu.hidden; trigger.setAttribute('aria-expanded', String(!menu.hidden)); });
    select.before(wrapper); wrapper.append(trigger, menu, select); sync();
  });
}

function appendPanel(doc: Document, parent: HTMLElement, title: string, copy: string): HTMLElement {
  const panel = element(doc, 'section', 'panel-card');
  panel.append(element(doc, 'h3', undefined, title), element(doc, 'p', undefined, copy));
  parent.append(panel);
  return panel;
}

function formatContactListTime(value: string): string {
  const full = value.trim();
  if (!full) return '';
  const withoutNotes = full.replace(/[（(][^）)]*[）)]/g, '').trim();
  const [datePart = '', clockPart = ''] = withoutNotes.split(/[☆★]/, 2);
  const lunarDay = datePart.match(/(?:正|冬|腊|[一二三四五六七八九十]+)月(?:初|十|廿|卅)?[一二三四五六七八九十]+/)?.[0] ?? '';
  const startClock = clockPart.split(/[-—–至]/, 1)[0]?.trim() ?? '';
  const compact = [lunarDay, startClock].filter(Boolean).join(' · ');
  if (compact) return compact;
  return withoutNotes.length > 14 ? `${withoutNotes.slice(0, 13)}…` : withoutNotes;
}

function appendContact(doc: Document, list: HTMLElement, contact: ContactPreview): void {
  const row = button(doc, 'contact-row', '', 'chat-open', contact.name);
  row.dataset.contactName = contact.name;
  row.dataset.contactSearchText = `${contact.name} ${contact.detail}`.toLocaleLowerCase();
  const avatar = element(doc, 'span', 'contact-avatar');
  avatar.dataset.tone = contact.tone;
  avatar.append(element(doc, 'span', 'contact-avatar-fallback', contact.avatar));
  if (contact.portrait) {
    const portrait = doc.createElement('img');
    portrait.src = contact.portrait;
    portrait.alt = `${contact.name}立绘`;
    portrait.loading = 'lazy';
    portrait.referrerPolicy = 'no-referrer';
    portrait.addEventListener('error', () => { portrait.hidden = true; });
    avatar.append(portrait);
  }
  const copy = element(doc, 'span', 'contact-copy');
  const name = element(doc, 'span', 'contact-name', contact.name);
  if (contact.affection !== undefined) name.append(element(doc, 'span', 'contact-affection', `♡ ${contact.affectionLabel ?? '好感度'} ${contact.affection}`));
  const preview = element(doc, 'span', 'contact-preview', contact.preview);
  const detail = element(doc, 'span', 'contact-detail', contact.detail);
  copy.append(name, preview, detail);
  const meta = element(doc, 'span', 'contact-meta');
  const time = element(doc, 'span', 'contact-time', formatContactListTime(contact.time));
  time.title = contact.time;
  time.setAttribute('aria-label', `剧情时间：${contact.time || '未知时间'}`);
  meta.append(time);
  if (contact.unread) meta.append(element(doc, 'span', 'contact-unread', String(contact.unread)));
  row.append(avatar, copy, meta);
  list.append(row);
}

function appendChatMessage(doc: Document, list: HTMLElement, message: ChatMessagePreview, index: number, contactName: string): void {
  const row = element(doc, 'div', `chat-message${message.from === 'me' ? ' is-me' : ''}`);
  const meta = element(doc, 'div', 'chat-message-meta');
  meta.append(element(doc, 'span', 'chat-message-time', message.time));
  const remove = button(doc, 'chat-message-delete', '删除', 'chat-message-delete');
  remove.setAttribute('aria-label', `删除与${contactName}的这条消息`);
  remove.dataset.index = String(index);
  remove.dataset.from = message.from;
  remove.dataset.text = message.text;
  remove.dataset.time = message.time;
  meta.append(remove);
  row.append(element(doc, 'div', 'chat-bubble', message.text), meta);
  list.append(row);
}

function appendBeautyRank(doc: Document, list: HTMLElement, rank: BeautyRankPreview, replies: BeautyRankReply[], expanded: boolean): void {
  const item = element(doc, 'article', 'beauty-rank-item');
  const thumb = button(doc, 'beauty-rank-thumb', '', 'beauty-portrait-open', rank.name);
  thumb.title = `查看${rank.name}立绘`;
  const portraitUrl = getPortraitUrl(rank.name, '女') || rank.portrait || '';
  if (portraitUrl) {
    const image = doc.createElement('img');
    image.src = portraitUrl;
    image.alt = `${rank.name}立绘`;
    image.loading = 'lazy';
    image.referrerPolicy = 'no-referrer';
    image.addEventListener('error', () => { image.hidden = true; thumb.classList.add('is-empty'); });
    thumb.append(image);
  } else thumb.classList.add('is-empty');
  thumb.append(element(doc, 'span', 'beauty-rank-thumb-fallback', rank.name.slice(0, 1)));

  const main = element(doc, 'div', 'beauty-rank-main');
  const head = element(doc, 'div', 'beauty-rank-head');
  head.append(element(doc, 'span', 'beauty-rank-name', rank.name), element(doc, 'span', 'beauty-rank-title', rank.title), element(doc, 'span', 'beauty-rank-no', `第${rank.rank}名`));
  const xianzi = element(doc, 'div', 'beauty-rank-field');
  xianzi.append(element(doc, 'span', 'beauty-rank-field-label', '仙姿：'), element(doc, 'span', 'beauty-rank-field-text', rank.xianzi));
  const qunfangpu = element(doc, 'p', 'beauty-rank-note');
  qunfangpu.append(element(doc, 'span', 'beauty-rank-note-label', '群芳谱：'), element(doc, 'span', 'beauty-rank-note-text', rank.qunfangpu));
  const footer = element(doc, 'div', 'beauty-rank-footer');
  const forumButton = button(doc, 'beauty-rank-forum', `⌁ 回帖${replies.length ? ` ${replies.length}` : ''}`, 'beauty-rank-forum-toggle', rank.name);
  forumButton.setAttribute('aria-expanded', String(expanded));
  footer.append(forumButton);
  if (expanded) {
    const forum = element(doc, 'div', 'beauty-forum');
    replies.forEach(reply => {
      const row = element(doc, 'div', 'beauty-forum-reply');
      row.append(element(doc, 'span', 'beauty-forum-meta', `匿名道友 · ${reply.floor}楼 · ${reply.time}`), element(doc, 'span', 'beauty-forum-text', reply.content));
      forum.append(row);
    });
    if (!replies.length) forum.append(element(doc, 'div', 'beauty-forum-empty', '暂无回帖，发表首评。'));
    const composer = element(doc, 'div', 'beauty-forum-composer');
    const input = doc.createElement('textarea'); input.rows = 2; input.placeholder = '输入回帖内容…'; input.dataset.beautyReplyInput = rank.name;
    const send = button(doc, 'secondary-button', '发布回帖', 'beauty-rank-reply-send', rank.name);
    composer.append(input, send); forum.append(composer); footer.append(forum);
  }
  main.append(head, xianzi);
  item.append(thumb, main, qunfangpu, footer);
  list.append(item);
}

function appendForumPost(
  doc: Document,
  list: HTMLElement,
  post: ForumPostPreview,
  options: { key: string; expanded: boolean; deleteId?: string; fullContent?: boolean; showHeat?:boolean; liked?:boolean; likeAction?:'trend-like'|'forum-like' },
): HTMLElement {
  const card = element(doc, 'article', 'forum-post-card');
  const title = element(doc, 'h2', 'forum-post-title');
  title.append(element(doc, 'span', 'forum-post-tag', `[${post.tag}]`), document.createTextNode(` ${post.title}`));
  card.append(title, element(doc, `p`, `forum-post-excerpt${options.fullContent ? ' is-full-content' : ''}`, post.excerpt));

  const meta = element(doc, 'div', 'forum-post-meta');
  meta.append(element(doc, 'span', 'forum-post-author', post.author));
  const stats = element(doc, 'span', 'forum-post-stats');
  if(options.showHeat!==false){const like=button(doc,`forum-like${options.liked?' is-liked':''}`,`♥ ${post.likes}`,options.likeAction??'forum-like',options.key);like.setAttribute('aria-pressed',String(options.liked===true));stats.append(like);}
  stats.append(element(doc, 'span', 'forum-comment-count', `● ${post.comments}`), element(doc, 'span', 'forum-post-time', post.time));
  meta.append(stats);
  card.append(meta);

  const replies = element(doc, 'div', 'forum-replies');
  for (const reply of post.replies) {
    const row = element(doc, 'div', 'forum-reply-preview');
    const body = element(doc, 'span', 'forum-reply-body');
    body.append(element(doc, 'span', 'forum-reply-author', `${reply.author}：`), document.createTextNode(reply.content));
    row.append(element(doc, 'span', 'forum-reply-dot', '●'), body);
    replies.append(row);
  }
  const footer = element(doc, 'div', 'forum-post-footer');
  if (post.comments > 0) {
    const toggle = button(doc, 'forum-expand-button', options.expanded ? '收起评论' : `展开评论 ${post.comments}`, 'forum-comments-toggle', options.key);
    toggle.setAttribute('aria-expanded', String(options.expanded));
    footer.append(toggle);
  }
  if (options.deleteId) {
    const remove = button(doc, 'trend-delete-button', '删除风闻', 'trend-delete', options.deleteId);
    remove.setAttribute('aria-label', `删除风闻：${post.title}`);
    footer.append(remove);
  }
  // Match the reference forum's conditional rendering: when collapsed, the
  // comment subtree is absent rather than merely hidden by a CSS-sensitive flag.
  if (options.expanded) card.append(replies);
  if (footer.childElementCount) card.append(footer);
  list.append(card);
  return card;
}

function appendNewsArticle(doc: Document, list: HTMLElement, article: NewsArticlePreview): void {
  const card = element(doc, 'article', 'news-article-card');
  const head = element(doc, 'div', 'news-article-head');
  head.append(element(doc, 'span', 'news-article-tag', article.tag), element(doc, 'span', 'news-article-source', article.source));
  card.append(head, element(doc, 'h2', 'news-article-title', article.title), element(doc, 'p', 'news-article-body', article.body));
  list.append(card);
}

function appendReaderLetter(doc: Document, list: HTMLElement, letter: ReaderLetterPreview): void {
  const card = element(doc, 'article', 'reader-letter-card');
  const head = element(doc, 'div', 'reader-letter-head');
  head.append(element(doc, 'strong', 'reader-letter-author', letter.author), element(doc, 'span', 'reader-letter-time', letter.time));
  card.append(head, element(doc, 'p', 'reader-letter-body', letter.body));
  list.append(card);
}

export function mountUi(doc: Document, sendToHost: (action: BridgeAction, payload?: Record<string, unknown>) => void): UiMount {
  const view = doc.defaultView;
  if (!view) return { destroy() {} };
  const uiView = view;
  const sendAction = (action: BridgeAction, payload: Record<string, unknown> = {}): void => {
    // The visible iframe is mounted by the same FeatureShell instance, so keep
    // every action on its injected callback.  The postMessage compatibility
    // handler intentionally exposes only shell lifecycle actions; routing
    // feature actions through it silently dropped SEND_YUJIAN_MESSAGE,
    // REQUEST_YUJIAN_LORE and SAVE_YUJIAN_SETTINGS.
    sendToHost(action, payload);
  };
  const root = element(doc, 'div', 'app-root');
  root.id = 'daoyuan-ui-root';
  doc.body.replaceChildren(root);
  const prefs = loadUiPreferences();
  const featureModuleForApp: Partial<Record<AppKey, FeatureModuleKey>> = {
    world: 'world', xuantian: 'world', earth: 'world', yujian: 'yujian', beauty: 'beauty',
    trends: 'xianwang', forum: 'xianwang', news: 'xianwang', wanbao: 'wanbao',
  };
  let active: AppKey = apps.some(item => item.key === prefs.lastApp) ? prefs.lastApp as AppKey : 'home';
  let wanbaoSection: WanbaoSection = 'market';
  let wanbaoSettings: WanbaoSettingsDraft = { batchSize: 10, maxItems: 30, refreshInterval: 3, currencyMode: 'auto', itemDataMode: 'legacy' };
  let wanbaoApiSettings: WanbaoApiSettingsDraft = { enabled: false, transactionInjectionEnabled: false, apiBaseUrl: '', apiKey: '', apiModel: '' };
  let merchantTransactions: WanbaoTransactionPayload[] = [];
  let merchantCounter = 0;
  let merchantGenerationState: WanbaoGenerationState = { status: 'idle' };
  let protagonistRealm = '';
  let layout: Layout = 'phone';
  let data: AppData = emptyAppData;
  let spiritStones: WanbaoCurrencyPayload = { mode: 'auto', balances: [] };
  let merchantProducts: WanbaoProductPayload[] = [];
  let merchantSellItems: WanbaoSellPayload[] = [];
  let beautyRanks: BeautyRankView[] = [];
  let beautyReplies: BeautyRankReply[] = [];
  let trendPosts: TrendPost[] = [];
  let forumPosts: ForumPost[] = [];
  let newsPapers: NewsPaper[] = [];
  let xianwangCounters = { trends: 0, forum: 0, news: 0 };
  let beautyReplyInputs: Record<string, string> = {};
  let expandedBeautyForum: string | null = null;
  let beautyReplySending = false;
  let currentChatId = '__default__';
  let readBaselines: Partial<Record<AppKey, number>> = {};
  let worldContacts: ContactPreview[] = [];
  let inventoryItems: InventoryItem[] = [];
  let worldStatus: WorldStatus = { time: '未接入', location: '未接入', energy: '未知' };
  let capabilityAvailable = false;
  let announcement = '';
  let pendingSend = false;
  let selectedNewsId: string | null = null;
  let selectedForumId: string | null = null;
  let selectedContactName: string | null = null;
  let clearChatArmedFor: string | null = null;
  let activeMapFaction: MapFaction | null = null;
  let activeMapFactionPortrait = 0;
  let zoomMapFactionPortrait = false;
  let closeParentMapFactionPortrait: (() => void) | null = null;
  let showMapImage = false;
  let zoomMapImage = false;
  let mapImageFailed = false;
  let yujianSettings: YujianSettingsDraft = { customPrompt: '', apiBaseUrl: '', apiKey: '', apiModel: '', storyParseEnabled: false };
  let beautyApiSettings: BeautyApiSettingsDraft = { apiBaseUrl: '', apiKey: '', apiModel: '', autoEnabled: false, autoInterval: 1 };
  let beautyCounter = 0;
  let xianwangApiSettings: XianwangSettingsDraft = { apiBaseUrl: '', apiKey: '', apiModel: '', playerAlias:'我', trendsAutoEnabled:false, autoInterval: 3, batchMin: 2, batchMax: 3, maxPosts: 30, forumAutoEnabled:false, forumAutoInterval:3, forumBatchSize:2, forumMaxPosts:30, newsAutoEnabled:false, newsAutoInterval:5, newsBatchSize:1, newsMaxPapers:12, decentralizedMode:false, autoAiReply:false, showHeat:false, showCommentPreview:false, jailbreakPrompt:false, generatedCommentCount:3 };
  let promptInjectionSettings: PromptInjectionSettingsDraft = { yujian: false, trends: false, forum: false, news: false };
  let loreEntries: YujianLoreEntry[] = [];
  let loreSelected: Array<{ uid: string; content: string }> = [];
  let loreFilter = '';
  let loreRequested = false;
  let modelOptions: string[] = [];
  let fetchingModels = false;
  let importingStatusHistory = false;
  let beautyModelOptions: string[] = [];
  let fetchingBeautyModels = false;
  let xianwangModelOptions: string[] = [];
  let wanbaoModelOptions: string[] = [];
  let fetchingXianwangModels = false;
  let fetchingWanbaoModels = false;
  let earthApiSettings: EarthApiSettingsDraft = { enabled: false, apiBaseUrl: '', apiKey: '', apiModel: '', temperature: 0.3, timeoutSeconds: 120, replyInterval: 5, retryCount: 1, maxWorldDays: 30, timeRatio: '1:1' };
  let xuantianApiSettings: XuantianApiSettingsDraft = { enabled: false, apiBaseUrl: '', apiKey: '', apiModel: '', temperature: 0.3, timeoutSeconds: 120, replyInterval: 5, retryCount: 1, maxWorldDays: 30 };
  let worldSimulationFeatures = { earthEnabled: false, xuantianEnabled: false };
  let featureModuleFlags: FeatureModuleFlags = { yujian:false, beauty:false, xianwang:false, wanbao:false, world:false };
  const expandedXuantianForceRegions = new Set<string>(['中央神州']);
  let earthModelOptions: string[] = [];
  let fetchingEarthModels = false;
  let xuantianModelOptions: string[] = [];
  let fetchingXuantianModels = false;
  let earthSimulationRunning = false;
  let xuantianSimulationState: XuantianSimulationState | null = null;
  let storyDirectorPlan: StoryDirectorPlan | null = null;
  let xuantianFaultLogs: XuantianFaultLog[] = [];
  let xuantianSimulationRunning = false;
  let contentBeautifierEnabled = false;
  let contentAssistSettings = { bodyPromptEnabled: false, ticketPromptEnabled: false, ticketRendererEnabled: false };
  let configHelperEnabled = true;
  let petSize: PetSize = 'large';
  let phoneDisplayMode: PhoneDisplayMode = 'drawer';
  let settingsSection: SettingsSection = 'home';
  let earthSettingsTab: EarthSettingsTab = 'overview';
  let xuantianSettingsTab: XuantianSettingsTab = 'overview';
  let selectedXuantianRegion = 'center';
  let expandedEarthRegion: string | null = null;
  let expandedEarthEvent: string | null = null;
  let expandedEarthFaction: string | null = null;
  let earthFactionGroupsInitialized = false;
  const expandedEarthFactionCategories = new Set<string>();
  let earthSimulationState: EarthSimulationState | null = null;
  let userDlcName = '';
  let selectedUserDlcId: string | null = null;
  let userDlcWorldbookDraft: { fileName: string; value: Record<string, unknown>; name: string; count: number } | null = null;
  let userDlcScriptDraft: { fileName: string; value: Record<string, unknown>; name: string } | null = null;
  let contentPackageMode: 'safe-merge' | 'replace-matching' = 'replace-matching';
  let userScripts: UserScriptView[] = [];
  let userDlcs: UserDlcStatusView[] = [];
  let earthWorldbookStatus: EarthWorldbookStatusView | null = null;
  let earthWorldbookMountedEntryCount = 0;
  let earthWorldbookRequested = false;
  let beautyApiSettingsOpen = false;
  let beautyGenerating = false;
  let trendsGenerating = false;
  let forumGenerating = false;
  let newsGenerating = false;
  const collapsedForumComments = new Set<string>();
  let beautyPortraitName: string | null = null;
  let beautyPortraitShowSpecial = false;

  try {
    const storage = uiView.parent !== uiView ? uiView.parent.localStorage : uiView.localStorage;
    const saved = JSON.parse(storage.getItem('daoyuan_wanbao_settings_v1') || '{}') as Partial<WanbaoSettingsDraft>;
    wanbaoSettings.batchSize = saved.itemDataMode === 'combat' ? 4 : 10;
    if (Number.isFinite(saved.maxItems)) wanbaoSettings.maxItems = Math.max(1, Math.min(60, Math.floor(saved.maxItems as number)));
    if (Number.isFinite(saved.refreshInterval)) wanbaoSettings.refreshInterval = Math.max(0, Math.min(99, Math.floor(saved.refreshInterval as number)));
    if (saved.currencyMode === 'auto' || saved.currencyMode === 'legacy-bag' || saved.currencyMode === 'combat-separate') wanbaoSettings.currencyMode = saved.currencyMode;
    if (saved.itemDataMode === 'combat' || saved.itemDataMode === 'legacy') wanbaoSettings.itemDataMode = saved.itemDataMode;
  } catch { /* optional local preference */ }

  try {
    const storage = uiView.parent !== uiView ? uiView.parent.localStorage : uiView.localStorage;
    const saved = JSON.parse(storage.getItem('daoyuan_world_simulation_features_v1') || '{}') as Partial<typeof worldSimulationFeatures>;
    if (typeof saved.earthEnabled === 'boolean') worldSimulationFeatures.earthEnabled = saved.earthEnabled;
    if (typeof saved.xuantianEnabled === 'boolean') worldSimulationFeatures.xuantianEnabled = saved.xuantianEnabled;
  } catch { /* optional local preference */ }

  try {
    const storage = uiView.parent !== uiView ? uiView.parent.localStorage : uiView.localStorage;
    const saved = JSON.parse(storage.getItem('daoyuan_xuantian_api_settings_v1') || '{}') as Partial<XuantianApiSettingsDraft>;
    xuantianApiSettings = { ...xuantianApiSettings, ...saved };
  } catch { /* optional local preference */ }

  const configureApiUrlInput = (input: HTMLInputElement): void => {
    input.inputMode = 'url';
    input.enterKeyHint = 'next';
    input.autocapitalize = 'none';
    input.spellcheck = false;
    input.addEventListener('pointerup', () => {
      const virtualKeyboard = (view.navigator as Navigator & { virtualKeyboard?: { show(): void } }).virtualKeyboard;
      if (!virtualKeyboard) return;
      try {
        input.focus({ preventScroll: true });
        virtualKeyboard.show();
      } catch {
        // 不支持主动唤起时保留浏览器原生输入行为。
      }
    });
  };

  const openMapFactionPortraitLarge = (url: string, name: string): boolean => {
    if (!url) return false;
    let parentView: Window;
    let parentDoc: Document;
    try {
      parentView = view.parent;
      parentDoc = parentView.document;
      if (parentView === view || !parentDoc.body) return false;
    } catch {
      return false;
    }

    closeParentMapFactionPortrait?.();
    parentDoc.getElementById('__daoyuan_map_faction_portrait__')?.remove();
    const overlay = parentDoc.createElement('div');
    overlay.id = '__daoyuan_map_faction_portrait__';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', `${name}宗门立绘大图`);
    overlay.tabIndex = -1;
    overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;overflow:hidden;background:rgba(0,0,0,.94);cursor:grab;user-select:none';

    const image = parentDoc.createElement('img');
    image.src = url;
    image.alt = `${name}宗门立绘大图`;
    image.style.cssText = 'display:block;max-width:92vw;max-height:90vh;object-fit:contain;transform-origin:center center;pointer-events:none;border:1px solid rgba(216,193,136,.45);border-radius:5px;box-shadow:0 12px 48px #000';
    const hint = parentDoc.createElement('div');
    hint.textContent = '滚轮缩放 · 拖动移动 · 点击空白或 ESC 关闭';
    hint.style.cssText = 'position:fixed;bottom:16px;left:50%;z-index:1;transform:translateX(-50%);padding:6px 14px;border-radius:4px;background:rgba(0,0,0,.72);color:rgba(255,255,255,.78);font:13px system-ui,sans-serif;pointer-events:none;white-space:nowrap';
    const closeButton = parentDoc.createElement('button');
    closeButton.type = 'button';
    closeButton.textContent = '×';
    closeButton.setAttribute('aria-label', '关闭宗门立绘大图');
    closeButton.style.cssText = 'position:fixed;top:18px;right:18px;z-index:2;width:46px;height:46px;border:1px solid rgba(216,193,136,.7);border-radius:50%;background:#0b0e13;color:#eee;font:28px/1 system-ui;cursor:pointer';
    overlay.append(image, hint, closeButton);
    parentDoc.body.append(overlay);

    let scale = 1;
    let x = 0;
    let y = 0;
    let dragging = false;
    let moved = false;
    let lastX = 0;
    let lastY = 0;
    const applyTransform = () => { image.style.transform = `translate(${x}px, ${y}px) scale(${scale})`; };
    const onWheel = (event: WheelEvent) => { event.preventDefault(); scale = Math.min(8, Math.max(.2, scale * (event.deltaY > 0 ? .9 : 1.1))); applyTransform(); };
    const onDown = (event: MouseEvent) => { if (event.target === closeButton) return; dragging = true; moved = false; lastX = event.clientX; lastY = event.clientY; overlay.style.cursor = 'grabbing'; };
    const onMove = (event: MouseEvent) => { if (!dragging) return; const dx = event.clientX - lastX; const dy = event.clientY - lastY; if (Math.abs(dx) + Math.abs(dy) > 2) moved = true; x += dx; y += dy; lastX = event.clientX; lastY = event.clientY; applyTransform(); };
    const onUp = () => { dragging = false; overlay.style.cursor = 'grab'; };
    const close = () => {
      overlay.removeEventListener('wheel', onWheel);
      overlay.removeEventListener('mousedown', onDown);
      overlay.removeEventListener('click', onOverlayClick);
      closeButton.removeEventListener('click', close);
      parentView.removeEventListener('mousemove', onMove);
      parentView.removeEventListener('mouseup', onUp);
      parentView.removeEventListener('keydown', onKey);
      overlay.remove();
      if (closeParentMapFactionPortrait === close) closeParentMapFactionPortrait = null;
    };
    const onOverlayClick = (event: MouseEvent) => { if (event.target === overlay && !moved) close(); moved = false; };
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); };
    overlay.addEventListener('wheel', onWheel, { passive: false });
    overlay.addEventListener('mousedown', onDown);
    overlay.addEventListener('click', onOverlayClick);
    closeButton.addEventListener('click', close);
    parentView.addEventListener('mousemove', onMove);
    parentView.addEventListener('mouseup', onUp);
    parentView.addEventListener('keydown', onKey);
    closeParentMapFactionPortrait = close;
    overlay.focus();
    return true;
  };
  let allContactsExpanded = false;
  let contactFilter = '';

  function beautyReplyStorageKey(): string { return `daoyuan_beauty_replies:${currentChatId}`; }
  function readStateStorageKey(): string { return `daoyuan_app_read_state:${currentChatId}`; }
  function currentAppCount(key: AppKey): number {
    if (key === 'yujian') return data.yujian.unread;
    if (key === 'beauty') return beautyRanks.length || data.webBeauty.entries;
    if (key === 'trends') return trendPosts.length || data.webTrends.entries;
    if (key === 'forum') return forumPosts.length || data.forum.posts;
    if (key === 'news') return newsPapers.length || data.news.headlines;
    return 0;
  }
  function unreadBadge(key: AppKey): number {
    const count=currentAppCount(key); return Math.max(0,count-(readBaselines[key]??0));
  }
  function loadReadState(): void { try { const storage=uiView.parent!==uiView?uiView.parent.localStorage:uiView.localStorage; const value=JSON.parse(storage.getItem(readStateStorageKey())||'{}'); readBaselines=value&&typeof value==='object'?value:{}; } catch { readBaselines={}; } }
  function markAppRead(key: AppKey): void { const count=currentAppCount(key); if(count<=0)return; readBaselines[key]=count; try { const storage=uiView.parent!==uiView?uiView.parent.localStorage:uiView.localStorage; storage.setItem(readStateStorageKey(),JSON.stringify(readBaselines)); } catch { /* unavailable storage */ } }
  function loadBeautyReplies(): void {
    try {
      const storage = uiView.parent !== uiView ? uiView.parent.localStorage : uiView.localStorage;
      const value = JSON.parse(storage.getItem(beautyReplyStorageKey()) || '[]');
      if (Array.isArray(value)) beautyReplies = value.filter(item => BeautyReplyShape(item));
    } catch { /* use chat-variable replies supplied by the host */ }
  }
  function saveBeautyReplies(): void {
    try {
      const storage = uiView.parent !== uiView ? uiView.parent.localStorage : uiView.localStorage;
      storage.setItem(beautyReplyStorageKey(), JSON.stringify(beautyReplies));
    } catch { /* storage may be unavailable in a sandboxed iframe */ }
  }
  function BeautyReplyShape(value: unknown): value is BeautyRankReply {
    if (!value || typeof value !== 'object') return false;
    const row = value as Partial<BeautyRankReply>;
    return typeof row.id === 'string' && typeof row.name === 'string' && typeof row.content === 'string'
      && typeof row.floor === 'number' && typeof row.time === 'string';
  }
  function repliesForBeauty(name: string): BeautyRankReply[] { return beautyReplies.filter(reply => reply.name === name); }
  function replyNow(): string { return new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }); }
  function replyId(): string { return `reply:${Date.now()}:${Math.random().toString(36).slice(2, 7)}`; }

  function applyContactFilter(): void {
    const keyword = contactFilter.trim().toLocaleLowerCase();
    root.querySelectorAll<HTMLElement>('[data-contact-search-text]').forEach(row => {
      row.hidden = Boolean(keyword) && !(row.dataset.contactSearchText ?? '').includes(keyword);
    });
    const allPanel = root.querySelector<HTMLElement>('[data-all-contacts-panel]');
    if (allPanel) allPanel.hidden = !allContactsExpanded && !keyword;
    const toggle = root.querySelector<HTMLButtonElement>('[data-action="contacts-toggle"]');
    toggle?.setAttribute('aria-expanded', String(allContactsExpanded || Boolean(keyword)));
  }

  function readLoreSelected(): Array<{ uid: string; content: string }> {
    try {
      const storage = uiView.parent !== uiView ? uiView.parent.localStorage : uiView.localStorage;
      const stored = JSON.parse(storage.getItem('daoyuan_wx_lore_selected') || '{}') as unknown;
      if (Array.isArray(stored)) return stored as Array<{ uid: string; content: string }>;
      if (!stored || typeof stored !== 'object') return [];
      const record = stored as Record<string, unknown>;
      const values = Array.isArray(record.__global__) ? record.__global__ : Object.values(record).flatMap(value => Array.isArray(value) ? value : []);
      const seen = new Set<string>();
      return values.flatMap(item => {
        if (!item || typeof item !== 'object') return [];
        const entry = item as { uid?: unknown; content?: unknown };
        if (typeof entry.uid !== 'string' || typeof entry.content !== 'string' || seen.has(entry.uid)) return [];
        seen.add(entry.uid);
        return [{ uid: entry.uid, content: entry.content }];
      });
    } catch { return []; }
  }

  function renderYujianSettings(content: HTMLElement): void {
    content.append(button(doc, 'settings-back-button', '← 返回 API 设置', 'settings-home'));
    appendPageHeading(doc, content, '玉简设定', '与原版状态栏玉简共用同一套本地配置，但前端可独立运行。', 'API · 世界书 · 预设');
    const form = element(doc, 'div', 'settings-form');
    const settingsPanel = appendPanel(doc, form, '自定义 API 配置', '留空基础 URL 和模型时，使用酒馆内建生成。');
    const field = (label: string, key: 'apiBaseUrl'|'apiKey'|'apiModel', type = 'text'): HTMLInputElement => {
      const wrap = element(doc, 'label', 'settings-field');
      wrap.append(element(doc, 'span', 'settings-label', label));
      const input = doc.createElement('input'); input.type = key === 'apiBaseUrl' ? 'url' : type; input.value = yujianSettings[key]; input.dataset.setting = key;
      if (key === 'apiBaseUrl') configureApiUrlInput(input);
      wrap.append(input); settingsPanel.append(wrap); return input;
    };
    field('基础 URL（Endpoint）', 'apiBaseUrl');
    field('API 密钥（API Key）', 'apiKey', 'password');
    field('模型（Model）', 'apiModel');
    const storyParseToggle = element(doc, 'label', 'settings-auto-toggle');
    const storyParseInput = doc.createElement('input'); storyParseInput.type = 'checkbox'; storyParseInput.checked = yujianSettings.storyParseEnabled; storyParseInput.dataset.yujianStoryParse = 'true';
    const storyParseCopy = element(doc, 'span', 'settings-auto-toggle-copy');
    storyParseCopy.append(element(doc, 'strong', undefined, '解析正文中的玉简通信'), element(doc, 'small', undefined, '仅提取正文中明确通过玉简实际收发的消息原文；不会把叙述、动作或意图概括成聊天。'));
    storyParseToggle.append(storyParseInput, storyParseCopy); settingsPanel.append(storyParseToggle);
    const modelControls = element(doc, 'div', 'settings-control-group');
    const fetchModelsButton = button(doc, 'secondary-button', fetchingModels ? '获取中…' : '获取模型列表', 'models-fetch');
    fetchModelsButton.disabled = fetchingModels;
    modelControls.append(fetchModelsButton);
    if (modelOptions.length) {
      const modelSelect = doc.createElement('select');
      modelSelect.dataset.modelSelect = 'true';
      modelSelect.setAttribute('aria-label', '已获取的模型列表');
      const placeholder = element(doc, 'option', undefined, `请选择模型（共 ${modelOptions.length} 个）`);
      placeholder.value = '';
      modelSelect.append(placeholder);
      modelOptions.forEach(model => {
        const option = element(doc, 'option', undefined, model);
        option.value = model;
        option.selected = model === yujianSettings.apiModel;
        modelSelect.append(option);
      });
      modelControls.append(modelSelect);
    }
    settingsPanel.append(modelControls);
    const promptLabel = element(doc, 'label', 'settings-field');
    promptLabel.append(element(doc, 'span', 'settings-label', '传讯指引（自定义提示词）'));
    const prompt = doc.createElement('textarea'); prompt.rows = 4; prompt.value = yujianSettings.customPrompt; prompt.dataset.setting = 'customPrompt'; prompt.placeholder = '语气、风格、禁忌等额外指引'; promptLabel.append(prompt); settingsPanel.append(promptLabel);

    const importPanel = appendPanel(doc, form, '旧档聊天迁移', '从当前聊天的状态栏玉简只读导入已有记录。只合并缺失消息，不修改 MVU，重复导入不会重复入账。');
    const importButton = button(doc, 'secondary-button', importingStatusHistory ? '正在导入…' : '导入现有状态栏聊天记录', 'yujian-history-import');
    importButton.disabled = importingStatusHistory;
    importPanel.append(importButton);

    const presetPanel = appendPanel(doc, form, '传讯预设', '保存和恢复 API、模型与自定义提示词配置。');
    const presetSelect = doc.createElement('select'); presetSelect.dataset.preset = 'select';
    presetSelect.append(element(doc, 'option', undefined, '-- 当前手动配置 --'));
    try {
      const storage = uiView.parent !== uiView ? uiView.parent.localStorage : uiView.localStorage;
      const presets = JSON.parse(storage.getItem('daoyuan_wx_presets') || '{}') as Record<string, YujianSettingsDraft>;
      Object.keys(presets).forEach(name => { const option = element(doc, 'option', undefined, name); option.value = name; presetSelect.append(option); });
    } catch { /* ignore malformed presets */ }
    const apply = button(doc, 'secondary-button', '应用', 'preset-apply');
    const save = button(doc, 'secondary-button', '另存', 'preset-save');
    const remove = button(doc, 'secondary-button', '删除', 'preset-delete');
    const presetActions = element(doc, 'div', 'settings-control-group is-inline');
    presetActions.append(apply, save, remove);
    presetPanel.append(presetSelect, presetActions);

    const lorePanel = appendPanel(doc, form, '角色知识注入（世界书）', `${loreEntries.length} 条启用条目；当前联系人的专属条目默认自动注入，下方勾选项作为所有联系人共用的背景知识。`);
    const search = doc.createElement('input'); search.className = 'settings-search'; search.placeholder = '搜索条目名称或内容'; search.value = loreFilter; search.dataset.loreSearch = 'true'; lorePanel.append(search);
    const selected = new Set(loreSelected.map(item => item.uid));
    const list = element(doc, 'div', 'settings-lore-list');
    loreEntries.filter(entry => !loreFilter || `${entry.name}\n${entry.content}`.toLocaleLowerCase().includes(loreFilter.toLocaleLowerCase())).forEach(entry => {
      const label = element(doc, 'label', 'settings-lore-item');
      const check = doc.createElement('input'); check.type = 'checkbox'; check.checked = selected.has(entry.uid); check.dataset.loreUid = entry.uid;
      label.append(check, element(doc, 'span', undefined, entry.name)); list.append(label);
    });
    lorePanel.append(list);
    form.append(button(doc, 'primary-button', loreRequested ? '保存玉简设定' : '读取世界书并保存', 'settings-save'));
    content.append(form);
    if (!loreRequested) { loreRequested = true; sendAction('REQUEST_YUJIAN_LORE'); }
  }

  function renderWorldSimulationHub(content: HTMLElement): void {
    const page = element(doc, 'div', 'world-sim-hub');
    const head = element(doc, 'header', 'world-sim-hub-head');
    head.append(element(doc, 'p', undefined, '双界独立账本'), element(doc, 'h1', undefined, '世界推演'), element(doc, 'span', undefined, '选择要查看的世界。两套推演分别启停、分别记录，不共享事件链。'));
    const grid = element(doc, 'div', 'world-sim-choice-grid');
    for (const item of [
      { key:'xuantian', mark:'玄', title:'玄天界推演', note:'五大地域、势力与多线事件', enabled:worldSimulationFeatures.xuantianEnabled },
      { key:'earth', mark:'地', title:'地球推演', note:'灵气复苏、区域与势力演化', enabled:worldSimulationFeatures.earthEnabled },
    ] as const) {
      const card = button(doc, `world-sim-choice${item.enabled ? '' : ' disabled'}`, '', 'world-sim-open', item.key);
      card.disabled = !item.enabled;
      card.append(element(doc,'span','world-sim-choice-mark',item.mark),element(doc,'strong',undefined,item.title),element(doc,'p',undefined,item.note),element(doc,'small',undefined,item.enabled ? '进入推演 →' : '已在设置中关闭'));
      grid.append(card);
    }
    const settings = button(doc,'secondary-button world-sim-settings-button','管理推演开关','settings-open','world');
    page.append(head,grid,settings); content.append(page);
  }

  function renderEarthSimulation(content: HTMLElement): void {
      content.append(button(doc, 'world-sim-back', '← 桌面', 'app', 'home'));
      const earthPage = element(doc, 'div', 'earth-sim-page');
      const hero = element(doc, 'header', 'earth-sim-hero');
      const orbit = element(doc, 'div', 'earth-sim-orbit');
      orbit.setAttribute('aria-hidden', 'true');
      orbit.append(element(doc, 'span', 'earth-sim-planet'), element(doc, 'span', 'earth-sim-moon'));
      const heroCopy = element(doc, 'div', 'earth-sim-hero-copy');
      heroCopy.append(
        element(doc, 'p', 'earth-sim-kicker', '道渊小手机 V1.2 · 双界推演'),
        element(doc, 'h1', undefined, '地球世界推演'),
        element(doc, 'p', undefined, '以当前聊天为边界，记录复苏、学校筹建、双界接触与虫群压力。'),
      );
      const heroStatus = element(doc, 'div', 'earth-sim-hero-status');
      const worldbookReady = Boolean(earthWorldbookStatus?.mounted && earthWorldbookMountedEntryCount > 0);
      const worldbookLabel = worldbookReady ? `世界书已挂载 · ${earthWorldbookMountedEntryCount} 条` : earthWorldbookStatus?.reason ?? '正在检查附属世界书';
      heroStatus.append(element(doc, 'span', `earth-sim-pulse${worldbookReady ? '' : ' pending'}`), element(doc, 'span', undefined, worldbookLabel));
      hero.append(orbit, heroCopy, heroStatus);

      const worldbookPanel = element(doc, 'section', `earth-worldbook-status${worldbookReady ? ' ready' : ''}`);
      const worldbookCopy = element(doc, 'div', 'earth-worldbook-status-copy');
      worldbookCopy.append(element(doc, 'strong', undefined, worldbookReady ? '推演依据已连接' : '推演依据尚未就绪'), element(doc, 'small', undefined, earthWorldbookStatus?.reason ?? '等待宿主世界书能力检测。'));
      const worldbookActions = element(doc, 'div', 'earth-worldbook-actions');
      if (earthWorldbookStatus?.status === 'not-installed') { const install = button(doc, 'secondary-button', '安装世界书', 'earth-worldbook-install'); install.disabled = !earthWorldbookStatus.canCreate; worldbookActions.append(install); }
      else if (earthWorldbookStatus && !earthWorldbookStatus.mounted && !['conflict', 'duplicate-entries', 'empty-snapshot'].includes(earthWorldbookStatus.status)) { const attach = button(doc, 'secondary-button', '挂载到当前角色', 'earth-worldbook-attach'); attach.disabled = !earthWorldbookStatus.canAttach; worldbookActions.append(attach); }
      if (earthWorldbookStatus?.status === 'missing-entries') { const repair = button(doc, 'secondary-button', `补回 ${earthWorldbookStatus.missingEntries.length} 条`, 'earth-worldbook-repair'); repair.disabled = !earthWorldbookStatus.canRepairMissing; worldbookActions.append(repair); }
      if (earthWorldbookStatus?.status === 'user-modified') worldbookActions.append(button(doc, 'secondary-button', '更新内置规则与 EJS', 'earth-worldbook-repair'));
      worldbookActions.append(button(doc, 'earth-worldbook-refresh', '刷新', 'earth-worldbook-refresh'));
      worldbookPanel.append(worldbookCopy, worldbookActions);

      const manualPanel = element(doc, 'section', 'earth-sim-panel earth-manual-simulation');
      const manualCopy = element(doc, 'div', 'earth-manual-simulation-copy');
      manualCopy.append(element(doc, 'strong', undefined, '手动推演'), element(doc, 'small', undefined, '只读取最近 5 条 AI 回复；用户输入不占层数。'));
      const manualButton = button(doc, 'primary-button earth-manual-simulation-button', earthSimulationRunning ? '推演中…' : '开始手动推演', 'earth-simulation-run');
      manualButton.disabled = earthSimulationRunning || !worldbookReady;
      manualPanel.append(manualCopy, manualButton);

      const tabs = element(doc, 'div', 'earth-sim-tabs');
      tabs.setAttribute('role', 'tablist');
      const tabItems: Array<[EarthSettingsTab, string]> = [['overview', '总览'], ['regions', '区域'], ['forces', '势力'], ['events', '事件']];
      for (const [key, label] of tabItems) {
        const tab = button(doc, `earth-sim-tab${earthSettingsTab === key ? ' active' : ''}`, label, 'earth-sim-tab', key);
        tab.setAttribute('role', 'tab'); tab.setAttribute('aria-selected', String(earthSettingsTab === key));
        tabs.append(tab);
      }
      earthPage.append(hero, worldbookPanel, manualPanel, tabs);
      if (!earthWorldbookRequested) { earthWorldbookRequested = true; sendAction('REQUEST_EARTH_WORLDBOOK_STATUS'); }

      if (earthSettingsTab === 'overview') {
        const clock = element(doc, 'section', 'earth-sim-clock');
        const dateCopy = element(doc, 'div', 'earth-sim-date');
        const earthRemaining = featureModuleFlags.world && worldSimulationFeatures.earthEnabled && earthApiSettings.enabled ? Math.max(0, earthApiSettings.replyInterval - (earthSimulationState?.autoCounter ?? 0)) : null;
        dateCopy.append(element(doc, 'span', undefined, '地球日期'), element(doc, 'strong', undefined, earthSimulationState?.earthDate ?? '2026-08-26'), element(doc, 'small', undefined, `玄天界日期 ${earthSimulationState?.xuantianDate ?? '2026-08-26'} · 复苏纪元第 ${earthSimulationState?.revivalYear ?? 0} 年 · 序列 ${earthSimulationState?.sequence ?? 0}`), element(doc, 'small', undefined, earthRemaining === null ? '自动推演已关闭' : `还有 ${earthRemaining} 轮对话后自动推演`));
        const activeRatio = earthSimulationState?.timeRatio ?? earthApiSettings.timeRatio;
        const sync = element(doc, 'div', 'earth-sim-sync'); sync.append(element(doc, 'span', undefined, '地球'), element(doc, 'i'), element(doc, 'span', undefined, '玄天界'), element(doc, 'b', undefined, EARTH_TIME_RATIO_OPTIONS.find(option => option.value === activeRatio)?.label ?? activeRatio));
        clock.append(dateCopy, sync); earthPage.append(clock);

        const metrics = element(doc, 'div', 'earth-sim-metrics');
        for (const [label, value, tone, note] of [
          ['灵力复苏', earthSimulationState?.revivalStage ?? '复苏初现', 'jade', '地球独立演化阶段'],
          ['双界接触', earthSimulationState?.contactStage ?? '互不知情', 'gold', '只随可验证接触证据推进'],
          ['相交秘境', earthSimulationState?.secretRealmStage ?? '未激活', 'violet', '与虫群通道分开记录'],
          ['学校计划', '筹备启动', 'blue', '第一所灵力学校'],
        ] as const) {
          const card = element(doc, 'article', 'earth-sim-metric'); card.dataset.tone = tone;
          card.append(element(doc, 'span', undefined, label), element(doc, 'strong', undefined, value), element(doc, 'small', undefined, note)); metrics.append(card);
        }
        earthPage.append(metrics);

        const pressure = element(doc, 'section', 'earth-sim-panel earth-sim-pressure');
        const pressureHead = element(doc, 'div', 'earth-sim-panel-head'); pressureHead.append(element(doc, 'div', undefined, '虫群压力'), element(doc, 'span', 'earth-sim-state-tag warning', '通道独立'));
        const lanes = element(doc, 'div', 'earth-sim-lanes');
        for (const [world, stage] of [['地球', earthSimulationState?.swarmEarthStage ?? '零星迹象'], ['玄天界', earthSimulationState?.swarmXuantianStage ?? '零星迹象']] as const) {
          const lane = element(doc, 'div', 'earth-sim-lane'); lane.append(element(doc, 'span', undefined, world), element(doc, 'div', 'earth-sim-lane-track'), element(doc, 'strong', undefined, stage)); lanes.append(lane);
        }
        pressure.append(pressureHead, lanes, element(doc, 'p', 'earth-sim-panel-note', '虫群通道与相交秘境分开记录；控制秘境不会关闭虫群通道。'));
        earthPage.append(pressure);

        const eventPanel = element(doc, 'section', 'earth-sim-panel');
        const stateEvents = earthSimulationState?.events.filter(event => event.status === 'active') ?? [];
        const eventHead = element(doc, 'div', 'earth-sim-panel-head'); eventHead.append(element(doc, 'div', undefined, '活跃事件'), element(doc, 'span', 'earth-sim-count', `${stateEvents.length} / 20`));
        const events = element(doc, 'div', 'earth-sim-events');
        const activeEvents: ReadonlyArray<readonly [string,string,string,string,string,string,string,string]> = stateEvents.map(event => [event.id,event.kind,event.summary.split(/[，。；]/)[0]?.trim().slice(0, 32) || `${event.kind}事件`,event.stage,event.summary,`世界日期 ${event.worldDate} 已提交到状态账本。`,'下一阶段必须由后续推演逐级提交。','仅展示状态账本已确认的信息。'] as const);
        for (const [key, kind, title, stage, copy, progress, condition, boundary] of activeEvents) {
          const isExpanded = expandedEarthEvent === key;
          const row = button(doc, `earth-sim-event${isExpanded ? ' expanded' : ''}`, '', 'earth-event-toggle', key);
          row.setAttribute('aria-expanded', String(isExpanded)); row.setAttribute('aria-controls', `earth-event-detail-${key}`);
          row.append(element(doc, 'span', 'earth-sim-event-kind', kind), element(doc, 'div', 'earth-sim-event-copy'), element(doc, 'span', 'earth-sim-event-stage', stage));
          row.children[1].append(element(doc, 'strong', undefined, title), element(doc, 'small', undefined, copy));
          row.append(element(doc, 'span', 'earth-event-indicator', isExpanded ? '收起 −' : '查看详情 ＋'));
          if (isExpanded) {
            const details = element(doc, 'div', 'earth-event-details'); details.id = `earth-event-detail-${key}`;
            for (const [label, value] of [['已确认进展', progress], ['下一推进条件', condition], ['信息边界', boundary]] as const) { const item = element(doc, 'div', 'earth-event-detail-row'); item.append(element(doc, 'span', undefined, label), element(doc, 'p', undefined, value)); details.append(item); }
            row.append(details);
          }
          events.append(row);
        }
        if (!activeEvents.length) events.append(element(doc, 'p', 'earth-sim-empty-state', '尚无推演提交的活跃事件。完成一次手动推演后才会出现。'));
        eventPanel.append(eventHead, events); earthPage.append(eventPanel);
      }

      if (earthSettingsTab === 'regions') {
        const statusPanel = element(doc, 'section', 'earth-sim-panel earth-sim-book-status');
        const head = element(doc, 'div', 'earth-sim-panel-head'); head.append(element(doc, 'div', undefined, '全球复苏观测'), element(doc, 'span', 'earth-sim-state-tag ready', '4 个核心区域'));
        statusPanel.append(head, element(doc, 'p', 'earth-sim-panel-note', '各区域刚开始确认灵力现象，尚未形成公开的超凡社会。'));
        const regionList = element(doc, 'div', 'earth-region-list');
        const regionRows = [
          ['china', '中国', '国家统筹', '修真科学与教育筹备', '北京 · 武汉 · 上海 · 成都', '灵力异常已进入跨部门观测，公开口径仍保持为新型自然现象。', '教育标准、公共安全与基础研究同步筹备。', '尚无公开修行体系；异常个体仍以零星观察为主。'],
          ['usa', '美国', '多中心竞合', '灵能研究与私营机构', '华盛顿 · 波士顿 · 旧金山', '联邦机构、大学与私营实验室分别建立观察项目，尚未形成统一解释。', '仪器测量、人体反应与潜在商业用途并行研究。', '信息分散且互相竞争，玩家尚未掌握任何秘密项目细节。'],
          ['russia', '俄罗斯', '安全体系主导', '共鸣学与极端环境', '莫斯科 · 新西伯利亚 · 摩尔曼斯克', '高纬度与极端环境中的异常读数受到安全体系持续关注。', '共鸣现象、寒区样本与封闭环境安全。', '现阶段只有观测迹象，没有确认可控的超凡力量。'],
          ['eu', '欧盟', '跨国协调', '以太工程与伦理治理', '布鲁塞尔 · 柏林 · 巴黎', '多个成员体系开始交换异常报告，并讨论共同研究规范。', '跨国数据协调、伦理边界与以太工程假说。', '协调仍在早期，尚无统一机构或公开超凡政策。'],
        ] as const;
        for (const [key, name, policy, focus, city, situation, priority, boundary] of regionRows) {
          const stateRegion = earthSimulationState?.regions[key];
          const isExpanded = expandedEarthRegion === key;
          const row = button(doc, `earth-region-card${isExpanded ? ' expanded' : ''}`, '', 'earth-region-toggle', key);
          const detailId = `earth-region-detail-${key}`;
          row.setAttribute('aria-expanded', String(isExpanded)); row.setAttribute('aria-controls', detailId);
          const head = element(doc, 'div', 'earth-region-head'); head.append(element(doc, 'strong', undefined, name), element(doc, 'span', undefined, `${policy} · ${stateRegion?.status ?? '异常迹象'}`));
          const summary = element(doc, 'div', 'earth-region-summary'); summary.append(element(doc, 'p', undefined, focus), element(doc, 'small', undefined, city));
          const indicator = element(doc, 'span', 'earth-region-indicator', isExpanded ? '收起 −' : '查看当前信息 ＋');
          row.append(head, summary, indicator);
          if (isExpanded) {
            const details = element(doc, 'div', 'earth-region-details'); details.id = detailId;
            for (const [label, value] of [['当前态势', stateRegion?.summary ?? situation], ['观察重点', priority], ['最后更新', stateRegion?.updatedAt ?? boundary]] as const) { const item = element(doc, 'div', 'earth-region-detail-row'); item.append(element(doc, 'span', undefined, label), element(doc, 'p', undefined, value)); details.append(item); }
            row.append(details);
          }
          regionList.append(row);
        }
        statusPanel.append(regionList); earthPage.append(statusPanel);
        const nodes = element(doc, 'section', 'earth-sim-panel'); nodes.append(element(doc, 'div', 'earth-sim-panel-head'));
        nodes.children[0].append(element(doc, 'div', undefined, '其他观测节点'), element(doc, 'span', 'earth-sim-count', '12 个地球城市'));
        nodes.append(element(doc, 'p', 'earth-sim-panel-note', '东亚、南亚、中东、非洲、拉丁美洲与大洋洲均保持独立发展线；本轮仅展示进入玩家认知的节点。'));
        earthPage.append(nodes);
      }

      if (earthSettingsTab === 'forces') {
        const school = element(doc, 'section', 'earth-sim-panel'); const schoolHead = element(doc, 'div', 'earth-sim-panel-head'); schoolHead.append(element(doc, 'div', undefined, '灵力教育'), element(doc, 'span', 'earth-sim-state-tag warning', '筹备期')); school.append(schoolHead, element(doc, 'h2', 'earth-force-title', '第一所灵力学校'), element(doc, 'p', 'earth-sim-panel-note', '尚未选址，尚未招生。当前重点是课程标准、安全边界与师资征集。')); earthPage.append(school);
        const groups = element(doc, 'section', 'earth-sim-panel'); const factionValues = earthSimulationState ? Object.values(earthSimulationState.factions) : []; groups.append(element(doc, 'div', 'earth-sim-panel-head')); groups.children[0].append(element(doc, 'div', undefined, '势力动态档案'), element(doc, 'span', 'earth-sim-count', `${factionValues.length} 个势力`));
        const categoryOrder = ['国家与区域','财团与跨国组织','民间与地下组织','玄天界势力'] as const;
        if (!earthFactionGroupsInitialized) {
          for (const category of categoryOrder) if (factionValues.some(faction => faction.category === category && (faction.status !== '潜伏' || faction.activity !== '尚未进入公开行动阶段。'))) expandedEarthFactionCategories.add(category);
          if (!expandedEarthFactionCategories.size) expandedEarthFactionCategories.add(categoryOrder[0]);
          earthFactionGroupsInitialized = true;
        }
        const categoryList = element(doc, 'div', 'earth-faction-groups');
        for (const category of categoryOrder) {
          const categoryFactions = factionValues.filter(faction => faction.category === category);
          const categoryOpen = expandedEarthFactionCategories.has(category);
          const section = element(doc, 'section', `earth-faction-group${categoryOpen ? ' expanded' : ''}`);
          const categoryButton = button(doc, 'earth-faction-group-toggle', '', 'earth-faction-category-toggle', category);
          categoryButton.setAttribute('aria-expanded', String(categoryOpen)); categoryButton.setAttribute('aria-controls', `earth-faction-group-${category}`);
          const changedCount = categoryFactions.filter(faction => faction.status !== '潜伏' || faction.activity !== '尚未进入公开行动阶段。').length;
          categoryButton.append(element(doc, 'span', undefined, category), element(doc, 'small', undefined, `${categoryFactions.length} 个${changedCount ? ` · ${changedCount} 个有变化` : ''}`), element(doc, 'b', undefined, categoryOpen ? '−' : '＋'));
          section.append(categoryButton);
          if (categoryOpen) {
            const list = element(doc, 'div', 'earth-faction-list'); list.id = `earth-faction-group-${category}`;
            const orderedFactions = [...categoryFactions].sort((a, b) => Number(b.status !== '潜伏' || b.activity !== '尚未进入公开行动阶段。') - Number(a.status !== '潜伏' || a.activity !== '尚未进入公开行动阶段。'));
            for (const faction of orderedFactions) { const changed = faction.status !== '潜伏' || faction.activity !== '尚未进入公开行动阶段。'; const open = expandedEarthFaction === faction.id; const card = button(doc, `earth-faction-card${changed ? ' changed' : ''}${open ? ' expanded' : ''}`, '', 'earth-faction-toggle', faction.id); card.setAttribute('aria-expanded', String(open)); const top = element(doc,'div','earth-faction-head'); top.append(element(doc,'strong',undefined,faction.name)); const tags = element(doc,'div','earth-faction-tags'); if(changed) tags.append(element(doc,'span','earth-faction-change-tag','有变化')); tags.append(element(doc,'span','earth-sim-state-tag',faction.status)); top.append(tags); const activity = changed && faction.activity === '尚未进入公开行动阶段。' ? `已进入${faction.status}阶段，具体行动尚未记录。` : faction.activity; card.append(top,element(doc,'small','earth-faction-category',`影响 ${faction.influence}/100`),element(doc,'p','earth-faction-activity',activity)); if(open){const detail=element(doc,'div','earth-faction-details'); detail.append(element(doc,'span',undefined,'长期目标'),element(doc,'p',undefined,faction.objective),element(doc,'span',undefined,'更新时间'),element(doc,'p',undefined,faction.updatedAt)); card.append(detail);} list.append(card); }
            section.append(list);
          }
          categoryList.append(section);
        }
        groups.append(categoryList, element(doc, 'p', 'earth-sim-panel-note earth-faction-clock-note', '势力活动由地球独立时钟推进；正文未提及地球时也不会停止。')); earthPage.append(groups);
      }

      if (earthSettingsTab === 'events') {
        const timelinePanel = element(doc, 'section', 'earth-sim-panel earth-event-timeline-panel');
        const timeline = element(doc, 'div', 'earth-event-timeline');
        const committedEvents = earthSimulationState?.events ?? [];
        for (const event of committedEvents) { const summaryLead = event.summary.split(/[，。；]/)[0]?.trim().slice(0, 28); const title = summaryLead || `${event.kind}事件`; const row = element(doc, 'article', 'earth-event-timeline-row'); row.append(element(doc, 'span', 'earth-event-dot'), element(doc, 'div')); row.children[1].append(element(doc, 'span', 'earth-sim-event-stage', event.stage), element(doc, 'strong', undefined, title), element(doc, 'p', undefined, event.summary), element(doc, 'small', undefined, `${event.kind} · ${event.worldDate} · ${event.status === 'active' ? '进行中' : '已关闭'}`)); timeline.append(row); }
        if (!committedEvents.length) timeline.append(element(doc, 'p', 'earth-sim-empty-state', '尚无已提交事件。这里不显示演示内容，只显示已经成功保存的推演结果。'));
        timelinePanel.append(timeline, element(doc, 'p', 'earth-sim-panel-note earth-event-clock-note', '地球世界日由每次独立推演前进，不依赖玄天界正文是否提及地球。')); earthPage.append(timelinePanel);
      }
      content.append(earthPage);
  }

  function renderXuantianSimulation(content: HTMLElement): void {
    content.append(button(doc, 'world-sim-back', '← 桌面', 'app', 'home'));
    const page = element(doc, 'div', 'xuantian-sim-page');
    const hero = element(doc, 'header', 'xuantian-sim-hero');
    const seal = element(doc, 'div', 'xuantian-sim-seal', '玄');
    seal.setAttribute('aria-hidden', 'true');
    const heroCopy = element(doc, 'div', 'xuantian-sim-hero-copy');
    heroCopy.append(
      element(doc, 'p', 'xuantian-sim-kicker', '原版世界推进 · 当前聊天独立账本'),
      element(doc, 'h1', undefined, '玄天界推演'),
      element(doc, 'p', undefined, '观五域风云，辨宗门进退。此页仅展示原版世界的已确认状态，DLC 不参与核心推演。'),
    );
    const tide = element(doc, 'div', 'xuantian-tide');
    tide.append(element(doc, 'span', 'xuantian-tide-mark'), element(doc, 'span', undefined, '天下大势'), element(doc, 'strong', undefined, '暗流'));
    hero.append(heroCopy, seal, tide);

    const tabs = element(doc, 'nav', 'xuantian-sim-tabs');
    tabs.setAttribute('aria-label', '玄天界推演栏目');
    tabs.setAttribute('role', 'tablist');
    const tabItems: Array<[XuantianSettingsTab, string]> = [['overview', '总览'], ['regions', '地域'], ['forces', '势力'], ['events', '事件线']];
    for (const [key, label] of tabItems) {
      const tab = button(doc, `xuantian-sim-tab${xuantianSettingsTab === key ? ' active' : ''}`, label, 'xuantian-sim-tab', key);
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-selected', String(xuantianSettingsTab === key));
      tabs.append(tab);
    }
    page.append(hero, tabs);

    if (xuantianSettingsTab === 'overview') {
      const clock = element(doc, 'section', 'xuantian-clock');
      const date = element(doc, 'div', 'xuantian-clock-date');
      const xuantianRemaining = featureModuleFlags.world && worldSimulationFeatures.xuantianEnabled && xuantianApiSettings.enabled ? Math.max(0, xuantianApiSettings.replyInterval - (xuantianSimulationState?.autoCounter ?? 0)) : null;
      date.append(element(doc, 'span', undefined, '玄天历'), element(doc, 'strong', undefined, xuantianSimulationState?.calendarLabel ?? '元会历·未校准'), element(doc, 'small', undefined, `世界日 ${xuantianSimulationState?.worldDay ?? 0}　·　推演序列 ${xuantianSimulationState?.sequence ?? 0}`), element(doc, 'small', undefined, xuantianRemaining === null ? '自动推演已关闭' : `还有 ${xuantianRemaining} 轮对话后自动推演`));
      const action = button(doc, 'xuantian-simulate-button', xuantianSimulationRunning ? '推演中…' : '进行一次推演', 'xuantian-simulation-run');
      action.disabled = xuantianSimulationRunning;
      clock.append(date, action);
      page.append(clock);

      const metrics = element(doc, 'section', 'xuantian-metric-grid');
      for (const [label, value, note, tone] of [
        ['大陆地域', '5', '五域，不是五座城市', 'gold'],
        ['活跃事件线', String(xuantianSimulationState?.events.filter(event=>event.status==='active').length ?? 0), '多条事件可同时推进', 'red'],
        ['势力档案', String(Object.keys(xuantianSimulationState?.factions ?? {}).length || 28), '按所在地与性质归档', 'jade'],
        ['周期秘境', '原版有载', '可生成独立事件线', 'blue'],
      ] as const) {
        const card = element(doc, 'article', 'xuantian-metric-card'); card.dataset.tone = tone;
        card.append(element(doc, 'span', undefined, label), element(doc, 'strong', undefined, value), element(doc, 'small', undefined, note));
        metrics.append(card);
      }
      page.append(metrics);

      const layout = element(doc, 'div', 'xuantian-overview-grid');
      const regions = element(doc, 'section', 'xuantian-panel');
      const regionHead = element(doc, 'div', 'xuantian-panel-head');
      regionHead.append(element(doc, 'div', undefined, '五大地域'), element(doc, 'span', 'xuantian-badge', '原版世界书'));
      const strip = element(doc, 'div', 'xuantian-region-strip');
      for (const [key, name, state, pressure] of [
        ['center', '中央神州', xuantianSimulationState?.regions.center.status ?? '暗流', String(xuantianSimulationState?.regions.center.pressure ?? 30)], ['north', '北冥雪原', xuantianSimulationState?.regions.north.status ?? '暗流', String(xuantianSimulationState?.regions.north.pressure ?? 34)], ['south', '南离火洲', xuantianSimulationState?.regions.south.status ?? '紧张', String(xuantianSimulationState?.regions.south.pressure ?? 46)], ['east', '东极青木域', xuantianSimulationState?.regions.east.status ?? '暗流', String(xuantianSimulationState?.regions.east.pressure ?? 28)], ['west', '西漠佛国', xuantianSimulationState?.regions.west.status ?? '平稳', String(xuantianSimulationState?.regions.west.pressure ?? 22)],
      ] as const) {
        const region = button(doc, `xuantian-region-chip${selectedXuantianRegion === key ? ' active' : ''}`, '', 'xuantian-region-select', key);
        region.setAttribute('aria-pressed', String(selectedXuantianRegion === key));
        region.append(element(doc, 'span', undefined, name), element(doc, 'strong', undefined, state), element(doc, 'i'));
        region.style.setProperty('--region-pressure', `${pressure}%`);
        strip.append(region);
      }
      regions.append(regionHead, strip, element(doc, 'p', 'xuantian-panel-note', '城市、坊市是地域下的动态地点节点，由原版“玄天界城市生成”规则产生，不存在固定“五城”。'));

      const events = element(doc, 'section', 'xuantian-panel');
      const eventHead = element(doc, 'div', 'xuantian-panel-head');
      const currentEvents=xuantianSimulationState?.events.filter(event=>event.status==='active')??[];
      eventHead.append(element(doc, 'div', undefined, '当前事件线'), element(doc, 'span', 'xuantian-badge warning', `${currentEvents.length} 条进行中`));
      const eventList = element(doc, 'div', 'xuantian-event-list');
      for(const event of currentEvents.slice(0,4)){const item=element(doc,'article','xuantian-event-summary');item.append(element(doc,'span','xuantian-event-kind',event.kind),element(doc,'strong',undefined,event.name),element(doc,'small',undefined,`${event.phase} · ${event.progress}% · ${event.summary}`));eventList.append(item);}
      if(!currentEvents.length)eventList.append(element(doc, 'p', 'xuantian-empty', '暂无已确认事件。完成一次推演后，各事件会独立记录阶段、地域、参与势力与进度。'));
      events.append(eventHead, eventList);
      layout.append(regions, events);
      page.append(layout);
      if(storyDirectorPlan){const plan=storyDirectorPlan;const node=plan.nodes.find(item=>item.id===plan.currentNodeId)||plan.nodes.find(item=>item.status==='current'||item.status==='available');const director=element(doc,'section','xuantian-panel');const head=element(doc,'div','xuantian-panel-head');head.append(element(doc,'div',undefined,'动态剧情导演'),element(doc,'span','xuantian-badge',`${plan.mode} · ${Math.round(plan.confidence*100)}%`));director.append(head,element(doc,'strong',undefined,plan.arcTitle),element(doc,'p','xuantian-panel-note',plan.assessment));if(node)director.append(element(doc,'p',undefined,`当前问题：${node.dramaticQuestion}`),element(doc,'small',undefined,`可感知开场：${node.observableSetup}`));page.append(director);}
      page.append(element(doc, 'p', 'xuantian-preview-note', '推演结果与分支剧情图写入当前聊天的独立状态账本；原版世界书保持只读。'));
    }

    if (xuantianSettingsTab === 'regions') {
      const intro = element(doc, 'section', 'xuantian-panel xuantian-region-focus');
      const badges = element(doc, 'div', 'xuantian-region-badges'); badges.setAttribute('aria-label', '选择玄天界地域');
      for (const [key, label, sub] of [['center','中央神州','中州'],['east','东极青木域','东极'],['south','南离火洲','南离'],['north','北冥雪原','北冥'],['west','西漠佛国','西漠']] as const) {
        const node = button(doc, `xuantian-region-badge${selectedXuantianRegion === key ? ' active' : ''}`, '', 'xuantian-region-select', key);
        node.setAttribute('aria-pressed', String(selectedXuantianRegion === key)); node.append(element(doc,'strong',undefined,label),element(doc,'small',undefined,sub)); badges.append(node);
      }
      const selected = ({ center:['中央神州','人族正道势力','玄天界地理中心；平原、山脉、水系与大量仙城、凡人城郭并存。'], north:['北冥雪原','无归属','玄天界最北方的极地冻土，分布玄冰层、冰川与北冥黑渊。'], south:['南离火洲','魔道势力','玄天界最南方，地火炎山、熔岩裂谷与劫灰构成主要环境。'], east:['东极青木域','妖族','玄天界最东方，又称万妖国度，以莽荒密林和浓郁草木精气为主。'], west:['西漠佛国','佛门势力','玄天界最西方，以荒漠、寺庙、佛塔、石窟及叹息沙海为核心地貌。'] } as const)[selectedXuantianRegion as 'center'|'north'|'south'|'east'|'west'];
      const selectedState=xuantianSimulationState?.regions[selectedXuantianRegion as keyof XuantianSimulationState['regions']];
      const detail = element(doc, 'div', 'xuantian-region-detail');
      detail.append(element(doc, 'span', undefined, '当前查看'), element(doc, 'h2', undefined, selected[0]), element(doc, 'strong', undefined, selected[1]), element(doc, 'p', undefined, selected[2]));
      const facts = element(doc, 'dl', 'xuantian-region-facts');
      for (const [label, value] of [['层级','大陆级地域'],['当前状态',selectedState?.status??'未推演'],['局势压力',`${selectedState?.pressure??0}/100`],['已确认态势',selectedState?.summary??'尚无推演记录'],['城市体系','按灵脉与势力动态生成'],['资料来源','原版世界书地域条目']] as const) { facts.append(element(doc,'dt',undefined,label),element(doc,'dd',undefined,value)); }
      detail.append(facts); intro.append(badges, detail); page.append(intro);
    }

    if (xuantianSettingsTab === 'forces') {
      const panel = element(doc, 'section', 'xuantian-panel');
      const head = element(doc, 'div', 'xuantian-panel-head'); head.append(element(doc,'div',undefined,'原版势力索引'),element(doc,'span','xuantian-badge','所在地 → 性质'));
      const list = element(doc, 'div', 'xuantian-force-groups');
      const groups = [
        ['中央神州', [['顶尖宗门',['蜀山剑门','昆仑道门','万法宗','合欢宗','星道宗','桃花宗']],['大型宗门',['湮丹宗','灵墟宗','青玉宗','符韵门','阵天宗']],['仙朝与属国',['大周仙朝','南梁古国']],['地下组织',['斩仙盟']]]],
        ['东极青木域', [['顶尖妖族',['九尾天狐族','神猿族','五色孔雀族']],['大型妖族',['柳蛇族']]]],
        ['南离火洲', [['顶尖正道',['太阳神宫']],['顶尖魔道',['血神宫','万魂殿','尸魔宗']]]],
        ['北冥雪原', [['宗门',['广寒宫']],['妖族',['蛟龙一族']]]],
        ['西漠佛国', [['佛门',['大雷音寺']]]],
        ['跨域／无固定驻地', [['情报',['天机阁']],['商会',['万宝楼']],['地下黑市',['黑金阁']]]],
      ] as const;
      for (const [region, categories] of groups) {
        const expanded=expandedXuantianForceRegions.has(region);
        const group = element(doc,'section',`xuantian-force-group${expanded?' expanded':''}`);
        const title = button(doc,'xuantian-force-region-toggle','', 'xuantian-force-region-toggle',region);
        title.setAttribute('aria-expanded',String(expanded));
        title.append(element(doc,'span',undefined,region),element(doc,'small',undefined,`${categories.reduce((sum,[,names])=>sum+names.length,0)} 个势力`),element(doc,'i',undefined,expanded?'−':'+'));
        group.append(title);
        if(!expanded){list.append(group);continue;}
        for (const [type,names] of categories) {
          const category=element(doc,'section','xuantian-force-category'); category.append(element(doc,'h4',undefined,type)); const entries=element(doc,'div','xuantian-force-entries');
          for(const name of names){const state=Object.values(xuantianSimulationState?.factions??{}).find(faction=>faction.name===name);const entry=element(doc,'article','xuantian-force-entry'); const top=element(doc,'div','xuantian-force-entry-head'); top.append(element(doc,'strong',undefined,name),element(doc,'span','xuantian-force-status',state?.status??'未记录')); const facts=element(doc,'dl','xuantian-force-entry-facts'); facts.append(element(doc,'dt',undefined,'当前动向'),element(doc,'dd',undefined,state?.activity??'尚无推演记录'),element(doc,'dt',undefined,'与玩家关系'),element(doc,'dd','xuantian-player-relation',state?.relation??'未知'),element(doc,'dt',undefined,'影响力'),element(doc,'dd',undefined,state?`${state.influence}/100`:'未记录')); entry.append(top,facts); entries.append(entry);} category.append(entries); group.append(category);
        }
        list.append(group);
      }
      panel.append(head,list,element(doc,'p','xuantian-panel-note','以上只收录世界书中有明确势力身份的玄天界条目；人物条目与仙界 DLC 势力未混入。')); page.append(panel);
    }

    if (xuantianSettingsTab === 'events') {
      const panel = element(doc, 'section', 'xuantian-panel');
      const head = element(doc, 'div', 'xuantian-panel-head'); head.append(element(doc,'div',undefined,'并行事件线'),element(doc,'span','xuantian-badge warning',`${xuantianSimulationState?.events.length??0} 条账本记录`));
      const cards = element(doc, 'div', 'xuantian-event-cards');
      const regionNames={center:'中央神州',east:'东极青木域',south:'南离火洲',north:'北冥雪原',west:'西漠佛国',cross:'跨域'} as const;
      for (const event of xuantianSimulationState?.events ?? []) {
        const {name:title,kind,phase:stage,progress,summary:copy}=event;const region=regionNames[event.regionId];const time=`世界日 ${event.startedAtDay} → ${event.updatedAtDay}`;
        const card=element(doc,'article','xuantian-event-card');
        const cardHead=element(doc,'div','xuantian-event-card-head'); cardHead.append(element(doc,'span','xuantian-event-kind',kind),element(doc,'span','xuantian-event-card-stage',stage));
        const meta=element(doc,'dl','xuantian-event-meta'); meta.append(element(doc,'dt',undefined,'时间'),element(doc,'dd',undefined,time),element(doc,'dt',undefined,'地域'),element(doc,'dd',undefined,region));
        const progressWrap=element(doc,'div','xuantian-event-progress'); const progressHead=element(doc,'div'); progressHead.append(element(doc,'span',undefined,'事件进度'),element(doc,'strong',undefined,`${progress}%`));
        const bar=element(doc,'i'); bar.style.setProperty('--event-progress',`${progress}%`); progressWrap.append(progressHead,bar);
        card.append(cardHead,element(doc,'h3',undefined,title),meta,progressWrap,element(doc,'p',undefined,copy)); cards.append(card);
      }
      if(!cards.childElementCount)cards.append(element(doc,'p','xuantian-empty','尚无已提交事件线。推演器会根据原版周期秘境、宗门动向与正文证据分别创建事件卡。'));
      panel.append(head,cards,element(doc,'p','xuantian-panel-note','每条事件独立记录名称、时间、地域、阶段与进度；多条事件可在同一轮分别推进。')); page.append(panel);
    }
    content.append(page);
  }

  function appendSimulationModelSelect(target: HTMLElement, realm: 'earth' | 'xuantian'): void {
    const models = realm === 'earth' ? earthModelOptions : xuantianModelOptions;
    if (!models.length) return;
    const settings = realm === 'earth' ? earthApiSettings : xuantianApiSettings;
    const field = element(doc, 'label', 'settings-field earth-api-model-field');
    field.append(element(doc, 'span', 'settings-label', '选择已获取模型'));
    const select = doc.createElement('select');
    select.className = 'earth-api-model-select';
    select.dataset[realm === 'earth' ? 'earthModelSelect' : 'xuantianModelSelect'] = 'true';
    select.setAttribute('aria-label', `${realm === 'earth' ? '地球' : '玄天界'}推演模型列表`);
    const placeholder = element(doc, 'option', undefined, '请选择模型');
    placeholder.value = '';
    placeholder.selected = !models.includes(settings.apiModel);
    select.append(placeholder);
    for (const model of models) {
      const option = element(doc, 'option', undefined, model);
      option.value = model;
      option.selected = model === settings.apiModel;
      select.append(option);
    }
    field.append(select);
    target.append(field);
  }

  function appendSimulationModelControls(target: HTMLElement, realm: 'earth' | 'xuantian'): void {
    const fetching = realm === 'earth' ? fetchingEarthModels : fetchingXuantianModels;
    const controls = element(doc, 'div', 'earth-api-model-controls');
    const fetchButton = button(
      doc,
      'secondary-button earth-api-fetch-button',
      fetching ? '获取中…' : '获取模型列表',
      realm === 'earth' ? 'earth-models-fetch' : 'xuantian-models-fetch',
    );
    fetchButton.disabled = fetching;
    fetchButton.setAttribute('aria-busy', String(fetching));
    controls.append(fetchButton);
    appendSimulationModelSelect(controls, realm);
    target.append(controls);
  }

  function renderXuantianApiSettings(content: HTMLElement): void {
    content.append(button(doc, 'settings-back-button', '← 返回设置', 'settings-home'));
    appendPageHeading(doc, content, '玄天界推演 API', '仅服务玄天界事件线、地域与势力演化；不与地球推演共用。', '独立接口');
    const intro = element(doc, 'section', 'earth-sim-panel xuantian-api-toggle-panel');
    const toggle = element(doc, 'label', 'settings-auto-toggle'); const toggleInput = doc.createElement('input'); toggleInput.type = 'checkbox'; toggleInput.checked = xuantianApiSettings.enabled; toggleInput.dataset.xuantianApiSetting = 'enabled';
    const toggleCopy = element(doc, 'span', 'settings-auto-toggle-copy'); toggleCopy.append(element(doc, 'strong', undefined, '启用玄天界推演 API'), element(doc, 'small', undefined, '此开关只控制接口调用；“世界推演设置”控制应用入口是否显示。')); toggle.append(toggleInput, toggleCopy); intro.append(toggle); content.append(intro);
    const form = element(doc, 'section', 'earth-sim-panel earth-sim-api-form');
    for (const [label, key, type, placeholder] of [['基础 URL','apiBaseUrl','url','https://api.example.com/v1'],['API 密钥','apiKey','password','仅保存在宿主本地设置'],['模型名称','apiModel','text','例如：推演专用模型']] as const) {
      const wrap=element(doc,'label','settings-field'); wrap.append(element(doc,'span','settings-label',label)); const input=doc.createElement('input'); input.type=type; input.placeholder=placeholder; input.value=String(xuantianApiSettings[key]); input.dataset.xuantianApiSetting=key; if(key==='apiBaseUrl') configureApiUrlInput(input); wrap.append(input); form.append(wrap);
    }
    appendSimulationModelControls(form, 'xuantian');
    const twoCol=element(doc,'div','earth-sim-form-grid');
    for (const [label,key] of [['温度','temperature'],['超时（秒）','timeoutSeconds'],['自动推进间隔（轮）','replyInterval'],['失败后重试次数','retryCount'],['单次最大世界日','maxWorldDays']] as const) { const wrap=element(doc,'label','settings-field'); wrap.append(element(doc,'span','settings-label',label)); const input=doc.createElement('input'); input.type='number'; input.min=key==='retryCount'?'0':''; input.max=key==='retryCount'?'2':''; input.value=String(xuantianApiSettings[key]); input.dataset.xuantianApiSetting=key; wrap.append(input); twoCol.append(wrap); }
    form.append(twoCol,element(doc,'p','earth-sim-disabled-note',`每次玄天界推演通常请求 1 次；当前设置下，结构、限流或服务端错误发生时最多请求 ${xuantianApiSettings.retryCount+1} 次。鉴权、配置、世界书前置条件或越权状态变更不会重试。`),button(doc,'primary-button','保存玄天界推演设置','xuantian-api-save')); content.append(form,element(doc,'p','earth-sim-disabled-note','启用后按“自动推进间隔”统计新的 AI 回复；推演只读原版主世界书，并写入当前聊天的独立状态账本。'));
  }

  function renderEarthApiSettings(content: HTMLElement): void {
    content.append(button(doc, 'settings-back-button', '← 返回设置', 'settings-home'));
    appendPageHeading(doc, content, '地球推演 API', '只服务地球后台演化；不与仙网、绝色榜或万宝商行共用。', 'V1.2 · 独立接口');
    const intro = element(doc, 'section', 'earth-sim-panel'); const toggle = element(doc, 'label', 'settings-auto-toggle'); const toggleInput = doc.createElement('input'); toggleInput.type = 'checkbox'; toggleInput.checked = earthApiSettings.enabled; toggleInput.dataset.earthApiSetting = 'enabled'; const toggleCopy = element(doc, 'span', 'settings-auto-toggle-copy'); toggleCopy.append(element(doc, 'strong', undefined, '启用独立推演 API'), element(doc, 'small', undefined, '默认关闭；AI 会先提出世界变化，检查通过后才会保存。')); toggle.append(toggleInput, toggleCopy); intro.append(toggle); content.append(intro);
    const form = element(doc, 'section', 'earth-sim-panel earth-sim-api-form');
    for (const [label, key, type, placeholder] of [['基础 URL', 'apiBaseUrl', 'url', 'https://api.example.com/v1'], ['API 密钥', 'apiKey', 'password', '仅保存在宿主本地设置'], ['模型名称', 'apiModel', 'text', '可手动输入或从列表选择']] as const) { const wrap = element(doc, 'label', 'settings-field'); wrap.append(element(doc, 'span', 'settings-label', label)); const input = doc.createElement('input'); input.type = type; input.placeholder = placeholder; input.value = String(earthApiSettings[key]); input.dataset.earthApiSetting = key; if (key === 'apiBaseUrl') configureApiUrlInput(input); wrap.append(input); form.append(wrap); }
    const ratioField = element(doc, 'label', 'settings-field earth-time-ratio-field'); ratioField.append(element(doc, 'span', 'settings-label', '双界时间流速（地球 : 玄天界）'));
    const ratioSelect = doc.createElement('select'); ratioSelect.className = 'earth-time-ratio-select'; ratioSelect.dataset.earthApiSetting = 'timeRatio';
    for (const option of EARTH_TIME_RATIO_OPTIONS) { const node = element(doc, 'option', undefined, option.label); node.value = option.value; node.selected = option.value === earthApiSettings.timeRatio; ratioSelect.append(node); }
    ratioField.append(ratioSelect, element(doc, 'small', 'earth-time-ratio-note', earthTimeRatioNote(earthApiSettings.timeRatio)));
    const twoCol = element(doc, 'div', 'earth-sim-form-grid'); for (const [label, key] of [['温度', 'temperature'], ['超时（秒）', 'timeoutSeconds'], ['有效回复间隔', 'replyInterval'], ['失败后重试次数', 'retryCount'], ['单次最大世界日', 'maxWorldDays']] as const) { const wrap = element(doc, 'label', 'settings-field'); wrap.append(element(doc, 'span', 'settings-label', label)); const input = doc.createElement('input'); input.type = 'number'; input.min = key === 'retryCount' ? '0' : ''; input.max = key === 'retryCount' ? '2' : ''; input.value = String(earthApiSettings[key]); input.dataset.earthApiSetting = key; wrap.append(input); twoCol.append(wrap); }
    appendSimulationModelControls(form, 'earth');
    form.append(ratioField, twoCol, element(doc,'p','earth-sim-disabled-note',`每次地球推演通常请求 1 次；当前设置下最多请求 ${earthApiSettings.retryCount+1} 次。鉴权、配置、世界书前置条件或越权状态变更不会重试。`), button(doc, 'primary-button', '保存推演设置', 'earth-api-save'));
    const privacyNote = element(doc, 'p', 'earth-sim-disabled-note', '获取模型列表或手动推演时，会将填写的 URL 与 API 密钥发送给该服务。');
    const resetPanel = element(doc, 'section', 'earth-reset-panel');
    const resetCopy = element(doc, 'div', 'earth-reset-copy'); resetCopy.append(element(doc, 'strong', undefined, '重新开始地球推演'), element(doc, 'small', undefined, '清除当前聊天的日期、事件与势力进度；保留 API 设置和附属世界书。'));
    const resetButton = button(doc, 'earth-reset-button', '清空当前对话的地球推演', 'earth-simulation-clear');
    resetPanel.append(resetCopy, resetButton); content.append(form, privacyNote, resetPanel);
  }

  function renderConfigHelperSettings(content: HTMLElement): void {
    const helperPanel = element(doc, 'section', 'panel-card config-helper-settings-panel');
    helperPanel.append(element(doc, 'h3', undefined, '道渊配置小助手 V1.3.4'));
    const helperToggle = element(doc, 'label', 'settings-auto-toggle');
    const helperInput = doc.createElement('input'); helperInput.type = 'checkbox'; helperInput.checked = configHelperEnabled; helperInput.dataset.configHelperEnabled = 'true';
    const helperCopy = element(doc, 'span', 'settings-auto-toggle-copy');
    helperCopy.append(element(doc, 'strong', undefined, '显示配置小助手悬浮球'));
    helperToggle.append(helperInput, helperCopy);
    helperPanel.append(helperToggle, button(doc, 'primary-button settings-panel-save', '保存悬浮球显示设置', 'config-helper-save'));
    content.append(helperPanel);
  }

  function renderSettings(content: HTMLElement): void {
    if (settingsSection === 'pet') {
      content.append(button(doc, 'settings-back-button', '← 返回设置', 'settings-home'));
      appendPageHeading(doc, content, '小手机与鲸鱼娘', '调整小手机的收纳方式和鲸鱼娘尺寸，设置仅保存在当前浏览器。', '本地偏好');
      const displayPanel = appendPanel(doc, content, '小手机显示方式', '选择收纳到右侧边缘，或保持原来的悬浮显示方式。');
      const displayModeRow = element(doc, 'div', 'pet-size-options phone-display-mode-options');
      for (const entry of [{ value: 'drawer', label: '侧边抽屉', note: '点击外部自动缩回，桌面端移到右侧可展开' }, { value: 'floating', label: '自由浮窗', note: '可拖到屏幕任意位置，打开后保持显示' }] as const) {
        const label = element(doc, 'label', 'pet-size-option phone-display-mode-option');
        const input = doc.createElement('input'); input.type = 'radio'; input.name = 'daoyuan-phone-display-mode'; input.value = entry.value; input.checked = phoneDisplayMode === entry.value;
        input.addEventListener('change', () => { if (input.checked) { phoneDisplayMode = entry.value; sendAction('SET_PHONE_DISPLAY_MODE', { mode: entry.value }); announcement = `小手机已切换为${entry.label}。`; render(); } });
        label.append(input, element(doc, 'span', undefined, entry.label), element(doc, 'small', undefined, entry.note)); displayModeRow.append(label);
      }
      displayPanel.append(displayModeRow);
      const petPanel = appendPanel(doc, content, '鲸鱼娘设置', '选择鲸鱼娘的显示尺寸。');
      const petSizeRow = element(doc, 'div', 'pet-size-options');
      for (const entry of [{ value: 'small', label: '小', note: '最省空间' }, { value: 'medium', label: '中', note: '适中尺寸' }, { value: 'large', label: '大', note: '当前默认' }] as const) {
        const label = element(doc, 'label', 'pet-size-option'); const input = doc.createElement('input'); input.type = 'radio'; input.name = 'daoyuan-pet-size'; input.value = entry.value; input.checked = petSize === entry.value;
        input.addEventListener('change', () => { if (input.checked) { petSize = entry.value; sendAction('SET_PET_SIZE', { size: entry.value }); announcement = `桌宠已调整为${entry.label}号。`; render(); } });
        label.append(input, element(doc, 'span', undefined, entry.label), element(doc, 'small', undefined, entry.note)); petSizeRow.append(label);
      }
      petPanel.append(petSizeRow); return;
    }
    if (settingsSection === 'content-beautifier') {
      content.append(button(doc, 'settings-back-button', '← 返回设置', 'settings-home'));
      appendPageHeading(doc, content, '正文呈现', '分别管理正文美化与商店、任务票据的提示词和渲染。', '阅读显示');
      const bodyPanel = appendPanel(doc, content, '正文美化', '正常使用需要同时开启本组两个开关：提示词负责让模型输出可识别格式，渲染脚本负责显示美化结果。时间信息不强制生成。');
      for (const [key, title, note, checked] of [
        ['body-prompt', '提示词注入脚本', '要求正文使用唯一 <content> 边界，并用标准角色姓名标记对白。', contentAssistSettings.bodyPromptEnabled],
        ['body-renderer', '渲染脚本', '将 <content> 正文、角色对白与已有时间信息渲染为阅读界面。', contentBeautifierEnabled],
      ] as const) {
        const item = element(doc, 'label', 'settings-auto-toggle'); const control = doc.createElement('input'); control.type = 'checkbox'; control.checked = checked; control.dataset.contentAssist = key;
        const itemCopy = element(doc, 'span', 'settings-auto-toggle-copy'); itemCopy.append(element(doc, 'strong', undefined, title), element(doc, 'small', undefined, note)); item.append(control, itemCopy); bodyPanel.append(item);
      }
      const ticketPanel = appendPanel(doc, content, '商店 + 任务', '正常使用需要同时开启本组两个开关：提示词负责生成 ShopReceipt / QuestBoard，渲染脚本负责显示票据。不包含战斗系统。');
      for (const [key, title, note, checked] of [
        ['ticket-prompt', '提示词注入脚本', '出现可购买商品或可接任务时，要求模型输出对应结构化票据。', contentAssistSettings.ticketPromptEnabled],
        ['ticket-renderer', '渲染脚本', '渲染商店与任务票据；按钮只把购买或接取意图写入输入框。', contentAssistSettings.ticketRendererEnabled],
      ] as const) {
        const item = element(doc, 'label', 'settings-auto-toggle'); const control = doc.createElement('input'); control.type = 'checkbox'; control.checked = checked; control.dataset.contentAssist = key;
        const itemCopy = element(doc, 'span', 'settings-auto-toggle-copy'); itemCopy.append(element(doc, 'strong', undefined, title), element(doc, 'small', undefined, note)); item.append(control, itemCopy); ticketPanel.append(item);
      }
      ticketPanel.append(button(doc, 'primary-button settings-panel-save', '保存正文呈现设置', 'content-beautifier-save')); return;
    }
    if (settingsSection === 'config-helper') {
      content.append(button(doc, 'settings-back-button', '← 返回设置', 'settings-home'));
      appendPageHeading(doc, content, '道渊配置小助手', '独立管理配置小助手悬浮球的显示状态。', 'V1.3.4');
      renderConfigHelperSettings(content); return;
    }
    if (settingsSection === 'world') {
      content.append(button(doc, 'settings-back-button', '← 返回设置', 'settings-home'));
      appendPageHeading(doc, content, '世界推演设置', '在同一页面管理双界入口与两套独立 API；数据和接口不会互相混用。', '统一入口');
      const panel = appendPanel(doc, content, '推演功能开关', '关闭后对应入口将不可进入，重新开启即可继续使用原有数据。'); panel.classList.add('world-settings-section');
      for (const [key,title,note,checked] of [
        ['xuantian','启用玄天界推演','原版五域、势力与事件线。',worldSimulationFeatures.xuantianEnabled],
        ['earth','启用地球推演','地球附属世界书与独立推演服务。',worldSimulationFeatures.earthEnabled],
      ] as const) {
        const toggle=element(doc,'label','settings-auto-toggle'); const input=doc.createElement('input'); input.type='checkbox'; input.checked=checked; input.dataset.worldSimulationFeature=key;
        const copy=element(doc,'span','settings-auto-toggle-copy'); copy.append(element(doc,'strong',undefined,title),element(doc,'small',undefined,note)); toggle.append(input,copy); panel.append(toggle);
      }
      panel.append(button(doc,'primary-button settings-panel-save','保存推演开关','world-simulation-settings-save'));

      const appendApiFields = (target:HTMLElement, prefix:'xuantian'|'earth', settings:XuantianApiSettingsDraft|EarthApiSettingsDraft):void => {
        for (const [label,key,type,placeholder] of [['基础 URL','apiBaseUrl','url','https://api.example.com/v1'],['API 密钥','apiKey','password','仅保存在宿主本地设置'],['模型名称','apiModel','text','例如：推演专用模型']] as const) { const wrap=element(doc,'label','settings-field'); wrap.append(element(doc,'span','settings-label',label)); const input=doc.createElement('input'); input.type=type; input.placeholder=placeholder; input.value=String(settings[key]); if(prefix==='xuantian') input.dataset.xuantianApiSetting=key; else input.dataset.earthApiSetting=key; if(key==='apiBaseUrl') configureApiUrlInput(input); wrap.append(input); target.append(wrap); }
        appendSimulationModelControls(target, prefix);
        const twoCol=element(doc,'div','earth-sim-form-grid'); for(const [label,key] of [['温度','temperature'],['超时（秒）','timeoutSeconds'],['自动推进间隔（轮）','replyInterval'],['失败后重试次数','retryCount'],['单次最大世界日','maxWorldDays']] as const){const wrap=element(doc,'label','settings-field');wrap.append(element(doc,'span','settings-label',label));const input=doc.createElement('input');input.type='number';input.min=key==='retryCount'?'0':'';input.max=key==='retryCount'?'2':'';input.value=String(settings[key]);if(prefix==='xuantian')input.dataset.xuantianApiSetting=key;else input.dataset.earthApiSetting=key;wrap.append(input);twoCol.append(wrap);} target.append(twoCol,element(doc,'p','earth-sim-disabled-note',`每次通常请求 1 次；当前设置下单次${prefix==='xuantian'?'玄天界':'地球'}推演最多请求 ${settings.retryCount+1} 次。鉴权、配置、世界书前置条件或越权状态变更不会重试。`));
      };

      const xuantianPanel=appendPanel(doc,content,'玄天界推演 API','服务原版五域、势力与并行事件线；读取主世界书，状态写入当前聊天独立账本。'); xuantianPanel.classList.add('earth-sim-api-form','world-settings-section');
      const xuantianToggle=element(doc,'label','settings-auto-toggle'); const xuantianInput=doc.createElement('input'); xuantianInput.type='checkbox'; xuantianInput.checked=xuantianApiSettings.enabled; xuantianInput.dataset.xuantianApiSetting='enabled'; const xuantianCopy=element(doc,'span','settings-auto-toggle-copy'); xuantianCopy.append(element(doc,'strong',undefined,'启用玄天界推演 API'),element(doc,'small',undefined,'仅控制玄天界接口调用。')); xuantianToggle.append(xuantianInput,xuantianCopy); xuantianPanel.append(xuantianToggle); appendApiFields(xuantianPanel,'xuantian',xuantianApiSettings); xuantianPanel.append(button(doc,'primary-button','保存玄天界 API','xuantian-api-save'),element(doc,'p','world-clear-note','危险操作：只清空当前对话的玄天界势力、事件线、时间和正文注入。'),button(doc,'earth-reset-button','清空当前对话的玄天界推演','xuantian-simulation-clear'));

      const logPanel=appendPanel(doc,content,'玄天界推演故障日志',`当前聊天共 ${xuantianFaultLogs.length} 条；记录请求、重试、结构校验与提交结果，仅用于测试排障。`); logPanel.classList.add('world-settings-section');
      const logActions=element(doc,'div','xuantian-log-actions'); const clearLogs=button(doc,'danger-button','清空日志','xuantian-clear-logs'); clearLogs.disabled=!xuantianFaultLogs.length; logActions.append(button(doc,'secondary-button','复制全部日志','xuantian-copy-logs'),clearLogs); logPanel.append(logActions);
      const logList=element(doc,'div','xuantian-event-list'); for(const log of [...xuantianFaultLogs].reverse()){const item=element(doc,'article','xuantian-event-summary');item.append(element(doc,'span','xuantian-event-kind',log.level),element(doc,'strong',undefined,log.message),element(doc,'small',undefined,`${log.at} · 序列 ${log.sequence} · 请求 ${log.requestCount}${log.detail?` · ${log.detail}`:''}`));logList.append(item);} if(!xuantianFaultLogs.length)logList.append(element(doc,'p','xuantian-empty','暂无日志。完成一次推演后会记录结果；失败与重试会保留详细原因。')); logPanel.append(logList);

      const earthPanel=appendPanel(doc,content,'地球推演 API','服务地球附属世界书与独立演化，不读取玄天界 API 配置。'); earthPanel.classList.add('earth-sim-api-form','world-settings-section');
      const earthToggle=element(doc,'label','settings-auto-toggle'); const earthInput=doc.createElement('input'); earthInput.type='checkbox'; earthInput.checked=earthApiSettings.enabled; earthInput.dataset.earthApiSetting='enabled'; const earthCopy=element(doc,'span','settings-auto-toggle-copy'); earthCopy.append(element(doc,'strong',undefined,'启用地球推演 API'),element(doc,'small',undefined,'AI 提出变化并通过检查后才保存。')); earthToggle.append(earthInput,earthCopy); earthPanel.append(earthToggle); appendApiFields(earthPanel,'earth',earthApiSettings);
      const ratioField=element(doc,'label','settings-field'); ratioField.append(element(doc,'span','settings-label','双界时间流速（地球 : 玄天界）')); const ratioSelect=doc.createElement('select'); ratioSelect.className='earth-time-ratio-select'; ratioSelect.dataset.earthApiSetting='timeRatio'; for(const option of EARTH_TIME_RATIO_OPTIONS){const node=element(doc,'option',undefined,option.label);node.value=option.value;node.selected=option.value===earthApiSettings.timeRatio;ratioSelect.append(node);} ratioField.append(ratioSelect,element(doc,'small','earth-time-ratio-note',earthTimeRatioNote(earthApiSettings.timeRatio))); earthPanel.append(ratioField,button(doc,'primary-button','保存地球 API','earth-api-save'),element(doc,'p','world-clear-note','危险操作：只清空当前对话的地球区域、势力、事件、时间和正文注入。'),button(doc,'earth-reset-button','清空当前对话的地球推演','earth-simulation-clear'));
      return;
    }
    if (settingsSection === 'earth') { renderEarthApiSettings(content); return; }
    if (settingsSection === 'yujian') { renderYujianSettings(content); return; }
    if (settingsSection === 'beauty') {
      content.append(button(doc, 'settings-back-button', '← 返回 API 设置', 'settings-home'));
      appendPageHeading(doc, content, '绝色榜 API', '只服务榜单生成与群芳谱回帖，不与仙网内容混用。', '独立接口');
      renderBeautyApiSettings(content);
      return;
    }
    if (settingsSection === 'xianwang') {
      content.append(button(doc, 'settings-back-button', '← 返回 API 设置', 'settings-home'));
      appendPageHeading(doc, content, '仙网内容 API', '供仙网风闻、仙网论坛与天机日报共同使用。', '三应用共用');
      renderXianwangApiSettings(content);
      return;
    }
    if (settingsSection === 'wanbao') {
      content.append(button(doc, 'settings-back-button', '← 返回 API 设置', 'settings-home'));
      appendPageHeading(doc, content, '万宝商行设置', '设置独立生成 API、货单容量与灵石结构；交易仅写入允许字段。', 'V0.9 测试');
      const apiPanel = appendPanel(doc, content, '万宝商行独立 API', '启用后使用这里的接口生成货单；关闭后使用酒馆当前生成模型。');
      apiPanel.classList.add('wanbao-api-settings-panel');
      const enabledLabel = element(doc, 'label', 'settings-auto-toggle');
      const enabledInput = doc.createElement('input'); enabledInput.type = 'checkbox'; enabledInput.checked = wanbaoApiSettings.enabled; enabledInput.dataset.wanbaoApiEnabled = 'true';
      const enabledCopy = element(doc, 'span', 'settings-auto-toggle-copy'); enabledCopy.append(element(doc, 'strong', undefined, '启用独立 API'), element(doc, 'small', undefined, '关闭时无需填写以下配置。'));
      enabledLabel.append(enabledInput, enabledCopy); apiPanel.append(enabledLabel);
      for (const [label, key, type] of [['基础 URL（Endpoint）', 'apiBaseUrl', 'url'], ['API 密钥（API Key）', 'apiKey', 'password'], ['模型（Model）', 'apiModel', 'text']] as const) {
        const wrap = element(doc, 'label', 'settings-field'); wrap.append(element(doc, 'span', 'settings-label', label));
        const input = doc.createElement('input'); input.type = type; input.value = wanbaoApiSettings[key]; input.dataset.wanbaoApiSetting = key; if (key === 'apiBaseUrl') configureApiUrlInput(input); wrap.append(input); apiPanel.append(wrap);
      }
      const modelControls = element(doc, 'div', 'settings-control-group');
      const fetchButton = button(doc, 'secondary-button', fetchingWanbaoModels ? '获取中…' : '获取模型列表', 'wanbao-models-fetch'); fetchButton.disabled = fetchingWanbaoModels; modelControls.append(fetchButton);
      if (wanbaoModelOptions.length) {
        const select = doc.createElement('select'); select.dataset.wanbaoModelSelect = 'true'; select.append(element(doc, 'option', undefined, `请选择模型（共 ${wanbaoModelOptions.length} 个）`));
        for (const model of wanbaoModelOptions) { const option = element(doc, 'option', undefined, model); option.value = model; option.selected = model === wanbaoApiSettings.apiModel; select.append(option); } modelControls.append(select);
      }
      apiPanel.append(modelControls, button(doc, 'primary-button', '保存独立 API 设置', 'wanbao-api-save'));
      const injectionPanel = appendPanel(doc, content, '正文交易联动', '独立控制是否把最近的万宝楼成交事实注入后续正文；关闭不影响生成、估价或交易。');
      injectionPanel.classList.add('wanbao-injection-settings-panel');
      const injectionLabel = element(doc, 'label', 'settings-auto-toggle');
      const injectionInput = doc.createElement('input'); injectionInput.type = 'checkbox'; injectionInput.checked = wanbaoApiSettings.transactionInjectionEnabled; injectionInput.dataset.wanbaoInjectionEnabled = 'true';
      const injectionCopy = element(doc, 'span', 'settings-auto-toggle-copy'); injectionCopy.append(element(doc, 'strong', undefined, '注入万宝楼交易事实'), element(doc, 'small', undefined, '默认开启；每个聊天只注入最近成交记录。'));
      injectionLabel.append(injectionInput, injectionCopy);
      injectionPanel.append(injectionLabel, button(doc, 'primary-button', '保存正文注入设置', 'wanbao-injection-save'));
      const panel = appendPanel(doc, content, '货单更新规则', '后续 AI 货单接入会使用这些限制，避免一次生成过多或无限累积。');
      panel.classList.add('wanbao-rules-settings-panel');
      const field = (label: string, key: 'batchSize' | 'maxItems' | 'refreshInterval', min: number, max: number, note: string): void => {
        const wrap = element(doc, 'label', 'settings-field');
        wrap.append(element(doc, 'span', 'settings-label', label));
        const input = doc.createElement('input'); input.type = 'number'; input.min = String(min); input.max = String(max); input.value = String(wanbaoSettings[key]); input.dataset.wanbaoSetting = key;
        wrap.append(input, element(doc, 'small', 'settings-section-note', note)); panel.append(wrap);
      };
      const combatBatch = wanbaoSettings.itemDataMode === 'combat';
      field('每轮新增货品数量', 'batchSize', combatBatch ? 4 : 10, combatBatch ? 4 : 10, combatBatch ? '战斗版分两次各4件，合计8件，八境界各一件。' : '原版固定 10 件，覆盖炼气至大乘八个玄天界境界。');
      field('最多保留售卖货品', 'maxItems', 1, 60, '超过上限时只保留最新货品，不触碰玩家物品。');
      field('自动更新间隔（0 关闭）', 'refreshInterval', 0, 99, '按完成的 AI 正文楼层计数；达到间隔后自动生成新货单。');
      const modeWrap = element(doc, 'label', 'settings-field');
      modeWrap.append(element(doc, 'span', 'settings-label', '灵石结构'));
      const modeSelect = doc.createElement('select'); modeSelect.dataset.wanbaoCurrencyMode = 'true';
      for (const [value, label] of [['auto', '自动识别'], ['legacy-bag', '原版卡（储物袋同级）'], ['combat-separate', '战斗版（独立字段）']] as const) {
        const option = doc.createElement('option'); option.value = value; option.textContent = label; option.selected = wanbaoSettings.currencyMode === value; modeSelect.append(option);
      }
      modeWrap.append(modeSelect, element(doc, 'small', 'settings-section-note', '自动识别优先使用战斗版独立字段；识别不确定时可手动切换。'));
      panel.append(modeWrap);
      const itemModeWrap = element(doc, 'label', 'settings-field');
      itemModeWrap.append(element(doc, 'span', 'settings-label', '物品/功法结构'));
      const itemModeSelect = doc.createElement('select'); itemModeSelect.dataset.wanbaoItemMode = 'true';
      for (const [value, label] of [['legacy', '原版卡（描述+数量）'], ['combat', '战斗版（世界书定性字段）']] as const) {
        const option = doc.createElement('option'); option.value = value; option.textContent = label; option.selected = wanbaoSettings.itemDataMode === value; itemModeSelect.append(option);
      }
      itemModeWrap.append(itemModeSelect, element(doc, 'small', 'settings-section-note', '生成货品与购买写回均按此模式，只触碰储物袋和器物。'));
      panel.append(itemModeWrap);
      panel.append(element(doc, 'p', 'notice muted', '购买区与出售区使用不同数据源：购买读取 AI 货单，出售读取 stat_data.主角.储物袋 与 stat_data.主角.器物。'));
      panel.append(button(doc, 'primary-button', '保存万宝商行设置', 'wanbao-settings-save'));
      const debugPanel = appendPanel(doc, content, '万宝商行诊断日志', '仅保留最近 40 条，单条原始响应也会截断；可随时清空，不影响货单、交易或设置。');
      debugPanel.classList.add('wanbao-debug-settings-panel');
      debugPanel.append(button(doc, 'secondary-button', '清空诊断日志', 'wanbao-debug-clear'));
      content.append(element(doc, 'p', 'notice muted', '设置保存在当前浏览器本地，不会写入角色卡、聊天变量或 V0.8 正式文件。'));
      return;
    }
    if (settingsSection === 'injection') {
      content.append(button(doc, 'settings-back-button', '← 返回设置', 'settings-home'));
      appendPageHeading(doc, content, '主线注入', '选择哪些道渊信息可被后续剧情感知。所有模块默认关闭。', '按需启用');
      renderPromptInjectionSettings(content);
      return;
    }
    if (settingsSection === 'dlc') {
      content.append(button(doc, 'settings-back-button', '← 返回设置', 'settings-home'));
      appendPageHeading(doc, content, 'DLC 剧情拓展', '手动导入世界书与对应脚本；小手机不再内置或自动管理 DLC。', '手动导入');
      const importPanel = appendPanel(doc, content, '添加或更新 DLC', '填写 DLC 名称并选择世界书；脚本可不选。提交前会先校验两个文件。');
      importPanel.classList.add('content-package-panel');
      const targetField = element(doc, 'div', 'settings-field'); targetField.append(element(doc, 'span', 'settings-label', '操作目标'));
      const targetOptions = element(doc, 'div', 'user-dlc-choice-group');
      const createTarget = button(doc, `user-dlc-choice${selectedUserDlcId === null ? ' selected' : ''}`, '新建 DLC（生成新 ID）', 'user-dlc-target', ''); createTarget.setAttribute('aria-pressed', String(selectedUserDlcId === null)); targetOptions.append(createTarget);
      for (const dlc of userDlcs) { const selected = selectedUserDlcId === dlc.id; const option = button(doc, `user-dlc-choice${selected ? ' selected' : ''}`, `更新：${dlc.name}`, 'user-dlc-target', dlc.id); option.setAttribute('aria-pressed', String(selected)); targetOptions.append(option); }
      targetField.append(targetOptions); importPanel.append(targetField);
      const nameField = element(doc, 'label', 'settings-field'); nameField.append(element(doc, 'span', 'settings-label', 'DLC 名称（必填）'));
      const nameInput = doc.createElement('input'); nameInput.type = 'text'; nameInput.value = userDlcName; nameInput.placeholder = '例如：万年仇怨'; nameInput.dataset.userDlcName = 'true'; nameField.append(nameInput); importPanel.append(nameField);
      const addFile = (label: string, key: 'worldbook' | 'script', required: boolean, selected: boolean): void => {
        const field = element(doc, 'label', 'settings-field content-package-file'); field.append(element(doc, 'span', 'settings-label', `${label}${required ? '（必选）' : '（可选）'}`));
        const input = doc.createElement('input'); input.type = 'file'; input.accept = 'application/json,.json'; input.dataset.userDlcFile = key; input.className = 'content-package-file-native';
        const status = element(doc, 'span', 'content-package-file-status', selected ? '已选择 1 个文件' : '未选择任何文件'); status.dataset.userDlcFileStatus = key;
        const picker = element(doc, 'span', 'content-package-file-picker'); picker.append(element(doc, 'span', 'content-package-file-button', '选择文件'), status);
        field.append(input, picker); importPanel.append(field);
      };
      addFile('世界书 JSON', 'worldbook', true, Boolean(userDlcWorldbookDraft)); if (userDlcWorldbookDraft) { const summary = element(doc, 'p', 'notice', `世界书：${userDlcWorldbookDraft.name} · ${userDlcWorldbookDraft.count} 条`); summary.dataset.userDlcFileSummary = 'worldbook'; importPanel.append(summary); }
      addFile('脚本 JSON', 'script', false, Boolean(userDlcScriptDraft)); if (userDlcScriptDraft) { const summary = element(doc, 'p', 'notice muted', `脚本：${userDlcScriptDraft.name}`); summary.dataset.userDlcFileSummary = 'script'; importPanel.append(summary); }
      const modeField = element(doc, 'div', 'settings-field'); modeField.append(element(doc, 'span', 'settings-label', '同名世界书处理'));
      const modeOptions = element(doc, 'div', 'user-dlc-choice-group');
      for (const [value, label] of [['replace-matching', '更新同名条目并补新增条目'], ['safe-merge', '只补新增条目（保留同名正文）']] as const) { const selected = contentPackageMode === value; const option = button(doc, `user-dlc-choice${selected ? ' selected' : ''}`, label, 'user-dlc-mode', value); option.setAttribute('aria-pressed', String(selected)); modeOptions.append(option); }
      modeField.append(modeOptions); importPanel.append(modeField);
      const submit = button(doc, 'primary-button', selectedUserDlcId ? '更新所选 DLC' : '导入并新建 DLC', 'user-dlc-import'); submit.disabled = !userDlcName.trim() || !userDlcWorldbookDraft; importPanel.append(submit);
      const managedPanel = appendPanel(doc, content, '已导入 DLC', userDlcs.length ? '检测世界书存在与当前角色挂载状态；可修复挂载或移除登记。' : '尚未登记 DLC。');
      managedPanel.classList.add('user-dlc-manager-panel');
      for (const dlc of userDlcs) {
        const card = element(doc, 'article', 'user-dlc-card');
        const status = dlc.worldbookExists ? dlc.mounted ? '世界书已挂载' : '世界书存在但未挂载' : '世界书不存在';
        card.append(element(doc, 'strong', undefined, dlc.name), element(doc, 'small', 'user-dlc-id', `ID：${dlc.id}`), element(doc, 'small', undefined, `${dlc.worldbookName} · ${status}`), element(doc, 'small', undefined, dlc.scriptStored ? `脚本：${dlc.scriptName ?? '已导入'}${dlc.scriptActive ? ' · 本轮运行中' : dlc.scriptEnabled ? ' · 等待运行' : ' · 已关闭'}` : '未配置脚本'));
        const actions = element(doc, 'div', 'user-dlc-actions');
        actions.append(button(doc, 'secondary-button', '更新世界书/脚本', 'user-dlc-select-update', dlc.id));
        const repair = button(doc, 'secondary-button', dlc.mounted ? '重新检测挂载' : '修复挂载', 'user-dlc-repair', dlc.id); repair.disabled = !dlc.worldbookExists;
        actions.append(repair);
        if (dlc.scriptStored) actions.append(button(doc, 'secondary-button', '移除脚本', 'user-dlc-remove-script', dlc.id));
        actions.append(button(doc, 'danger-button', '移除 DLC', 'user-dlc-remove', dlc.id)); card.append(actions); managedPanel.append(card);
      }
      return;
    }
    content.append(button(doc, 'top-parent-back-button', '← 返回上一级', 'app', 'home'));
    appendPageHeading(doc, content, '设置', '生成服务彼此隔离；主线注入可按模块独立启用。', '独立配置');
    const grid = element(doc, 'div', 'settings-api-grid');
    const entries: Array<{ key: SettingsSection; icon: string; title: string; note: string; scope: string }> = [
      { key: 'yujian', icon: '⌁', title: '玉简传讯 API', note: '联系人传讯与角色回复', scope: '独立配置' },
      { key: 'beauty', icon: '✦', title: '绝色榜 API', note: '榜单生成与群芳谱回帖', scope: '独立配置' },
      { key: 'xianwang', icon: '◌', title: '仙网内容 API', note: '风闻、论坛与天机日报', scope: '三应用共用' },
      { key: 'wanbao', icon: '♢', title: '万宝商行设置', note: '货单数量与保留上限', scope: '本地偏好' },
      { key: 'injection', icon: '◇', title: '主线注入', note: '选择可影响后续剧情的模块', scope: '默认关闭' },
      { key: 'dlc', icon: '卷', title: 'DLC 剧情拓展', note: '成组导入、挂载检测与修复', scope: '用户管理' },
      { key: 'world', icon: '界', title: '世界推演设置', note: '双界启停、玄天界 API 与地球 API', scope: '统一入口' },
      { key: 'pet', icon: '宠', title: '小手机与鲸鱼娘', note: '侧边抽屉或自由浮窗，及鲸鱼娘尺寸', scope: '本地偏好' },
      { key: 'content-beautifier', icon: '阅', title: '正文美化', note: '正文阅读器扫描开关', scope: 'V26' },
      { key: 'config-helper', icon: '助', title: '道渊配置小助手', note: '悬浮球显示设置', scope: 'V1.3.4' },
    ];
    const switchable = new Set<SettingsSection>(['yujian','beauty','xianwang','wanbao','world']);
    for (const entry of entries) {
      const card = element(doc, 'article', `settings-api-card${switchable.has(entry.key) && !featureModuleFlags[entry.key as FeatureModuleKey] ? ' module-disabled' : ''}`);
      const open = button(doc, 'settings-api-card-open', '', 'settings-open', entry.key);
      open.append(
        element(doc, 'span', 'settings-api-icon', entry.icon),
        element(doc, 'span', 'settings-api-title', entry.title),
        element(doc, 'span', 'settings-api-note', entry.note),
        element(doc, 'span', 'settings-api-scope', entry.scope),
      );
      card.append(open);
      if (switchable.has(entry.key)) {
        const moduleKey = entry.key as FeatureModuleKey;
        const toggle = element(doc, 'label', 'module-master-toggle');
        const input = doc.createElement('input'); input.type='checkbox'; input.checked=featureModuleFlags[moduleKey]; input.dataset.featureModule=moduleKey;
        input.setAttribute('aria-label', `${entry.title}总开关`);
        toggle.append(input, element(doc,'span','module-master-toggle-track'), element(doc,'span','module-master-toggle-copy',input.checked ? '功能已开启' : '功能已关闭'));
        card.append(toggle);
      }
      grid.append(card);
    }
    content.append(grid);
    content.append(element(doc, 'p', 'notice muted', 'API 密钥仅保存在当前浏览器本地设置中，不写入聊天变量或模型提示词。'));
    const resetPanel = appendPanel(doc, content, '恢复出厂设置', '清空小手机全部配置和记录，包括各模块数据、联系人、聊天记录、推演账本、预设、自定义立绘及导入配置。不会删除酒馆角色卡、原始世界书或 MVU 世界数据。');
    resetPanel.classList.add('phone-factory-reset-panel');
    resetPanel.append(button(doc, 'earth-reset-button', '清空小手机所有配置与记录', 'phone-factory-reset'));
  }

  function renderPromptInjectionSettings(content: HTMLElement): void {
    const panel = appendPanel(doc, content, '可感知信息', '开启后，仅把当前聊天内最近的相关内容提供给剧情模型；关闭后该模块不会影响正文。');
    panel.classList.add('prompt-injection-settings-panel');
    const rows: Array<{ key: keyof PromptInjectionSettingsDraft; title: string; note: string }> = [
      { key: 'yujian', title: '玉简传讯', note: '作为主角与联系人的私下通信记录。' },
      { key: 'trends', title: '仙网风闻', note: '只作为未经证实的消息，不会直接认定为事实。' },
      { key: 'forum', title: '仙网论坛', note: '只作为修士观点与舆论，不代表客观事实。' },
      { key: 'news', title: '天机日报', note: '作为媒体报道与叙事，仍需由剧情核验。' },
    ];
    for (const row of rows) {
      const label = element(doc, 'label', 'injection-toggle-row');
      const input = doc.createElement('input');
      input.type = 'checkbox';
      input.checked = promptInjectionSettings[row.key];
      input.dataset.injectionSetting = row.key;
      const copy = element(doc, 'span', 'injection-toggle-copy');
      copy.append(element(doc, 'strong', undefined, row.title), element(doc, 'small', undefined, row.note));
      label.append(input, copy);
      panel.append(label);
    }
    panel.append(
      element(doc, 'p', 'notice muted', '系统会自动限制注入内容，只取近期信息；模块内的命令或提示文字不会被执行。'),
      button(doc, 'primary-button', '保存主线注入设置', 'prompt-injection-save'),
    );
  }

  function renderBeautyApiSettings(content: HTMLElement): void {
    const panel = appendPanel(doc, content, '绝色榜 API 配置', '这里的配置只用于绝色榜生成，与玉简 API、MVU 变量和玉简预设相互独立。');
    panel.classList.add('beauty-api-settings-panel');
    const field = (label: string, key: 'apiBaseUrl' | 'apiKey' | 'apiModel', type = 'text'): void => {
      const wrap = element(doc, 'label', 'settings-field');
      wrap.append(element(doc, 'span', 'settings-label', label));
      const input = doc.createElement('input'); input.type = key === 'apiBaseUrl' ? 'url' : type; input.value = beautyApiSettings[key]; input.dataset.beautySetting = key;
      if (key === 'apiBaseUrl') configureApiUrlInput(input);
      wrap.append(input); panel.append(wrap);
    };
    field('基础 URL（Endpoint）', 'apiBaseUrl');
    field('API 密钥（API Key）', 'apiKey', 'password');
    field('模型（Model）', 'apiModel');
    const autoToggle = element(doc, 'label', 'settings-auto-toggle');
    const autoInput = doc.createElement('input'); autoInput.type = 'checkbox'; autoInput.checked = beautyApiSettings.autoEnabled; autoInput.dataset.beautyAutoEnabled = 'true';
    const autoCopy = element(doc, 'span', 'settings-auto-toggle-copy');
    autoCopy.append(element(doc, 'strong', undefined, '启用绝色榜自动推演'), element(doc, 'small', undefined, '关闭后不再随 AI 正文层自动请求；手动推演仍可使用。'));
    autoToggle.append(autoInput, autoCopy); panel.append(autoToggle);
    const intervalWrap = element(doc, 'label', 'settings-field');
    intervalWrap.append(element(doc, 'span', 'settings-label', '自动更新间隔（0关闭，1为每层）'));
    const intervalInput = doc.createElement('input'); intervalInput.type = 'number'; intervalInput.min = '0'; intervalInput.max = '999'; intervalInput.value = String(beautyApiSettings.autoInterval); intervalInput.dataset.beautyInterval = 'true';
    intervalWrap.append(intervalInput); panel.append(intervalWrap);
    const modelControls = element(doc, 'div', 'settings-control-group');
    const fetchModelsButton = button(doc, 'secondary-button', fetchingBeautyModels ? '获取中…' : '获取模型列表', 'beauty-models-fetch');
    fetchModelsButton.disabled = fetchingBeautyModels;
    modelControls.append(fetchModelsButton);
    if (beautyModelOptions.length) {
      const modelSelect = doc.createElement('select');
      modelSelect.className = 'beauty-model-select';
      modelSelect.dataset.beautyModelSelect = 'true';
      modelSelect.setAttribute('aria-label', '绝色榜模型列表');
      modelSelect.append(element(doc, 'option', undefined, `请选择模型（共 ${beautyModelOptions.length} 个）`));
      beautyModelOptions.forEach(model => {
        const option = element(doc, 'option', undefined, model);
        option.value = model;
        option.selected = model === beautyApiSettings.apiModel;
        modelSelect.append(option);
      });
      modelControls.append(modelSelect);
    }
    panel.append(modelControls);
    panel.append(button(doc, 'primary-button', '保存绝色榜 API 设置', 'beauty-settings-save'));
  }

  function renderXianwangApiSettings(content: HTMLElement): void {
    const panel = appendPanel(doc, content, '仙网内容 API 配置', '这套配置只用于仙网风闻、仙网论坛和天机日报，与玉简传讯、绝色榜相互独立。');
    panel.classList.add('xianwang-api-settings-panel');
    const field = (label: string, key: keyof ApiSettingsDraft | 'playerAlias', type = 'text'): void => {
      const wrap = element(doc, 'label', 'settings-field');
      wrap.append(element(doc, 'span', 'settings-label', label));
      const input = doc.createElement('input'); input.type = key === 'apiBaseUrl' ? 'url' : type; input.value = xianwangApiSettings[key]; input.dataset.xianwangSetting = key;
      if (key === 'apiBaseUrl') configureApiUrlInput(input);
      if (key === 'playerAlias') { input.maxLength = 24; input.placeholder = '我'; input.setAttribute('autocomplete', 'nickname'); }
      wrap.append(input); panel.append(wrap);
    };
    field('玩家网名（论坛发言显示）', 'playerAlias');
    panel.append(element(doc, 'p', 'settings-section-note', '默认为“我”。修改后只影响新评论；旧评论保留发布时的网名。AI 会把该名称识别为玩家而非 NPC。'));
    field('基础 URL（Endpoint）', 'apiBaseUrl');
    field('API 密钥（API Key）', 'apiKey', 'password');
    field('模型（Model）', 'apiModel');
    const numericField = (label: string, key: XianwangNumberSetting, min: number, max: number): void => {
      const wrap = element(doc, 'label', 'settings-field');
      wrap.append(element(doc, 'span', 'settings-label', label));
      const input = doc.createElement('input'); input.type = 'number'; input.min = String(min); input.max = String(max); input.value = String(xianwangApiSettings[key]); input.dataset.xianwangNumberSetting = key;
      wrap.append(input); panel.append(wrap);
    };
    const autoToggle = (label: string, note: string, key: 'trendsAutoEnabled'|'forumAutoEnabled'|'newsAutoEnabled'): void => {
      const wrap = element(doc, 'label', 'settings-auto-toggle');
      const input = doc.createElement('input'); input.type = 'checkbox'; input.checked = xianwangApiSettings[key]; input.dataset.xianwangAutoSetting = key;
      const copy = element(doc, 'span', 'settings-auto-toggle-copy');
      copy.append(element(doc, 'strong', undefined, label), element(doc, 'small', undefined, note));
      wrap.append(input, copy); panel.append(wrap);
    };
    const featureToggle = (label:string, note:string, key:'decentralizedMode'|'autoAiReply'|'showHeat'|'showCommentPreview'|'jailbreakPrompt'):void => {
      const wrap=element(doc,'label','settings-auto-toggle'); const input=doc.createElement('input'); input.type='checkbox'; input.checked=xianwangApiSettings[key]; input.dataset.xianwangFeatureSetting=key;
      const copy=element(doc,'span','settings-auto-toggle-copy'); copy.append(element(doc,'strong',undefined,label),element(doc,'small',undefined,note)); wrap.append(input,copy); panel.append(wrap);
    };
    panel.append(element(doc,'h3','settings-subtitle','仙网互动与生成'));
    numericField('每帖生成评论数（0 为不生成）','generatedCommentCount',0,10);
    featureToggle('去中心化模式','开启后提示 AI 不要围绕主角生成内容。','decentralizedMode');
    featureToggle('自动 AI 回复','用户发表评论后，自动生成仙网道友回复。','autoAiReply');
    featureToggle('显示点赞数（热度）','显示 AI 生成的热度，并允许用户手动点赞。','showHeat');
    featureToggle('列表中显示评论预览','开启后帖子列表默认展开评论。','showCommentPreview');
    featureToggle('启用破甲提示词','在系统提示词末尾附加创作完整性指令。','jailbreakPrompt');
    panel.append(
      element(doc, 'h3', 'settings-subtitle', '仙网风闻'),
      element(doc, 'p', 'settings-section-note', '按 AI 正文层计数触发；每次生成数量会在设定的最少与最多条数之间随机取值。'),
    );
    autoToggle('启用仙网风闻自动推演', '关闭后停止自动请求；手动推演仍可使用。', 'trendsAutoEnabled');
    numericField('自动生成间隔（0关闭，1为每层）', 'autoInterval', 0, 999);
    numericField('每批最少生成条数', 'batchMin', 1, 8);
    numericField('每批最多生成条数', 'batchMax', 1, 8);
    numericField('最多保留 AI 风闻', 'maxPosts', 1, 500);
    panel.append(element(doc,'h3','settings-subtitle','仙网论坛'));
    autoToggle('启用仙网论坛自动推演', '关闭后停止自动请求；手动推演仍可使用。', 'forumAutoEnabled');
    numericField('论坛自动生成间隔（0关闭，1为每层）','forumAutoInterval',0,999);
    numericField('论坛每次生成帖子数','forumBatchSize',1,6);
    numericField('论坛最多保留帖子','forumMaxPosts',1,500);
    panel.append(element(doc,'h3','settings-subtitle','天机日报'));
    autoToggle('启用天机日报自动推演', '关闭后停止自动请求；手动推演仍可使用。', 'newsAutoEnabled');
    numericField('日报自动生成间隔（0关闭，1为每层）','newsAutoInterval',0,999);
    numericField('日报每次生成期数','newsBatchSize',1,3);
    numericField('日报最多保留期数','newsMaxPapers',1,200);
    const controls = element(doc, 'div', 'settings-control-group');
    const fetchButton = button(doc, 'secondary-button', fetchingXianwangModels ? '获取中…' : '获取模型列表', 'xianwang-models-fetch');
    fetchButton.disabled = fetchingXianwangModels;
    controls.append(fetchButton);
    if (xianwangModelOptions.length) {
      const select = doc.createElement('select');
      select.className = 'beauty-model-select';
      select.dataset.xianwangModelSelect = 'true';
      select.setAttribute('aria-label', '仙网内容模型列表');
      select.append(element(doc, 'option', undefined, `请选择模型（共 ${xianwangModelOptions.length} 个）`));
      xianwangModelOptions.forEach(model => {
        const option = element(doc, 'option', undefined, model);
        option.value = model;
        option.selected = model === xianwangApiSettings.apiModel;
        select.append(option);
      });
      controls.append(select);
    }
    panel.append(controls, button(doc, 'primary-button', '保存仙网内容 API 设置', 'xianwang-settings-save'));
  }

  function renderBeautyPortraitModal(content: HTMLElement): void {
    if (!beautyPortraitName) return;
    const name = beautyPortraitName;
    const overlay = element(doc, 'div', 'beauty-portrait-overlay');
    overlay.dataset.action = 'beauty-portrait-close';
    const modal = element(doc, 'section', 'beauty-portrait-modal');
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', `${name}的立绘`);
    const header = element(doc, 'header', 'beauty-portrait-head');
    header.append(element(doc, 'h2', undefined, `${name}的立绘`), button(doc, 'beauty-portrait-close', '×', 'beauty-portrait-close'));
    modal.append(header);
    const display = element(doc, 'div', 'beauty-portrait-display');
    let currentUrl = '';
    if (isCustomPortrait(name)) currentUrl = getPortraitUrl(name, '女');
    else if (beautyPortraitShowSpecial) currentUrl = getSpecialPortraitUrl(name) || getPortraitUrl(name, '女');
    else if (isFemalePreferred(name)) currentUrl = getFemalePortraitUrl(name) || getPortraitUrl(name, '女');
    else currentUrl = getPortraitUrl(name, '女');
    if (currentUrl) {
      const image = doc.createElement('img');
      image.src = currentUrl;
      image.alt = `${name}大图`;
      image.referrerPolicy = 'no-referrer';
      image.addEventListener('error', () => { display.replaceChildren(element(doc, 'span', 'beauty-portrait-error', '立绘加载失败')); });
      display.append(image);
    } else display.append(element(doc, 'span', 'beauty-portrait-error', '暂无立绘，可选择本地图片或粘贴图片 URL。'));
    modal.append(display);
    const source = element(doc, 'p', 'beauty-portrait-source', isCustomPortrait(name) ? '自定义立绘' : currentUrl ? (beautyPortraitShowSpecial ? '特殊立绘' : isFemalePreferred(name) ? '女版立绘' : '立绘库') : '未找到立绘');
    modal.append(source);

    const sets = getPortraitSets(name);
    if (!isCustomPortrait(name) && sets.length > 1) {
      const setRow = element(doc, 'div', 'beauty-portrait-set-row');
      sets.forEach((url, index) => {
        const item = button(doc, `beauty-portrait-set${!beautyPortraitShowSpecial && !isFemalePreferred(name) && index === getSelectedSetIndex(name) ? ' active' : ''}`, '', 'beauty-portrait-set', `${index}`);
        item.dataset.portraitName = name;
        const image = doc.createElement('img'); image.src = url; image.alt = `立绘${index + 1}`; image.loading = 'lazy'; image.referrerPolicy = 'no-referrer'; item.append(image);
        setRow.append(item);
      });
      modal.append(setRow);
    }
    const toggles = element(doc, 'div', 'beauty-portrait-toggles');
    if (!isCustomPortrait(name) && hasSpecialPortrait(name)) toggles.append(button(doc, `secondary-button${beautyPortraitShowSpecial ? ' active' : ''}`, beautyPortraitShowSpecial ? '当前：特殊立绘（点击切回）' : '查看特殊立绘', 'beauty-portrait-special'));
    if (!isCustomPortrait(name) && hasFemalePortrait(name) && getFemalePortraitUrl(name) !== getDefaultPortraitUrl(name)) toggles.append(button(doc, `secondary-button${isFemalePreferred(name) ? ' active' : ''}`, isFemalePreferred(name) ? '当前：女版立绘（点击切回）' : '切换到女版立绘', 'beauty-portrait-female'));
    if (toggles.childElementCount) modal.append(toggles);

    const custom = element(doc, 'div', 'beauty-portrait-custom');
    const fileLabel = element(doc, 'label', 'secondary-button', '选择本地图片');
    const file = doc.createElement('input'); file.type = 'file'; file.accept = 'image/*'; file.hidden = true; file.dataset.beautyPortraitFile = name; fileLabel.append(file);
    custom.append(fileLabel);
    const urlRow = element(doc, 'div', 'beauty-portrait-url-row');
    const urlInput = doc.createElement('input'); urlInput.placeholder = '或粘贴图片 URL'; urlInput.dataset.beautyPortraitUrl = name;
    urlRow.append(urlInput, button(doc, 'secondary-button', '应用', 'beauty-portrait-url'));
    custom.append(urlRow);
    if (isCustomPortrait(name)) custom.append(button(doc, 'secondary-button', '删除自定义立绘', 'beauty-portrait-remove'));
    modal.append(custom);
    overlay.append(modal);
    content.append(overlay);
  }

  const renderHome = (content: HTMLElement): void => {
    const hero = element(doc, 'section', 'hero');
    const heroCopy = element(doc, 'div');
    heroCopy.append(element(doc, 'h2', 'xianxia-title', '天机阁'));
    hero.append(heroCopy, element(doc, 'div', 'hero-seal', '天\n机'));
    content.append(hero);

    const timePlace = element(doc, 'section', 'time-place-widget');
    timePlace.setAttribute('aria-label', '当前时间与地点');
    const timeCell = element(doc, 'div', 'time-place-cell');
    timeCell.append(element(doc, 'span', 'time-place-label', '时间'), element(doc, 'strong', 'time-place-value centered-place-value', worldStatus.time));
    const placeCell = element(doc, 'div', 'time-place-cell');
    placeCell.append(element(doc, 'span', 'time-place-label', '地点'), element(doc, 'strong', 'time-place-value centered-place-value location-place-value', worldStatus.location));
    timePlace.append(timeCell, placeCell);
    content.append(timePlace);

    const grid = element(doc, 'div', 'app-grid');
    for (const item of apps) {
      const moduleKey = featureModuleForApp[item.key];
      if (moduleKey && !featureModuleFlags[moduleKey]) continue;
      const card = button(doc, 'app-card', '', 'app', item.key);
      card.append(element(doc, 'span', 'app-card-icon', item.icon), element(doc, 'div', 'app-card-title', item.label), element(doc, 'div', 'app-card-note', item.note));
      const badge=unreadBadge(item.key); if (badge > 0) card.append(element(doc, 'span', 'app-card-badge', String(badge)));
      grid.append(card);
    }
    content.append(grid);
  };

  const renderPage = (content: HTMLElement): void => {
    const definition = apps.find(item => item.key === active);
    const title = definition?.label ?? '天机阁随身玉简';
    if (active === 'settings') { renderSettings(content); return; }
    if (active === 'world') { renderWorldSimulationHub(content); return; }
    if (active === 'xuantian') { if (worldSimulationFeatures.xuantianEnabled) renderXuantianSimulation(content); else renderWorldSimulationHub(content); return; }
    if (active === 'earth') { if (worldSimulationFeatures.earthEnabled) renderEarthSimulation(content); else renderWorldSimulationHub(content); return; }
    if (active === 'yujian') {
      const availableContacts = worldContacts.length > 0 ? worldContacts : previewContacts;
      const selectedContact = availableContacts.find(contact => contact.name === selectedContactName);
      if (selectedContact) {
        const chatPage = element(doc, 'div', 'chat-page');
        const chatHeader = element(doc, 'div', 'chat-header');
        chatHeader.append(button(doc, 'chat-back-button', '← 联系人', 'chat-back'));
        const person = element(doc, 'div', 'chat-person');
        const avatar = element(doc, 'span', 'contact-avatar chat-avatar');
        avatar.dataset.tone = selectedContact.tone;
        avatar.append(element(doc, 'span', 'contact-avatar-fallback', selectedContact.avatar));
        if (selectedContact.portrait) {
          const portrait = doc.createElement('img');
          portrait.src = selectedContact.portrait;
          portrait.alt = `${selectedContact.name}立绘`;
          portrait.loading = 'lazy';
          portrait.referrerPolicy = 'no-referrer';
          portrait.addEventListener('error', () => { portrait.hidden = true; });
          avatar.append(portrait);
        }
        const personCopy = element(doc, 'span', 'chat-person-copy');
        personCopy.append(element(doc, 'span', 'chat-person-name', selectedContact.name));
        if (selectedContact.affection !== undefined) personCopy.append(element(doc, 'span', 'chat-affection', `♡ ${selectedContact.affectionLabel ?? '好感度'} ${selectedContact.affection}`));
        person.append(avatar, personCopy, element(doc, 'span', 'chat-person-detail', selectedContact.detail));
        const clearButton = button(doc, `chat-clear-button${clearChatArmedFor === selectedContact.name ? ' is-armed' : ''}`, clearChatArmedFor === selectedContact.name ? '确认清空' : '清空记录', 'chat-clear');
        clearButton.setAttribute('aria-label', clearChatArmedFor === selectedContact.name ? `确认清空与${selectedContact.name}的全部聊天记录` : `清空与${selectedContact.name}的全部聊天记录`);
        const deleteContactButton = button(doc, 'chat-delete-contact-button', '删除联系人', 'chat-contact-delete');
        deleteContactButton.setAttribute('aria-label', `删除联系人${selectedContact.name}`);
        const headerActions = element(doc, 'div', 'chat-header-actions');
        headerActions.append(clearButton, deleteContactButton);
        chatHeader.append(person, headerActions);
        chatPage.append(chatHeader);

        const messages = element(doc, 'div', 'chat-messages');
        const chatMessages = selectedContact.history ?? (previewChats[selectedContact.name] ?? []);
        chatMessages.forEach((message, index) => appendChatMessage(doc, messages, message, index, selectedContact.name));
        if (!chatMessages.length) messages.append(element(doc, 'p', 'chat-empty', '暂无聊天记录'));
        view.requestAnimationFrame(() => { messages.scrollTop = messages.scrollHeight; });
        chatPage.append(messages);

        const composer = element(doc, 'div', 'chat-composer');
        const input = doc.createElement('input');
        input.type = 'text';
        input.placeholder = '输入传讯内容';
        input.setAttribute('aria-label', '输入传讯内容');
        const sendButton = button(doc, 'chat-send-button', pendingSend ? '传讯中…' : '发送', 'chat-send');
        sendButton.disabled = pendingSend;
        composer.append(input, sendButton);
        chatPage.append(composer);
        content.append(chatPage);
        return;
      }
      content.append(button(doc, 'top-parent-back-button', '← 返回上一级', 'app', 'home'));
      appendPageHeading(doc, content, title, '联系人与最近传讯。选择一位道友，进入微信式聊天窗口。', `${availableContacts.length} 位联系人`);
      const toolbar = element(doc, 'div', 'contact-toolbar');
      const searchLabel = element(doc, 'label', 'contact-search');
      searchLabel.append(element(doc, 'span', 'sr-only', '搜索联系人'));
      const search = element(doc, 'input') as HTMLInputElement;
      search.type = 'search';
      search.placeholder = '搜索联系人';
      search.setAttribute('aria-label', '搜索联系人');
      search.dataset.contactSearch = 'true';
      search.value = contactFilter;
      searchLabel.append(search);
      toolbar.append(searchLabel, element(doc, 'span', 'contact-count', `${data.yujian.unread} 条未读`));
      content.append(toolbar);
      const contacts = worldContacts.length > 0 ? worldContacts : (data.yujian.contacts > 0 ? previewContacts : []);
      const recentContacts = contacts.filter(contact => Boolean(contact.history?.length));
      const recentList = element(doc, 'section', 'contact-list');
      recentList.append(element(doc, 'div', 'contact-section-label', `最近联系人 · ${recentContacts.length}`));
      recentContacts.forEach(contact => appendContact(doc, recentList, contact));
      if (!recentContacts.length) recentList.append(element(doc, 'p', 'contact-empty', '暂无最近联系人'));

      const allSection = element(doc, 'section', 'contact-list contact-all-section');
      const allToggle = button(doc, 'contact-section-toggle', '', 'contacts-toggle');
      allToggle.setAttribute('aria-expanded', String(allContactsExpanded));
      allToggle.append(
        element(doc, 'span', undefined, `所有联系人 · ${contacts.length}`),
        element(doc, 'span', 'contact-toggle-icon', allContactsExpanded ? '收起⌃' : '展开⌄'),
      );
      allSection.append(allToggle);
      const allPanel = element(doc, 'div', 'contact-all-panel');
      allPanel.dataset.allContactsPanel = 'true';
      allPanel.hidden = !allContactsExpanded;
      contacts.forEach(contact => appendContact(doc, allPanel, contact));
      if (!contacts.length) allPanel.append(element(doc, 'p', 'contact-empty', '暂无联系人'));
      allSection.append(allPanel);
      content.append(recentList, allSection, element(doc, 'p', 'notice muted contact-boundary', worldContacts.length > 0
        ? '见过一次的 NPC 会保留在独立通讯录；离场后联系人和聊天记录仍然存在。'
        : '当前没有已认识并建档的 NPC 联系人；不会用立绘库虚构陌生联系人。'));
      applyContactFilter();
      return;
    }
    if (active === 'beauty') {
      const plaque = element(doc, 'header', 'beauty-plaque');
      const plaqueImage = doc.createElement('img'); plaqueImage.src = beautyPlaqueUrl; plaqueImage.alt = '';
      plaque.append(plaqueImage, element(doc, 'h1', undefined, '绝色榜'));
      content.append(plaque);
      const list = element(doc, 'div', 'beauty-rank-list');
      beautyRanks.forEach(rank => appendBeautyRank(doc, list, {
        name: rank.name,
        portrait: rank.portrait ?? '',
        title: rank.title,
        rank: rank.rank,
        xianzi: rank.xianzi,
        qunfangpu: rank.qunfangpu,
      }, repliesForBeauty(rank.name), expandedBeautyForum === rank.name));
      content.append(beautyRanks.length ? list : element(doc, 'div', 'notice muted', '绝色榜尚待推演。'));
      const toolbar = element(doc, 'div', 'beauty-actions beauty-actions-bottom');
      const generateButton = button(doc, 'primary-button', beautyGenerating ? '推演中…' : '✦ 推演／更新绝色榜', 'beauty-generate');
      generateButton.disabled = beautyGenerating;
      const generationPanel = element(doc, 'section', 'beauty-action-panel');
      const beautyRemaining = beautyApiSettings.autoEnabled && beautyApiSettings.autoInterval > 0 ? Math.max(0, beautyApiSettings.autoInterval - beautyCounter) : null;
      generationPanel.append(element(doc, 'h3', undefined, '榜单推演'), generateButton, element(doc, 'span', 'xianwang-counter-line', beautyRemaining === null ? '自动绝色榜已关闭' : beautyRemaining === 0 ? '本轮将更新绝色榜' : `还有 ${beautyRemaining} 轮对话后更新绝色榜`));
      toolbar.append(generationPanel);
      content.append(toolbar);
      renderBeautyPortraitModal(content);
      return;
    }
    if (active === 'trends') {
      const trendsPage = element(doc, 'div', 'trends-page');
      const actions = element(doc, 'div', 'forum-action-bar');
      actions.append(button(doc, 'forum-parent-back-button', '← 返回上一级', 'app', 'home'));
      const generate = button(doc, 'forum-ai-button', trendsGenerating ? '推演中…' : '◌ 推演风闻', 'trends-generate');
      generate.disabled = trendsGenerating;
      actions.append(generate);
      const interval = xianwangApiSettings.autoInterval;
      const remaining = xianwangApiSettings.trendsAutoEnabled && interval > 0 ? Math.max(0, interval - xianwangCounters.trends) : null;
      actions.append(element(doc, 'span', 'xianwang-counter-line', remaining === null ? '自动风闻已关闭' : remaining === 0 ? '本轮将开始生成仙网风闻' : `还有 ${remaining} 轮对话后生成仙网风闻`));
      const posts = element(doc, 'div', 'forum-post-list');
      const visiblePosts = [...trendPosts].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
      visiblePosts.forEach((post, index) => {
        if ('storyTime' in post) {
          appendForumPost(doc, posts, { tag: post.type, title: post.title, excerpt: post.description, author: post.source, likes: post.heat, comments: post.comments.length, time: post.storyTime, replies: post.comments }, {
            key: post.id, expanded: xianwangApiSettings.showCommentPreview&&!collapsedForumComments.has(post.id), showHeat:xianwangApiSettings.showHeat, liked:post.liked, likeAction:'trend-like',
            deleteId: post.id,
            fullContent: true,
          });
        } else {
          const key = `trend-preview:${index}`;
          appendForumPost(doc, posts, post, { key, expanded: !collapsedForumComments.has(key) });
        }
      });
      if (!trendPosts.length) posts.append(element(doc, 'div', 'notice muted', '当前聊天暂无仙网风闻，可点击上方按钮推演。'));
      trendsPage.append(actions, posts, element(doc, 'p', 'notice muted trends-boundary', trendPosts.length
        ? `当前保存 ${trendPosts.length} 条仙网风闻；${data.webTrends.label}，不等同于世界事实。`
        : '仙网风闻只保存当前聊天数据，不使用预设内容。'));
      content.append(trendsPage);
      return;
    }
    if (active === 'wanbao') {
      content.append(button(doc, 'top-parent-back-button', '← 返回上一级', 'app', 'home'));
      appendPageHeading(doc, content, '万宝商行', 'AI 货单用于购买；我的物品读取储物袋与器物并用于出售。', 'V0.9 · 测试');

      const notice = element(doc, 'div', 'notice muted wanbao-preview-notice');
      notice.append(element(doc, 'strong', undefined, '真实数据模式'), element(doc, 'span', undefined, '交易只写入主角的储物袋、器物及四档灵石字段。'));
      content.append(notice);

      const balancePanel = element(doc, 'section', 'panel-card wanbao-balance-panel');
      const balanceHead = element(doc, 'div', 'wanbao-section-head');
      const modeLabel = spiritStones.mode === 'combat-separate' ? '战斗版结构' : spiritStones.mode === 'legacy-bag' ? '储物袋结构' : '候选识别';
      balanceHead.append(element(doc, 'div', undefined, '灵石余额'), element(doc, 'span', 'source-tag', `${modeLabel} · 实时同步`));
      balancePanel.append(balanceHead);
      const balanceGrid = element(doc, 'div', 'wanbao-balance-grid');
      wanbaoBalanceGrades.forEach(balance => {
        const card = element(doc, 'div', 'wanbao-balance-card');
        card.dataset.grade = balance.tone;
        const synced = spiritStones.balances?.find(item => item.grade === balance.label);
        const value = typeof synced?.quantity === 'number' ? synced.quantity.toLocaleString('zh-CN') : '—';
        card.append(element(doc, 'span', 'wanbao-balance-label', balance.label), element(doc, 'strong', 'wanbao-balance-value', value));
        balanceGrid.append(card);
      });
      balancePanel.append(balanceGrid);
      if (spiritStones.warning) balancePanel.append(element(doc, 'p', 'wanbao-currency-warning', spiritStones.warning));
      content.append(balancePanel);

      const tabs = element(doc, 'div', 'wanbao-tabs');
      const marketTab = button(doc, `wanbao-tab${wanbaoSection === 'market' ? ' active' : ''}`, '万宝货单', 'wanbao-section', 'market');
      marketTab.setAttribute('aria-selected', String(wanbaoSection === 'market'));
      const ownedTab = button(doc, `wanbao-tab${wanbaoSection === 'owned' ? ' active' : ''}`, '我的物品', 'wanbao-section', 'owned');
      ownedTab.setAttribute('aria-selected', String(wanbaoSection === 'owned'));
      tabs.append(marketTab, ownedTab);
      content.append(tabs);

      if (wanbaoSection === 'market') {
        const toolbar = element(doc, 'div', 'wanbao-toolbar');
        const toolbarCopy = element(doc, 'div', 'wanbao-toolbar-copy');
        const batchLabel = wanbaoSettings.itemDataMode === 'combat' ? '4×2（合计8）' : '10';
        toolbarCopy.append(element(doc, 'span', 'wanbao-toolbar-label', `万宝货单 · 本轮 ${batchLabel} 件`), element(doc, 'span', 'wanbao-toolbar-meta', wanbaoSettings.itemDataMode === 'combat' ? '战斗版分两次生成 · 仅可购买' : '覆盖各境界 · 仅可购买'));
        const generate = button(doc, 'primary-button wanbao-generate-button', '立即生成（测试）', 'wanbao-generate');
        toolbar.append(toolbarCopy, generate);
        content.append(toolbar);
        const merchantRemaining = wanbaoSettings.refreshInterval > 0 ? Math.max(0, wanbaoSettings.refreshInterval - merchantCounter) : null;
        content.append(element(doc, 'p', 'xianwang-counter-line wanbao-counter-line', merchantRemaining === null ? '自动货单更新已关闭' : merchantRemaining === 0 ? '本轮将更新万宝货单' : `还有 ${merchantRemaining} 轮对话后更新万宝货单`));
        if (merchantGenerationState.status === 'running') content.append(element(doc, 'p', 'notice muted wanbao-generation-running', '万宝货单正在后台生成；离开此页面不会取消任务，完成后重新进入即可查看。'));

        const products = element(doc, 'div', 'wanbao-product-grid');
        const visibleProducts = merchantProducts.map(item => ({ ...item, price: `${item.price} ${item.priceGrade}`, stockLabel: `库存 ${item.stock} 件`, stockCount: item.stock, id: item.id }));
        visibleProducts.forEach((product, productIndex) => {
        const card = element(doc, 'article', 'wanbao-product-card');
        const head = element(doc, 'div', 'wanbao-product-head');
        const title = element(doc, 'div', 'wanbao-product-title');
        title.append(element(doc, 'strong', undefined, product.name), element(doc, 'span', 'wanbao-product-grade', product.grade));
        head.append(title);
        card.append(head, element(doc, 'span', 'wanbao-product-category', product.category), element(doc, 'p', 'wanbao-product-description', product.description));
        if (product.itemDataMode === 'combat') {
          const combatData = product.战斗属性 ?? {};
          const combatSummary = ['类型', '等级', '本源', '品阶', '效果类型', '主维', '辅维', '祭炼度', '损耗度', '状态', '时效', '触发', '技能'].flatMap(key => {
            const value = combatData[key];
            if (value === undefined || value === null || value === '' || (Array.isArray(value) && !value.length)) return [];
            const display = Array.isArray(value)
              ? value.map(entry => typeof entry === 'object' && entry ? Object.entries(entry as Record<string, unknown>).map(([name, detail]) => `${name}=${String(detail)}`).join('，') : String(entry)).join('；')
              : typeof value === 'object' && value
                ? Object.entries(value as Record<string, unknown>).map(([name, detail]) => {
                  const detailText = typeof detail === 'object' && detail ? Object.entries(detail as Record<string, unknown>).map(([key, item]) => `${key}=${String(item)}`).join('，') : String(detail);
                  return `${name}=${detailText}`;
                }).join('；')
                : String(value);
            return [`${key}：${display}`];
          }).join(' · ');
          card.append(element(doc, 'p', 'wanbao-product-stats', `战斗属性：${combatSummary || '未填'}（五维数值由战斗脚本计算）`));
          const level = String(combatData.等级 ?? '').split('/')[0].trim();
          const requiredRealmByLevel: Record<string, string> = { 法器:'炼气', 法宝:'筑基', 古宝:'金丹', 通天灵宝:'元婴', 仿制灵宝:'元婴', 先天灵宝:'化神', 仙器胚:'合体', 仙器胚子:'合体', 伪仙器:'合体', 仙器:'大乘' };
          const realmOrder = ['炼气','筑基','金丹','元婴','化神','炼虚','合体','大乘'];
          const requiredRealm = requiredRealmByLevel[level];
          const currentIndex = realmOrder.findIndex(realm => protagonistRealm.includes(realm));
          const requiredIndex = realmOrder.indexOf(requiredRealm);
          if (requiredIndex >= 0 && currentIndex >= 0 && currentIndex < requiredIndex) {
            card.append(element(doc, 'p', 'notice muted wanbao-usability-note', `境界不足：需达到${requiredRealm}初期才计入五维；仍可提前购买并持有。`));
          }
        }
        const footer = element(doc, 'div', 'wanbao-product-footer');
        const price = element(doc, 'div', 'wanbao-product-price');
        price.append(element(doc, 'span', 'wanbao-product-price-label', '售价'), element(doc, 'strong', undefined, product.price));
        footer.append(price, element(doc, 'span', 'wanbao-product-stock', product.stockLabel));
        card.append(footer);
        const actions = element(doc, 'div', 'wanbao-product-actions');
        const source = merchantProducts[productIndex];
        const soldOut = product.stockCount <= 0;
        const buy = button(doc, 'primary-button', soldOut ? '售罄' : '购买', 'wanbao-buy', source.id);
        buy.disabled = soldOut;
        buy.setAttribute('aria-disabled', String(soldOut));
        actions.append(buy, button(doc, 'secondary-button', '移除', 'wanbao-product-delete', source.id));
        card.append(actions);
          products.append(card);
        });
        if (!visibleProducts.length) products.append(element(doc, 'div', 'notice muted', '当前没有真实货单，请点击“立即生成”。'));
        content.append(products);
      } else {
        const sellToolbar = element(doc, 'div', 'wanbao-toolbar wanbao-sell-toolbar');
        const sellToolbarCopy = element(doc, 'div', 'wanbao-toolbar-copy');
        sellToolbarCopy.append(element(doc, 'span', 'wanbao-toolbar-label', `我的物品 · 可出售 ${merchantSellItems.length} 件`), element(doc, 'span', 'wanbao-toolbar-meta', '一次请求参考灵石体系与完整在售货单'));
        const quotedCount = merchantSellItems.filter(item => item.quote).length;
        const estimateAll = button(doc, 'secondary-button wanbao-estimate-all-button', quotedCount ? '全部重新估价' : '全部估价', 'wanbao-estimate-all');
        estimateAll.disabled = merchantSellItems.length === 0;
        sellToolbar.append(sellToolbarCopy, estimateAll);
        content.append(sellToolbar);
        const appendSellSection = (category: '储物袋' | '器物'): void => {
          const section = element(doc, 'section', 'wanbao-sell-section');
          const sectionItems = merchantSellItems.filter(item => item.category === category).map(item => ({ name:item.name, quantity:String(item.quantity), description:item.description, estimate:item.quote ? `${item.quote.price} ${item.quote.priceGrade} / 件` : '尚未估价', reason:item.quote?.reason ?? '', id:item.id, quoted:Boolean(item.quote) }));
          section.append(element(doc, 'h3', 'wanbao-sell-section-title', `${category} · ${sectionItems.length} 件`));
          const sellGrid = element(doc, 'div', 'wanbao-product-grid wanbao-sell-grid');
          sectionItems.forEach(item => {
            const card = element(doc, 'article', 'wanbao-product-card wanbao-sell-card');
            const head = element(doc, 'div', 'wanbao-product-head');
            const title = element(doc, 'div', 'wanbao-product-title');
            title.append(element(doc, 'strong', undefined, item.name), element(doc, 'span', 'wanbao-product-grade', category));
            head.append(title);
            card.append(head, element(doc, 'span', 'wanbao-product-category', `持有 ${item.quantity}`), element(doc, 'p', 'wanbao-product-description', item.description));
            const footer = element(doc, 'div', 'wanbao-product-footer');
            footer.append(element(doc, 'div', 'wanbao-product-price', item.estimate), element(doc, 'span', 'wanbao-estimate-reason', item.reason || '请先执行全部估价'));
            card.append(footer);
            const actions = element(doc, 'div', 'wanbao-product-actions');
            if (item.quoted) actions.append(button(doc, 'primary-button', '出售', 'wanbao-sell', item.id));
            card.append(actions);
            sellGrid.append(card);
          });
          if (!sectionItems.length) sellGrid.append(element(doc, 'div', 'notice muted', `${category}中暂无可出售物品。`));
          section.append(sellGrid);
          content.append(section);
        };
        appendSellSection('储物袋');
        appendSellSection('器物');
      }

      const transactionSection = element(doc, 'section', 'wanbao-transaction-section');
      const transactionToolbar = element(doc, 'div', 'wanbao-transaction-toolbar');
      transactionToolbar.append(element(doc, 'h3', 'wanbao-sell-section-title', `交易记录 · ${merchantTransactions.length} 笔`));
      const clearTransactions = button(doc, 'secondary-button', '一键清除', 'wanbao-transactions-clear'); clearTransactions.disabled = merchantTransactions.length === 0;
      transactionToolbar.append(clearTransactions);
      transactionSection.append(transactionToolbar);
      const transactionList = element(doc, 'div', 'wanbao-transaction-list');
      [...merchantTransactions].reverse().forEach(transaction => {
        const row = element(doc, 'article', 'wanbao-transaction-row');
        const head = element(doc, 'div', 'wanbao-transaction-head');
        head.append(element(doc, 'strong', undefined, `${transaction.kind === 'buy' ? '买入' : '卖出'} · ${transaction.itemName}`), element(doc, 'span', undefined, transaction.storyTime || '时间不详'));
        row.append(head, element(doc, 'p', 'wanbao-transaction-description', transaction.description || '无物品描述'), element(doc, 'p', 'wanbao-transaction-price', `${transaction.quantity} 件 · ${transaction.amount} ${transaction.grade}`), button(doc, 'wanbao-transaction-delete', '删除', 'wanbao-transaction-delete', transaction.id));
        transactionList.append(row);
      });
      if (!merchantTransactions.length) transactionList.append(element(doc, 'div', 'notice muted', '当前聊天暂无万宝楼交易记录。'));
      transactionSection.append(transactionList);
      content.append(transactionSection);
      return;
    }
    if (active === 'inventory') {
      content.append(button(doc, 'top-parent-back-button', '← 返回上一级', 'app', 'home'));
      appendPageHeading(doc, content, '储物袋', '来自世界事实的只读视图。', 'stat_data · 只读');
      if (!capabilityAvailable) {
        content.append(element(doc, 'div', 'notice muted', '当前未接入世界数据。储物袋不会伪造为空，也不会由前端自管。'));
        return;
      }
      content.append(element(doc, 'div', 'notice muted', `已读取当前 MVU 楼层，共 ${inventoryItems.length} 件物品。此页仅展示，不会修改世界变量。`));
      if (inventoryItems.length) {
        const list = element(doc, 'div', 'inventory-list');
        inventoryItems.forEach(item => {
          const card = element(doc, 'article', 'inventory-item');
          const head = element(doc, 'div', 'inventory-item-head');
          head.append(element(doc, 'span', 'inventory-item-icon', '◇'), element(doc, 'span', 'inventory-item-name', item.name));
          if (item.quantity !== null) head.append(element(doc, 'span', 'inventory-item-quantity', `×${item.quantity}`));
          const meta = [item.category, item.status].filter(Boolean).join(' · ');
          card.append(head);
          if (meta) card.append(element(doc, 'div', 'inventory-item-meta', meta));
          if (item.description) card.append(element(doc, 'p', 'inventory-item-description', item.description));
          list.append(card);
        });
        content.append(list);
      } else {
        content.append(element(doc, 'div', 'inventory-empty', '储物袋空空如也。'));
      }
      const grid = element(doc, 'div', 'panel-grid');
      appendPanel(doc, grid, '动作边界', '使用、装备、服用、整理等动作仍需通过主输入交给主 AI/MVU 管线处理，本页不提供直接写回。');
      appendPanel(doc, grid, '数据来源', 'stat_data.主角.储物袋 · MVU通道 · 当前消息楼层');
      content.append(grid);
      return;
    }
    if (active === 'map') {
      content.append(button(doc, 'top-parent-back-button', '← 返回上一级', 'app', 'home'));
      const realm: MapRealm = data.map.selectedRealm === '仙界' ? '仙界' : '玄天界';
      const mapData = MAPS[realm];
      const selectedKey = normalizeMapNode(realm, data.map.selectedNode);
      const selected = mapData[selectedKey];
      const roleLocation = resolveWorldMapLocation(worldStatus.location);
      const mapHeading = element(doc, 'header', 'map-page-heading');
      mapHeading.append(element(doc, 'h1', undefined, `${realm}地图`), element(doc, 'span', 'source-tag', `查看：${selected.name}`));
      content.append(mapHeading);

      const locationStatus = element(doc, 'div', `map-location-status${roleLocation ? ' located' : ' unresolved'}`);
      locationStatus.append(element(doc, 'span', 'map-location-symbol', roleLocation ? '◆' : '◇'), element(doc, 'span', undefined,
        roleLocation ? `角色当前位置：${roleLocation.node.name}（${roleLocation.realm}）` : `角色当前位置：${capabilityAvailable ? '无法映射到现有节点' : '等待 MVU 通道'}`));
      if (roleLocation && roleLocation.realm !== realm) locationStatus.append(button(doc, 'map-location-jump', '查看', 'map-realm', roleLocation.realm));
      content.append(locationStatus);

      const tabs = element(doc, 'div', 'map-tabs');
      (['玄天界', '仙界'] as const).forEach(mapRealm => tabs.append(button(doc, `map-tab${realm === mapRealm ? ' active' : ''}`, mapRealm, 'map-realm', mapRealm)));
      if (realm === '玄天界') tabs.append(button(doc, 'map-fullimg-button', showMapImage ? '收起全图' : '查看玄天界全图', 'map-image-toggle'));
      content.append(tabs);

      if (realm === '玄天界' && showMapImage) {
        const imageWrap = element(doc, 'div', 'map-fullimg-wrap');
        if (mapImageFailed) imageWrap.append(element(doc, 'div', 'map-image-error', '地图图片加载失败，节点地图仍可正常使用。'));
        else {
          const image = element(doc, 'img', 'map-fullimg') as HTMLImageElement;
          image.src = 'https://free-img.400040.xyz/4/2026/05/17/6a09d0b65af1c.png';
          image.alt = '玄天界全图';
          image.dataset.action = 'map-image-zoom';
          image.addEventListener('error', () => { mapImageFailed = true; render(); }, { once: true });
          imageWrap.append(image);
        }
        content.append(imageWrap);
      }

      const map = element(doc, 'div', 'map-canvas');
      map.setAttribute('aria-label', `${realm}节点地图`);
      getConnections(mapData).forEach(([from, to]) => {
        const first = mapData[from]; const second = mapData[to];
        const dx = second.x - first.x; const dy = second.y - first.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx) * 180 / Math.PI;
        const line = element(doc, 'span', 'map-line');
        Object.assign(line.style, { left: `${first.x}%`, top: `${first.y}%`, width: `calc(${distance}% - 10px)`, transform: `rotate(${angle}deg)` });
        map.append(line);
      });
      Object.entries(mapData).forEach(([key, nodeData]) => {
        const roleIsHere = roleLocation?.realm === realm && roleLocation.nodeKey === key;
        const node = button(doc, `map-node node-${mapNodeClass(key)}${selectedKey === key ? ' active' : ''}${roleIsHere ? ' current-location' : ''}`, nodeData.name, 'map-node', key);
        Object.assign(node.style, { left: `${nodeData.x}%`, top: `${nodeData.y}%`, '--node-color': mapNodeColor(nodeData.color) });
        node.title = roleIsHere ? `${nodeData.name} · 角色当前位置` : nodeData.name;
        node.setAttribute('aria-label', roleIsHere ? `${nodeData.name}，角色当前位置` : nodeData.name);
        const children: HTMLElement[] = [element(doc, 'span', 'map-node-dot'), element(doc, 'span', 'map-node-label', nodeData.name)];
        if (roleIsHere) { const marker = element(doc, 'span', 'map-current-marker', '当前位置'); marker.setAttribute('aria-hidden', 'true'); children.push(marker); }
        node.replaceChildren(...children);
        node.setAttribute('aria-pressed', String(selectedKey === key));
        map.append(node);
      });
      content.append(map);

      const details = element(doc, 'section', 'map-details');
      Object.assign(details.style, { '--node-color': mapNodeColor(selected.color) });
      const detailHead = element(doc, 'header', 'map-detail-head');
      detailHead.append(element(doc, 'strong', 'map-detail-name', selected.name), element(doc, 'span', 'map-detail-realm', selected.realm));
      details.append(detailHead, element(doc, 'p', 'map-detail-description', selected.desc));
      if (selected.factions.length) {
        const factions = element(doc, 'div', 'map-factions');
        selected.factions.forEach((faction, index) => factions.append(button(doc, `map-faction tag-${faction.type}`, faction.name, 'map-faction', String(index))));
        details.append(factions);
      }
      content.append(details, element(doc, 'div', 'notice muted', `世界真实当前位置：${capabilityAvailable ? worldStatus.location : '当前未接入世界数据'}。查看节点不会改变真实位置。`));

      if (activeMapFaction) {
        const overlay = element(doc, 'div', 'map-modal-overlay'); overlay.dataset.action = 'map-faction-close';
        const dialog = element(doc, 'section', 'map-modal'); dialog.setAttribute('role', 'dialog'); dialog.setAttribute('aria-modal', 'true'); dialog.setAttribute('aria-label', `${activeMapFaction.name}详情`);
        const header = element(doc, 'header', 'map-modal-head');
        header.append(element(doc, 'strong', 'map-modal-title', `【${activeMapFaction.name}】`), button(doc, 'map-modal-close', '×', 'map-faction-close'));
        dialog.append(header);
        const portraits = mapFactionPortraits[activeMapFaction.name] ?? [];
        if (portraits.length) {
          const gallery = element(doc, 'div', 'map-faction-gallery');
          const image = element(doc, 'img', 'map-faction-portrait') as HTMLImageElement;
          image.src = portraits[Math.min(activeMapFactionPortrait, portraits.length - 1)];
          image.alt = `${activeMapFaction.name}宗门立绘 ${activeMapFactionPortrait + 1}`;
          gallery.append(image);
          const zoomButton = button(doc, 'map-faction-portrait-zoom', '查看大图', 'map-faction-portrait-zoom');
          zoomButton.setAttribute('aria-label', `查看${activeMapFaction.name}立绘大图`);
          gallery.append(zoomButton);
          if (portraits.length > 1) {
            const picker = element(doc, 'div', 'map-faction-portrait-picker');
            picker.setAttribute('aria-label', '选择宗门立绘');
            portraits.forEach((portrait, index) => {
              const choice = button(doc, `map-faction-portrait-choice${index === activeMapFactionPortrait ? ' active' : ''}`, '', 'map-faction-portrait', String(index));
              choice.setAttribute('aria-label', `查看第 ${index + 1} 张宗门立绘`);
              choice.setAttribute('aria-pressed', String(index === activeMapFactionPortrait));
              const thumb = element(doc, 'img') as HTMLImageElement;
              thumb.src = portrait;
              thumb.alt = '';
              choice.append(thumb);
              picker.append(choice);
            });
            gallery.append(picker);
          }
          dialog.append(gallery);
        }
        dialog.append(element(doc, 'div', 'map-modal-body', activeMapFaction.note || '暂无详细信息'));
        overlay.append(dialog); content.append(overlay);
        if (zoomMapFactionPortrait && portraits.length) {
          const imageOverlay = element(doc, 'div', 'map-faction-image-overlay');
          imageOverlay.dataset.action = 'map-faction-portrait-zoom-close';
          const fullImage = element(doc, 'img', 'map-faction-image-full') as HTMLImageElement;
          fullImage.src = portraits[Math.min(activeMapFactionPortrait, portraits.length - 1)];
          fullImage.alt = `${activeMapFaction.name}宗门立绘大图`;
          imageOverlay.append(fullImage, button(doc, 'map-faction-image-close', '×', 'map-faction-portrait-zoom-close'));
          content.append(imageOverlay);
        }
      }
      if (zoomMapImage && !mapImageFailed) {
        const overlay = element(doc, 'div', 'map-image-overlay'); overlay.dataset.action = 'map-image-close';
        const image = element(doc, 'img', 'map-image-zoomed') as HTMLImageElement; image.src = 'https://free-img.400040.xyz/4/2026/05/17/6a09d0b65af1c.png'; image.alt = '玄天界全图放大视图';
        overlay.append(image, button(doc, 'map-image-close', '×', 'map-image-close')); content.append(overlay);
      }
      return;
    }
    if (active === 'forum') {
      const forumPage = element(doc, 'div', 'forum-page');
      const selected=forumPosts.find(post=>post.id===selectedForumId);
      if(selected){
        const bar=element(doc,'div','news-detail-bar');bar.append(button(doc,'news-back-button','← 返回列表','forum-back'),button(doc,'news-delete-button','删除帖子','forum-delete',selected.id));forumPage.append(bar);
        appendForumPost(doc,forumPage,{tag:selected.tag,title:selected.title,excerpt:selected.content,author:selected.author,likes:selected.likes,comments:selected.comments.length,time:selected.storyTime,replies:selected.comments},{key:selected.id,expanded:!collapsedForumComments.has(selected.id),fullContent:true,showHeat:xianwangApiSettings.showHeat,liked:selected.liked,likeAction:'forum-like'});
        const composer=element(doc,'div','forum-reply-composer');const input=doc.createElement('textarea');input.placeholder=xianwangApiSettings.autoAiReply?'发表评论，仙网道友会自动回复…':'发表评论…';input.maxLength=3000;input.dataset.forumCommentInput=selected.id;const send=button(doc,'primary-button','发表评论','forum-comment-submit',selected.id);composer.append(input,send);forumPage.append(composer);content.append(forumPage);return;
      }
      const actions = element(doc, 'div', 'forum-action-bar');
      actions.append(button(doc, 'forum-parent-back-button', '← 返回上一级', 'app', 'home'), button(doc, 'forum-ai-button', forumGenerating?'推演中…':'◌ 推演论帖', 'forum-generate'));
      const forumRemaining = xianwangApiSettings.forumAutoEnabled && xianwangApiSettings.forumAutoInterval > 0
        ? Math.max(0, xianwangApiSettings.forumAutoInterval - xianwangCounters.forum) : null;
      actions.append(element(doc, 'span', 'xianwang-counter-line', forumRemaining === null ? '自动论坛已关闭' : forumRemaining === 0 ? '本轮将开始生成仙网论坛' : `还有 ${forumRemaining} 轮对话后生成仙网论坛`));
      forumPage.append(actions);
      const posts = element(doc, 'div', 'forum-post-list');
      [...forumPosts].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).forEach(post=>{const card=appendForumPost(doc,posts,{tag:post.tag,title:post.title,excerpt:post.content,author:post.author,likes:post.likes,comments:post.comments.length,time:post.storyTime,replies:post.comments.slice(0,2)},{key:post.id,expanded:xianwangApiSettings.showCommentPreview&&!collapsedForumComments.has(post.id),showHeat:xianwangApiSettings.showHeat,liked:post.liked,likeAction:'forum-like'});card.dataset.action='forum-open';card.dataset.key=post.id;card.tabIndex=0;});
      forumPage.append(posts, element(doc,'p','notice muted forum-boundary',forumPosts.length?`共 ${forumPosts.length} 个帖子 · 新帖置顶 · 点击帖子查看全文`:'暂无帖子，可点击上方按钮生成。'));
      content.append(forumPage);
      return;
    }
    if (active === 'news') {
      const news = newsPapers.find(item => item.id === selectedNewsId);
      if (!news) {
        const listPage = element(doc, 'div', 'news-list-page');
        const listBar = element(doc, 'div', 'forum-action-bar news-list-bar');
        listBar.append(button(doc, 'forum-parent-back-button', '← 返回上一级', 'app', 'home'), button(doc, 'forum-ai-button', newsGenerating?'推演中…':'◌ 推演日报', 'news-generate'));
        const newsRemaining = xianwangApiSettings.newsAutoEnabled && xianwangApiSettings.newsAutoInterval > 0
          ? Math.max(0, xianwangApiSettings.newsAutoInterval - xianwangCounters.news) : null;
        listBar.append(element(doc, 'span', 'xianwang-counter-line', newsRemaining === null ? '自动日报已关闭' : newsRemaining === 0 ? '本轮将开始生成天机日报' : `还有 ${newsRemaining} 轮对话后生成天机日报`));
        const paperList = element(doc, 'div', 'news-paper-list');
        for (const item of [...newsPapers].sort((a,b)=>b.createdAt.localeCompare(a.createdAt))) {
          const paper = button(doc, 'news-paper-card', '', 'news-open', item.id);
          const paperHead = element(doc, 'div', 'news-paper-head');
          paperHead.append(element(doc, 'h1', 'news-paper-title', item.title), element(doc, 'p', 'news-paper-issue', item.issue));
          const lead = element(doc, 'div', 'news-paper-lead');
          lead.append(element(doc, 'span', 'news-paper-section', '头条'), element(doc, 'strong', undefined, item.articles[0]?.title ?? '今日头条'));
          const snippets = element(doc, 'div', 'news-paper-snippets');
          item.articles.slice(1, 3).forEach(article => snippets.append(element(doc, 'span', undefined, `${article.tag}　${article.title}`)));
          const footer = element(doc, 'div', 'news-paper-footer');
          footer.append(element(doc, 'span', undefined, `主编：${item.editor}`)); if(xianwangApiSettings.showHeat){const like=button(doc,`news-paper-likes${item.liked?' is-liked':''}`,`♥ ${item.likes}`,'news-like',item.id);like.setAttribute('aria-pressed',String(item.liked===true));footer.append(like);}
          paper.append(paperHead, lead, snippets, footer);
          paperList.append(paper);
        }
        listPage.append(listBar, paperList, element(doc, 'p', 'notice muted news-boundary', newsPapers.length?`共 ${newsPapers.length} 期 · 最新一期置顶`:'暂无报纸，可点击上方按钮生成。'));
        content.append(listPage);
        return;
      }

      const detailPage = element(doc, 'div', 'news-detail-page');
      const detailBar = element(doc, 'div', 'news-detail-bar');
      detailBar.append(button(doc, 'news-back-button', '← 返回列表', 'news-back'), button(doc, 'news-delete-button', '删除报纸', 'news-delete', news.id));
      detailPage.append(detailBar);
      const masthead = element(doc, 'header', 'news-masthead');
      masthead.append(element(doc, 'h1', 'news-detail-title', news.title), element(doc, 'p', 'news-detail-meta', `${news.issue} · 主编：${news.editor}`));
      detailPage.append(masthead, element(doc, 'blockquote', 'news-intro', `“${news.editorNote}”`));
      const articleList = element(doc, 'div', 'news-article-list');
      news.articles.forEach(article => appendNewsArticle(doc, articleList, {tag:article.tag,source:article.source,title:article.title,body:article.content}));
      detailPage.append(articleList);
      const lettersHeader = element(doc, 'div', 'reader-letters-header');
      lettersHeader.append(element(doc, 'h2', undefined, `读者来信 (${news.letters.length})`));
      detailPage.append(lettersHeader);
      const letters = element(doc, 'div', 'reader-letter-list');
      news.letters.forEach(letter => appendReaderLetter(doc, letters, {author:letter.author,time:news.storyTime,body:letter.content}));
      detailPage.append(letters);
      content.append(detailPage);
      return;
    }
    content.append(button(doc, 'top-parent-back-button', '← 返回上一级', 'app', 'home'));
    appendPageHeading(doc, content, '运行诊断', '用于确认能力与生命周期，不输出密钥或私聊全文。', '阶段 0 / 1');
    const grid = element(doc, 'div', 'panel-grid');
    const matrix = appendPanel(doc, grid, '能力矩阵', '');
    const list = element(doc, 'ul', 'list');
    appendListItem(doc, list, '核心壳 / 自管应用', '不依赖 MVU', '可运行');
    appendListItem(doc, list, 'MVU 世界只读', '能力探测', capabilityAvailable ? '已发现' : '待接入');
    appendListItem(doc, list, '通用 stat_data 写入', '桥接白名单', '禁用');
    matrix.append(list, button(doc, 'primary-button', '重新探测', 'diagnostic'));
    appendPanel(doc, grid, '当前验收候选', '阶段 0 fixture、单例开合、跨布局切换、键盘可达、关闭与重开状态保留。');
    content.append(grid);
  };

  function render(): void {
    const previousScrollTop = root.querySelector<HTMLElement>('.content')?.scrollTop ?? 0;
    root.dataset.layout = layout;
    root.replaceChildren();
    const topbar = element(doc, 'header', 'topbar topbar-empty');
    topbar.setAttribute('aria-hidden', 'true');
    const spiritStatus = element(doc, 'div', 'phone-spirit-status');
    const signal = element(doc, 'div', 'spirit-signal');
    signal.setAttribute('aria-label', '灵力信号模拟动画');
    for (let index = 1; index <= 4; index += 1) signal.append(element(doc, 'span', `spirit-signal-bar spirit-signal-bar-${index}`));
    const rawEnergy = worldStatus.energy.trim();
    const ratioMatch = rawEnergy.match(/(-?\d+(?:\.\d+)?)\s*[/|]\s*(\d+(?:\.\d+)?)/);
    const numericMatch = rawEnergy.match(/-?\d+(?:\.\d+)?/);
    const energyPercent = ratioMatch
      ? Math.min(100, Math.max(0, Number(ratioMatch[1]) / Math.max(1, Number(ratioMatch[2])) * 100))
      : numericMatch ? Math.min(100, Math.max(0, Number(numericMatch[0]))) : 0;
    const energyKnown = Boolean(numericMatch) && rawEnergy !== '未知' && rawEnergy !== '未接入';
    const energy = element(doc, 'div', `spirit-battery${energyKnown ? energyPercent <= 20 ? ' low' : '' : ' unknown'}`);
    energy.setAttribute('aria-label', energyKnown ? `当前灵力 ${rawEnergy}` : '当前灵力未知');
    const batteryShell = element(doc, 'span', 'spirit-battery-shell');
    const batteryFill = element(doc, 'span', 'spirit-battery-fill');
    batteryFill.style.width = `${energyPercent}%`;
    batteryShell.append(batteryFill);
    energy.append(batteryShell);
    const realTime = element(doc, 'time', 'spirit-real-time', new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }));
    realTime.setAttribute('aria-label', '当前现实时间');
    spiritStatus.append(signal, realTime, energy);
    const workspace = element(doc, 'div', 'workspace');
    const sidebar = element(doc, 'aside', 'sidebar');
    sidebar.append(element(doc, 'div', 'sidebar-caption', '随身应用'));
    const nav = element(doc, 'nav', 'app-nav');
    const homeButton = button(doc, `app-nav-button${active === 'home' ? ' active' : ''}`, '', 'app', 'home');
    homeButton.append(element(doc, 'span', 'app-nav-icon', '⌂'), element(doc, 'span', 'app-nav-label', '玉简桌面'));
    nav.append(homeButton);
    for (const item of apps) {
      const moduleKey = featureModuleForApp[item.key];
      if (moduleKey && !featureModuleFlags[moduleKey]) continue;
      const navActive = active === item.key || (item.key === 'world' && (active === 'earth' || active === 'xuantian'));
      const navButton = button(doc, `app-nav-button${navActive ? ' active' : ''}`, '', 'app', item.key);
      navButton.append(element(doc, 'span', 'app-nav-icon', item.icon), element(doc, 'span', 'app-nav-label', item.label));
      const badge=unreadBadge(item.key); if (badge > 0) navButton.append(element(doc, 'span', 'app-nav-badge', String(badge)));
      nav.append(navButton);
    }
    sidebar.append(nav, element(doc, 'div', 'sidebar-footer', '数据主源：chat 变量\n世界事实：可选只读通道'));
    const content = element(doc, 'main', 'content');
    const inner = element(doc, 'div', 'content-inner');
    inner.append(spiritStatus);
    if (active === 'home') renderHome(inner); else renderPage(inner);
    if (announcement) inner.append(element(doc, 'p', 'notice', announcement));
    content.append(inner); workspace.append(sidebar, content);
    const mobile = element(doc, 'nav', 'mobile-nav');
    mobile.setAttribute('aria-label', '小手机主导航');
    mobile.append(
      button(doc, `mobile-nav-button${active === 'home' ? ' active' : ''}`, '⌂ 桌面', 'app', 'home'),
      button(doc, `mobile-nav-button${active === 'yujian' ? ' active' : ''}`, '⌁ 传讯', 'app', 'yujian'),
    );
    const worldLauncher = element(doc, 'div', `mobile-world-launcher${active === 'xuantian' || active === 'earth' ? ' active' : ''}${featureModuleFlags.world?'':' module-disabled'}`);
    const xuantianButton = button(doc, `mobile-world-half mobile-world-xuantian${active === 'xuantian' ? ' active' : ''}`, '', 'app', 'xuantian');
    xuantianButton.setAttribute('aria-label', '直接打开玄天界推演');
    xuantianButton.disabled=!featureModuleFlags.world;
    xuantianButton.append(element(doc, 'span', 'mobile-world-glyph', '玄'), element(doc, 'span', 'mobile-world-label', '玄天'));
    const earthButton = button(doc, `mobile-world-half mobile-world-earth${active === 'earth' ? ' active' : ''}`, '', 'app', 'earth');
    earthButton.setAttribute('aria-label', '直接打开地球推演');
    earthButton.disabled=!featureModuleFlags.world;
    earthButton.append(element(doc, 'span', 'mobile-world-glyph', '地'), element(doc, 'span', 'mobile-world-label', '地球'));
    worldLauncher.append(xuantianButton, earthButton);
    mobile.append(
      worldLauncher,
      button(doc, `mobile-nav-button${active === 'forum' ? ' active' : ''}`, '☷ 论坛', 'app', 'forum'),
      button(doc, `mobile-nav-button${active === 'settings' ? ' active' : ''}`, '⚙ 设置', 'app', 'settings'),
    );
    root.append(topbar, workspace, mobile);
    upgradeNativeSelects(doc, root);
    applyContactFilter();
    const restoreScroll = () => { const nextContent = root.querySelector<HTMLElement>('.content'); if (nextContent) nextContent.scrollTop = previousScrollTop; };
    restoreScroll();
    uiView.requestAnimationFrame(() => { restoreScroll(); uiView.requestAnimationFrame(restoreScroll); });
  }

  const onClick = (event: Event): void => {
    const target = event.target as HTMLElement | null;
    const actionNode = target?.closest<HTMLElement>('[data-action]');
    if (!actionNode) return;
    const action = actionNode.dataset.action;
    if (action === 'beauty-portrait-close' && actionNode.classList.contains('beauty-portrait-overlay') && target !== actionNode) return;
    if ((action === 'map-faction-close' || action === 'map-image-close') && (actionNode.classList.contains('map-modal-overlay') || actionNode.classList.contains('map-image-overlay')) && target !== actionNode) return;
    if (action === 'map-faction-portrait-zoom-close' && actionNode.classList.contains('map-faction-image-overlay') && target !== actionNode) return;
    if (action === 'app') {
      const next = actionNode.dataset.key as AppKey | undefined;
      const moduleKey = next ? featureModuleForApp[next] : undefined;
      if (moduleKey && !featureModuleFlags[moduleKey]) { announcement='该功能已在设置中关闭。';render();return; }
      if (next) { markAppRead(next); active = next; if (next === 'settings') settingsSection = 'home'; selectedNewsId = null; selectedContactName = null; announcement = ''; saveUiPreferences({ layoutMode: 'phone', lastApp: active }); sendAction('SET_ACTIVE_APP', { app: active }); render(); }
    } else if(action==='xuantian-force-region-toggle'){
      const region=actionNode.dataset.key??'';if(expandedXuantianForceRegions.has(region))expandedXuantianForceRegions.delete(region);else expandedXuantianForceRegions.add(region);render();
    } else if (action === 'world-sim-open') {
      const next = actionNode.dataset.key === 'earth' ? 'earth' : 'xuantian';
      const enabled = next === 'earth' ? worldSimulationFeatures.earthEnabled : worldSimulationFeatures.xuantianEnabled;
      if (enabled) { active = next; announcement = ''; render(); }
    } else if (action === 'wanbao-section') {
      wanbaoSection = actionNode.dataset.key === 'owned' ? 'owned' : 'market';
      render();
    } else if (action === 'map-realm') {
      const selectedRealm: MapRealm = actionNode.dataset.key === '仙界' ? '仙界' : '玄天界';
      const selectedNode = normalizeMapNode(selectedRealm, data.map.selectedNode);
      data = { ...data, map: { selectedRealm, selectedNode } };
      activeMapFaction = null; zoomMapImage = false;
      sendAction('SET_MAP_VIEW', { selectedRealm, selectedNode });
      render();
    } else if (action === 'map-node') {
      const selectedRealm: MapRealm = data.map.selectedRealm === '仙界' ? '仙界' : '玄天界';
      const selectedNode = normalizeMapNode(selectedRealm, actionNode.dataset.key ?? 'center');
      data = { ...data, map: { selectedRealm, selectedNode } };
      activeMapFaction = null;
      sendAction('SET_MAP_VIEW', { selectedRealm, selectedNode });
      render();
    } else if (action === 'map-faction') {
      const selectedRealm: MapRealm = data.map.selectedRealm === '仙界' ? '仙界' : '玄天界';
      const selected = MAPS[selectedRealm][normalizeMapNode(selectedRealm, data.map.selectedNode)];
      activeMapFaction = selected.factions[Number(actionNode.dataset.key)] ?? null;
      activeMapFactionPortrait = 0;
      zoomMapFactionPortrait = false;
      render();
      root.querySelector<HTMLButtonElement>('.map-modal-close')?.focus();
    } else if (action === 'map-faction-portrait') {
      activeMapFactionPortrait = Math.max(0, Number(actionNode.dataset.key) || 0);
      render();
    } else if (action === 'map-faction-portrait-zoom') {
      const portraits = activeMapFaction ? mapFactionPortraits[activeMapFaction.name] ?? [] : [];
      const portraitUrl = portraits[Math.min(activeMapFactionPortrait, Math.max(0, portraits.length - 1))] ?? '';
      if (!activeMapFaction || openMapFactionPortraitLarge(portraitUrl, activeMapFaction.name)) return;
      zoomMapFactionPortrait = true;
      render();
      root.querySelector<HTMLButtonElement>('.map-faction-image-close')?.focus();
    } else if (action === 'map-faction-portrait-zoom-close') {
      zoomMapFactionPortrait = false;
      render();
      root.querySelector<HTMLButtonElement>('.map-faction-portrait-zoom')?.focus();
    } else if (action === 'map-faction-close') {
      activeMapFaction = null; zoomMapFactionPortrait = false; render();
    } else if (action === 'map-image-toggle') {
      showMapImage = !showMapImage; zoomMapImage = false; render();
    } else if (action === 'map-image-zoom') {
      zoomMapImage = true; render(); root.querySelector<HTMLButtonElement>('.map-image-close')?.focus();
    } else if (action === 'map-image-close') {
      zoomMapImage = false; render();
    } else if (action === 'settings-open') {
      const next = actionNode.dataset.key as SettingsSection | undefined;
      if (next && next !== 'home') { active = 'settings'; settingsSection = next; announcement = ''; if (next === 'dlc') sendAction('REQUEST_USER_DLC_STATUS'); render(); }
    } else if (action === 'settings-home') {
      settingsSection = 'home'; announcement = ''; render();
    } else if (action === 'earth-sim-tab') {
      const next = actionNode.dataset.key as EarthSettingsTab | undefined;
      if (next) { earthSettingsTab = next; announcement = ''; render(); }
    } else if (action === 'xuantian-sim-tab') {
      const next = actionNode.dataset.key as XuantianSettingsTab | undefined;
      if (next) { xuantianSettingsTab = next; announcement = ''; render(); }
    } else if(action==='xuantian-copy-logs'){
      const exported=JSON.stringify({exportedAt:new Date().toISOString(),storyPlan:storyDirectorPlan,logs:xuantianFaultLogs},null,2);
      void copyTextWithFallback(root.ownerDocument,exported).then(ok=>{announcement=ok?`已复制 ${xuantianFaultLogs.length} 条玄天界故障日志。`:'自动复制被浏览器拦截；日志已保留在本页，可直接选中。';render();});
    } else if(action==='xuantian-clear-logs'){
      if(!xuantianFaultLogs.length)return;
      const confirmed=uiView.confirm('确认清空当前聊天的全部玄天界推演故障日志？此操作不会清除世界状态或剧情大纲。');
      if(!confirmed)return;
      announcement='正在清空当前聊天的玄天界推演故障日志…';render();sendAction('CLEAR_XUANTIAN_FAULT_LOGS');
    } else if (action === 'xuantian-region-select') {
      const next = actionNode.dataset.key;
      if (next) { selectedXuantianRegion = next; render(); }
    } else if (action === 'xuantian-simulation-run') {
      if(xuantianSimulationRunning)return;xuantianSimulationRunning=true;announcement='正在读取原版主世界书与最近五条可见 AI 回复…';render();sendAction('GENERATE_XUANTIAN_SIMULATION');
    } else if (action === 'earth-region-toggle') {
      const key = actionNode.dataset.key;
      if (key) {
        expandedEarthRegion = expandedEarthRegion === key ? null : key;
        render();
        root.querySelector<HTMLButtonElement>(`.earth-region-card[data-key="${key}"]`)?.focus();
      }
    } else if (action === 'earth-event-toggle') {
      const key = actionNode.dataset.key;
      if (key) {
        expandedEarthEvent = expandedEarthEvent === key ? null : key;
        render();
        root.querySelector<HTMLButtonElement>(`.earth-sim-event[data-key="${key}"]`)?.focus();
      }
    } else if (action === 'earth-worldbook-refresh') {
      sendAction('REQUEST_EARTH_WORLDBOOK_STATUS'); announcement = '正在重新读取地球附属世界书…'; render();
    } else if (action === 'earth-worldbook-install') {
      sendAction('INSTALL_EARTH_WORLDBOOK'); announcement = '正在从内置种子创建地球附属世界书…'; render();
    } else if (action === 'earth-worldbook-attach') {
      sendAction('ATTACH_EARTH_WORLDBOOK'); announcement = '正在挂载到当前角色并复读确认…'; render();
    } else if (action === 'earth-worldbook-repair') {
      sendAction('REPAIR_EARTH_WORLDBOOK'); announcement = '正在补回缺失条目，不覆盖用户修改…'; render();
    } else if (action === 'world-simulation-settings-save') {
      worldSimulationFeatures = {
        xuantianEnabled: root.querySelector<HTMLInputElement>('[data-world-simulation-feature="xuantian"]')?.checked === true,
        earthEnabled: root.querySelector<HTMLInputElement>('[data-world-simulation-feature="earth"]')?.checked === true,
      };
      sendAction('SAVE_WORLD_SIMULATION_FEATURES', worldSimulationFeatures);
      announcement = '正在保存世界推演开关…'; render();
    } else if (action === 'content-beautifier-save') {
      contentBeautifierEnabled = root.querySelector<HTMLInputElement>('[data-content-assist="body-renderer"]')?.checked === true;
      contentAssistSettings = {
        bodyPromptEnabled: root.querySelector<HTMLInputElement>('[data-content-assist="body-prompt"]')?.checked === true,
        ticketPromptEnabled: root.querySelector<HTMLInputElement>('[data-content-assist="ticket-prompt"]')?.checked === true,
        ticketRendererEnabled: root.querySelector<HTMLInputElement>('[data-content-assist="ticket-renderer"]')?.checked === true,
      };
      sendAction('SAVE_CONTENT_BEAUTIFIER_SETTINGS', { enabled: contentBeautifierEnabled, ...contentAssistSettings });
      announcement = '正在保存正文呈现设置…'; render();
    } else if (action === 'config-helper-save') {
      configHelperEnabled = root.querySelector<HTMLInputElement>('[data-config-helper-enabled]')?.checked === true;
      sendAction('SAVE_CONFIG_HELPER_SETTINGS', { enabled: configHelperEnabled });
      announcement = '正在保存配置小助手悬浮球显示设置…'; render();
    } else if (action === 'user-dlc-import' && userDlcWorldbookDraft) {
      sendAction('IMPORT_USER_DLC', { id: selectedUserDlcId, name: userDlcName.trim(), worldbook: userDlcWorldbookDraft.value, worldbookFileName: userDlcWorldbookDraft.fileName, script: userDlcScriptDraft?.value, scriptFileName: userDlcScriptDraft?.fileName, mode: contentPackageMode });
      actionNode.textContent = selectedUserDlcId ? '正在更新…' : '正在导入…'; (actionNode as HTMLButtonElement).disabled = true;
    } else if (action === 'user-dlc-target') {
      selectedUserDlcId = actionNode.dataset.key || null; const selected = userDlcs.find((item) => item.id === selectedUserDlcId); userDlcName = selected?.name ?? ''; userDlcWorldbookDraft = null; userDlcScriptDraft = null;
      root.querySelectorAll<HTMLElement>('[data-action="user-dlc-target"]').forEach((option) => { const active = (option.dataset.key || null) === selectedUserDlcId; option.classList.toggle('selected', active); option.setAttribute('aria-pressed', String(active)); });
      const nameInput = root.querySelector<HTMLInputElement>('[data-user-dlc-name]'); if (nameInput) nameInput.value = userDlcName;
      root.querySelectorAll<HTMLInputElement>('[data-user-dlc-file]').forEach((input) => { input.value = ''; }); root.querySelectorAll<HTMLElement>('[data-user-dlc-file-status]').forEach((status) => { status.textContent = '未选择任何文件'; }); root.querySelectorAll<HTMLElement>('[data-user-dlc-file-summary]').forEach((summary) => { summary.remove(); });
      const submit = root.querySelector<HTMLButtonElement>('[data-action="user-dlc-import"]'); if (submit) { submit.textContent = selectedUserDlcId ? '更新所选 DLC' : '导入并新建 DLC'; submit.disabled = true; }
    } else if (action === 'user-dlc-mode') {
      contentPackageMode = actionNode.dataset.key === 'safe-merge' ? 'safe-merge' : 'replace-matching'; root.querySelectorAll<HTMLElement>('[data-action="user-dlc-mode"]').forEach((option) => { const active = option.dataset.key === contentPackageMode; option.classList.toggle('selected', active); option.setAttribute('aria-pressed', String(active)); });
    } else if (action === 'user-dlc-select-update') {
      const selected = userDlcs.find((item) => item.id === actionNode.dataset.key); const targetButton = selected ? root.querySelector<HTMLElement>(`[data-action="user-dlc-target"][data-key="${selected.id}"]`) : null; targetButton?.click();
    } else if (action === 'user-dlc-repair') {
      sendAction('REPAIR_USER_DLC_MOUNT', { id: actionNode.dataset.key }); actionNode.textContent = '正在检测…'; (actionNode as HTMLButtonElement).disabled = true;
    } else if (action === 'user-dlc-remove-script') {
      sendAction('REMOVE_USER_DLC_SCRIPT', { id: actionNode.dataset.key }); actionNode.textContent = '正在移除…'; (actionNode as HTMLButtonElement).disabled = true;
    } else if (action === 'user-dlc-remove') {
      sendAction('REMOVE_USER_DLC', { id: actionNode.dataset.key }); actionNode.textContent = '正在移除…'; (actionNode as HTMLButtonElement).disabled = true;
    } else if (action === 'wanbao-settings-save') {
      const readNumber = (key: keyof WanbaoSettingsDraft, fallback: number): number => {
        const input = root.querySelector<HTMLInputElement>(`[data-wanbao-setting="${key}"]`);
        const value = Number(input?.value);
        return Number.isFinite(value) ? Math.floor(value) : fallback;
      };
        const selectedItemMode = root.querySelector<HTMLSelectElement>('[data-wanbao-item-mode]')?.value === 'combat' ? 'combat' : 'legacy';
        wanbaoSettings = {
          batchSize: selectedItemMode === 'combat' ? 4 : 10,
        maxItems: Math.max(1, Math.min(60, readNumber('maxItems', wanbaoSettings.maxItems))),
        refreshInterval: Math.max(0, Math.min(99, readNumber('refreshInterval', wanbaoSettings.refreshInterval))),
        currencyMode: (() => { const value = root.querySelector<HTMLSelectElement>('[data-wanbao-currency-mode]')?.value; return value === 'legacy-bag' || value === 'combat-separate' ? value : 'auto'; })(),
          itemDataMode: selectedItemMode,
      };
      try {
        const storage = uiView.parent !== uiView ? uiView.parent.localStorage : uiView.localStorage;
        storage.setItem('daoyuan_wanbao_settings_v1', JSON.stringify(wanbaoSettings));
      } catch { /* optional local preference */ }
      announcement = '万宝商行设置已保存（仅本地偏好，尚未触发生成）'; render();
    } else if (action === 'wanbao-debug-clear') {
      try {
        const storage = uiView.parent !== uiView ? uiView.parent.localStorage : uiView.localStorage;
        storage.removeItem('daoyuan_wanbao_debug_logs_v1');
        announcement = '万宝商行诊断日志已清空';
      } catch { announcement = '诊断日志清空失败'; }
      render();
    } else if (action === 'earth-faction-toggle') {
      const key = actionNode.dataset.key ?? '';
      expandedEarthFaction = expandedEarthFaction === key ? null : key;
      render();
    } else if (action === 'earth-faction-category-toggle') {
      const key = actionNode.dataset.key ?? '';
      if (expandedEarthFactionCategories.has(key)) expandedEarthFactionCategories.delete(key); else expandedEarthFactionCategories.add(key);
      render();
    } else if (action === 'wanbao-api-save') {
      root.querySelectorAll<HTMLInputElement>('[data-wanbao-api-setting]').forEach(node => { const key = node.dataset.wanbaoApiSetting as 'apiBaseUrl' | 'apiKey' | 'apiModel'; if (key) wanbaoApiSettings[key] = node.value; });
      wanbaoApiSettings.enabled = root.querySelector<HTMLInputElement>('[data-wanbao-api-enabled]')?.checked === true;
      wanbaoApiSettings.transactionInjectionEnabled = root.querySelector<HTMLInputElement>('[data-wanbao-injection-enabled]')?.checked !== false;
      sendAction('SAVE_WANBAO_API_SETTINGS', { ...wanbaoApiSettings });
      announcement = wanbaoApiSettings.enabled ? '万宝商行独立 API 已启用并保存' : '万宝商行将使用酒馆当前模型'; render();
    } else if (action === 'wanbao-injection-save') {
      wanbaoApiSettings.transactionInjectionEnabled = root.querySelector<HTMLInputElement>('[data-wanbao-injection-enabled]')?.checked !== false;
      sendAction('SAVE_WANBAO_API_SETTINGS', { ...wanbaoApiSettings });
      announcement = wanbaoApiSettings.transactionInjectionEnabled ? '万宝楼交易事实正文注入已启用' : '万宝楼交易事实正文注入已关闭'; render();
    } else if (action === 'wanbao-models-fetch') {
      root.querySelectorAll<HTMLInputElement>('[data-wanbao-api-setting]').forEach(node => { const key = node.dataset.wanbaoApiSetting as 'apiBaseUrl' | 'apiKey' | 'apiModel'; if (key) wanbaoApiSettings[key] = node.value; });
      if (fetchingWanbaoModels) return; fetchingWanbaoModels = true; announcement = '正在获取万宝商行模型列表…'; render();
      sendAction('REQUEST_WANBAO_MODELS', { apiBaseUrl: wanbaoApiSettings.apiBaseUrl, apiKey: wanbaoApiSettings.apiKey });
    } else if (action === 'wanbao-generate') {
      announcement = wanbaoSettings.itemDataMode === 'combat' ? '正在分两次生成万宝货品（每次4件，合计8件）…' : '正在生成 10 件万宝货品…';
      render();
      sendAction('GENERATE_WANBAO', { ...wanbaoSettings });
    } else if (action === 'wanbao-buy') {
      const product = merchantProducts.find(item => item.id === actionNode.dataset.key);
      if (!product || product.stock <= 0) return;
      announcement = `正在购买「${product.name}」…`;
      render();
      if (!uiView.confirm(`确认花费 ${product.price} ${product.priceGrade}购买「${product.name}」？`)) return;
      sendAction('BUY_WANBAO', { id: product.id, quantity: 1, currencyMode: wanbaoSettings.currencyMode });
    } else if (action === 'wanbao-product-delete') {
      const product = merchantProducts.find(item => item.id === actionNode.dataset.key);
      if (!product || !uiView.confirm(`确认从当前货单移除「${product.name}」？`)) return;
      sendAction('DELETE_WANBAO_PRODUCT', { id:product.id });
    } else if (action === 'wanbao-transaction-delete') {
      const transaction = merchantTransactions.find(item => item.id === actionNode.dataset.key);
      if (!transaction || !uiView.confirm(`确认删除「${transaction.itemName}」的这笔交易记录？`)) return;
      sendAction('DELETE_WANBAO_TRANSACTION', { id:transaction.id });
    } else if (action === 'wanbao-transactions-clear') {
      if (!merchantTransactions.length || !uiView.confirm('确认清除当前聊天的全部万宝楼交易记录？')) return;
      sendAction('CLEAR_WANBAO_TRANSACTIONS');
    } else if (action === 'wanbao-estimate-all') {
      if (!merchantSellItems.length) return;
      announcement = `正在一次性估价 ${merchantSellItems.length} 件物品…`; render();
      sendAction('ESTIMATE_WANBAO');
    } else if (action === 'wanbao-sell') {
      const item = merchantSellItems.find(entry => entry.id === actionNode.dataset.key);
      if (!item) return;
      announcement = `正在出售「${item.name}」…`;
      render();
      if (!item.quote) return;
      if (!uiView.confirm(`确认出售 1 件「${item.name}」，获得 ${item.quote.price} ${item.quote.priceGrade}？`)) return;
      sendAction('SELL_WANBAO', { id: item.id, quantity: 1, currencyMode: wanbaoSettings.currencyMode });
    } else if (action === 'chat-open') {
      selectedContactName = actionNode.dataset.key ?? null;
      announcement = '';
      render();
    } else if (action === 'chat-back') {
      selectedContactName = null;
      clearChatArmedFor = null;
      announcement = '';
      render();
    } else if (action === 'chat-message-delete') {
      if (!selectedContactName) return;
      sendAction('DELETE_YUJIAN_MESSAGE', {
        charName: selectedContactName,
        index: Number(actionNode.dataset.index),
        from: actionNode.dataset.from,
        text: actionNode.dataset.text,
        time: actionNode.dataset.time,
      });
      announcement = '正在删除这条消息…';
      render();
    } else if (action === 'chat-clear') {
      if (!selectedContactName) return;
      if (clearChatArmedFor !== selectedContactName) {
        clearChatArmedFor = selectedContactName;
        announcement = '再次点击“确认清空”将删除该联系人的全部聊天记录。';
        render();
        return;
      }
      const charName = selectedContactName;
      clearChatArmedFor = null;
      announcement = '正在清空聊天记录…';
      render();
      sendAction('CLEAR_YUJIAN_HISTORY', { charName });
    } else if (action === 'chat-contact-delete') {
      if (!selectedContactName) return;
      const charName = selectedContactName;
      if (!uiView.confirm(`确认删除联系人「${charName}」？\n\n该联系人的玉简聊天记录会一并删除；除非之后收到或发送新的玉简消息，否则不会重新出现在联系人列表。`)) return;
      announcement = `正在删除联系人「${charName}」…`;
      sendAction('DELETE_YUJIAN_CONTACT', { charName });
      render();
    } else if (action === 'contacts-toggle') {
      allContactsExpanded = !allContactsExpanded;
      render();
    } else if (action === 'chat-send') {
      const input = actionNode.parentElement?.querySelector<HTMLInputElement>('input');
      const text = input?.value.trim() ?? '';
      if (!selectedContactName || !text || pendingSend) return;
      pendingSend = true;
      announcement = '正在写入玉简并请求回复…';
      sendAction('SEND_YUJIAN_MESSAGE', { charName: selectedContactName, text });
      render();
    } else if (action === 'settings-save') {
      root.querySelectorAll<HTMLElement>('[data-setting]').forEach(node => {
        const key = node.dataset.setting as 'customPrompt'|'apiBaseUrl'|'apiKey'|'apiModel';
        if (key) yujianSettings[key] = (node as HTMLInputElement).value;
      });
      yujianSettings.storyParseEnabled = root.querySelector<HTMLInputElement>('[data-yujian-story-parse]')?.checked ?? yujianSettings.storyParseEnabled;
      const selected = new Set(Array.from(root.querySelectorAll<HTMLInputElement>('[data-lore-uid]:checked')).map(node => node.dataset.loreUid).filter((uid): uid is string => Boolean(uid)));
      loreSelected = loreEntries.filter(entry => selected.has(entry.uid)).map(entry => ({ uid: entry.uid, content: entry.content }));
      sendAction('SAVE_YUJIAN_SETTINGS', { ...yujianSettings, loreSelected });
      announcement = '玉简设定已保存'; render();
    } else if (action === 'phone-factory-reset') {
      if (!uiView.confirm('确定清空整个小手机的所有配置与记录吗？\n\n此操作不可撤销，将删除联系人、玉简聊天、仙网内容、绝色榜、万宝记录、推演账本、API 配置、预设、自定义立绘及导入配置。\n\n不会删除酒馆角色卡、原始世界书或 MVU 世界数据。')) return;
      announcement = '正在恢复小手机出厂状态…';
      render();
      sendAction('FACTORY_RESET_PHONE');
    } else if (action === 'yujian-history-import') {
      if (importingStatusHistory) return;
      importingStatusHistory = true;
      announcement = '正在读取当前聊天的状态栏玉简记录…';
      render();
      sendAction('IMPORT_STATUS_YUJIAN_HISTORY');
    } else if (action === 'models-fetch') {
      root.querySelectorAll<HTMLElement>('[data-setting]').forEach(node => {
        const key = node.dataset.setting as 'customPrompt'|'apiBaseUrl'|'apiKey'|'apiModel';
        if (key) yujianSettings[key] = (node as HTMLInputElement).value;
      });
      if (fetchingModels) return;
      fetchingModels = true;
      announcement = '正在获取模型列表…';
      render();
      sendAction('REQUEST_YUJIAN_MODELS', { apiBaseUrl: yujianSettings.apiBaseUrl, apiKey: yujianSettings.apiKey });
    } else if (action === 'xuantian-models-fetch') {
      root.querySelectorAll<HTMLInputElement>('[data-xuantian-api-setting]').forEach(node=>{const key=node.dataset.xuantianApiSetting;if(key==='enabled')xuantianApiSettings.enabled=node.checked;else if(key==='apiBaseUrl'||key==='apiKey'||key==='apiModel')xuantianApiSettings[key]=node.value;else if(key==='temperature'||key==='timeoutSeconds'||key==='replyInterval'||key==='retryCount'||key==='maxWorldDays')xuantianApiSettings[key]=Number(node.value);});if(fetchingXuantianModels)return;fetchingXuantianModels=true;announcement='正在获取玄天界推演模型列表…';render();sendAction('REQUEST_XUANTIAN_MODELS',{apiBaseUrl:xuantianApiSettings.apiBaseUrl,apiKey:xuantianApiSettings.apiKey});
    } else if (action === 'xuantian-api-save') {
      root.querySelectorAll<HTMLInputElement>('[data-xuantian-api-setting]').forEach(node => {
        const key=node.dataset.xuantianApiSetting;
        if(key==='enabled') xuantianApiSettings.enabled=node.checked;
        else if(key==='apiBaseUrl'||key==='apiKey'||key==='apiModel') xuantianApiSettings[key]=node.value;
        else if(key==='temperature'||key==='timeoutSeconds'||key==='replyInterval'||key==='retryCount'||key==='maxWorldDays') xuantianApiSettings[key]=Number(node.value);
      });
      sendAction('SAVE_XUANTIAN_SETTINGS',{...xuantianApiSettings});announcement='正在保存玄天界推演 API 设置…';render();
    } else if (action === 'earth-models-fetch') {
      root.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-earth-api-setting]').forEach(node => {
        const key = node.dataset.earthApiSetting;
        if (key === 'enabled' && node.type === 'checkbox') earthApiSettings.enabled = node.checked;
        else if (key === 'apiBaseUrl' || key === 'apiKey' || key === 'apiModel') earthApiSettings[key] = node.value;
        else if (key === 'temperature' || key === 'timeoutSeconds' || key === 'replyInterval' || key === 'retryCount' || key === 'maxWorldDays') earthApiSettings[key] = Number(node.value);
        else if (key === 'timeRatio') earthApiSettings.timeRatio = node.value as EarthTimeRatio;
      });
      if (fetchingEarthModels) return;
      fetchingEarthModels = true;
      announcement = '正在获取地球推演模型列表…';
      render();
      sendAction('REQUEST_EARTH_MODELS', { apiBaseUrl: earthApiSettings.apiBaseUrl, apiKey: earthApiSettings.apiKey });
    } else if (action === 'earth-simulation-run') {
      if (earthSimulationRunning) return;
      earthSimulationRunning = true;
      announcement = '正在读取已挂载世界书与最近 5 条 AI 回复…';
      render();
      sendAction('GENERATE_EARTH_SIMULATION');
    } else if (action === 'earth-api-save') {
      root.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-earth-api-setting]').forEach(node => {
        const key = node.dataset.earthApiSetting;
        if (key === 'enabled' && node.type === 'checkbox') earthApiSettings.enabled = node.checked;
        else if (key === 'apiBaseUrl' || key === 'apiKey' || key === 'apiModel') earthApiSettings[key] = node.value;
        else if (key === 'temperature' || key === 'timeoutSeconds' || key === 'replyInterval' || key === 'retryCount' || key === 'maxWorldDays') earthApiSettings[key] = Number(node.value);
        else if (key === 'timeRatio') earthApiSettings.timeRatio = node.value as EarthTimeRatio;
      });
      sendAction('SAVE_EARTH_SETTINGS', { ...earthApiSettings });
      announcement = '正在保存地球推演设置…'; render();
    } else if(action==='earth-simulation-clear'){
      if(!uiView.confirm('确定清空当前对话的地球推演吗？\n\n只会删除本对话的地球账本、事件、势力变化、时间和正文注入；玄天界及其他对话不受影响。'))return;
      announcement='正在清空当前对话的地球推演…';render();sendAction('CLEAR_EARTH_SIMULATION');
    } else if(action==='xuantian-simulation-clear'){
      if(!uiView.confirm('确定清空当前对话的玄天界推演吗？\n\n只会删除本对话的玄天界账本、事件线、势力变化、时间和正文注入；地球及其他对话不受影响。'))return;
      announcement='正在清空当前对话的玄天界推演…';render();sendAction('CLEAR_XUANTIAN_SIMULATION');
    } else if (action === 'beauty-api-toggle-settings') {
      beautyApiSettingsOpen = !beautyApiSettingsOpen;
      render();
    } else if (action === 'beauty-portrait-open') {
      beautyPortraitName = actionNode.dataset.key ?? null;
      beautyPortraitShowSpecial = false;
      render();
    } else if (action === 'beauty-portrait-close') {
      beautyPortraitName = null;
      render();
    } else if (action === 'beauty-portrait-set') {
      if (!beautyPortraitName) return;
      const index = Number(actionNode.dataset.key);
      if (Number.isInteger(index)) {
        setSelectedSetIndex(beautyPortraitName, index);
        setFemalePortrait(beautyPortraitName, false);
        beautyPortraitShowSpecial = false;
        render();
      }
    } else if (action === 'beauty-portrait-special') {
      beautyPortraitShowSpecial = !beautyPortraitShowSpecial;
      render();
    } else if (action === 'beauty-portrait-female') {
      if (!beautyPortraitName) return;
      setFemalePortrait(beautyPortraitName, !isFemalePreferred(beautyPortraitName));
      beautyPortraitShowSpecial = false;
      render();
    } else if (action === 'beauty-portrait-url') {
      if (!beautyPortraitName) return;
      const input = root.querySelector<HTMLInputElement>('[data-beauty-portrait-url]');
      const url = input?.value.trim() ?? '';
      if (!url) return;
      setCustomPortrait(beautyPortraitName, url);
      announcement = '自定义立绘已应用';
      render();
    } else if (action === 'beauty-portrait-remove') {
      if (!beautyPortraitName || !view.confirm('删除自定义立绘，恢复立绘库图片？')) return;
      removeCustomPortrait(beautyPortraitName);
      announcement = '已恢复立绘库图片';
      render();
    } else if (action === 'beauty-generate') {
      if (beautyGenerating) return;
      beautyGenerating = true;
      announcement = '正在发送绝色榜提示词并等待 AI 返回…';
      render();
      sendAction('GENERATE_BEAUTY_RANK');
    } else if (action === 'beauty-rank-forum-toggle') {
      expandedBeautyForum = expandedBeautyForum === actionNode.dataset.key ? null : actionNode.dataset.key ?? null;
      render();
    } else if (action === 'beauty-rank-reply-send') {
      const name = actionNode.dataset.key ?? '';
      const input = root.querySelector<HTMLTextAreaElement>(`[data-beauty-reply-input="${CSS.escape(name)}"]`);
      const content = input?.value.trim() ?? '';
      if (!name || !content || beautyReplySending) return;
      const floor = repliesForBeauty(name).length + 1;
      beautyReplies = [...beautyReplies, { id: replyId(), name, content, floor, time: replyNow(), likes: 0, liked: false }];
      beautyReplySending = true;
      sendAction('GENERATE_BEAUTY_REPLY', { name, content, history: repliesForBeauty(name).map(reply => reply.content) });
      saveBeautyReplies();
      announcement = `已发布回帖，正在等待道友回应…`;
      render();
    } else if (action === 'beauty-settings-save') {
      root.querySelectorAll<HTMLElement>('[data-beauty-setting]').forEach(node => {
        const key = node.dataset.beautySetting as 'apiBaseUrl' | 'apiKey' | 'apiModel';
        if (key) beautyApiSettings[key] = (node as HTMLInputElement).value;
      });
      beautyApiSettings.autoEnabled = root.querySelector<HTMLInputElement>('[data-beauty-auto-enabled]')?.checked ?? beautyApiSettings.autoEnabled;
      beautyApiSettings.autoInterval = Number(root.querySelector<HTMLInputElement>('[data-beauty-interval]')?.value ?? beautyApiSettings.autoInterval);
      sendAction('SAVE_BEAUTY_SETTINGS', { ...beautyApiSettings });
      beautyApiSettingsOpen = false;
      announcement = '绝色榜 API 设置已保存'; render();
    } else if (action === 'beauty-models-fetch') {
      root.querySelectorAll<HTMLElement>('[data-beauty-setting]').forEach(node => {
        const key = node.dataset.beautySetting as 'apiBaseUrl' | 'apiKey' | 'apiModel';
        if (key) beautyApiSettings[key] = (node as HTMLInputElement).value;
      });
      if (fetchingBeautyModels) return;
      fetchingBeautyModels = true;
      announcement = '正在获取绝色榜模型列表…';
      render();
      sendAction('REQUEST_BEAUTY_MODELS', { apiBaseUrl: beautyApiSettings.apiBaseUrl, apiKey: beautyApiSettings.apiKey });
    } else if (action === 'xianwang-settings-save') {
      root.querySelectorAll<HTMLElement>('[data-xianwang-setting]').forEach(node => {
        const key = node.dataset.xianwangSetting as keyof ApiSettingsDraft | 'playerAlias';
        if (key) xianwangApiSettings[key] = (node as HTMLInputElement).value;
      });
      root.querySelectorAll<HTMLInputElement>('[data-xianwang-number-setting]').forEach(node => {
        const key = node.dataset.xianwangNumberSetting as XianwangNumberSetting;
        if (key) xianwangApiSettings[key] = Number(node.value);
      });
      root.querySelectorAll<HTMLInputElement>('[data-xianwang-auto-setting]').forEach(node => {
        const key = node.dataset.xianwangAutoSetting as 'trendsAutoEnabled'|'forumAutoEnabled'|'newsAutoEnabled';
        if (key) xianwangApiSettings[key] = node.checked;
      });
      root.querySelectorAll<HTMLInputElement>('[data-xianwang-feature-setting]').forEach(node => {
        const key=node.dataset.xianwangFeatureSetting as 'decentralizedMode'|'autoAiReply'|'showHeat'|'showCommentPreview'|'jailbreakPrompt'; if(key)xianwangApiSettings[key]=node.checked;
      });
      sendAction('SAVE_XIANWANG_SETTINGS', { ...xianwangApiSettings });
      announcement = '仙网内容 API 设置已保存'; render();
    } else if (action === 'xianwang-models-fetch') {
      root.querySelectorAll<HTMLElement>('[data-xianwang-setting]').forEach(node => {
        const key = node.dataset.xianwangSetting as keyof ApiSettingsDraft | 'playerAlias';
        if (key) xianwangApiSettings[key] = (node as HTMLInputElement).value;
      });
      if (fetchingXianwangModels) return;
      fetchingXianwangModels = true;
      announcement = '正在获取仙网内容模型列表…';
      render();
      sendAction('REQUEST_XIANWANG_MODELS', { apiBaseUrl: xianwangApiSettings.apiBaseUrl, apiKey: xianwangApiSettings.apiKey });
    } else if (action === 'prompt-injection-save') {
      root.querySelectorAll<HTMLInputElement>('[data-injection-setting]').forEach(node => {
        const key = node.dataset.injectionSetting as keyof PromptInjectionSettingsDraft;
        if (key) promptInjectionSettings[key] = node.checked;
      });
      sendAction('SAVE_PROMPT_INJECTION_SETTINGS', { ...promptInjectionSettings });
      announcement = '主线注入设置已保存'; render();
    } else if (action === 'trends-generate') {
      if (trendsGenerating) return;
      trendsGenerating = true;
      announcement = '正在推演仙网风闻…'; render();
      sendAction('GENERATE_TRENDS');
    } else if(action==='forum-generate'){if(forumGenerating)return;forumGenerating=true;announcement='正在推演仙网论帖…';render();sendAction('GENERATE_FORUM');
    } else if(action==='forum-open'){selectedForumId=actionNode.dataset.key??null;announcement='';render();
    } else if(action==='forum-back'){selectedForumId=null;render();
    } else if(action==='forum-delete'){const id=actionNode.dataset.key??'';if(id&&view.confirm('删除这个帖子？'))sendAction('DELETE_FORUM_POST',{id});
    } else if(action==='trend-like'){sendAction('TOGGLE_TREND_LIKE',{id:actionNode.dataset.key??''});
    } else if(action==='forum-like'){sendAction('TOGGLE_FORUM_LIKE',{id:actionNode.dataset.key??''});
    } else if(action==='news-like'){sendAction('TOGGLE_NEWS_LIKE',{id:actionNode.dataset.key??''});
    } else if(action==='forum-comment-submit'){const id=actionNode.dataset.key??'',input=root.querySelector<HTMLTextAreaElement>(`[data-forum-comment-input="${CSS.escape(id)}"]`),content=input?.value.trim()??'';if(!content)return;sendAction('SUBMIT_FORUM_COMMENT',{id,content});announcement=xianwangApiSettings.autoAiReply?'正在发布并等待仙网友回复…':'正在发表评论…';
    } else if(action==='news-generate'){if(newsGenerating)return;newsGenerating=true;announcement='正在推演天机日报…';render();sendAction('GENERATE_NEWS');
    } else if(action==='news-delete'){const id=actionNode.dataset.key??'';if(id&&view.confirm('删除这期报纸？'))sendAction('DELETE_NEWS_PAPER',{id});
    } else if (action === 'forum-comments-toggle') {
      const key = actionNode.dataset.key ?? '';
      if (!key) return;
      const scrollTop = root.querySelector<HTMLElement>('.content')?.scrollTop ?? 0;
      if (collapsedForumComments.has(key)) collapsedForumComments.delete(key);
      else collapsedForumComments.add(key);
      render();
      const nextContent = root.querySelector<HTMLElement>('.content');
      if (nextContent) nextContent.scrollTop = scrollTop;
    } else if (action === 'trend-delete') {
      const id = actionNode.dataset.key ?? '';
      if (!id || !view.confirm('删除这条仙网风闻？')) return;
      sendAction('DELETE_TREND', { id });
    } else if (action === 'preset-apply' || action === 'preset-save' || action === 'preset-delete') {
      const select = root.querySelector<HTMLSelectElement>('[data-preset="select"]');
      const name = select?.value || '';
      try {
        const storage = view.parent !== view ? view.parent.localStorage : view.localStorage;
        const presets = JSON.parse(storage.getItem('daoyuan_wx_presets') || '{}') as Record<string, YujianSettingsDraft>;
        if (action === 'preset-save') {
          const newName = view.prompt('请输入预设名称：');
          if (newName) { presets[newName] = { ...yujianSettings }; storage.setItem('daoyuan_wx_presets', JSON.stringify(presets)); announcement = `预设「${newName}」已保存`; render(); }
        } else if (action === 'preset-apply' && name && presets[name]) { yujianSettings = { ...presets[name] }; announcement = `已应用预设「${name}」`; render(); }
        else if (action === 'preset-delete' && name && view.confirm(`删除预设「${name}」？`)) { delete presets[name]; storage.setItem('daoyuan_wx_presets', JSON.stringify(presets)); announcement = `预设「${name}」已删除`; render(); }
      } catch { announcement = '预设数据读取失败'; render(); }
    } else if (action === 'news-open') {
      selectedNewsId = actionNode.dataset.key ?? null;
      announcement = '';
      render();
    } else if (action === 'news-back') {
      selectedNewsId = null;
      announcement = '';
      render();
    } else if (action === 'close') sendToHost('CLOSE_SHELL');
    else if (action === 'notice') { announcement = actionNode.dataset.key ?? ''; render(); }
    else if (action === 'diagnostic') { announcement = '诊断请求已提交给宿主；当前只检查能力，不读取或写回 stat_data。'; sendAction('REQUEST_DIAGNOSTIC'); render(); }
  };
  let pointerLockedScrollTop: number | null = null;
  const restorePointerScroll = (): void => {
    if (pointerLockedScrollTop === null) return;
    const content = root.querySelector<HTMLElement>('.content');
    if (content) { content.style.overflowY = 'hidden'; content.scrollTop = pointerLockedScrollTop; }
  };
  const schedulePointerScrollRestore = (): void => {
    restorePointerScroll();
    uiView.requestAnimationFrame(() => { restorePointerScroll(); uiView.requestAnimationFrame(restorePointerScroll); });
    uiView.setTimeout(restorePointerScroll, 0);
  };
  const unlockPointerScroll = (): HTMLElement | null => {
    pointerLockedScrollTop = null;
    const content = root.querySelector<HTMLElement>('.content');
    if (content) content.style.overflowY = '';
    return content;
  };
  const onPointerDown = (event: PointerEvent): void => {
    const target = event.target as HTMLElement | null;
    const interactive = target?.closest<HTMLElement>('button, input, textarea, label, a, [role="option"], [data-action]');
    if (!interactive) { unlockPointerScroll(); return; }
    const content = interactive.closest<HTMLElement>('.content');
    if (!content) { unlockPointerScroll(); return; }
    pointerLockedScrollTop = content.scrollTop;
    const tagName = interactive.tagName.toLowerCase();
    const inputType = tagName === 'input' ? interactive.getAttribute('type') ?? 'text' : '';
    if (tagName === 'textarea' || (tagName === 'input' && ['text', 'search', 'url', 'email', 'tel', 'password', 'number'].includes(inputType))) {
      // Take over native text-field focus so the host cannot reposition the phone.
      event.preventDefault();
      interactive.focus({ preventScroll: true });
    }
    schedulePointerScrollRestore();
  };
  const onPointerClick = (): void => { schedulePointerScrollRestore(); };
  const onWheelIntent = (event: WheelEvent): void => {
    if (pointerLockedScrollTop === null) return;
    const content = unlockPointerScroll();
    if (!content) return;
    event.preventDefault();
    content.scrollTop += event.deltaY;
  };
  const onManualScrollIntent = (): void => { unlockPointerScroll(); };
  const onFocusOut = (): void => {
    uiView.setTimeout(() => {
      const activeElement = doc.activeElement as HTMLElement | null;
      if (!activeElement?.closest('button, input, textarea, label, a, [role="option"], [data-action]')) unlockPointerScroll();
    }, 0);
  };
  const onContentScroll = (event: Event): void => {
    if (pointerLockedScrollTop === null) return;
    const content = event.target as HTMLElement | null;
    if (!content?.classList?.contains('content') || content.scrollTop === pointerLockedScrollTop) return;
    content.scrollTop = pointerLockedScrollTop;
  };
  const onKeydown = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape') return;
    if (zoomMapFactionPortrait) { zoomMapFactionPortrait = false; render(); root.querySelector<HTMLButtonElement>('.map-faction-portrait-zoom')?.focus(); }
    else if (activeMapFaction) { activeMapFaction = null; render(); }
    else if (zoomMapImage) { zoomMapImage = false; render(); }
  };
  const onInput = (event: Event): void => {
    const target = event.target as HTMLInputElement | HTMLSelectElement | null;
    if (target?.matches('[data-earth-api-setting]')) {
      const key = target.dataset.earthApiSetting;
      if (key === 'enabled' && target.type === 'checkbox') earthApiSettings.enabled = target.checked;
      else if (key === 'apiBaseUrl' || key === 'apiKey' || key === 'apiModel') earthApiSettings[key] = target.value;
      else if (key === 'temperature' || key === 'timeoutSeconds' || key === 'replyInterval' || key === 'retryCount' || key === 'maxWorldDays') earthApiSettings[key] = Number(target.value);
      else if (key === 'timeRatio') { earthApiSettings.timeRatio = target.value as EarthTimeRatio; const note = root.querySelector<HTMLElement>('.earth-time-ratio-note'); if (note) note.textContent = earthTimeRatioNote(earthApiSettings.timeRatio); }
      return;
    }
    if (target?.matches('[data-beauty-setting]')) {
      const key = target.dataset.beautySetting as 'apiBaseUrl' | 'apiKey' | 'apiModel';
      if (key) beautyApiSettings[key] = target.value;
      return;
    }
    if (target?.matches('[data-xianwang-setting]')) {
      const key = target.dataset.xianwangSetting as keyof ApiSettingsDraft;
      if (key) xianwangApiSettings[key] = target.value;
      return;
    }
    if (target?.matches('[data-lore-search]')) {
      loreFilter = target.value;
      render();
      root.querySelector<HTMLInputElement>('[data-lore-search]')?.focus();
      return;
    }
    if (!target?.matches('[data-contact-search]')) return;
    contactFilter = target.value;
    applyContactFilter();
  };
  const onChange = (event: Event): void => {
    const target = event.target as HTMLInputElement | HTMLSelectElement | null;
    if(target?.matches('[data-feature-module]')){
      const key=target.dataset.featureModule as FeatureModuleKey;featureModuleFlags={...featureModuleFlags,[key]:(target as HTMLInputElement).checked};
      sendAction('SAVE_FEATURE_MODULE_FLAGS',{key,enabled:featureModuleFlags[key]});announcement=`${key==='world'?'世界推演':key==='yujian'?'玉简传讯':key==='beauty'?'绝色榜':key==='xianwang'?'仙网内容':'万宝商行'}已${featureModuleFlags[key]?'开启':'关闭'}。`;render();return;
    }
    if (target?.matches('[data-earth-model-select]')) {
      earthApiSettings.apiModel = target.value;
      const modelInput = root.querySelector<HTMLInputElement>('[data-earth-api-setting="apiModel"]');
      if (modelInput) modelInput.value = target.value;
      return;
    }
    if(target?.matches('[data-xuantian-model-select]')){xuantianApiSettings.apiModel=target.value;const modelInput=root.querySelector<HTMLInputElement>('[data-xuantian-api-setting="apiModel"]');if(modelInput)modelInput.value=target.value;return;}
    if (target?.matches('[data-beauty-portrait-file]')) {
      const file = (target as HTMLInputElement).files?.[0];
      const name = target.dataset.beautyPortraitFile;
      if (!file || !name) return;
      if (!file.type.startsWith('image/') || file.size > 5 * 1024 * 1024) {
        announcement = '请选择小于 5MB 的图片文件';
        render();
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result !== 'string') return;
        setCustomPortrait(name, reader.result);
        beautyPortraitName = name;
        announcement = '本地立绘已应用';
        render();
      };
      reader.readAsDataURL(file);
      return;
    }
    if (target?.matches('[data-user-dlc-name]')) {
      userDlcName = (target as HTMLInputElement).value;
      const submit = root.querySelector<HTMLButtonElement>('[data-action="user-dlc-import"]'); if (submit) submit.disabled = !userDlcName.trim() || !userDlcWorldbookDraft;
      return;
    }
    if (target?.matches('[data-user-dlc-file]')) {
      const file = (target as HTMLInputElement).files?.[0];
      if (!file) return;
      const fileKind = target.dataset.userDlcFile === 'script' ? 'script' : 'worldbook';
      const updateFileDom = (selected: boolean, summaryText?: string, errorText?: string): void => {
        const status = root.querySelector<HTMLElement>(`[data-user-dlc-file-status="${fileKind}"]`); if (status) status.textContent = errorText ?? (selected ? '已选择 1 个文件' : '未选择任何文件');
        root.querySelector<HTMLElement>(`[data-user-dlc-file-summary="${fileKind}"]`)?.remove();
        if (summaryText) { const summary = element(doc, 'p', fileKind === 'worldbook' ? 'notice' : 'notice muted', summaryText); summary.dataset.userDlcFileSummary = fileKind; target.closest('.content-package-file')?.after(summary); }
        const submit = root.querySelector<HTMLButtonElement>('[data-action="user-dlc-import"]'); if (submit) submit.disabled = !userDlcName.trim() || !userDlcWorldbookDraft;
      };
      if (file.size > 5_000_000) { if (fileKind === 'worldbook') userDlcWorldbookDraft = null; else userDlcScriptDraft = null; updateFileDom(false, undefined, '文件超过 5 MB'); return; }
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const value = JSON.parse(String(reader.result ?? '')) as Record<string, unknown>;
          const originalData = value.originalData && typeof value.originalData === 'object' ? value.originalData as Record<string, unknown> : null;
          const entries = value.entries && typeof value.entries === 'object' && !Array.isArray(value.entries) ? value.entries as Record<string, unknown> : originalData?.entries && typeof originalData.entries === 'object' ? originalData.entries as Record<string, unknown> : null;
          const kind = value.type === 'script' ? 'script' : entries ? 'worldbook' : null;
          if (!kind) throw new Error('未识别到世界书 entries 或单脚本结构');
          if (kind !== fileKind) throw new Error(fileKind === 'worldbook' ? '此处必须选择世界书 JSON' : '此处必须选择单脚本 JSON');
          const name = String(originalData?.name ?? value.name ?? file.name.replace(/\.json$/i, '')).trim();
          if (kind === 'worldbook') { const count = entries ? Object.keys(entries).length : 0; userDlcWorldbookDraft = { fileName: file.name, value, name, count }; updateFileDom(true, `世界书：${name} · ${count} 条`); }
          else { userDlcScriptDraft = { fileName: file.name, value, name }; updateFileDom(true, `脚本：${name}`); }
        } catch (error) { if (fileKind === 'worldbook') userDlcWorldbookDraft = null; else userDlcScriptDraft = null; updateFileDom(false, undefined, `预检失败：${error instanceof Error ? error.message : String(error)}`); }
      };
      reader.onerror = () => { if (fileKind === 'worldbook') userDlcWorldbookDraft = null; else userDlcScriptDraft = null; updateFileDom(false, undefined, '无法读取文件'); };
      reader.readAsText(file); return;
    }
    if (target?.matches('[data-user-script-enabled]')) {
      sendAction('SET_USER_SCRIPT_ENABLED', { id: target.dataset.userScriptEnabled, enabled: (target as HTMLInputElement).checked });
      announcement = (target as HTMLInputElement).checked ? '正在启用脚本扩展…' : '正在关闭脚本扩展…'; render(); return;
    }
    if (target?.matches('[data-model-select]') && target.value) {
      yujianSettings.apiModel = target.value;
      announcement = `已选择模型：${target.value}`;
      render();
      return;
    }
    if (target?.matches('[data-beauty-model-select]') && target.value) {
      beautyApiSettings.apiModel = target.value;
      announcement = `已选择绝色榜模型：${target.value}`;
      render();
      return;
    }
    if (target?.matches('[data-xianwang-model-select]') && target.value) {
      xianwangApiSettings.apiModel = target.value;
      announcement = `已选择仙网内容模型：${target.value}`;
      render();
      return;
    }
    if (target?.matches('[data-wanbao-model-select]') && target.value) {
      wanbaoApiSettings.apiModel = target.value;
      announcement = `已选择万宝商行模型：${target.value}`;
      render();
      return;
    }
    if (target?.matches('[data-lore-uid]')) {
      const selected = new Set(Array.from(root.querySelectorAll<HTMLInputElement>('[data-lore-uid]:checked')).map(node => node.dataset.loreUid).filter((uid): uid is string => Boolean(uid)));
      loreSelected = loreEntries.filter(entry => selected.has(entry.uid)).map(entry => ({ uid: entry.uid, content: entry.content }));
    }
  };
  const onMessage = (event: MessageEvent): void => {
    const message = parseBridgeMessage(event.data);
    if (!message || message.kind !== 'event') return;
    if (message.action === 'REQUEST_CONTEXT') {
      layout = 'phone';
      data = parseAppData(message.payload.appData);
      beautyRanks = Array.isArray(message.payload.beautyRanks)
        ? (message.payload.beautyRanks as BeautyRankView[]).filter(item => item && typeof item.name === 'string' && typeof item.rank === 'string')
        : [];
      const nextChatId = typeof message.payload.context === 'object' && message.payload.context && typeof (message.payload.context as { chatId?: unknown }).chatId === 'string'
        ? (message.payload.context as { chatId: string }).chatId : '__default__';
      if (nextChatId !== currentChatId) collapsedForumComments.clear();
      currentChatId = nextChatId;
      loadReadState();
      if (Array.isArray(message.payload.beautyReplies)) beautyReplies = message.payload.beautyReplies.filter(BeautyReplyShape) as BeautyRankReply[];
      if (Array.isArray(message.payload.trendPosts)) trendPosts = message.payload.trendPosts as TrendPost[];
      if (Array.isArray(message.payload.forumPosts)) forumPosts = message.payload.forumPosts as ForumPost[];
      if (Array.isArray(message.payload.newsPapers)) newsPapers = message.payload.newsPapers as NewsPaper[];
      if (message.payload.xianwangCounters && typeof message.payload.xianwangCounters === 'object') xianwangCounters = { ...xianwangCounters, ...(message.payload.xianwangCounters as Partial<typeof xianwangCounters>) };
      if (typeof message.payload.beautyCounter === 'number') beautyCounter = Math.max(0, Math.floor(message.payload.beautyCounter));
      if (message.payload.yujianSettings && typeof message.payload.yujianSettings === 'object') yujianSettings = { ...yujianSettings, ...(message.payload.yujianSettings as Partial<YujianSettingsDraft>) };
      if (message.payload.beautyApiSettings && typeof message.payload.beautyApiSettings === 'object') beautyApiSettings = { ...beautyApiSettings, ...(message.payload.beautyApiSettings as Partial<BeautyApiSettingsDraft>) };
      if (message.payload.xianwangApiSettings && typeof message.payload.xianwangApiSettings === 'object') xianwangApiSettings = { ...xianwangApiSettings, ...(message.payload.xianwangApiSettings as Partial<XianwangSettingsDraft>) };
      if (message.payload.wanbaoApiSettings && typeof message.payload.wanbaoApiSettings === 'object') wanbaoApiSettings = { ...wanbaoApiSettings, ...(message.payload.wanbaoApiSettings as Partial<WanbaoApiSettingsDraft>) };
      if (message.payload.earthApiSettings && typeof message.payload.earthApiSettings === 'object') earthApiSettings = { ...earthApiSettings, ...(message.payload.earthApiSettings as Partial<EarthApiSettingsDraft>) };
      earthSimulationState = message.payload.earthSimulationState && typeof message.payload.earthSimulationState === 'object' ? message.payload.earthSimulationState as EarthSimulationState : null;
      if (message.payload.xuantianApiSettings && typeof message.payload.xuantianApiSettings === 'object') xuantianApiSettings = { ...xuantianApiSettings, ...(message.payload.xuantianApiSettings as Partial<XuantianApiSettingsDraft>) };
      xuantianSimulationState = message.payload.xuantianSimulationState && typeof message.payload.xuantianSimulationState === 'object' ? message.payload.xuantianSimulationState as XuantianSimulationState : null;
      storyDirectorPlan=message.payload.storyDirectorPlan&&typeof message.payload.storyDirectorPlan==='object'?message.payload.storyDirectorPlan as StoryDirectorPlan:null;
      xuantianFaultLogs=Array.isArray(message.payload.xuantianFaultLogs)?message.payload.xuantianFaultLogs as XuantianFaultLog[]:[];
      if(message.payload.featureModuleFlags&&typeof message.payload.featureModuleFlags==='object')featureModuleFlags={...featureModuleFlags,...message.payload.featureModuleFlags as Partial<FeatureModuleFlags>};
      if(message.payload.worldSimulationFeatures&&typeof message.payload.worldSimulationFeatures==='object')worldSimulationFeatures={...worldSimulationFeatures,...message.payload.worldSimulationFeatures as Partial<typeof worldSimulationFeatures>};
      const activeModule = featureModuleForApp[active];
      const activeRealmDisabled = (active === 'xuantian' && !worldSimulationFeatures.xuantianEnabled)
        || (active === 'earth' && !worldSimulationFeatures.earthEnabled);
      if ((activeModule && !featureModuleFlags[activeModule]) || activeRealmDisabled) {
        active = 'home';
        saveUiPreferences({ layoutMode: 'phone', lastApp: active });
        sendAction('SET_ACTIVE_APP', { app: active });
      }
      if (message.payload.promptInjectionSettings && typeof message.payload.promptInjectionSettings === 'object') promptInjectionSettings = { ...promptInjectionSettings, ...(message.payload.promptInjectionSettings as Partial<PromptInjectionSettingsDraft>) };
      if (Array.isArray(message.payload.userScripts)) userScripts = message.payload.userScripts as UserScriptView[];
      if (message.payload.earthWorldbookStatus && typeof message.payload.earthWorldbookStatus === 'object') earthWorldbookStatus = message.payload.earthWorldbookStatus as EarthWorldbookStatusView;
      if (typeof message.payload.earthWorldbookMountedEntryCount === 'number') earthWorldbookMountedEntryCount = message.payload.earthWorldbookMountedEntryCount;
      if (message.payload.petSize === 'small' || message.payload.petSize === 'medium' || message.payload.petSize === 'large') petSize = message.payload.petSize;
      if (message.payload.phoneDisplayMode === 'drawer' || message.payload.phoneDisplayMode === 'floating') phoneDisplayMode = message.payload.phoneDisplayMode;
      loreSelected = readLoreSelected();
      if (Array.isArray(message.payload.yujianContacts)) {
        worldContacts = (message.payload.yujianContacts as WorldYujianContact[]).filter(contact => typeof contact?.name === 'string').map((contact, index) => ({
          name: contact.name,
          portrait: typeof contact.portrait === 'string' ? contact.portrait : undefined,
          affection: typeof contact.affection === 'string' ? contact.affection : undefined,
          affectionLabel: contact.affectionLabel === '亲密度' ? '亲密度' : contact.affectionLabel === '好感度' ? '好感度' : undefined,
          avatar: contact.name.slice(0, 1),
          preview: typeof contact.preview === 'string' ? contact.preview : '暂无最近传讯',
          time: typeof contact.time === 'string' ? contact.time : '未知时间',
          detail: typeof contact.detail === 'string' ? contact.detail : '状态栏玉简联系人',
          unread: Number.isFinite(contact.unread) ? contact.unread : 0,
          history: Array.isArray(contact.history) ? contact.history.filter(message => message && (message.from === 'me' || message.from === 'them') && typeof message.text === 'string').map(message => ({
            from: message.from,
            text: message.text,
            time: typeof message.time === 'string' ? message.time : '未知时间',
          })) : [],
          tone: (['jade', 'gold', 'violet', 'blue', 'red'] as const)[index % 5],
        }));
      }
      if (Array.isArray(message.payload.inventoryItems)) {
        inventoryItems = (message.payload.inventoryItems as InventoryItem[]).filter(item => item && typeof item.name === 'string').map(item => ({
          name: item.name,
          quantity: typeof item.quantity === 'number' && Number.isFinite(item.quantity) ? item.quantity : null,
          description: typeof item.description === 'string' ? item.description : '',
          category: typeof item.category === 'string' ? item.category : '',
          status: typeof item.status === 'string' ? item.status : '',
        }));
      } else inventoryItems = [];
      if (message.payload.spiritStones && typeof message.payload.spiritStones === 'object') {
        const payload = message.payload.spiritStones as WanbaoCurrencyPayload;
        spiritStones = {
          mode: typeof payload.mode === 'string' ? payload.mode : 'auto',
          warning: typeof payload.warning === 'string' ? payload.warning : undefined,
          balances: Array.isArray(payload.balances) ? payload.balances.filter(item => item && typeof item.grade === 'string').map(item => ({
            grade: item.grade,
            quantity: typeof item.quantity === 'number' && Number.isFinite(item.quantity) ? Math.max(0, Math.floor(item.quantity)) : 0,
            source: typeof item.source === 'string' ? item.source : 'unresolved',
          })) : [],
        };
      }
      if (Array.isArray(message.payload.merchantProducts)) merchantProducts = (message.payload.merchantProducts as WanbaoProductPayload[]).filter(item => item && typeof item.id === 'string' && typeof item.name === 'string');
      if (Array.isArray(message.payload.merchantSellItems)) merchantSellItems = (message.payload.merchantSellItems as WanbaoSellPayload[]).filter(item => item && typeof item.id === 'string' && typeof item.name === 'string');
      if (Array.isArray(message.payload.merchantTransactions)) merchantTransactions = (message.payload.merchantTransactions as WanbaoTransactionPayload[]).filter(item => item && (item.kind === 'buy' || item.kind === 'sell'));
      merchantCounter = typeof message.payload.merchantCounter === 'number' && Number.isFinite(message.payload.merchantCounter) ? Math.max(0, Math.floor(message.payload.merchantCounter)) : 0;
      protagonistRealm = typeof message.payload.protagonistRealm === 'string' ? message.payload.protagonistRealm : '';
      if (message.payload.merchantGenerationState && typeof message.payload.merchantGenerationState === 'object') {
        const state = message.payload.merchantGenerationState as Partial<WanbaoGenerationState>;
        merchantGenerationState = { status: state.status === 'running' || state.status === 'success' || state.status === 'error' ? state.status : 'idle', message: typeof state.message === 'string' ? state.message : undefined, startedAt: typeof state.startedAt === 'string' ? state.startedAt : undefined, finishedAt: typeof state.finishedAt === 'string' ? state.finishedAt : undefined, count: typeof state.count === 'number' ? state.count : undefined };
      }
      if (message.payload.worldStatus && typeof message.payload.worldStatus === 'object') {
        const status = message.payload.worldStatus as Partial<WorldStatus>;
        worldStatus = {
          time: typeof status.time === 'string' ? status.time : '未接入',
          location: typeof status.location === 'string' ? status.location : '未接入',
          energy: typeof status.energy === 'string' ? status.energy : '未知',
        };
      } else worldStatus = { time: '未接入', location: '未接入', energy: '未知' };
      capabilityAvailable = message.payload.capabilities && typeof message.payload.capabilities === 'object'
        ? Object.values(message.payload.capabilities).includes('mvu-ready')
        : false;
      contentBeautifierEnabled = message.payload.contentBeautifierEnabled !== false;
      if (message.payload.contentAssistSettings && typeof message.payload.contentAssistSettings === 'object') contentAssistSettings = { ...contentAssistSettings, ...message.payload.contentAssistSettings as Partial<typeof contentAssistSettings> };
      configHelperEnabled = message.payload.configHelperEnabled === true;
      render();
    }
    if(message.action==='FEATURE_MODULE_FLAGS_STATUS'){
      if(message.payload.flags&&typeof message.payload.flags==='object')featureModuleFlags={...featureModuleFlags,...message.payload.flags as Partial<FeatureModuleFlags>};
      if(message.payload.ok===false)announcement=typeof message.payload.error==='string'?message.payload.error:'该功能已关闭。';
      render();
    }
    if(message.action==='WORLD_SIMULATION_FEATURES_STATUS'){
      if(message.payload.features&&typeof message.payload.features==='object')worldSimulationFeatures={...worldSimulationFeatures,...message.payload.features as Partial<typeof worldSimulationFeatures>};
      announcement=message.payload.ok===true?'世界推演开关已由宿主保存。':`保存推演开关失败：${typeof message.payload.error==='string'?message.payload.error:'未知错误'}`;
      render();
    }
    if(message.action==='WORLD_SIMULATION_CLEAR_STATUS'){
      const world=message.payload.world==='earth'?'地球':'玄天界';
      if(message.payload.ok===true){if(message.payload.world==='earth')earthSimulationState=null;else{xuantianSimulationState=null;storyDirectorPlan=null;}announcement=`当前对话的${world}推演已清空，对应正文注入已撤销。`;}
      else announcement=`${world}推演清空失败：${typeof message.payload.error==='string'?message.payload.error:'未知错误'}`;
      render();
    }
    if (message.action === 'YUJIAN_LORE_DATA') { loreEntries = Array.isArray(message.payload.entries) ? message.payload.entries as YujianLoreEntry[] : []; render(); }
    if (message.action === 'CONTENT_BEAUTIFIER_SETTINGS_STATUS') {
      contentBeautifierEnabled = message.payload.enabled !== false;
      contentAssistSettings = {
        bodyPromptEnabled: message.payload.bodyPromptEnabled === true,
        ticketPromptEnabled: message.payload.ticketPromptEnabled === true,
        ticketRendererEnabled: message.payload.ticketRendererEnabled === true,
      };
      announcement = message.payload.ok === true
        ? '正文呈现的四项开关已保存。'
        : `正文美化设置失败：${typeof message.payload.error === 'string' ? message.payload.error : '未知错误'}`;
      render();
    }
    if (message.action === 'CONFIG_HELPER_SETTINGS_STATUS') {
      configHelperEnabled = message.payload.enabled === true;
      announcement = message.payload.ok === true
        ? (configHelperEnabled ? '配置小助手悬浮球已显示。' : '配置小助手悬浮球已隐藏。')
        : `配置小助手设置失败：${typeof message.payload.error === 'string' ? message.payload.error : '未知错误'}`;
      render();
    }
    if (message.action === 'PHONE_DISPLAY_MODE_STATUS') {
      if (message.payload.mode === 'drawer' || message.payload.mode === 'floating') phoneDisplayMode = message.payload.mode;
      announcement = message.payload.ok === true ? `小手机已切换为${phoneDisplayMode === 'drawer' ? '侧边抽屉' : '自由浮窗'}。` : '小手机显示方式保存失败。';
      render();
    }
    if (message.action === 'USER_SCRIPT_STATUS') {
      announcement = message.payload.ok === true
        ? `${message.payload.enabled === true ? '脚本扩展已启用。' : '脚本扩展已关闭。'}${message.payload.reloadRequired === true ? '刷新酒馆后完全生效。' : ''}`
        : `脚本扩展设置失败：${typeof message.payload.error === 'string' ? message.payload.error : '未知错误'}`;
      render();
    }
    if (message.action === 'USER_DLC_STATUS_DATA' || message.action === 'USER_DLC_IMPORT_STATUS' || message.action === 'USER_DLC_REPAIR_STATUS' || message.action === 'USER_DLC_REMOVE_STATUS' || message.action === 'USER_DLC_SCRIPT_REMOVE_STATUS') {
      if (Array.isArray(message.payload.records)) userDlcs = message.payload.records as UserDlcStatusView[];
      if (message.payload.ok === true) {
        const reload = message.payload.reloadRequired === true ? ' 刷新酒馆后脚本变更完全生效。' : '';
        announcement = message.action === 'USER_DLC_IMPORT_STATUS' ? `DLC 已导入并登记。${reload}` : message.action === 'USER_DLC_REPAIR_STATUS' ? '挂载已修复并复读确认。' : message.action === 'USER_DLC_REMOVE_STATUS' ? `DLC 登记已移除，附属挂载已解除；世界书文件仍保留在酒馆。${reload}` : message.action === 'USER_DLC_SCRIPT_REMOVE_STATUS' ? `脚本登记已移除。${reload}` : '';
        if (message.action === 'USER_DLC_IMPORT_STATUS') { selectedUserDlcId = null; userDlcName = ''; userDlcWorldbookDraft = null; userDlcScriptDraft = null; }
      } else announcement = `DLC 操作失败：${typeof message.payload.error === 'string' ? message.payload.error : '未知错误'}`;
      render();
    }
    if (message.action === 'EARTH_WORLDBOOK_STATUS_DATA' || message.action === 'EARTH_WORLDBOOK_INSTALL_STATUS' || message.action === 'EARTH_WORLDBOOK_ATTACH_STATUS' || message.action === 'EARTH_WORLDBOOK_REPAIR_STATUS') {
      if (message.payload.status && typeof message.payload.status === 'object') earthWorldbookStatus = message.payload.status as EarthWorldbookStatusView;
      if (typeof message.payload.mountedEntryCount === 'number') earthWorldbookMountedEntryCount = message.payload.mountedEntryCount;
      announcement = message.payload.ok === true ? '地球附属世界书状态已更新。' : `地球世界书操作失败：${typeof message.payload.error === 'string' ? message.payload.error : '未知错误'}`;
      render();
    }
    if (message.action === 'WANBAO_GENERATION_STATUS' || message.action === 'WANBAO_ESTIMATE_STATUS' || message.action === 'WANBAO_TRADE_STATUS') {
      announcement = message.payload.ok === true
        ? (typeof message.payload.message === 'string' ? message.payload.message : '万宝商行操作成功。')
        : `万宝商行操作失败：${typeof message.payload.error === 'string' ? message.payload.error : typeof message.payload.message === 'string' ? message.payload.message : '未知错误'}`;
      if (Array.isArray(message.payload.products)) merchantProducts = message.payload.products as WanbaoProductPayload[];
      render();
    }
    if (message.action === 'WANBAO_MODELS_DATA') {
      fetchingWanbaoModels = false;
      wanbaoModelOptions = Array.isArray(message.payload.models) ? message.payload.models.filter((model): model is string => typeof model === 'string') : [];
      announcement = message.payload.ok === true ? (wanbaoModelOptions.length ? `已获取 ${wanbaoModelOptions.length} 个万宝商行模型。` : '模型列表为空。') : `获取模型失败：${typeof message.payload.error === 'string' ? message.payload.error : '未知错误'}`;
      render();
    }
    if (message.action === 'YUJIAN_MODELS_DATA') {
      fetchingModels = false;
      modelOptions = Array.isArray(message.payload.models) ? message.payload.models.filter((model): model is string => typeof model === 'string') : [];
      announcement = message.payload.ok === true
        ? (modelOptions.length ? `已获取 ${modelOptions.length} 个模型，请在模型输入框选择。` : '模型列表为空。')
        : `获取模型失败：${typeof message.payload.error === 'string' ? message.payload.error : '未知错误'}`;
      render();
    }
    if (message.action === 'EARTH_MODELS_DATA') {
      fetchingEarthModels = false;
      earthModelOptions = Array.isArray(message.payload.models) ? message.payload.models.filter((model): model is string => typeof model === 'string') : [];
      announcement = message.payload.ok === true
        ? (earthModelOptions.length ? `已获取 ${earthModelOptions.length} 个地球推演模型。` : '地球推演模型列表为空。')
        : `获取地球推演模型失败：${typeof message.payload.error === 'string' ? message.payload.error : '未知错误'}`;
      render();
    }
    if(message.action==='XUANTIAN_MODELS_DATA'){fetchingXuantianModels=false;xuantianModelOptions=Array.isArray(message.payload.models)?message.payload.models.filter((model):model is string=>typeof model==='string'):[];announcement=message.payload.ok===true?(xuantianModelOptions.length?`已获取 ${xuantianModelOptions.length} 个玄天界推演模型。`:'玄天界推演模型列表为空。'):`获取玄天界推演模型失败：${typeof message.payload.error==='string'?message.payload.error:'未知错误'}`;render();}
    if(message.action==='XUANTIAN_SETTINGS_STATUS'){if(message.payload.settings&&typeof message.payload.settings==='object')xuantianApiSettings={...xuantianApiSettings,...message.payload.settings as Partial<XuantianApiSettingsDraft>};announcement=message.payload.ok===true?'玄天界推演 API 设置已保存。':`保存失败：${typeof message.payload.error==='string'?message.payload.error:'未知错误'}`;render();}
    if(message.action==='XUANTIAN_SIMULATION_STATUS'){if(message.payload.retrying===true){xuantianSimulationRunning=true;announcement=typeof message.payload.error==='string'?message.payload.error:'推演响应不可用，正在按设置重试…';render();}else{xuantianSimulationRunning=false;if(message.payload.state&&typeof message.payload.state==='object')xuantianSimulationState=message.payload.state as XuantianSimulationState;if(message.payload.storyPlan&&typeof message.payload.storyPlan==='object')storyDirectorPlan=message.payload.storyPlan as StoryDirectorPlan;const skipped=Array.isArray(message.payload.skipped)?message.payload.skipped.filter((item):item is string=>typeof item==='string'):[];const calls=`API 请求 ${Number(message.payload.requestCount)||0}/${Number(message.payload.maxRequests)||1} 次`;announcement=message.payload.ok===true?`世界推演与剧情导演已提交：${typeof message.payload.actions==='number'?message.payload.actions:0} 项状态变更；${calls}${skipped.length?`；跳过 ${skipped.length} 项：${skipped.slice(0,2).join('；')}`:''}。`:`玄天界推演失败：${typeof message.payload.error==='string'?message.payload.error:'未知错误'}；${calls}。`;render();}}
    if(message.action==='XUANTIAN_SIMULATION_RESET_STATUS'){if(message.payload.state&&typeof message.payload.state==='object')xuantianSimulationState=message.payload.state as XuantianSimulationState;if(message.payload.ok===true)storyDirectorPlan=null;announcement=message.payload.ok===true?'玄天界推演账本与剧情图已重置。':`重置失败：${typeof message.payload.error==='string'?message.payload.error:'未知错误'}`;render();}
    if(message.action==='XUANTIAN_FAULT_LOG_CLEAR_STATUS'){if(message.payload.ok===true)xuantianFaultLogs=[];announcement=message.payload.ok===true?'已清空当前聊天的玄天界推演故障日志。':`清空日志失败：${typeof message.payload.error==='string'?message.payload.error:'未知错误'}`;render();}
    if (message.action === 'EARTH_SETTINGS_STATUS') {
      if (message.payload.settings && typeof message.payload.settings === 'object') earthApiSettings = { ...earthApiSettings, ...(message.payload.settings as Partial<EarthApiSettingsDraft>) };
      announcement = message.payload.ok === true ? '地球推演 API 设置已保存。' : `保存失败：${typeof message.payload.error === 'string' ? message.payload.error : '未知错误'}`;
      render();
    }
    if (message.action === 'EARTH_SIMULATION_RESET_STATUS') {
      if (message.payload.state && typeof message.payload.state === 'object') earthSimulationState = message.payload.state as EarthSimulationState;
      announcement = message.payload.ok === true ? '地球推演数据已清除，下次将从初始状态重新推演。' : `清除失败：${typeof message.payload.error === 'string' ? message.payload.error : '未知错误'}`;
      render();
    }
    if (message.action === 'EARTH_SIMULATION_STATUS') {
      if (message.payload.retrying === true) {
        earthSimulationRunning = true;
        announcement = typeof message.payload.error === 'string' ? message.payload.error : 'AI 第一次返回的内容格式不正确，正在自动重试…';
        render();
        return;
      }
      earthSimulationRunning = false;
      if (message.payload.state && typeof message.payload.state === 'object') earthSimulationState = message.payload.state as EarthSimulationState;
      if (message.payload.ok === true) {
        const worldbookEntries = Number(message.payload.worldbookEntries) || 0;
        const assistantFloors = Number(message.payload.assistantFloors) || 0;
        const changes = Number(message.payload.actions) || 0;
        const calls = `API 请求 ${Number(message.payload.requestCount) || 0}/${Number(message.payload.maxRequests) || 1} 次`;
        announcement = changes > 0
          ? `地球推演完成：参考了 ${worldbookEntries} 条世界书设定和最近 ${assistantFloors} 条 AI 回复，世界状态已更新 ${changes} 项；${calls}。`
          : `地球推演完成：参考了 ${worldbookEntries} 条世界书设定和最近 ${assistantFloors} 条 AI 回复，本轮没有产生需要保存的新变化；${calls}。`;
      } else announcement = `地球推演失败：${typeof message.payload.error === 'string' ? message.payload.error : '未知错误'}；API 请求 ${Number(message.payload.requestCount) || 0}/${Number(message.payload.maxRequests) || 1} 次。`;
      render();
    }
    if (message.action === 'BEAUTY_MODELS_DATA') {
      fetchingBeautyModels = false;
      beautyModelOptions = Array.isArray(message.payload.models) ? message.payload.models.filter((model): model is string => typeof model === 'string') : [];
      announcement = message.payload.ok === true
        ? (beautyModelOptions.length ? `已获取 ${beautyModelOptions.length} 个绝色榜模型。` : '绝色榜模型列表为空。')
        : `获取绝色榜模型失败：${typeof message.payload.error === 'string' ? message.payload.error : '未知错误'}`;
      render();
    }
    if (message.action === 'PROMPT_INJECTION_SETTINGS_STATUS') {
      announcement = message.payload.capabilityAvailable === false
        ? '设置已保存；当前预览环境不提供酒馆提示词注入，导入酒馆后生效。'
        : message.payload.active === true ? '主线注入已生效。' : '设置已保存，当前没有可注入的内容。';
      render();
    }
    if (message.action === 'BEAUTY_SETTINGS_STATUS' && message.payload.settingsSaved === true) {
      announcement = '绝色榜 API 设置已保存';
      render();
    }
    if (message.action === 'XIANWANG_MODELS_DATA') {
      fetchingXianwangModels = false;
      xianwangModelOptions = Array.isArray(message.payload.models) ? message.payload.models.filter((model): model is string => typeof model === 'string') : [];
      announcement = message.payload.ok === true
        ? (xianwangModelOptions.length ? `已获取 ${xianwangModelOptions.length} 个仙网内容模型。` : '仙网内容模型列表为空。')
        : `获取仙网内容模型失败：${typeof message.payload.error === 'string' ? message.payload.error : '未知错误'}`;
      render();
    }
    if (message.action === 'XIANWANG_SETTINGS_STATUS' && message.payload.settingsSaved === true) {
      announcement = '仙网内容 API 设置已保存';
      render();
    }
    if (message.action === 'TRENDS_GENERATION_STATUS') {
      trendsGenerating = false;
      announcement = message.payload.ok === true
        ? `已推演 ${Number(message.payload.posts) || 0} 条仙网风闻`
        : `仙网风闻生成失败：${typeof message.payload.error === 'string' ? message.payload.error : '未知错误'}`;
      render();
    }
    if (message.action === 'TREND_DELETE_STATUS') {
      if (message.payload.ok === true && typeof message.payload.id === 'string') collapsedForumComments.delete(message.payload.id);
      announcement = message.payload.ok === true ? '仙网风闻已删除' : `删除失败：${typeof message.payload.error === 'string' ? message.payload.error : '未知错误'}`;
      render();
    }
    if(message.action==='FORUM_GENERATION_STATUS'){forumGenerating=false;announcement=message.payload.ok===true?`已推演 ${Number(message.payload.posts)||0} 篇仙网论帖`:`仙网论坛推演失败：${typeof message.payload.error==='string'?message.payload.error:'未知错误'}`;render();}
    if(message.action==='FORUM_COMMENT_STATUS'){announcement=message.payload.ok===true?'评论已发布':`评论失败：${typeof message.payload.error==='string'?message.payload.error:'未知错误'}`;render();}
    if(message.action==='FORUM_DELETE_STATUS'){if(message.payload.ok===true)selectedForumId=null;announcement=message.payload.ok===true?'帖子已删除':`删除失败：${typeof message.payload.error==='string'?message.payload.error:'未知错误'}`;render();}
    if(message.action==='NEWS_GENERATION_STATUS'){newsGenerating=false;announcement=message.payload.ok===true?`已推演 ${Number(message.payload.papers)||0} 期天机日报`:`天机日报推演失败：${typeof message.payload.error==='string'?message.payload.error:'未知错误'}`;render();}
    if(message.action==='NEWS_DELETE_STATUS'){if(message.payload.ok===true)selectedNewsId=null;announcement=message.payload.ok===true?'报纸已删除':`删除失败：${typeof message.payload.error==='string'?message.payload.error:'未知错误'}`;render();}
    if (message.action === 'BEAUTY_GENERATION_STATUS') {
      beautyGenerating = false;
      if (message.payload.ok === true) {
        beautyReplies = [];
        try {
          const storage = uiView.parent !== uiView ? uiView.parent.localStorage : uiView.localStorage;
          storage.removeItem(beautyReplyStorageKey());
        } catch { /* ignore unavailable storage */ }
      }
      announcement = message.payload.ok === true
        ? `绝色榜已解析并保存，共 ${typeof message.payload.entries === 'number' ? message.payload.entries : 0} 位上榜人物。`
        : `绝色榜生成失败：${typeof message.payload.error === 'string' ? message.payload.error : '未知错误'}`;
      render();
    }
    if (message.action === 'BEAUTY_REPLY_STATUS') {
      beautyReplySending = false;
      if (message.payload.ok === true && BeautyReplyShape(message.payload.reply)) {
        const reply = message.payload.reply as BeautyRankReply;
        if (!beautyReplies.some(item => item.id === reply.id)) beautyReplies = [...beautyReplies, reply];
        saveBeautyReplies();
        announcement = 'AI 道友已回复';
      } else announcement = `AI 回帖失败：${typeof message.payload.error === 'string' ? message.payload.error : '未知错误'}`;
      render();
    }
    if (message.action === 'YUJIAN_SEND_STATUS') {
      if (message.payload.settingsSaved === true) { announcement = '玉简设定已保存'; render(); return; }
      if (message.payload.phase === 'user-written') {
        announcement = '消息已写入玉简，正在等待回复…';
        render();
        return;
      }
      pendingSend = false;
      announcement = message.payload.ok === true
        ? (typeof message.payload.storageWarning === 'string' && message.payload.storageWarning
          ? `回复生成成功，但历史保存失败：${message.payload.storageWarning}`
          : '传讯已写入玉简，回复已同步。')
        : `传讯失败：${typeof message.payload.error === 'string' ? message.payload.error : '未知错误'}`;
      render();
    }
    if (message.action === 'FACTORY_RESET_STATUS') {
      if (message.payload.ok === true) {
        featureModuleFlags = { yujian:false, beauty:false, xianwang:false, wanbao:false, world:false };
        worldSimulationFeatures = { xuantianEnabled:false, earthEnabled:false };
        settingsSection = 'home'; active = 'settings';
        announcement = '小手机所有配置与记录已清空，正在刷新酒馆完成出厂重置。';
        render();
        uiView.setTimeout(() => { try { (uiView.parent !== uiView ? uiView.parent : uiView).location.reload(); } catch { uiView.location.reload(); } }, 350);
        return;
      } else {
        announcement = `恢复出厂设置失败：${typeof message.payload.error === 'string' ? message.payload.error : '未知错误'}`;
      }
      render();
    }
    if (message.action === 'YUJIAN_HISTORY_IMPORT_STATUS') {
      importingStatusHistory = false;
      if (message.payload.ok === true) {
        const imported = Number(message.payload.imported) || 0;
        const contacts = Number(message.payload.contacts) || 0;
        const skipped = Number(message.payload.skipped) || 0;
        announcement = imported
          ? `${message.payload.automatic === true ? '已自动同步' : '已从状态栏导入'} ${contacts} 位联系人、${imported} 条聊天记录；跳过 ${skipped} 条重复记录。`
          : `没有需要新增的记录；已跳过 ${skipped} 条重复记录。`;
      } else {
        announcement = `状态栏聊天记录导入失败：${typeof message.payload.error === 'string' ? message.payload.error : '未知错误'}`;
      }
      render();
    }
    if (message.action === 'YUJIAN_HISTORY_DELETE_STATUS') {
      clearChatArmedFor = null;
      announcement = message.payload.ok === true
        ? message.payload.mode === 'clear'
          ? `已清空 ${Number(message.payload.removed) || 0} 条聊天记录。`
          : '已删除这条消息。'
        : `删除失败：${typeof message.payload.error === 'string' ? message.payload.error : '未知错误'}`;
      render();
    }
    if (message.action === 'YUJIAN_CONTACT_DELETE_STATUS') {
      clearChatArmedFor = null;
      if (message.payload.ok === true) {
        const charName = typeof message.payload.charName === 'string' ? message.payload.charName : '该联系人';
        selectedContactName = null;
        announcement = `已删除联系人「${charName}」及其 ${Number(message.payload.removed) || 0} 条聊天记录。`;
      } else {
        announcement = `删除联系人失败：${typeof message.payload.error === 'string' ? message.payload.error : '未知错误'}`;
      }
      render();
    }
  };
  root.addEventListener('pointerdown', onPointerDown, true);
  root.addEventListener('wheel', onWheelIntent, { capture: true, passive: false });
  root.addEventListener('touchstart', onManualScrollIntent, true);
  root.addEventListener('focusout', onFocusOut, true);
  root.addEventListener('scroll', onContentScroll, true);
  root.addEventListener('click', onClick);
  root.addEventListener('click', onPointerClick);
  root.addEventListener('input', onInput);
  root.addEventListener('change', onChange);
  view.addEventListener('message', onMessage);
  view.addEventListener('keydown', onKeydown);
  const unsubscribePortraits = onPortraitsUpdated(() => render());
  const realTimeTimer = uiView.setInterval(() => {
    const clock = root.querySelector<HTMLTimeElement>('.spirit-real-time');
    if (clock) clock.textContent = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
  }, 30000);
  render();
  sendAction('APP_READY');
  return { destroy: () => { closeParentMapFactionPortrait?.(); unsubscribePortraits(); uiView.clearInterval(realTimeTimer); root.removeEventListener('pointerdown', onPointerDown, true); root.removeEventListener('wheel', onWheelIntent, true); root.removeEventListener('touchstart', onManualScrollIntent, true); root.removeEventListener('focusout', onFocusOut, true); root.removeEventListener('scroll', onContentScroll, true); root.removeEventListener('click', onPointerClick); root.remove(); root.removeEventListener('click', onClick); root.removeEventListener('input', onInput); root.removeEventListener('change', onChange); view.removeEventListener('message', onMessage); view.removeEventListener('keydown', onKeydown); } };
}
