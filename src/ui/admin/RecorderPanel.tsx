'use client';

import { useEffect, useRef, useState } from 'react';
import { computeFingerprint } from '../../engine/acoustic/fingerprint';
import { captureAmbientClip } from '../../engine/platform/micCapture';
import { detectCapabilities } from '../../engine/platform/sensors';
import type { AcousticFingerprint, Zone } from '../../engine/types';
import { FingerprintViz } from './FingerprintViz';

const CAPTURE_SECONDS = 8;

type RecState =
  | { kind: 'idle' }
  | { kind: 'recording'; startedAt: number }
  | { kind: 'error'; message: string };

/**
 * The "stand here, tap record" flow. Captures 8 s of ambient audio through
 * the SAME pipeline the tourist runtime samples with (captureAmbientClip →
 * computeFingerprint), so calibration and runtime fingerprints are
 * format-identical by construction — no new format invented.
 */
export function RecorderPanel({
  zone,
  onFingerprint,
}: {
  zone: Zone;
  onFingerprint: (fp: AcousticFingerprint) => void;
}) {
  const [state, setState] = useState<RecState>({ kind: 'idle' });
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const record = async () => {
    const caps = detectCapabilities(window as never);
    if (caps.microphone.status !== 'ok') {
      setState({ kind: 'error', message: caps.microphone.message });
      return;
    }
    setState({ kind: 'recording', startedAt: Date.now() });
    setElapsed(0);
    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    try {
      const { pcm, sampleRateHz } = await captureAmbientClip(CAPTURE_SECONDS);
      const fp = computeFingerprint(pcm, sampleRateHz);
      onFingerprint({ ...fp, capturedAt: new Date().toISOString(), captureSeconds: CAPTURE_SECONDS });
      setState({ kind: 'idle' });
    } catch (e) {
      setState({
        kind: 'error',
        message:
          'Recording failed — microphone access was declined or interrupted. ' +
          `Nothing was saved. (${e instanceof Error ? e.message : 'unknown error'})`,
      });
    } finally {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-parchment">Acoustic snapshot</h4>
          <p className="mt-0.5 text-xs leading-relaxed text-stone">
            Stand in the middle of “{zone.name}”, keep the room as it normally sounds, tap record,
            hold still for {CAPTURE_SECONDS} seconds.
          </p>
        </div>
        <button
          data-testid={`record-zone-${zone.id}`}
          onClick={() => void record()}
          disabled={state.kind === 'recording'}
          className={
            'shrink-0 rounded-full border px-4 py-2 text-xs transition-colors ' +
            (state.kind === 'recording'
              ? 'border-ember text-ember'
              : 'border-brass/50 text-brass hover:border-brass')
          }
        >
          {state.kind === 'recording' ? (
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 animate-guide-pulse rounded-full bg-ember" />
              {Math.max(0, CAPTURE_SECONDS - elapsed)}s…
            </span>
          ) : zone.fingerprint ? (
            'Re-record'
          ) : (
            'Record'
          )}
        </button>
      </div>

      {state.kind === 'error' && (
        <p
          data-testid={`record-error-${zone.id}`}
          className="mt-3 rounded-lg border border-ember/40 bg-ember-deep/40 px-3 py-2 text-xs leading-relaxed text-parchment"
        >
          {state.message}
        </p>
      )}

      <div className="mt-3">
        {zone.fingerprint ? (
          <FingerprintViz fingerprint={zone.fingerprint} zoneId={zone.id} />
        ) : (
          <p className="rounded-lg border border-dashed border-hairline px-3 py-2 text-xs text-stone">
            No fingerprint yet — this zone gets no acoustic corrections until one is recorded.
            (Optional: dead reckoning + map matching still work.)
          </p>
        )}
      </div>
    </div>
  );
}
