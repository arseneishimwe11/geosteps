import { projectOnSegment } from './geometry';
import type { Point, WalkableGraph } from './types';

export interface MapMatchResult {
  /** Corrected position — equals the raw input when it was already walkable. */
  position: Point;
  /** True when the raw position was outside walkable space and got snapped back. */
  snapped: boolean;
  /** How far the raw position was moved (0 when not snapped). */
  distanceFromRawM: number;
  /** "from->to" id of the edge whose capsule contains / received the position. */
  edgeId: string;
}

interface ResolvedEdge {
  id: string;
  a: Point;
  b: Point;
  radius: number;
}

/**
 * Map matching against the admin-recorded walkable-floor graph.
 *
 * Model: each graph edge is a corridor "capsule" — every point within
 * widthM/2 of the segment between its nodes. The union of capsules is the
 * walkable space; everything else is wall. A raw dead-reckoned position that
 * falls in a wall is replaced by the nearest point of the nearest capsule —
 * the same principle car GPS uses to snap noisy pings onto the road network.
 *
 * The corrected position is written back into the dead-reckoning state by the
 * caller, so a persistent heading bias slides the estimate along the corridor
 * wall instead of accumulating unbounded error through it.
 */
export class MapMatcher {
  private readonly edges: ResolvedEdge[];

  constructor(graph: WalkableGraph) {
    const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
    this.edges = graph.edges.map((e) => {
      const a = nodeById.get(e.from);
      const b = nodeById.get(e.to);
      if (!a || !b) throw new Error(`Walkable graph edge references unknown node: ${e.from}->${e.to}`);
      return { id: `${e.from}->${e.to}`, a: { x: a.x, y: a.y }, b: { x: b.x, y: b.y }, radius: e.widthM / 2 };
    });
    if (this.edges.length === 0) throw new Error('Walkable graph has no edges — nothing is walkable');
  }

  isWalkable(p: Point, epsilonM = 1e-9): boolean {
    for (const e of this.edges) {
      if (projectOnSegment(p, e.a, e.b).dist <= e.radius + epsilonM) return true;
    }
    return false;
  }

  match(raw: Point): MapMatchResult {
    let best: { edge: ResolvedEdge; overshoot: number; closest: Point; dist: number } | null = null;

    for (const e of this.edges) {
      const proj = projectOnSegment(raw, e.a, e.b);
      const overshoot = proj.dist - e.radius;
      if (overshoot <= 0) {
        // Inside this capsule: the raw position is valid, keep it.
        return { position: raw, snapped: false, distanceFromRawM: 0, edgeId: e.id };
      }
      if (!best || overshoot < best.overshoot) {
        best = { edge: e, overshoot, closest: proj.closest, dist: proj.dist };
      }
    }

    // Outside all capsules: snap to the nearest point of the nearest capsule —
    // from the centerline projection, move toward the raw point by the capsule
    // radius (for radius 0 this degenerates to the centerline itself).
    const b = best!;
    let position: Point;
    if (b.dist === 0) {
      position = b.closest; // degenerate (radius 0 and exactly on the line)
    } else {
      const ux = (raw.x - b.closest.x) / b.dist;
      const uy = (raw.y - b.closest.y) / b.dist;
      position = { x: b.closest.x + ux * b.edge.radius, y: b.closest.y + uy * b.edge.radius };
    }
    return { position, snapped: true, distanceFromRawM: b.overshoot, edgeId: b.edge.id };
  }
}
