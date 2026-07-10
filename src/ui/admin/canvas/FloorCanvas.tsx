'use client';

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { Point } from '../../../engine/types';
import {
  addGraphNode,
  connectNodes,
  moveGraphNode,
  moveZoneVertex,
  nearestNode,
  snapToGrid,
  type GeometrySnapshot,
} from './editorOps';
import {
  contentBounds,
  fitView,
  panBy,
  screenToWorld,
  worldToScreen,
  zoomAt,
  type ViewTransform,
} from './view';

export type CanvasMode = 'select' | 'draw-zone' | 'draw-path' | 'calibrate' | 'pan';

export type Selection =
  | { kind: 'zone'; id: string }
  | { kind: 'vertex'; zoneId: string; index: number }
  | { kind: 'node'; id: string }
  | { kind: 'edge'; from: string; to: string };

export interface Backdrop {
  url: string;
  widthM: number;
  heightM: number;
  opacity: number;
  calibrated: boolean;
}

export interface FloorCanvasHandle {
  fit(): void;
  zoomBy(factor: number): void;
}

interface Props {
  geometry: GeometrySnapshot;
  entry: Point;
  mode: CanvasMode;
  selection: Selection | null;
  gridSnap: boolean;
  edgeWidthM: number;
  backdrop: Backdrop | null;
  /** True while a dialog is open — suspends canvas keyboard shortcuts. */
  keyboardDisabled: boolean;
  onSelect(sel: Selection | null): void;
  onCommit(g: GeometrySnapshot, label: string): void;
  onDeleteSelection(): void;
  onZoneDrawn(polygon: Point[]): void;
  /** Two calibration points were placed this far apart in current world meters. */
  onCalibrate(worldDistance: number): void;
  onUndo(): void;
  onRedo(): void;
}

const CLICK_SLOP_PX = 5;
const NODE_SNAP_M = 0.6;

interface DragState {
  pointerId: number;
  startScreen: Point;
  lastScreen: Point;
  moved: boolean;
  target:
    | { kind: 'vertex'; zoneId: string; index: number }
    | { kind: 'node'; id: string }
    | { kind: 'canvas' };
}

interface PinchState {
  ids: [number, number];
  startDist: number;
  startView: ViewTransform;
  startMid: Point;
}

/**
 * The drawing surface. Renders the working geometry over an optional
 * floor-plan backdrop and turns pointer gestures into the pure operations
 * from editorOps. Owns only interaction state (view transform, in-progress
 * polygon, drag ghosts); committed geometry always flows down from props
 * and back up through onCommit.
 */
export const FloorCanvas = forwardRef<FloorCanvasHandle, Props>(function FloorCanvas(
  {
    geometry,
    entry,
    mode,
    selection,
    gridSnap,
    edgeWidthM,
    backdrop,
    keyboardDisabled,
    onSelect,
    onCommit,
    onDeleteSelection,
    onZoneDrawn,
    onCalibrate,
    onUndo,
    onRedo,
  },
  ref,
) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [view, setView] = useState<ViewTransform | null>(null);
  const [draft, setDraft] = useState<Point[]>([]); // draw-zone in progress
  const [pathAnchor, setPathAnchor] = useState<string | null>(null); // draw-path chain
  const [calib, setCalib] = useState<Point[]>([]);
  const [ghost, setGhost] = useState<GeometrySnapshot | null>(null); // live drag preview
  const [hoverW, setHoverW] = useState<Point | null>(null);

  const drag = useRef<DragState | null>(null);
  const pinch = useRef<PinchState | null>(null);
  const pointers = useRef(new Map<number, Point>());

  const g = ghost ?? geometry;
  const nodeById = useMemo(() => new Map(g.graph.nodes.map((n) => [n.id, n])), [g.graph.nodes]);

  // ---- view lifecycle -------------------------------------------------------

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const doFit = () => {
    const b = contentBounds(geometry, backdrop ? { w: backdrop.widthM, h: backdrop.heightM } : null);
    setView(fitView(b, size.w, size.h));
  };
  // First fit once we know our size (and refit if the backdrop scale changes).
  const backdropKey = backdrop ? `${backdrop.widthM.toFixed(3)}` : 'none';
  useEffect(() => {
    if (size.w > 0 && size.h > 0) doFit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size.w === 0, backdropKey]);

  useImperativeHandle(ref, () => ({
    fit: doFit,
    zoomBy: (factor: number) => {
      if (view) setView(zoomAt(view, { x: size.w / 2, y: size.h / 2 }, factor));
    },
  }));

  // Non-passive wheel zoom (React's onWheel can't preventDefault reliably).
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = svg.getBoundingClientRect();
      const at = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      setView((v) => (v ? zoomAt(v, at, Math.exp(-e.deltaY * 0.0015)) : v));
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, []);

  // ---- keyboard -------------------------------------------------------------

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (keyboardDisabled) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) onRedo();
        else onUndo();
        return;
      }
      if (e.key === 'Escape') {
        setDraft([]);
        setPathAnchor(null);
        setCalib([]);
        onSelect(null);
        return;
      }
      if (e.key === 'Enter' && mode === 'draw-zone' && draft.length >= 3) {
        const polygon = draft;
        setDraft([]);
        onZoneDrawn(polygon);
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selection) {
        e.preventDefault();
        onDeleteSelection();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // ---- pointer machinery ----------------------------------------------------

  const eventScreen = (e: React.PointerEvent): Point => {
    const rect = svgRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const maybeSnap = (p: Point): Point => (gridSnap ? snapToGrid(p, 0.5) : p);

  const targetFromDom = (e: React.PointerEvent): DragState['target'] => {
    const el = (e.target as Element).closest('[data-kind]');
    if (el) {
      const kind = el.getAttribute('data-kind');
      if (kind === 'vertex') {
        return {
          kind: 'vertex',
          zoneId: el.getAttribute('data-zone')!,
          index: Number(el.getAttribute('data-index')),
        };
      }
      if (kind === 'node') return { kind: 'node', id: el.getAttribute('data-id')! };
    }
    return { kind: 'canvas' };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!view) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const s = eventScreen(e);
    pointers.current.set(e.pointerId, s);

    if (pointers.current.size === 2) {
      // Second finger: switch to pinch, abandon any drag.
      const [a, b] = [...pointers.current.entries()];
      drag.current = null;
      setGhost(null);
      pinch.current = {
        ids: [a![0], b![0]],
        startDist: Math.hypot(a![1].x - b![1].x, a![1].y - b![1].y),
        startView: view,
        startMid: { x: (a![1].x + b![1].x) / 2, y: (a![1].y + b![1].y) / 2 },
      };
      return;
    }

    drag.current = {
      pointerId: e.pointerId,
      startScreen: s,
      lastScreen: s,
      moved: false,
      target: mode === 'select' ? targetFromDom(e) : { kind: 'canvas' },
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!view) return;
    const s = eventScreen(e);
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, s);
    setHoverW(screenToWorld(view, s));

    if (pinch.current) {
      const [idA, idB] = pinch.current.ids;
      const a = pointers.current.get(idA);
      const b = pointers.current.get(idB);
      if (!a || !b) return;
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const factor = dist / Math.max(1, pinch.current.startDist);
      let v = zoomAt(pinch.current.startView, pinch.current.startMid, factor);
      v = panBy(v, mid.x - pinch.current.startMid.x, mid.y - pinch.current.startMid.y);
      setView(v);
      return;
    }

    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    if (!d.moved && Math.hypot(s.x - d.startScreen.x, s.y - d.startScreen.y) < CLICK_SLOP_PX) return;
    d.moved = true;

    if (d.target.kind === 'vertex') {
      const w = maybeSnap(screenToWorld(view, s));
      setGhost(moveZoneVertex(geometry, d.target.zoneId, d.target.index, w));
    } else if (d.target.kind === 'node') {
      const w = maybeSnap(screenToWorld(view, s));
      setGhost(moveGraphNode(geometry, d.target.id, w));
    } else {
      setView(panBy(view, s.x - d.lastScreen.x, s.y - d.lastScreen.y));
    }
    d.lastScreen = s;
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pinch.current && pinch.current.ids.includes(e.pointerId)) {
      pinch.current = null;
      return;
    }
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId || !view) return;
    drag.current = null;

    if (d.moved) {
      if (ghost && (d.target.kind === 'vertex' || d.target.kind === 'node')) {
        onCommit(ghost, d.target.kind === 'vertex' ? 'move vertex' : 'move node');
      }
      setGhost(null);
      return;
    }

    // A true click/tap — semantics depend on the tool.
    const s = eventScreen(e);
    const w = screenToWorld(view, s);

    if (mode === 'select') {
      const el = (e.target as Element).closest('[data-kind]');
      if (!el) return onSelect(null);
      const kind = el.getAttribute('data-kind');
      if (kind === 'vertex')
        return onSelect({
          kind: 'vertex',
          zoneId: el.getAttribute('data-zone')!,
          index: Number(el.getAttribute('data-index')),
        });
      if (kind === 'node') return onSelect({ kind: 'node', id: el.getAttribute('data-id')! });
      if (kind === 'edge')
        return onSelect({
          kind: 'edge',
          from: el.getAttribute('data-from')!,
          to: el.getAttribute('data-to')!,
        });
      if (kind === 'zone') return onSelect({ kind: 'zone', id: el.getAttribute('data-zone')! });
      return onSelect(null);
    }

    if (mode === 'draw-zone') {
      // Closing tap: near the first vertex (screen-space tolerance).
      if (draft.length >= 3) {
        const first = worldToScreen(view, draft[0]!);
        if (Math.hypot(first.x - s.x, first.y - s.y) < 12) {
          const polygon = draft;
          setDraft([]);
          onZoneDrawn(polygon);
          return;
        }
      }
      setDraft((dv) => [...dv, maybeSnap(w)]);
      return;
    }

    if (mode === 'draw-path') {
      const hit = nearestNode(g.graph, w, NODE_SNAP_M);
      if (hit) {
        if (pathAnchor && pathAnchor !== hit) {
          onCommit(connectNodes(geometry, pathAnchor, hit, edgeWidthM), 'connect nodes');
        }
        setPathAnchor(hit);
        return;
      }
      const point = maybeSnap(w);
      const added = addGraphNode(geometry, point);
      const withEdge = pathAnchor
        ? connectNodes(added.geometry, pathAnchor, added.nodeId, edgeWidthM)
        : added.geometry;
      onCommit(withEdge, 'add walkable node');
      setPathAnchor(added.nodeId);
      return;
    }

    if (mode === 'calibrate') {
      const pts = [...calib, w];
      if (pts.length === 2) {
        setCalib([]);
        onCalibrate(Math.hypot(pts[1]!.x - pts[0]!.x, pts[1]!.y - pts[0]!.y));
      } else {
        setCalib(pts);
      }
    }
  };

  // Reset transient tool state when the tool changes.
  useEffect(() => {
    setDraft([]);
    setPathAnchor(null);
    setCalib([]);
    setGhost(null);
  }, [mode]);

  // ---- render ---------------------------------------------------------------

  const s = view?.scale ?? 12;
  const o = view?.originPx ?? { x: 0, y: 0 };
  const px = (n: number) => n / s; // constant-screen-px lengths in world units

  const hintByMode: Record<CanvasMode, string> = {
    select: 'Tap to select · drag vertices and nodes to move · Delete removes',
    'draw-zone':
      draft.length === 0
        ? 'Tap to place the first corner of the zone'
        : draft.length < 3
          ? `Corner ${draft.length} placed — keep tapping (${3 - draft.length} more to close)`
          : 'Tap the first corner (or press Enter) to close the zone · Esc cancels',
    'draw-path': pathAnchor
      ? 'Tap to extend the path · tap an existing node to connect · Esc ends the chain'
      : 'Tap where a walkable path starts (or tap an existing node to continue from it)',
    calibrate:
      calib.length === 0
        ? 'Tap one end of a distance you know (a doorway, a measured wall)'
        : 'Tap the other end — then enter the real distance',
    pan: 'Drag to pan · pinch or scroll to zoom',
  };

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden rounded-2xl border border-hairline bg-ink">
      <svg
        ref={svgRef}
        data-testid="floor-canvas"
        data-scale={s}
        data-ox={o.x}
        data-oy={o.y}
        className="h-full w-full touch-none select-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={() => setHoverW(null)}
      >
        {view && (
          <g transform={`translate(${o.x} ${o.y}) scale(${s} ${-s})`}>
            <defs>
              <pattern id="grid-minor" width="1" height="1" patternUnits="userSpaceOnUse">
                <path d="M 1 0 L 0 0 0 1" fill="none" stroke="var(--color-hairline)" strokeWidth={px(0.7)} opacity="0.5" />
              </pattern>
              <pattern id="grid-major" width="5" height="5" patternUnits="userSpaceOnUse">
                <rect width="5" height="5" fill="url(#grid-minor)" />
                <path d="M 5 0 L 0 0 0 5" fill="none" stroke="var(--color-hairline)" strokeWidth={px(1.2)} />
              </pattern>
            </defs>

            {/* backdrop image (counter-flipped so it renders upright) */}
            {backdrop && (
              <image
                href={backdrop.url}
                x={0}
                y={-backdrop.heightM}
                width={backdrop.widthM}
                height={backdrop.heightM}
                transform="scale(1,-1)"
                opacity={backdrop.opacity}
                preserveAspectRatio="none"
              />
            )}

            {/* meter grid over everything visible */}
            <rect x={-500} y={-500} width={1000} height={1000} fill="url(#grid-major)" pointerEvents="none" />

            {/* walkable edges: capsule ribbons + fat invisible hit strokes */}
            {g.graph.edges.map((edge, i) => {
              const a = nodeById.get(edge.from);
              const b = nodeById.get(edge.to);
              if (!a || !b) return null;
              const sel =
                selection?.kind === 'edge' &&
                ((selection.from === edge.from && selection.to === edge.to) ||
                  (selection.from === edge.to && selection.to === edge.from));
              return (
                <g key={`e${i}`}>
                  <line
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke={sel ? 'var(--color-brass)' : 'var(--color-moss)'}
                    strokeOpacity={sel ? 0.5 : 0.28}
                    strokeWidth={edge.widthM}
                    strokeLinecap="round"
                  />
                  <line
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke={sel ? 'var(--color-brass)' : 'var(--color-moss)'}
                    strokeWidth={px(1.5)}
                    strokeDasharray={`${px(6)} ${px(5)}`}
                    opacity={0.9}
                  />
                  <line
                    data-kind="edge"
                    data-from={edge.from}
                    data-to={edge.to}
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke="transparent"
                    strokeWidth={Math.max(edge.widthM, px(14))}
                    strokeLinecap="round"
                  />
                </g>
              );
            })}

            {/* zones */}
            {g.zones.map((z) => {
              const zSel = selection?.kind === 'zone' && selection.id === z.id;
              const showHandles =
                zSel || (selection?.kind === 'vertex' && selection.zoneId === z.id);
              const cx = z.polygon.reduce((acc, p) => acc + p.x, 0) / z.polygon.length;
              const cy = z.polygon.reduce((acc, p) => acc + p.y, 0) / z.polygon.length;
              // Labels only when the zone is wide enough on screen to hold
              // them — crowded labels at low zoom are worse than none
              // (selected zones always get theirs).
              const zoneWidthPx = (Math.max(...z.polygon.map((p) => p.x)) - Math.min(...z.polygon.map((p) => p.x))) * s;
              const showLabel = zSel || zoneWidthPx > 8.5 * z.name.length;
              return (
                <g key={z.id}>
                  <polygon
                    data-kind="zone"
                    data-zone={z.id}
                    points={z.polygon.map((p) => `${p.x},${p.y}`).join(' ')}
                    fill={
                      zSel
                        ? 'color-mix(in oklab, var(--color-brass) 26%, transparent)'
                        : 'color-mix(in oklab, var(--color-brass) 10%, transparent)'
                    }
                    stroke="var(--color-brass)"
                    strokeOpacity={zSel ? 1 : 0.55}
                    strokeWidth={px(zSel ? 2 : 1.2)}
                  />
                  {showLabel && (
                    <text
                      transform={`translate(${cx} ${cy}) scale(1,-1)`}
                      textAnchor="middle"
                      fontSize={px(12)}
                      fill="var(--color-parchment)"
                      opacity={0.85}
                      style={{ fontFamily: 'var(--font-body)' }}
                      pointerEvents="none"
                    >
                      {z.name}
                    </text>
                  )}
                  {showHandles &&
                    z.polygon.map((p, i) => {
                      const vSel = selection?.kind === 'vertex' && selection.zoneId === z.id && selection.index === i;
                      return (
                        <circle
                          key={i}
                          data-kind="vertex"
                          data-zone={z.id}
                          data-index={i}
                          cx={p.x}
                          cy={p.y}
                          r={px(vSel ? 8 : 6)}
                          fill={vSel ? 'var(--color-brass-bright)' : 'var(--color-ink)'}
                          stroke="var(--color-brass)"
                          strokeWidth={px(1.5)}
                        />
                      );
                    })}
                </g>
              );
            })}

            {/* walkable nodes */}
            {g.graph.nodes.map((n) => {
              const sel =
                (selection?.kind === 'node' && selection.id === n.id) || pathAnchor === n.id;
              return (
                <circle
                  key={n.id}
                  data-kind="node"
                  data-id={n.id}
                  cx={n.x}
                  cy={n.y}
                  r={px(sel ? 7 : 5)}
                  fill={sel ? 'var(--color-moss)' : 'var(--color-ink)'}
                  stroke="var(--color-moss)"
                  strokeWidth={px(1.6)}
                />
              );
            })}

            {/* entry marker */}
            <g pointerEvents="none">
              <circle cx={entry.x} cy={entry.y} r={px(9)} fill="none" stroke="var(--color-brass-bright)" strokeWidth={px(1.4)} />
              <circle cx={entry.x} cy={entry.y} r={px(3)} fill="var(--color-brass-bright)" />
            </g>

            {/* in-progress zone */}
            {draft.length > 0 && (
              <g pointerEvents="none">
                <polyline
                  points={draft.map((p) => `${p.x},${p.y}`).join(' ')}
                  fill="none"
                  stroke="var(--color-brass-bright)"
                  strokeWidth={px(1.6)}
                  strokeDasharray={`${px(5)} ${px(4)}`}
                />
                {hoverW && (
                  <line
                    x1={draft[draft.length - 1]!.x}
                    y1={draft[draft.length - 1]!.y}
                    x2={hoverW.x}
                    y2={hoverW.y}
                    stroke="var(--color-brass-bright)"
                    strokeWidth={px(1)}
                    opacity={0.5}
                  />
                )}
                {draft.map((p, i) => (
                  <circle
                    key={i}
                    cx={p.x}
                    cy={p.y}
                    r={px(i === 0 && draft.length >= 3 ? 9 : 4)}
                    fill={i === 0 && draft.length >= 3 ? 'color-mix(in oklab, var(--color-brass) 35%, transparent)' : 'var(--color-brass-bright)'}
                    stroke="var(--color-brass-bright)"
                    strokeWidth={px(1.2)}
                  />
                ))}
              </g>
            )}

            {/* calibration picks */}
            {calib.map((p, i) => (
              <g key={i} pointerEvents="none">
                <circle cx={p.x} cy={p.y} r={px(6)} fill="none" stroke="var(--color-ember)" strokeWidth={px(1.6)} />
                <circle cx={p.x} cy={p.y} r={px(1.6)} fill="var(--color-ember)" />
              </g>
            ))}
            {calib.length === 1 && hoverW && (
              <line
                x1={calib[0]!.x}
                y1={calib[0]!.y}
                x2={hoverW.x}
                y2={hoverW.y}
                stroke="var(--color-ember)"
                strokeWidth={px(1.2)}
                strokeDasharray={`${px(4)} ${px(3)}`}
                pointerEvents="none"
              />
            )}
          </g>
        )}
      </svg>

      {/* HUD */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-3">
        <p className="max-w-[70%] rounded-lg bg-ink/80 px-3 py-1.5 text-[11px] leading-snug text-stone backdrop-blur">
          {hintByMode[mode]}
        </p>
        <p className="rounded-lg bg-ink/80 px-2.5 py-1.5 font-mono text-[10px] text-stone/80 backdrop-blur">
          {hoverW ? `${hoverW.x.toFixed(1)}, ${hoverW.y.toFixed(1)} m · ` : ''}
          {s.toFixed(0)} px/m
        </p>
      </div>
      {backdrop && !backdrop.calibrated && (
        <p className="absolute left-3 top-3 rounded-lg border border-ember/50 bg-ember-deep/70 px-3 py-1.5 text-[11px] text-parchment backdrop-blur">
          Backdrop not calibrated — use the ruler tool on a known distance before tracing.
        </p>
      )}
    </div>
  );
});
