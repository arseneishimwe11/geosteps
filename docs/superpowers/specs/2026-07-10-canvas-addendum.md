# Addendum: Floor-Plan Drawing Canvas (Phase C run 2, max effort)

Extends `2026-07-10-phase-c-ui-design.md`. Scope: the admin zone-polygon +
walkable-graph editor, responsive for desktop and mobile.

## Decisions

**The floor-plan image never enters the blueprint.** The schema is frozen at
v1 and has no image field; more importantly, the runtime doesn't need it —
the image is a *tracing aid*. It lives client-side (downscaled to ≤2048 px
JPEG, persisted per-venue in localStorage alongside its scale calibration) so
staff keep their backdrop across sessions on the same device. A future
schemaVersion 2 could host it server-side; explicitly out of scope.

**Coordinates.** Geometry is authored directly in the map frame (meters,
+Y up) — the same frame the engine consumes; no export-time conversion
exists to go wrong. The canvas maintains a world↔screen transform
(pan/zoom); the image backdrop is placed at world origin with size
`imagePx / pxPerMeter`.

**Scale calibration.** After uploading an image, staff click two points a
known real distance apart (a doorway, a measured wall) and type the meters.
This rescales the *image* under the fixed meter grid (`pxPerMeter ×=
d_world / m`); geometry already drawn never moves. Skippable (default fits
the image to 40 m width) with a visible "uncalibrated" warning.

**Modes** (single active tool, keyboard + touch parity):
- `select` — click to select zone/vertex/node/edge; drag vertices and nodes;
  Delete removes selection (zones whole; vertices only above 3; nodes cascade
  their edges); rename via the zone card.
- `draw-zone` — tap to place vertices; tap the first vertex (or Enter) to
  close, minimum 3; Esc cancels; a dialog names the zone (id = unique slug),
  which then appears as a normal zone card below (recorder + audio slots
  attach automatically, audio starts empty = validator warning, not error).
- `draw-path` — tap empty space to drop a node chained by an edge to the
  previous one; tap an existing node to continue/branch from it; edges take
  the toolbar's current width (m); duplicate and self edges are refused;
  Esc ends the chain.
- `calibrate` — the two-click scale flow above.
- `pan` — explicit drag-to-pan for touch; wheel/pinch zoom work in every
  mode, as does two-finger pan.

**Undo/redo** — snapshot history (cap 100) of `{zones, graph}` in the panel;
drags commit one entry on pointer-up. Cmd/Ctrl+Z, Shift+Cmd/Ctrl+Z, toolbar
buttons.

**Snapping** — always to nearby graph nodes (connect rather than duplicate);
optional 0.5 m grid snap, default on.

**Responsiveness** — admin becomes two-pane on `lg+` (sticky canvas left,
scrolling zone cards right), stacked on mobile with a horizontally scrollable
toolbar and full touch support (`touch-action: none`, pointer events, pinch
zoom). Tour guide screen gains an `lg` two-column layout (map beside status);
phone remains the primary target.

**Out of scope (deliberate):** image rotation/skew, multi-select, copy/paste,
polygon boolean ops, mid-edge vertex insertion, graph auto-layout. A regional
museum traces a dozen rooms; these would be tool-vanity, not staff value.

## Architecture

```
src/ui/admin/canvas/
  editorOps.ts     pure geometry operations on {zones, graph} — unit tested
  view.ts          world↔screen transform helpers + fit/zoom math
  FloorCanvas.tsx  SVG rendering + pointer state machine (no business logic)
  Toolbar.tsx      mode/undo/zoom/snap/width/backdrop controls
  CanvasPanel.tsx  glue: history, dialogs, localStorage backdrop, callbacks
```

AdminApp stays the single owner of the working blueprint; the canvas
receives `{zones, graph}` and emits whole-geometry updates through the same
`setBlueprint` path the recorder and audio slots already use — so
validation, dirty tracking, and save gating apply unchanged.
