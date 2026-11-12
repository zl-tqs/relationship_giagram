import { describe, expect, it, vi } from 'vitest';
import {
  createWriterLock,
  electFallbackWriter,
  type BroadcastChannelLike,
  type LockManagerLike,
} from './tabLock';

function fakeChannel() {
  const channel = {
    messages: [] as unknown[],
    onmessage: null as ((event: MessageEvent) => void) | null,
    postMessage: vi.fn((data: unknown) => channel.messages.push(data)),
    close: vi.fn(),
    emit(data: unknown) {
      channel.onmessage?.({ data } as MessageEvent);
    },
  };
  return channel as typeof channel & BroadcastChannelLike;
}

describe('多标签页写者选举', () => {
  it('加入更早的标签页优先', () => {
    expect(
      electFallbackWriter(
        { tabId: 'b', joinedAt: 200 },
        { tabId: 'a', joinedAt: 100 },
      ),
    ).toBe('follower');
    expect(
      electFallbackWriter(
        { tabId: 'a', joinedAt: 100 },
        { tabId: 'b', joinedAt: 200 },
      ),
    ).toBe('writer');
  });

  it('同时加入时按固定 tabId 顺序决定', () => {
    expect(
      electFallbackWriter(
        { tabId: 'b', joinedAt: 100 },
        { tabId: 'a', joinedAt: 100 },
      ),
    ).toBe('follower');
    expect(
      electFallbackWriter(
        { tabId: 'a', joinedAt: 100 },
        { tabId: 'b', joinedAt: 100 },
      ),
    ).toBe('writer');
  });
});

describe('createWriterLock', () => {
  it('Web Locks 可用时获取写者身份', async () => {
    let release: (() => void) | null = null;
    const locks: LockManagerLike = {
      request: vi.fn((_name, _options, callback) => {
        void callback().then(() => undefined);
        return Promise.resolve();
      }),
    };
    const onChange = vi.fn();
    const channel = fakeChannel();

    const lock = createWriterLock('p1', onChange, {
      locks,
      channelFactory: () => channel,
      tabId: 'tab-1',
    });

    await vi.waitFor(() => expect(onChange).toHaveBeenLastCalledWith(true));
    expect(lock.isWriter()).toBe(true);
    expect(locks.request).toHaveBeenCalledWith(
      'canvas:p1',
      { mode: 'exclusive' },
      expect.any(Function),
    );

    release = null;
    lock.dispose();
    expect(channel.close).toHaveBeenCalled();
    void release;
  });

  it('收到接管请求后让出写者身份', async () => {
    const locks: LockManagerLike = {
      request: vi.fn((_name, _options, callback) => {
        void callback().then(() => undefined);
        return Promise.resolve();
      }),
    };
    const onChange = vi.fn();
    const channel = fakeChannel();
    const lock = createWriterLock('p1', onChange, {
      locks,
      channelFactory: () => channel,
      tabId: 'tab-1',
    });
    await vi.waitFor(() => expect(lock.isWriter()).toBe(true));

    channel.emit({ type: 'takeover', from: 'tab-2' });

    expect(lock.isWriter()).toBe(false);
    expect(onChange).toHaveBeenLastCalledWith(false);
    lock.dispose();
  });
});
