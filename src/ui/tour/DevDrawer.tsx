'use client';

import { useState } from 'react';
import type { GuideSession, GuideSnapshot } from '../session/guideSession';
import { simAcoustic, simWalk, type SimDirection } from '../session/simulator';
import { AuditTable } from './AuditTable';

/**
 * Developer-only drawer (?dev=1): drives the ENGINE with synthetic inputs —
 * steps, headings, canned acoustic samples — so the whole guide can be
 * demonstrated without walking sensors. The rendered UI above it still shows
 * only what the engine reports.
 */
export function DevDrawer({ session, snap }: { session: GuideSession; snap: GuideSnapshot }) {
  const [open, setOpen] = useState(true);
  const fingerprintZones = session.blueprint.zones.filter((z) => z.fingerprint);

  const walkButton = (dir: SimDirection, label: string, testid: string) => (
    <button
      data-testid={testid}
      onClick={() => simWalk(session, dir, 1)}
      className="rounded-lg border border-hairline px-0 py-2 font-mono text-xs text-parchment/90 hover:border-stone active:scale-95"
    >
      {label}
    </button>
  );

  return (
    <section className="mt-6 rounded-2xl border border-moss/30 bg-moss-deep/30">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
        data-testid="dev-drawer-toggle"
      >
        <span className="font-mono text-xs uppercase tracking-[0.2em] text-moss">
          dev simulator — not part of the visitor UI
        </span>
        <span className="text-moss">{open ? '−' : '+'}</span>
      </button>

      {open && (
        <div className="space-y-4 px-4 pb-4">
          <div>
            <p className="mb-2 font-mono text-[11px] text-stone">
              inject steps into the engine (map frame)
            </p>
            <div className="grid max-w-[220px] grid-cols-3 gap-1.5">
              <span />
              {walkButton('north', '↑ N', 'sim-step-n')}
              <span />
              {walkButton('west', '← W', 'sim-step-w')}
              <button
                data-testid="sim-step-n5"
                onClick={() => simWalk(session, 'north', 5)}
                className="rounded-lg border border-moss/40 px-0 py-2 font-mono text-xs text-moss hover:border-moss active:scale-95"
              >
                ↑ ×5
              </button>
              {walkButton('east', '→ E', 'sim-step-e')}
              <span />
              {walkButton('south', '↓ S', 'sim-step-s')}
              <span />
            </div>
          </div>

          {fingerprintZones.length > 0 && (
            <div>
              <p className="mb-2 font-mono text-[11px] text-stone">
                inject ambient sample “sounds like…” (3× within 60 s = correction)
              </p>
              <div className="flex flex-wrap gap-1.5">
                {fingerprintZones.map((z) => (
                  <button
                    key={z.id}
                    data-testid={`sim-acoustic-${z.id}`}
                    onClick={() => simAcoustic(session, z.id)}
                    className="rounded-lg border border-hairline px-3 py-1.5 font-mono text-[11px] text-parchment/90 hover:border-stone active:scale-95"
                  >
                    {z.id}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="mb-1 font-mono text-[11px] text-stone">
              acoustic corrector audits (last 6 · <a className="text-moss underline" href="/dev/audits">full log</a>)
            </p>
            <AuditTable audits={snap.audits} limit={6} />
          </div>
        </div>
      )}
    </section>
  );
}
