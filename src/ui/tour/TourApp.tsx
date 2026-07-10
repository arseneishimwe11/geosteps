'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import type { FloorBlueprint } from '../../engine/types';
import { fetchBlueprint, VenueApiError } from '../api';
import { GuideSession } from '../session/guideSession';
import { GuideScreen } from './GuideScreen';
import { ManualList } from './ManualList';
import { StartScreen } from './StartScreen';

/**
 * Tourist runtime root. Owns exactly one GuideSession per venue load and
 * renders one of three shells: loading, load-error, or the session phases
 * (start screen → guide screen). All state below this point comes from the
 * session snapshot — no component computes anything positional.
 */
export function TourApp({ venueId }: { venueId: string }) {
  const [session, setSession] = useState<GuideSession | null>(null);
  const [blueprint, setBlueprint] = useState<FloorBlueprint | null>(null);
  const [loadError, setLoadError] = useState<{ message: string; details?: string[] } | null>(null);
  const [dev, setDev] = useState(false);

  useEffect(() => {
    setDev(new URLSearchParams(window.location.search).has('dev'));
    let cancelled = false;
    let created: GuideSession | null = null;
    fetchBlueprint(venueId)
      .then((bp) => {
        if (cancelled) return;
        created = new GuideSession(venueId, bp, bp.venue.defaultLanguage);
        created.detect();
        setBlueprint(bp);
        setSession(created);
      })
      .catch((e) => {
        if (cancelled) return;
        setLoadError(
          e instanceof VenueApiError
            ? { message: e.message, details: e.details }
            : { message: 'Loading this venue failed unexpectedly.' },
        );
      });
    return () => {
      cancelled = true;
      void created?.stop();
    };
  }, [venueId]);

  if (loadError) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-6">
        <p className="text-xs uppercase tracking-[0.3em] text-ember">Cannot start the guide</p>
        <h1 className="font-display text-2xl text-parchment">{loadError.message}</h1>
        {loadError.details && (
          <ul className="list-disc space-y-1 pl-5 font-mono text-xs text-stone">
            {loadError.details.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        )}
        <p className="text-sm text-stone">
          Nothing is broken silently — this is everything we know. Ask a member of staff for help.
        </p>
      </main>
    );
  }

  if (!session || !blueprint) {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <p className="animate-guide-pulse font-display text-lg text-stone">Opening the guide…</p>
      </main>
    );
  }

  return <TourSession session={session} blueprint={blueprint} dev={dev} />;
}

function TourSession({
  session,
  blueprint,
  dev,
}: {
  session: GuideSession;
  blueprint: FloorBlueprint;
  dev: boolean;
}) {
  const snap = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);

  if (snap.phase === 'error') {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-5 px-6">
        <p className="text-xs uppercase tracking-[0.3em] text-ember">The guide could not start</p>
        <p className="font-display text-2xl text-parchment">{snap.startError}</p>
        <button
          onClick={() => void session.start()}
          className="rounded-2xl bg-brass px-5 py-4 text-lg font-semibold text-ink active:scale-[0.98]"
        >
          Try again
        </button>
        <div className="rounded-2xl border border-hairline bg-panel p-4">
          <p className="mb-3 text-sm text-stone">
            You can still listen manually — pick an exhibit:
          </p>
          <ManualList blueprint={blueprint} venueId={session.venueId} language={snap.language} />
        </div>
      </main>
    );
  }

  if (snap.phase === 'idle' || snap.phase === 'starting') {
    return <StartScreen session={session} snap={snap} blueprint={blueprint} />;
  }

  return <GuideScreen session={session} snap={snap} blueprint={blueprint} dev={dev} />;
}
