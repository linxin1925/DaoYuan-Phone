/// <reference types="vite/client" />

declare module '*.css?inline' {
  const css: string;
  export default css;
}

interface Window {
  __daoyuanMvuChannel?: {
    readonly name: 'MVU通道';
    readonly ready: boolean;
    readonly contextRevision: number;
    readonly messageId: string | number | null;
    readonly variables: unknown;
    readonly readAt: string | null;
  };
  DAOYUAN_FEATURE_PREVIEW?: boolean;
  waitGlobalInitialized?: <T>(name: string) => Promise<T>;
  TavernHelper?: {
    createScriptIdIframe?: (scriptId: string) => HTMLIFrameElement;
    tavern_events?: { [event: string]: string | undefined; CHAT_CHANGED?: string };
  };
  SillyTavern?: {
    getContext?: () => {
      chatId?: string;
      chat?: Array<{ message_id?: string | number }>;
      eventSource?: {
        on: (event: string, listener: (...args: unknown[]) => void) => void;
        removeListener: (event: string, listener: (...args: unknown[]) => void) => void;
      };
      variables?: {
        local?: {
          get: (name: string) => unknown;
          set: (name: string, value: unknown) => unknown;
        };
      };
    };
  };
  Mvu?: {
    getMvuData?: (scope?: unknown) => unknown | Promise<unknown>;
    replaceMvuData?: (data: unknown, scope?: unknown) => unknown | Promise<unknown>;
    events?: { VARIABLE_INITIALIZED?: string; VARIABLE_UPDATE_STARTED?: string; VARIABLE_UPDATE_ENDED?: string };
  };
}
