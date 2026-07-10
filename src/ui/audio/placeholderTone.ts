/**
 * Placeholder-tone synthesis for the audio content pipeline.
 *
 * The demo venue ships with no real narration. Rather than pretending, the
 * pipeline is proven end-to-end with short synthesized tones that are
 * ALWAYS labeled "Placeholder tone — not narration" wherever they surface.
 * Each zone gets a distinct pitch (seed steps up a pentatonic-ish interval)
 * so a walking demo is audibly checkable: "the pitch changed, the zone
 * changed."
 *
 * Pure function (no DOM/WebAudio): usable from the admin UI in the browser
 * and from the node seed script identically.
 */
export const TONE_SAMPLE_RATE = 22050;

export const PLACEHOLDER_TITLE = 'Placeholder tone — not narration';

export interface PlaceholderToneOptions {
  zoneName: string;
  language: string;
  /** Zone index; picks the pitch so zones sound distinct. */
  seed: number;
  seconds?: number;
}

export function renderPlaceholderToneWav(opts: PlaceholderToneOptions): Uint8Array {
  const seconds = opts.seconds ?? 2;
  const n = Math.round(seconds * TONE_SAMPLE_RATE);
  // Base pitch climbs a fourth per seed — well separated, none shrill.
  const f0 = 220 * Math.pow(2, (opts.seed * 5) / 12);
  const f1 = f0 * 1.5; // second note of the motif, a fifth up

  const wav = new Uint8Array(44 + n * 2);
  const view = new DataView(wav.buffer);

  // RIFF/WAVE header, 16-bit PCM mono.
  const writeAscii = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) wav[offset + i] = s.charCodeAt(i);
  };
  writeAscii(0, 'RIFF');
  view.setUint32(4, 36 + n * 2, true);
  writeAscii(8, 'WAVE');
  writeAscii(12, 'fmt ');
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, TONE_SAMPLE_RATE, true);
  view.setUint32(28, TONE_SAMPLE_RATE * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeAscii(36, 'data');
  view.setUint32(40, n * 2, true);

  // Two-note motif: f0 for the first 60%, f1 for the rest, gentle envelope.
  for (let i = 0; i < n; i++) {
    const t = i / TONE_SAMPLE_RATE;
    const progress = i / n;
    const f = progress < 0.6 ? f0 : f1;
    const attack = Math.min(1, t / 0.05);
    const release = Math.min(1, (seconds - t) / 0.2);
    // Slight second harmonic keeps it from sounding like a test beep.
    const sample =
      0.28 * attack * release * (Math.sin(2 * Math.PI * f * t) + 0.3 * Math.sin(4 * Math.PI * f * t));
    view.setInt16(44 + i * 2, Math.round(Math.max(-1, Math.min(1, sample)) * 32767), true);
  }
  return wav;
}

/** Canonical placeholder filename for a zone/language slot. */
export function placeholderFilename(zoneId: string, language: string): string {
  return `${zoneId}.${language}.wav`;
}
