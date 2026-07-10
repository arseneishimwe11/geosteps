/**
 * Dev-only drivers for demonstrating the guide without walking sensors
 * (desktop browsers, CI). These feed INPUTS into the engine — synthetic
 * headings/steps and canned acoustic fingerprints — exactly the way real
 * sensors would. They never touch the UI's rendered state, so the
 * "UI computes nothing" acceptance criterion holds: the display still shows
 * only what the engine reports.
 *
 * Surfaced exclusively through the ?dev=1 drawer, clearly labeled.
 */
import type { AcousticFingerprint } from '../../engine/types';
import type { GuideSession } from './guideSession';

/** Map-frame direction the demo drawer exposes as arrow buttons. */
export type SimDirection = 'north' | 'east' | 'south' | 'west';

const DIRECTION_TO_MAP_BEARING: Record<SimDirection, number> = {
  north: 0,
  east: 90,
  south: 180,
  west: 270,
};

/**
 * Walk n simulated steps in a map-frame direction. Converts to the compass
 * frame using the blueprint's calibration (the same math a phone's real
 * compass reading goes through in reverse), then drives the engine's public
 * simulation seam.
 */
export function simWalk(session: GuideSession, direction: SimDirection, steps = 1): void {
  const compassDeg =
    (DIRECTION_TO_MAP_BEARING[direction] + session.blueprint.calibration.headingOffsetDeg) % 360;
  for (let i = 0; i < steps; i++) {
    const t = Date.now();
    session.engine.handleHeading(compassDeg, t);
    session.engine.stepOnce(t);
  }
}

/**
 * Inject an ambient sample that sounds like the given zone: the zone's
 * stored calibration fingerprint with a little multiplicative noise, i.e.
 * "the same room at a different moment". Returns false when the zone has no
 * stored fingerprint to imitate.
 */
export function simAcoustic(session: GuideSession, zoneId: string, noise = 0.05): boolean {
  const zone = session.blueprint.zones.find((z) => z.id === zoneId);
  if (!zone?.fingerprint) return false;
  const jittered = zone.fingerprint.energies.map((e) => e * (1 + noise * (2 * Math.random() - 1)));
  const total = jittered.reduce((s, e) => s + e, 0);
  const sample: AcousticFingerprint = {
    ...zone.fingerprint,
    energies: jittered.map((e) => e / total),
    capturedAt: new Date().toISOString(),
    captureSeconds: 2,
  };
  session.engine.handleAcousticSample(sample, Date.now());
  return true;
}
