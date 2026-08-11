interface YujianRuntimeHost {
  Mvu?: {
    getMvuData?: (scope?: unknown) => unknown | Promise<unknown>;
    replaceMvuData?: (data: unknown, scope?: unknown) => unknown | Promise<unknown>;
  };
  TavernHelper?: { generate?: (input: unknown) => unknown | Promise<unknown> };
  generate?: (input: unknown) => unknown | Promise<unknown>;
  getCurrentMessageId?: () => string | number;
  getVariables?: (scope?: unknown) => unknown;
  getCharWorldbookNames?: (scope?: string) => { primary?: string; additional?: string[] };
  getWorldbook?: (name: string) => Array<unknown> | Promise<Array<unknown>>;
  getChatMessages?: (range: string, options?: Record<string, unknown>) => unknown | Promise<unknown>;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function readSettings(hostWindow: Window): { customPrompt: string; apiBaseUrl: string; apiKey: string; apiModel: string } {
  try {
    const value = JSON.parse(hostWindow.localStorage.getItem('daoyuan_wx_settings') || '{}') as { customPrompt?: unknown; apiBaseUrl?: unknown; apiKey?: unknown; apiModel?: unknown };
    return {
      customPrompt: typeof value.customPrompt === 'string' ? value.customPrompt : '',
      apiBaseUrl: typeof value.apiBaseUrl === 'string' ? value.apiBaseUrl.trim() : '',
      apiKey: typeof value.apiKey === 'string' ? value.apiKey : '',
      apiModel: typeof value.apiModel === 'string' ? value.apiModel.trim() : '',
    };
  } catch {
    return { customPrompt: '', apiBaseUrl: '', apiKey: '', apiModel: '' };
  }
}

async function buildOriginalInjection(runtime: YujianRuntimeHost, chatId: string, charName: string, customPrompt: string): Promise<string> {
  const stat = asRecord(asRecord(await runtime.Mvu?.getMvuData?.({ type: 'chat' })).stat_data);
  const hero = asRecord(stat.主角);
  const world = asRecord(stat.世界);
  const npc = asRecord(asRecord(stat.人物)[charName]);
  const partner = asRecord(asRecord(stat.道侣)[charName]);
  const npcInfo = Object.keys(npc).length ? npc : partner;
  const historyText = (loadStandaloneYujianHistories(runtime as unknown as Window, chatId)[charName] ?? [])
    .map(item => `[${item.from === 'me' ? '我' : charName}]: ${item.text}`)
    .join('\n');
  const loreItems = [
    ...await readCharacterLoreFromRuntime(runtime, charName),
    ...readSelectedLoreFromRuntime(runtime),
  ];
  const uniqueLore = [...new Set(loreItems.map(item => item.trim()).filter(Boolean))];
  const storyContext = await readMainStoryContext(runtime);
  let loreContext = '';
  for (const item of uniqueLore) loreContext += `${item}\n\n`;
  let heroInfo =
    `[主角当前状态]\n` +
    `境界: ${String(hero.境界 || '未知')}\n` +
    `所在界域: ${String(hero.所在界 || '未知')}\n` +
    `当前地点: ${String(world.当前地点 || '未知')}\n` +
    `当前时间: ${String(world.当前时间 || '未知')}\n` +
    `灵根: ${String(hero.灵根 || '无')}\n`;
  const skills = asRecord(hero.功法);
  const skillNames = Object.entries(skills).map(([key, value]) => `${key}(${asRecord(value).境界 || '未知'})`).join('、');
  heroInfo += `功法: ${skillNames || '无'}`;
  let inject = '';
  if (loreContext) inject += `[世界书知识注入]\n${loreContext}\n`;
  if (storyContext) inject += `[近期主线剧情上下文]\n${storyContext}\n\n`;
  inject += heroInfo + '\n\n';
  if (Object.keys(npcInfo).length) inject += `[联系人资料]\n${JSON.stringify(npcInfo)}\n\n`;
  if (historyText) inject += `[历史传讯记录]\n${historyText}\n`;
  if (customPrompt) inject += `[传讯指引]\n${customPrompt}\n\n`;
  inject += `(请以【${charName}】的身份回复，严格只输出纯对话内容，绝对不要带角色名、引号、动作描写或[]符号。)`;
  return inject;
}

async function readMainStoryContext(runtime: YujianRuntimeHost): Promise<string> {
  if (typeof runtime.getChatMessages !== 'function') return '';
  try {
    const raw = await runtime.getChatMessages('0-{{lastMessageId}}', { include_swipes: false });
    if (!Array.isArray(raw)) return '';
    return raw.slice(-12).flatMap(item => {
      const record = asRecord(item);
      const message = typeof record.message === 'string' ? record.message.trim() : '';
      if (!message) return [];
      const role = record.role === 'user' || record.is_user === true ? '主角' : '剧情';
      // 防止一条包含大型状态栏标记的消息独占玉简提示词。
      return [`[${role}] ${message.slice(0, 1200)}`];
    }).join('\n');
  } catch { return ''; }
}

function normalizeLoreName(value: string): string {
  return value.toLocaleLowerCase().replace(/[\s·・【】\[\]（）()《》〈〉「」『』:：_\-—]/g, '');
}

async function readCharacterLoreFromRuntime(runtime: YujianRuntimeHost, charName: string): Promise<string[]> {
  if (typeof runtime.getCharWorldbookNames !== 'function' || typeof runtime.getWorldbook !== 'function') return [];
  const target = normalizeLoreName(charName);
  if (!target) return [];
  try {
    const names = runtime.getCharWorldbookNames('current');
    const books = [names?.primary, ...(names?.additional ?? [])].filter((name): name is string => Boolean(name));
    const matched: string[] = [];
    for (const book of books) {
      const entries = await runtime.getWorldbook(book);
      for (const raw of entries) {
        const entry = asRecord(raw);
        if (entry.enabled === false || typeof entry.content !== 'string' || !entry.content.trim()) continue;
        const name = typeof entry.name === 'string' ? normalizeLoreName(entry.name) : '';
        const strategy = asRecord(entry.strategy);
        const keys = Array.isArray(strategy.keys) ? strategy.keys.map(key => normalizeLoreName(String(key))) : [];
        // 条目名可带“人物/角色/NPC”等前后缀；关键词则要求精确命中角色名。
        if ((name && name.includes(target)) || keys.includes(target)) matched.push(entry.content);
      }
    }
    return [...new Set(matched)];
  } catch {
    return [];
  }
}

function readSelectedLoreFromRuntime(runtime: YujianRuntimeHost): string[] {
  try {
    const storage = (runtime as Window).localStorage;
    const all = asRecord(JSON.parse(storage.getItem('daoyuan_wx_lore_selected') || '{}'));
    const selected = Array.isArray(all.__global__)
      ? all.__global__
      : Object.values(all).flatMap(value => Array.isArray(value) ? value : []);
    const seen = new Set<string>();
    return selected.flatMap(item => {
      const entry = asRecord(item);
      const content = entry.content;
      const uid = typeof entry.uid === 'string' ? entry.uid : String(content ?? '');
      if (typeof content !== 'string' || !content || seen.has(uid)) return [];
      seen.add(uid);
      return [content];
    });
  } catch { return []; }
}

export async function fetchYujianModels(apiBaseUrl: string, apiKey: string): Promise<string[]> {
  if (!apiBaseUrl.trim()) throw new Error('请先填写基础 URL');
  let endpoint = apiBaseUrl.trim().replace(/\/+$/, '').replace(/\/chat\/completions$/, '');
  if (!endpoint.endsWith('/models')) endpoint += '/models';
  const response = await fetch(endpoint, {
    method: 'GET',
    headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`获取模型列表失败: ${response.status} - ${errorText.slice(0, 200)}`);
  }
  const payload = asRecord(await response.json());
  const rows = Array.isArray(payload.data) ? payload.data : [];
  return rows
    .map(item => typeof item === 'string' ? item : asRecord(item).id)
    .filter((item): item is string => typeof item === 'string' && Boolean(item))
    .sort((a, b) => a.localeCompare(b));
}

export interface StandaloneYujianMessage {
  from: 'them' | 'me';
  text: string;
  time: string;
  sourceMessageId?: string;
  sourceFingerprint?: string;
  generationMode?: 'auto' | 'manual' | 'import';
}

const STANDALONE_STORAGE_KEY = 'daoyuan_yujian_standalone_v1';
const KNOWN_CONTACTS_STORAGE_KEY = 'daoyuan_yujian_known_contacts_v1';

export interface StandaloneKnownContact {
  name: string;
  portrait?: string;
  affection?: string;
  affectionLabel?: '好感度' | '亲密度';
  preview: string;
  time: string;
  detail: string;
  unread: number;
}

function readStandaloneStore(hostWindow: Window): Record<string, Record<string, StandaloneYujianMessage[]>> {
  try { return asRecord(JSON.parse(hostWindow.localStorage.getItem(STANDALONE_STORAGE_KEY) || '{}')) as Record<string, Record<string, StandaloneYujianMessage[]>>; }
  catch { return {}; }
}

export function loadStandaloneYujianHistories(hostWindow: Window, chatId: string): Record<string, StandaloneYujianMessage[]> {
  return asRecord(readStandaloneStore(hostWindow)[chatId]) as Record<string, StandaloneYujianMessage[]>;
}

export function loadStandaloneKnownContacts(hostWindow: Window, chatId: string): StandaloneKnownContact[] {
  try {
    const store = asRecord(JSON.parse(hostWindow.localStorage.getItem(KNOWN_CONTACTS_STORAGE_KEY) || '{}'));
    const rows = store[chatId];
    if (!Array.isArray(rows)) return [];
    return rows.flatMap(raw => {
      const item = asRecord(raw);
      if (typeof item.name !== 'string' || !item.name.trim()) return [];
      return [{
        name: item.name,
        portrait: typeof item.portrait === 'string' ? item.portrait : undefined,
        affection: typeof item.affection === 'string' ? item.affection : undefined,
        affectionLabel: item.affectionLabel === '亲密度' ? '亲密度' : item.affectionLabel === '好感度' ? '好感度' : undefined,
        preview: typeof item.preview === 'string' ? item.preview : '尚未开始传讯',
        time: typeof item.time === 'string' ? item.time : '',
        detail: typeof item.detail === 'string' ? item.detail : '已认识联系人',
        unread: typeof item.unread === 'number' ? item.unread : 0,
      }];
    });
  } catch { return []; }
}

export function rememberStandaloneKnownContacts(hostWindow: Window, chatId: string, contacts: StandaloneKnownContact[]): void {
  try {
    const store = asRecord(JSON.parse(hostWindow.localStorage.getItem(KNOWN_CONTACTS_STORAGE_KEY) || '{}'));
    const previous = loadStandaloneKnownContacts(hostWindow, chatId);
    const merged = new Map(previous.map(contact => [contact.name, contact]));
    for (const contact of contacts) merged.set(contact.name, { ...merged.get(contact.name), ...contact });
    store[chatId] = [...merged.values()];
    hostWindow.localStorage.setItem(KNOWN_CONTACTS_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // 联系人缓存失败不应阻断玉简本身。
  }
}

export function appendStandaloneYujianRecord(hostWindow: Window, chatId: string, charName: string, from: 'them' | 'me', content: string, storyTime = '', source?: Pick<StandaloneYujianMessage, 'sourceMessageId' | 'sourceFingerprint' | 'generationMode'>): void {
  const store = readStandaloneStore(hostWindow);
  const chat = asRecord(store[chatId]) as Record<string, StandaloneYujianMessage[]>;
  store[chatId] = chat;
  const history = Array.isArray(chat[charName]) ? chat[charName] : [];
  chat[charName] = history;
  const now = new Date();
  const time = storyTime || `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  history.push({ from, text: content, time, ...source });
  if (history.length > 100) history.splice(0, history.length - 100);
  hostWindow.localStorage.setItem(STANDALONE_STORAGE_KEY, JSON.stringify(store));
}

export function removeAutoYujianRecordsForFloor(hostWindow: Window, chatId: string, sourceMessageId: string): number {
  const store = readStandaloneStore(hostWindow);
  const chat = asRecord(store[chatId]) as Record<string, StandaloneYujianMessage[]>;
  let removed = 0;
  for (const [name, history] of Object.entries(chat)) {
    if (!Array.isArray(history)) continue;
    const kept = history.filter(message => {
      const match = message.generationMode === 'auto' && message.sourceMessageId === sourceMessageId;
      if (match) removed += 1;
      return !match;
    });
    chat[name] = kept;
  }
  if (removed) {
    store[chatId] = chat;
    hostWindow.localStorage.setItem(STANDALONE_STORAGE_KEY, JSON.stringify(store));
  }
  return removed;
}

export function reconcileAutoYujianRecords(
  hostWindow: Window,
  chatId: string,
  currentSources: Map<string, string>,
): number {
  const store = readStandaloneStore(hostWindow);
  const chat = asRecord(store[chatId]) as Record<string, StandaloneYujianMessage[]>;
  let removed = 0;
  let changed = false;
  const idByFingerprint = new Map([...currentSources].map(([id, fingerprint]) => [fingerprint, id]));
  for (const [name, history] of Object.entries(chat)) {
    if (!Array.isArray(history)) continue;
    chat[name] = history.filter(message => {
      if (message.generationMode !== 'auto' || !message.sourceFingerprint) return true;
      const currentId = idByFingerprint.get(message.sourceFingerprint);
      if (!currentId) { removed += 1; return false; }
      if (message.sourceMessageId !== currentId) {
        message.sourceMessageId = currentId;
        changed = true;
      }
      return true;
    });
  }
  if (removed || changed) {
    store[chatId] = chat;
    hostWindow.localStorage.setItem(STANDALONE_STORAGE_KEY, JSON.stringify(store));
  }
  return removed;
}

export function deleteStandaloneYujianRecord(
  hostWindow: Window,
  chatId: string,
  charName: string,
  index: number,
  expected: StandaloneYujianMessage,
): boolean {
  const store = readStandaloneStore(hostWindow);
  const chat = asRecord(store[chatId]) as Record<string, StandaloneYujianMessage[]>;
  const history = Array.isArray(chat[charName]) ? chat[charName] : [];
  const current = history[index];
  if (!current || current.from !== expected.from || current.text !== expected.text || current.time !== expected.time) return false;
  history.splice(index, 1);
  chat[charName] = history;
  store[chatId] = chat;
  hostWindow.localStorage.setItem(STANDALONE_STORAGE_KEY, JSON.stringify(store));
  return true;
}

export function clearStandaloneYujianHistory(hostWindow: Window, chatId: string, charName: string): number {
  const store = readStandaloneStore(hostWindow);
  const chat = asRecord(store[chatId]) as Record<string, StandaloneYujianMessage[]>;
  const history = Array.isArray(chat[charName]) ? chat[charName] : [];
  if (!history.length) return 0;
  const removed = history.length;
  chat[charName] = [];
  store[chatId] = chat;
  hostWindow.localStorage.setItem(STANDALONE_STORAGE_KEY, JSON.stringify(store));
  return removed;
}

export interface StatusYujianHistoryImportResult {
  contacts: number;
  imported: number;
  skipped: number;
}

/** Merge a read-only status-bar projection into the standalone, chat-scoped store. */
export function importStatusYujianHistories(
  hostWindow: Window,
  chatId: string,
  contacts: Array<{ name: string; history: StandaloneYujianMessage[] }>,
): StatusYujianHistoryImportResult {
  const store = readStandaloneStore(hostWindow);
  const chat = asRecord(store[chatId]) as Record<string, StandaloneYujianMessage[]>;
  store[chatId] = chat;
  let imported = 0;
  let skipped = 0;
  let touchedContacts = 0;
  const fingerprint = (message: StandaloneYujianMessage): string =>
    `${message.from}\u0000${message.time.trim()}\u0000${message.text.trim()}`;

  for (const contact of contacts) {
    const name = contact.name.trim();
    if (!name || !Array.isArray(contact.history) || !contact.history.length) continue;
    const history = Array.isArray(chat[name]) ? chat[name] : [];
    const seen = new Set(history.map(fingerprint));
    let contactImported = 0;
    for (const raw of contact.history) {
      const text = typeof raw.text === 'string' ? raw.text.trim() : '';
      if (!text || (raw.from !== 'me' && raw.from !== 'them')) continue;
      const message: StandaloneYujianMessage = {
        from: raw.from,
        text,
        time: typeof raw.time === 'string' && raw.time.trim() ? raw.time.trim() : '未知时间',
      };
      const key = fingerprint(message);
      if (seen.has(key)) { skipped += 1; continue; }
      seen.add(key);
      history.push(message);
      imported += 1;
      contactImported += 1;
    }
    if (contactImported) {
      chat[name] = history.slice(-100);
      touchedContacts += 1;
    }
  }
  if (imported) hostWindow.localStorage.setItem(STANDALONE_STORAGE_KEY, JSON.stringify(store));
  return { contacts: touchedContacts, imported, skipped };
}

function extractGeneratedText(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  const record = asRecord(value);
  const choices = Array.isArray(record.choices) ? record.choices : [];
  const choiceMessage = asRecord(asRecord(choices[0]).message).content;
  if (typeof choiceMessage === 'string') return choiceMessage.trim();
  for (const key of ['text', 'content', 'response', 'message']) {
    if (typeof record[key] === 'string') return (record[key] as string).trim();
  }
  return String(value ?? '').trim();
}

let activeSend: Promise<void> | null = null;

export function resetYujianRuntimeContext(): void {
  // 独立聊天仅以 chatId 隔离，本函数保留给宿主聊天切换生命周期调用。
}

export function sendYujianMessage(hostWindow: Window, chatId: string, charName: string, text: string): Promise<void> {
  return sendYujianMessageWithProgress(hostWindow, chatId, charName, text);
}

export function sendYujianMessageWithProgress(
  hostWindow: Window,
  chatId: string,
  charName: string,
  text: string,
  onProgress?: (phase: 'user-written' | 'reply-written') => void,
): Promise<void> {
  if (activeSend) return Promise.reject(new Error('已有一条玉简传讯正在生成中'));
  activeSend = (async () => {
    const runtime = hostWindow as unknown as YujianRuntimeHost;
    appendStandaloneYujianRecord(hostWindow, chatId, charName, 'me', text);
    onProgress?.('user-written');
    const settings = readSettings(hostWindow);
    const prompt = await buildOriginalInjection(runtime, chatId, charName, settings.customPrompt);
    let result: unknown;
    if (settings.apiBaseUrl && settings.apiModel) {
      let endpoint = settings.apiBaseUrl.replace(/\/+$/, '');
      if (!endpoint.endsWith('/chat/completions')) endpoint += '/chat/completions';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(settings.apiKey ? { Authorization: `Bearer ${settings.apiKey}` } : {}) },
        body: JSON.stringify({ model: settings.apiModel, messages: [{ role: 'system', content: prompt }, { role: 'user', content: text }], temperature: 0.7, max_tokens: 2000 }),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API 请求失败: ${response.status} - ${errorText}`);
      }
      result = await response.json();
    } else {
      const generate = runtime.generate ?? runtime.TavernHelper?.generate;
      if (typeof generate !== 'function') throw new Error('酒馆生成能力不可用');
      // 原版直接调用全局 generate；不要绑定到 runtime/TavernHelper 对象上。
      result = await generate({ user_input: `${prompt}\n\n${text}` });
    }
    const reply = extractGeneratedText(result);
    if (!reply) throw new Error('生成结果为空');
    appendStandaloneYujianRecord(hostWindow, chatId, charName, 'them', reply);
    onProgress?.('reply-written');
  })().finally(() => { activeSend = null; });
  return activeSend;
}

export interface StoryYujianEvent {
  contact: string;
  direction: 'to_player' | 'from_player';
  content: string;
  storyTime: string;
}

const STORY_PARSE_PROMPT = `你是修仙世界玉简通信逐字提取器，不是剧情摘要器。

参考原卡世界书“玉简”更新规则：玉简是类似微信的好友通信；只有主角与好友实际发生消息收发时才新增历史记录。好友主动来讯通常源于主角重大成就或变故、好友发现机缘或遭遇危机求救，或关系达到日常问候/挑衅条件；这些触发条件只能帮助核验，不能用来推断正文没有写出的消息。消息应是贴合人物的自然、口语化通信正文，而不是旁白摘要。

只有同时满足以下全部条件，才能输出一条事件：
1. 正文明示使用“玉简”“传讯玉符”“通讯玉符”等远程通信媒介；仅出现“传来消息”“短讯”“联系”等模糊说法不够。
2. 正文明示消息已经发送或已经收到；准备、打算、想要、草拟、封存但未发送均忽略。
3. 正文给出了实际传递的消息原文。content必须逐字摘录这段消息，不得概括、改写、补全或把叙述动作变成台词。
4. evidenceQuote必须逐字摘录正文中能同时证明“通信媒介+已发生收发”的邻近句子。

以下内容必须忽略：当面对话、传音入密、心理活动、回忆、转述、旁白总结、动作描述、意图、通信结果，以及没有消息原文的“确认了位置”“发去催促意味的短讯”“将灵力与短讯封入其中”等叙述。

若无法逐字定位消息原文，events返回空数组。只返回合法JSON，无Markdown：{"schemaVersion":1,"events":[{"contact":"联系人姓名","direction":"to_player或from_player","content":"正文中的消息原文","evidenceQuote":"正文中的媒介与收发证据原句","storyTime":"正文内时间；未知则空字符串"}]}`;

export async function extractStoryYujianEvents(hostWindow: Window, story: string): Promise<StoryYujianEvent[]> {
  if (!story.trim()) return [];
  const runtime = hostWindow as unknown as YujianRuntimeHost;
  const settings = readSettings(hostWindow);
  let result: unknown;
  if (settings.apiBaseUrl && settings.apiModel) {
    let endpoint = settings.apiBaseUrl.replace(/\/+$/, '');
    if (!endpoint.endsWith('/chat/completions')) endpoint += '/chat/completions';
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(settings.apiKey ? { Authorization: `Bearer ${settings.apiKey}` } : {}) },
      body: JSON.stringify({ model: settings.apiModel, temperature: 0, max_tokens: 2400, messages: [{ role: 'system', content: STORY_PARSE_PROMPT }, { role: 'user', content: story.slice(0, 16000) }] }),
    });
    if (!response.ok) throw new Error(`玉简正文解析请求失败：${response.status} ${(await response.text()).slice(0, 160)}`);
    result = await response.json();
  } else {
    const generate = runtime.generate ?? runtime.TavernHelper?.generate;
    if (typeof generate !== 'function') throw new Error('酒馆生成能力不可用');
    result = await generate({ user_input: `${STORY_PARSE_PROMPT}\n\n【待解析正文】\n${story.slice(0, 16000)}` });
  }
  const raw = extractGeneratedText(result).replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw new Error('玉简正文解析返回不是合法 JSON'); }
  const rows = Array.isArray(asRecord(parsed).events) ? asRecord(parsed).events as unknown[] : [];
  return rows.slice(0, 12).flatMap(item => {
    const event = asRecord(item);
    const contact = typeof event.contact === 'string' ? event.contact.trim() : '';
    const content = typeof event.content === 'string' ? event.content.trim() : '';
    const evidence = typeof event.evidenceQuote === 'string' ? event.evidenceQuote.trim() : '';
    const direction = event.direction === 'to_player' || event.direction === 'from_player' ? event.direction : null;
    const normalize = (value: string): string => value.replace(/\s+/g, ' ').trim();
    const normalizedStory = normalize(story);
    const explicitMedium = /(玉简|传讯玉符|通讯玉符|传讯符)/.test(evidence);
    const explicitDelivery = /(发送|发出|发去|传来|传入|收到|收悉|回讯|回复|亮起|震动|浮现|显现)/.test(evidence);
    const narrativeSummary = /(确认了.{0,12}(传来|位置|消息)|将.{0,24}(短讯|消息).{0,12}(封入|塞入)|准备.{0,12}(发送|传讯)|打算.{0,12}(发送|传讯))/.test(content);
    if (
      !contact || !content || !evidence || !direction
      || !explicitMedium || !explicitDelivery || narrativeSummary
      || !normalizedStory.includes(normalize(content))
      || !normalizedStory.includes(normalize(evidence))
    ) return [];
    return [{ contact, content, direction, storyTime: typeof event.storyTime === 'string' ? event.storyTime.trim() : '' }];
  });
}
