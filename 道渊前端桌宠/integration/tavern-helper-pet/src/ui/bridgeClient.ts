import { parseBridgeMessage, type BridgeAction, type BridgeEnvelope } from '../contract/bridge';

export interface BridgeClient {
  send(action: BridgeAction, payload?: Record<string, unknown>): void;
  subscribe(listener: (message: BridgeEnvelope) => void): () => void;
  destroy(): void;
}

export function createBridgeClient(view: Window, sendToHost: (action: BridgeAction, payload?: Record<string, unknown>) => void): BridgeClient {
  const listeners = new Set<(message: BridgeEnvelope) => void>();
  const onMessage = (event: MessageEvent): void => {
    const message = parseBridgeMessage(event.data);
    if (!message) return;
    listeners.forEach(listener => listener(message));
  };
  view.addEventListener('message', onMessage);
  return {
    send(action, payload = {}) {
      sendToHost(action, payload);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    destroy() {
      listeners.clear();
      view.removeEventListener('message', onMessage);
    },
  };
}
