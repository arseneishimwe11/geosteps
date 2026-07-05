import { describe, expect, it } from 'vitest';
import {
  computeFingerprint,
  cosineSimilarity,
  matchFingerprint,
} from '../src/engine/acoustic/fingerprint';
import { PositionEngine } from '../src/engine/positionEngine';
import type { AcousticFingerprint, AcousticSampleAudit } from '../src/engine/types';
import { FP_META, makeTestBlueprint, normalizedEnergies, ZONE_A_ENERGIES, ZONE_C_ENERGIES } from './fixtures';
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

describe('acoustic correction inside the position engine (corrector, never a locator)', () => {
  /** A slightly noisy re-recording of zone C's stored ambience. */
  function zoneCSample(seed: number): AcousticFingerprint {
    const rand = lcg(seed);
    return {
      ...FP_META,
      energies: normalizedEnergies(ZONE_C_ENERGIES.map((e) => e * (1 + 0.05 * (2 * rand() - 1)))),
    };
  }

  it('a single anomalous sample NEVER moves the position; three consecutive agreeing samples re-anchor', () => {
    const bp = makeTestBlueprint();
    const engine = new PositionEngine(bp, { headingSmoothingAlpha: 1 });
    const events = recordZoneEvents(engine);
    const audits: AcousticSampleAudit[] = [];
    engine.onAcousticAudit((a) => audits.push(a));
    const sim = new Sim(engine);

    // Dead reckoning has the visitor mid-corridor near zone B's spur...
    sim.walk(90, 14); // (14.8, 5), t = 7000
    expect(engine.getState().position.x).toBeCloseTo(14.8, 6);

    // ...but ambient samples keep matching zone C's stored fingerprint
    // (in reality: DR drifted badly, or the visitor jogged / took stairs).
    // Samples ~15 s apart, the realistic runtime cadence.
    const a1 = engine.handleAcousticSample(zoneCSample(9), 8000);
    expect(a1.match?.zoneId).toBe('zone-c');
    expect(a1.action).toBe('streak-building');
    expect(a1.streak).toBe(1);
    expect(a1.positionAfter).toEqual(a1.positionBefore); // the anomaly did NOT move anything
    expect(engine.getState().position.x).toBeCloseTo(14.8, 6);
    expect(engine.getState().source).toBe('dead-reckoning');

    const a2 = engine.handleAcousticSample(zoneCSample(10), 23000);
    expect(a2.action).toBe('streak-building');
    expect(a2.streak).toBe(2);
    expect(engine.getState().position.x).toBeCloseTo(14.8, 6); // still not moved

    const a3 = engine.handleAcousticSample(zoneCSample(11), 38000);
    expect(a3.action).toBe('reanchored');
    expect(a3.streak).toBe(3);

    const state = engine.getState();
    expect(state.source).toBe('acoustic-snap');
    // Zone C centroid (25, 11), map-matched — that point is on C's spur.
    expect(state.position.x).toBeCloseTo(25, 6);
    expect(state.position.y).toBeCloseTo(11, 6);
    // Room-level honesty: uncertainty is set to the snap radius, not to zero.
    expect(state.uncertaintyM).toBe(3);

    // Geometric gate visible in the audit trail: only plausible zones were
    // ever considered (zone-c is ~7.8 m away with ~10.2 m radius — in range).
    expect(a1.candidateZoneIds).toEqual(['zone-a', 'zone-c']);
    expect(a1.candidateRadiusM).toBeGreaterThan(7.8);
    expect(a1.candidateRadiusM).toBeLessThan(12);

    // The geofence then enters zone C through the normal debounced path.
    sim.t = 38000;
    sim.dwell(3000);
    expect(events.map((e) => `${e.type}:${e.zoneId}`)).toContain('enter:zone-c');
  });

  it('a conflicting sample breaks the streak — agreement must be consecutive', () => {
    const bp = makeTestBlueprint();
    const engine = new PositionEngine(bp, { headingSmoothingAlpha: 1 });
    const sim = new Sim(engine);
    sim.walk(90, 14); // (14.8, 5)
    const flat: AcousticFingerprint = {
      ...FP_META,
      energies: normalizedEnergies(new Array(16).fill(1)),
    };

    expect(engine.handleAcousticSample(zoneCSample(1), 8000).streak).toBe(1);
    const broken = engine.handleAcousticSample(flat, 9000); // unknown sound in between
    expect(broken.action).toBe('none');
    expect(broken.streak).toBe(0);
    expect(engine.handleAcousticSample(zoneCSample(2), 10000).streak).toBe(1); // starts over
    expect(engine.handleAcousticSample(zoneCSample(3), 11000).streak).toBe(2);
    expect(engine.getState().position.x).toBeCloseTo(14.8, 6); // still nothing moved
    const applied = engine.handleAcousticSample(zoneCSample(4), 12000);
    expect(applied.action).toBe('reanchored'); // only after 3 CONSECUTIVE agreements
  });

  it('samples too far apart in time do not count as consecutive', () => {
    const bp = makeTestBlueprint();
    const engine = new PositionEngine(bp, { headingSmoothingAlpha: 1 });
    const sim = new Sim(engine);
    sim.walk(90, 14);

    expect(engine.handleAcousticSample(zoneCSample(5), 8000).streak).toBe(1);
    // 61 s later (> maxStreakGapMs of 60 s): the streak restarts at 1.
    const late = engine.handleAcousticSample(zoneCSample(6), 69001);
    expect(late.streak).toBe(1);
    expect(late.action).toBe('streak-building');
  });

  it('two zones with near-identical fingerprints in range: no correction, ever — no guessing', () => {
    const bp = makeTestBlueprint();
    const rand = lcg(42);
    const perturb = () =>
      normalizedEnergies(ZONE_C_ENERGIES.map((e) => e * (1 + 0.02 * (2 * rand() - 1))));
    // Zones B and C become acoustic near-twins (two galleries, same HVAC loop).
    bp.zones.find((z) => z.id === 'zone-b')!.fingerprint = { ...FP_META, energies: perturb() };
    // zone-c keeps ZONE_C_ENERGIES.

    const engine = new PositionEngine(bp, { headingSmoothingAlpha: 1 });
    const audits: AcousticSampleAudit[] = [];
    engine.onAcousticAudit((a) => audits.push(a));
    const sim = new Sim(engine);
    sim.walk(90, 15); // (15.5, 5): both twins are inside the candidate radius
    const before = engine.getState();

    for (let i = 0; i < 5; i++) {
      engine.handleAcousticSample({ ...FP_META, energies: perturb() }, sim.t + 1000 * (i + 1));
    }

    expect(audits).toHaveLength(5);
    for (const a of audits) {
      expect(a.candidateZoneIds).toContain('zone-b');
      expect(a.candidateZoneIds).toContain('zone-c');
      expect(a.match).toBeNull(); // margin gate: refuses to pick between twins
      expect(a.action).toBe('none');
      expect(a.marginToRunnerUp).not.toBeNull();
      expect(a.marginToRunnerUp!).toBeLessThan(0.08); // the ambiguity the gate saw
      expect(a.positionAfter).toEqual(a.positionBefore);
    }
    const after = engine.getState();
    expect(after.position).toEqual(before.position);
    expect(after.uncertaintyM).toBe(before.uncertaintyM); // DR stays in charge
  });

  it('geometric gate: an identical-sounding zone across the building is never even considered', () => {
    const bp = makeTestBlueprint();
    // Zone D (far away) sounds EXACTLY like zone A. Searching the full
    // blueprint would deadlock on the twins forever; the geometric gate
    // excludes D outright and lets the plausible zone confirm.
    bp.zones.find((z) => z.id === 'zone-d')!.fingerprint = { ...FP_META, energies: ZONE_A_ENERGIES };

    const engine = new PositionEngine(bp, { headingSmoothingAlpha: 1 });
    const audits: AcousticSampleAudit[] = [];
    engine.onAcousticAudit((a) => audits.push(a));
    const sim = new Sim(engine);
    sim.walk(0, 6); // (5, 9.2), inside zone A; uncertainty ≈ 1.48 → radius ≈ 9
    const before = engine.getState();

    const sample: AcousticFingerprint = { ...FP_META, energies: ZONE_A_ENERGIES };
    engine.handleAcousticSample(sample, sim.t + 1000);
    engine.handleAcousticSample(sample, sim.t + 2000);
    const third = engine.handleAcousticSample(sample, sim.t + 3000);

    for (const a of audits) {
      expect(a.candidateZoneIds).toEqual(['zone-a']); // D never considered
    }
    expect(third.action).toBe('confirmed-in-place');
    expect(engine.getState().position).toEqual(before.position); // confirmation, not teleport
    expect(engine.getState().uncertaintyM).toBeLessThanOrEqual(before.uncertaintyM);
  });

  it('a confirming match tightens uncertainty only after the full streak — never from one sample', () => {
    const bp = makeTestBlueprint({ entry: { position: { x: 25, y: 11 } } }); // already in zone C
    const engine = new PositionEngine(bp, { headingSmoothingAlpha: 1, initialUncertaintyM: 8 });
    const before = engine.getState().position;

    const s1 = engine.handleAcousticSample(zoneCSample(20), 1000);
    expect(s1.match?.zoneId).toBe('zone-c');
    expect(s1.action).toBe('streak-building');
    expect(engine.getState().uncertaintyM).toBe(8); // untouched by a single sample

    const s2 = engine.handleAcousticSample(zoneCSample(21), 2000);
    expect(s2.action).toBe('streak-building');
    expect(engine.getState().uncertaintyM).toBe(8);

    const s3 = engine.handleAcousticSample(zoneCSample(22), 3000);
    expect(s3.action).toBe('confirmed-in-place');
    expect(engine.getState().uncertaintyM).toBe(3);
    expect(engine.getState().position).toEqual(before); // no teleport
  });

  it('an unconfident sample changes nothing and says so in the audit', () => {
    const bp = makeTestBlueprint();
    const engine = new PositionEngine(bp, { headingSmoothingAlpha: 1 });
    const sim = new Sim(engine);
    sim.walk(90, 14);
    const before = engine.getState();

    const flat: AcousticFingerprint = {
      ...FP_META,
      energies: normalizedEnergies(new Array(16).fill(1)),
    };
    const audit = engine.handleAcousticSample(flat, sim.t + 100);
    expect(audit.match).toBeNull();
    expect(audit.action).toBe('none');
    expect(audit.streak).toBe(0);
    const after = engine.getState();
    expect(after.position).toEqual(before.position);
    expect(after.uncertaintyM).toBe(before.uncertaintyM);
    expect(after.source).toBe(before.source);
  });
});
