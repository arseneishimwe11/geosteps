'use client';

import type { FloorBlueprint, PositionState } from '../../engine/types';

/**
 * Pure rendering of the blueprint's declared geometry plus the engine's
 * reported position — zones as outlines, walkable graph as faint strokes,
 * the visitor as a dot inside a deliberately fuzzy uncertainty disc.
 * Nothing here computes position; the highlighted zone comes from
 * PositionState.currentZoneId, not from any containment math of our own.
 */
export function Minimap({
  blueprint,
  position,
}: {
  blueprint: FloorBlueprint;
  position: PositionState | null;
}) {
  // Bounds of everything the blueprint declares, with a margin.
  const xs: number[] = [];
  const ys: number[] = [];
  for (const z of blueprint.zones) for (const p of z.polygon) (xs.push(p.x), ys.push(p.y));
  for (const n of blueprint.graph.nodes) (xs.push(n.x), ys.push(n.y));
  const pad = 2;
  const minX = Math.min(...xs) - pad;
  const maxX = Math.max(...xs) + pad;
  const minY = Math.min(...ys) - pad;
  const maxY = Math.max(...ys) + pad;
  const nodeById = new Map(blueprint.graph.nodes.map((n) => [n.id, n]));

  // Map frame is y-up; SVG is y-down — flip by drawing at (x, maxY+minY-y).
  const fy = (y: number) => maxY + minY - y;

  return (
    <svg
      viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`}
      className="w-full rounded-2xl border border-hairline bg-panel"
      role="img"
      aria-label="Floor map with your approximate position"
    >
      {/* walkable graph — faint, structural */}
      {blueprint.graph.edges.map((e, i) => {
        const a = nodeById.get(e.from);
        const b = nodeById.get(e.to);
        if (!a || !b) return null;
        return (
          <line
            key={i}
            x1={a.x}
            y1={fy(a.y)}
            x2={b.x}
            y2={fy(b.y)}
            stroke="var(--color-hairline)"
            strokeWidth={e.widthM}
            strokeLinecap="round"
            opacity={0.6}
          />
        );
      })}

      {/* zones — only the active one is labeled (the header names it too);
          labeling every room at phone scale turns into overlapping noise */}
      {blueprint.zones.map((z) => {
        const active = position?.currentZoneId === z.id;
        const points = z.polygon.map((p) => `${p.x},${fy(p.y)}`).join(' ');
        const cx = z.polygon.reduce((s, p) => s + p.x, 0) / z.polygon.length;
        const cy = z.polygon.reduce((s, p) => s + p.y, 0) / z.polygon.length;
        return (
          <g key={z.id}>
            <polygon
              points={points}
              fill={active ? 'color-mix(in oklab, var(--color-brass) 22%, transparent)' : 'transparent'}
              stroke={active ? 'var(--color-brass)' : 'var(--color-stone)'}
              strokeWidth={active ? 0.35 : 0.18}
              opacity={active ? 1 : 0.55}
            />
            {active && (
              <text
                x={cx}
                y={fy(cy) - 2.2}
                textAnchor="middle"
                fontSize={1.15}
                fill="var(--color-brass-bright)"
                style={{ fontFamily: 'var(--font-body)' }}
              >
                {z.name}
              </text>
            )}
          </g>
        );
      })}

      {/* the visitor: fuzzy disc first (honest uncertainty), dot second */}
      {position && (
        <g data-testid="minimap-position">
          <circle
            cx={position.position.x}
            cy={fy(position.position.y)}
            r={Math.max(position.uncertaintyM, 0.8)}
            fill="var(--color-brass)"
            opacity={0.16}
          />
          <circle
            cx={position.position.x}
            cy={fy(position.position.y)}
            r={Math.max(position.uncertaintyM, 0.8)}
            fill="none"
            stroke="var(--color-brass)"
            strokeWidth={0.12}
            opacity={0.5}
          />
          <circle
            cx={position.position.x}
            cy={fy(position.position.y)}
            r={0.45}
            fill="var(--color-brass-bright)"
          />
        </g>
      )}
    </svg>
  );
}
