/**
 * Pure geometry operations for the floor-plan editor.
 *
 * Every mutation the canvas can perform lives here as a pure function on a
 * GeometrySnapshot — no DOM, no React — so the drawing tool's actual
 * behavior is unit-testable and the interactive layer stays a thin shell.
 * All coordinates are map-frame meters (+Y up), the exact numbers the
 * frozen blueprint schema stores and the engine consumes.
 */
import type { GraphEdge, Point, WalkableGraph, Zone } from '../../../engine/types';

export interface GeometrySnapshot {
  zones: Zone[];
  graph: WalkableGraph;
}

export const DEFAULT_EDGE_WIDTH_M = 3;

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

export function slugify(name: string): string {
  const s = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return s || 'zone';
}

function uniqueId(base: string, taken: ReadonlySet<string>): string {
  if (!taken.has(base)) return base;
  for (let i = 2; ; i++) {
    const candidate = `${base}-${i}`;
    if (!taken.has(candidate)) return candidate;
  }
}

export function nextNodeId(graph: WalkableGraph): string {
  const taken = new Set(graph.nodes.map((n) => n.id));
  for (let i = graph.nodes.length + 1; ; i++) {
    const candidate = `n${i}`;
    if (!taken.has(candidate)) return candidate;
  }
}

/** Round to the grid step (used when grid snapping is on). */
export function snapToGrid(p: Point, stepM: number): Point {
  return { x: Math.round(p.x / stepM) * stepM, y: Math.round(p.y / stepM) * stepM };
}

/** Nearest graph node within tolM of p, or null. */
export function nearestNode(graph: WalkableGraph, p: Point, tolM: number): string | null {
  let best: { id: string; d: number } | null = null;
  for (const n of graph.nodes) {
    const d = Math.hypot(n.x - p.x, n.y - p.y);
    if (d <= tolM && (!best || d < best.d)) best = { id: n.id, d };
  }
  return best?.id ?? null;
}

const sameEdge = (e: GraphEdge, a: string, b: string) =>
  (e.from === a && e.to === b) || (e.from === b && e.to === a);

// ---------------------------------------------------------------------------
// zone operations
// ---------------------------------------------------------------------------

export function addZone(
  g: GeometrySnapshot,
  polygon: Point[],
  name: string,
): { geometry: GeometrySnapshot; zoneId: string } {
  if (polygon.length < 3) throw new Error('A zone polygon needs at least 3 vertices.');
  const zoneId = uniqueId(slugify(name), new Set(g.zones.map((z) => z.id)));
  const zone: Zone = { id: zoneId, name: name.trim() || zoneId, polygon, audio: {} };
  return { geometry: { ...g, zones: [...g.zones, zone] }, zoneId };
}

export function deleteZone(g: GeometrySnapshot, zoneId: string): GeometrySnapshot {
  return { ...g, zones: g.zones.filter((z) => z.id !== zoneId) };
}

export function moveZoneVertex(
  g: GeometrySnapshot,
  zoneId: string,
  vertexIndex: number,
  p: Point,
): GeometrySnapshot {
  return {
    ...g,
    zones: g.zones.map((z) =>
      z.id === zoneId
        ? { ...z, polygon: z.polygon.map((v, i) => (i === vertexIndex ? p : v)) }
        : z,
    ),
  };
}

/** Remove one vertex; refuses to go below a triangle. */
export function deleteZoneVertex(
  g: GeometrySnapshot,
  zoneId: string,
  vertexIndex: number,
): GeometrySnapshot {
  return {
    ...g,
    zones: g.zones.map((z) => {
      if (z.id !== zoneId) return z;
      if (z.polygon.length <= 3) return z;
      return { ...z, polygon: z.polygon.filter((_, i) => i !== vertexIndex) };
    }),
  };
}

// ---------------------------------------------------------------------------
// walkable-graph operations
// ---------------------------------------------------------------------------

export function addGraphNode(
  g: GeometrySnapshot,
  p: Point,
): { geometry: GeometrySnapshot; nodeId: string } {
  const nodeId = nextNodeId(g.graph);
  return {
    geometry: {
      ...g,
      graph: { ...g.graph, nodes: [...g.graph.nodes, { id: nodeId, x: p.x, y: p.y }] },
    },
    nodeId,
  };
}

/** Connect two existing nodes. No self-edges; duplicates (either direction) are no-ops. */
export function connectNodes(
  g: GeometrySnapshot,
  fromId: string,
  toId: string,
  widthM: number,
): GeometrySnapshot {
  if (fromId === toId) return g;
  const nodeIds = new Set(g.graph.nodes.map((n) => n.id));
  if (!nodeIds.has(fromId) || !nodeIds.has(toId)) return g;
  if (g.graph.edges.some((e) => sameEdge(e, fromId, toId))) return g;
  return {
    ...g,
    graph: { ...g.graph, edges: [...g.graph.edges, { from: fromId, to: toId, widthM }] },
  };
}

export function moveGraphNode(g: GeometrySnapshot, nodeId: string, p: Point): GeometrySnapshot {
  return {
    ...g,
    graph: {
      ...g.graph,
      nodes: g.graph.nodes.map((n) => (n.id === nodeId ? { ...n, x: p.x, y: p.y } : n)),
    },
  };
}

/** Delete a node and every edge that referenced it. */
export function deleteGraphNode(g: GeometrySnapshot, nodeId: string): GeometrySnapshot {
  return {
    ...g,
    graph: {
      nodes: g.graph.nodes.filter((n) => n.id !== nodeId),
      edges: g.graph.edges.filter((e) => e.from !== nodeId && e.to !== nodeId),
    },
  };
}

export function deleteEdge(g: GeometrySnapshot, fromId: string, toId: string): GeometrySnapshot {
  return {
    ...g,
    graph: { ...g.graph, edges: g.graph.edges.filter((e) => !sameEdge(e, fromId, toId)) },
  };
}

export function setEdgeWidth(
  g: GeometrySnapshot,
  fromId: string,
  toId: string,
  widthM: number,
): GeometrySnapshot {
  if (!Number.isFinite(widthM) || widthM <= 0) return g;
  return {
    ...g,
    graph: {
      ...g.graph,
      edges: g.graph.edges.map((e) => (sameEdge(e, fromId, toId) ? { ...e, widthM } : e)),
    },
  };
}
