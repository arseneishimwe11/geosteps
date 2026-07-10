import { describe, expect, it } from 'vitest';
import { renderPlaceholderToneWav, TONE_SAMPLE_RATE } from '../src/ui/audio/placeholderTone';

function ascii(bytes: Uint8Array, start: number, len: number): string {
  return String.fromCharCode(...bytes.slice(start, start + len));
}

describe('renderPlaceholderToneWav', () => {
  it('produces a well-formed 16-bit mono RIFF/WAVE file of the requested length', () => {
    const seconds = 2;
    const wav = renderPlaceholderToneWav({ zoneName: 'Royal Drum Gallery', language: 'en', seed: 1, seconds });
    expect(ascii(wav, 0, 4)).toBe('RIFF');
    expect(ascii(wav, 8, 4)).toBe('WAVE');
    expect(ascii(wav, 12, 4)).toBe('fmt ');
    expect(ascii(wav, 36, 4)).toBe('data');
    expect(wav.length).toBe(44 + seconds * TONE_SAMPLE_RATE * 2);

    const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);
    expect(view.getUint32(4, true)).toBe(wav.length - 8); // RIFF chunk size
    expect(view.getUint16(22, true)).toBe(1); // mono
    expect(view.getUint32(24, true)).toBe(TONE_SAMPLE_RATE);
    expect(view.getUint16(34, true)).toBe(16); // bits per sample
    expect(view.getUint32(40, true)).toBe(seconds * TONE_SAMPLE_RATE * 2); // data size
  });

  it('is audibly non-silent', () => {
    const wav = renderPlaceholderToneWav({ zoneName: 'Entrance Hall', language: 'rw', seed: 0 });
    const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);
    let sumSq = 0;
    const n = (wav.length - 44) / 2;
    for (let i = 0; i < n; i++) sumSq += (view.getInt16(44 + i * 2, true) / 32768) ** 2;
    expect(Math.sqrt(sumSq / n)).toBeGreaterThan(0.05);
  });

  it('different seeds produce audibly different tones', () => {
    const a = renderPlaceholderToneWav({ zoneName: 'A', language: 'en', seed: 0, seconds: 1 });
    const b = renderPlaceholderToneWav({ zoneName: 'B', language: 'en', seed: 3, seconds: 1 });
    let diff = 0;
    for (let i = 44; i < a.length; i += 500) diff += Math.abs(a[i]! - b[i]!);
    expect(diff).toBeGreaterThan(0);
  });
});
