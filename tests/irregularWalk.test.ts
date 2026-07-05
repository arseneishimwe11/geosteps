import { describe, expect, it } from 'vitest';
import { pointInPolygon } from '../src/engine/geometry';
import { PositionEngine } from '../src/engine/positionEngine';
import { makeTestBlueprint } from './fixtures';
import { eventSummary, recordZoneEvents, Sim } from './helpers';

/**
 * The core promise: zone triggers come from where the visitor's coordinates
 * actually are, never from an assumed tour order. The walk below zig-zags,
 * backtracks, deliberately skips zone C, and re-enters zone A at the end.
 */
describe('irregular walk (zig-zag, backtrack, skip, re-enter)', () => {
  it('fires zone events purely from coordinates, in the order actually walked', () => {
    const bp = makeTestBlueprint();
    const engine = new PositionEngine(bp, { headingSmoothingAlpha: 1 });
    const events = recordZoneEvents(engine);
    const sim = new Sim(engine);

    // Compass convention in this fixture: 0° = +Y (north), 90° = +X (east).
    sim.walk(0, 6); //  entrance corridor -> into zone A            (5, 9.2)
    sim.dwell(3000); //   linger at the welcome display -> enter A fires
    sim.walk(180, 6); //  back down A's spur to the corridor          (5, 5)
    sim.walk(90, 15); //  east along the spine                     (15.5, 5)
    sim.walk(0, 6); //    up into zone B                         (15.5, 9.2)
    sim.dwell(3000);
    sim.walk(180, 6); //  back down to the spine                   (15.5, 5)
    sim.walk(90, 8); //   east, toward zone C's spur...           (21.1, 5)
    sim.walk(270, 4); //  ...changes mind, backtracks west         (18.3, 5)
    sim.walk(90, 24); //  strides east straight PAST zone C        (35.1, 5)
    sim.walk(0, 6); //    up into zone D                         (35.1, 9.2)
    sim.dwell(3000);
    sim.walk(180, 6); //  back down                                (35.1, 5)
    sim.walk(270, 43); // all the way west along the spine          (5.0, 5)
    sim.walk(0, 6); //    up into zone A again                    (5.0, 9.2)
    sim.dwell(3000);

    expect(eventSummary(events)).toEqual([
      'enter:zone-a',
      'exit:zone-a',
      'enter:zone-b',
      'exit:zone-b',
      'enter:zone-d',
      'exit:zone-d',
      'enter:zone-a',
    ]);

    // Zone C was walked past at corridor level but never entered.
    expect(events.some((e) => e.zoneId === 'zone-c')).toBe(false);

    const state = engine.getState();
    expect(state.currentZoneId).toBe('zone-a');
    expect(state.stepCount).toBe(136);
    const zoneA = bp.zones.find((z) => z.id === 'zone-a')!;
    expect(pointInPolygon(state.position, zoneA.polygon)).toBe(true);
  });

  it('re-entering a zone produces a fresh enter event (no "already visited" memory)', () => {
    const engine = new PositionEngine(makeTestBlueprint(), { headingSmoothingAlpha: 1 });
    const events = recordZoneEvents(engine);
    const sim = new Sim(engine);

    sim.walk(0, 6);
    sim.dwell(3000);
    sim.walk(180, 6);
    sim.dwell(4000); // stand in the corridor until the exit debounce elapses
    sim.walk(0, 6);
    sim.dwell(3000);

    expect(eventSummary(events)).toEqual(['enter:zone-a', 'exit:zone-a', 'enter:zone-a']);
  });
});
