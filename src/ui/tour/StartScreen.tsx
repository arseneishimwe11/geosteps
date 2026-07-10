'use client';

import type { FloorBlueprint } from '../../engine/types';
import type { GuideSession, GuideSnapshot } from '../session/guideSession';

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  fr: 'Français',
  rw: 'Ikinyarwanda',
  sw: 'Kiswahili',
  de: 'Deutsch',
};

/**
 * Everything before the single start gesture: language choice, an honest
 * preflight of what this browser can and cannot do, and the one big tap
 * that unlocks sensors, wake lock, and audio all at once.
 */
export function StartScreen({
  session,
  snap,
  blueprint,
}: {
  session: GuideSession;
  snap: GuideSnapshot;
  blueprint: FloorBlueprint;
}) {
  const caps = snap.capabilities;
  const preflightIssues = caps
    ? (
        [
          ['deviceMotion', caps.deviceMotion],
          ['deviceOrientation', caps.deviceOrientation],
          ['wakeLock', caps.wakeLock],
          ['microphone', caps.microphone],
        ] as const
      ).filter(([, c]) => c.status === 'unsupported' || c.status === 'denied')
    : [];

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-6 pb-10 pt-14">
      <header>
        <p className="mb-3 text-xs uppercase tracking-[0.3em] text-brass">Audio guide</p>
        <h1 className="font-display text-4xl leading-tight text-parchment">{blueprint.venue.name}</h1>
        <p className="mt-3 text-sm leading-relaxed text-stone">
          Hold your phone like a map and walk. The right story finds you at each exhibit — in your
          language, in any order you wander.
        </p>
      </header>

      <section className="mt-8">
        <h2 className="mb-3 text-xs uppercase tracking-[0.2em] text-stone">Choose your language</h2>
        <div className="flex flex-wrap gap-2">
          {blueprint.venue.languages.map((lang) => (
            <button
              key={lang}
              data-testid={`lang-${lang}`}
              onClick={() => session.setLanguage(lang)}
              className={
                'rounded-full border px-4 py-2 text-sm transition-colors ' +
                (snap.language === lang
                  ? 'border-brass bg-brass/15 text-brass-bright'
                  : 'border-hairline text-stone hover:border-stone')
              }
            >
              {LANGUAGE_NAMES[lang] ?? lang}
            </button>
          ))}
        </div>
      </section>

      {preflightIssues.length > 0 && (
        <section className="mt-6 space-y-2">
          {preflightIssues.map(([name, cap]) => (
            <p
              key={name}
              data-testid={`capability-msg-${name}`}
              className="rounded-xl border border-ember/40 bg-ember-deep/40 px-4 py-3 text-sm leading-relaxed text-parchment"
            >
              {cap.message}
            </p>
          ))}
        </section>
      )}

      <div className="mt-auto pt-10">
        <button
          data-testid="start-guide"
          onClick={() => void session.start()}
          disabled={snap.phase === 'starting'}
          className="w-full rounded-2xl bg-brass px-6 py-5 font-display text-2xl font-semibold text-ink shadow-[0_0_60px_-15px] shadow-brass/60 transition-transform active:scale-[0.98] disabled:opacity-60"
        >
          {snap.phase === 'starting' ? 'Starting…' : 'Start the guide'}
        </button>
        <p className="mt-4 text-center text-xs leading-relaxed text-stone/80">
          Your screen stays on while the guide runs — hold the phone like you would for walking
          directions. To recognise rooms, the guide listens for 2 seconds every 15 seconds; sound is
          analysed on your phone and never recorded or uploaded.
        </p>
      </div>
    </main>
  );
}
