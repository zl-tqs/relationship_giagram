export interface LockManagerLike {
  request(
    name: string,
    options: { mode: 'exclusive' },
    callback: () => Promise<void>,
  ): Promise<unknown>;
}

export interface BroadcastChannelLike {
  onmessage: ((event: MessageEvent) => void) | null;
  postMessage(data: unknown): void;
  close(): void;
}

export type WriterLock = {
  isWriter: () => boolean;
  takeOver: () => void;
  dispose: () => void;
};

type Peer = { tabId: string; joinedAt: number };

export function electFallbackWriter(self: Peer, peer: Peer): 'writer' | 'follower' {
  if (peer.joinedAt < self.joinedAt) return 'follower';
  if (peer.joinedAt > self.joinedAt) return 'writer';
  return peer.tabId < self.tabId ? 'follower' : 'writer';
}

function defaultChannelFactory(name: string): BroadcastChannelLike | null {
  if (typeof BroadcastChannel === 'undefined') return null;
  return new BroadcastChannel(name);
}

function defaultLocks(): LockManagerLike | null {
  if (typeof navigator === 'undefined') return null;
  return (navigator as Navigator & { locks?: LockManagerLike }).locks ?? null;
}

function fallbackLock(
  channel: BroadcastChannelLike,
  onChange: (isWriter: boolean) => void,
  self: Peer,
): WriterLock {
  let writer = false;
  let disposed = false;
  let yielded = false;
  let lastPeerAt = Date.now();
  let electionTimer: ReturnType<typeof setTimeout> | null = null;
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  const notify = (value: boolean) => {
    if (writer === value) return;
    writer = value;
    onChange(value);
  };

  onChange(false);

  const stopHeartbeat = () => {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  };

  const startHeartbeat = () => {
    stopHeartbeat();
    heartbeatTimer = setInterval(() => {
      if (disposed || !writer) return;
      channel.postMessage({ type: 'heartbeat', ...self });
    }, 2000);
  };

  const becomeWriter = () => {
    if (disposed) return;
    yielded = false;
    notify(true);
    channel.postMessage({ type: 'heartbeat', ...self });
    startHeartbeat();
  };

  channel.onmessage = (event) => {
    if (disposed) return;
    const data = event.data as {
      type?: string;
      tabId?: string;
      joinedAt?: number;
      to?: string;
    };
    if (data?.type === 'yielded' && data.to === self.tabId) {
      becomeWriter();
      return;
    }
    if (data?.type === 'takeover' && writer) {
      yielded = true;
      notify(false);
      stopHeartbeat();
      if (data.tabId) channel.postMessage({ type: 'yielded', to: data.tabId });
      return;
    }
    if ((data?.type === 'hello' || data?.type === 'heartbeat') && data.tabId && data.joinedAt !== undefined) {
      lastPeerAt = Date.now();
      if (
        yielded
        || electFallbackWriter(self, { tabId: data.tabId, joinedAt: data.joinedAt }) === 'follower'
      ) {
        notify(false);
        stopHeartbeat();
      } else {
        becomeWriter();
      }
    }
  };

  channel.postMessage({ type: 'hello', ...self });
  electionTimer = setTimeout(() => {
    if (!disposed && !writer && !yielded && Date.now() - lastPeerAt >= 250) becomeWriter();
  }, 300);

  const watchdog = setInterval(() => {
    if (disposed) return;
    if (!writer && Date.now() - lastPeerAt > 6000) becomeWriter();
  }, 2000);

  return {
    isWriter: () => writer,
    takeOver: () => channel.postMessage({ type: 'takeover', tabId: self.tabId }),
    dispose: () => {
      disposed = true;
      if (electionTimer) clearTimeout(electionTimer);
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      clearInterval(watchdog);
      channel.postMessage({ type: 'yielded' });
      channel.close();
    },
  };
}

export function createWriterLock(
  projectId: string,
  onChange: (isWriter: boolean) => void,
  options: {
    locks?: LockManagerLike | null;
    channelFactory?: (name: string) => BroadcastChannelLike | null;
    tabId?: string;
    joinedAt?: number;
  } = {},
): WriterLock {
  const locks = options.locks === undefined ? defaultLocks() : options.locks;
  const channelFactory = options.channelFactory ?? defaultChannelFactory;
  const channel = channelFactory(`canvas-lock:${projectId}`);
  const tabId = options.tabId ?? Math.random().toString(36).slice(2);
  const joinedAt = options.joinedAt ?? Date.now();

  if (!locks) {
    if (!channel) {
      onChange(true);
      return { isWriter: () => true, takeOver: () => undefined, dispose: () => undefined };
    }
    return fallbackLock(channel, onChange, { tabId, joinedAt });
  }

  let disposed = false;
  let writer = false;
  let releaseResolve: (() => void) | null = null;
  let reacquireTimer: ReturnType<typeof setTimeout> | null = null;

  const notify = (value: boolean) => {
    if (writer === value) return;
    writer = value;
    onChange(value);
  };

  const acquire = () => {
    if (disposed) return;
    void locks
      .request(`canvas:${projectId}`, { mode: 'exclusive' }, async () => {
        if (disposed) return;
        notify(true);
        await new Promise<void>((resolve) => {
          releaseResolve = resolve;
        });
        releaseResolve = null;
        notify(false);
      })
      .catch(() => undefined);
  };

  if (channel) {
    channel.onmessage = (event) => {
      const data = event.data as { type?: string; tabId?: string };
      if (data?.type === 'takeover' && writer) {
        notify(false);
        releaseResolve?.();
        reacquireTimer = setTimeout(acquire, 600);
      }
    };
  }

  onChange(false);
  acquire();

  return {
    isWriter: () => writer,
    takeOver: () => channel?.postMessage({ type: 'takeover', tabId }),
    dispose: () => {
      disposed = true;
      if (reacquireTimer) clearTimeout(reacquireTimer);
      releaseResolve?.();
      channel?.close();
    },
  };
}
