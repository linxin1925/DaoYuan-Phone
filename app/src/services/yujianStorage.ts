export interface StoredYujianMessage {
  from: 'them' | 'me';
  text: string;
  time: string;
  sourceMessageId?: string;
  sourceFingerprint?: string;
  generationMode?: 'auto' | 'manual' | 'import';
}

export interface StoredYujianContact {
  name: string;
  portrait?: string;
  affection?: string;
  affectionLabel?: '好感度' | '亲密度';
  preview: string;
  time: string;
  detail: string;
  unread: number;
}

export type YujianHistories = Record<string, StoredYujianMessage[]>;

const DB_NAME = 'daoyuan_yujian_storage';
const DB_VERSION = 1;
const HISTORY_STORE = 'histories';
const CONTACT_STORE = 'contacts';
const PROCESSED_STORE = 'processed';
const META_STORE = 'meta';
const LEGACY_ARCHIVE_STORE = 'legacyArchive';
const MIGRATION_KEY = 'legacy-localstorage-v1';
const LEGACY_HISTORY_KEY = 'daoyuan_yujian_standalone_v1';
const LEGACY_CONTACT_KEY = 'daoyuan_yujian_known_contacts_v1';
const LEGACY_PROCESSED_KEY = 'daoyuan_yujian_story_processed_v1';
const FALLBACK_HISTORY_KEY = 'daoyuan_yujian_fallback_v2';
const FALLBACK_CONTACT_KEY = 'daoyuan_yujian_contacts_fallback_v2';
const MAX_MESSAGE_LENGTH = 8000;
const MAX_MESSAGES_PER_CONTACT = 100;
const MAX_CONTACTS_PER_CHAT = 80;
const MAX_CHAT_RECORDS = 24;
const MAX_FALLBACK_CHARS = 1_500_000;

interface ChatRecord<T> { chatId: string; value: T; updatedAt: number }

export class YujianStorageError extends Error {
  readonly code: 'storage-full' | 'storage-unavailable';
  constructor(code: 'storage-full' | 'storage-unavailable', message: string, cause?: unknown) {
    super(message, { cause });
    this.name = 'YujianStorageError';
    this.code = code;
  }
}

export function isYujianStorageError(error: unknown): error is YujianStorageError {
  return error instanceof YujianStorageError;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function isQuotaError(error: unknown): boolean {
  const name = error instanceof DOMException ? error.name : asRecord(error).name;
  return name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED';
}

function storageError(error: unknown): YujianStorageError {
  return isQuotaError(error)
    ? new YujianStorageError('storage-full', '玉简本地存储已满，消息已生成但聊天历史未能保存。请导出或清理旧聊天后重试。', error)
    : new YujianStorageError('storage-unavailable', '玉简本地历史暂时无法保存。', error);
}

function cleanMessage(raw: unknown): StoredYujianMessage | null {
  const item = asRecord(raw);
  if ((item.from !== 'me' && item.from !== 'them') || typeof item.text !== 'string' || !item.text.trim()) return null;
  const generationMode = item.generationMode === 'auto' || item.generationMode === 'manual' || item.generationMode === 'import'
    ? item.generationMode : undefined;
  return {
    from: item.from,
    text: item.text.trim().slice(0, MAX_MESSAGE_LENGTH),
    time: typeof item.time === 'string' ? item.time.slice(0, 80) : '',
    sourceMessageId: typeof item.sourceMessageId === 'string' ? item.sourceMessageId.slice(0, 120) : undefined,
    sourceFingerprint: typeof item.sourceFingerprint === 'string' ? item.sourceFingerprint.slice(0, 240) : undefined,
    generationMode,
  };
}

export function normalizeYujianHistories(raw: unknown): YujianHistories {
  return Object.fromEntries(Object.entries(asRecord(raw)).slice(-MAX_CONTACTS_PER_CHAT).flatMap(([name, value]) => {
    const cleanName = name.trim().slice(0, 80);
    if (!cleanName || !Array.isArray(value)) return [];
    const messages = value.flatMap(item => cleanMessage(item) ?? []).slice(-MAX_MESSAGES_PER_CONTACT);
    return messages.length ? [[cleanName, messages]] : [];
  }));
}

export function normalizeYujianContacts(raw: unknown): StoredYujianContact[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(-MAX_CONTACTS_PER_CHAT).flatMap(value => {
    const item = asRecord(value);
    if (typeof item.name !== 'string' || !item.name.trim()) return [];
    return [{
      name: item.name.trim().slice(0, 80),
      portrait: typeof item.portrait === 'string' ? item.portrait.slice(0, 1000) : undefined,
      affection: typeof item.affection === 'string' ? item.affection.slice(0, 80) : undefined,
      affectionLabel: item.affectionLabel === '亲密度' ? '亲密度' as const : item.affectionLabel === '好感度' ? '好感度' as const : undefined,
      preview: typeof item.preview === 'string' ? item.preview.slice(0, 500) : '尚未开始传讯',
      time: typeof item.time === 'string' ? item.time.slice(0, 80) : '',
      detail: typeof item.detail === 'string' ? item.detail.slice(0, 500) : '已认识联系人',
      unread: typeof item.unread === 'number' && Number.isFinite(item.unread) ? Math.max(0, Math.floor(item.unread)) : 0,
    }];
  });
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

function openDatabase(hostWindow: Window): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!hostWindow.indexedDB) { reject(new Error('IndexedDB unavailable')); return; }
    const request = hostWindow.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(HISTORY_STORE)) database.createObjectStore(HISTORY_STORE, { keyPath: 'chatId' });
      if (!database.objectStoreNames.contains(CONTACT_STORE)) database.createObjectStore(CONTACT_STORE, { keyPath: 'chatId' });
      if (!database.objectStoreNames.contains(PROCESSED_STORE)) database.createObjectStore(PROCESSED_STORE, { keyPath: 'chatId' });
      if (!database.objectStoreNames.contains(META_STORE)) database.createObjectStore(META_STORE, { keyPath: 'key' });
      if (!database.objectStoreNames.contains(LEGACY_ARCHIVE_STORE)) database.createObjectStore(LEGACY_ARCHIVE_STORE, { keyPath: 'key' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('IndexedDB upgrade blocked'));
  });
}

const initialization = new WeakMap<Window, Promise<boolean>>();

async function initialize(hostWindow: Window): Promise<boolean> {
  const existing = initialization.get(hostWindow);
  if (existing) return existing;
  const pending = (async () => {
    let database: IDBDatabase | null = null;
    try {
      database = await openDatabase(hostWindow);
      const markerTransaction = database.transaction(META_STORE, 'readonly');
      const markerDone = transactionDone(markerTransaction);
      const marker = await requestResult(markerTransaction.objectStore(META_STORE).get(MIGRATION_KEY));
      await markerDone;
      if (marker) return true;
      const legacyHistoryRaw = hostWindow.localStorage.getItem(LEGACY_HISTORY_KEY);
      const legacyContactRaw = hostWindow.localStorage.getItem(LEGACY_CONTACT_KEY);
      const legacyProcessedRaw = hostWindow.localStorage.getItem(LEGACY_PROCESSED_KEY);
      let legacyHistories: Record<string, unknown> = {};
      let legacyContacts: Record<string, unknown> = {};
      let legacyProcessed: Record<string, unknown> = {};
      try { legacyHistories = asRecord(JSON.parse(legacyHistoryRaw || '{}')); } catch { /* raw value remains archived */ }
      try { legacyContacts = asRecord(JSON.parse(legacyContactRaw || '{}')); } catch { /* raw value remains archived */ }
      try { legacyProcessed = asRecord(JSON.parse(legacyProcessedRaw || '{}')); } catch { /* raw value remains archived */ }
      const transaction = database.transaction([HISTORY_STORE, CONTACT_STORE, PROCESSED_STORE, META_STORE, LEGACY_ARCHIVE_STORE], 'readwrite');
      const historyStore = transaction.objectStore(HISTORY_STORE);
      const contactStore = transaction.objectStore(CONTACT_STORE);
      const processedStore = transaction.objectStore(PROCESSED_STORE);
      const archiveStore = transaction.objectStore(LEGACY_ARCHIVE_STORE);
      const now = Date.now();
      for (const [chatId, value] of Object.entries(legacyHistories)) {
        historyStore.put({ chatId, value: normalizeYujianHistories(value), updatedAt: now } satisfies ChatRecord<YujianHistories>);
      }
      for (const [chatId, value] of Object.entries(legacyContacts)) {
        contactStore.put({ chatId, value: normalizeYujianContacts(value), updatedAt: now } satisfies ChatRecord<StoredYujianContact[]>);
      }
      for (const [chatId, value] of Object.entries(legacyProcessed)) {
        const processed = Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string').slice(-600) : [];
        processedStore.put({ chatId, value: processed, updatedAt: now } satisfies ChatRecord<string[]>);
      }
      for (const [key, value] of [[LEGACY_HISTORY_KEY, legacyHistoryRaw], [LEGACY_CONTACT_KEY, legacyContactRaw], [LEGACY_PROCESSED_KEY, legacyProcessedRaw]] as const) {
        if (value !== null) archiveStore.put({ key, value, migratedAt: now });
      }
      transaction.objectStore(META_STORE).put({ key: MIGRATION_KEY, completedAt: now });
      await transactionDone(transaction);
      hostWindow.localStorage.removeItem(LEGACY_HISTORY_KEY);
      hostWindow.localStorage.removeItem(LEGACY_CONTACT_KEY);
      hostWindow.localStorage.removeItem(LEGACY_PROCESSED_KEY);
      return true;
    } catch (error) {
      console.warn('[道渊玉简] IndexedDB 初始化失败，启用有界 localStorage 降级存储', error);
      return false;
    } finally { database?.close(); }
  })();
  initialization.set(hostWindow, pending);
  return pending;
}

function readFallback<T>(hostWindow: Window, key: string): Record<string, ChatRecord<T>> {
  try { return asRecord(JSON.parse(hostWindow.localStorage.getItem(key) || '{}')) as Record<string, ChatRecord<T>>; }
  catch { return {}; }
}

function readLegacyChat(hostWindow: Window, key: string, chatId: string): unknown {
  try { return asRecord(JSON.parse(hostWindow.localStorage.getItem(key) || '{}'))[chatId]; }
  catch { return undefined; }
}

function writeFallback<T>(hostWindow: Window, key: string, chatId: string, value: T): void {
  const store = readFallback<T>(hostWindow, key);
  store[chatId] = { chatId, value, updatedAt: Date.now() };
  const rows = Object.values(store).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 8);
  let serialized = JSON.stringify(Object.fromEntries(rows.map(row => [row.chatId, row])));
  while (serialized.length > MAX_FALLBACK_CHARS && rows.length > 1) {
    rows.pop();
    serialized = JSON.stringify(Object.fromEntries(rows.map(row => [row.chatId, row])));
  }
  try { hostWindow.localStorage.setItem(key, serialized); } catch (error) { throw storageError(error); }
}

async function readRecord<T>(hostWindow: Window, storeName: string, fallbackKey: string, chatId: string): Promise<T | undefined> {
  if (!await initialize(hostWindow)) return readFallback<T>(hostWindow, fallbackKey)[chatId]?.value;
  const database = await openDatabase(hostWindow);
  try {
    const transaction = database.transaction(storeName, 'readonly');
    const done = transactionDone(transaction);
    const record = await requestResult(transaction.objectStore(storeName).get(chatId)) as ChatRecord<T> | undefined;
    await done;
    return record?.value;
  } catch (error) { throw storageError(error); }
  finally { database.close(); }
}

async function writeRecord<T>(hostWindow: Window, storeName: string, fallbackKey: string, chatId: string, value: T): Promise<void> {
  if (!await initialize(hostWindow)) { writeFallback(hostWindow, fallbackKey, chatId, value); return; }
  const database = await openDatabase(hostWindow);
  try {
    const transaction = database.transaction(storeName, 'readwrite');
    transaction.objectStore(storeName).put({ chatId, value, updatedAt: Date.now() } satisfies ChatRecord<T>);
    await transactionDone(transaction);
    const pruneTransaction = database.transaction(storeName, 'readwrite');
    const pruneDone = transactionDone(pruneTransaction);
    const store = pruneTransaction.objectStore(storeName);
    const records = await requestResult(store.getAll()) as ChatRecord<T>[];
    records.sort((a, b) => b.updatedAt - a.updatedAt).slice(MAX_CHAT_RECORDS).forEach(record => store.delete(record.chatId));
    await pruneDone;
  } catch (error) { throw storageError(error); }
  finally { database.close(); }
}

export async function readYujianHistories(hostWindow: Window, chatId: string): Promise<YujianHistories> {
  const value = await readRecord(hostWindow, HISTORY_STORE, FALLBACK_HISTORY_KEY, chatId);
  return normalizeYujianHistories(value ?? readLegacyChat(hostWindow, LEGACY_HISTORY_KEY, chatId));
}

export async function writeYujianHistories(hostWindow: Window, chatId: string, value: YujianHistories): Promise<void> {
  await writeRecord(hostWindow, HISTORY_STORE, FALLBACK_HISTORY_KEY, chatId, normalizeYujianHistories(value));
}

export async function readYujianContacts(hostWindow: Window, chatId: string): Promise<StoredYujianContact[]> {
  const value = await readRecord(hostWindow, CONTACT_STORE, FALLBACK_CONTACT_KEY, chatId);
  return normalizeYujianContacts(value ?? readLegacyChat(hostWindow, LEGACY_CONTACT_KEY, chatId));
}

export async function writeYujianContacts(hostWindow: Window, chatId: string, value: StoredYujianContact[]): Promise<void> {
  await writeRecord(hostWindow, CONTACT_STORE, FALLBACK_CONTACT_KEY, chatId, normalizeYujianContacts(value));
}

export async function readProcessedYujianStories(hostWindow: Window, chatId: string): Promise<string[]> {
  const value = await readRecord<unknown>(hostWindow, PROCESSED_STORE, 'daoyuan_yujian_processed_fallback_v2', chatId)
    ?? readLegacyChat(hostWindow, LEGACY_PROCESSED_KEY, chatId);
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string').slice(-600) : [];
}

export async function writeProcessedYujianStories(hostWindow: Window, chatId: string, value: string[]): Promise<void> {
  await writeRecord(hostWindow, PROCESSED_STORE, 'daoyuan_yujian_processed_fallback_v2', chatId, value.slice(-600));
}
