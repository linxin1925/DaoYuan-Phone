export type HudPhase = 'idle' | 'opening' | 'ready' | 'switching' | 'destroyed';

export interface HudSession {
  phase: HudPhase;
  generation: number;
  contextRevision: number;
  chatId: string | null;
  messageId: string | null;
  visible: boolean;
  dirty: boolean;
  abortController: AbortController | null;
  disposers: Array<() => void>;
}

export function createHudSession(): HudSession {
  return {
    phase: 'idle',
    generation: 0,
    contextRevision: 0,
    chatId: null,
    messageId: null,
    visible: false,
    dirty: false,
    abortController: null,
    disposers: [],
  };
}

export function beginGeneration(session: HudSession): number {
  session.generation += 1;
  session.abortController?.abort();
  session.abortController = new AbortController();
  return session.generation;
}

export function changeContext(session: HudSession): number {
  session.contextRevision += 1;
  session.dirty = false;
  beginGeneration(session);
  return session.contextRevision;
}

export function destroyHudSession(session: HudSession): void {
  if (session.phase === 'destroyed') return;
  session.phase = 'destroyed';
  session.visible = false;
  session.contextRevision += 1;
  session.generation += 1;
  session.abortController?.abort();
  session.abortController = null;
  while (session.disposers.length > 0) {
    try {
      session.disposers.pop()?.();
    } catch (error) {
      console.warn('[道渊玉简] cleanup failed', error);
    }
  }
}
