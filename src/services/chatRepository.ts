import {
  APP_DATA_SCHEMA_VERSION,
  CHAT_VARIABLE_KEYS,
  emptyChatVariableData,
  parseChatVariableEnvelope,
  projectAppData,
  type AppData,
  type AppDataEnvelope,
  type ChatVariableKey,
} from '../contract/appData';

export interface ChatVariableAdapter {
  read(key: ChatVariableKey): Promise<unknown>;
  write(key: ChatVariableKey, value: AppDataEnvelope): Promise<void>;
}

export function createTavernChatVariableAdapter(hostWindow: Window): ChatVariableAdapter {
  const unavailable = new UnavailableChatVariableAdapter();
  const context = () => {
    try {
      const getContext = hostWindow.SillyTavern?.getContext;
      return typeof getContext === 'function' ? getContext() : undefined;
    } catch { return undefined; }
  };
  return {
    async read(key) {
      const store = context()?.variables?.local;
      return store ? store.get(key) : unavailable.read(key);
    },
    async write(key, value) {
      const store = context()?.variables?.local;
      if (!store) return unavailable.write(key, value);
      store.set(key, value);
    },
  };
}

export class UnavailableChatVariableAdapter implements ChatVariableAdapter {
  readonly reason = 'chat-variable-host-adapter-not-configured';

  async read(_key: ChatVariableKey): Promise<unknown> {
    return undefined;
  }

  async write(_key: ChatVariableKey, _value: AppDataEnvelope): Promise<void> {
    throw new Error(this.reason);
  }
}

export class MemoryChatVariableAdapter implements ChatVariableAdapter {
  private readonly values = new Map<ChatVariableKey, unknown>();

  constructor(initial: Partial<Record<ChatVariableKey, unknown>> = {}) {
    for (const key of CHAT_VARIABLE_KEYS) this.values.set(key, initial[key]);
  }

  async read(key: ChatVariableKey): Promise<unknown> {
    return this.values.get(key);
  }

  async write(key: ChatVariableKey, value: AppDataEnvelope): Promise<void> {
    this.values.set(key, value);
  }
}

export class ChatVariableRepository {
  private readonly values = new Map<ChatVariableKey, AppDataEnvelope>();

  constructor(private readonly adapter: ChatVariableAdapter) {}

  async load(): Promise<AppData> {
    await Promise.all(CHAT_VARIABLE_KEYS.map(async key => {
      const raw = await this.adapter.read(key);
      this.values.set(key, parseChatVariableEnvelope(raw, key));
    }));
    return this.project();
  }

  project(): AppData {
    return projectAppData(Object.fromEntries(this.values));
  }

  getData(key: ChatVariableKey): Record<string, unknown> {
    return { ...(this.values.get(key)?.data ?? emptyChatVariableData[key]) };
  }

  async write<K extends ChatVariableKey>(key: K, data: Record<string, unknown>, expectedRevision?: number): Promise<AppData> {
    const current = this.values.get(key) ?? parseChatVariableEnvelope(undefined, key);
    if (expectedRevision !== undefined && current.revision !== expectedRevision) {
      throw new Error(`chat variable revision conflict: ${key}`);
    }
    const next: AppDataEnvelope = {
      schemaVersion: APP_DATA_SCHEMA_VERSION,
      revision: current.revision + 1,
      updatedAt: new Date().toISOString(),
      data: { ...emptyChatVariableData[key], ...data },
    };
    await this.adapter.write(key, next);
    this.values.set(key, next);
    return this.project();
  }
}
