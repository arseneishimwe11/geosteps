/**
 * World↔screen transform for the floor-plan canvas.
 *
 * World = map-frame meters, +Y up (the frozen blueprint frame).
 * Screen = CSS pixels inside the SVG, +y down.
 *
 *   screenX = originPx.x + scale * worldX
 *   screenY = originPx.y - scale * worldY
 *
 * `originPx` is where world (0,0) lands on screen; `scale` is px per meter.
 */
import type { Point } from '../../../engine/types';
import type { GeometrySnapshot } from './editorOps';

export interface ViewTransform {
  originPx: Point;
  scale: number; // px per meter
}

export const worldToScreen = (v: ViewTransform, p: Point): Point => ({
  x: v.originPx.x + v.scale * p.x,
  y: v.originPx.y - v.scale * p.y,
});

export const screenToWorld = (v: ViewTransform, s: Point): Point => ({
  x: (s.x - v.originPx.x) / v.scale,
  y: (v.originPx.y - s.y) / v.scale,
});

/** Zoom by `factor` keeping the screen point `at` fixed. */
export function zoomAt(v: ViewTransform, at: Point, factor: number, min = 2, max = 400): ViewTransform {
  const scale = Math.min(max, Math.max(min, v.scale * factor));
  const k = scale / v.scale;
  return {
    scale,
    originPx: { x: at.x - (at.x - v.originPx.x) * k, y: at.y - (at.y - v.originPx.y) * k },
  };
}

export function panBy(v: ViewTransform, dxPx: number, dyPx: number): ViewTransform {
  return { ...v, originPx: { x: v.originPx.x + dxPx, y: v.originPx.y + dyPx } };
}

export interface WorldBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Bounds of everything drawable: geometry plus the (optional) backdrop image. */
export function contentBounds(
  g: GeometrySnapshot,
  imageSizeM: { w: number; h: number } | null,
): WorldBounds | null {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const z of g.zones) for (const p of z.polygon) (xs.push(p.x), ys.push(p.y));
  for (const n of g.graph.nodes) (xs.push(n.x), ys.push(n.y));
  if (imageSizeM) (xs.push(0, imageSizeM.w), ys.push(0, imageSizeM.h));
  if (xs.length === 0) return null;
  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  };
}

/** A view that fits `bounds` into a widthPx×heightPx viewport with padding. */
export function fitView(
  bounds: WorldBounds | null,
  widthPx: number,
  heightPx: number,
  padPx = 40,
): ViewTransform {
  if (!bounds || widthPx <= 0 || heightPx <= 0) {
    return { originPx: { x: 60, y: heightPx - 60 }, scale: 12 };
  }
  const w = Math.max(bounds.maxX - bounds.minX, 1);
  const h = Math.max(bounds.maxY - bounds.minY, 1);
  const scale = Math.min((widthPx - 2 * padPx) / w, (heightPx - 2 * padPx) / h);
  const clamped = Math.min(400, Math.max(2, scale));
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cy = (bounds.minY + bounds.maxY) / 2;
  return {
    scale: clamped,
    originPx: { x: widthPx / 2 - clamped * cx, y: heightPx / 2 + clamped * cy },
  };
}
