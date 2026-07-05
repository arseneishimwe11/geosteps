import type { AudioBackend, AudioTrackHandle } from '../src/engine/audio/audioDirector';
import type { PositionEngine } from '../src/engine/positionEngine';
import type { ZoneEvent } from '../src/engine/types';

/**
 * Drives a PositionEngine through a scripted walk on a virtual clock.
 * One step every stepMs; dwell() advances the clock with geofence ticks the
 * way the real runtime's periodic tick timer does.
 */
export class Sim {
  t = 0;
  constructor(readonly engine: PositionEngine) {}

  walk(compassDeg: number, steps: number, stepMs = 500): void {
    for (let i = 0; i < steps; i++) {
      this.t += stepMs;
      this.engine.handleHeading(compassDeg, this.t);
      this.engine.stepOnce(this.t);
    }
  }

  dwell(ms: number, tickMs = 500): void {
    const end = this.t + ms;
    while (this.t < end) {
      this.t += tickMs;
      this.engine.tick(this.t);
    }
  }
}

export function recordZoneEvents(engine: PositionEngine): ZoneEvent[] {
  const events: ZoneEvent[] = [];
  engine.onZoneEvent((e) => events.push(e));
  return events;
}

export function eventSummary(events: ZoneEvent[]): string[] {
  return events.map((e) => `${e.type}:${e.zoneId}`);
}

// ---------------------------------------------------------------------------
// Deterministic signal generation for the acoustic tests
// ---------------------------------------------------------------------------

/** Small deterministic PRNG (LCG) so acoustic tests never flake. */
export function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

/**
 * Band-limited "room tone": a fixed set of sinusoids with frequencies drawn
 * (deterministically, from freqSeed) inside [loHz, hiHz]. Re-rendering with a
 * different phaseSeed models "the same room at a different moment" — same
 * long-term spectrum, different waveform.
 */
export function bandNoise(
  loHz: number,
  hiHz: number,
  seconds: number,
  sampleRateHz: number,
  freqSeed: number,
  phaseSeed: number,
  nSinusoids = 32,
): Float32Array {
  const freqRand = lcg(freqSeed);
  const phaseRand = lcg(phaseSeed);
  const freqs: number[] = [];
  const phases: number[] = [];
  for (let i = 0; i < nSinusoids; i++) {
    freqs.push(loHz + (hiHz - loHz) * freqRand());
    phases.push(2 * Math.PI * phaseRand());
  }
  const n = Math.round(seconds * sampleRateHz);
  const out = new Float32Array(n);
  const amp = 1 / nSinusoids;
  for (let i = 0; i < n; i++) {
    const t = i / sampleRateHz;
    let v = 0;
    for (let k = 0; k < nSinusoids; k++) {
      v += amp * Math.sin(2 * Math.PI * freqs[k]! * t + phases[k]!);
    }
    out[i] = v;
  }
  return out;
}

export function whiteNoise(amplitude: number, seconds: number, sampleRateHz: number, seed: number): Float32Array {
  const rand = lcg(seed);
  const n = Math.round(seconds * sampleRateHz);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = amplitude * (2 * rand() - 1);
  return out;
}

export function mix(a: Float32Array, b: Float32Array): Float32Array {
  const n = Math.min(a.length, b.length);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = a[i]! + b[i]!;
  return out;
}

export function sineTone(hz: number, seconds: number, sampleRateHz: number, amplitude = 0.5): Float32Array {
  const n = Math.round(seconds * sampleRateHz);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = amplitude * Math.sin((2 * Math.PI * hz * i) / sampleRateHz);
  return out;
}

// ---------------------------------------------------------------------------
// Fake audio backend for AudioDirector tests
// ---------------------------------------------------------------------------

export class FakeTrack implements AudioTrackHandle {
  fadeIns: number[] = [];
  fadeOuts: number[] = [];
  stopped = false;
  private endedCbs: (() => void)[] = [];

  constructor(readonly url: string) {}

  fadeIn(ms: number): void {
    this.fadeIns.push(ms);
  }
  fadeOut(ms: number): void {
    this.fadeOuts.push(ms);
  }
  stop(): void {
    this.stopped = true;
  }
  onEnded(cb: () => void): void {
    this.endedCbs.push(cb);
  }
  simulateEnded(): void {
    this.endedCbs.forEach((cb) => cb());
  }
}

export class FakeAudioBackend implements AudioBackend {
  tracks: FakeTrack[] = [];
  createTrack(url: string): FakeTrack {
    const t = new FakeTrack(url);
    this.tracks.push(t);
    return t;
  }
}
