import { parseAppData, type AppData } from '../contract/appData';

const UI_KEY = 'daoyuan_feature_frontend_ui_v1';

export interface UiPreferences {
  layoutMode: 'auto' | 'desktop-tablet' | 'phone';
  lastApp: string;
}

const defaults: UiPreferences = { layoutMode: 'auto', lastApp: 'home' };

function safeStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadUiPreferences(): UiPreferences {
  const store = safeStorage();
  if (!store) return { ...defaults };
  try {
    const parsed = JSON.parse(store.getItem(UI_KEY) ?? 'null') as Partial<UiPreferences> | null;
    return {
      layoutMode: parsed?.layoutMode === 'phone' || parsed?.layoutMode === 'desktop-tablet' || parsed?.layoutMode === 'auto' ? parsed.layoutMode : defaults.layoutMode,
      lastApp: typeof parsed?.lastApp === 'string' ? parsed.lastApp : defaults.lastApp,
    };
  } catch {
    return { ...defaults };
  }
}

export function saveUiPreferences(value: UiPreferences): void {
  try {
    safeStorage()?.setItem(UI_KEY, JSON.stringify(value));
  } catch {
    // 偏好属于可丢弃数据；localStorage 不可用时不阻塞主界面。
  }
}

export function loadChatAppData(raw: unknown): AppData {
  return parseAppData(raw);
}
