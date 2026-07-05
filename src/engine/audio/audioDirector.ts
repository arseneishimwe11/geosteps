import type { LanguageCode, Zone, ZoneEvent } from '../types';

/** One playing narration track. Implementations wrap WebAudio/HTMLAudio; tests use fakes. */
export interface AudioTrackHandle {
  fadeIn(ms: number): void;
  /** Fade to silence over ms, then stop and release the underlying resource. */
  fadeOut(ms: number): void;
  stop(): void;
  onEnded(cb: () => void): void;
}

export interface AudioBackend {
  createTrack(url: string): AudioTrackHandle;
}

export interface AudioDirectorConfig {
  language: LanguageCode;
  fallbackLanguage: LanguageCode;
  /** Crossfade duration when narration hands over between zones. */
  crossfadeMs: number;
  /** A zone's narration will not restart within this window of its last start. */
  minReplayIntervalMs: number;
  /** Fade the narration out when the visitor leaves the zone (default: let it finish). */
  stopOnExit: boolean;
}

export const DEFAULT_AUDIO_DIRECTOR_CONFIG: Omit<AudioDirectorConfig, 'language' | 'fallbackLanguage'> = {
  crossfadeMs: 1200,
  minReplayIntervalMs: 45_000,
  stopOnExit: false,
};

export interface AudioDirectorState {
  status: 'idle' | 'playing';
  zoneId: string | null;
}

/**
 * Zone-event -> narration state machine.
 *
 * Policy:
 *  - 'enter' starts the zone's narration in the selected language (falling
 *    back to the venue default language when a translation is missing).
 *  - entering a new zone while another narration plays crossfades between the
 *    two tracks over crossfadeMs — never a hard cut.
 *  - re-entering a zone re-triggers its narration, but not within
 *    minReplayIntervalMs of its last start. Combined with the geofence
 *    debounce this is the second line of defense against boundary flicker.
 *  - 'exit' by default lets the current narration finish (visitors often
 *    step away while still listening); stopOnExit=true fades it out instead.
 */
export class AudioDirector {
  private readonly cfg: AudioDirectorConfig;
  private readonly zonesById: Map<string, Zone>;
  private active: { zoneId: string; handle: AudioTrackHandle } | null = null;
  private lastStartedAt = new Map<string, number>();

  constructor(
    private readonly backend: AudioBackend,
    zones: readonly Zone[],
    cfg: Partial<AudioDirectorConfig> & Pick<AudioDirectorConfig, 'language' | 'fallbackLanguage'>,
    private readonly onWarning?: (message: string) => void,
  ) {
    this.cfg = { ...DEFAULT_AUDIO_DIRECTOR_CONFIG, ...cfg };
    this.zonesById = new Map(zones.map((z) => [z.id, z]));
  }

  get state(): AudioDirectorState {
    return this.active
      ? { status: 'playing', zoneId: this.active.zoneId }
      : { status: 'idle', zoneId: null };
  }

  setLanguage(lang: LanguageCode): void {
    this.cfg.language = lang;
  }

  handleZoneEvent(ev: ZoneEvent): void {
    if (ev.type === 'enter') {
      this.play(ev.zoneId, ev.timestampMs);
    } else if (ev.type === 'exit' && this.cfg.stopOnExit && this.active?.zoneId === ev.zoneId) {
      this.active.handle.fadeOut(this.cfg.crossfadeMs);
      this.active = null;
    }
  }

  private play(zoneId: string, tMs: number): void {
    if (this.active?.zoneId === zoneId) return; // already narrating this zone

    const last = this.lastStartedAt.get(zoneId);
    if (last !== undefined && tMs - last < this.cfg.minReplayIntervalMs) return;

    const zone = this.zonesById.get(zoneId);
    if (!zone) return;
    const asset = zone.audio[this.cfg.language] ?? zone.audio[this.cfg.fallbackLanguage];
    if (!asset) {
      this.onWarning?.(
        `Zone "${zoneId}" has no narration for "${this.cfg.language}" nor fallback "${this.cfg.fallbackLanguage}".`,
      );
      return;
    }

    const handle = this.backend.createTrack(asset.url);
    const previous = this.active;
    if (previous) previous.handle.fadeOut(this.cfg.crossfadeMs);
    handle.fadeIn(this.cfg.crossfadeMs);
    handle.onEnded(() => {
      if (this.active?.handle === handle) this.active = null;
    });
    this.active = { zoneId, handle };
    this.lastStartedAt.set(zoneId, tMs);
  }
}
