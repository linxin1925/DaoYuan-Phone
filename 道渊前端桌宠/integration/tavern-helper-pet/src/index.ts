import { makeBridgeMessage, parseBridgeMessage } from './contract/bridge';
import { emptyAppData, parseBeautyRankData, parseTrendsData, parseForumData, parseNewsData, type BeautyRankEntry, type BeautyRankReply, type TrendPost, type ForumPost, type NewsPaper } from './contract/appData';
import { captureOperationContext, isCurrentOperationContext } from './runtime/contextToken';
import { changeContext, createHudSession, destroyHudSession, type HudSession } from './runtime/hudSession';
import { ChatVariableRepository, createTavernChatVariableAdapter } from './services/chatRepository';
import { loadUiPreferences, saveUiPreferences, type UiPreferences } from './services/storageService';
import { initPortraits, onPortraitsUpdated } from './services/portraitService';
import { getWorldDataCapability, projectInventory, projectNpcContacts, projectWorldStatus, projectYujianAffections, projectYujianContacts, type InventoryItemSnapshot, type WorldStatusSnapshot, type YujianContactSnapshot } from './services/worldDataBridge';
import { MVU_CHANNEL_NAME, MvuChannelTool } from './services/mvuChannel';
import { appendStandaloneYujianRecord, clearStandaloneYujianHistory, deleteStandaloneYujianRecord, extractStoryYujianEvents, fetchYujianModels, importStatusYujianHistories, loadStandaloneKnownContacts, loadStandaloneYujianHistories, reconcileAutoYujianRecords, rememberStandaloneKnownContacts, removeAutoYujianRecordsForFloor, resetYujianRuntimeContext, sendYujianMessageWithProgress } from './services/yujianRuntime';
import { mountUi } from './ui/renderUi';
import { parseIndependentBeautyRankData } from './services/beautyRankService';
import { DEFAULT_BEAUTY_RANK_PROMPT } from './services/beautyRankPrompt';
import { generateBeautyRank, generateBeautyRankReply, type BeautyRankApiSettings } from './services/beautyRankRuntime';
import { generateTrends, retainTrendPosts, type XianwangApiSettings } from './services/xianwangTrendsRuntime';
import { generateForumPosts, generateForumReplies, generateNewsPapers, normalizeNewsIssueSequence, retainNewest } from './services/xianwangForumNewsRuntime';
import { normalizeMapNode, type MapRealm } from './services/mapService';
import { applyPromptInjection, buildPromptInjectionContent, DEFAULT_PROMPT_INJECTION_SETTINGS, normalizePromptInjectionSettings, type PromptInjectionApi, type PromptInjectionSettings, type YujianInjectionMessage } from './services/promptInjectionRuntime';
import appCss from './styles.css?inline';
import shellCss from './shell.css?inline';
import { ZiweiPetController, type PetSize } from './petController';

const SCRIPT_ID = 'daoyuan-feature-frontend-hud';
const HOST_ID = 'daoyuan-feature-hud';
const ORB_ID = 'daoyuan-feature-orb';
const IPHONE_WIDTH = 390;
const IPHONE_HEIGHT = 844;
const IPHONE_RATIO = IPHONE_WIDTH / IPHONE_HEIGHT;
const PET_SIZE_KEY = 'daoyuan_ziwei_pet_size_v1';

type ShellMode = 'phone';
type Layout = 'phone';

function readPetSize(hostWindow: Window): PetSize {
  try {
    const value = hostWindow.localStorage.getItem(PET_SIZE_KEY);
    return value === 'small' || value === 'medium' || value === 'large' ? value : 'large';
  } catch { return 'large'; }
}

function savePetSize(hostWindow: Window, size: PetSize): void {
  try { hostWindow.localStorage.setItem(PET_SIZE_KEY, size); } catch { /* optional preference */ }
}

interface RuntimeGlobals {
  $?: (callback: () => void) => void;
  eventOn?: (eventName: string, callback: () => void) => void | (() => void);
  tavern_events?: { CHAT_CHANGED?: string };
  TavernHelper?: Window['TavernHelper'];
  SillyTavern?: Window['SillyTavern'];
  getCurrentMessageId?: () => string;
  getLastMessageId?: () => number;
  Mvu?: Window['Mvu'];
  waitGlobalInitialized?: Window['waitGlobalInitialized'];
  generate?: (input: unknown) => unknown | Promise<unknown>;
  injectPrompts?: PromptInjectionApi['injectPrompts'];
  getCharWorldbookNames?: (scope?: string) => { primary?: string; additional?: string[] };
  getWorldbook?: (name: string) => Promise<Array<{ uid?: unknown; name?: unknown; comment?: unknown; content?: unknown; enabled?: unknown; disable?: unknown; constant?: unknown; key?: unknown[]; strategy?: { type?: unknown; keys?: unknown[] } }>>;
}

const runtime = globalThis as typeof globalThis & RuntimeGlobals;

interface HostContext {
  window: Window;
  document: Document;
}

interface DaoyuanHostWindow extends Window {
  __daoyuanFeatureCleanup?: () => void;
}

interface YujianLoreEntry {
  uid: string;
  name: string;
  content: string;
  keys: string[];
}

function readYujianSettings(hostWindow: Window): Record<string, string | boolean> {
  try {
    const value = JSON.parse(hostWindow.localStorage.getItem('daoyuan_wx_settings') || '{}') as Record<string, unknown>;
    return {
      customPrompt: typeof value.customPrompt === 'string' && value.customPrompt ? value.customPrompt : DEFAULT_BEAUTY_RANK_PROMPT,
      apiBaseUrl: typeof value.apiBaseUrl === 'string' ? value.apiBaseUrl : '',
      apiKey: typeof value.apiKey === 'string' ? value.apiKey : '',
      apiModel: typeof value.apiModel === 'string' ? value.apiModel : '',
      storyParseEnabled: typeof value.storyParseEnabled === 'boolean' ? value.storyParseEnabled : false,
    };
  } catch {
    return { customPrompt: DEFAULT_BEAUTY_RANK_PROMPT, apiBaseUrl: '', apiKey: '', apiModel: '', storyParseEnabled: false };
  }
}

function readRerollCompatibility(hostWindow: Window): boolean {
  try { return JSON.parse(hostWindow.localStorage.getItem('daoyuan_reroll_compat_v1') || '{}').enabled === true; }
  catch { return false; }
}

function storyFingerprint(story: string): string {
  let hash = 2166136261;
  for (let index = 0; index < story.length; index += 1) {
    hash ^= story.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function readBeautyApiSettings(hostWindow: Window): BeautyRankApiSettings {
  try {
    const value = JSON.parse(hostWindow.localStorage.getItem('daoyuan_beauty_api_settings') || '{}') as Record<string, unknown>;
    return {
      apiBaseUrl: typeof value.apiBaseUrl === 'string' ? value.apiBaseUrl : '',
      apiKey: typeof value.apiKey === 'string' ? value.apiKey : '',
      apiModel: typeof value.apiModel === 'string' ? value.apiModel : '',
      autoEnabled: typeof value.autoEnabled === 'boolean' ? value.autoEnabled : true,
      autoInterval: typeof value.autoInterval === 'number' ? Math.max(0, Math.floor(value.autoInterval)) : 1,
    };
  } catch {
    return { apiBaseUrl: '', apiKey: '', apiModel: '', autoEnabled: true, autoInterval: 1 };
  }
}

function readXianwangApiSettings(hostWindow: Window): XianwangApiSettings {
  try {
    const value = JSON.parse(hostWindow.localStorage.getItem('daoyuan_xianwang_api_settings') || '{}') as Record<string, unknown>;
    return {
      apiBaseUrl: typeof value.apiBaseUrl === 'string' ? value.apiBaseUrl : '',
      apiKey: typeof value.apiKey === 'string' ? value.apiKey : '',
      apiModel: typeof value.apiModel === 'string' ? value.apiModel : '',
      trendsAutoEnabled: typeof value.trendsAutoEnabled === 'boolean' ? value.trendsAutoEnabled : true,
      autoInterval: typeof value.autoInterval === 'number' ? Math.max(0, Math.floor(value.autoInterval)) : 3,
      batchMin: typeof value.batchMin === 'number' ? Math.max(1, Math.floor(value.batchMin)) : 2,
      batchMax: typeof value.batchMax === 'number' ? Math.max(1, Math.floor(value.batchMax)) : 3,
      maxPosts: typeof value.maxPosts === 'number' ? Math.max(1, Math.floor(value.maxPosts)) : 30,
      forumAutoEnabled: typeof value.forumAutoEnabled === 'boolean' ? value.forumAutoEnabled : true,
      forumAutoInterval: typeof value.forumAutoInterval === 'number' ? Math.max(0, Math.floor(value.forumAutoInterval)) : 3,
      forumBatchSize: typeof value.forumBatchSize === 'number' ? Math.max(1, Math.floor(value.forumBatchSize)) : 2,
      forumMaxPosts: typeof value.forumMaxPosts === 'number' ? Math.max(1, Math.floor(value.forumMaxPosts)) : 30,
      newsAutoEnabled: typeof value.newsAutoEnabled === 'boolean' ? value.newsAutoEnabled : true,
      newsAutoInterval: typeof value.newsAutoInterval === 'number' ? Math.max(0, Math.floor(value.newsAutoInterval)) : 5,
      newsBatchSize: typeof value.newsBatchSize === 'number' ? Math.max(1, Math.floor(value.newsBatchSize)) : 1,
      newsMaxPapers: typeof value.newsMaxPapers === 'number' ? Math.max(1, Math.floor(value.newsMaxPapers)) : 12,
      decentralizedMode: value.decentralizedMode === true,
      autoAiReply: value.autoAiReply !== false,
      showHeat: value.showHeat !== false,
      showCommentPreview: value.showCommentPreview !== false,
      jailbreakPrompt: value.jailbreakPrompt !== false,
      generatedCommentCount: typeof value.generatedCommentCount === 'number' ? Math.max(0, Math.min(10, Math.floor(value.generatedCommentCount))) : 3,
    };
  } catch {
    return { apiBaseUrl: '', apiKey: '', apiModel: '', trendsAutoEnabled: true, autoInterval: 3, batchMin: 2, batchMax: 3, maxPosts: 30, forumAutoEnabled: true, forumAutoInterval: 3, forumBatchSize: 2, forumMaxPosts: 30, newsAutoEnabled: true, newsAutoInterval: 5, newsBatchSize: 1, newsMaxPapers: 12, decentralizedMode:false, autoAiReply:true, showHeat:true, showCommentPreview:true, jailbreakPrompt:true, generatedCommentCount:3 };
  }
}

function readPromptInjectionSettings(hostWindow: Window): PromptInjectionSettings {
  try {
    return normalizePromptInjectionSettings(JSON.parse(hostWindow.localStorage.getItem('daoyuan_prompt_injection_settings') || '{}'));
  } catch {
    return { ...DEFAULT_PROMPT_INJECTION_SETTINGS };
  }
}

async function readYujianLore(hostWindow: Window): Promise<YujianLoreEntry[]> {
  const runtime = hostWindow as Window & {
    getCharWorldbookNames?: (scope?: string) => { primary?: string; additional?: string[] };
    getWorldbook?: (name: string) => Promise<Array<{ uid?: unknown; name?: unknown; content?: unknown; enabled?: unknown; strategy?: { keys?: unknown[] } }>>;
  };
  if (typeof runtime.getCharWorldbookNames !== 'function' || typeof runtime.getWorldbook !== 'function') return [];
  const names = runtime.getCharWorldbookNames('current');
  const books = [names.primary, ...(names.additional || [])].filter((name): name is string => Boolean(name));
  const entries: YujianLoreEntry[] = [];
  for (const book of books) {
    try {
      const list = await runtime.getWorldbook(book);
      for (const item of list) {
        if (item.enabled === false) continue;
        entries.push({
          uid: String(item.uid ?? `${book}:${entries.length}`),
          name: typeof item.name === 'string' && item.name ? item.name : '未命名条目',
          content: typeof item.content === 'string' ? item.content : '',
          keys: Array.isArray(item.strategy?.keys) ? item.strategy!.keys!.map(String) : [],
        });
      }
    } catch { /* ignore one unavailable worldbook */ }
  }
  return entries;
}

async function readXianwangRuleLore(hostWindow:Window):Promise<YujianLoreEntry[]> {
  const loreRuntime=hostWindow as Window & RuntimeGlobals;
  if(typeof loreRuntime.getCharWorldbookNames!=='function'||typeof loreRuntime.getWorldbook!=='function')return [];
  const names=loreRuntime.getCharWorldbookNames('current');
  const books=[names.primary,...(names.additional||[])].filter((name):name is string=>Boolean(name));
  const entries:YujianLoreEntry[]=[];
  for(const book of books){try{const list=await loreRuntime.getWorldbook(book);for(const item of list){
    const strategyType=typeof item.strategy?.type==='string'?item.strategy.type.toLowerCase():'';
    if(item.constant!==true&&strategyType!=='constant')continue;
    const content=typeof item.content==='string'?item.content.trim():'';if(!content)continue;
    const rawKeys=Array.isArray(item.strategy?.keys)?item.strategy.keys:Array.isArray(item.key)?item.key:[];
    entries.push({uid:String(item.uid??`${book}:${entries.length}`),name:typeof item.name==='string'&&item.name?item.name:typeof item.comment==='string'&&item.comment?item.comment:'未命名规则',content,keys:rawKeys.map(String)});
  }}catch{/* ignore one unavailable worldbook */}}
  return entries;
}

function buildXianwangLore(entries:YujianLoreEntry[]):string {
  return entries.map(entry=>`【${entry.name}】\n${entry.content}`).join('\n\n');
}

function removeXianwangForbiddenWorldFields(value:unknown):unknown {
  if (Array.isArray(value)) return value.map(removeXianwangForbiddenWorldFields);
  if (!value || typeof value !== 'object') return value;
  const result:Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (key === '动向' || key === '世界动向' || key === '动态') continue;
    result[key] = removeXianwangForbiddenWorldFields(child);
  }
  return result;
}

function serializeXianwangWorldFacts(value:unknown):string {
  return JSON.stringify(removeXianwangForbiddenWorldFields(value)).slice(0, 12000);
}

function resolveHostContext(): HostContext {
  try {
    if (window.parent !== window && window.parent.document?.body) {
      return { window: window.parent, document: window.parent.document };
    }
  } catch {
    // Cross-origin or sandboxed parent: keep the local document as a safe fallback.
  }
  return { window, document };
}

function onReady(callback: () => void): void {
  if (typeof runtime.$ === 'function') runtime.$(callback);
  else callback();
}

class FeatureShell {
  private readonly session: HudSession = createHudSession();
  private readonly preferences: UiPreferences = loadUiPreferences();
  private repository = new ChatVariableRepository({ read: async () => undefined, write: async () => { throw new Error('chat adapter unavailable'); } });
  private appData = emptyAppData;
  private beautyRanks: BeautyRankEntry[] = [];
  private beautyReplies: BeautyRankReply[] = [];
  private trendPosts: TrendPost[] = [];
  private forumPosts: ForumPost[] = [];
  private newsPapers: NewsPaper[] = [];
  private yujianContacts: YujianContactSnapshot[] = [];
  private worldData: unknown = null;
  private inventoryItems: InventoryItemSnapshot[] = [];
  private worldStatus: WorldStatusSnapshot = { time: '未接入', location: '未接入', energy: '未知' };
  private worldDataMessageId: string | number | null = null;
  private mvuChannel: MvuChannelTool | null = null;
  private hostWindow: Window | null = null;
  private hostDocument: Document | null = null;
  private host: HTMLDivElement | null = null;
  private orb: HTMLButtonElement | null = null;
  private petController: ZiweiPetController | null = null;
  private frame: HTMLIFrameElement | null = null;
  private dragStrip: HTMLDivElement | null = null;
  private uiMount: { destroy(): void } | null = null;
  private hostStyle: HTMLStyleElement | null = null;
  private readonly layout: Layout = 'phone';
  private readonly shellMode: ShellMode = 'phone';
  private resizeFrame = 0;
  private shellPosition: { left: number; top: number } | null = null;
  private shellPositionBeforeKeyboard: { left: number; top: number } | null = null;
  private keyboardViewportActive = false;
  private viewportBaselineHeight = 0;
  private viewportBaselineWidth = 0;
  private orbPosition: { left: number; top: number } | null = null;
  private orbDragMoved = false;
  private worldRefreshTimer: number | null = null;
  private reconcileTimer: number | null = null;
  private autoSchedulerTimer: number | null = null;
  private lastWorldProjection = '';
  private beautyGenerationInFlight = false;
  private trendsGenerationInFlight = false;
  private forumGenerationInFlight = false;
  private newsGenerationInFlight = false;
  private yujianStoryParseInFlight = false;
  private autoSchedulerInFlight = false;
  private promptInjectionCleanup: (() => void) | null = null;

  start(): void {
    if (typeof document === 'undefined' || typeof window === 'undefined') return;
    const hostContext = resolveHostContext();
    this.hostWindow = hostContext.window;
    this.hostDocument = hostContext.document;
    this.mvuChannel = new MvuChannelTool(
      () => runtime.Mvu ?? this.hostWindow?.Mvu ?? {},
      () => ({ contextRevision: this.session.contextRevision, messageId: this.session.messageId }),
      () => {
        const wait = runtime.waitGlobalInitialized ?? this.hostWindow?.waitGlobalInitialized;
        return typeof wait === 'function' ? wait('Mvu') : Promise.resolve();
      },
    );
    if (new URLSearchParams(window.location.search).has('preview')) {
      this.worldStatus = {
        time: '元会历·3726年·12月23日·15点45分',
        location: '中央神州·南部·湮丹宗地界\n杏临谷外围·紫灵米药田',
        energy: '100',
      };
      this.beautyRanks = [
        { id: 'preview-beauty-1', name: '般若', rank: '三', title: '大雷音寺佛女', xianzi: '身高一米七三，身姿清雅端方，一袭素衣不染尘埃。容颜圣洁清丽，一头青丝如瀑，气质空灵出尘，仿佛不属于这浊世。双眸澄澈如琉璃，目光温和纯净，透着洗涤人心的慈悲。', qunfangpu: '嘿嘿，这可是大雷音寺那帮秃驴心尖上的佛女，传闻她是观音转世，天生佛心。可私底下谁不惦记她手里那卷《欢喜禅》？若是能把这圣洁不可侵犯的佛女拉下神坛，定能叫仙界茶楼谈上百年。', portrait: '' },
        { id: 'preview-beauty-2', name: '苏琉璃', rank: '九', title: '九尾天狐族公主', xianzi: '身姿曼妙妖娆，曲线玲珑浮凸，尽显天狐一族的绝世风华。容颜倾城，天生媚骨，一双狐眸顾盼生辉，仿佛能勾走男修的三魂七魄。', qunfangpu: '东极青木城的妖狐公主，坊间传言她最爱戏弄正人君子。若有道友能在她的幻境中守住道心，便足以在仙网上吹嘘一辈子。', portrait: '' },
      ];
      const previewCreatedAt = new Date().toISOString();
      this.forumPosts = [{ id:'preview-forum-new',tag:'论道',title:'落英山脉灵压异动后，各宗护山阵法该如何调整？',content:'昨夜落英山脉主峰附近出现持续数个时辰的灵压波动。本文完整整理了三种常见护山阵法受到冲击后的变化，并附上巡山弟子记录。若各位所在宗门也发现阵眼灵石无故发热，请先降低外环阵法的灵力输入，再逐处排查，切勿直接关闭主阵。\n\n据目前回帖汇总，此事未必与魔道有关，也可能是地脉季节性翻涌，仍需等待更多地点的记录交叉验证。',author:'守阵人不熬夜',storyTime:'元会历·3826年·4月29日',likes:3280,comments:[{id:'pf-c1',author:'青崖阵师',content:'我们宗门东南阵眼也出现了类似发热，降低一成灵力后已经稳定。楼主提到的排查次序很有用。',storyTime:'辰时'},{id:'pf-c2',author:'路过的炼器师',content:'灵石发热也可能是阵盘材料疲劳，建议同时检查连接阵纹，别只盯着地脉。',storyTime:'巳时'},{id:'pf-c3',author:'匿名外门弟子',content:'已把帖子转给执事堂，希望他们这次别等阵法冒烟才处理。',storyTime:'午时'}],generatedBy:'ai',createdAt:previewCreatedAt },{ id:'preview-forum-old',tag:'求助',title:'第一次独自去坊市收购丹材，需要避开什么坑？',content:'准备替师门采购一批常用丹材，想请教验货与议价的注意事项。',author:'新手丹童',storyTime:'元会历·3826年·4月28日',likes:120,comments:[{id:'pf-c4',author:'百草铺掌柜',content:'先看年份，再看保存灵匣，价格反而放在最后谈。',storyTime:'昨日'}],generatedBy:'ai',createdAt:new Date(Date.now()-86400000).toISOString() }];
      this.newsPapers = [{id:'preview-news',title:'天机日报',issue:'第3826期',editor:'闻玄机',editorNote:'山河有异，众说纷纭。本期以可核验的巡查记录为骨，不以传言作定论。',storyTime:'元会历·3826年·4月29日',likes:6800,articles:[{tag:'头条',source:'本报记者·照夜',title:'落英山脉多地记录灵压波动，各宗启动联合巡查',content:'自昨日入夜起，落英山脉周边多个观测点先后记录到灵压变化。联合巡查队已沿主要地脉节点展开查验，目前尚未发现大范围阵法损毁。各宗提醒过往修士避开临时封锁区域，并以正式通告为准。'},{tag:'宗门',source:'驻宗记者·青简',title:'桃花宗公布春季外门考核章程',content:'新章程调整了实战与基础术法的权重，并增设阵法常识项目。负责执事表示，此举旨在提高弟子外出历练时的自保能力。'},{tag:'坊市',source:'商讯台',title:'常用阵材价格小幅上涨',content:'受近期巡查需求影响，聚灵石与阵纹铜价格出现波动。商会称库存总体充足，提醒修士勿因传言囤积。'}],letters:[{author:'南门茶客',content:'希望后续继续追踪联合巡查结果，也请整理各地临时封路信息。'},{author:'无名阵修',content:'头条没有把猜测写成结论，这一点比仙网上的传言可靠。'}],generatedBy:'ai',createdAt:previewCreatedAt}];
    }
    // Tavern Helper disables/deletes a script by removing its hidden
    // TH-script iframe. That fires pagehide on this execution window, not on
    // the SillyTavern host window where the HUD nodes are mounted.
    const onScriptPagehide = (): void => this.destroy();
    window.addEventListener('pagehide', onScriptPagehide, { once: true });
    this.session.disposers.push(() => window.removeEventListener('pagehide', onScriptPagehide));
    this.repository = new ChatVariableRepository(createTavernChatVariableAdapter(this.hostWindow));
    void initPortraits();
    this.session.disposers.push(onPortraitsUpdated(() => { void this.loadWorldData(); }));
    this.syncChatContext();
    const hostRuntime = this.hostWindow as DaoyuanHostWindow;
    try {
      hostRuntime.__daoyuanFeatureCleanup?.();
    } catch (error) {
      console.warn('[道渊玉简] 旧实例清理失败，将继续移除旧宿主节点', error);
    }
    // 旧版本可能已经创建了重复 id；按 id 单点移除会留下其他实例。
    this.hostDocument
      .querySelectorAll(`#${HOST_ID}, #${ORB_ID}, style[data-daoyuan="${SCRIPT_ID}"]`)
      .forEach((node) => node.remove());
    this.session.phase = 'opening';
    const cleanup = (): void => this.destroy();
    hostRuntime.__daoyuanFeatureCleanup = cleanup;
    this.session.disposers.push(() => {
      if (hostRuntime.__daoyuanFeatureCleanup === cleanup) delete hostRuntime.__daoyuanFeatureCleanup;
    });
    this.host = this.hostDocument.createElement('div');
    this.host.id = HOST_ID;
    this.host.dataset.mode = 'phone';
    this.host.hidden = true;
    this.hostDocument.body.append(this.host);

    this.hostStyle = this.hostDocument.createElement('style');
    this.hostStyle.dataset.daoyuan = SCRIPT_ID;
    this.hostStyle.textContent = shellCss;
    this.hostDocument.head.append(this.hostStyle);

    this.orb = this.hostDocument.createElement('button');
    this.orb.id = ORB_ID;
    this.orb.type = 'button';
    this.orb.title = '打开天机阁随身玉简';
    this.orb.setAttribute('aria-label', '打开天机阁随身玉简');
    this.orb.innerHTML = '<img class="ziwei-pet-frame" alt="紫薇桌宠" draggable="false">';
    this.hostDocument.body.append(this.orb);
    const petImage = this.orb.querySelector<HTMLImageElement>('.ziwei-pet-frame');
    if (petImage) {
      this.petController = new ZiweiPetController(this.orb, petImage, () => this.open());
      this.petController.setSize(readPetSize(this.hostWindow));
    }
    this.bindOrbDrag();

    this.dragStrip = this.hostDocument.createElement('div');
    this.dragStrip.className = 'daoyuan-hud-drag-strip';
    this.dragStrip.title = '拖动移动玉简';
    this.dragStrip.setAttribute('aria-label', '拖动移动玉简');
    this.host.append(this.dragStrip);
    this.bindShellDrag();

    this.bindHostEvents();
    void this.bindMvuChannelEvents();
    this.positionOrb();
    this.session.phase = 'ready';
    void this.loadAppData();
    void this.loadWorldData();
    if (new URLSearchParams(window.location.search).has('preview')) this.open();
  }

  private async loadAppData(): Promise<void> {
    const operationContext = captureOperationContext(this.session);
    try {
      const appData = await this.repository.load();
      if (this.session.phase === 'destroyed' || !isCurrentOperationContext(this.session, operationContext)) return;
      this.appData = appData;
      if (!new URLSearchParams(window.location.search).has('preview')) {
        const beautyData = parseBeautyRankData(this.repository.getData('daoyuan_web_beauty_data'));
        this.beautyRanks = beautyData.entries;
        this.beautyReplies = beautyData.replies;
        this.trendPosts = parseTrendsData(this.repository.getData('daoyuan_web_trends_data')).posts;
        this.forumPosts = parseForumData(this.repository.getData('daoyuan_forum_data')).posts;
        const storedNews = parseNewsData(this.repository.getData('daoyuan_news_data'));
        this.newsPapers = normalizeNewsIssueSequence(storedNews.papers);
        if (this.newsPapers.some((paper, index) => paper.issue !== storedNews.papers[index]?.issue)) {
          await this.repository.write('daoyuan_news_data', { ...storedNews, papers: this.newsPapers });
          this.appData = this.repository.project();
        }
      }
      this.sendContext();
      this.refreshPromptInjection();
      this.scheduleDerivedReconciliation();
    } catch (error) {
      console.warn('[道渊玉简] chat data unavailable; using empty data', error);
    }
  }

  private async loadWorldData(): Promise<void> {
    const operationContext = captureOperationContext(this.session);
    this.syncChatContext();
    const hostMvu = runtime.Mvu ?? this.hostWindow?.Mvu;
    const snapshot = await this.mvuChannel?.readLatestVariables();
    if (!isCurrentOperationContext(this.session, operationContext)) return;
    this.syncChatContext();
    if (!snapshot || snapshot.reason === 'stale-context') {
      this.scheduleWorldDataRefresh(0);
      return;
    }
    let data = snapshot.variables;
    this.worldData = snapshot.variables;
    this.inventoryItems = projectInventory(snapshot.variables);
    this.worldStatus = projectWorldStatus(snapshot.variables);
    if (!snapshot.ready && new URLSearchParams(window.location.search).has('preview')) {
      this.worldStatus = {
        time: '元会历·3726年·12月23日·15点45分',
        location: '中央神州·南部·湮丹宗地界\n杏临谷外围·紫灵米药田',
        energy: '100',
      };
    }
    this.worldDataMessageId = snapshot.messageId;
    this.publishMvuChannelSnapshot();
    this.sendContext();
    // Preserve the existing Yujian/contact projection behavior. The new
    // message-floor stat_data bridge above is deliberately independent.
    if (typeof hostMvu?.getMvuData === 'function') {
      try { data = await hostMvu.getMvuData({ type: 'chat' }); } catch { /* keep latest fallback */ }
    }
    const chatId = this.session.chatId ?? '__default__';
    const histories = this.hostWindow ? loadStandaloneYujianHistories(this.hostWindow, chatId) : {};
    const currentContacts = projectNpcContacts(data, histories);
    const rememberedContacts = this.hostWindow ? loadStandaloneKnownContacts(this.hostWindow, chatId) : [];
    const contactMap = new Map<string, YujianContactSnapshot>();
    for (const contact of rememberedContacts) {
      const history = histories[contact.name] ?? [];
      const last = history.at(-1);
      contactMap.set(contact.name, {
        ...contact,
        preview: last?.text ?? '尚未开始传讯',
        time: last?.time ?? '',
        history,
      });
    }
    // 当前在场资料优先，重新遇见时刷新好感度、关系、境界和立绘。
    for (const contact of currentContacts) {
      const remembered = contactMap.get(contact.name);
      const affection = contact.affection ?? remembered?.affection;
      const detailWithoutAffection = contact.detail.replace(/^(?:好感|亲密)\s+[^·]+(?:\s*·\s*)?/, '');
      contactMap.set(contact.name, {
        ...remembered,
        ...contact,
        affection,
        affectionLabel: contact.affectionLabel ?? remembered?.affectionLabel,
        detail: affection !== undefined
          ? [`${contact.affectionLabel === '亲密度' ? '亲密' : '好感'} ${affection}`, detailWithoutAffection].filter(Boolean).join(' · ')
          : contact.detail,
      });
    }
    const affections = projectYujianAffections(data);
    for (const [name, affection] of Object.entries(affections)) {
      const contact = contactMap.get(name);
      // 当前人物/道侣档案与独立通讯录保存值优先；状态栏玉简仅作缺值兜底。
      if (!contact || contact.affection !== undefined) continue;
      const detailWithoutAffection = contact.detail.replace(/^(?:好感|亲密)\s+[^·]+(?:\s*·\s*)?/, '');
      contactMap.set(name, {
        ...contact,
        affection,
        affectionLabel: '好感度',
        detail: [`好感 ${affection}`, detailWithoutAffection].filter(Boolean).join(' · '),
      });
    }
    const nextContacts = [...contactMap.values()];
    if (this.hostWindow && nextContacts.length) rememberStandaloneKnownContacts(this.hostWindow, chatId, nextContacts);
    const nextProjection = JSON.stringify(nextContacts);
    if (nextProjection === this.lastWorldProjection) return;
    this.lastWorldProjection = nextProjection;
    this.yujianContacts = nextContacts;
    this.appData = { ...this.appData, yujian: { ...this.appData.yujian, contacts: this.yujianContacts.length } };
    this.sendContext();
  }

  private scheduleWorldDataRefresh(delayMs = 120): void {
    if (this.worldRefreshTimer !== null) window.clearTimeout(this.worldRefreshTimer);
    this.worldRefreshTimer = window.setTimeout(() => {
      this.worldRefreshTimer = null;
      void this.loadWorldData();
    }, delayMs);
  }

  private scheduleDerivedReconciliation(delayMs = 220): void {
    if (this.reconcileTimer !== null) window.clearTimeout(this.reconcileTimer);
    this.reconcileTimer = window.setTimeout(() => {
      this.reconcileTimer = null;
      void this.reconcileDerivedContent();
    }, delayMs);
  }

  private scheduleAutoScheduler(delayMs = 420): void {
    if (this.autoSchedulerTimer !== null) window.clearTimeout(this.autoSchedulerTimer);
    this.autoSchedulerTimer = window.setTimeout(() => {
      this.autoSchedulerTimer = null;
      void this.handleMvuUpdateStarted();
    }, delayMs);
  }

  private async reconcileDerivedContent(): Promise<void> {
    if (!this.hostWindow || !this.session.chatId || this.session.phase === 'destroyed') return;
    const chat = this.hostWindow.SillyTavern?.getContext?.()?.chat;
    if (!Array.isArray(chat)) return;
    const sources = new Map<string, string>();
    chat.forEach((raw, index) => {
      const message = raw as { is_user?: boolean; is_system?: boolean; mes?: unknown };
      if (message.is_user === false && message.is_system !== true && typeof message.mes === 'string') {
        sources.set(String(index), storyFingerprint(message.mes));
      }
    });
    const idByFingerprint = new Map([...sources].map(([id, fingerprint]) => [fingerprint, id]));
    const chatId = this.session.chatId;
    const removedYujian = reconcileAutoYujianRecords(this.hostWindow, chatId, sources);
    const reconcileMeta = <T extends { processedMessageIds: string[]; processedSwipeKeys: string[]; triggeredMessageIds: string[]; triggeredSwipeKeys: string[]; autoCounter: number }>(data: T, interval: number): T => {
      if (!data.processedSwipeKeys.length) return data;
      const processedFingerprints = new Set(data.processedSwipeKeys.map(key => key.slice(key.indexOf(':') + 1)));
      const triggeredFingerprints = new Set(data.triggeredSwipeKeys.length
        ? data.triggeredSwipeKeys.map(key => key.slice(key.indexOf(':') + 1))
        : data.processedSwipeKeys.flatMap(key => {
          const split = key.indexOf(':');
          return data.triggeredMessageIds.includes(key.slice(0, split)) ? [key.slice(split + 1)] : [];
        }));
      const processedMessageIds = [...sources].filter(([, fp]) => processedFingerprints.has(fp)).map(([id]) => id);
      const processedSwipeKeys = [...sources].filter(([, fp]) => processedFingerprints.has(fp)).map(([id, fp]) => `${id}:${fp}`).slice(-400);
      const triggeredMessageIds = [...sources].filter(([, fp]) => triggeredFingerprints.has(fp)).map(([id]) => id).slice(-200);
      const triggeredSwipeKeys = [...sources].filter(([, fp]) => triggeredFingerprints.has(fp)).map(([id, fp]) => `${id}:${fp}`).slice(-200);
      const lastTrigger = triggeredMessageIds.length ? Math.max(...triggeredMessageIds.map(Number)) : -1;
      const sinceTrigger = processedMessageIds.filter(id => Number(id) > lastTrigger).length;
      return { ...data, processedMessageIds: processedMessageIds.slice(-200), processedSwipeKeys, triggeredMessageIds, triggeredSwipeKeys, autoCounter: interval > 0 ? sinceTrigger % interval : 0 };
    };

    const trendSettings = readXianwangApiSettings(this.hostWindow);
    const trends = parseTrendsData(this.repository.getData('daoyuan_web_trends_data'));
    const nextTrendsPosts = this.trendPosts.flatMap(post => {
      if (post.generatedBy !== 'ai' || !post.sourceFingerprint) return [post];
      const sourceMessageId = idByFingerprint.get(post.sourceFingerprint);
      return sourceMessageId ? [{ ...post, sourceMessageId }] : [];
    });
    const nextTrends = reconcileMeta({ ...trends, posts: nextTrendsPosts }, trendSettings.autoInterval);

    const forum = parseForumData(this.repository.getData('daoyuan_forum_data'));
    const nextForumPosts = this.forumPosts.flatMap(post => {
      if (post.generatedBy !== 'ai' || !post.sourceFingerprint) return [post];
      const sourceMessageId = idByFingerprint.get(post.sourceFingerprint);
      return sourceMessageId ? [{ ...post, sourceMessageId }] : [];
    });
    const nextForum = reconcileMeta({ ...forum, posts: nextForumPosts }, trendSettings.forumAutoInterval);

    const news = parseNewsData(this.repository.getData('daoyuan_news_data'));
    const nextNewsPapers = this.newsPapers.flatMap(paper => {
      if (!paper.sourceFingerprint) return [paper];
      const sourceMessageId = idByFingerprint.get(paper.sourceFingerprint);
      return sourceMessageId ? [{ ...paper, sourceMessageId }] : [];
    });
    const nextNews = reconcileMeta({ ...news, papers: nextNewsPapers }, trendSettings.newsAutoInterval);

    const changed = removedYujian > 0
      || JSON.stringify(nextTrends) !== JSON.stringify(trends)
      || JSON.stringify(nextForum) !== JSON.stringify(forum)
      || JSON.stringify(nextNews) !== JSON.stringify(news);
    if (!changed) return;
    await this.repository.write('daoyuan_web_trends_data', nextTrends);
    await this.repository.write('daoyuan_forum_data', nextForum);
    await this.repository.write('daoyuan_news_data', nextNews);
    this.trendPosts = nextTrendsPosts;
    this.forumPosts = nextForumPosts;
    this.newsPapers = normalizeNewsIssueSequence(nextNewsPapers);
    this.appData = this.repository.project();
    this.lastWorldProjection = '';
    await this.loadWorldData();
    this.refreshPromptInjection();
    this.sendContext();
  }

  private syncChatContext(): void {
    try {
      const hostRuntime = this.hostWindow as (Window & RuntimeGlobals) | null;
      const context = hostRuntime?.SillyTavern?.getContext?.();
      this.session.chatId = typeof context?.chatId === 'string' ? context.chatId : null;
      const chatReady = Array.isArray(context?.chat) && context.chat.length > 0;
      let lastMessageId: number | undefined;
      try {
        const getLastMessageId = runtime.getLastMessageId ?? hostRuntime?.getLastMessageId;
        if (typeof getLastMessageId === 'function') lastMessageId = getLastMessageId();
      } catch { /* MVU accepts latest as the script-context fallback */ }
      const inferredLastMessageId = chatReady ? context!.chat!.length - 1 : null;
      this.session.messageId = Number.isInteger(lastMessageId) && (lastMessageId as number) >= 0
        ? String(lastMessageId)
        : inferredLastMessageId !== null ? String(inferredLastMessageId) : null;
    } catch {
      this.session.chatId = null;
      this.session.messageId = null;
    }
  }

  private bindHostEvents(): void {
    if (!this.hostWindow) return;
    const onMessage = (event: MessageEvent): void => {
      if (!this.frame || event.source !== this.frame.contentWindow) return;
      const message = parseBridgeMessage(event.data);
      if (!message) return;
      if (message.action === 'APP_READY' || message.action === 'REQUEST_CONTEXT') this.sendContext();
      if (message.action === 'SET_LAYOUT') {
        this.preferences.layoutMode = 'phone';
        saveUiPreferences(this.preferences);
        this.resize();
      }
      if (message.action === 'SET_ACTIVE_APP' && typeof message.payload.app === 'string') {
        this.preferences.lastApp = message.payload.app;
        saveUiPreferences(this.preferences);
      }
      if (message.action === 'SET_MAP_VIEW') void this.saveMapView(message.payload);
      if (message.action === 'CLOSE_SHELL') this.close();
      if (message.action === 'REQUEST_DIAGNOSTIC') this.sendContext();
      if (message.action === 'REQUEST_MVU_CHANNEL') this.sendMvuChannelSnapshot();
      if (message.action === 'REPLACE_MVU_CHANNEL_STAT_DATA') {
        void this.replaceStatData({ ...message.payload, contextRevision: message.contextRevision });
      }
    };
    this.hostWindow.addEventListener('message', onMessage);
    this.session.disposers.push(() => this.hostWindow?.removeEventListener('message', onMessage));

    const onResize = (): void => {
      cancelAnimationFrame(this.resizeFrame);
      this.resizeFrame = requestAnimationFrame(() => this.resize());
    };
    this.hostWindow.addEventListener('resize', onResize, { passive: true });
    this.hostWindow.visualViewport?.addEventListener('resize', onResize, { passive: true });
    this.hostWindow.addEventListener('orientationchange', onResize, { passive: true });
    this.session.disposers.push(() => {
      this.hostWindow?.removeEventListener('resize', onResize);
      this.hostWindow?.visualViewport?.removeEventListener('resize', onResize);
      this.hostWindow?.removeEventListener('orientationchange', onResize);
      cancelAnimationFrame(this.resizeFrame);
    });

    const hostRuntime = this.hostWindow as Window & RuntimeGlobals;
    const chatChanged = runtime.tavern_events?.CHAT_CHANGED
      ?? hostRuntime.TavernHelper?.tavern_events?.CHAT_CHANGED
      ?? hostRuntime.tavern_events?.CHAT_CHANGED;
    const hostEventSource = hostRuntime.SillyTavern?.getContext?.()?.eventSource;
    const eventOn = runtime.eventOn ?? hostRuntime.eventOn;
    const onChatChanged = (): void => {
      this.clearPromptInjection();
      resetYujianRuntimeContext();
      this.syncChatContext();
      changeContext(this.session);
      this.appData = emptyAppData;
      this.beautyRanks = [];
      this.beautyReplies = [];
      this.trendPosts = [];
      this.forumPosts = [];
      this.newsPapers = [];
      this.yujianContacts = [];
      this.worldData = null;
      this.inventoryItems = [];
      this.worldStatus = { time: '未接入', location: '未接入', energy: '未知' };
      this.worldDataMessageId = null;
      this.publishMvuChannelSnapshot();
      this.lastWorldProjection = '';
      this.sendContext();
      void this.loadAppData();
      void this.loadWorldData();
    };
    if (chatChanged && hostEventSource && typeof hostEventSource.on === 'function') {
      hostEventSource.on(chatChanged, onChatChanged);
      this.session.disposers.push(() => hostEventSource.removeListener(chatChanged, onChatChanged));
    } else if (chatChanged && typeof eventOn === 'function') {
      const disposer = eventOn(chatChanged, onChatChanged);
      if (typeof disposer === 'function') this.session.disposers.push(disposer);
    }
    if (hostEventSource && typeof hostEventSource.on === 'function') {
      const eventNames = ['MESSAGE_RECEIVED', 'MESSAGE_UPDATED', 'MESSAGE_EDITED', 'MESSAGE_SWIPED', 'MESSAGE_SENT', 'GENERATION_ENDED']
        .map(name => hostRuntime.TavernHelper?.tavern_events?.[name as keyof NonNullable<Window['TavernHelper']>['tavern_events']] ?? undefined)
        .filter((event): event is string => typeof event === 'string');
      for (const eventName of new Set(eventNames)) {
        const delay = eventName === hostRuntime.TavernHelper?.tavern_events?.GENERATION_ENDED ? 320 : 120;
        const listener = (): void => {
          this.scheduleWorldDataRefresh(delay);
          this.scheduleDerivedReconciliation(delay + 80);
          if (eventName === hostRuntime.TavernHelper?.tavern_events?.MESSAGE_RECEIVED
            || eventName === hostRuntime.TavernHelper?.tavern_events?.GENERATION_ENDED) {
            this.scheduleAutoScheduler(delay + 120);
          }
        };
        hostEventSource.on(eventName, listener);
        this.session.disposers.push(() => hostEventSource.removeListener(eventName, listener));
      }
    }

    const pagehide = (): void => this.destroy();
    this.hostWindow.addEventListener('pagehide', pagehide, { once: true });
    this.session.disposers.push(() => this.hostWindow?.removeEventListener('pagehide', pagehide));
  }

  private async bindMvuChannelEvents(): Promise<void> {
    const mvu = await this.mvuChannel?.waitUntilReady();
    if (!mvu || this.session.phase === 'destroyed' || !this.hostWindow) return;
    const hostRuntime = this.hostWindow as Window & RuntimeGlobals;
    const eventSource = runtime.SillyTavern?.getContext?.()?.eventSource
      ?? hostRuntime.SillyTavern?.getContext?.()?.eventSource;
    const eventOn = runtime.eventOn ?? hostRuntime.eventOn;
    if ((!eventSource || typeof eventSource.on !== 'function') && typeof eventOn !== 'function') {
      // The channel reader retains its bounded polling fallback when this
      // installed runtime does not expose the core event source.
      this.scheduleWorldDataRefresh(0);
      return;
    }
    const eventNames = [mvu.events?.VARIABLE_INITIALIZED, mvu.events?.VARIABLE_UPDATE_ENDED]
      .filter((event): event is string => typeof event === 'string');
    const refresh = (): void => this.scheduleWorldDataRefresh(0);
    for (const eventName of new Set(eventNames)) {
      if (eventSource && typeof eventSource.on === 'function') {
        eventSource.on(eventName, refresh);
        this.session.disposers.push(() => eventSource.removeListener(eventName, refresh));
      } else if (typeof eventOn === 'function') {
        const disposer = eventOn(eventName, refresh);
        if (typeof disposer === 'function') this.session.disposers.push(disposer);
      }
    }
    const updateStarted = mvu.events?.VARIABLE_UPDATE_STARTED;
    if (typeof updateStarted === 'string') {
      const runAutoGeneration = (): void => { void this.handleMvuUpdateStarted(); };
      if (eventSource && typeof eventSource.on === 'function') {
        eventSource.on(updateStarted, runAutoGeneration);
        this.session.disposers.push(() => eventSource.removeListener(updateStarted, runAutoGeneration));
      } else if (typeof eventOn === 'function') {
        const disposer = eventOn(updateStarted, runAutoGeneration);
        if (typeof disposer === 'function') this.session.disposers.push(disposer);
      }
    }
    // Initialization may have completed between wait resolution and listener
    // registration, so always perform one immediate catch-up read.
    this.scheduleWorldDataRefresh(0);
  }

  private async saveMapView(payload: Record<string, unknown>): Promise<void> {
    const selectedRealm: MapRealm = payload.selectedRealm === '仙界' ? '仙界' : '玄天界';
    const selectedNode = normalizeMapNode(selectedRealm, typeof payload.selectedNode === 'string' ? payload.selectedNode : 'center');
    this.appData = { ...this.appData, map: { selectedRealm, selectedNode } };
    try {
      this.appData = await this.repository.write('daoyuan_map_state', { selectedRealm, selectedNode });
    } catch (error) {
      if (!new URLSearchParams(window.location.search).has('preview')) console.warn('[道渊地图] 查看状态保存失败', error);
    }
    this.sendContext();
  }

  private handleUiAction(action: Parameters<typeof makeBridgeMessage>[1], payload: Record<string, unknown> = {}): void {
    if (action === 'APP_READY' || action === 'REQUEST_CONTEXT') this.sendContext();
    if (action === 'SET_LAYOUT') {
      this.preferences.layoutMode = 'phone';
      saveUiPreferences(this.preferences);
      this.resize();
    }
    if (action === 'SET_ACTIVE_APP' && typeof payload.app === 'string') {
      this.preferences.lastApp = payload.app;
      saveUiPreferences(this.preferences);
    }
    if (action === 'SET_PET_SIZE' && (payload.size === 'small' || payload.size === 'medium' || payload.size === 'large')) {
      const size = payload.size as PetSize;
      if (this.hostWindow) savePetSize(this.hostWindow, size);
      this.petController?.setSize(size);
      this.positionOrb();
      this.sendContext();
    }
    if (action === 'SET_MAP_VIEW') void this.saveMapView(payload);
    if (action === 'CLOSE_SHELL') this.close();
    if (action === 'REQUEST_DIAGNOSTIC') this.sendContext();
    if (action === 'REQUEST_MVU_CHANNEL') this.sendMvuChannelSnapshot();
    if (action === 'REPLACE_MVU_CHANNEL_STAT_DATA') void this.replaceStatData(payload);
    if (action === 'REQUEST_YUJIAN_LORE') void this.sendYujianLore();
    if (action === 'REQUEST_YUJIAN_MODELS') void this.sendYujianModels(payload);
    if (action === 'SAVE_YUJIAN_SETTINGS') this.saveYujianSettings(payload);
    if (action === 'IMPORT_STATUS_YUJIAN_HISTORY') void this.importStatusYujianHistory(true);
    if (action === 'DELETE_YUJIAN_MESSAGE') void this.deleteYujianMessage(payload);
    if (action === 'CLEAR_YUJIAN_HISTORY') void this.clearYujianHistory(payload);
    if (action === 'SAVE_REROLL_SETTINGS') this.saveRerollSettings(payload);
    if (action === 'REQUEST_BEAUTY_MODELS') void this.sendBeautyModels(payload);
    if (action === 'SAVE_BEAUTY_SETTINGS') this.saveBeautySettings(payload);
    if (action === 'REQUEST_XIANWANG_MODELS') void this.sendXianwangModels(payload);
    if (action === 'SAVE_XIANWANG_SETTINGS') this.saveXianwangSettings(payload);
    if (action === 'SAVE_PROMPT_INJECTION_SETTINGS') this.savePromptInjectionSettings(payload);
    if (action === 'GENERATE_TRENDS') void this.generateTrendPosts(undefined, false, true);
    if (action === 'DELETE_TREND') void this.deleteTrendPost(payload);
    if (action === 'GENERATE_FORUM') void this.generateForumContent(undefined, false, true);
    if (action === 'DELETE_FORUM_POST') void this.deleteForumPost(payload);
    if (action === 'GENERATE_NEWS') void this.generateNewsContent(undefined, false, true);
    if (action === 'DELETE_NEWS_PAPER') void this.deleteNewsPaper(payload);
    if (action === 'TOGGLE_TREND_LIKE') void this.toggleXianwangLike('trends', payload);
    if (action === 'TOGGLE_FORUM_LIKE') void this.toggleXianwangLike('forum', payload);
    if (action === 'TOGGLE_NEWS_LIKE') void this.toggleXianwangLike('news', payload);
    if (action === 'SUBMIT_FORUM_COMMENT') void this.submitForumComment(payload);
    if (action === 'GENERATE_BEAUTY_RANK') void this.generateBeautyRank();
    if (action === 'GENERATE_BEAUTY_REPLY') void this.generateBeautyReply(payload);
    if (action === 'SEND_YUJIAN_MESSAGE') {
      const charName = typeof payload.charName === 'string' ? payload.charName.trim() : '';
      const text = typeof payload.text === 'string' ? payload.text.trim() : '';
      void this.sendYujianMessage(charName, text);
    }
  }

  private publishMvuChannelSnapshot(): void {
    if (!this.hostWindow) return;
    this.hostWindow.__daoyuanMvuChannel = Object.freeze({
      name: MVU_CHANNEL_NAME,
      ready: this.worldDataMessageId !== null && this.worldData !== null,
      contextRevision: this.session.contextRevision,
      messageId: this.worldDataMessageId,
      variables: this.worldData,
      readAt: this.worldDataMessageId !== null ? new Date().toISOString() : null,
    });
  }

  private sendMvuChannelSnapshot(): void {
    this.frame?.contentWindow?.postMessage(makeBridgeMessage('response', 'MVU_CHANNEL_SNAPSHOT', {
      channel: MVU_CHANNEL_NAME,
      ready: this.worldDataMessageId !== null && this.worldData !== null,
      messageId: this.worldDataMessageId,
      variables: this.worldData,
    }, this.session.contextRevision), '*');
  }

  private async replaceStatData(payload: Record<string, unknown>): Promise<void> {
    const frame = this.frame;
    this.syncChatContext();
    const requestedRevision = payload.contextRevision;
    const requestedMessageId = payload.messageId;
    if (
      requestedRevision !== this.session.contextRevision
      || requestedMessageId !== this.worldDataMessageId
      || requestedMessageId !== this.session.messageId
    ) {
      frame?.contentWindow?.postMessage(makeBridgeMessage('response', 'MVU_CHANNEL_WRITE_STATUS', {
        channel: MVU_CHANNEL_NAME,
        ok: false,
        error: 'stale-world-data-context',
        messageId: this.worldDataMessageId,
      }, this.session.contextRevision), '*');
      return;
    }
    if (requestedMessageId === null || requestedMessageId === undefined) return;
    const statData = payload.statData && typeof payload.statData === 'object' && !Array.isArray(payload.statData)
      ? payload.statData as Record<string, unknown>
      : null;
    if (!statData) {
      frame?.contentWindow?.postMessage(makeBridgeMessage('response', 'MVU_CHANNEL_WRITE_STATUS', {
        channel: MVU_CHANNEL_NAME,
        ok: false,
        reason: 'invalid-stat-data',
        messageId: requestedMessageId,
      }, this.session.contextRevision), '*');
      return;
    }
    const result = await this.mvuChannel?.replaceLatestStatData(statData, {
      contextRevision: this.session.contextRevision,
      messageId: requestedMessageId as string | number,
    });
    if (!result) return;
    if (result.contextRevision !== this.session.contextRevision || requestedMessageId !== this.worldDataMessageId) return;
    if (result.written) {
      this.worldData = result.data;
      this.publishMvuChannelSnapshot();
      this.scheduleWorldDataRefresh(0);
    }
    frame?.contentWindow?.postMessage(makeBridgeMessage('response', 'MVU_CHANNEL_WRITE_STATUS', {
      channel: MVU_CHANNEL_NAME,
      ok: result.written,
      reason: result.reason,
      messageId: result.messageId,
      statData: result.data && typeof result.data === 'object'
        ? (result.data as { stat_data?: unknown }).stat_data ?? null
        : null,
    }, this.session.contextRevision), '*');
  }

  private async sendYujianLore(): Promise<void> {
    const frame = this.frame;
    if (!this.hostWindow) return;
    const loreWindow = typeof runtime.getCharWorldbookNames === 'function' && typeof runtime.getWorldbook === 'function'
      ? runtime as unknown as Window
      : this.hostWindow;
    const entries = await readYujianLore(loreWindow);
    frame?.contentWindow?.postMessage(makeBridgeMessage('event', 'YUJIAN_LORE_DATA', { entries }), '*');
  }

  private async importStatusYujianHistory(notify = true): Promise<void> {
    const frame = this.frame;
    if (!this.hostWindow) return;
    this.syncChatContext();
    const chatId = this.session.chatId ?? '__default__';
    const hostMvu = runtime.Mvu ?? this.hostWindow.Mvu;
    if (typeof hostMvu?.getMvuData !== 'function') {
      if (notify) frame?.contentWindow?.postMessage(makeBridgeMessage('event', 'YUJIAN_HISTORY_IMPORT_STATUS', {
        ok: false,
        error: '当前酒馆未提供可读取的 MVU 状态栏数据',
      }), '*');
      return;
    }
    try {
      const snapshot = await hostMvu.getMvuData({ type: 'chat' });
      const contacts = projectYujianContacts(snapshot);
      const result = importStatusYujianHistories(this.hostWindow, chatId, contacts);
      if (contacts.length) rememberStandaloneKnownContacts(this.hostWindow, chatId, contacts);
      this.lastWorldProjection = '';
      await this.loadWorldData();
      if (notify || result.imported > 0) frame?.contentWindow?.postMessage(makeBridgeMessage('event', 'YUJIAN_HISTORY_IMPORT_STATUS', {
        ok: true,
        ...result,
        availableContacts: contacts.length,
        automatic: !notify,
      }), '*');
    } catch (error) {
      if (notify) frame?.contentWindow?.postMessage(makeBridgeMessage('event', 'YUJIAN_HISTORY_IMPORT_STATUS', {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      }), '*');
    }
  }

  private async deleteYujianMessage(payload: Record<string, unknown>): Promise<void> {
    if (!this.hostWindow || !this.session.chatId) return;
    const charName = typeof payload.charName === 'string' ? payload.charName.trim() : '';
    const index = typeof payload.index === 'number' && Number.isInteger(payload.index) ? payload.index : -1;
    const from = payload.from === 'me' || payload.from === 'them' ? payload.from : null;
    const text = typeof payload.text === 'string' ? payload.text : '';
    const time = typeof payload.time === 'string' ? payload.time : '';
    const ok = Boolean(charName && index >= 0 && from && deleteStandaloneYujianRecord(
      this.hostWindow, this.session.chatId, charName, index, { from: from!, text, time },
    ));
    if (ok) {
      this.lastWorldProjection = '';
      await this.loadWorldData();
      this.refreshPromptInjection();
    }
    this.frame?.contentWindow?.postMessage(makeBridgeMessage('event', 'YUJIAN_HISTORY_DELETE_STATUS', {
      ok,
      mode: 'single',
      error: ok ? '' : '聊天记录已变化，请刷新后重试',
    }), '*');
  }

  private async clearYujianHistory(payload: Record<string, unknown>): Promise<void> {
    if (!this.hostWindow || !this.session.chatId) return;
    const charName = typeof payload.charName === 'string' ? payload.charName.trim() : '';
    const removed = charName ? clearStandaloneYujianHistory(this.hostWindow, this.session.chatId, charName) : 0;
    this.lastWorldProjection = '';
    await this.loadWorldData();
    this.refreshPromptInjection();
    this.frame?.contentWindow?.postMessage(makeBridgeMessage('event', 'YUJIAN_HISTORY_DELETE_STATUS', {
      ok: true,
      mode: 'clear',
      removed,
    }), '*');
  }

  private async sendYujianModels(payload: Record<string, unknown>): Promise<void> {
    const frame = this.frame;
    try {
      const models = await fetchYujianModels(
        typeof payload.apiBaseUrl === 'string' ? payload.apiBaseUrl : '',
        typeof payload.apiKey === 'string' ? payload.apiKey : '',
      );
      frame?.contentWindow?.postMessage(makeBridgeMessage('event', 'YUJIAN_MODELS_DATA', { ok: true, models }), '*');
    } catch (error) {
      frame?.contentWindow?.postMessage(makeBridgeMessage('event', 'YUJIAN_MODELS_DATA', {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      }), '*');
    }
  }

  private async sendBeautyModels(payload: Record<string, unknown>): Promise<void> {
    const frame = this.frame;
    try {
      const models = await fetchYujianModels(
        typeof payload.apiBaseUrl === 'string' ? payload.apiBaseUrl : '',
        typeof payload.apiKey === 'string' ? payload.apiKey : '',
      );
      frame?.contentWindow?.postMessage(makeBridgeMessage('event', 'BEAUTY_MODELS_DATA', { ok: true, models }), '*');
    } catch (error) {
      frame?.contentWindow?.postMessage(makeBridgeMessage('event', 'BEAUTY_MODELS_DATA', {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      }), '*');
    }
  }

  private async sendXianwangModels(payload: Record<string, unknown>): Promise<void> {
    const frame = this.frame;
    try {
      const models = await fetchYujianModels(
        typeof payload.apiBaseUrl === 'string' ? payload.apiBaseUrl : '',
        typeof payload.apiKey === 'string' ? payload.apiKey : '',
      );
      frame?.contentWindow?.postMessage(makeBridgeMessage('event', 'XIANWANG_MODELS_DATA', { ok: true, models }), '*');
    } catch (error) {
      frame?.contentWindow?.postMessage(makeBridgeMessage('event', 'XIANWANG_MODELS_DATA', {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      }), '*');
    }
  }

  private saveYujianSettings(payload: Record<string, unknown>): void {
    if (!this.hostWindow) return;
    const settings = {
      customPrompt: typeof payload.customPrompt === 'string' ? payload.customPrompt : '',
      apiBaseUrl: typeof payload.apiBaseUrl === 'string' ? payload.apiBaseUrl : '',
      apiKey: typeof payload.apiKey === 'string' ? payload.apiKey : '',
      apiModel: typeof payload.apiModel === 'string' ? payload.apiModel : '',
      storyParseEnabled: typeof payload.storyParseEnabled === 'boolean' ? payload.storyParseEnabled : false,
    };
    this.hostWindow.localStorage.setItem('daoyuan_wx_settings', JSON.stringify(settings));
    if (Array.isArray(payload.loreSelected)) {
      this.hostWindow.localStorage.setItem('daoyuan_wx_lore_selected', JSON.stringify({ __global__: payload.loreSelected }));
    }
    this.frame?.contentWindow?.postMessage(makeBridgeMessage('event', 'YUJIAN_SEND_STATUS', { settingsSaved: true }), '*');
  }

  private saveBeautySettings(payload: Record<string, unknown>): void {
    if (!this.hostWindow) return;
    const settings = {
      apiBaseUrl: typeof payload.apiBaseUrl === 'string' ? payload.apiBaseUrl : '',
      apiKey: typeof payload.apiKey === 'string' ? payload.apiKey : '',
      apiModel: typeof payload.apiModel === 'string' ? payload.apiModel : '',
      autoEnabled: typeof payload.autoEnabled === 'boolean' ? payload.autoEnabled : true,
      autoInterval: typeof payload.autoInterval === 'number' ? Math.max(0, Math.floor(payload.autoInterval)) : 1,
    };
    this.hostWindow.localStorage.setItem('daoyuan_beauty_api_settings', JSON.stringify(settings));
    this.frame?.contentWindow?.postMessage(makeBridgeMessage('event', 'BEAUTY_SETTINGS_STATUS', { settingsSaved: true }), '*');
  }

  private saveRerollSettings(payload: Record<string, unknown>): void {
    if (!this.hostWindow) return;
    const enabled = payload.enabled === true;
    this.hostWindow.localStorage.setItem('daoyuan_reroll_compat_v1', JSON.stringify({ enabled }));
    this.frame?.contentWindow?.postMessage(makeBridgeMessage('event', 'REROLL_SETTINGS_STATUS', { ok: true, enabled }), '*');
    this.sendContext();
  }

  private saveXianwangSettings(payload: Record<string, unknown>): void {
    if (!this.hostWindow) return;
    const settings = {
      apiBaseUrl: typeof payload.apiBaseUrl === 'string' ? payload.apiBaseUrl : '',
      apiKey: typeof payload.apiKey === 'string' ? payload.apiKey : '',
      apiModel: typeof payload.apiModel === 'string' ? payload.apiModel : '',
      trendsAutoEnabled: typeof payload.trendsAutoEnabled === 'boolean' ? payload.trendsAutoEnabled : true,
      autoInterval: typeof payload.autoInterval === 'number' ? Math.max(0, Math.floor(payload.autoInterval)) : 3,
      batchMin: typeof payload.batchMin === 'number' ? Math.max(1, Math.floor(payload.batchMin)) : 2,
      batchMax: typeof payload.batchMax === 'number' ? Math.max(1, Math.floor(payload.batchMax)) : 3,
      maxPosts: typeof payload.maxPosts === 'number' ? Math.max(1, Math.floor(payload.maxPosts)) : 30,
      forumAutoEnabled: typeof payload.forumAutoEnabled === 'boolean' ? payload.forumAutoEnabled : true,
      forumAutoInterval: typeof payload.forumAutoInterval === 'number' ? Math.max(0, Math.floor(payload.forumAutoInterval)) : 3,
      forumBatchSize: typeof payload.forumBatchSize === 'number' ? Math.max(1, Math.floor(payload.forumBatchSize)) : 2,
      forumMaxPosts: typeof payload.forumMaxPosts === 'number' ? Math.max(1, Math.floor(payload.forumMaxPosts)) : 30,
      newsAutoEnabled: typeof payload.newsAutoEnabled === 'boolean' ? payload.newsAutoEnabled : true,
      newsAutoInterval: typeof payload.newsAutoInterval === 'number' ? Math.max(0, Math.floor(payload.newsAutoInterval)) : 5,
      newsBatchSize: typeof payload.newsBatchSize === 'number' ? Math.max(1, Math.floor(payload.newsBatchSize)) : 1,
      newsMaxPapers: typeof payload.newsMaxPapers === 'number' ? Math.max(1, Math.floor(payload.newsMaxPapers)) : 12,
      decentralizedMode: payload.decentralizedMode === true,
      autoAiReply: payload.autoAiReply !== false,
      showHeat: payload.showHeat !== false,
      showCommentPreview: payload.showCommentPreview !== false,
      jailbreakPrompt: payload.jailbreakPrompt !== false,
      generatedCommentCount: typeof payload.generatedCommentCount === 'number' ? Math.max(0, Math.min(10, Math.floor(payload.generatedCommentCount))) : 3,
    };
    this.hostWindow.localStorage.setItem('daoyuan_xianwang_api_settings', JSON.stringify(settings));
    this.frame?.contentWindow?.postMessage(makeBridgeMessage('event', 'XIANWANG_SETTINGS_STATUS', { settingsSaved: true }), '*');
  }

  private savePromptInjectionSettings(payload: Record<string, unknown>): void {
    if (!this.hostWindow) return;
    const settings = normalizePromptInjectionSettings(payload);
    this.hostWindow.localStorage.setItem('daoyuan_prompt_injection_settings', JSON.stringify(settings));
    const active = this.refreshPromptInjection();
    this.frame?.contentWindow?.postMessage(makeBridgeMessage('event', 'PROMPT_INJECTION_SETTINGS_STATUS', {
      ok: true,
      active,
      capabilityAvailable: typeof runtime.injectPrompts === 'function'
        || typeof (this.hostWindow as Window & RuntimeGlobals).injectPrompts === 'function',
    }), '*');
    this.sendContext();
  }

  private clearPromptInjection(): void {
    try { this.promptInjectionCleanup?.(); } catch { /* host injection may already be gone */ }
    this.promptInjectionCleanup = null;
  }

  private refreshPromptInjection(): boolean {
    this.clearPromptInjection();
    if (!this.hostWindow || !this.session.chatId || new URLSearchParams(window.location.search).has('preview')) return false;
    const settings = readPromptInjectionSettings(this.hostWindow);
    if (!Object.values(settings).some(Boolean)) return false;
    const histories = loadStandaloneYujianHistories(this.hostWindow, this.session.chatId);
    const yujianMessages: YujianInjectionMessage[] = Object.entries(histories).flatMap(([contact, messages]) =>
      messages.slice(-4).map(message => ({ contact, from: message.from, text: message.text, time: message.time })),
    );
    const content = buildPromptInjectionContent(settings, {
      yujianMessages,
      trends: this.trendPosts,
      forum: this.forumPosts,
      news: this.newsPapers,
    });
    const hostRuntime = this.hostWindow as Window & RuntimeGlobals;
    const injectPrompts = runtime.injectPrompts ?? hostRuntime.injectPrompts;
    if (typeof injectPrompts !== 'function') return false;
    try {
      this.promptInjectionCleanup = applyPromptInjection({ injectPrompts }, content);
      return Boolean(content);
    } catch (error) {
      console.warn('[道渊主线注入] 当前运行环境未能建立提示词注入', error);
      return false;
    }
  }

  private async generateTrendPosts(sourceMessageId = this.session.messageId ?? undefined, replaceSource = false, manual = false): Promise<void> {
    if (this.trendsGenerationInFlight) return;
    this.trendsGenerationInFlight = true;
    const frame = this.frame;
    try {
      if (!this.hostWindow) throw new Error('酒馆运行上下文不可用');
      const settings = readXianwangApiSettings(this.hostWindow);
      const context = this.hostWindow.SillyTavern?.getContext?.();
      const chat = Array.isArray(context?.chat) ? context.chat : [];
      const recentStory = chat.slice(-6).map(message => {
        const row = message as { mes?: unknown };
        return typeof row.mes === 'string' ? row.mes : '';
      }).filter(Boolean).join('\n\n');
      const loreWindow = typeof runtime.getCharWorldbookNames === 'function' && typeof runtime.getWorldbook === 'function'
        ? runtime as unknown as Window : this.hostWindow;
      const loreEntries = await readXianwangRuleLore(loreWindow);
      const lore = buildXianwangLore(loreEntries);
      const posts = await generateTrends(settings, {
        worldTime: this.worldStatus.time,
        location: this.worldStatus.location,
        recentStory,
        worldFacts: this.worldData ? serializeXianwangWorldFacts(this.worldData) : '',
        lore,
        existingTitles: this.trendPosts.map(post => post.title),
        sourceMessageId: sourceMessageId === undefined ? undefined : String(sourceMessageId),
      });
      const sourceFingerprint = sourceMessageId === undefined ? undefined : storyFingerprint(
        typeof (chat[Number(sourceMessageId)] as { mes?: unknown } | undefined)?.mes === 'string'
          ? (chat[Number(sourceMessageId)] as { mes: string }).mes : '',
      );
      const sourcedPosts = posts.map(post => ({ ...post, sourceFingerprint }));
      const retained = replaceSource && sourceMessageId !== undefined
        ? this.trendPosts.filter(post => post.sourceMessageId !== String(sourceMessageId))
        : this.trendPosts;
      this.trendPosts = retainTrendPosts([...retained, ...sourcedPosts], settings.maxPosts);
      const existing = parseTrendsData(this.repository.getData('daoyuan_web_trends_data'));
      await this.repository.write('daoyuan_web_trends_data', { ...existing, posts: this.trendPosts, ...(manual ? { autoCounter: 0 } : {}) });
      this.appData = this.repository.project();
      frame?.contentWindow?.postMessage(makeBridgeMessage('event', 'TRENDS_GENERATION_STATUS', { ok: true, posts: posts.length }), '*');
      this.sendContext();
    } catch (error) {
      frame?.contentWindow?.postMessage(makeBridgeMessage('event', 'TRENDS_GENERATION_STATUS', { ok: false, error: error instanceof Error ? error.message : String(error) }), '*');
    } finally {
      this.trendsGenerationInFlight = false;
    }
  }

  private async deleteTrendPost(payload: Record<string, unknown>): Promise<void> {
    const id = typeof payload.id === 'string' ? payload.id : '';
    if (!id) return;
    try {
      this.trendPosts = this.trendPosts.filter(post => post.id !== id);
      const existing = parseTrendsData(this.repository.getData('daoyuan_web_trends_data'));
      await this.repository.write('daoyuan_web_trends_data', { ...existing, posts: this.trendPosts });
      this.appData = this.repository.project();
      this.frame?.contentWindow?.postMessage(makeBridgeMessage('event', 'TREND_DELETE_STATUS', { ok: true, id }), '*');
      this.sendContext();
    } catch (error) {
      this.frame?.contentWindow?.postMessage(makeBridgeMessage('event', 'TREND_DELETE_STATUS', { ok: false, error: error instanceof Error ? error.message : String(error) }), '*');
    }
  }

  private async toggleXianwangLike(kind:'trends'|'forum'|'news',payload:Record<string,unknown>):Promise<void>{
    const id=typeof payload.id==='string'?payload.id:''; if(!id)return;
    if(kind==='trends'){this.trendPosts=this.trendPosts.map(item=>item.id===id?{...item,liked:!item.liked,heat:Math.max(0,item.heat+(item.liked?-1:1))}:item);const data=parseTrendsData(this.repository.getData('daoyuan_web_trends_data'));await this.repository.write('daoyuan_web_trends_data',{...data,posts:this.trendPosts});}
    if(kind==='forum'){this.forumPosts=this.forumPosts.map(item=>item.id===id?{...item,liked:!item.liked,likes:Math.max(0,item.likes+(item.liked?-1:1))}:item);const data=parseForumData(this.repository.getData('daoyuan_forum_data'));await this.repository.write('daoyuan_forum_data',{...data,posts:this.forumPosts});}
    if(kind==='news'){this.newsPapers=this.newsPapers.map(item=>item.id===id?{...item,liked:!item.liked,likes:Math.max(0,item.likes+(item.liked?-1:1))}:item);const data=parseNewsData(this.repository.getData('daoyuan_news_data'));await this.repository.write('daoyuan_news_data',{...data,papers:this.newsPapers});}
    this.appData=this.repository.project();this.sendContext();
  }

  private async submitForumComment(payload:Record<string,unknown>):Promise<void>{const id=typeof payload.id==='string'?payload.id:'',content=typeof payload.content==='string'?payload.content.trim().slice(0,3000):'';const post=this.forumPosts.find(item=>item.id===id);if(!post||!content)return;const userComment={id:`forum-comment:${Date.now()}:user`,author:'我',content,storyTime:this.worldStatus.time};let comments=[...post.comments,userComment];try{this.forumPosts=this.forumPosts.map(item=>item.id===id?{...item,comments:comments.slice(-20)}:item);let data=parseForumData(this.repository.getData('daoyuan_forum_data'));await this.repository.write('daoyuan_forum_data',{...data,posts:this.forumPosts});this.sendContext();const settings=readXianwangApiSettings(this.hostWindow??window);if(settings.autoAiReply){comments=[...comments,...await generateForumReplies(settings,{...post,comments},content)];this.forumPosts=this.forumPosts.map(item=>item.id===id?{...item,comments:comments.slice(-20)}:item);data=parseForumData(this.repository.getData('daoyuan_forum_data'));await this.repository.write('daoyuan_forum_data',{...data,posts:this.forumPosts});}this.appData=this.repository.project();this.frame?.contentWindow?.postMessage(makeBridgeMessage('event','FORUM_COMMENT_STATUS',{ok:true,id}),'*');this.sendContext();}catch(error){this.frame?.contentWindow?.postMessage(makeBridgeMessage('event','FORUM_COMMENT_STATUS',{ok:false,error:`评论已保存；AI 回复失败：${error instanceof Error?error.message:String(error)}`}),'*');}}

  private async xianwangGenerationInput(sourceMessageId?: string): Promise<{ worldTime:string; location:string; recentStory:string; worldFacts:string; lore:string; existingTitles:string[]; sourceMessageId?:string }> {
    if (!this.hostWindow) throw new Error('酒馆运行上下文不可用');
    const chat = this.hostWindow.SillyTavern?.getContext?.()?.chat;
    const recentStory = (Array.isArray(chat) ? chat : []).slice(-6).map(message => typeof (message as {mes?:unknown}).mes === 'string' ? (message as {mes:string}).mes : '').filter(Boolean).join('\n\n');
    const loreWindow = typeof runtime.getCharWorldbookNames === 'function' && typeof runtime.getWorldbook === 'function' ? runtime as unknown as Window : this.hostWindow;
    const loreEntries = await readXianwangRuleLore(loreWindow);
    return { worldTime:this.worldStatus.time, location:this.worldStatus.location, recentStory, worldFacts:this.worldData ? serializeXianwangWorldFacts(this.worldData) : '', lore:buildXianwangLore(loreEntries), existingTitles:[], sourceMessageId };
  }

  private async generateForumContent(sourceMessageId = this.session.messageId ?? undefined, replaceSource = false, manual = false): Promise<void> {
    if (this.forumGenerationInFlight) return; this.forumGenerationInFlight=true;
    try { const settings=readXianwangApiSettings(this.hostWindow ?? window); const input=await this.xianwangGenerationInput(sourceMessageId === undefined ? undefined : String(sourceMessageId)); input.existingTitles=this.forumPosts.map(p=>p.title); const posts=await generateForumPosts(settings,input,settings.forumBatchSize); const chat=this.hostWindow?.SillyTavern?.getContext?.()?.chat; const sourceFingerprint=sourceMessageId===undefined||!Array.isArray(chat)?undefined:storyFingerprint(typeof (chat[Number(sourceMessageId)] as {mes?:unknown}|undefined)?.mes==='string'?(chat[Number(sourceMessageId)] as {mes:string}).mes:''); const sourcedPosts=posts.map(p=>({...p,sourceFingerprint})); const retained=replaceSource&&sourceMessageId!==undefined?this.forumPosts.filter(p=>p.sourceMessageId!==String(sourceMessageId)):this.forumPosts; this.forumPosts=retainNewest([...retained,...sourcedPosts],settings.forumMaxPosts); const existing=parseForumData(this.repository.getData('daoyuan_forum_data')); await this.repository.write('daoyuan_forum_data',{...existing,posts:this.forumPosts,...(manual?{autoCounter:0}:{})}); this.appData=this.repository.project(); this.frame?.contentWindow?.postMessage(makeBridgeMessage('event','FORUM_GENERATION_STATUS',{ok:true,posts:posts.length}),'*'); this.sendContext(); }
    catch(error){ this.frame?.contentWindow?.postMessage(makeBridgeMessage('event','FORUM_GENERATION_STATUS',{ok:false,error:error instanceof Error?error.message:String(error)}),'*'); }
    finally { this.forumGenerationInFlight=false; }
  }
  private async deleteForumPost(payload:Record<string,unknown>):Promise<void>{ const id=typeof payload.id==='string'?payload.id:''; if(!id)return; try{this.forumPosts=this.forumPosts.filter(p=>p.id!==id);const existing=parseForumData(this.repository.getData('daoyuan_forum_data'));await this.repository.write('daoyuan_forum_data',{...existing,posts:this.forumPosts});this.appData=this.repository.project();this.frame?.contentWindow?.postMessage(makeBridgeMessage('event','FORUM_DELETE_STATUS',{ok:true,id}),'*');this.sendContext();}catch(error){this.frame?.contentWindow?.postMessage(makeBridgeMessage('event','FORUM_DELETE_STATUS',{ok:false,error:error instanceof Error?error.message:String(error)}),'*');}}
  private async generateNewsContent(sourceMessageId = this.session.messageId ?? undefined, replaceSource = false, manual = false): Promise<void> {
    if(this.newsGenerationInFlight)return;this.newsGenerationInFlight=true;
    try{const settings=readXianwangApiSettings(this.hostWindow??window);const input=await this.xianwangGenerationInput(sourceMessageId===undefined?undefined:String(sourceMessageId));input.existingTitles=this.newsPapers.flatMap(p=>p.articles.map(a=>a.title));const papers=await generateNewsPapers(settings,input,settings.newsBatchSize);const chat=this.hostWindow?.SillyTavern?.getContext?.()?.chat;const sourceFingerprint=sourceMessageId===undefined||!Array.isArray(chat)?undefined:storyFingerprint(typeof (chat[Number(sourceMessageId)] as {mes?:unknown}|undefined)?.mes==='string'?(chat[Number(sourceMessageId)] as {mes:string}).mes:'');const sourcedPapers=papers.map(p=>({...p,sourceFingerprint}));const retained=replaceSource&&sourceMessageId!==undefined?this.newsPapers.filter(p=>p.sourceMessageId!==String(sourceMessageId)):this.newsPapers;this.newsPapers=retainNewest(normalizeNewsIssueSequence([...retained,...sourcedPapers]),settings.newsMaxPapers);const existing=parseNewsData(this.repository.getData('daoyuan_news_data'));await this.repository.write('daoyuan_news_data',{...existing,papers:this.newsPapers,...(manual?{autoCounter:0}:{})});this.appData=this.repository.project();this.frame?.contentWindow?.postMessage(makeBridgeMessage('event','NEWS_GENERATION_STATUS',{ok:true,papers:papers.length}),'*');this.sendContext();}
    catch(error){this.frame?.contentWindow?.postMessage(makeBridgeMessage('event','NEWS_GENERATION_STATUS',{ok:false,error:error instanceof Error?error.message:String(error)}),'*');}finally{this.newsGenerationInFlight=false;}
  }
  private async deleteNewsPaper(payload:Record<string,unknown>):Promise<void>{const id=typeof payload.id==='string'?payload.id:'';if(!id)return;try{this.newsPapers=this.newsPapers.filter(p=>p.id!==id);const existing=parseNewsData(this.repository.getData('daoyuan_news_data'));await this.repository.write('daoyuan_news_data',{...existing,papers:this.newsPapers});this.appData=this.repository.project();this.frame?.contentWindow?.postMessage(makeBridgeMessage('event','NEWS_DELETE_STATUS',{ok:true,id}),'*');this.sendContext();}catch(error){this.frame?.contentWindow?.postMessage(makeBridgeMessage('event','NEWS_DELETE_STATUS',{ok:false,error:error instanceof Error?error.message:String(error)}),'*');}}

  private async generateBeautyRank(): Promise<void> {
    if (this.beautyGenerationInFlight) return;
    this.beautyGenerationInFlight = true;
    const frame = this.frame;
    try {
      const settings = readBeautyApiSettings(this.hostWindow ?? window);
      if (!this.hostWindow) throw new Error('酒馆运行上下文不可用');
      const loreWindow = typeof runtime.getCharWorldbookNames === 'function' && typeof runtime.getWorldbook === 'function'
        ? runtime as unknown as Window
        : this.hostWindow;
      const loreEntries = await readYujianLore(loreWindow);
      if (!loreEntries.length) throw new Error('未读取到当前角色的启用世界书，已停止生成以避免人设幻觉');
      const result = await generateBeautyRank(settings, this.beautyRanks, this.appData.map.selectedRealm, loreEntries);
      // 群芳谱回帖属于本轮榜单的临时讨论；榜单整体更新后必须清空。
      this.beautyReplies = [];
      await this.repository.write('daoyuan_web_beauty_data', { ...this.repository.getData('daoyuan_web_beauty_data'), entries: result.entries, replies: [], source: 'daoyuan-beauty-api' });
      this.beautyRanks = result.entries;
      this.appData = this.repository.project();
      frame?.contentWindow?.postMessage(makeBridgeMessage('event', 'BEAUTY_GENERATION_STATUS', { ok: true, entries: result.entries.length }), '*');
      this.sendContext();
    } catch (error) {
      frame?.contentWindow?.postMessage(makeBridgeMessage('event', 'BEAUTY_GENERATION_STATUS', { ok: false, error: error instanceof Error ? error.message : String(error) }), '*');
    } finally {
      this.beautyGenerationInFlight = false;
    }
  }

  private async generateBeautyReply(payload: Record<string, unknown>): Promise<void> {
    try {
      const name = typeof payload.name === 'string' ? payload.name : '';
      const content = typeof payload.content === 'string' ? payload.content.trim() : '';
      const entry = this.beautyRanks.find(row => row.name === name);
      if (!name || !content || !entry) throw new Error('回帖人物或内容无效');
      const reply = await generateBeautyRankReply(readBeautyApiSettings(this.hostWindow ?? window), name, entry.xianzi, entry.qunfangpu, content, Array.isArray(payload.history) ? payload.history.map(String) : []);
      const userFloor = this.beautyReplies.filter(row => row.name === name).length + 1;
      const now = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
      const userEntry = { id: `reply:${Date.now()}:user`, name, content, floor: userFloor, time: now, likes: 0, liked: false };
      const replies = [...this.beautyReplies, userEntry, { id: `reply:${Date.now()}:ai`, name, content: reply, floor: userFloor + 1, time: now, likes: 0, liked: false, replyTo: userFloor }];
      this.beautyReplies = replies;
      await this.repository.write('daoyuan_web_beauty_data', { ...this.repository.getData('daoyuan_web_beauty_data'), entries: this.beautyRanks, replies, source: 'daoyuan-beauty-api' });
      this.frame?.contentWindow?.postMessage(makeBridgeMessage('event', 'BEAUTY_REPLY_STATUS', { ok: true, name, reply: replies[replies.length - 1] }), '*');
      this.sendContext();
    } catch (error) {
      this.frame?.contentWindow?.postMessage(makeBridgeMessage('event', 'BEAUTY_REPLY_STATUS', { ok: false, error: error instanceof Error ? error.message : String(error) }), '*');
    }
  }

  private async handleMvuUpdateStarted(): Promise<void> {
    if (!this.hostWindow || this.autoSchedulerInFlight) return;
    this.autoSchedulerInFlight = true;
    try {
    this.syncChatContext();
    const messageId = this.session.messageId;
    if (!messageId) return;
    const chat = this.hostWindow.SillyTavern?.getContext?.()?.chat;
    const messageIndex = Number(messageId);
    const sourceMessage = Array.isArray(chat) && Number.isSafeInteger(messageIndex)
      ? chat[messageIndex] as { is_user?: boolean; is_system?: boolean } | undefined
      : undefined;
    // MVU may start once for the player's message and again after the assistant
    //正文 has completed. Auto-generated world content belongs only to the
    // completed assistant floor; otherwise an interval of 1 fires twice per turn.
    if (!sourceMessage || sourceMessage.is_user !== false || sourceMessage.is_system === true) return;
    const yujianSettings = readYujianSettings(this.hostWindow);
    const story = typeof (sourceMessage as { mes?: unknown }).mes === 'string' ? (sourceMessage as { mes: string }).mes : '';
    if (yujianSettings.storyParseEnabled === true && story) void this.parseStoryYujian(messageId, story);
    const fingerprint = storyFingerprint(story);
    const swipeKey = `${messageId}:${fingerprint}`;
    const rerollCompatible = readRerollCompatibility(this.hostWindow);

    const trendsData = parseTrendsData(this.repository.getData('daoyuan_web_trends_data'));
    const trendSettings = readXianwangApiSettings(this.hostWindow);
    let counterStateChanged = false;
    if (trendSettings.trendsAutoEnabled && trendSettings.autoInterval > 0) {
      const isNewFloor = !trendsData.processedMessageIds.includes(messageId);
      const isNewSwipe = !trendsData.processedSwipeKeys.includes(swipeKey);
      if (isNewFloor || (rerollCompatible && isNewSwipe)) {
        const processedMessageIds = isNewFloor ? [...trendsData.processedMessageIds, messageId].slice(-200) : trendsData.processedMessageIds;
        const processedSwipeKeys = [...trendsData.processedSwipeKeys, swipeKey].slice(-400);
        const counter = isNewFloor ? trendsData.autoCounter + 1 : trendsData.autoCounter;
        const firstTrigger = isNewFloor && counter >= trendSettings.autoInterval;
        const rerollTrigger = !isNewFloor && trendsData.triggeredMessageIds.includes(messageId);
        const triggeredMessageIds = firstTrigger ? [...trendsData.triggeredMessageIds, messageId].slice(-200) : trendsData.triggeredMessageIds;
        const triggeredSwipeKeys = firstTrigger ? [...trendsData.triggeredSwipeKeys, swipeKey].slice(-200) : trendsData.triggeredSwipeKeys;
        await this.repository.write('daoyuan_web_trends_data', { ...trendsData, autoCounter: firstTrigger ? 0 : counter, processedMessageIds, processedSwipeKeys, triggeredMessageIds, triggeredSwipeKeys });
        counterStateChanged = true;
        if (firstTrigger || rerollTrigger) void this.generateTrendPosts(messageId, rerollTrigger);
      }
    }

    const forumData=parseForumData(this.repository.getData('daoyuan_forum_data'));
    if(trendSettings.forumAutoEnabled&&trendSettings.forumAutoInterval>0){const isNewFloor=!forumData.processedMessageIds.includes(messageId),isNewSwipe=!forumData.processedSwipeKeys.includes(swipeKey);if(isNewFloor||(rerollCompatible&&isNewSwipe)){const processedMessageIds=isNewFloor?[...forumData.processedMessageIds,messageId].slice(-200):forumData.processedMessageIds,processedSwipeKeys=[...forumData.processedSwipeKeys,swipeKey].slice(-400),counter=isNewFloor?forumData.autoCounter+1:forumData.autoCounter,firstTrigger=isNewFloor&&counter>=trendSettings.forumAutoInterval,rerollTrigger=!isNewFloor&&forumData.triggeredSwipeKeys.some(key=>key.endsWith(`:${storyFingerprint(story)}`)),triggeredMessageIds=firstTrigger?[...forumData.triggeredMessageIds,messageId].slice(-200):forumData.triggeredMessageIds,triggeredSwipeKeys=firstTrigger?[...forumData.triggeredSwipeKeys,swipeKey].slice(-200):forumData.triggeredSwipeKeys;await this.repository.write('daoyuan_forum_data',{...forumData,autoCounter:firstTrigger?0:counter,processedMessageIds,processedSwipeKeys,triggeredMessageIds,triggeredSwipeKeys});counterStateChanged=true;if(firstTrigger||rerollTrigger)void this.generateForumContent(messageId,rerollTrigger);}}
    const newsData=parseNewsData(this.repository.getData('daoyuan_news_data'));
    if(trendSettings.newsAutoEnabled&&trendSettings.newsAutoInterval>0){const isNewFloor=!newsData.processedMessageIds.includes(messageId),isNewSwipe=!newsData.processedSwipeKeys.includes(swipeKey);if(isNewFloor||(rerollCompatible&&isNewSwipe)){const processedMessageIds=isNewFloor?[...newsData.processedMessageIds,messageId].slice(-200):newsData.processedMessageIds,processedSwipeKeys=[...newsData.processedSwipeKeys,swipeKey].slice(-400),counter=isNewFloor?newsData.autoCounter+1:newsData.autoCounter,firstTrigger=isNewFloor&&counter>=trendSettings.newsAutoInterval,rerollTrigger=!isNewFloor&&newsData.triggeredSwipeKeys.some(key=>key.endsWith(`:${storyFingerprint(story)}`)),triggeredMessageIds=firstTrigger?[...newsData.triggeredMessageIds,messageId].slice(-200):newsData.triggeredMessageIds,triggeredSwipeKeys=firstTrigger?[...newsData.triggeredSwipeKeys,swipeKey].slice(-200):newsData.triggeredSwipeKeys;await this.repository.write('daoyuan_news_data',{...newsData,autoCounter:firstTrigger?0:counter,processedMessageIds,processedSwipeKeys,triggeredMessageIds,triggeredSwipeKeys});counterStateChanged=true;if(firstTrigger||rerollTrigger)void this.generateNewsContent(messageId,rerollTrigger);}}

    const beautySettings = readBeautyApiSettings(this.hostWindow);
    const beautyData = this.repository.getData('daoyuan_web_beauty_data');
    const beautyProcessed = Array.isArray(beautyData.processedMessageIds) ? beautyData.processedMessageIds.filter((id): id is string => typeof id === 'string') : [];
    const beautySwipeKeys = Array.isArray(beautyData.processedSwipeKeys) ? beautyData.processedSwipeKeys.filter((id): id is string => typeof id === 'string') : [];
    const beautyTriggered = Array.isArray(beautyData.triggeredMessageIds) ? beautyData.triggeredMessageIds.filter((id): id is string => typeof id === 'string') : [];
    const beautyNewFloor = !beautyProcessed.includes(messageId);
    const beautyNewSwipe = !beautySwipeKeys.includes(swipeKey);
    if (beautySettings.autoEnabled && beautySettings.autoInterval > 0 && (beautyNewFloor || (rerollCompatible && beautyNewSwipe))) {
      const currentCounter = typeof beautyData.autoCounter === 'number' && Number.isFinite(beautyData.autoCounter) ? Math.max(0, Math.floor(beautyData.autoCounter)) : 0;
      const counter = beautyNewFloor ? currentCounter + 1 : currentCounter;
      const processedMessageIds = beautyNewFloor ? [...beautyProcessed, messageId].slice(-200) : beautyProcessed;
      const processedSwipeKeys = [...beautySwipeKeys, swipeKey].slice(-400);
      const firstTrigger = beautyNewFloor && counter >= beautySettings.autoInterval;
      const rerollTrigger = !beautyNewFloor && beautyTriggered.includes(messageId);
      const triggeredMessageIds = firstTrigger ? [...beautyTriggered, messageId].slice(-200) : beautyTriggered;
      await this.repository.write('daoyuan_web_beauty_data', { ...beautyData, autoCounter: firstTrigger ? 0 : counter, processedMessageIds, processedSwipeKeys, triggeredMessageIds });
      if (firstTrigger || rerollTrigger) {
        void this.generateBeautyRank();
      }
    }
    if (counterStateChanged) this.sendContext();
    } finally {
      this.autoSchedulerInFlight = false;
    }
  }

  private async parseStoryYujian(messageId: string, story: string): Promise<void> {
    if (!this.hostWindow || !this.session.chatId || this.yujianStoryParseInFlight) return;
    const storageKey = 'daoyuan_yujian_story_processed_v1';
    let store: Record<string, string[]> = {};
    try { store = JSON.parse(this.hostWindow.localStorage.getItem(storageKey) || '{}') as Record<string, string[]>; } catch { store = {}; }
    const processed = Array.isArray(store[this.session.chatId]) ? store[this.session.chatId] : [];
    const fingerprint = storyFingerprint(story);
    const swipeKey = `${messageId}:${fingerprint}`;
    if (processed.includes(swipeKey)) return;
    this.yujianStoryParseInFlight = true;
    try {
      const events = await extractStoryYujianEvents(this.hostWindow, story);
      removeAutoYujianRecordsForFloor(this.hostWindow, this.session.chatId, messageId);
      const remembered = new Map(loadStandaloneKnownContacts(this.hostWindow, this.session.chatId).map(contact => [contact.name, contact]));
      for (const event of events) {
        appendStandaloneYujianRecord(this.hostWindow, this.session.chatId, event.contact, event.direction === 'to_player' ? 'them' : 'me', event.content, event.storyTime, {
          sourceMessageId: messageId,
          sourceFingerprint: fingerprint,
          generationMode: 'auto',
        });
        const previous = remembered.get(event.contact);
        remembered.set(event.contact, {
          name: event.contact,
          portrait: previous?.portrait,
          affection: previous?.affection,
          affectionLabel: previous?.affectionLabel,
          preview: event.content,
          time: event.storyTime,
          detail: previous?.detail ?? '正文玉简联系人',
          unread: (previous?.unread ?? 0) + (event.direction === 'to_player' ? 1 : 0),
        });
      }
      rememberStandaloneKnownContacts(this.hostWindow, this.session.chatId, [...remembered.values()]);
      store[this.session.chatId] = [...processed, swipeKey].slice(-600);
      this.hostWindow.localStorage.setItem(storageKey, JSON.stringify(store));
      if (events.length) this.scheduleWorldDataRefresh(0);
    } catch (error) {
      console.warn('[道渊玉简] 正文玉简解析失败', error);
    } finally {
      this.yujianStoryParseInFlight = false;
    }
  }

  private async sendYujianMessage(charName: string, text: string): Promise<void> {
    const frame = this.frame;
    if (!this.hostWindow || !charName || !text) {
      frame?.contentWindow?.postMessage(makeBridgeMessage('event', 'YUJIAN_SEND_STATUS', { ok: false, error: '玉简运行上下文不可用' }), '*');
      return;
    }
    if (!this.session.chatId) {
      frame?.contentWindow?.postMessage(makeBridgeMessage('event', 'YUJIAN_SEND_STATUS', { ok: false, error: '当前聊天尚未就绪' }), '*');
      return;
    }
    // MVU 必须取自真正提供 Mvu 的运行上下文；仅有 TavernHelper 不代表该上下文能写 MVU。
    const executionWindow = runtime.Mvu
      ? runtime as unknown as Window
      : this.hostWindow;
    try {
      await sendYujianMessageWithProgress(executionWindow, this.session.chatId, charName, text, phase => {
        if (phase === 'user-written') {
          this.scheduleWorldDataRefresh(0);
          frame?.contentWindow?.postMessage(makeBridgeMessage('event', 'YUJIAN_SEND_STATUS', { phase }), '*');
        }
      });
      this.refreshPromptInjection();
      this.scheduleWorldDataRefresh(120);
      frame?.contentWindow?.postMessage(makeBridgeMessage('event', 'YUJIAN_SEND_STATUS', { ok: true }), '*');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn('[道渊玉简] 玉简传讯失败', error);
      frame?.contentWindow?.postMessage(makeBridgeMessage('event', 'YUJIAN_SEND_STATUS', { ok: false, error: message }), '*');
    }
  }

  open(): void {
    if (!this.host || !this.orb || this.session.phase === 'destroyed') return;
    this.session.visible = true;
    this.host.hidden = false;
    this.orb.disabled = true;
    this.ensureFrame();
    this.resize();
  }

  close(): void {
    if (!this.host || !this.orb) return;
    this.session.visible = false;
    this.host.hidden = true;
    this.orb.hidden = false;
    this.orb.disabled = false;
    this.petController?.closePhone();
  }

  private ensureFrame(): void {
    if (!this.host || !this.hostDocument || this.frame) return;
    // The script itself may run inside Tavern Helper's hidden script iframe.
    // Create the visible UI frame explicitly in the resolved host document.
    this.frame = this.hostDocument.createElement('iframe');
    this.frame.title = '天机阁随身玉简';
    this.frame.setAttribute('aria-label', '天机阁随身玉简内容');
    this.frame.setAttribute('referrerpolicy', 'no-referrer');
    this.host.append(this.frame);
    const frameMarkup = '<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><title>玉简</title></head><body><div id="daoyuan-app"></div></body></html>';
    this.frame.addEventListener('load', () => this.mountFrame(), { once: true });
    this.frame.srcdoc = frameMarkup;
  }

  private mountFrame(): void {
    if (!this.frame?.contentDocument) return;
    const doc = this.frame.contentDocument;
    const style = doc.createElement('style');
    style.textContent = appCss;
    doc.head.append(style);
    this.uiMount?.destroy();
    try {
      this.uiMount = mountUi(doc, (action, payload) => this.handleUiAction(action, payload));
    } catch (error) {
      console.error('[道渊玉简] ui mount failed', error);
    }
    const keepFocusedControlVisible = (event: FocusEvent): void => {
      const HTMLElementCtor = doc.defaultView?.HTMLElement;
      const target = event.target;
      if (!HTMLElementCtor || !(target instanceof HTMLElementCtor) || !target.matches('input, textarea, select')) return;
      window.setTimeout(() => target.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' }), 180);
    };
    doc.addEventListener('focusin', keepFocusedControlVisible);
    this.session.disposers.push(() => doc.removeEventListener('focusin', keepFocusedControlVisible));
    this.sendContext();
  }

  private sendContext(): void {
    if (!this.frame?.contentWindow) return;
    this.frame.contentWindow.postMessage(makeBridgeMessage('event', 'REQUEST_CONTEXT', {
      layout: this.layout,
      shellMode: this.shellMode,
      appData: this.appData,
      beautyRanks: this.beautyRanks,
      beautyReplies: this.beautyReplies,
      trendPosts: this.trendPosts,
      forumPosts: this.forumPosts,
      newsPapers: this.newsPapers,
      xianwangCounters: {
        trends: parseTrendsData(this.repository.getData('daoyuan_web_trends_data')).autoCounter,
        forum: parseForumData(this.repository.getData('daoyuan_forum_data')).autoCounter,
        news: parseNewsData(this.repository.getData('daoyuan_news_data')).autoCounter,
      },
      yujianContacts: this.yujianContacts,
      inventoryItems: this.inventoryItems,
      worldStatus: this.worldStatus,
      context: { chatId: this.session.chatId, messageId: this.session.messageId },
      mvuChannel: {
        name: MVU_CHANNEL_NAME,
        ready: this.worldDataMessageId !== null && this.worldData !== null,
        messageId: this.worldDataMessageId,
        variables: this.worldData,
      },
      capabilities: { mvu: getWorldDataCapability(runtime.Mvu ?? this.hostWindow?.Mvu).reason },
      yujianSettings: this.hostWindow ? readYujianSettings(this.hostWindow) : {},
      beautyApiSettings: this.hostWindow ? readBeautyApiSettings(this.hostWindow) : {},
      xianwangApiSettings: this.hostWindow ? readXianwangApiSettings(this.hostWindow) : {},
      promptInjectionSettings: this.hostWindow ? readPromptInjectionSettings(this.hostWindow) : DEFAULT_PROMPT_INJECTION_SETTINGS,
      rerollCompatibilityEnabled: this.hostWindow ? readRerollCompatibility(this.hostWindow) : false,
      petSize: this.hostWindow ? readPetSize(this.hostWindow) : 'large',
    }, this.session.contextRevision), '*');
    this.refreshPromptInjection();
  }

  private resize(): void {
    if (!this.host || !this.hostWindow) return;
    const visualViewport = this.hostWindow.visualViewport;
    const viewportWidth = visualViewport?.width ?? this.hostWindow.innerWidth;
    const viewportHeight = visualViewport?.height ?? this.hostWindow.innerHeight;
    const viewportLeft = visualViewport?.offsetLeft ?? 0;
    const viewportTop = visualViewport?.offsetTop ?? 0;
    const activeElement = this.frame?.contentDocument?.activeElement;
    const editableFocused = Boolean(activeElement?.matches('input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]), textarea, select'));
    if (!editableFocused || Math.abs(viewportWidth - this.viewportBaselineWidth) > 40) {
      this.viewportBaselineWidth = viewportWidth;
      this.viewportBaselineHeight = Math.max(this.viewportBaselineHeight, viewportHeight);
    }
    const keyboardOpen = Boolean(visualViewport && editableFocused && (
      visualViewport.height < this.hostWindow.innerHeight - 120
      || viewportHeight < this.viewportBaselineHeight - 40
    ));
    if (this.orb) {
      if (this.orbPosition) {
        const orbRect = this.orb.getBoundingClientRect();
        this.orbPosition = this.clampPosition(this.orbPosition.left, this.orbPosition.top, orbRect.width, orbRect.height, viewportWidth, viewportHeight);
        Object.assign(this.orb.style, { left: `${this.orbPosition.left}px`, top: `${this.orbPosition.top}px`, right: 'auto', bottom: 'auto' });
      } else {
        this.positionOrb();
      }
    }
    if (!this.session.visible) return;
    if (keyboardOpen && !this.keyboardViewportActive) this.shellPositionBeforeKeyboard = this.shellPosition;
    if (!keyboardOpen && this.keyboardViewportActive) {
      this.shellPosition = this.shellPositionBeforeKeyboard;
      this.shellPositionBeforeKeyboard = null;
    }
    this.keyboardViewportActive = keyboardOpen;
    const width = keyboardOpen ? Math.min(420, viewportWidth) : Math.min(420, viewportWidth, viewportHeight * IPHONE_RATIO);
    const height = keyboardOpen ? Math.min(width / IPHONE_RATIO, viewportHeight) : width / IPHONE_RATIO;
    const left = keyboardOpen
      ? viewportLeft + Math.max(0, (viewportWidth - width) / 2)
      : this.shellPosition?.left ?? Math.max(viewportLeft, viewportLeft + viewportWidth - width - 24);
    const top = keyboardOpen
      ? viewportTop
      : this.shellPosition?.top ?? Math.min(viewportTop + 24, Math.max(viewportTop, viewportTop + viewportHeight - height));
    if (keyboardOpen) {
      this.shellPosition = { left, top };
    } else {
      const clamped = this.clampPosition(left - viewportLeft, top - viewportTop, width, height, viewportWidth, viewportHeight);
      this.shellPosition = { left: clamped.left + viewportLeft, top: clamped.top + viewportTop };
    }
    this.host.dataset.mode = 'phone';
    this.host.dataset.keyboard = keyboardOpen ? 'open' : 'closed';
    Object.assign(this.host.style, { left: `${this.shellPosition.left}px`, top: `${this.shellPosition.top}px`, width: `${width}px`, height: `${height}px`, right: 'auto', bottom: 'auto' });
  }

  private positionOrb(): void {
    if (!this.orb) return;
    if (this.orbPosition) {
      Object.assign(this.orb.style, { left: `${this.orbPosition.left}px`, top: `${this.orbPosition.top}px`, right: 'auto', bottom: 'auto' });
      return;
    }
    // SillyTavern's mobile shell may put an identity transform on <html> while
    // its layout height is zero. In that state a fixed element positioned with
    // `bottom` uses the transformed root as its containing block and ends up
    // above the viewport. Resolve the default position to viewport coordinates
    // so desktop and mobile emulation use the same visible anchor.
    const viewportWidth = this.hostWindow?.visualViewport?.width ?? this.hostWindow?.innerWidth ?? 0;
    const viewportHeight = this.hostWindow?.visualViewport?.height ?? this.hostWindow?.innerHeight ?? 0;
    const orbRect = this.orb.getBoundingClientRect();
    const next = this.clampPosition(viewportWidth - orbRect.width - 14, viewportHeight - orbRect.height - 14, orbRect.width, orbRect.height, viewportWidth, viewportHeight);
    Object.assign(this.orb.style, { left: `${next.left}px`, top: `${next.top}px`, right: 'auto', bottom: 'auto' });
  }

  private clampPosition(left: number, top: number, width: number, height: number, viewportWidth: number, viewportHeight: number): { left: number; top: number } {
    return {
      left: Math.min(Math.max(0, left), Math.max(0, viewportWidth - width)),
      top: Math.min(Math.max(0, top), Math.max(0, viewportHeight - height)),
    };
  }

  private bindShellDrag(): void {
    if (!this.dragStrip || !this.host || !this.hostWindow) return;
    let drag: { pointerId: number; startX: number; startY: number; left: number; top: number; width: number; height: number; viewportWidth: number; viewportHeight: number } | null = null;
    const onPointerDown = (event: PointerEvent): void => {
      if (event.button !== 0 || !this.host || drag) return;
      const rect = this.host.getBoundingClientRect();
      const viewportWidth = this.hostWindow?.visualViewport?.width ?? this.hostWindow?.innerWidth ?? 0;
      const viewportHeight = this.hostWindow?.visualViewport?.height ?? this.hostWindow?.innerHeight ?? 0;
      drag = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, left: rect.left, top: rect.top, width: rect.width, height: rect.height, viewportWidth, viewportHeight };
      this.host.classList.add('is-dragging');
      this.dragStrip?.setPointerCapture(event.pointerId);
      this.dragStrip?.classList.add('is-dragging');
      event.preventDefault();
    };
    const onPointerMove = (event: PointerEvent): void => {
      if (!drag || drag.pointerId !== event.pointerId || !this.host) return;
      const next = this.clampPosition(drag.left + event.clientX - drag.startX, drag.top + event.clientY - drag.startY, drag.width, drag.height, drag.viewportWidth, drag.viewportHeight);
      this.shellPosition = next;
      Object.assign(this.host.style, { left: `${next.left}px`, top: `${next.top}px`, right: 'auto', bottom: 'auto' });
      event.preventDefault();
    };
    const onPointerUp = (event: PointerEvent): void => {
      if (!drag || drag.pointerId !== event.pointerId) return;
      drag = null;
      this.host?.classList.remove('is-dragging');
      this.dragStrip?.classList.remove('is-dragging');
      if (this.dragStrip?.hasPointerCapture(event.pointerId)) this.dragStrip.releasePointerCapture(event.pointerId);
    };
    const onMouseDown = (event: MouseEvent): void => {
      if (event.button !== 0 || drag || !this.host) return;
      const rect = this.host.getBoundingClientRect();
      const viewportWidth = this.hostWindow?.visualViewport?.width ?? this.hostWindow?.innerWidth ?? 0;
      const viewportHeight = this.hostWindow?.visualViewport?.height ?? this.hostWindow?.innerHeight ?? 0;
      drag = { pointerId: -1, startX: event.clientX, startY: event.clientY, left: rect.left, top: rect.top, width: rect.width, height: rect.height, viewportWidth, viewportHeight };
      this.host.classList.add('is-dragging');
      this.dragStrip?.classList.add('is-dragging');
      event.preventDefault();
    };
    const onMouseMove = (event: MouseEvent): void => {
      if (!drag || drag.pointerId !== -1) return;
      const next = this.clampPosition(drag.left + event.clientX - drag.startX, drag.top + event.clientY - drag.startY, drag.width, drag.height, drag.viewportWidth, drag.viewportHeight);
      this.shellPosition = next;
      Object.assign(this.host?.style ?? {}, { left: `${next.left}px`, top: `${next.top}px`, right: 'auto', bottom: 'auto' });
      event.preventDefault();
    };
    const onMouseUp = (): void => {
      if (!drag || drag.pointerId !== -1) return;
      drag = null;
      this.host?.classList.remove('is-dragging');
      this.dragStrip?.classList.remove('is-dragging');
    };
    this.dragStrip.addEventListener('pointerdown', onPointerDown);
    this.dragStrip.addEventListener('pointerup', onPointerUp);
    this.dragStrip.addEventListener('pointercancel', onPointerUp);
    this.hostWindow.addEventListener('pointermove', onPointerMove);
    this.hostWindow.addEventListener('pointerup', onPointerUp);
    this.hostWindow.addEventListener('pointercancel', onPointerUp);
    this.dragStrip.addEventListener('mousedown', onMouseDown);
    this.hostWindow.addEventListener('mousemove', onMouseMove);
    this.hostWindow.addEventListener('mouseup', onMouseUp);
    this.session.disposers.push(() => {
      this.dragStrip?.removeEventListener('pointerdown', onPointerDown);
      this.dragStrip?.removeEventListener('pointerup', onPointerUp);
      this.dragStrip?.removeEventListener('pointercancel', onPointerUp);
      this.hostWindow?.removeEventListener('pointermove', onPointerMove);
      this.hostWindow?.removeEventListener('pointerup', onPointerUp);
      this.hostWindow?.removeEventListener('pointercancel', onPointerUp);
      this.dragStrip?.removeEventListener('mousedown', onMouseDown);
      this.hostWindow?.removeEventListener('mousemove', onMouseMove);
      this.hostWindow?.removeEventListener('mouseup', onMouseUp);
    });
  }

  private bindOrbDrag(): void {
    if (!this.orb || !this.hostWindow) return;
    let drag: { pointerId: number; startX: number; startY: number; left: number; top: number; width: number; height: number; viewportWidth: number; viewportHeight: number } | null = null;
    const onPointerDown = (event: PointerEvent): void => {
      if (event.button !== 0 || !this.orb || drag) return;
      const rect = this.orb.getBoundingClientRect();
      const viewportWidth = this.hostWindow?.visualViewport?.width ?? this.hostWindow?.innerWidth ?? 0;
      const viewportHeight = this.hostWindow?.visualViewport?.height ?? this.hostWindow?.innerHeight ?? 0;
      drag = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, left: rect.left, top: rect.top, width: rect.width, height: rect.height, viewportWidth, viewportHeight };
      this.orbDragMoved = false;
      this.orb.setPointerCapture(event.pointerId);
      event.preventDefault();
    };
    const onPointerMove = (event: PointerEvent): void => {
      if (!drag || drag.pointerId !== event.pointerId || !this.orb) return;
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) this.orbDragMoved = true;
      const next = this.clampPosition(drag.left + dx, drag.top + dy, drag.width, drag.height, drag.viewportWidth, drag.viewportHeight);
      this.orbPosition = next;
      Object.assign(this.orb.style, { left: `${next.left}px`, top: `${next.top}px`, right: 'auto', bottom: 'auto' });
      event.preventDefault();
    };
    const onPointerUp = (event: PointerEvent): void => {
      if (!drag || drag.pointerId !== event.pointerId || !this.orb) return;
      drag = null;
      if (this.orb.hasPointerCapture(event.pointerId)) this.orb.releasePointerCapture(event.pointerId);
    };
    const onMouseDown = (event: MouseEvent): void => {
      if (event.button !== 0 || drag || !this.orb) return;
      const rect = this.orb.getBoundingClientRect();
      const viewportWidth = this.hostWindow?.visualViewport?.width ?? this.hostWindow?.innerWidth ?? 0;
      const viewportHeight = this.hostWindow?.visualViewport?.height ?? this.hostWindow?.innerHeight ?? 0;
      drag = { pointerId: -1, startX: event.clientX, startY: event.clientY, left: rect.left, top: rect.top, width: rect.width, height: rect.height, viewportWidth, viewportHeight };
      this.orbDragMoved = false;
      event.preventDefault();
    };
    const onMouseMove = (event: MouseEvent): void => {
      if (!drag || drag.pointerId !== -1 || !this.orb) return;
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) this.orbDragMoved = true;
      const next = this.clampPosition(drag.left + dx, drag.top + dy, drag.width, drag.height, drag.viewportWidth, drag.viewportHeight);
      this.orbPosition = next;
      Object.assign(this.orb.style, { left: `${next.left}px`, top: `${next.top}px`, right: 'auto', bottom: 'auto' });
      event.preventDefault();
    };
    const onMouseUp = (): void => {
      if (!drag || drag.pointerId !== -1) return;
      drag = null;
    };
    const onClick = (): void => {
      if (this.orbDragMoved) {
        this.orbDragMoved = false;
        return;
      }
      this.petController?.openPhone();
    };
    this.orb.addEventListener('pointerdown', onPointerDown);
    this.orb.addEventListener('pointerup', onPointerUp);
    this.orb.addEventListener('pointercancel', onPointerUp);
    this.hostWindow.addEventListener('pointermove', onPointerMove);
    this.hostWindow.addEventListener('pointerup', onPointerUp);
    this.hostWindow.addEventListener('pointercancel', onPointerUp);
    this.orb.addEventListener('click', onClick);
    this.orb.addEventListener('mousedown', onMouseDown);
    this.hostWindow.addEventListener('mousemove', onMouseMove);
    this.hostWindow.addEventListener('mouseup', onMouseUp);
    this.session.disposers.push(() => {
      this.orb?.removeEventListener('pointerdown', onPointerDown);
      this.orb?.removeEventListener('pointerup', onPointerUp);
      this.orb?.removeEventListener('pointercancel', onPointerUp);
      this.hostWindow?.removeEventListener('pointermove', onPointerMove);
      this.hostWindow?.removeEventListener('pointerup', onPointerUp);
      this.hostWindow?.removeEventListener('pointercancel', onPointerUp);
      this.orb?.removeEventListener('click', onClick);
      this.orb?.removeEventListener('mousedown', onMouseDown);
      this.hostWindow?.removeEventListener('mousemove', onMouseMove);
      this.hostWindow?.removeEventListener('mouseup', onMouseUp);
    });
  }

  destroy(): void {
    this.petController?.destroy();
    this.petController = null;
    // Preserve the original pet build's explicit teardown order. Prompt
    // injection is the only new lifecycle resource and is released before
    // the session runs its original disposer chain.
    this.clearPromptInjection();
    if (this.hostWindow?.__daoyuanMvuChannel?.name === MVU_CHANNEL_NAME) {
      delete this.hostWindow.__daoyuanMvuChannel;
    }
    destroyHudSession(this.session);
    this.uiMount?.destroy();
    this.uiMount = null;
    this.frame?.remove();
    this.host?.remove();
    this.hostStyle?.remove();
    this.orb?.remove();
    this.frame = null;
    this.host = null;
    this.dragStrip = null;
    this.orb = null;
    this.hostStyle = null;
    this.hostWindow = null;
    this.hostDocument = null;
    if (this.worldRefreshTimer !== null) window.clearTimeout(this.worldRefreshTimer);
    this.worldRefreshTimer = null;
    if (this.reconcileTimer !== null) window.clearTimeout(this.reconcileTimer);
    this.reconcileTimer = null;
    if (this.autoSchedulerTimer !== null) window.clearTimeout(this.autoSchedulerTimer);
    this.autoSchedulerTimer = null;
  }
}

function boot(): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;
  const shell = new FeatureShell();
  shell.start();
  console.info('[道渊玉简] phone-ratio shell ready; desktop 16:9 mode disabled');
}

onReady(boot);
