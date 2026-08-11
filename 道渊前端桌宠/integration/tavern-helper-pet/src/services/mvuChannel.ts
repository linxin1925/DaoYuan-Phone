import { readWorldDataSnapshot, replaceWorldStatData, type MvuReadRuntime, type WorldDataWriteResult } from './worldDataBridge';

export const MVU_CHANNEL_NAME = 'MVU通道' as const;

export interface MvuChannelContext {
  contextRevision: number;
  messageId: string | number | null;
}

export interface MvuChannelSnapshot extends MvuChannelContext {
  name: typeof MVU_CHANNEL_NAME;
  ready: boolean;
  variables: unknown;
  statData: Record<string, unknown> | null;
  readAt: string | null;
  reason: string;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

/**
 * Shared script tool for all features that need the newest message-floor MVU data.
 * Consumers should call readLatestStatData() instead of accessing window.Mvu.
 */
export class MvuChannelTool {
  private initializationWaitStarted = false;
  private snapshot: MvuChannelSnapshot = {
    name: MVU_CHANNEL_NAME,
    ready: false,
    contextRevision: 0,
    messageId: null,
    variables: null,
    statData: null,
    readAt: null,
    reason: 'not-read',
  };

  constructor(
    private readonly getRuntime: () => MvuReadRuntime,
    private readonly getContext: () => MvuChannelContext,
    private readonly waitForReady?: () => Promise<unknown>,
  ) {}

  private async ensureRuntimeReady(): Promise<MvuReadRuntime> {
    let runtime = this.getRuntime();
    if (typeof runtime.getMvuData === 'function') return runtime;

    // On a full page refresh Tavern Helper scripts can start before MVU has
    // exported its global. Start the documented readiness wait once, while
    // polling as a compatibility path for runtimes without that helper.
    if (!this.initializationWaitStarted) {
      this.initializationWaitStarted = true;
      void this.waitForReady?.().catch(() => undefined);
    }
    for (let attempt = 0; attempt < 100; attempt += 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
      runtime = this.getRuntime();
      if (typeof runtime.getMvuData === 'function') return runtime;
    }
    return runtime;
  }

  getSnapshot(): Readonly<MvuChannelSnapshot> {
    return this.snapshot;
  }

  async waitUntilReady(): Promise<MvuReadRuntime> {
    return this.ensureRuntimeReady();
  }

  async readLatestVariables(): Promise<Readonly<MvuChannelSnapshot>> {
    const context = this.getContext();
    const messageId = context.messageId ?? 'latest';
    const runtime = await this.ensureRuntimeReady();
    const result = await readWorldDataSnapshot(runtime, context.contextRevision, messageId);
    const current = this.getContext();
    if (current.contextRevision !== context.contextRevision || (current.messageId ?? 'latest') !== messageId) {
      this.snapshot = { ...this.snapshot, ready: false, variables: null, statData: null, readAt: null, reason: 'stale-context' };
      return this.snapshot;
    }
    const variables = result.available ? result.data : null;
    const statData = asRecord(asRecord(variables)?.stat_data);
    this.snapshot = {
      name: MVU_CHANNEL_NAME,
      ready: result.available && variables !== null,
      contextRevision: context.contextRevision,
      messageId: result.available ? messageId : null,
      variables,
      statData,
      readAt: result.available ? new Date().toISOString() : null,
      reason: result.reason,
    };
    return this.snapshot;
  }

  async readLatestStatData(): Promise<Record<string, unknown> | null> {
    return (await this.readLatestVariables()).statData;
  }

  async replaceLatestStatData(
    statData: Record<string, unknown>,
    expected: Pick<MvuChannelContext, 'contextRevision' | 'messageId'> = this.snapshot,
  ): Promise<WorldDataWriteResult> {
    const current = this.getContext();
    if (
      expected.messageId === null
      || current.contextRevision !== expected.contextRevision
      || current.messageId !== expected.messageId
    ) {
      return {
        available: false,
        written: false,
        contextRevision: current.contextRevision,
        messageId: current.messageId,
        data: null,
        reason: 'mvu-write-failed',
      };
    }
    const result = await replaceWorldStatData(
      this.getRuntime(),
      current.contextRevision,
      expected.messageId,
      statData,
    );
    if (result.written) await this.readLatestVariables();
    return result;
  }
}
