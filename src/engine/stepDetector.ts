import type { MotionSample, StepDetectorConfig, StepEvent } from './types';

export const DEFAULT_STEP_DETECTOR_CONFIG: StepDetectorConfig = {
  minStepIntervalMs: 300,
  gravityTimeConstantSec: 0.8,
  rmsTimeConstantSec: 2.0,
  thresholdFloorMs2: 0.8,
  thresholdGain: 1.0,
};

/**
 * Streaming step detector: peak detection on the high-passed accelerometer
 * magnitude with an adaptive threshold.
 *
 * Pipeline per sample:
 *  1. magnitude m = |(ax, ay, az)| — orientation-independent, so it doesn't
 *     matter exactly how the visitor holds the phone.
 *  2. gravity is tracked as a slow EMA of m and subtracted (high-pass), so
 *     the detector sees only the walking oscillation.
 *  3. an EMA of the squared high-passed signal gives a running RMS; the peak
 *     threshold is max(thresholdFloorMs2, thresholdGain * rms). Soft walkers
 *     and heavy walkers both land near threshold ≈ their own amplitude, while
 *     the floor keeps sensor noise at rest from ever counting as steps.
 *  4. a sample is a step if it is a local maximum above threshold and at
 *     least minStepIntervalMs after the previous step (refractory period —
 *     nobody walks faster than ~3.3 steps/second).
 */
export class StepDetector {
  private readonly cfg: StepDetectorConfig;
  private gravity = NaN;
  private meanSquare = 0;
  private prevT = NaN;
  // last two high-passed samples (s1 = most recent)
  private s1 = 0;
  private s1T = NaN;
  private s2 = 0;
  private lastStepT = -Infinity;

  constructor(cfg?: Partial<StepDetectorConfig>) {
    this.cfg = { ...DEFAULT_STEP_DETECTOR_CONFIG, ...cfg };
  }

  /** Feed one accelerometer sample; returns a StepEvent when a step is confirmed. */
  onSample(sample: MotionSample): StepEvent | null {
    const m = Math.hypot(sample.ax, sample.ay, sample.az);
    if (Number.isNaN(this.prevT)) {
      this.gravity = m;
      this.prevT = sample.tMs;
      this.s1 = 0;
      this.s1T = sample.tMs;
      this.s2 = 0;
      return null;
    }

    const dtSec = Math.max(1, sample.tMs - this.prevT) / 1000;
    this.prevT = sample.tMs;

    const aG = 1 - Math.exp(-dtSec / this.cfg.gravityTimeConstantSec);
    this.gravity += aG * (m - this.gravity);
    const hp = m - this.gravity;

    const aR = 1 - Math.exp(-dtSec / this.cfg.rmsTimeConstantSec);
    this.meanSquare += aR * (hp * hp - this.meanSquare);
    const threshold = Math.max(
      this.cfg.thresholdFloorMs2,
      this.cfg.thresholdGain * Math.sqrt(this.meanSquare),
    );

    // Is the *previous* sample a confirmed local peak?
    let step: StepEvent | null = null;
    if (
      this.s1 > threshold &&
      this.s1 >= this.s2 &&
      this.s1 > hp &&
      this.s1T - this.lastStepT >= this.cfg.minStepIntervalMs
    ) {
      this.lastStepT = this.s1T;
      step = { tMs: this.s1T, magnitude: this.s1 };
    }

    this.s2 = this.s1;
    this.s1 = hp;
    this.s1T = sample.tMs;
    return step;
  }
}
