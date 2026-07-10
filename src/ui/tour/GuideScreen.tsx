'use client';

import { useState } from 'react';
import type { FloorBlueprint } from '../../engine/types';
import type { WakeLockState } from '../../engine/platform/wakeLock';
import type { GuideSession, GuideSnapshot } from '../session/guideSession';
import { DevDrawer } from './DevDrawer';
import { ManualList } from './ManualList';
import { Minimap } from './Minimap';

/** The screen a visitor looks at (or pockets glances at) for the whole visit. */
export function GuideScreen({
  session,
  snap,
  blueprint,
  dev,
}: {
  session: GuideSession;
  snap: GuideSnapshot;
  blueprint: FloorBlueprint;
  dev: boolean;
}) {
  const [manualOpen, setManualOpen] = useState(false);
  const currentZone = snap.position?.currentZoneId
    ? blueprint.zones.find((z) => z.id === snap.position!.currentZoneId)
    : null;

  const honestyMessages: { key: string; text: string; tone: 'warn' | 'error' }[] = [];
  if (snap.permissions) {
    for (const [name, cap] of Object.entries(snap.permissions)) {
      if (cap.status !== 'ok') honestyMessages.push({ key: `perm-${name}`, text: cap.message, tone: 'error' });
    }
  }
  if (snap.wakeLock && snap.wakeLock.state !== 'active') {
    honestyMessages.push({ key: 'wakelock', text: snap.wakeLock.message, tone: 'warn' });
  }
  if (snap.micMessage) honestyMessages.push({ key: 'mic', text: snap.micMessage, tone: 'warn' });
  if (snap.headingAbsolute === false) {
    honestyMessages.push({
      key: 'heading',
      text: 'This browser only reports a relative compass, which drifts over time. Guiding still works but may need more corrections.',
      tone: 'warn',
    });
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-8 pt-5">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2" data-testid="guide-active">
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-breathe rounded-full bg-moss" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-moss" />
          </span>
          <span className="text-xs uppercase tracking-[0.2em] text-moss">Guide active</span>
        </div>
        <WakeLockChip state={snap.wakeLock?.state ?? null} />
      </header>

      <section className="mt-10 text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-stone">
          {currentZone ? 'You are in' : 'Between exhibits'}
        </p>
        <h1
          data-testid="zone-name"
          className="mt-2 font-display text-[2.6rem] leading-tight text-parchment"
        >
          {currentZone ? currentZone.name : '· · ·'}
        </h1>
        {snap.position && (
          <p className="mt-2 text-xs text-stone/80">
            position confidence ±{snap.position.uncertaintyM.toFixed(1)} m ·{' '}
            {snap.position.stepCount} steps
          </p>
        )}
      </section>

      <section className="mt-8">
        <Minimap blueprint={blueprint} position={snap.position} />
      </section>

      {snap.nowPlaying && (
        <section
          data-testid="now-playing"
          className="mt-5 flex items-center gap-3 rounded-2xl border border-brass/30 bg-panel px-4 py-3"
        >
          <NoteIcon />
          <div className="min-w-0">
            <p className="truncate text-sm text-parchment">{snap.nowPlaying.zoneName}</p>
            <p className="truncate text-xs text-brass">
              {snap.nowPlaying.title ?? 'Narration playing'}
            </p>
          </div>
        </section>
      )}

      {honestyMessages.length > 0 && (
        <section className="mt-5 space-y-2">
          {honestyMessages.map((m) => (
            <p
              key={m.key}
              data-testid={`status-${m.key}`}
              className={
                'rounded-xl border px-4 py-3 text-sm leading-relaxed text-parchment ' +
                (m.tone === 'error' ? 'border-ember/40 bg-ember-deep/40' : 'border-brass/30 bg-panel')
              }
            >
              {m.text}
            </p>
          ))}
        </section>
      )}

      <section className="mt-auto pt-8">
        <button
          data-testid="manual-toggle"
          onClick={() => setManualOpen((o) => !o)}
          className="w-full rounded-xl border border-hairline px-4 py-3 text-sm text-stone transition-colors hover:border-stone"
        >
          {manualOpen ? 'Hide exhibit list' : 'Browse exhibits manually'}
        </button>
        {manualOpen && (
          <div className="mt-3 rounded-2xl border border-hairline bg-panel p-4" data-testid="manual-list">
            <ManualList blueprint={blueprint} venueId={session.venueId} language={snap.language} />
          </div>
        )}
      </section>

      {dev && <DevDrawer session={session} snap={snap} />}
    </main>
  );
}

const WAKE_LOCK_CHIP: Record<WakeLockState, { label: string; dot: string; text: string }> = {
  active: { label: 'Screen stays on', dot: 'bg-moss', text: 'text-moss' },
  released: { label: 'Screen may sleep', dot: 'bg-ember', text: 'text-ember' },
  denied: { label: 'Screen may sleep', dot: 'bg-ember', text: 'text-ember' },
  unsupported: { label: 'Keep screen on yourself', dot: 'bg-brass', text: 'text-brass' },
};

function WakeLockChip({ state }: { state: WakeLockState | null }) {
  const cfg = state ? WAKE_LOCK_CHIP[state] : { label: 'Wake lock…', dot: 'bg-stone', text: 'text-stone' };
  return (
    <span
      data-testid="wakelock-chip"
      data-state={state ?? 'pending'}
      className={`flex items-center gap-2 rounded-full border border-hairline px-3 py-1.5 text-xs ${cfg.text}`}
    >
      <span className={`h-2 w-2 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function NoteIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="shrink-0 text-brass">
      <path
        d="M9 18V5.5l10-2v11.3M9 18a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Zm10-3.2a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
