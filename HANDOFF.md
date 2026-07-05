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
| `calibration` | `{ headingOffsetDeg, defaultStrideM, stepDetector?, geofence?, acoustic? }` | `headingOffsetDeg` = compass bearing of map +Y. |

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
engine.handleAcousticSample(fingerprint, tMs);  // -> AcousticMatch | null
engine.tick(tMs);                               // call ~2x/s so debounce advances while standing
engine.stepOnce(tMs);                           // one step at current heading (simulation / manual assist)

// outputs
const unsub = engine.onPosition((state: PositionState) => { /* render */ });
engine.onZoneEvent((ev: ZoneEvent) => director.handleZoneEvent(ev));
engine.getState(); // PositionState snapshot
```

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

**Done (Phase A, tested — 47 passing):** everything in §2, the schema, the
validator, the demo venue, and the proof suite (irregular walking, injected
compass drift vs. walls, acoustic false-positive rejection, boundary flicker,
permission denial, wake-lock re-acquisition).

**Left (Phase C):**

1. **Admin calibration UI** (walk-the-space mode): draw/edit zone polygons
   over a floor-plan image; trace the walkable graph by walking it (or by
   tapping node points); per-zone "record 8 s ambience" button →
   `captureAmbientClip` + `computeFingerprint`; measure `headingOffsetDeg`
   (stand on a marked line, read the compass); compile + PUT the blueprint.
2. **Tourist UI**: QR landing → language picker → single "Start the guide"
   tap (permission gate + wake lock + audio unlock all inside that one
   gesture); dark AMOLED-friendly screen with zone name, uncertainty-honest
   position dot on the floor plan, wake-lock/"guide active" indicator,
   capability messages rendered verbatim; manual exhibit list as the
   universal fallback.
3. **Content management**: audio upload per zone/language (the server needs a
   `PUT /venues/:id/audio/:file` route + **auth on all write routes** — the
   current PUT is deliberately unauthenticated and must not face the open
   internet).
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
