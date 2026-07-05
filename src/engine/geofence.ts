import { interiorDepth } from './geometry';
import type { GeofenceConfig, Point, Zone, ZoneEvent } from './types';

export const DEFAULT_GEOFENCE_CONFIG: GeofenceConfig = {
  enterDebounceMs: 1500,
  exitDebounceMs: 2500,
  hysteresisM: 0.5,
};

/**
 * Debounced zone containment.
 *
 * Two mechanisms prevent boundary flicker:
 *  - spatial hysteresis: a zone only becomes an entry candidate when the
 *    position is >= hysteresisM *inside* its polygon, and the current zone is
 *    only considered left when the position is >= hysteresisM *outside* it.
 *    A visitor oscillating right on the line is deep in neither state and
 *    changes nothing.
 *  - temporal debounce: the candidate must stay the deepest zone for
 *    enterDebounceMs before 'enter' fires; the position must stay definitively
 *    outside for exitDebounceMs before 'exit' fires.
 *
 * Zones should not overlap; if they do, the zone the point is deepest inside
 * wins. Zones smaller than ~2 * hysteresisM across can never trigger — the
 * blueprint validator warns about them.
 */
export class GeofenceEngine {
  private readonly cfg: GeofenceConfig;
  private current: string | null = null;
  private candidate: string | null = null;
  private candidateSince = 0;
  private outsideSince: number | null = null;

  constructor(
    private readonly zones: readonly Zone[],
    cfg?: Partial<GeofenceConfig>,
  ) {
    this.cfg = { ...DEFAULT_GEOFENCE_CONFIG, ...cfg };
  }

  get currentZoneId(): string | null {
    return this.current;
  }

  /** Evaluate the position at time tMs; returns zero or more zone events. */
  update(p: Point, tMs: number): ZoneEvent[] {
    const events: ZoneEvent[] = [];

    // Deepest zone the point is at least hysteresisM inside of.
    let deep: Zone | null = null;
    let deepDepth = -Infinity;
    for (const z of this.zones) {
      const d = interiorDepth(p, z.polygon);
      if (d >= this.cfg.hysteresisM && d > deepDepth) {
        deep = z;
        deepDepth = d;
      }
    }

    // Track "definitively outside the current zone" time.
    if (this.current) {
      const cur = this.zones.find((z) => z.id === this.current)!;
      const definitivelyOut = interiorDepth(p, cur.polygon) <= -this.cfg.hysteresisM;
      if (definitivelyOut) {
        if (this.outsideSince === null) this.outsideSince = tMs;
      } else {
        this.outsideSince = null;
      }
    }

    // Entry candidate handling (also covers direct zone-to-zone switches).
    if (deep && deep.id !== this.current) {
      if (this.candidate !== deep.id) {
        this.candidate = deep.id;
        this.candidateSince = tMs;
      }
      if (tMs - this.candidateSince >= this.cfg.enterDebounceMs) {
        if (this.current) {
          events.push({ type: 'exit', zoneId: this.current, timestampMs: tMs, position: p });
        }
        this.current = deep.id;
        this.candidate = null;
        this.outsideSince = null;
        events.push({ type: 'enter', zoneId: deep.id, timestampMs: tMs, position: p });
      }
    } else {
      this.candidate = null;
    }

    // Exit with no successor zone.
    if (
      this.current &&
      this.outsideSince !== null &&
      tMs - this.outsideSince >= this.cfg.exitDebounceMs
    ) {
      events.push({ type: 'exit', zoneId: this.current, timestampMs: tMs, position: p });
      this.current = null;
      this.outsideSince = null;
    }

    return events;
  }
}
