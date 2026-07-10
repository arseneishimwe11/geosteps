/**
 * GuideSession — the ONE place where platform APIs meet the frozen engine.
 *
 * Everything the tourist UI renders comes out of this module's snapshot;
 * every sensor/permission/wake-lock/audio interaction goes in through it.
 * React components subscribe via useSyncExternalStore and stay purely
 * presentational. Nothing here computes position or zone logic — inputs are
 * forwarded to PositionEngine, outputs are relayed verbatim.
 */
import { AudioDirector } from '../../engine/audio/audioDirector';
import { computeFingerprint } from '../../engine/acoustic/fingerprint';
import { captureAmbientClip } from '../../engine/platform/micCapture';
import {
  detectCapabilities,
  requestMotionPermissions,
  startHeadingStream,
  startMotionStream,
  type Capability,
  type CapabilityReport,
} from '../../engine/platform/sensors';
import { WakeLockManager, type WakeLockState } from '../../engine/platform/wakeLock';
import { HtmlAudioBackend } from '../../engine/platform/webAudioBackend';
import { PositionEngine } from '../../engine/positionEngine';
import type {
  AcousticSampleAudit,
  FloorBlueprint,
  LanguageCode,
  PositionState,
  Zone,
  ZoneEvent,
} from '../../engine/types';
import { audioUrl } from '../api';
import { renderPlaceholderToneWav } from '../audio/placeholderTone';

export type GuidePhase = 'idle' | 'starting' | 'active' | 'error';

export interface GuideSnapshot {
  phase: GuidePhase;
  language: LanguageCode;
  /** Pre-gesture feature detection (rendered on the start screen). */
  capabilities: CapabilityReport | null;
  /** Post-gesture permission outcomes (rendered verbatim when not ok). */
  permissions: { deviceMotion: Capability; deviceOrientation: Capability } | null;
  wakeLock: { state: WakeLockState; message: string } | null;
  position: PositionState | null;
  lastZoneEvent: ZoneEvent | null;
  nowPlaying: { zoneId: string; zoneName: string; title: string | null } | null;
  /** Whether the periodic ambient-audio sampler is running, and why not if not. */
  micActive: boolean;
  micMessage: string | null;
  /** True when the heading source is a real compass; false = relative gyro (drifts). */
  headingAbsolute: boolean | null;
  audits: AcousticSampleAudit[];
  startError: string | null;
}

const AUDIT_RING = 200;
const MIC_SAMPLE_EVERY_MS = 15_000;
const MIC_CLIP_SECONDS = 2;

export const auditStorageKey = (venueId: string) => `geosteps.audits.${venueId}`;

export class GuideSession {
  readonly engine: PositionEngine; // exposed for the dev simulator ONLY — inputs, never outputs
  readonly blueprint: FloorBlueprint;
  readonly venueId: string;

  private director: AudioDirector;
  private snap: GuideSnapshot;
  private listeners = new Set<() => void>();
  private cleanups: (() => void)[] = [];
  private wakeLockManager: WakeLockManager | null = null;
  private micTimer: ReturnType<typeof setInterval> | null = null;
  private micBusy = false;

  constructor(venueId: string, blueprint: FloorBlueprint, language: LanguageCode) {
    this.venueId = venueId;
    this.blueprint = blueprint;
    this.engine = new PositionEngine(blueprint);

    // The director needs absolute URLs; the blueprint stores venue-relative ones.
    const zonesWithAbsoluteAudio: Zone[] = blueprint.zones.map((z) => ({
      ...z,
      audio: Object.fromEntries(
        Object.entries(z.audio).map(([lang, ref]) => [
          lang,
          ref ? { ...ref, url: audioUrl(venueId, ref.url) } : ref,
        ]),
      ),
    }));
    this.director = new AudioDirector(new HtmlAudioBackend(), zonesWithAbsoluteAudio, {
      language,
      fallbackLanguage: blueprint.venue.defaultLanguage,
    });

    this.snap = {
      phase: 'idle',
      language,
      capabilities: null,
      permissions: null,
      wakeLock: null,
      position: null,
      lastZoneEvent: null,
      nowPlaying: null,
      micActive: false,
      micMessage: null,
      headingAbsolute: null,
      audits: [],
      startError: null,
    };
  }

  // -- store contract (useSyncExternalStore) --------------------------------

  subscribe = (cb: () => void): (() => void) => {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  };

  getSnapshot = (): GuideSnapshot => this.snap;

  private update(patch: Partial<GuideSnapshot>): void {
    this.snap = { ...this.snap, ...patch };
    this.listeners.forEach((cb) => cb());
  }

  // -- pre-gesture ------------------------------------------------------------

  /** Feature-detect before the gesture so the start screen can be honest up front. */
  detect(): void {
    this.update({ capabilities: detectCapabilities(window as never) });
  }

  setLanguage(lang: LanguageCode): void {
    this.director.setLanguage(lang);
    this.update({ language: lang });
  }

  // -- the single start gesture ----------------------------------------------

  /**
   * MUST be called from the "Start the guide" tap handler: iOS only shows the
   * motion-permission prompt inside a user gesture, and audio playback is
   * only unlocked by one.
   */
  async start(): Promise<void> {
    if (this.snap.phase === 'active' || this.snap.phase === 'starting') return;
    this.update({ phase: 'starting', startError: null });

    try {
      // 1. Unlock audio while we are still inside the gesture: play a
      //    near-silent, near-instant tone through the same HTMLAudio path the
      //    director uses.
      const unlock = new Audio(
        URL.createObjectURL(
          new Blob(
            [renderPlaceholderToneWav({ zoneName: 'unlock', language: 'x', seed: 0, seconds: 0.05 })
              .buffer as ArrayBuffer],
            { type: 'audio/wav' },
          ),
        ),
      );
      unlock.volume = 0;
      unlock.play().catch(() => undefined); // unlock is best-effort; failure surfaces on first real track

      // 2. Motion/orientation permission (the iOS gesture-gated prompt).
      const permissions = await requestMotionPermissions(window as never);
      this.update({ permissions, capabilities: detectCapabilities(window as never) });

      // 3. Wake lock, with live state relayed to the UI.
      this.wakeLockManager = new WakeLockManager(
        { navigator: navigator as never, document: document as never },
        (state, message) => this.update({ wakeLock: { state, message } }),
      );
      await this.wakeLockManager.start();

      // 4. Engine outputs → snapshot (the UI's only source of truth).
      this.cleanups.push(
        this.engine.onPosition((position) => this.update({ position, nowPlaying: this.nowPlaying() })),
      );
      this.cleanups.push(
        this.engine.onZoneEvent((ev) => {
          this.director.handleZoneEvent(ev);
          this.update({ lastZoneEvent: ev, nowPlaying: this.nowPlaying() });
        }),
      );
      this.cleanups.push(
        this.engine.onAcousticAudit((audit) => {
          const audits = [...this.snap.audits, audit].slice(-AUDIT_RING);
          try {
            localStorage.setItem(auditStorageKey(this.venueId), JSON.stringify(audits));
          } catch {
            // storage full/blocked — the in-memory ring still works
          }
          this.update({ audits });
        }),
      );

      // 5. Sensor streams → engine inputs. Motion runs at full device rate
      //    (the step detector needs it); heading is throttled to ~10 Hz.
      if (permissions.deviceMotion.status === 'ok') {
        this.cleanups.push(startMotionStream(window, (s) => this.engine.handleMotionSample(s)));
      }
      if (permissions.deviceOrientation.status === 'ok') {
        let lastHeadingAt = 0;
        this.cleanups.push(
          startHeadingStream(window, (h) => {
            const now = Date.now();
            if (now - lastHeadingAt < 100) return;
            lastHeadingAt = now;
            if (this.snap.headingAbsolute !== h.absolute) this.update({ headingAbsolute: h.absolute });
            this.engine.handleHeading(h.headingDeg, now);
          }),
        );
      }

      // 6. Clock ticks so geofence debounce advances while standing still.
      const tick = setInterval(() => this.engine.tick(Date.now()), 500);
      this.cleanups.push(() => clearInterval(tick));

      // 7. Ambient sampling for the acoustic corrector — strictly optional.
      void this.startMicSampling();

      this.update({ phase: 'active' });
    } catch (e) {
      this.update({
        phase: 'error',
        startError:
          e instanceof Error ? e.message : 'The guide could not start. Please reload and try again.',
      });
    }
  }

  private nowPlaying(): GuideSnapshot['nowPlaying'] {
    const s = this.director.state;
    if (s.status !== 'playing' || !s.zoneId) return null;
    const zone = this.blueprint.zones.find((z) => z.id === s.zoneId);
    if (!zone) return null;
    const ref = zone.audio[this.snap.language] ?? zone.audio[this.blueprint.venue.defaultLanguage];
    return { zoneId: zone.id, zoneName: zone.name, title: ref?.title ?? null };
  }

  private async startMicSampling(): Promise<void> {
    const caps = detectCapabilities(window as never);
    if (caps.microphone.status !== 'ok') {
      this.update({ micActive: false, micMessage: caps.microphone.message });
      return;
    }
    const sampleOnce = async () => {
      if (this.micBusy) return;
      this.micBusy = true;
      try {
        const { pcm, sampleRateHz } = await captureAmbientClip(MIC_CLIP_SECONDS);
        const fp = computeFingerprint(pcm, sampleRateHz);
        this.engine.handleAcousticSample(fp, Date.now());
        if (!this.snap.micActive) this.update({ micActive: true, micMessage: null });
      } catch (e) {
        this.stopMicSampling();
        this.update({
          micActive: false,
          micMessage:
            'Microphone access was declined or failed, so the guide cannot use ambient sound to double-check ' +
            'which room you are in. Step tracking still works; positioning may drift a little more. ' +
            `(${e instanceof Error ? e.message : 'unknown error'})`,
        });
      } finally {
        this.micBusy = false;
      }
    };
    await sampleOnce(); // first capture inside/near the start gesture → permission prompt now, not mid-tour
    if (this.snap.micActive) {
      this.micTimer = setInterval(() => void sampleOnce(), MIC_SAMPLE_EVERY_MS);
    }
  }

  private stopMicSampling(): void {
    if (this.micTimer) clearInterval(this.micTimer);
    this.micTimer = null;
  }

  async stop(): Promise<void> {
    this.stopMicSampling();
    this.cleanups.forEach((fn) => fn());
    this.cleanups = [];
    await this.wakeLockManager?.stop();
    this.update({ phase: 'idle', micActive: false });
  }
}
