'use client';

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import type { FloorBlueprint, Point, WalkableGraph, Zone } from '../../../engine/types';
import {
  addZone,
  deleteEdge,
  deleteGraphNode,
  deleteZone,
  deleteZoneVertex,
  setEdgeWidth,
  DEFAULT_EDGE_WIDTH_M,
  type GeometrySnapshot,
} from './editorOps';
import { FloorCanvas, type Backdrop, type CanvasMode, type FloorCanvasHandle, type Selection } from './FloorCanvas';
import { Toolbar } from './Toolbar';

interface StoredBackdrop {
  dataUrl: string;
  imgWpx: number;
  imgHpx: number;
  pxPerMeter: number;
  opacity: number;
  calibrated: boolean;
}

const backdropKey = (venueId: string) => `geosteps.floorplan.${venueId}`;
const HISTORY_CAP = 100;

/**
 * The floor-plan editor: toolbar + canvas + dialogs + undo history.
 *
 * AdminApp remains the single owner of the working blueprint; this panel
 * receives its zones/graph and emits whole-geometry updates. Undo restores
 * geometry but MERGES back the current audio/fingerprint of surviving zones,
 * so drawing-history navigation can never destroy recorder or narration work
 * done since.
 */
export function CanvasPanel({
  blueprint,
  onGeometryChange,
}: {
  blueprint: FloorBlueprint;
  onGeometryChange(zones: Zone[], graph: WalkableGraph): void;
}) {
  const geometry: GeometrySnapshot = { zones: blueprint.zones, graph: blueprint.graph };
  const geometryRef = useRef(geometry);
  geometryRef.current = geometry;

  const canvasRef = useRef<FloorCanvasHandle | null>(null);
  const [mode, setMode] = useState<CanvasMode>('select');
  const [selection, setSelection] = useState<Selection | null>(null);
  const [gridSnap, setGridSnap] = useState(true);
  const [edgeWidthM, setEdgeWidthM] = useState(DEFAULT_EDGE_WIDTH_M);
  // History lives in refs (mutating it is a side effect of commits, and
  // setState updaters must stay pure); the reducer bump refreshes the
  // undo/redo button states.
  const pastRef = useRef<GeometrySnapshot[]>([]);
  const futureRef = useRef<GeometrySnapshot[]>([]);
  const [, bumpHistory] = useReducer((n: number) => n + 1, 0);
  const [stored, setStored] = useState<StoredBackdrop | null>(null);
  const [storageWarning, setStorageWarning] = useState<string | null>(null);
  const [pendingPolygon, setPendingPolygon] = useState<Point[] | null>(null);
  const [zoneName, setZoneName] = useState('');
  const [pendingCalib, setPendingCalib] = useState<number | null>(null); // world meters between picks
  const [calibMeters, setCalibMeters] = useState('');

  // ---- backdrop persistence -------------------------------------------------

  useEffect(() => {
    try {
      const raw = localStorage.getItem(backdropKey(blueprint.venue.id));
      if (raw) setStored(JSON.parse(raw));
    } catch {
      /* unreadable stored backdrop — start clean */
    }
  }, [blueprint.venue.id]);

  const persistBackdrop = (b: StoredBackdrop | null) => {
    setStored(b);
    setStorageWarning(null);
    try {
      if (b) localStorage.setItem(backdropKey(blueprint.venue.id), JSON.stringify(b));
      else localStorage.removeItem(backdropKey(blueprint.venue.id));
    } catch {
      setStorageWarning(
        'The floor-plan image is too large for this browser to remember between visits — it will stay for this session only.',
      );
    }
  };

  const onBackdropFile = (file: File) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const maxSide = 2048;
      const k = Math.min(1, maxSide / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * k);
      canvas.height = Math.round(img.height * k);
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      persistBackdrop({
        dataUrl: canvas.toDataURL('image/jpeg', 0.82),
        imgWpx: canvas.width,
        imgHpx: canvas.height,
        pxPerMeter: canvas.width / 40, // uncalibrated default: image spans 40 m
        opacity: 0.55,
        calibrated: false,
      });
      setMode('calibrate');
    };
    img.onerror = () => URL.revokeObjectURL(url);
    img.src = url;
  };

  const backdrop: Backdrop | null = stored
    ? {
        url: stored.dataUrl,
        widthM: stored.imgWpx / stored.pxPerMeter,
        heightM: stored.imgHpx / stored.pxPerMeter,
        opacity: stored.opacity,
        calibrated: stored.calibrated,
      }
    : null;

  // ---- history ----------------------------------------------------------------

  const commit = useCallback(
    (g: GeometrySnapshot, _label: string) => {
      pastRef.current = [...pastRef.current.slice(-(HISTORY_CAP - 1)), geometryRef.current];
      futureRef.current = [];
      onGeometryChange(g.zones, g.graph);
      bumpHistory();
    },
    [onGeometryChange],
  );

  /** Restore snapshot geometry, keeping surviving zones' current audio/fingerprint. */
  const mergeRestore = (snapshot: GeometrySnapshot): GeometrySnapshot => {
    const current = geometryRef.current;
    return {
      graph: snapshot.graph,
      zones: snapshot.zones.map((sz) => {
        const cur = current.zones.find((z) => z.id === sz.id);
        return cur ? { ...sz, audio: cur.audio, fingerprint: cur.fingerprint } : sz;
      }),
    };
  };

  const undo = useCallback(() => {
    const prev = pastRef.current[pastRef.current.length - 1];
    if (!prev) return;
    pastRef.current = pastRef.current.slice(0, -1);
    futureRef.current = [...futureRef.current, geometryRef.current];
    const restored = mergeRestore(prev);
    onGeometryChange(restored.zones, restored.graph);
    setSelection(null);
    bumpHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onGeometryChange]);

  const redo = useCallback(() => {
    const next = futureRef.current[futureRef.current.length - 1];
    if (!next) return;
    futureRef.current = futureRef.current.slice(0, -1);
    pastRef.current = [...pastRef.current, geometryRef.current];
    const restored = mergeRestore(next);
    onGeometryChange(restored.zones, restored.graph);
    setSelection(null);
    bumpHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onGeometryChange]);

  // ---- selection actions --------------------------------------------------------

  const deleteSelection = useCallback(() => {
    const sel = selection;
    const g = geometryRef.current;
    if (!sel) return;
    if (sel.kind === 'zone') commit(deleteZone(g, sel.id), 'delete zone');
    else if (sel.kind === 'vertex') commit(deleteZoneVertex(g, sel.zoneId, sel.index), 'delete vertex');
    else if (sel.kind === 'node') commit(deleteGraphNode(g, sel.id), 'delete node');
    else commit(deleteEdge(g, sel.from, sel.to), 'delete edge');
    setSelection(null);
  }, [selection, commit]);

  const onEdgeWidth = (w: number) => {
    setEdgeWidthM(w);
    if (selection?.kind === 'edge' && Number.isFinite(w) && w > 0) {
      commit(setEdgeWidth(geometryRef.current, selection.from, selection.to, w), 'edge width');
    }
  };

  // ---- dialogs -------------------------------------------------------------------

  const confirmZoneName = () => {
    if (!pendingPolygon) return;
    const { geometry: g2 } = addZone(geometryRef.current, pendingPolygon, zoneName || 'New zone');
    commit(g2, 'add zone');
    setPendingPolygon(null);
    setZoneName('');
    setMode('select');
  };

  const confirmCalibration = () => {
    if (pendingCalib === null || !stored) return;
    const meters = Number(calibMeters);
    if (!Number.isFinite(meters) || meters <= 0) return;
    persistBackdrop({
      ...stored,
      pxPerMeter: stored.pxPerMeter * (pendingCalib / meters),
      calibrated: true,
    });
    setPendingCalib(null);
    setCalibMeters('');
    setMode('select');
  };

  const dialogOpen = pendingPolygon !== null || pendingCalib !== null;

  return (
    <section className="flex h-full min-h-0 flex-col gap-3">
      <Toolbar
        mode={mode}
        onMode={(m) => {
          setMode(m);
          setSelection(null);
        }}
        canUndo={pastRef.current.length > 0}
        canRedo={futureRef.current.length > 0}
        onUndo={undo}
        onRedo={redo}
        gridSnap={gridSnap}
        onGridSnap={setGridSnap}
        edgeWidthM={edgeWidthM}
        onEdgeWidth={onEdgeWidth}
        selection={selection}
        onDeleteSelection={deleteSelection}
        onZoom={(f) => canvasRef.current?.zoomBy(f)}
        onFit={() => canvasRef.current?.fit()}
        hasBackdrop={backdrop !== null}
        backdropOpacity={stored?.opacity ?? 0.55}
        onBackdropOpacity={(v) => stored && persistBackdrop({ ...stored, opacity: v })}
        onBackdropFile={onBackdropFile}
        onClearBackdrop={() => persistBackdrop(null)}
      />

      {storageWarning && (
        <p className="rounded-lg border border-brass/40 bg-panel px-3 py-2 text-xs text-brass">
          {storageWarning}
        </p>
      )}

      <div className="relative min-h-[420px] grow lg:min-h-[520px]">
        <FloorCanvas
          ref={canvasRef}
          geometry={geometry}
          entry={blueprint.entry.position}
          mode={mode}
          selection={selection}
          gridSnap={gridSnap}
          edgeWidthM={edgeWidthM}
          backdrop={backdrop}
          keyboardDisabled={dialogOpen}
          onSelect={setSelection}
          onCommit={commit}
          onDeleteSelection={deleteSelection}
          onZoneDrawn={(polygon) => {
            setPendingPolygon(polygon);
            setZoneName('');
          }}
          onCalibrate={(worldDist) => {
            setPendingCalib(worldDist);
            setCalibMeters('');
          }}
          onUndo={undo}
          onRedo={redo}
        />

        {pendingPolygon && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-ink/70 p-6 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-2xl border border-brass/40 bg-panel p-5">
              <h3 className="font-display text-lg text-parchment">Name this zone</h3>
              <p className="mt-1 text-xs text-stone">
                {pendingPolygon.length} corners drawn. The zone appears below with its own acoustic
                recorder and narration slots.
              </p>
              <input
                autoFocus
                data-testid="zone-name-input"
                value={zoneName}
                onChange={(e) => setZoneName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && confirmZoneName()}
                placeholder="e.g. Temporary Exhibit"
                className="mt-3 w-full rounded-lg border border-hairline bg-ink px-3 py-2 text-sm text-parchment outline-none focus:border-brass"
              />
              <div className="mt-4 flex justify-end gap-2">
                <button
                  data-testid="zone-name-cancel"
                  onClick={() => setPendingPolygon(null)}
                  className="rounded-lg border border-hairline px-4 py-2 text-xs text-stone hover:border-stone"
                >
                  Discard
                </button>
                <button
                  data-testid="zone-name-confirm"
                  onClick={confirmZoneName}
                  disabled={zoneName.trim().length === 0}
                  className="rounded-lg bg-brass px-4 py-2 text-xs font-semibold text-ink disabled:opacity-40"
                >
                  Create zone
                </button>
              </div>
            </div>
          </div>
        )}

        {pendingCalib !== null && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-ink/70 p-6 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-2xl border border-ember/40 bg-panel p-5">
              <h3 className="font-display text-lg text-parchment">Set the real distance</h3>
              <p className="mt-1 text-xs leading-relaxed text-stone">
                How far apart are the two points you marked, in the real building? The backdrop
                rescales to match; geometry you have already drawn does not move.
              </p>
              <div className="mt-3 flex items-center gap-2">
                <input
                  autoFocus
                  data-testid="calib-meters-input"
                  value={calibMeters}
                  onChange={(e) => setCalibMeters(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && confirmCalibration()}
                  inputMode="decimal"
                  placeholder="e.g. 4.5"
                  className="w-full rounded-lg border border-hairline bg-ink px-3 py-2 text-sm text-parchment outline-none focus:border-brass"
                />
                <span className="text-sm text-stone">meters</span>
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  data-testid="calib-cancel"
                  onClick={() => setPendingCalib(null)}
                  className="rounded-lg border border-hairline px-4 py-2 text-xs text-stone hover:border-stone"
                >
                  Cancel
                </button>
                <button
                  data-testid="calib-confirm"
                  onClick={confirmCalibration}
                  disabled={!Number.isFinite(Number(calibMeters)) || Number(calibMeters) <= 0}
                  className="rounded-lg bg-brass px-4 py-2 text-xs font-semibold text-ink disabled:opacity-40"
                >
                  Apply scale
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <p className="text-[11px] leading-relaxed text-stone/70">
        Coordinates are meters in the map frame the engine navigates — the entry marker ◎ is the
        blueprint's start point. The floor-plan image is a tracing aid kept on this device only;
        it is never uploaded and never part of the saved blueprint.
      </p>
    </section>
  );
}
