import type { Edge, Node } from '@xyflow/react';
import { canvasFingerprint } from '../canvas/fingerprint';

export type CanvasSnapshotState = {
  nodes: Node[];
  edges: Edge[];
  viewport: { x: number; y: number; zoom: number };
};

export type SavePayload = CanvasSnapshotState & { baseRevision: number };

export type SaveOutcome =
  | { status: 'saved'; version: number }
  | { status: 'unchanged' }
  | { status: 'queued' }
  | { status: 'skipped'; reason: 'blocked' | 'hidden' | 'offline' | 'not-writer' | 'conflict' }
  | { status: 'failed'; error: unknown; willRetry: boolean }
  | { status: 'conflict'; error?: unknown; serverVersion?: number };

export interface SaveCoordinatorDeps {
  getState: () => CanvasSnapshotState;
  save: (payload: SavePayload) => Promise<{ version: number }>;
  fetchServer: () => Promise<CanvasSnapshotState & { version: number }>;
  isBlocked?: () => boolean;
  isVisible?: () => boolean;
  isOnline?: () => boolean;
  isWriter?: () => boolean;
  now?: () => Date;
  onSaved?: (info: { version: number; fingerprint: string; at: Date; manual: boolean }) => void;
  onAutoSaved?: (at: Date) => void;
  onError?: (kind: 'retrying' | 'persistent', error: unknown) => void;
  onClearError?: () => void;
  onConflict?: (serverVersion?: number) => void;
  onConflictResolved?: (version: number) => void;
}

function errorCode(error: unknown) {
  const candidate = error as {
    code?: string;
    response?: { data?: { code?: string } };
  };
  return candidate.response?.data?.code ?? candidate.code;
}

export class SaveCoordinator {
  private revision: number;
  private lastSavedFingerprint: string;
  private inFlight: Promise<SaveOutcome> | null = null;
  private conflict = false;
  private conflictVersion: number | undefined;
  private failureCount = 0;

  constructor(
    private readonly deps: SaveCoordinatorDeps,
    initial: { revision: number; fingerprint: string },
  ) {
    this.revision = initial.revision;
    this.lastSavedFingerprint = initial.fingerprint;
  }

  getRevision() {
    return this.revision;
  }

  hasConflict() {
    return this.conflict;
  }

  isDirty() {
    const state = this.deps.getState();
    return canvasFingerprint(state.nodes, state.edges) !== this.lastSavedFingerprint;
  }

  async waitForIdle() {
    if (this.inFlight) await this.inFlight;
  }

  autoSave(): Promise<SaveOutcome> {
    if (this.conflict) return Promise.resolve({ status: 'skipped', reason: 'conflict' });
    if (this.deps.isBlocked?.()) {
      return Promise.resolve({ status: 'skipped', reason: 'blocked' });
    }
    if (this.deps.isVisible && !this.deps.isVisible()) {
      return Promise.resolve({ status: 'skipped', reason: 'hidden' });
    }
    if (this.deps.isOnline && !this.deps.isOnline()) {
      return Promise.resolve({ status: 'skipped', reason: 'offline' });
    }
    if (this.deps.isWriter && !this.deps.isWriter()) {
      return Promise.resolve({ status: 'skipped', reason: 'not-writer' });
    }
    if (!this.isDirty()) return Promise.resolve({ status: 'unchanged' });
    return this.save('auto');
  }

  save(kind: 'manual' | 'auto', options: { force?: boolean } = {}): Promise<SaveOutcome> {
    if (this.inFlight) {
      if (kind === 'auto') return Promise.resolve({ status: 'queued' });
      return this.inFlight.then(() => this.save(kind, options));
    }
    if (this.conflict) {
      return Promise.resolve({ status: 'conflict', serverVersion: this.conflictVersion });
    }

    const state = this.deps.getState();
    const fingerprint = canvasFingerprint(state.nodes, state.edges);
    if (!options.force && fingerprint === this.lastSavedFingerprint) {
      return Promise.resolve({ status: 'unchanged' });
    }

    const promise = this.performSave(kind, state, fingerprint);
    this.inFlight = promise.finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }

  markConflict(serverVersion?: number) {
    this.conflict = true;
    this.conflictVersion = serverVersion;
    this.deps.onConflict?.(serverVersion);
  }

  markSavedExternally(version: number, fingerprint?: string) {
    this.revision = version;
    this.lastSavedFingerprint = fingerprint ?? this.currentFingerprint();
    this.conflict = false;
    this.conflictVersion = undefined;
    this.failureCount = 0;
    this.deps.onClearError?.();
  }

  reset(revision: number, fingerprint?: string) {
    this.markSavedExternally(revision, fingerprint);
  }

  overwrite(serverVersion: number) {
    this.conflict = false;
    this.conflictVersion = undefined;
    this.revision = serverVersion;
    return this.save('manual', { force: true });
  }

  private currentFingerprint() {
    const state = this.deps.getState();
    return canvasFingerprint(state.nodes, state.edges);
  }

  private completeSuccess(version: number, fingerprint: string, kind: 'manual' | 'auto') {
    this.revision = version;
    this.lastSavedFingerprint = fingerprint;
    this.conflict = false;
    this.conflictVersion = undefined;
    this.failureCount = 0;
    this.deps.onClearError?.();
    const at = this.deps.now?.() ?? new Date();
    this.deps.onSaved?.({ version, fingerprint, at, manual: kind === 'manual' });
    if (kind === 'auto') this.deps.onAutoSaved?.(at);
  }

  private async resolveConflict(
    error: unknown,
    fingerprint: string,
    kind: 'manual' | 'auto',
  ): Promise<SaveOutcome> {
    try {
      const server = await this.deps.fetchServer();
      if (canvasFingerprint(server.nodes, server.edges) === fingerprint) {
        this.completeSuccess(server.version, fingerprint, kind);
        this.deps.onConflictResolved?.(server.version);
        return { status: 'saved', version: server.version };
      }
      this.conflict = true;
      this.conflictVersion = server.version;
      this.deps.onConflict?.(server.version);
      return { status: 'conflict', error, serverVersion: server.version };
    } catch {
      this.conflict = true;
      this.deps.onConflict?.(undefined);
      return { status: 'conflict', error };
    }
  }

  private async performSave(
    kind: 'manual' | 'auto',
    state: CanvasSnapshotState,
    fingerprint: string,
  ): Promise<SaveOutcome> {
    try {
      const result = await this.deps.save({
        nodes: state.nodes,
        edges: state.edges,
        viewport: state.viewport,
        baseRevision: this.revision,
      });
      this.completeSuccess(result.version, fingerprint, kind);
      return { status: 'saved', version: result.version };
    } catch (error) {
      if (errorCode(error) === 'VERSION_CONFLICT') {
        return this.resolveConflict(error, fingerprint, kind);
      }
      this.failureCount += 1;
      const willRetry = this.failureCount === 1;
      this.deps.onError?.(willRetry ? 'retrying' : 'persistent', error);
      return { status: 'failed', error, willRetry };
    }
  }
}
