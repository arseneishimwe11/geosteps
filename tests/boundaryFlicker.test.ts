import { describe, expect, it } from 'vitest';
import { AudioDirector } from '../src/engine/audio/audioDirector';
import { PositionEngine } from '../src/engine/positionEngine';
import type { FloorBlueprint } from '../src/engine/types';
import { makeTestBlueprint } from './fixtures';
import { eventSummary, FakeAudioBackend, recordZoneEvents, Sim } from './helpers';

function wireAudio(engine: PositionEngine, bp: FloorBlueprint) {
  const backend = new FakeAudioBackend();
  const director = new AudioDirector(backend, bp.zones, { language: 'en', fallbackLanguage: 'en' });
  engine.onZoneEvent((ev) => director.handleZoneEvent(ev));
  return { backend, director };
}

describe('boundary flicker suppression', () => {
  it('oscillating right on a zone edge neither exits nor retriggers audio', () => {
    const bp = makeTestBlueprint({ entry: { position: { x: 15.5, y: 5 } } });
    const engine = new PositionEngine(bp, { headingSmoothingAlpha: 1 });
    const events = recordZoneEvents(engine);
    const { backend } = wireAudio(engine, bp);
    const sim = new Sim(engine);

    // Walk well into zone B; narration starts once.
    sim.walk(0, 6); // (15.5, 9.2)
    sim.dwell(3000);
    expect(eventSummary(events)).toEqual(['enter:zone-b']);
    expect(backend.tracks).toHaveLength(1);

    // Now shuffle back and forth across B's south edge (y=8) for a while:
    // one step out (y≈7.8), one step in (y≈8.5), twenty times. Every single
    // step crosses the polygon boundary.
    sim.walk(180, 2); // 8.5 -> 7.8
    for (let i = 0; i < 20; i++) {
      sim.walk(0, 1); // back to ~8.5 (inside)
      sim.walk(180, 1); // back to ~7.8 (outside)
    }
    sim.dwell(2000);

    // Hysteresis (±0.5 m) + debounce: no exit, no re-enter, no new track.
    expect(eventSummary(events)).toEqual(['enter:zone-b']);
    expect(backend.tracks).toHaveLength(1);
    expect(backend.tracks[0]!.fadeIns).toHaveLength(1);

    // A genuine departure must still exit: walk decisively out and wait.
    sim.walk(180, 6); // down to y≈3.6, far outside
    sim.dwell(4000);
    expect(eventSummary(events)).toEqual(['enter:zone-b', 'exit:zone-b']);
  });

  it('two adjacent zones sharing an edge: hovering on the shared boundary never swaps tracks', () => {
    // Minimal venue: zones E and F share the edge y=6; everything is walkable.
    const bp: FloorBlueprint = {
      schemaVersion: 1,
      venue: { id: 'mini', name: 'Mini', languages: ['en'], defaultLanguage: 'en' },
      entry: { position: { x: 5, y: 3 } },
      zones: [
        {
          id: 'zone-e',
          name: 'E',
          polygon: [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 6 },
            { x: 0, y: 6 },
          ],
          audio: { en: { url: 'audio/e.mp3' } },
        },
        {
          id: 'zone-f',
          name: 'F',
          polygon: [
            { x: 0, y: 6 },
            { x: 10, y: 6 },
            { x: 10, y: 12 },
            { x: 0, y: 12 },
          ],
          audio: { en: { url: 'audio/f.mp3' } },
        },
      ],
      graph: {
        nodes: [
          { id: 's', x: 5, y: 0 },
          { id: 'n', x: 5, y: 12 },
        ],
        edges: [{ from: 's', to: 'n', widthM: 20 }],
      },
      calibration: { headingOffsetDeg: 0, defaultStrideM: 0.7 },
    };
    const engine = new PositionEngine(bp, { headingSmoothingAlpha: 1 });
    const events = recordZoneEvents(engine);
    const { backend } = wireAudio(engine, bp);
    const sim = new Sim(engine);

    sim.dwell(3000); // settle: enter E at the start position
    expect(eventSummary(events)).toEqual(['enter:zone-e']);

    // Drift up to the shared boundary and hover on it, crossing every step.
    sim.walk(0, 4); // y: 3 -> 5.8
    for (let i = 0; i < 12; i++) {
      sim.walk(0, 1); // ~6.5, nominally in F
      sim.walk(180, 1); // ~5.8, nominally in E
    }
    sim.dwell(2000);

    // Still just E — one track, zero crossfades.
    expect(eventSummary(events)).toEqual(['enter:zone-e']);
    expect(backend.tracks).toHaveLength(1);
    expect(backend.tracks[0]!.fadeOuts).toHaveLength(0);

    // A real move into F still works, as one clean crossfade.
    sim.walk(0, 6); // deep into F (y ≈ 10)
    sim.dwell(3000);
    expect(eventSummary(events)).toEqual(['enter:zone-e', 'exit:zone-e', 'enter:zone-f']);
    expect(backend.tracks).toHaveLength(2);
    expect(backend.tracks[0]!.fadeOuts).toHaveLength(1); // E faded out
    expect(backend.tracks[1]!.fadeIns).toHaveLength(1); // F faded in
  });
});
