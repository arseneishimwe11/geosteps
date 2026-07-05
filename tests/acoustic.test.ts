import { describe, expect, it } from 'vitest';
import {
  computeFingerprint,
  cosineSimilarity,
  matchFingerprint,
} from '../src/engine/acoustic/fingerprint';
import { PositionEngine } from '../src/engine/positionEngine';
import type { AcousticFingerprint } from '../src/engine/types';
import { FP_META, makeTestBlueprint, normalizedEnergies, ZONE_C_ENERGIES } from './fixtures';
import { bandNoise, lcg, mix, recordZoneEvents, Sim, sineTone, whiteNoise } from './helpers';

const SR = 16000;

describe('computeFingerprint', () => {
  it('concentrates a pure tone into the right log band', () => {
    const fp = computeFingerprint(sineTone(1000, 1.0, SR), SR, { maxHz: 7200 });
    // Log-spaced band edges for [100, 7200] / 16 bands put 1 kHz in band 8.
    const argmax = fp.energies.indexOf(Math.max(...fp.energies));
    expect(argmax).toBe(8);
    expect(fp.energies.reduce((s, e) => s + e, 0)).toBeCloseTo(1, 6);
  });
});

describe('matchFingerprint against recorded zone references', () => {
  // "Calibration day": two rooms with different ambient spectra.
  const refLow = computeFingerprint(bandNoise(150, 400, 2.0, SR, 1, 1), SR, { maxHz: 7200 });
  const refMid = computeFingerprint(bandNoise(700, 1800, 2.0, SR, 2, 2), SR, { maxHz: 7200 });
  const references = [
    { zoneId: 'zone-low', fingerprint: refLow },
    { zoneId: 'zone-mid', fingerprint: refMid },
  ];

  it('matches a noisy later sample of a known room to that room', () => {
    // Same room tone (same sinusoid set as refLow), captured at a different
    // moment (new phases) with visitors shuffling around (added white noise).
    const sample = computeFingerprint(
      mix(bandNoise(150, 400, 2.0, SR, 1, 99), whiteNoise(0.02, 2.0, SR, 4)),
      SR,
      { maxHz: 7200 },
    );
    const match = matchFingerprint(sample, references);
    expect(match).not.toBeNull();
    expect(match!.zoneId).toBe('zone-low');
    expect(match!.confidence).toBeGreaterThan(0.9);
    expect(match!.margin).toBeGreaterThan(0.08);
  });

  it('rejects a sample resembling no stored fingerprint (no false-positive snap)', () => {
    const unrelated = computeFingerprint(whiteNoise(0.5, 2.0, SR, 7), SR, { maxHz: 7200 });
    expect(matchFingerprint(unrelated, references)).toBeNull();
  });

  it('rejects broadband noise even against a broadband-ish high-band reference (the reason minConfidence is 0.90)', () => {
    // Cosine similarity between band-energy distributions is permissive for
    // broadband sounds: white noise scores ≈0.86 against a high-band
    // reference. The 0.90 default gate must still reject it.
    const refHigh = computeFingerprint(bandNoise(2000, 6000, 2.0, SR, 3, 3), SR, { maxHz: 7200 });
    const unrelated = computeFingerprint(whiteNoise(0.5, 2.0, SR, 7), SR, { maxHz: 7200 });
    const sim = cosineSimilarity(unrelated.energies, refHigh.energies);
    expect(sim).toBeLessThan(0.9); // if this creeps up, the default gate must move with it
    expect(
      matchFingerprint(unrelated, [
        { zoneId: 'zone-low', fingerprint: refLow },
        { zoneId: 'zone-high', fingerprint: refHigh },
      ]),
    ).toBeNull();
  });

  it('refuses to guess between two near-identical rooms (margin gate)', () => {
    const rand = lcg(42);
    const base = ZONE_C_ENERGIES;
    const perturb = (amount: number) =>
      normalizedEnergies(base.map((e) => e * (1 + amount * (2 * rand() - 1))));
    const twinA: AcousticFingerprint = { ...FP_META, energies: perturb(0.02) };
    const twinB: AcousticFingerprint = { ...FP_META, energies: perturb(0.02) };
    const sample: AcousticFingerprint = { ...FP_META, energies: perturb(0.02) };

    // Both twins score far above minConfidence...
    expect(cosineSimilarity(sample.energies, twinA.energies)).toBeGreaterThan(0.99);
    expect(cosineSimilarity(sample.energies, twinB.energies)).toBeGreaterThan(0.99);
    // ...so only the margin gate stands between us and a coin-flip snap.
    expect(
      matchFingerprint(sample, [
        { zoneId: 'twin-a', fingerprint: twinA },
        { zoneId: 'twin-b', fingerprint: twinB },
      ]),
    ).toBeNull();
  });

  it('ignores references computed with incompatible band settings instead of comparing junk', () => {
    const sample: AcousticFingerprint = { ...FP_META, energies: ZONE_C_ENERGIES };
    const incompatible: AcousticFingerprint = {
      ...FP_META,
      bandCount: 8,
      energies: normalizedEnergies([1, 1, 1, 1, 1, 1, 1, 1]),
    };
    expect(matchFingerprint(sample, [{ zoneId: 'z', fingerprint: incompatible }])).toBeNull();
  });
});

describe('acoustic re-anchoring inside the position engine', () => {
  it('a confident match against a distant zone snaps the estimate to that zone (room-level)', () => {
    const bp = makeTestBlueprint();
    const engine = new PositionEngine(bp, { headingSmoothingAlpha: 1 });
    const events = recordZoneEvents(engine);
    const sim = new Sim(engine);

    // Dead reckoning has the visitor mid-corridor near zone B's spur...
    sim.walk(90, 14); // (14.8, 5)
    expect(engine.getState().position.x).toBeCloseTo(14.8, 6);

    // ...but the ambient sample clearly matches zone C's stored fingerprint
    // (in reality: DR drifted badly, or the visitor jogged / took stairs).
    const rand = lcg(9);
    const sample: AcousticFingerprint = {
      ...FP_META,
      energies: normalizedEnergies(ZONE_C_ENERGIES.map((e) => e * (1 + 0.05 * (2 * rand() - 1)))),
    };
    const match = engine.handleAcousticSample(sample, sim.t + 100);

    expect(match).not.toBeNull();
    expect(match!.zoneId).toBe('zone-c');

    const state = engine.getState();
    expect(state.source).toBe('acoustic-snap');
    // Zone C centroid (25, 11), map-matched — that point is on C's spur.
    expect(state.position.x).toBeCloseTo(25, 6);
    expect(state.position.y).toBeCloseTo(11, 6);
    // Room-level honesty: uncertainty is set to the snap radius, not to zero.
    expect(state.uncertaintyM).toBe(3);

    // The geofence then enters zone C through the normal debounced path.
    sim.dwell(3000);
    expect(events.map((e) => `${e.type}:${e.zoneId}`)).toContain('enter:zone-c');
  });

  it('a match agreeing with the current estimate only tightens uncertainty (no teleport)', () => {
    const bp = makeTestBlueprint({ entry: { position: { x: 25, y: 11 } } }); // already in zone C
    const engine = new PositionEngine(bp, {
      headingSmoothingAlpha: 1,
      initialUncertaintyM: 8,
    });
    const sample: AcousticFingerprint = { ...FP_META, energies: ZONE_C_ENERGIES };
    const before = engine.getState().position;

    const match = engine.handleAcousticSample(sample, 1000);
    expect(match!.zoneId).toBe('zone-c');
    const after = engine.getState();
    expect(after.position).toEqual(before);
    expect(after.uncertaintyM).toBe(3);
  });

  it('an unconfident sample changes nothing at all', () => {
    const bp = makeTestBlueprint();
    const engine = new PositionEngine(bp, { headingSmoothingAlpha: 1 });
    const sim = new Sim(engine);
    sim.walk(90, 14);
    const before = engine.getState();

    const flat: AcousticFingerprint = {
      ...FP_META,
      energies: normalizedEnergies(new Array(16).fill(1)),
    };
    expect(engine.handleAcousticSample(flat, sim.t + 100)).toBeNull();
    const after = engine.getState();
    expect(after.position).toEqual(before.position);
    expect(after.uncertaintyM).toBe(before.uncertaintyM);
    expect(after.source).toBe(before.source);
  });
});
