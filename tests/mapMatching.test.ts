import { describe, expect, it } from 'vitest';
import { MapMatcher } from '../src/engine/mapMatching';
import { PositionEngine } from '../src/engine/positionEngine';
import type { PositionState, WalkableGraph } from '../src/engine/types';
import { makeTestBlueprint } from './fixtures';
import { Sim } from './helpers';

describe('MapMatcher (capsule graph snapping)', () => {
  const graph: WalkableGraph = {
    nodes: [
      { id: 'n1', x: 0, y: 0 },
      { id: 'n2', x: 10, y: 0 },
    ],
    edges: [{ from: 'n1', to: 'n2', widthM: 4 }],
  };
  const matcher = new MapMatcher(graph);

  it('leaves positions inside the walkable capsule untouched', () => {
    const r = matcher.match({ x: 5, y: 1 });
    expect(r.snapped).toBe(false);
    expect(r.position).toEqual({ x: 5, y: 1 });
    expect(r.distanceFromRawM).toBe(0);
  });

  it('snaps a position in a wall to the nearest point of the nearest capsule', () => {
    const r = matcher.match({ x: 5, y: 5 });
    expect(r.snapped).toBe(true);
    expect(r.position.x).toBeCloseTo(5, 6);
    expect(r.position.y).toBeCloseTo(2, 6); // capsule radius = widthM / 2 = 2
    expect(r.distanceFromRawM).toBeCloseTo(3, 6);
  });

  it('handles positions beyond the segment end (rounded capsule cap)', () => {
    const r = matcher.match({ x: 14, y: 3 }); // 5 m from node n2, radially
    expect(r.snapped).toBe(true);
    expect(r.position.x).toBeCloseTo(10 + (4 / 5) * 2, 6); // 11.6
    expect(r.position.y).toBeCloseTo(0 + (3 / 5) * 2, 6); // 1.2
    expect(r.distanceFromRawM).toBeCloseTo(3, 6);
  });

  it('reports walkability', () => {
    expect(matcher.isWalkable({ x: 5, y: 1.99 })).toBe(true);
    expect(matcher.isWalkable({ x: 5, y: 2.01 })).toBe(false);
  });
});

describe('drift correction end to end', () => {
  it('a compass bias that would dead-reckon through a wall gets snapped back onto walkable space', () => {
    // The visitor walks straight up zone B's spur (true heading 0°), but the
    // compass reads +25° the whole way — cheap-phone heading bias.
    const bp = makeTestBlueprint({ entry: { position: { x: 15, y: 5 } } });
    const engine = new PositionEngine(bp, { headingSmoothingAlpha: 1 });
    const matcher = new MapMatcher(bp.graph);
    const states: PositionState[] = [];
    engine.onPosition((s) => states.push(s));

    const sim = new Sim(engine);
    sim.walk(25, 10); // biased compass readings

    // Where raw dead reckoning WOULD have put them: inside a wall.
    const stride = bp.calibration.defaultStrideM;
    const rad = (25 * Math.PI) / 180;
    const rawEnd = {
      x: 15 + 10 * stride * Math.sin(rad),
      y: 5 + 10 * stride * Math.cos(rad),
    };
    expect(matcher.isWalkable(rawEnd)).toBe(false);

    // The engine never reported a single in-wall position...
    expect(states.length).toBeGreaterThan(0);
    for (const s of states) {
      expect(matcher.isWalkable(s.position, 1e-6)).toBe(true);
    }
    // ...it actively snapped at least once...
    expect(states.some((s) => s.source === 'map-match')).toBe(true);

    // ...and the final estimate slid along the spur capsule's wall instead of
    // punching through it (hand-computed geometry; see the capsule math).
    const final = states[states.length - 1]!.position;
    expect(final.x).toBeCloseTo(16.978, 1);
    expect(final.y).toBeCloseTo(11.296, 1);

    // Bonus honesty: the corrected position is still inside the room the
    // visitor is actually in (zone B), so zone logic keeps working.
    const zoneB = bp.zones.find((z) => z.id === 'zone-b')!;
    const inB =
      final.x >= zoneB.polygon[0]!.x &&
      final.x <= zoneB.polygon[1]!.x &&
      final.y >= zoneB.polygon[0]!.y &&
      final.y <= zoneB.polygon[2]!.y;
    expect(inB).toBe(true);
  });
});
