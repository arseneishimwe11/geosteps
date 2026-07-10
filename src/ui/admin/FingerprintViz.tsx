'use client';

import type { AcousticFingerprint } from '../../engine/types';

/**
 * The 16 log-band energies of a stored fingerprint as a small bar chart —
 * enough for staff to see "this room has a shape" vs. "this looks flat /
 * identical to the neighbouring room".
 */
export function FingerprintViz({ fingerprint, zoneId }: { fingerprint: AcousticFingerprint; zoneId: string }) {
  const max = Math.max(...fingerprint.energies, 1e-6);
  return (
    <div data-testid={`fingerprint-viz-${zoneId}`}>
      <div className="flex h-16 items-end gap-[3px]">
        {fingerprint.energies.map((e, i) => (
          <div
            key={i}
            className="flex-1 rounded-t-sm bg-brass/70"
            style={{ height: `${Math.max(4, (e / max) * 100)}%` }}
            title={`band ${i}: ${(e * 100).toFixed(1)}%`}
          />
        ))}
      </div>
      <p className="mt-1.5 font-mono text-[10px] text-stone">
        {fingerprint.bandsHz[0]}–{fingerprint.bandsHz[1]} Hz · {fingerprint.bandCount} bands ·
        captured {fingerprint.capturedAt ? new Date(fingerprint.capturedAt).toLocaleString() : '—'}
        {fingerprint.captureSeconds ? ` · ${fingerprint.captureSeconds}s` : ''}
      </p>
    </div>
  );
}
