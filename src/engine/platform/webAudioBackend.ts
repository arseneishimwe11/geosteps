import type { AudioBackend, AudioTrackHandle } from '../audio/audioDirector';

/**
 * AudioBackend implementation for the browser: one HTMLAudioElement per
 * narration track with timer-driven volume ramps for fades.
 *
 * HTMLAudioElement (rather than fetch + WebAudio buffers) so long narration
 * files stream instead of loading fully into memory — these are multi-minute
 * MP3s on mid-range phones. Volume ramping at ~30 Hz is plenty smooth for a
 * spoken-word crossfade.
 */
export class HtmlAudioBackend implements AudioBackend {
  constructor(private readonly createElement: () => HTMLAudioElement = () => new Audio()) {}

  createTrack(url: string): AudioTrackHandle {
    const el = this.createElement();
    el.src = url;
    el.preload = 'auto';
    let rampTimer: ReturnType<typeof setInterval> | null = null;
    const endedCallbacks: (() => void)[] = [];
    el.addEventListener('ended', () => endedCallbacks.forEach((cb) => cb()));

    const ramp = (target: number, ms: number, then?: () => void) => {
      if (rampTimer) clearInterval(rampTimer);
      const stepMs = 33;
      const steps = Math.max(1, Math.round(ms / stepMs));
      const delta = (target - el.volume) / steps;
      let i = 0;
      rampTimer = setInterval(() => {
        i++;
        el.volume = Math.min(1, Math.max(0, el.volume + delta));
        if (i >= steps) {
          if (rampTimer) clearInterval(rampTimer);
          rampTimer = null;
          el.volume = target;
          then?.();
        }
      }, stepMs);
    };

    return {
      fadeIn(ms: number): void {
        el.volume = 0;
        // Playback start can reject (autoplay policy) — the director starts
        // tracks from zone events which follow a user-gesture'd session start,
        // but surface a console warning rather than dying silently if not.
        el.play().catch((err) => console.warn('[geosteps] audio play() failed:', err));
        ramp(1, ms);
      },
      fadeOut(ms: number): void {
        ramp(0, ms, () => {
          el.pause();
          el.removeAttribute('src');
          el.load();
        });
      },
      stop(): void {
        if (rampTimer) clearInterval(rampTimer);
        el.pause();
        el.removeAttribute('src');
        el.load();
      },
      onEnded(cb: () => void): void {
        endedCallbacks.push(cb);
      },
    };
  }
}
