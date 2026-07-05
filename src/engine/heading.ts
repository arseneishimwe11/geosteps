import { degToRad, norm360, radToDeg } from './geometry';
import type { Point } from './types';

/**
 * Exponential smoothing of a compass heading, done on the unit vector so the
 * 359° -> 1° wraparound doesn't produce a bogus 180° average.
 */
export class HeadingSmoother {
  private vx = NaN;
  private vy = NaN;

  constructor(private readonly alpha: number = 0.3) {
    if (alpha <= 0 || alpha > 1) throw new Error('HeadingSmoother alpha must be in (0, 1]');
  }

  /** Feed a compass heading (deg CW from north); returns the smoothed heading. */
  update(compassDeg: number): number {
    const r = degToRad(compassDeg);
    const x = Math.sin(r);
    const y = Math.cos(r);
    if (Number.isNaN(this.vx)) {
      this.vx = x;
      this.vy = y;
    } else {
      this.vx += this.alpha * (x - this.vx);
      this.vy += this.alpha * (y - this.vy);
    }
    return this.current();
  }

  current(): number {
    if (Number.isNaN(this.vx)) return 0;
    return norm360(radToDeg(Math.atan2(this.vx, this.vy)));
  }
}

/**
 * Rotate a compass heading (deg CW from north) into the map frame
 * (deg CW from map +Y), given the blueprint's headingOffsetDeg.
 */
export function compassToMapBearingDeg(compassDeg: number, headingOffsetDeg: number): number {
  return norm360(compassDeg - headingOffsetDeg);
}

/** Unit displacement for one step taken at the given map bearing (deg CW from +Y). */
export function mapBearingToVector(bearingDeg: number): Point {
  const r = degToRad(bearingDeg);
  return { x: Math.sin(r), y: Math.cos(r) };
}
