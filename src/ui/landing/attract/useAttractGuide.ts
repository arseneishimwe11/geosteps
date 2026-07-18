'use client';

/**
 * Attract mode: the hero device's screen is driven by the REAL frozen
 * engine walking the REAL demo venue, not by a keyframed animation.
 *
 * A scripted visitor strolls the museum on a loop. The script feeds the
 * engine inputs only — heading bursts + steps exactly the way the dev
 * simulator does (`simWalk`), and jittered ambient fingerprints the way
 * `simAcoustic` does. Everything the screen shows (zone, confidence disc,
 * step count, minimap dot) is the engine's own output; the acceptance
 * criterion from HANDOFF.md §4.1 — the UI computes nothing — holds on the
 * marketing page too. Watch the disc grow along the corridor and snap tight
 * on the acoustic re-anchor in each room: that is the actual product logic
 * running, not a story we drew about it.
 *
 * Under `prefers-reduced-motion` the walk never starts and the screen keeps
 * its static server-rendered frame.
 */

import { useEffect, useState } from 'react';
import { PositionEngine } from '../../../engine/positionEngine';
import type { AcousticFingerprint, FloorBlueprint, PositionState } from '../../../engine/types';
import demoBlueprintJson from '../../../../venues/demo/blueprint.json';

export const demoBlueprint = demoBlueprintJson as unknown as FloorBlueprint;

/** Frozen mid-visit frame for SSR, reduced motion, and the pre-mount paint. */
export const STATIC_POSITION: PositionState = {
  position: { x: 15, y: 11 },
  headingMapDeg: 0,
  stepCount: 248,
  distanceWalkedM: 173.6,
  uncertaintyM: 2.8,
  source: 'acoustic-snap',
  timestampMs: 0,
  currentZoneId: 'royal-drums',
};

type Leg =
  | { kind: 'walk'; bearingDeg: number; steps: number }
  | { kind: 'dwell'; zoneId: string; ms: number };

/**
 * A ping-pong stroll: in, along the spine visiting every room, and back.
 * No teleports — the visitor walks home, uncertainty growing honestly on the
 * long corridor stretches. Bearings are map-frame (0 = +Y, toward the rooms).
 */
const ROUTE: Leg[] = [
  { kind: 'walk', bearingDeg: 0, steps: 9 }, // entry → Entrance Hall
  { kind: 'dwell', zoneId: 'entrance-hall', ms: 5000 },
  { kind: 'walk', bearingDeg: 180, steps: 9 },
  { kind: 'walk', bearingDeg: 90, steps: 14 },
  { kind: 'walk', bearingDeg: 0, steps: 9 }, // Royal Drum Gallery
  { kind: 'dwell', zoneId: 'royal-drums', ms: 6500 },
  { kind: 'walk', bearingDeg: 180, steps: 9 },
  { kind: 'walk', bearingDeg: 90, steps: 14 },
  { kind: 'walk', bearingDeg: 0, steps: 9 }, // Kingdom History Room
  { kind: 'dwell', zoneId: 'kingdom-history', ms: 5000 },
  { kind: 'walk', bearingDeg: 180, steps: 9 },
  { kind: 'walk', bearingDeg: 90, steps: 14 },
  { kind: 'walk', bearingDeg: 0, steps: 9 }, // Contemporary Art Wing
  { kind: 'dwell', zoneId: 'contemporary-wing', ms: 5000 },
  { kind: 'walk', bearingDeg: 180, steps: 9 }, // …and back the way they came
  { kind: 'walk', bearingDeg: 270, steps: 14 },
  { kind: 'walk', bearingDeg: 0, steps: 9 },
  { kind: 'dwell', zoneId: 'kingdom-history', ms: 4000 },
  { kind: 'walk', bearingDeg: 180, steps: 9 },
  { kind: 'walk', bearingDeg: 270, steps: 14 },
  { kind: 'walk', bearingDeg: 0, steps: 9 },
  { kind: 'dwell', zoneId: 'royal-drums', ms: 6500 },
  { kind: 'walk', bearingDeg: 180, steps: 9 },
  { kind: 'walk', bearingDeg: 270, steps: 14 },
  { kind: 'walk', bearingDeg: 0, steps: 9 },
  { kind: 'dwell', zoneId: 'entrance-hall', ms: 5000 },
  { kind: 'walk', bearingDeg: 180, steps: 9 }, // back to the QR stand
];

const STEP_MS = 560; // ~1.8 steps/s, an unhurried museum walk
const ACOUSTIC_EVERY_MS = 1600;

/** Same input pattern as the dev simulator's simWalk: burst then step. */
function walkOneStep(engine: PositionEngine, blueprint: FloorBlueprint, bearingDeg: number): void {
  const compassDeg = (bearingDeg + blueprint.calibration.headingOffsetDeg) % 360;
  const t = Date.now();
  for (let h = 0; h < 8; h++) engine.handleHeading(compassDeg, t);
  engine.stepOnce(t);
}

/** Same input pattern as the dev simulator's simAcoustic: the room's stored
 * fingerprint with multiplicative noise — "the same room, another moment". */
function sampleAmbient(engine: PositionEngine, blueprint: FloorBlueprint, zoneId: string): void {
  const zone = blueprint.zones.find((z) => z.id === zoneId);
  if (!zone?.fingerprint) return;
  const jittered = zone.fingerprint.energies.map((e) => e * (1 + 0.05 * (2 * Math.random() - 1)));
  const total = jittered.reduce((s, e) => s + e, 0);
  const sample: AcousticFingerprint = {
    ...zone.fingerprint,
    energies: jittered.map((e) => e / total),
    capturedAt: new Date().toISOString(),
    captureSeconds: 2,
  };
  engine.handleAcousticSample(sample, Date.now());
}

export interface AttractState {
  position: PositionState;
  /** Last zone the visitor was inside — narration keeps playing after exit
   * (AudioDirector's stopOnExit defaults to false), so the card persists. */
  lastZoneId: string | null;
  live: boolean;
}

export function useAttractGuide(): AttractState {
  const [state, setState] = useState<AttractState>({
    position: STATIC_POSITION,
    lastZoneId: 'royal-drums',
    live: false,
  });

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const engine = new PositionEngine(demoBlueprint);
    let lastZoneId: string | null = null;
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    const offPosition = engine.onPosition((position) => {
      if (cancelled) return;
      if (position.currentZoneId) lastZoneId = position.currentZoneId;
      setState({ position, lastZoneId, live: true });
    });

    // geofence debounce needs wall-clock ticks while standing still
    const tick = setInterval(() => engine.tick(Date.now()), 500);

    const sleep = (ms: number) =>
      new Promise<void>((resolve) => {
        timers.push(setTimeout(resolve, ms));
      });

    (async () => {
      await sleep(1200); // let the crossfade settle before the walk begins
      while (!cancelled) {
        for (const leg of ROUTE) {
          if (cancelled) return;
          if (leg.kind === 'walk') {
            for (let i = 0; i < leg.steps && !cancelled; i++) {
              walkOneStep(engine, demoBlueprint, leg.bearingDeg);
              await sleep(STEP_MS);
            }
          } else {
            const until = Date.now() + leg.ms;
            while (Date.now() < until && !cancelled) {
              sampleAmbient(engine, demoBlueprint, leg.zoneId);
              await sleep(ACOUSTIC_EVERY_MS);
            }
          }
        }
      }
    })();

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
      clearInterval(tick);
      offPosition();
    };
  }, []);

  return state;
}
