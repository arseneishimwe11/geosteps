'use client';

import type { AcousticSampleAudit } from '../../engine/types';

const ACTION_TONE: Record<AcousticSampleAudit['action'], string> = {
  none: 'text-stone',
  'streak-building': 'text-brass',
  'confirmed-in-place': 'text-moss',
  reanchored: 'text-moss',
};

/**
 * Field-observability table for AcousticSampleAudit records — HANDOFF.md's
 * "the only way to learn how the acoustic layer behaves outside unit tests".
 * Developer-facing; deliberately dense and monospace.
 */
export function AuditTable({ audits, limit }: { audits: AcousticSampleAudit[]; limit?: number }) {
  const rows = limit ? audits.slice(-limit) : audits;
  if (rows.length === 0) {
    return (
      <p className="px-1 py-3 text-xs leading-relaxed text-stone">
        No acoustic samples yet. Each ambient sample — acted on or not — lands here with the
        candidate set the geometric gate allowed, the top-two similarity margin, the agreement
        streak, and what the corrector did.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full font-mono text-[11px] leading-relaxed" data-testid="audit-table">
        <thead>
          <tr className="border-b border-hairline text-left text-stone/70">
            <th className="py-1.5 pr-3 font-normal">time</th>
            <th className="py-1.5 pr-3 font-normal">candidates (r m)</th>
            <th className="py-1.5 pr-3 font-normal">match</th>
            <th className="py-1.5 pr-3 font-normal">margin</th>
            <th className="py-1.5 pr-3 font-normal">streak</th>
            <th className="py-1.5 pr-3 font-normal">action</th>
            <th className="py-1.5 font-normal">Δpos m</th>
          </tr>
        </thead>
        <tbody>
          {[...rows].reverse().map((a, i) => {
            const moved = Math.hypot(
              a.positionAfter.x - a.positionBefore.x,
              a.positionAfter.y - a.positionBefore.y,
            );
            return (
              <tr key={`${a.timestampMs}-${i}`} className="border-b border-hairline/50 align-top">
                <td className="py-1.5 pr-3 text-stone">
                  {new Date(a.timestampMs).toLocaleTimeString(undefined, { hour12: false })}
                </td>
                <td className="py-1.5 pr-3 text-parchment/80">
                  {a.candidateZoneIds.length > 0 ? a.candidateZoneIds.join(' ') : '—'}
                  <span className="text-stone/60"> ({a.candidateRadiusM.toFixed(1)})</span>
                </td>
                <td className="py-1.5 pr-3 text-parchment/80">
                  {a.match ? `${a.match.zoneId} ${a.match.confidence.toFixed(3)}` : '—'}
                </td>
                <td className="py-1.5 pr-3 text-stone">
                  {a.marginToRunnerUp === null ? 'n/a' : a.marginToRunnerUp.toFixed(3)}
                </td>
                <td className="py-1.5 pr-3 text-stone">{a.streak}</td>
                <td className={`py-1.5 pr-3 ${ACTION_TONE[a.action]}`}>{a.action}</td>
                <td className="py-1.5 text-stone">{moved > 0.001 ? moved.toFixed(1) : '0'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
