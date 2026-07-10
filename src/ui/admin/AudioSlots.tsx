'use client';

import { useRef, useState } from 'react';
import type { AudioAssetRef, FloorBlueprint, LanguageCode, Zone } from '../../engine/types';
import { audioUrl, uploadAudio, VenueApiError } from '../api';
import {
  PLACEHOLDER_TITLE,
  placeholderFilename,
  renderPlaceholderToneWav,
} from '../audio/placeholderTone';

const UPLOAD_EXTENSIONS = ['.mp3', '.m4a', '.aac', '.ogg', '.opus', '.wav'];

type SlotBusy = { lang: LanguageCode; kind: 'upload' | 'generate' } | null;

/**
 * Per-zone, per-language narration slots: upload a real recording, or
 * generate a clearly-labeled placeholder tone to prove the pipeline before
 * real content exists. Every action round-trips through the venue server so
 * what you hear afterwards is what visitors will get.
 */
export function AudioSlots({
  venueId,
  blueprint,
  zone,
  zoneIndex,
  onAudioChange,
}: {
  venueId: string;
  blueprint: FloorBlueprint;
  zone: Zone;
  zoneIndex: number;
  onAudioChange: (lang: LanguageCode, ref: AudioAssetRef) => void;
}) {
  const [busy, setBusy] = useState<SlotBusy>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  const setError = (lang: LanguageCode, message: string | null) =>
    setErrors((e) => {
      const next = { ...e };
      if (message === null) delete next[lang];
      else next[lang] = message;
      return next;
    });

  const upload = async (lang: LanguageCode, file: File) => {
    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    if (!UPLOAD_EXTENSIONS.includes(ext)) {
      setError(lang, `"${ext}" is not a supported audio format (${UPLOAD_EXTENSIONS.join(', ')}).`);
      return;
    }
    setBusy({ lang, kind: 'upload' });
    setError(lang, null);
    try {
      const filename = `${zone.id}.${lang}${ext}`;
      const { url } = await uploadAudio(venueId, filename, file);
      onAudioChange(lang, { url, title: file.name });
    } catch (e) {
      setError(lang, e instanceof VenueApiError ? e.message : 'Upload failed unexpectedly.');
    } finally {
      setBusy(null);
    }
  };

  const generatePlaceholder = async (lang: LanguageCode) => {
    setBusy({ lang, kind: 'generate' });
    setError(lang, null);
    try {
      const wav = renderPlaceholderToneWav({ zoneName: zone.name, language: lang, seed: zoneIndex });
      const filename = placeholderFilename(zone.id, lang);
      const { url } = await uploadAudio(venueId, filename, wav);
      onAudioChange(lang, { url, title: PLACEHOLDER_TITLE, durationSec: 2 });
    } catch (e) {
      setError(lang, e instanceof VenueApiError ? e.message : 'Generating the placeholder failed.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <h4 className="text-sm font-semibold text-parchment">Narration</h4>
      <ul className="mt-2 divide-y divide-hairline/60">
        {blueprint.venue.languages.map((lang) => {
          const ref = zone.audio[lang];
          const isPlaceholder = ref?.title === PLACEHOLDER_TITLE;
          const slotBusy = busy?.lang === lang ? busy : null;
          return (
            <li key={lang} className="py-2.5">
              <div className="flex items-center gap-3">
                <span className="w-8 shrink-0 font-mono text-xs uppercase text-stone">{lang}</span>
                <div className="min-w-0 grow">
                  {ref ? (
                    <p className="truncate text-xs text-parchment/90">
                      {isPlaceholder ? (
                        <span className="text-brass">{PLACEHOLDER_TITLE}</span>
                      ) : (
                        (ref.title ?? ref.url)
                      )}
                    </p>
                  ) : (
                    <p className="text-xs text-stone/70">empty — visitors get the fallback language</p>
                  )}
                </div>
                {ref && (
                  <audio
                    controls
                    preload="none"
                    src={audioUrl(venueId, ref.url)}
                    className="h-8 w-36 shrink-0"
                    data-testid={`audio-preview-${zone.id}-${lang}`}
                  />
                )}
                <input
                  ref={(el) => {
                    fileInputs.current[lang] = el;
                  }}
                  type="file"
                  accept={UPLOAD_EXTENSIONS.join(',')}
                  className="hidden"
                  data-testid={`upload-${zone.id}-${lang}`}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void upload(lang, f);
                    e.target.value = '';
                  }}
                />
                <button
                  onClick={() => fileInputs.current[lang]?.click()}
                  disabled={slotBusy !== null}
                  className="shrink-0 rounded-full border border-hairline px-3 py-1.5 text-xs text-parchment/90 hover:border-stone disabled:opacity-50"
                >
                  {slotBusy?.kind === 'upload' ? 'Uploading…' : 'Upload'}
                </button>
                <button
                  data-testid={`gen-placeholder-${zone.id}-${lang}`}
                  onClick={() => void generatePlaceholder(lang)}
                  disabled={slotBusy !== null}
                  className="shrink-0 rounded-full border border-brass/40 px-3 py-1.5 text-xs text-brass hover:border-brass disabled:opacity-50"
                >
                  {slotBusy?.kind === 'generate' ? 'Generating…' : 'Placeholder'}
                </button>
              </div>
              {errors[lang] && (
                <p className="mt-2 rounded-lg border border-ember/40 bg-ember-deep/40 px-3 py-2 text-xs text-parchment">
                  {errors[lang]}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
