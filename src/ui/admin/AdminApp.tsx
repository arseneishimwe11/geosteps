'use client';

import { useEffect, useMemo, useState } from 'react';
import { validateBlueprint } from '../../engine/blueprint';
import type { FloorBlueprint, WalkableGraph, Zone } from '../../engine/types';
import { fetchBlueprint, saveBlueprint, VenueApiError } from '../api';
import { CanvasPanel } from './canvas/CanvasPanel';
import { ValidationPanel } from './ValidationPanel';
import { ZoneCard } from './ZoneCard';

/**
 * Admin calibration surface (run 1: everything except the polygon/graph
 * drawing canvas). Staff record per-zone acoustic snapshots, manage
 * per-language narration slots, and save — gated on the frozen schema's
 * client-side validation. The working blueprint lives here; children get a
 * zone plus an update callback.
 */
export function AdminApp({ venueId }: { venueId: string }) {
  const [blueprint, setBlueprint] = useState<FloorBlueprint | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    fetchBlueprint(venueId)
      .then(setBlueprint)
      .catch((e) =>
        setLoadError(e instanceof VenueApiError ? e.message : 'Loading the blueprint failed.'),
      );
  }, [venueId]);

  const validation = useMemo(() => (blueprint ? validateBlueprint(blueprint) : null), [blueprint]);

  const updateZone = (zoneId: string, patch: Partial<Zone>) => {
    setBlueprint((bp) =>
      bp
        ? { ...bp, zones: bp.zones.map((z) => (z.id === zoneId ? { ...z, ...patch } : z)) }
        : bp,
    );
    setDirty(true);
    setSaveResult(null);
  };

  const updateGeometry = (zones: Zone[], graph: WalkableGraph) => {
    setBlueprint((bp) => (bp ? { ...bp, zones, graph } : bp));
    setDirty(true);
    setSaveResult(null);
  };

  const save = async () => {
    if (!blueprint || !validation?.ok) return;
    setSaving(true);
    setSaveResult(null);
    try {
      const { warnings } = await saveBlueprint(venueId, blueprint);
      setDirty(false);
      setSaveResult({
        ok: true,
        text:
          warnings.length > 0
            ? `Saved. Server warnings: ${warnings.join(' · ')}`
            : 'Saved. The tourist runtime now serves this blueprint.',
      });
    } catch (e) {
      setSaveResult({
        ok: false,
        text: e instanceof VenueApiError ? e.message : 'Saving failed unexpectedly.',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loadError) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center px-6">
        <p className="text-xs uppercase tracking-[0.3em] text-ember">Admin</p>
        <h1 className="mt-2 font-display text-2xl text-parchment">{loadError}</h1>
      </main>
    );
  }
  if (!blueprint) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-slate-deep">
        <p className="animate-guide-pulse font-display text-lg text-stone">Loading blueprint…</p>
      </main>
    );
  }

  return (
    <main
      className="mx-auto min-h-dvh max-w-[1500px] px-4 py-8 sm:px-6 lg:px-8"
      style={{ background: 'var(--color-slate-deep)' }}
    >
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-1 text-xs uppercase tracking-[0.3em] text-brass">Admin calibration</p>
          <h1 className="font-display text-3xl text-parchment">{blueprint.venue.name}</h1>
          <p className="mt-1 font-mono text-xs text-stone">
            venue “{venueId}” · {blueprint.zones.length} zones · languages:{' '}
            {blueprint.venue.languages.join(', ')}
          </p>
        </div>
        <button
          data-testid="save-blueprint"
          onClick={() => void save()}
          disabled={!validation?.ok || !dirty || saving}
          className="rounded-xl bg-brass px-5 py-2.5 text-sm font-semibold text-ink transition-opacity disabled:opacity-40"
        >
          {saving ? 'Saving…' : dirty ? 'Save blueprint' : 'Saved'}
        </button>
      </header>

      <p
        data-testid="admin-warning"
        className="mt-5 rounded-xl border border-ember/40 bg-ember-deep/40 px-4 py-3 text-sm leading-relaxed text-parchment"
      >
        This tool writes to the venue server <strong>without authentication</strong> — fine for a
        local or demo deployment, unsafe anywhere else. Do not expose the venue server's PUT routes
        to the public internet as-is.
      </p>

      {saveResult && (
        <p
          data-testid="save-result"
          className={`mt-3 rounded-xl border px-4 py-3 text-sm ${
            saveResult.ok ? 'border-moss/40 bg-moss-deep/40 text-moss' : 'border-ember/40 bg-ember-deep/40 text-ember'
          }`}
        >
          {saveResult.text}
        </p>
      )}

      {validation && <ValidationPanel validation={validation} />}

      <div className="mt-6 gap-6 lg:grid lg:grid-cols-[minmax(0,7fr)_minmax(380px,5fr)] lg:items-start">
        {/* Drawing canvas — sticky beside the zone list on wide screens,
            stacked above it on phones. */}
        <section className="lg:sticky lg:top-6">
          <div className="h-[62vh] min-h-[440px] lg:h-[calc(100dvh-140px)]">
            <CanvasPanel blueprint={blueprint} onGeometryChange={updateGeometry} />
          </div>
        </section>

        <section className="mt-8 space-y-6 lg:mt-0">
          {blueprint.zones.length === 0 && (
            <p className="rounded-2xl border border-dashed border-hairline bg-panel/50 px-5 py-6 text-sm text-stone">
              No zones yet — pick the <strong>Zone</strong> tool and trace the first exhibit area
              on the canvas.
            </p>
          )}
          {blueprint.zones.map((zone, index) => (
            <ZoneCard
              key={zone.id}
              venueId={venueId}
              blueprint={blueprint}
              zone={zone}
              zoneIndex={index}
              onUpdate={(patch) => updateZone(zone.id, patch)}
            />
          ))}
        </section>
      </div>
    </main>
  );
}
