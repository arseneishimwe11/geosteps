'use client';

import { useEffect, useState } from 'react';
import type { AcousticSampleAudit } from '../../../engine/types';
import { AuditTable } from '../../../ui/tour/AuditTable';

const KEY_PREFIX = 'geosteps.audits.';

/**
 * Field-observability log: every AcousticSampleAudit persisted by tour
 * sessions on this device, per venue, exportable as JSON for pilot analysis.
 * Developer/staff tool — never linked from the visitor flow.
 */
export default function AuditsPage() {
  const [venues, setVenues] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [audits, setAudits] = useState<AcousticSampleAudit[]>([]);

  const load = (venue: string | null) => {
    if (!venue) return setAudits([]);
    try {
      setAudits(JSON.parse(localStorage.getItem(KEY_PREFIX + venue) ?? '[]'));
    } catch {
      setAudits([]);
    }
  };

  useEffect(() => {
    const found = Object.keys(localStorage)
      .filter((k) => k.startsWith(KEY_PREFIX))
      .map((k) => k.slice(KEY_PREFIX.length))
      .sort();
    setVenues(found);
    const first = found[0] ?? null;
    setSelected(first);
    load(first);
  }, []);

  const exportJson = () => {
    if (!selected) return;
    const blob = new Blob([JSON.stringify(audits, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `geosteps-audits-${selected}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const clear = () => {
    if (!selected) return;
    localStorage.removeItem(KEY_PREFIX + selected);
    load(selected);
  };

  return (
    <main className="mx-auto min-h-dvh max-w-3xl px-6 py-10">
      <p className="mb-1 font-mono text-xs uppercase tracking-[0.2em] text-moss">field observability</p>
      <h1 className="font-display text-3xl text-parchment">Acoustic corrector audits</h1>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-stone">
        One record per ambient sample — applied or not: the geometric candidate set, top-two
        similarity margin, agreement streak, and the action taken. Collected on this device during
        tours; export the JSON from a pilot walk to tune the corrector's thresholds against a real
        building.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {venues.length === 0 ? (
          <p className="text-sm text-stone">
            No audits stored on this device yet — run a tour first (e.g.{' '}
            <a className="text-moss underline" href="/tour/demo?dev=1">
              /tour/demo?dev=1
            </a>
            ).
          </p>
        ) : (
          <>
            {venues.map((v) => (
              <button
                key={v}
                onClick={() => {
                  setSelected(v);
                  load(v);
                }}
                className={
                  'rounded-full border px-4 py-1.5 font-mono text-xs ' +
                  (selected === v ? 'border-moss text-moss' : 'border-hairline text-stone')
                }
              >
                {v}
              </button>
            ))}
            <span className="grow" />
            <button
              data-testid="export-audits"
              onClick={exportJson}
              className="rounded-lg border border-hairline px-3 py-1.5 font-mono text-xs text-parchment hover:border-stone"
            >
              Export JSON ({audits.length})
            </button>
            <button
              onClick={clear}
              className="rounded-lg border border-hairline px-3 py-1.5 font-mono text-xs text-ember hover:border-ember"
            >
              Clear
            </button>
          </>
        )}
      </div>

      <div className="mt-6 rounded-2xl border border-hairline bg-panel p-4">
        <AuditTable audits={audits} />
      </div>
    </main>
  );
}
