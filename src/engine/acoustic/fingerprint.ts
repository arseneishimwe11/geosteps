import type { AcousticFingerprint, AcousticMatch, AcousticMatchConfig } from '../types';
import { fftRadix2, hannWindow } from './fft';

/**
 * Default gates. minConfidence is 0.90, not lower, for a measured reason:
 * cosine similarity between band-energy distributions is permissive for
 * broadband sounds — a white-noise-like sample (crowd murmur, rain on the
 * roof) scores ~0.86 against a stored high-band-weighted reference despite
 * being a different signal. 0.90 sits above that failure mode while genuine
 * same-room samples land at 0.95+.
 */
export const DEFAULT_ACOUSTIC_MATCH_CONFIG: AcousticMatchConfig = {
  minConfidence: 0.9,
  minMargin: 0.08,
};

export interface FingerprintOptions {
  fftSize: number; // power of two
  bandCount: number;
  minHz: number;
  maxHz?: number; // defaults to min(7200, 0.45 * sampleRate)
}

export const DEFAULT_FINGERPRINT_OPTIONS: Omit<FingerprintOptions, 'maxHz'> = {
  fftSize: 2048,
  bandCount: 16,
  minHz: 100,
};

/**
 * Compute a zone's acoustic fingerprint from a mono PCM clip.
 *
 * Method ("band-energy-v1"): Hann-windowed frames (50% hop) -> power spectrum
 * -> energy accumulated into bandCount log-spaced frequency bands between
 * minHz and maxHz -> averaged over all frames -> normalized to a probability
 * distribution (sums to 1).
 *
 * Normalizing to a distribution makes the fingerprint insensitive to overall
 * loudness and microphone gain — what remains is the *shape* of the room's
 * ambient spectrum (HVAC hum, ventilation, street bleed, reverberant
 * coloration). That shape is what distinguishes rooms; see ARCHITECTURE.md
 * for what it can and cannot do.
 */
export function computeFingerprint(
  pcm: Float32Array,
  sampleRateHz: number,
  opts?: Partial<FingerprintOptions>,
): AcousticFingerprint {
  const fftSize = opts?.fftSize ?? DEFAULT_FINGERPRINT_OPTIONS.fftSize;
  const bandCount = opts?.bandCount ?? DEFAULT_FINGERPRINT_OPTIONS.bandCount;
  const minHz = opts?.minHz ?? DEFAULT_FINGERPRINT_OPTIONS.minHz;
  const maxHz = opts?.maxHz ?? Math.min(7200, 0.45 * sampleRateHz);
  if (pcm.length < fftSize) {
    throw new Error(`Clip too short: ${pcm.length} samples < fftSize ${fftSize}`);
  }
  if (maxHz <= minHz) throw new Error('maxHz must exceed minHz');

  const hop = fftSize / 2;
  const window = hannWindow(fftSize);
  const re = new Float64Array(fftSize);
  const im = new Float64Array(fftSize);
  const binHz = sampleRateHz / fftSize;

  // Log-spaced band edges (bandCount + 1 of them) between minHz and maxHz.
  const edges: number[] = [];
  const ratio = Math.pow(maxHz / minHz, 1 / bandCount);
  for (let i = 0; i <= bandCount; i++) edges.push(minHz * Math.pow(ratio, i));

  const bandEnergy = new Float64Array(bandCount);
  let frames = 0;
  for (let start = 0; start + fftSize <= pcm.length; start += hop) {
    for (let i = 0; i < fftSize; i++) {
      re[i] = pcm[start + i]! * window[i]!;
      im[i] = 0;
    }
    fftRadix2(re, im);
    for (let bin = 1; bin < fftSize / 2; bin++) {
      const f = bin * binHz;
      if (f < minHz || f >= maxHz) continue;
      // Which log band does this bin fall in?
      const band = Math.min(bandCount - 1, Math.floor(Math.log(f / minHz) / Math.log(ratio)));
      bandEnergy[band] = bandEnergy[band]! + re[bin]! * re[bin]! + im[bin]! * im[bin]!;
    }
    frames++;
  }

  let total = 0;
  for (let i = 0; i < bandCount; i++) total += bandEnergy[i]!;
  const energies =
    total > 0
      ? Array.from(bandEnergy, (e) => e / total)
      : Array.from(bandEnergy, () => 1 / bandCount); // dead-silent clip: flat, will match nothing confidently

  return {
    version: 1,
    method: 'band-energy-v1',
    sampleRateHz,
    fftSize,
    bandCount,
    bandsHz: [minHz, maxHz],
    energies,
    captureSeconds: pcm.length / sampleRateHz,
  };
}

export function cosineSimilarity(a: readonly number[], b: readonly number[]): number {
  if (a.length !== b.length) throw new Error('cosineSimilarity: length mismatch');
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function compatible(a: AcousticFingerprint, b: AcousticFingerprint): boolean {
  return (
    a.method === b.method &&
    a.bandCount === b.bandCount &&
    a.bandsHz[0] === b.bandsHz[0] &&
    a.bandsHz[1] === b.bandsHz[1]
  );
}

/**
 * Match a runtime ambient sample against the stored per-zone fingerprints.
 *
 * Returns null — deliberately, and often — unless BOTH gates pass:
 *  - confidence gate: cosine similarity to the best reference >= minConfidence.
 *    A sample that resembles no stored room produces mid/low similarity across
 *    the board and is rejected (no false-positive snap).
 *  - margin gate: the best reference must beat the runner-up by >= minMargin.
 *    Two acoustically similar rooms (e.g. two quiet galleries on the same HVAC
 *    loop) will both score high — the margin gate refuses to guess between
 *    them, and dead reckoning simply carries on uncorrected.
 *
 * A null result costs nothing (the engine keeps its current estimate); a wrong
 * snap teleports the visitor's narration to the wrong room. The thresholds are
 * therefore biased hard toward rejection.
 */
export function matchFingerprint(
  sample: AcousticFingerprint,
  references: readonly { zoneId: string; fingerprint: AcousticFingerprint }[],
  cfg?: Partial<AcousticMatchConfig>,
): AcousticMatch | null {
  const { minConfidence, minMargin } = { ...DEFAULT_ACOUSTIC_MATCH_CONFIG, ...cfg };
  const usable = references.filter((r) => compatible(sample, r.fingerprint));
  if (usable.length === 0) return null;

  const scored = usable
    .map((r) => ({ zoneId: r.zoneId, sim: cosineSimilarity(sample.energies, r.fingerprint.energies) }))
    .sort((a, b) => b.sim - a.sim);

  const best = scored[0]!;
  if (best.sim < minConfidence) return null;
  const margin = scored.length > 1 ? best.sim - scored[1]!.sim : best.sim;
  if (scored.length > 1 && margin < minMargin) return null;

  return { zoneId: best.zoneId, confidence: best.sim, margin };
}
