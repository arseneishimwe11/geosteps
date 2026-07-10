'use client';

import type { AcousticFingerprint, AudioAssetRef, FloorBlueprint, LanguageCode, Zone } from '../../engine/types';
import { AudioSlots } from './AudioSlots';
import { RecorderPanel } from './RecorderPanel';

/** One zone's calibration card: read-only geometry, acoustic snapshot, narration slots. */
export function ZoneCard({
  venueId,
  blueprint,
  zone,
  zoneIndex,
  onUpdate,
}: {
  venueId: string;
  blueprint: FloorBlueprint;
  zone: Zone;
  zoneIndex: number;
  onUpdate: (patch: Partial<Zone>) => void;
}) {
  const xs = zone.polygon.map((p) => p.x);
  const ys = zone.polygon.map((p) => p.y);
  const w = Math.max(...xs) - Math.min(...xs);
  const h = Math.max(...ys) - Math.min(...ys);

  const setFingerprint = (fp: AcousticFingerprint) => onUpdate({ fingerprint: fp });
  const setAudio = (lang: LanguageCode, ref: AudioAssetRef) =>
    onUpdate({ audio: { ...zone.audio, [lang]: ref } });

  return (
    <article className="rounded-2xl border border-hairline bg-panel p-5" data-testid={`zone-card-${zone.id}`}>
      <header className="flex items-baseline justify-between gap-3">
        <h3 className="font-display text-xl text-parchment">{zone.name}</h3>
        <p className="font-mono text-[11px] text-stone">
          {zone.polygon.length} vertices · ~{w.toFixed(0)}×{h.toFixed(0)} m · id “{zone.id}”
        </p>
      </header>

      <div className="mt-4 border-t border-hairline/60 pt-4">
        <RecorderPanel zone={zone} onFingerprint={setFingerprint} />
      </div>

      <div className="mt-4 border-t border-hairline/60 pt-4">
        <AudioSlots
          venueId={venueId}
          blueprint={blueprint}
          zone={zone}
          zoneIndex={zoneIndex}
          onAudioChange={setAudio}
        />
      </div>
    </article>
  );
}
