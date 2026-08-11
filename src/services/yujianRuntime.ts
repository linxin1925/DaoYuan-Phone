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

function appendStandaloneRecord(hostWindow: Window, chatId: string, charName: string, from: 'them' | 'me', content: string): void {
  const store = readStandaloneStore(hostWindow);
  const chat = asRecord(store[chatId]) as Record<string, StandaloneYujianMessage[]>;
  store[chatId] = chat;
  const history = Array.isArray(chat[charName]) ? chat[charName] : [];
  chat[charName] = history;
  const now = new Date();
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  history.push({ from, text: content, time });
  hostWindow.localStorage.setItem(STANDALONE_STORAGE_KEY, JSON.stringify(store));
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
    appendStandaloneRecord(hostWindow, chatId, charName, 'me', text);
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
    appendStandaloneRecord(hostWindow, chatId, charName, 'them', reply);
    onProgress?.('reply-written');
  })().finally(() => { activeSend = null; });
  return activeSend;
}
