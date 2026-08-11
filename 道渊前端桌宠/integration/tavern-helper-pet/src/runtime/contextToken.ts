export interface OperationContext {
  chatId: string | null;
  messageId: string | null;
  contextRevision: number;
  generation: number;
}

export interface ContextSource {
  chatId?: string | null;
  messageId?: string | null;
  contextRevision: number;
  generation: number;
}

export function captureOperationContext(source: ContextSource): OperationContext {
  return {
    chatId: source.chatId ?? null,
    messageId: source.messageId ?? null,
    contextRevision: source.contextRevision,
    generation: source.generation,
  };
}

export function isCurrentOperationContext(current: ContextSource, captured: OperationContext): boolean {
  return current.contextRevision === captured.contextRevision
    && current.generation === captured.generation
    && current.chatId === captured.chatId
    && current.messageId === captured.messageId;
}
