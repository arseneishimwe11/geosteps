'use client';

import { useRef } from 'react';
import type { CanvasMode, Selection } from './FloorCanvas';

interface Props {
  mode: CanvasMode;
  onMode(m: CanvasMode): void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo(): void;
  onRedo(): void;
  gridSnap: boolean;
  onGridSnap(v: boolean): void;
  edgeWidthM: number;
  onEdgeWidth(w: number): void;
  selection: Selection | null;
  onDeleteSelection(): void;
  onZoom(factor: number): void;
  onFit(): void;
  hasBackdrop: boolean;
  backdropOpacity: number;
  onBackdropOpacity(v: number): void;
  onBackdropFile(file: File): void;
  onClearBackdrop(): void;
}

const MODES: { id: CanvasMode; label: string; testid: string; icon: React.ReactNode }[] = [
  {
    id: 'select',
    label: 'Select',
    testid: 'tool-select',
    icon: (
      <path d="M6 3l12 7.5-5.4 1.4L16 19l-2.8 1.2-3.3-7L6 16.5V3z" fill="currentColor" />
    ),
  },
  {
    id: 'draw-zone',
    label: 'Zone',
    testid: 'tool-draw-zone',
    icon: (
      <path
        d="M5 8l6-4 8 3v9l-7 4-7-3V8z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    ),
  },
  {
    id: 'draw-path',
    label: 'Path',
    testid: 'tool-draw-path',
    icon: (
      <g stroke="currentColor" strokeWidth="1.8" fill="none">
        <circle cx="5" cy="18" r="2.2" />
        <circle cx="12" cy="7" r="2.2" />
        <circle cx="19" cy="15" r="2.2" />
        <path d="M6.5 16.2 10.5 9m3 .8 4 4" />
      </g>
    ),
  },
  {
    id: 'calibrate',
    label: 'Scale',
    testid: 'tool-calibrate',
    icon: (
      <g stroke="currentColor" strokeWidth="1.8" fill="none">
        <path d="M4 20 20 4" />
        <path d="m7 17 1.6 1.6M10 14l1.6 1.6M13 11l1.6 1.6M16 8l1.6 1.6" />
      </g>
    ),
  },
  {
    id: 'pan',
    label: 'Pan',
    testid: 'tool-pan',
    icon: (
      <g stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round">
        <path d="M12 3v18M3 12h18" />
        <path d="m9 5 3-2 3 2M9 19l3 2 3-2M5 9l-2 3 2 3M19 9l2 3-2 3" />
      </g>
    ),
  },
];

function IconButton({
  title,
  testid,
  active,
  disabled,
  onClick,
  children,
  label,
}: {
  title: string;
  testid?: string;
  active?: boolean;
  disabled?: boolean;
  onClick(): void;
  children: React.ReactNode;
  label?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      data-testid={testid}
      disabled={disabled}
      onClick={onClick}
      className={
        'flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs transition-colors disabled:opacity-35 ' +
        (active
          ? 'border-brass bg-brass/15 text-brass-bright'
          : 'border-hairline text-stone hover:border-stone')
      }
    >
      <svg width="18" height="18" viewBox="0 0 24 24" className="shrink-0">
        {children}
      </svg>
      {label && <span className="hidden md:inline">{label}</span>}
    </button>
  );
}

/** The canvas control strip — wraps on desktop, scrolls horizontally on phones. */
export function Toolbar(p: Props) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 [scrollbar-width:thin]">
      <div className="flex shrink-0 items-center gap-1.5 rounded-xl border border-hairline/60 bg-panel p-1">
        {MODES.map((m) => (
          <IconButton
            key={m.id}
            title={m.label}
            testid={m.testid}
            active={p.mode === m.id}
            onClick={() => p.onMode(m.id)}
            label={m.label}
          >
            {m.icon}
          </IconButton>
        ))}
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <IconButton title="Undo (Ctrl+Z)" testid="canvas-undo" disabled={!p.canUndo} onClick={p.onUndo}>
          <path d="M9 14 4 9l5-5M4 9h9a6 6 0 0 1 0 12h-2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </IconButton>
        <IconButton title="Redo (Shift+Ctrl+Z)" testid="canvas-redo" disabled={!p.canRedo} onClick={p.onRedo}>
          <path d="m15 14 5-5-5-5M20 9h-9a6 6 0 0 0 0 12h2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </IconButton>
        <IconButton
          title="Delete selection (Del)"
          testid="canvas-delete"
          disabled={!p.selection}
          onClick={p.onDeleteSelection}
        >
          <path d="M5 7h14M9 7V5h6v2m-8 0 1 13h8l1-13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </IconButton>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <IconButton title="Zoom out" onClick={() => p.onZoom(1 / 1.3)}>
          <path d="M8 11h6m5.5 9.5L16 17M4 11a7 7 0 1 0 14 0 7 7 0 0 0-14 0Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </IconButton>
        <IconButton title="Zoom in" onClick={() => p.onZoom(1.3)}>
          <path d="M11 8v6M8 11h6m5.5 9.5L16 17M4 11a7 7 0 1 0 14 0 7 7 0 0 0-14 0Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </IconButton>
        <IconButton title="Fit to drawing" testid="canvas-fit" onClick={p.onFit}>
          <path d="M8 4H4v4m12-4h4v4M8 20H4v-4m12 4h4v-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </IconButton>
      </div>

      <label className="flex shrink-0 items-center gap-1.5 rounded-lg border border-hairline px-2.5 py-2 text-xs text-stone">
        <input
          type="checkbox"
          checked={p.gridSnap}
          onChange={(e) => p.onGridSnap(e.target.checked)}
          className="accent-[var(--color-brass)]"
        />
        <span className="whitespace-nowrap">snap 0.5 m</span>
      </label>

      <label className="flex shrink-0 items-center gap-1.5 rounded-lg border border-hairline px-2.5 py-2 text-xs text-stone">
        <span className="whitespace-nowrap">path width</span>
        <input
          data-testid="edge-width-input"
          type="number"
          min={0.5}
          step={0.5}
          value={p.edgeWidthM}
          onChange={(e) => p.onEdgeWidth(Number(e.target.value))}
          className="w-14 rounded border border-hairline bg-ink px-1.5 py-0.5 text-parchment"
        />
        <span>m</span>
      </label>

      <div className="flex shrink-0 items-center gap-1.5">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          data-testid="backdrop-file"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) p.onBackdropFile(f);
            e.target.value = '';
          }}
        />
        <IconButton title="Upload floor-plan image" testid="backdrop-upload" onClick={() => fileRef.current?.click()} label="Floor plan">
          <g stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="4" width="16" height="16" rx="2" />
            <circle cx="9" cy="9" r="1.6" />
            <path d="m5 17 5-5 4 4 2-2 3 3" />
          </g>
        </IconButton>
        {p.hasBackdrop && (
          <>
            <label className="flex shrink-0 items-center gap-1.5 text-xs text-stone">
              <span className="hidden lg:inline">opacity</span>
              <input
                type="range"
                min={0.1}
                max={1}
                step={0.05}
                value={p.backdropOpacity}
                onChange={(e) => p.onBackdropOpacity(Number(e.target.value))}
                className="w-20 accent-[var(--color-brass)]"
              />
            </label>
            <IconButton title="Remove backdrop" onClick={p.onClearBackdrop}>
              <path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </IconButton>
          </>
        )}
      </div>
    </div>
  );
}
