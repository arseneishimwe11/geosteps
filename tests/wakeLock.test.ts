import { describe, expect, it, vi } from 'vitest';
import { WakeLockManager, type WakeLockEnv, type WakeLockSentinelLike, type WakeLockState } from '../src/engine/platform/wakeLock';

class FakeSentinel implements WakeLockSentinelLike {
  private listeners: (() => void)[] = [];
  addEventListener(_type: 'release', cb: () => void): void {
    this.listeners.push(cb);
  }
  async release(): Promise<void> {
    this.fireRelease();
  }
  /** Simulates the BROWSER auto-releasing the lock (tab hidden / screen locked). */
  fireRelease(): void {
    this.listeners.forEach((cb) => cb());
  }
}

class FakeDocument {
  visibilityState: 'visible' | 'hidden' = 'visible';
  private listeners: (() => void)[] = [];
  addEventListener(_type: 'visibilitychange', cb: () => void): void {
    this.listeners.push(cb);
  }
  removeEventListener(_type: 'visibilitychange', cb: () => void): void {
    this.listeners = this.listeners.filter((l) => l !== cb);
  }
  dispatchVisibilityChange(): void {
    this.listeners.forEach((cb) => cb());
  }
}

const settle = () => new Promise((r) => setTimeout(r, 0));

describe('WakeLockManager lifecycle', () => {
  it('acquires on start, reports release on tab hide, re-acquires on return', async () => {
    const doc = new FakeDocument();
    const sentinels: FakeSentinel[] = [];
    const request = vi.fn(async (_type: 'screen') => {
      const s = new FakeSentinel();
      sentinels.push(s);
      return s;
    });
    const env: WakeLockEnv = { navigator: { wakeLock: { request } }, document: doc };
    const states: [WakeLockState, string][] = [];
    const mgr = new WakeLockManager(env, (s, m) => states.push([s, m]));

    await mgr.start();
    expect(request).toHaveBeenCalledTimes(1);
    expect(states.at(-1)![0]).toBe('active');

    // Visitor locks the screen / switches apps: the BROWSER releases the lock.
    doc.visibilityState = 'hidden';
    sentinels[0]!.fireRelease();
    doc.dispatchVisibilityChange();
    await settle();
    expect(states.at(-1)![0]).toBe('released');
    expect(states.at(-1)![1]).toMatch(/resumes|return/i); // honest, user-facing
    expect(request).toHaveBeenCalledTimes(1); // no futile re-request while hidden

    // Visitor comes back: visibilitychange fires, manager re-acquires by itself.
    doc.visibilityState = 'visible';
    doc.dispatchVisibilityChange();
    await settle();
    expect(request).toHaveBeenCalledTimes(2);
    expect(states.at(-1)![0]).toBe('active');

    expect(states.map(([s]) => s)).toEqual(['active', 'released', 'active']);
    for (const [, message] of states) expect(message.length).toBeGreaterThan(10);
  });

  it('request rejection surfaces as denied with an honest message', async () => {
    const doc = new FakeDocument();
    const env: WakeLockEnv = {
      navigator: { wakeLock: { request: async () => Promise.reject(new Error('NotAllowedError')) } },
      document: doc,
    };
    const states: [WakeLockState, string][] = [];
    await new WakeLockManager(env, (s, m) => states.push([s, m])).start();
    expect(states.at(-1)![0]).toBe('denied');
    expect(states.at(-1)![1]).toMatch(/screen/i);
  });

  it('absent Wake Lock API surfaces as unsupported with instructions, never silently', async () => {
    const doc = new FakeDocument();
    const env: WakeLockEnv = { navigator: {}, document: doc };
    const states: [WakeLockState, string][] = [];
    await new WakeLockManager(env, (s, m) => states.push([s, m])).start();
    expect(states).toHaveLength(1);
    expect(states[0]![0]).toBe('unsupported');
    expect(states[0]![1]).toMatch(/keep your phone unlocked/i);
  });

  it('stop() releases and stops re-acquiring', async () => {
    const doc = new FakeDocument();
    const sentinels: FakeSentinel[] = [];
    const request = vi.fn(async (_type: 'screen') => {
      const s = new FakeSentinel();
      sentinels.push(s);
      return s;
    });
    const env: WakeLockEnv = { navigator: { wakeLock: { request } }, document: doc };
    const states: WakeLockState[] = [];
    const mgr = new WakeLockManager(env, (s) => states.push(s));

    await mgr.start();
    await mgr.stop();
    doc.dispatchVisibilityChange(); // must be a no-op now
    await settle();
    expect(request).toHaveBeenCalledTimes(1);
    expect(states).toEqual(['active']); // intentional stop is not reported as a scary "released"
  });
});
