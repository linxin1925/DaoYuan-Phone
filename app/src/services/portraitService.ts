/**
 * 立绘服务 - 远程立绘库 + 自定义立绘存储。
 *
 * 立绘库从远程 CDN 加载（YttriumCarbide/Daoyuan 仓库 portraits.json）：
 * - charPortraits：主立绘，`|` 分隔多套（换装/多表情）
 * - charPortraitsFemale：女版立绘
 * - specialPortraits：特殊立绘（部分 URL 尾部带 `/`，解析时 trim）
 *
 * 加载策略：内置 portraits.json 首屏可用，再用缓存与远程库更新。远程更新后通过
 * onPortraitsUpdated 通知已挂载的界面刷新。
 *
 * 自定义立绘存 localStorage 'daoyuan_custom_portraits'，优先于一切内置。
 */

interface PortraitLibrary {
  charPortraits: Record<string, string>;
  charPortraitsFemale: Record<string, string>;
  specialPortraits: Record<string, string>;
}

import builtinPortraits from './portraits.json';

// 远程立绘库主路径（jsdelivr CDN）+ 回退（raw.githubusercontent）
const LIBRARY_URL = 'https://cdn.jsdelivr.net/gh/YttriumCarbide/Daoyuan@main/portraits.json';
const LIBRARY_FALLBACK_URL = 'https://raw.githubusercontent.com/YttriumCarbide/Daoyuan/main/portraits.json';
const CACHE_KEY = 'daoyuan_portraits_cache';
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 天

const K_CUSTOM = 'daoyuan_custom_portraits';
const K_FEMALE_PREF = 'daoyuan_female_portraits';
const K_SET_INDEX = 'daoyuan_portrait_set_index';

// 运行时立绘库先使用项目内快照，避免网络未就绪时玉简没有立绘。
const runtime: PortraitLibrary = { charPortraits: {}, charPortraitsFemale: {}, specialPortraits: {} };

// 立绘库更新版本号 + 订阅（fetch 成功后通知已挂载的 Modal 重算）
let portraitsVersion = 0;
const listeners = new Set<() => void>();

/** 清洗立绘库：防御性校验，URL 尾部 `/` 在 parseSet 时统一 trim */
function sanitizeLibrary(raw: PortraitLibrary): PortraitLibrary {
  const pick = (m: Record<string, string> | undefined): Record<string, string> => {
    const out: Record<string, string> = {};
    if (m && typeof m === 'object') {
      for (const [k, v] of Object.entries(m)) {
        if (typeof v === 'string' && v) out[k] = v;
      }
    }
    return out;
  };
  return {
    charPortraits: pick(raw?.charPortraits),
    charPortraitsFemale: pick(raw?.charPortraitsFemale),
    specialPortraits: pick(raw?.specialPortraits),
  };
}

Object.assign(runtime, sanitizeLibrary(builtinPortraits as PortraitLibrary));

/** 解析 `|` 分隔的多套立绘，trim 空白与尾部 `/` */
function parseSet(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split('|')
    .map(s => s.trim().replace(/\/+$/, ''))
    .filter(Boolean);
}

function loadCustom(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(K_CUSTOM) || '{}');
  } catch {
    return {};
  }
}

/** 读取"女版偏好"集合：用户显式选择过女版的角色名 */
function loadFemalePref(): Record<string, true> {
  try {
    const v = JSON.parse(localStorage.getItem(K_FEMALE_PREF) || '{}');
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}

/** 读取多套立绘选中索引：{ 角色名: 索引 } */
function loadSetIndex(): Record<string, number> {
  try {
    const v = JSON.parse(localStorage.getItem(K_SET_INDEX) || '{}');
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}

/** 该角色是否被用户显式标记为"显示女版" */
export function isFemalePreferred(name: string): boolean {
  return name in loadFemalePref();
}

/**
 * 设置/取消某角色的女版偏好。
 * 仅当 on 且该角色存在女版立绘时才会记录；否则视为取消。
 */
export function setFemalePortrait(name: string, on: boolean): void {
  const all = loadFemalePref();
  const hasFemale = hasFemalePortrait(name);
  if (on && hasFemale) all[name] = true;
  else delete all[name];
  localStorage.setItem(K_FEMALE_PREF, JSON.stringify(all));
}

/**
 * 名字归一化：去掉间隔号（·、・），用于兼容 AI 生成的"卡斯蒂利亚·哈布斯堡"等变体。
 * 例如 "卡斯蒂利亚·哈布斯堡" -> "卡斯蒂利亚哈布斯堡"，使其命中库里的无间隔号条目。
 */
function normName(name: string): string {
  return name.replace(/[·・]/g, '');
}

/** 按名查表，先试原名再试归一化名（去间隔号） */
function lookup(map: Record<string, string>, name: string): string | undefined {
  return map[name] ?? map[normName(name)];
}

/** 是否有立绘（内置或自定义） */
export function hasPortrait(name: string, gender?: string): boolean {
  return !!getPortraitUrl(name, gender);
}

/** 该角色是否存在女版立绘 */
export function hasFemalePortrait(name: string): boolean {
  return name in runtime.charPortraitsFemale || normName(name) in runtime.charPortraitsFemale;
}

/** 获取女版立绘 URL（不受自定义立绘影响，仅用于查看界面的切换预览） */
export function getFemalePortraitUrl(name: string): string {
  return runtime.charPortraitsFemale[name] || runtime.charPortraitsFemale[normName(name)] || '';
}

/**
 * 获取默认（男版/通用）立绘 URL（不受自定义与性别自动逻辑影响）。
 * 返回当前选中套的首张。
 */
export function getDefaultPortraitUrl(name: string): string {
  const sets = getPortraitSets(name);
  if (sets.length === 0) return '';
  const idx = clampIndex(name, sets.length);
  return sets[idx];
}

/** 是否为自定义立绘 */
export function isCustomPortrait(name: string): boolean {
  const all = loadCustom();
  return name in all || normName(name) in all;
}

/** 设置自定义立绘（URL 或 base64） */
export function setCustomPortrait(name: string, url: string): void {
  const all = loadCustom();
  if (url) {
    all[name] = url;
  } else {
    // 删除时同时清掉原名与归一化名，避免间隔号变体残留
    delete all[name];
    delete all[normName(name)];
  }
  localStorage.setItem(K_CUSTOM, JSON.stringify(all));
}

/** 删除自定义立绘 */
export function removeCustomPortrait(name: string): void {
  setCustomPortrait(name, '');
}

// ===== 多套立绘 =====

/**
 * 获取角色主立绘的多套 URL 数组。
 * - 自定义立绘存在时，返回单元素数组（自定义优先，不参与多套切换）
 * - 否则返回 charPortraits 中 `|` 分隔解析后的数组
 */
export function getPortraitSets(name: string): string[] {
  const custom = lookup(loadCustom(), name);
  if (custom) return [custom];
  return parseSet(lookup(runtime.charPortraits, name));
}

/** 选中索引越界保护 */
function clampIndex(name: string, len: number): number {
  if (len <= 0) return 0;
  const idx = loadSetIndex()[name] ?? 0;
  if (idx < 0 || idx >= len) return 0;
  return idx;
}

/** 获取当前选中的多套立绘索引 */
export function getSelectedSetIndex(name: string): number {
  const sets = getPortraitSets(name);
  return clampIndex(name, sets.length);
}

/** 设置当前选中的多套立绘索引（越界自动归 0） */
export function setSelectedSetIndex(name: string, idx: number): void {
  const sets = getPortraitSets(name);
  const all = loadSetIndex();
  if (idx < 0 || idx >= sets.length) {
    delete all[name];
  } else {
    all[name] = idx;
  }
  localStorage.setItem(K_SET_INDEX, JSON.stringify(all));
}

// ===== 特殊立绘 =====

/** 该角色是否存在特殊立绘 */
export function hasSpecialPortrait(name: string): boolean {
  return name in runtime.specialPortraits || normName(name) in runtime.specialPortraits;
}

/** 获取特殊立绘 URL（trim 尾部 `/`） */
export function getSpecialPortraitUrl(name: string): string {
  const raw = runtime.specialPortraits[name] || runtime.specialPortraits[normName(name)] || '';
  return raw.replace(/\/+$/, '');
}

// ===== 核心：获取立绘 URL =====

/**
 * 获取角色立绘 URL。
 * 优先级：自定义立绘 > 女版偏好 > 性别自动女版（gender 以"女"开头）> 通用立绘库[选中套]
 */
export function getPortraitUrl(name: string, gender?: string): string {
  const custom = lookup(loadCustom(), name);
  if (custom) return custom;
  if (isFemalePreferred(name) && lookup(runtime.charPortraitsFemale, name)) return lookup(runtime.charPortraitsFemale, name)!;
  if (gender && /^女/.test(gender) && lookup(runtime.charPortraitsFemale, name)) return lookup(runtime.charPortraitsFemale, name)!;
  const sets = getPortraitSets(name);
  if (sets.length === 0) return '';
  return sets[clampIndex(name, sets.length)];
}

// ===== 远程立绘库加载 =====

interface CachedLib {
  fetchedAt: number;
  data: PortraitLibrary;
}

function readCache(): PortraitLibrary | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    if (!parsed?.data || typeof parsed.fetchedAt !== 'number') return null;
    if (Date.now() - parsed.fetchedAt > CACHE_TTL) return null;
    return sanitizeLibrary(parsed.data);
  } catch {
    return null;
  }
}

function writeCache(data: PortraitLibrary): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ fetchedAt: Date.now(), data }));
  } catch {
    // 忽略配额错误
  }
}

async function fetchLibrary(url: string): Promise<PortraitLibrary | null> {
  try {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) return null;
    const json = (await res.json()) as PortraitLibrary;
    if (!json || !json.charPortraits) return null;
    return sanitizeLibrary(json);
  } catch {
    return null;
  }
}

/**
 * 异步加载远程立绘库。主路径 jsdelivr，失败回退 raw.githubusercontent，再失败用缓存/空库。
 * 成功后覆盖运行时库并通知订阅者。多次调用复用同一个 promise。
 */
let initPromise: Promise<void> | null = null;
export function initPortraits(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    // 先尝试缓存（即时生效，避免首屏后还要等 fetch）
    const cached = readCache();
    if (cached) {
      Object.assign(runtime, cached);
      portraitsVersion++;
      notify();
    }
    // 再 fetch 远程（主路径 -> 回退）
    const fetched = (await fetchLibrary(LIBRARY_URL)) || (await fetchLibrary(LIBRARY_FALLBACK_URL));
    if (fetched) {
      Object.assign(runtime, fetched);
      writeCache(fetched);
      portraitsVersion++;
      notify();
    } else if (!cached) {
      // 远程不可用时保留内置快照，不影响立绘显示。
      console.warn('[portraitService] 远程立绘库加载失败，继续使用内置快照');
    }
  })();
  return initPromise;
}

/** 订阅立绘库更新（fetch 成功后回调）。返回取消订阅函数。 */
export function onPortraitsUpdated(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function notify(): void {
  for (const cb of listeners) {
    try {
      cb();
    } catch {
      // 单个监听器异常不影响其他
    }
  }
}

/** 当前立绘库版本号（用于触发响应式） */
export function getPortraitsVersion(): number {
  return portraitsVersion;
}
