'use client';

import { useRef, useState } from 'react';
import type { FloorBlueprint, LanguageCode } from '../../engine/types';
import { audioUrl } from '../api';

/**
 * The universal fallback: every exhibit, one tap to listen. This is what a
 * visitor uses when sensors are denied/unsupported — required to be one tap
 * away from any error state.
 */
export function ManualList({
  blueprint,
  venueId,
  language,
}: {
  blueprint: FloorBlueprint;
  venueId: string;
  language: LanguageCode;
}) {
  const [playingZone, setPlayingZone] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const play = (zoneId: string, url: string) => {
    audioRef.current?.pause();
    if (playingZone === zoneId) {
      setPlayingZone(null);
      return;
    }
    const el = new Audio(audioUrl(venueId, url));
    audioRef.current = el;
    el.addEventListener('ended', () => setPlayingZone((z) => (z === zoneId ? null : z)));
    el.play().catch(() => setPlayingZone(null));
    setPlayingZone(zoneId);
  };

  return (
    <ul className="divide-y divide-hairline">
      {blueprint.zones.map((z) => {
        const ref = z.audio[language] ?? z.audio[blueprint.venue.defaultLanguage];
        return (
          <li key={z.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
            <div className="min-w-0">
              <p className="truncate text-sm text-parchment">{z.name}</p>
              {ref?.title && <p className="truncate text-xs text-stone">{ref.title}</p>}
            </div>
            {ref ? (
              <button
                data-testid={`manual-play-${z.id}`}
                onClick={() => play(z.id, ref.url)}
                className={
                  'shrink-0 rounded-full border px-4 py-1.5 text-xs transition-colors ' +
                  (playingZone === z.id
                    ? 'border-brass bg-brass/15 text-brass-bright'
                    : 'border-hairline text-stone hover:border-stone')
                }
              >
                {playingZone === z.id ? 'Stop' : 'Play'}
              </button>
            ) : (
              <span className="shrink-0 text-xs text-stone/60">no audio yet</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
