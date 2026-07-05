/**
 * Screen Wake Lock lifecycle manager.
 *
 * The contract with the platform (and the reason this file exists at all):
 * the browser auto-releases the wake lock whenever the tab loses visibility —
 * screen lock, app switch, tab switch. That release is not an error; it is
 * routine, and the manager's job is to (a) surface it honestly to the UI
 * ("guide paused — screen may sleep") and (b) re-acquire the lock the moment
 * the page becomes visible again, without the visitor doing anything.
 *
 * Ship target is a plain browser tab, NOT an installed home-screen PWA:
 * WebKit only fixed Wake Lock inside installed PWAs in iOS 18.4, and a real
 * visitor population includes plenty of older iOS. See ARCHITECTURE.md.
 */

export type WakeLockState = 'active' | 'released' | 'denied' | 'unsupported';

export interface WakeLockSentinelLike {
  release(): Promise<void>;
  addEventListener(type: 'release', cb: () => void): void;
}

export interface WakeLockEnv {
  navigator: {
    wakeLock?: { request(type: 'screen'): Promise<WakeLockSentinelLike> };
  };
  document: {
    visibilityState: 'visible' | 'hidden';
    addEventListener(type: 'visibilitychange', cb: () => void): void;
    removeEventListener(type: 'visibilitychange', cb: () => void): void;
  };
}

const MSG: Record<WakeLockState, string> = {
  active: 'Screen will stay on while the guide is running.',
  released:
    'The screen wake lock was released (screen locked or app switched). The guide resumes when you return to this page.',
  denied:
    'The browser refused to keep the screen awake. The guide only works while the screen is on — please keep your phone unlocked while walking.',
  unsupported:
    'This browser cannot keep the screen awake automatically. The guide only works while the screen is on — please keep your phone unlocked and this page visible while you walk.',
};

export class WakeLockManager {
  private sentinel: WakeLockSentinelLike | null = null;
  private started = false;
  private readonly visHandler = () => {
    if (this.started && this.env.document.visibilityState === 'visible' && !this.sentinel) {
      void this.acquire();
    }
  };

  constructor(
    private readonly env: WakeLockEnv,
    private readonly onState: (state: WakeLockState, message: string) => void,
  ) {}

  /** Request the lock and start watching visibility. Safe to call on unsupported browsers. */
  async start(): Promise<void> {
    this.started = true;
    this.env.document.addEventListener('visibilitychange', this.visHandler);
    await this.acquire();
  }

  async stop(): Promise<void> {
    this.started = false;
    this.env.document.removeEventListener('visibilitychange', this.visHandler);
    const s = this.sentinel;
    this.sentinel = null;
    if (s) await s.release().catch(() => undefined);
  }

  private async acquire(): Promise<void> {
    const wl = this.env.navigator.wakeLock;
    if (!wl || typeof wl.request !== 'function') {
      this.onState('unsupported', MSG.unsupported);
      return;
    }
    try {
      const sentinel = await wl.request('screen');
      this.sentinel = sentinel;
      sentinel.addEventListener('release', () => {
        // Routine platform behavior on visibility loss — not an error.
        if (this.sentinel === sentinel) {
          this.sentinel = null;
          if (this.started) this.onState('released', MSG.released);
        }
      });
      this.onState('active', MSG.active);
    } catch {
      this.onState('denied', MSG.denied);
    }
  }
}
