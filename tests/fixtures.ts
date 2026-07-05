import type { AcousticFingerprint, FloorBlueprint } from '../src/engine/types';

export function normalizedEnergies(weights: number[]): number[] {
  const sum = weights.reduce((s, w) => s + w, 0);
  return weights.map((w) => w / sum);
}

export const FP_META = {
  version: 1,
  method: 'band-energy-v1',
  sampleRateHz: 16000,
  fftSize: 2048,
  bandCount: 16,
  bandsHz: [100, 7200],
} as const satisfies Omit<AcousticFingerprint, 'energies'>;

/** Zone A ambience: energy concentrated in low bands (HVAC rumble at the entrance). */
export const ZONE_A_ENERGIES = normalizedEnergies([
  1, 6, 6, 5, 3, 1, 0.5, 0.3, 0.2, 0.2, 0.1, 0.1, 0.1, 0.05, 0.05, 0.05,
]);

/** Zone C ambience: energy concentrated in upper-mid bands (ventilation whine in the history room). */
export const ZONE_C_ENERGIES = normalizedEnergies([
  0.05, 0.05, 0.1, 0.1, 0.2, 0.3, 0.5, 1, 2, 4, 6, 6, 4, 2, 0.5, 0.2,
]);

/**
 * Test museum, all in meters:
 *
 *   y=14 ┌──────┐   ┌──────┐   ┌──────┐   ┌──────┐
 *        │ A    │   │ B    │   │ C    │   │ D    │      rooms y ∈ [8, 14]
 *   y=8  └──┬───┘   └──┬───┘   └──┬───┘   └──┬───┘
 *           │spur      │spur      │spur      │spur      spurs x = 5,15,25,35 (width 4)
 *   y=5  ───┴──────────┴──────────┴──────────┴───       corridor spine y=5 (width 4)
 *        x=2..8      x=12..18   x=22..28   x=32..38
 *
 * Walkable space = spine capsule (y ∈ [3,7]) plus spur capsules (x ± 2, y 5..11).
 * Everything else — including most of each room beyond its spur — is wall,
 * which is exactly what the map-matching tests need.
 *
 * headingOffsetDeg = 0 so a compass heading of 0° means walking toward +Y
 * and 90° means +X; tests stay hand-computable.
 */
export function makeTestBlueprint(overrides?: Partial<FloorBlueprint>): FloorBlueprint {
  const bp: FloorBlueprint = {
    schemaVersion: 1,
    venue: {
      id: 'test-museum',
      name: 'Test Museum',
      languages: ['en', 'rw'],
      defaultLanguage: 'en',
    },
    entry: { position: { x: 5, y: 5 } },
    zones: [
      {
        id: 'zone-a',
        name: 'Entrance Hall',
        polygon: [
          { x: 2, y: 8 },
          { x: 8, y: 8 },
          { x: 8, y: 14 },
          { x: 2, y: 14 },
        ],
        audio: { en: { url: 'audio/zone-a.en.mp3' } },
        fingerprint: { ...FP_META, energies: ZONE_A_ENERGIES },
      },
      {
        id: 'zone-b',
        name: 'Royal Drum Gallery',
        polygon: [
          { x: 12, y: 8 },
          { x: 18, y: 8 },
          { x: 18, y: 14 },
          { x: 12, y: 14 },
        ],
        audio: { en: { url: 'audio/zone-b.en.mp3' } },
      },
      {
        id: 'zone-c',
        name: 'Kingdom History Room',
        polygon: [
          { x: 22, y: 8 },
          { x: 28, y: 8 },
          { x: 28, y: 14 },
          { x: 22, y: 14 },
        ],
        audio: { en: { url: 'audio/zone-c.en.mp3' } },
        fingerprint: { ...FP_META, energies: ZONE_C_ENERGIES },
      },
      {
        id: 'zone-d',
        name: 'Contemporary Art Wing',
        polygon: [
          { x: 32, y: 8 },
          { x: 38, y: 8 },
          { x: 38, y: 14 },
          { x: 32, y: 14 },
        ],
        audio: { en: { url: 'audio/zone-d.en.mp3' } },
      },
    ],
    graph: {
      nodes: [
        { id: 'spine-w', x: 5, y: 5 },
        { id: 'spine-e', x: 35, y: 5 },
        { id: 'a', x: 5, y: 11 },
        { id: 'b', x: 15, y: 11 },
        { id: 'b0', x: 15, y: 5 },
        { id: 'c', x: 25, y: 11 },
        { id: 'c0', x: 25, y: 5 },
        { id: 'd', x: 35, y: 11 },
      ],
      edges: [
        { from: 'spine-w', to: 'spine-e', widthM: 4 },
        { from: 'spine-w', to: 'a', widthM: 4 },
        { from: 'b0', to: 'b', widthM: 4 },
        { from: 'c0', to: 'c', widthM: 4 },
        { from: 'spine-e', to: 'd', widthM: 4 },
      ],
    },
    calibration: {
      headingOffsetDeg: 0,
      defaultStrideM: 0.7,
      geofence: { enterDebounceMs: 1500, exitDebounceMs: 2500, hysteresisM: 0.5 },
    },
  };
  return { ...bp, ...overrides };
}
