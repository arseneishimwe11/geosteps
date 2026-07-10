import { describe, expect, it } from 'vitest';
import {
  addGraphNode,
  addZone,
  connectNodes,
  deleteGraphNode,
  deleteZone,
  deleteZoneVertex,
  moveGraphNode,
  moveZoneVertex,
  nearestNode,
  nextNodeId,
  setEdgeWidth,
  slugify,
  snapToGrid,
  type GeometrySnapshot,
} from '../src/ui/admin/canvas/editorOps';

const empty = (): GeometrySnapshot => ({ zones: [], graph: { nodes: [], edges: [] } });

const tri = [
  { x: 0, y: 0 },
  { x: 4, y: 0 },
  { x: 4, y: 4 },
];

describe('editorOps — zones', () => {
  it('addZone slugifies the name into a unique id and starts with empty audio', () => {
    let g = empty();
    const a = addZone(g, tri, 'Royal Drums!');
    g = a.geometry;
    expect(a.zoneId).toBe('royal-drums');
    const b = addZone(g, tri, 'Royal  Drums');
    expect(b.zoneId).toBe('royal-drums-2'); // collision → suffixed
    expect(b.geometry.zones).toHaveLength(2);
    expect(b.geometry.zones[0]!.audio).toEqual({});
  });

  it('addZone refuses fewer than 3 vertices', () => {
    expect(() => addZone(empty(), tri.slice(0, 2), 'x')).toThrow(/3 vertices/);
  });

  it('moveZoneVertex moves exactly one vertex and nothing else', () => {
    let g = addZone(empty(), tri, 'a').geometry;
    g = moveZoneVertex(g, 'a', 1, { x: 9, y: 1 });
    expect(g.zones[0]!.polygon[1]).toEqual({ x: 9, y: 1 });
    expect(g.zones[0]!.polygon[0]).toEqual({ x: 0, y: 0 });
  });

  it('deleteZoneVertex refuses to reduce a triangle', () => {
    let g = addZone(empty(), tri, 'a').geometry;
    g = deleteZoneVertex(g, 'a', 0);
    expect(g.zones[0]!.polygon).toHaveLength(3); // unchanged

    g = addZone(empty(), [...tri, { x: 0, y: 4 }], 'b').geometry;
    g = deleteZoneVertex(g, 'b', 3);
    expect(g.zones[0]!.polygon).toHaveLength(3);
  });

  it('deleteZone removes only the targeted zone', () => {
    let g = addZone(empty(), tri, 'a').geometry;
    g = addZone(g, tri, 'b').geometry;
    g = deleteZone(g, 'a');
    expect(g.zones.map((z) => z.id)).toEqual(['b']);
  });
});

describe('editorOps — walkable graph', () => {
  it('addGraphNode issues sequential unique ids even after deletions', () => {
    let g = empty();
    const n1 = addGraphNode(g, { x: 0, y: 0 });
    const n2 = addGraphNode(n1.geometry, { x: 5, y: 0 });
    expect([n1.nodeId, n2.nodeId]).toEqual(['n1', 'n2']);
    // Delete n1: the next id must not collide with the surviving n2.
    const afterDelete = deleteGraphNode(n2.geometry, 'n1');
    expect(nextNodeId(afterDelete.graph)).not.toBe('n2');
    expect(addGraphNode(afterDelete, { x: 1, y: 1 }).geometry.graph.nodes.map((n) => n.id)).toEqual([
      'n2',
      nextNodeId(afterDelete.graph),
    ]);
  });

  it('connectNodes refuses self-edges and duplicates in either direction', () => {
    let g = empty();
    g = addGraphNode(g, { x: 0, y: 0 }).geometry; // n1
    g = addGraphNode(g, { x: 5, y: 0 }).geometry; // n2
    g = connectNodes(g, 'n1', 'n2', 3);
    expect(g.graph.edges).toHaveLength(1);
    g = connectNodes(g, 'n2', 'n1', 3); // reverse duplicate
    g = connectNodes(g, 'n1', 'n1', 3); // self
    g = connectNodes(g, 'n1', 'ghost', 3); // unknown node
    expect(g.graph.edges).toHaveLength(1);
  });

  it('deleteGraphNode cascades its edges', () => {
    let g = empty();
    g = addGraphNode(g, { x: 0, y: 0 }).geometry; // n1
    g = addGraphNode(g, { x: 5, y: 0 }).geometry; // n2
    g = addGraphNode(g, { x: 5, y: 5 }).geometry; // n3
    g = connectNodes(g, 'n1', 'n2', 3);
    g = connectNodes(g, 'n2', 'n3', 3);
    g = deleteGraphNode(g, 'n2');
    expect(g.graph.nodes.map((n) => n.id)).toEqual(['n1', 'n3']);
    expect(g.graph.edges).toHaveLength(0);
  });

  it('moveGraphNode keeps edges attached (they reference ids, not coords)', () => {
    let g = empty();
    g = addGraphNode(g, { x: 0, y: 0 }).geometry;
    g = addGraphNode(g, { x: 5, y: 0 }).geometry;
    g = connectNodes(g, 'n1', 'n2', 3);
    g = moveGraphNode(g, 'n2', { x: 8, y: 2 });
    expect(g.graph.nodes[1]).toEqual({ id: 'n2', x: 8, y: 2 });
    expect(g.graph.edges[0]).toEqual({ from: 'n1', to: 'n2', widthM: 3 });
  });

  it('setEdgeWidth updates either direction and rejects nonsense widths', () => {
    let g = empty();
    g = addGraphNode(g, { x: 0, y: 0 }).geometry;
    g = addGraphNode(g, { x: 5, y: 0 }).geometry;
    g = connectNodes(g, 'n1', 'n2', 3);
    g = setEdgeWidth(g, 'n2', 'n1', 4.5);
    expect(g.graph.edges[0]!.widthM).toBe(4.5);
    g = setEdgeWidth(g, 'n1', 'n2', -1);
    expect(g.graph.edges[0]!.widthM).toBe(4.5);
  });
});

describe('editorOps — helpers', () => {
  it('slugify produces url/id-safe slugs', () => {
    expect(slugify('Royal Drum Gallery')).toBe('royal-drum-gallery');
    expect(slugify('  Éxpo #4 — Ingoma  ')).toBe('expo-4-ingoma');
    expect(slugify('!!!')).toBe('zone');
  });

  it('snapToGrid rounds to the step', () => {
    expect(snapToGrid({ x: 1.26, y: 3.74 }, 0.5)).toEqual({ x: 1.5, y: 3.5 });
  });

  it('nearestNode respects tolerance', () => {
    let g = empty();
    g = addGraphNode(g, { x: 0, y: 0 }).geometry;
    g = addGraphNode(g, { x: 5, y: 0 }).geometry;
    expect(nearestNode(g.graph, { x: 0.3, y: 0.2 }, 0.5)).toBe('n1');
    expect(nearestNode(g.graph, { x: 2.5, y: 0 }, 0.5)).toBeNull();
    expect(nearestNode(g.graph, { x: 4.8, y: 0.1 }, 0.5)).toBe('n2');
  });
});
