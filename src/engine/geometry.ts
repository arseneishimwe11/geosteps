import type { Point } from './types';

export function norm360(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

export function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function radToDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

export function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Ray-casting point-in-polygon test. Boundary behavior is unspecified; the geofence hysteresis makes it irrelevant. */
export function pointInPolygon(p: Point, poly: readonly Point[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!;
    const b = poly[j]!;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}

export interface SegmentProjection {
  /** Distance from p to the closest point on the segment. */
  dist: number;
  /** Parameter along the segment, clamped to [0, 1]. */
  t: number;
  /** The closest point on the segment. */
  closest: Point;
}

export function projectOnSegment(p: Point, a: Point, b: Point): SegmentProjection {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const len2 = abx * abx + aby * aby;
  let t = 0;
  if (len2 > 0) {
    t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2;
    t = Math.max(0, Math.min(1, t));
  }
  const closest = { x: a.x + t * abx, y: a.y + t * aby };
  return { dist: dist(p, closest), t, closest };
}

/** Minimum distance from p to the polygon's boundary (works for points inside or outside). */
export function distanceToPolygonBoundary(p: Point, poly: readonly Point[]): number {
  let min = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const d = projectOnSegment(p, poly[j]!, poly[i]!).dist;
    if (d < min) min = d;
  }
  return min;
}

/**
 * Signed depth of p relative to the polygon: positive = that far inside,
 * negative = that far outside. This is what the geofence hysteresis runs on.
 */
export function interiorDepth(p: Point, poly: readonly Point[]): number {
  const d = distanceToPolygonBoundary(p, poly);
  return pointInPolygon(p, poly) ? d : -d;
}

/** Area-weighted polygon centroid, falling back to the vertex mean for degenerate polygons. */
export function polygonCentroid(poly: readonly Point[]): Point {
  let area2 = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[j]!;
    const b = poly[i]!;
    const cross = a.x * b.y - b.x * a.y;
    area2 += cross;
    cx += (a.x + b.x) * cross;
    cy += (a.y + b.y) * cross;
  }
  if (Math.abs(area2) < 1e-12) {
    let sx = 0;
    let sy = 0;
    for (const v of poly) {
      sx += v.x;
      sy += v.y;
    }
    return { x: sx / poly.length, y: sy / poly.length };
  }
  return { x: cx / (3 * area2), y: cy / (3 * area2) };
}
