import { describe, expect, it } from 'vitest';
import { StepDetector } from '../src/engine/stepDetector';
import type { MotionSample } from '../src/engine/types';
import { lcg } from './helpers';

/** Synthesize accelerometer magnitude for walking: gravity + sinusoid at the step cadence. */
function walkSamples(opts: {
  seconds: number;
  cadenceHz: number;
  amplitude: number;
  sampleRateHz?: number;
  startMs?: number;
  noise?: number;
  seed?: number;
}): MotionSample[] {
  const sr = opts.sampleRateHz ?? 50;
  const rand = lcg(opts.seed ?? 1);
  const out: MotionSample[] = [];
  const n = Math.round(opts.seconds * sr);
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const noise = (opts.noise ?? 0) * (2 * rand() - 1);
    out.push({
      tMs: (opts.startMs ?? 0) + Math.round(t * 1000),
      ax: 0,
      ay: 0,
      az: 9.81 + opts.amplitude * Math.sin(2 * Math.PI * opts.cadenceHz * t) + noise,
    });
  }
  return out;
}

function countSteps(detector: StepDetector, samples: MotionSample[]): number {
  let steps = 0;
  for (const s of samples) if (detector.onSample(s)) steps++;
  return steps;
}

describe('StepDetector', () => {
  it('detects ~18 steps in 10 s of 1.8 Hz walking', () => {
    const steps = countSteps(new StepDetector(), walkSamples({ seconds: 10, cadenceHz: 1.8, amplitude: 2 }));
    expect(steps).toBeGreaterThanOrEqual(16);
    expect(steps).toBeLessThanOrEqual(20);
  });

  it('detects zero steps while standing still (sensor noise only)', () => {
    const steps = countSteps(
      new StepDetector(),
      walkSamples({ seconds: 10, cadenceHz: 1.8, amplitude: 0, noise: 0.05 }),
    );
    expect(steps).toBe(0);
  });

  it('adapts across soft and hard walkers in one session', () => {
    const detector = new StepDetector();
    const soft = walkSamples({ seconds: 5, cadenceHz: 1.8, amplitude: 1.2 });
    const hard = walkSamples({ seconds: 5, cadenceHz: 2.2, amplitude: 3.5, startMs: 5000 });
    const total = countSteps(detector, soft) + countSteps(detector, hard);
    // ~9 soft steps + ~11 hard steps; adaptive threshold must catch both regimes.
    expect(total).toBeGreaterThanOrEqual(16);
    expect(total).toBeLessThanOrEqual(23);
  });

  it('refractory period prevents double-counting jittery peaks', () => {
    // 6 Hz vibration (phone rattling in hand) is above any human cadence:
    // the 300 ms refractory limits acceptance to < 3.4 "steps"/second.
    const steps = countSteps(
      new StepDetector(),
      walkSamples({ seconds: 5, cadenceHz: 6, amplitude: 2 }),
    );
    expect(steps).toBeLessThanOrEqual(17); // ~30 vibration peaks, but at most 1 per 300 ms
  });
});
