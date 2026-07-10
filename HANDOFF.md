# HANDOFF — geosteps Phase B

For the next session (Phase C, UI + content management, planned on Opus 4.8).
Phase A froze the data model and the engine API; this document is the
contract. Read ARCHITECTURE.md first for *why* everything is the way it is.

---

## 1. Frozen: the floor-blueprint schema

`src/engine/types.ts` — `FloorBlueprint` with `schemaVersion: 1`. Summary:

| Field | Type | Notes |
|---|---|---|
| `schemaVersion` | `1` | Bump only with a migration path. |
| `venue` | `{ id, name, languages[], defaultLanguage }` | Languages configurable per venue (en/fr/rw/sw/de/…). |
| `entry.position` | `{x, y}` m | Where the QR code stands; the engine's starting fix. |
| `zones[]` | `{ id, name, polygon[], audio, fingerprint? }` | Polygons on the map plane. **Never an ordered list.** Zones don't overlap. |
| `zones[].audio` | `{ [lang]: { url, durationSec?, title? } }` | Per-zone, per-language narration. |
| `zones[].fingerprint` | `AcousticFingerprint?` | `band-energy-v1`: 16 log bands [100, 7200] Hz, energies sum to 1. Versioned for future methods (e.g. impulse/RT60). |
| `graph` | `{ nodes[], edges[] }` | Edges have `widthM`; walkable space = union of edge capsules; everything else is wall. |
| `calibration` | `{ headingOffsetDeg, defaultStrideM, stepDetector?, geofence?, acoustic? }` | `headingOffsetDeg` = compass bearing of map +Y. `acoustic` includes the corrector gates: `minConfidence`, `minMargin`, `candidateBaseRadiusM`, `candidateUncertaintyFactor`, `consecutiveAgreements`, `maxStreakGapMs`. |

Validation: `validateBlueprint(json)` returns `{ ok, errors[], warnings[] }` —
complete list, not first-error. The server already refuses invalid PUTs with
422 + that list; the admin UI should render `warnings` too (small-zone,
missing-default-language).

## 2. Frozen: the position-engine API

Import everything from `src/engine/index.ts`.

```ts
const engine = new PositionEngine(blueprint, cfg?);

// inputs (platform layer or simulation pushes; engine never polls)
engine.handleHeading(compassDeg, tMs);          // raw compass, deg CW from north
engine.handleMotionSample({ tMs, ax, ay, az }); // devicemotion accelerationIncludingGravity
engine.handleAcousticSample(fingerprint, tMs);  // -> AcousticSampleAudit (see below)
engine.tick(tMs);                               // call ~2x/s so debounce advances while standing
engine.stepOnce(tMs);                           // one step at current heading (simulation / manual assist)

// outputs
const unsub = engine.onPosition((state: PositionState) => { /* render */ });
engine.onZoneEvent((ev: ZoneEvent) => director.handleZoneEvent(ev));
engine.onAcousticAudit((a: AcousticSampleAudit) => { /* field-test logging only */ });
engine.getState(); // PositionState snapshot
```

The acoustic layer is a **corrector, never an independent locator** — four
mandatory gates (geometric candidate set around the current estimate,
confidence, margin, and a consecutive-agreement streak; ARCHITECTURE.md §7).
`handleAcousticSample` therefore usually does nothing, and that is correct
behavior. It returns (and emits to `onAcousticAudit`) an `AcousticSampleAudit`
per sample: candidate set considered, top-two margin, streak, action taken
(`none | streak-building | confirmed-in-place | reanchored`), and
position before/after. **Pilot deployments must persist these records** —
they are the only way to learn how often the acoustic layer actually fires in
a real building; synthetic unit tests cannot answer that.

Supporting pieces, all already implemented and tested:

- `detectCapabilities(window)` / `requestMotionPermissions(window)` — the
  latter MUST be called inside the "Start the guide" tap handler (iOS).
- `startMotionStream(window, cb)` / `startHeadingStream(window, cb)` — the
  heading callback exposes `absolute: boolean`; when false (no compass, only
  relative gyro alpha), the UI must run a manual alignment step ("stand on the
  entrance mark facing the welcome sign, tap ready") and apply the offset.
- `new WakeLockManager({ navigator, document }, onState).start()` — states
  `active | released | denied | unsupported`, each with a ready user-facing
  message string.
- `captureAmbientClip(seconds)` → PCM; `computeFingerprint(pcm, sampleRate)`;
  `matchFingerprint(sample, refs, cfg)` (used by the engine internally).
- `new AudioDirector(new HtmlAudioBackend(), zones, { language, fallbackLanguage })`.
- Server routes: `GET/PUT /venues/:id/blueprint.json`, `GET /venues/:id/audio/:file`,
  `GET /health`. One directory per venue, no database.

## 3. Done vs. left

**Done (Phase A, tested — 51 passing):** everything in §2, the schema, the
validator, the demo venue, and the proof suite (irregular walking, injected
compass drift vs. walls, acoustic false-positive rejection incl. twin-zone
ambiguity and single-anomaly suppression, boundary flicker, permission
denial, wake-lock re-acquisition).

**Done (Phase C, run 1):** tourist runtime UI (`/tour/[venue]`: one-tap
start, wake-lock chip, engine-driven zone display, fuzzy-uncertainty
minimap, verbatim honesty messages, manual fallback, `?dev=1` simulator
drawer that injects engine inputs only); admin surface (`/admin/[venue]`:
per-zone acoustic recorder via the same `captureAmbientClip` →
`computeFingerprint` pipeline as the runtime, per-zone/per-language
narration slots with upload + labeled placeholder-tone generation,
validation-gated save, unauthenticated-write banner); venue server
`PUT /venues/:id/audio/:file`; placeholder-tone pipeline + demo seed;
acoustic-audit observability (`/dev/audits`, localStorage ring + JSON
export); scripted browser proof (`scripts/e2e-demo.ts`).

**Done (Phase C, run 2 — the drawing canvas):** `/admin/[venue]` now has the
full floor-plan editor (`src/ui/admin/canvas/`): floor-plan image backdrop
(client-side only — the frozen schema carries no image; it's a tracing aid
persisted in localStorage), two-click scale calibration against a known
distance, zone-polygon drawing (close → name → full zone card with recorder
and narration slots), walkable-graph tracing (chains from existing nodes,
capsule preview at real edge width, duplicate/self-edge refusal), select/
move/delete with vertex and node handles, undo/redo that merges back
audio/fingerprint work, 0.5 m grid + node snapping, pan/wheel/pinch zoom,
keyboard shortcuts, desktop two-pane + mobile stacked layouts. Geometry ops
are pure and unit-tested (`editorOps.ts`); the e2e script draws and traces
through the real UI and asserts the saved blueprint's exact coordinates.

**Left:**

1. **Auth on all server write routes** — blueprint and audio PUTs are
   deliberately unauthenticated; the admin UI banners this. Must land before
   any non-local deployment.
2. **`headingOffsetDeg` measurement flow** — the calibration screen should
   measure the compass bearing of map +Y on-site (stand on a marked line,
   read the device compass) rather than have staff type a number.
3. **Real narration content** to replace the labeled placeholder tones.
4. **Stride personalization** (optional): calibrate `strideM` from the known
   entrance-corridor length.
5. **Deployment**: static Next.js hosting + the venue server; QR codes per
   venue/language.

## 4. Acceptance criteria for Phase C

1. **The UI must never compute position itself** — it only renders
   `PositionState` and reacts to `ZoneEvent`s. If a UI file contains geometry
   math on zone polygons, the review fails.
2. Every capability/permission/wake-lock message produced by the engine is
   shown to the visitor **verbatim** — no swallowing, no generic "something
   went wrong."
3. The start flow works with exactly **one tap** on iOS Safari 16.4+ and
   Android Chrome: permission prompt, wake lock, and audio playback are all
   unlocked from that single gesture.
4. Ship as a **plain web page** (QR → URL). No install prompt, no service
   worker that changes display mode, no "Add to Home Screen" promotion.
5. The uncertainty radius from `PositionState.uncertaintyM` is visibly
   rendered (fuzzy disc). Do not draw a confident pinpoint dot.
6. Kill switch honesty: with sensors denied, the manual exhibit list must be
   reachable within one tap from the error state.
7. `npm test` stays green and new UI logic ships with its own tests; the
   engine's public API (§2) does not change without updating this document
   and ARCHITECTURE.md in the same commit.

## 5. Known sharp edges for the next builder

- `webkitCompassHeading` is magnetic north; `headingOffsetDeg` calibration
  absorbs declination as long as the admin measures it *with the same kind of
  device class* — the calibration screen should measure, not ask the admin to
  type a number from memory.
- iOS fires `deviceorientation` at high rate; throttle `handleHeading` calls
  to ~10 Hz to save battery (the smoother makes higher rates pointless).
- `getUserMedia` for the ambient sampler will show the mic indicator — the
  tourist UI must explain this up front ("uses the microphone briefly to
  recognize which room you're in; nothing is recorded or uploaded"), and the
  runtime matching must stay fully on-device (it already is: fingerprints are
  computed client-side; only ~16 floats would ever leave the phone, and today
  nothing leaves it).
- ScriptProcessorNode (mic capture) is deprecated-but-universal; the
  AudioWorklet upgrade is a drop-in inside `micCapture.ts` only.
- The demo venue has no real audio files (`venues/demo/audio/` is empty);
  the server serves whatever is dropped there.
