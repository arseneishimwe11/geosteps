# geosteps — Architecture

A web-based indoor audio guide for museums and cultural sites. A visitor scans
a QR code at the entrance, picks a language, and — holding their phone the way
they'd hold any walking-navigation app — hears pre-recorded narration
automatically as they approach each exhibit zone, in whatever order they
actually walk. No app install, no beacons, no added hardware in the building.

**Read this first — the honest scope statement.** This system provides
**room-level positioning, not meter-level positioning**, and it works **only
while the phone is held with the screen on and the page visible** — the same
usage contract as turn-by-turn walking navigation. It is a digital compass
guide, not an invisible telepathic one. Anyone who tells you a web page can
silently track a phone through a building from a pocket is describing
something the web platform deliberately does not allow. The design below is
what *does* work, built around what doesn't.

---

## 1. Platform constraints this design is built around

Each of these rules out an "obvious" approach. They are the load-bearing walls
of the architecture; do not design against them.

| # | Constraint | Consequence |
|---|-----------|-------------|
| 1 | **No raw magnetometer on the web.** Safari doesn't expose it at all; Chrome hides the Generic Sensor `Magnetometer` behind a non-default flag real visitors won't have. | No geomagnetic fingerprinting. The only magnetic signal we use is the *fused compass heading* — a single number — via `DeviceOrientationEvent` (`webkitCompassHeading` on iOS, `360 − alpha` from `deviceorientationabsolute` on Android). |
| 2 | **No WiFi RSSI from a web page, ever, by design** (privacy). | No WiFi fingerprinting. Period. |
| 3 | **Sensors and mic streams throttle/suspend the instant the screen locks or the tab backgrounds.** | The phone must be held, screen on, tab active. Enforced with the Screen Wake Lock API (standardized; Safari ≥ 16.4 in a normal tab). The UI is dark/low-power (AMOLED-friendly) and shows a visible "guide active" indicator. This is honest scope, not a workaround. |
| 4 | **Installed-PWA Wake Lock was broken on iOS until 18.4** (long-standing WebKit bug). A meaningful share of real visitors run older iOS. | Ship as a **plain mobile web page opened from the QR code**. Do not promote "Add to Home Screen." |
| 5 | **Visitors walk in completely irregular order** — backtrack, skip, wander. | The data model is a 2D coordinate plane with geofenced polygon zones. There is no playlist, no sequence, no "next exhibit" anywhere in the engine. |
| 6 | **Cheap phone sensors drift** — compass bias of 10–30° is normal, stride length varies per person. | Two corrections, neither needing hardware: map-matching against the admin-recorded walkable-floor graph, and periodic acoustic re-anchoring against per-zone ambient fingerprints. |

## 2. System overview

```
                       tourist phone (browser tab, screen on)
 ┌─────────────────────────────────────────────────────────────────────┐
 │  platform layer (src/engine/platform/)                              │
 │   sensors.ts     capability detect + iOS permission gate            │
 │   wakeLock.ts    acquire / auto-reacquire on visibilitychange       │
 │   micCapture.ts  short ambient PCM clips (fingerprinting)           │
 │        │ devicemotion   │ deviceorientation  │ mic PCM              │
 │        ▼                ▼                    ▼                      │
 │  ┌──────────────────────────────────────────────────────────────┐   │
 │  │ PositionEngine (src/engine/positionEngine.ts)                │   │
 │  │                                                              │   │
 │  │  StepDetector ──step──► dead-reckoning integrator            │   │
 │  │  HeadingSmoother ──θ──►   X += stride·sin θ, Y += stride·cos θ│  │
 │  │                              │ raw (x,y)                     │   │
 │  │  MapMatcher (walkable graph) ▼ snap-if-in-wall               │   │
 │  │  acoustic corrector ──4 gates: geometry, confidence,         │   │
 │  │                        margin, consecutive agreement──► snap │   │
 │  │                              │ corrected (x,y)               │   │
 │  │  GeofenceEngine (hysteresis + debounce)                      │   │
 │  └──────────┬──────────────────────────────┬────────────────────┘   │
 │             │ PositionState                │ ZoneEvents             │
 │             ▼                              ▼                        │
 │        UI (renders only)            AudioDirector ──► narration     │
 └─────────────────────────────────────────────────────────────────────┘
                     ▲ one-time download at QR scan
        floor blueprint JSON + audio files (src/server/ — a directory
        per venue on a tiny Node server; no database)
```

The **PositionEngine is the single authority on position**. The UI never
computes position; it renders what the engine reports. The AudioDirector never
checks coordinates; it reacts to debounced zone events.

## 3. Floor blueprint schema

One JSON document per venue (`venues/<id>/blueprint.json`), produced by the
admin calibration walk, downloaded whole by the tourist runtime. Full
TypeScript types in `src/engine/types.ts`; structural validator in
`src/engine/blueprint.ts` (the server rejects invalid uploads with the
complete error list).

```jsonc
{
  "schemaVersion": 1,
  "venue": {
    "id": "demo",
    "name": "Demo Regional Museum",
    "languages": ["en", "fr", "rw", "sw"],      // configurable per venue
    "defaultLanguage": "en"
  },
  "entry": {                                     // where the QR code stands —
    "position": { "x": 5, "y": 5 }               // the engine's starting fix
  },
  "zones": [                                     // exhibit areas = polygons,
    {                                            // NEVER an ordered list
      "id": "royal-drums",
      "name": "Royal Drum Gallery",
      "polygon": [ {"x":12,"y":8}, {"x":18,"y":8}, {"x":18,"y":14}, {"x":12,"y":14} ],
      "audio": {                                 // per-zone, per-language
        "en": { "url": "audio/royal-drums.en.mp3", "title": "The Royal Drums" },
        "rw": { "url": "audio/royal-drums.rw.mp3", "title": "Ingoma z'ubwami" }
      },
      "fingerprint": {                           // optional ambient signature
        "version": 1,
        "method": "band-energy-v1",
        "sampleRateHz": 48000,
        "fftSize": 2048,
        "bandCount": 16,
        "bandsHz": [100, 7200],
        "energies": [0.05, 0.06, /* … 16 values, sum = 1 */ 0.002],
        "capturedAt": "2026-07-01T08:25:00Z",
        "captureSeconds": 8
      }
    }
  ],
  "graph": {                                     // walkable-floor graph
    "nodes": [ { "id": "spine-w", "x": 5, "y": 5 }, { "id": "drums", "x": 15, "y": 11 } ],
    "edges": [ { "from": "spine-w", "to": "drums", "widthM": 4 } ]
  },
  "calibration": {
    "headingOffsetDeg": 17,                      // compass bearing of map +Y
    "defaultStrideM": 0.7,
    "geofence":  { "enterDebounceMs": 1500, "exitDebounceMs": 2500, "hysteresisM": 0.5 },
    "acoustic":  { "minConfidence": 0.9, "minMargin": 0.08,
                   "candidateBaseRadiusM": 6, "candidateUncertaintyFactor": 2,
                   "consecutiveAgreements": 3, "maxStreakGapMs": 60000 }
  }
}
```

### Coordinate & heading conventions

- Map frame: meters, venue-local. `+Y` is "map north" (whatever axis the admin
  picked, usually the building's main axis); `+X` is 90° clockwise from it.
- `calibration.headingOffsetDeg` is the *compass* bearing a person faces when
  walking toward map `+Y`. Runtime conversion:
  `bearing_map = (compassHeading − headingOffsetDeg) mod 360`, then one step
  moves `(Δx, Δy) = stride · (sin bearing_map, cos bearing_map)`.
- The walkable area of an edge is its **capsule**: every point within
  `widthM / 2` of the segment between its nodes. The union of capsules is the
  venue's walkable space; **everything else is wall**. There is no separate
  wall-polygon layer to maintain — the admin traces where people *can* walk,
  which is one walk with a phone, not a CAD job.

## 4. Step detection (`stepDetector.ts`)

Peak detection on the high-passed accelerometer *magnitude* — magnitude so the
exact grip angle doesn't matter.

Per sample: `m = |(ax, ay, az)|` → subtract a slow EMA of `m` (gravity
tracking ≙ high-pass) → maintain an EMA of the squared signal (running RMS) →
a sample is a step iff it is a **local maximum**, **above the adaptive
threshold** `max(thresholdFloorMs2, thresholdGain · RMS)`, and **at least
`minStepIntervalMs` after the previous step**.

Why adaptive: walking style varies enormously (a soft-stepping visitor peaks
near 1 m/s², a heavy walker near 4 m/s²). Scaling the threshold to the
walker's own running RMS keeps recall high for both — verified by the
soft-then-hard-walker test. The absolute floor keeps sensor noise at rest from
registering; the refractory period caps cadence at a human maximum so phone
rattle can't double-count.

| Tunable | Default | Meaning / when to touch |
|---|---|---|
| `minStepIntervalMs` | 300 | Max cadence ≈ 3.3 steps/s. Raise for exhibitions where people only shuffle. |
| `gravityTimeConstantSec` | 0.8 | High-pass corner. Lower = faster gravity tracking, more step-band leakage. |
| `rmsTimeConstantSec` | 2.0 | How fast the threshold adapts to a new walking style. |
| `thresholdFloorMs2` | 0.8 | Noise floor. Raise if a device counts steps while lying on a table. |
| `thresholdGain` | 1.0 | Threshold ≈ walker's RMS (~0.7 × peak). Raise for precision, lower for recall. |
| `defaultStrideM` (calibration) | 0.7 | Museum shuffle is short. Future: personalize from entrance-corridor length. |

## 5. Dead reckoning (`positionEngine.ts` + `heading.ts`)

On every confirmed step: `X += stride·sin θ; Y += stride·cos θ` with θ = the
smoothed compass heading rotated into the map frame. Heading smoothing is an
EMA **on the unit vector** (`sin/cos` components) so the 359°→1° wraparound
never averages to 180°. This works for any walking order or direction by
construction — there is no path model, only integration.

Position uncertainty is tracked honestly: it starts at ~1 m (the QR-scan fix),
grows `uncertaintyPerStepM` (default 0.08 m) per step, caps at 12 m, and
shrinks only on re-anchoring evidence. The UI is expected to *show* this
(a fuzzy disc, not a confident dot).

## 6. Map-matching drift correction (`mapMatching.ts`)

**Model.** Walkable space = union of edge capsules from the blueprint graph.
**Algorithm.** For each integrated step, test the raw position against all
capsules (O(edges), a few dozen segments even for a large museum — micro-
seconds). Inside any capsule → keep it. Outside all → replace with the nearest
point of the nearest capsule (project onto the segment's centerline, clamp,
step back toward the raw point by the capsule radius). The corrected position
**is written back into the integrator**, so a persistent compass bias makes
the estimate *slide along the corridor wall* instead of tunneling through it —
exactly what the drift test asserts: 25° of injected bias, and every reported
position stays walkable while raw math ends up in a wall.

**Why this and not the alternatives:**

- **Particle filter over a floor grid** — the research-grade answer, and
  genuinely more accurate in the limit. Rejected for Phase A because it needs
  a rasterized occupancy map (which our admins will never produce), tuned
  process noise, and non-trivial CPU on low-end phones — and its failure modes
  are opaque. The capsule snap is deterministic, explainable to a curator
  ("you can't be inside that wall, so I put you back in the corridor"), and
  testable with hand-computed geometry. The engine's interfaces don't preclude
  swapping a particle filter in later; the blueprint wouldn't change.
- **Kalman filter** — assumes roughly linear-Gaussian dynamics; "you cannot be
  inside a wall" is a hard nonlinear constraint that Kalman handles badly
  (it happily averages you *into* the wall).
- **Free-space polygon (walkable area as one big polygon with holes)** — more
  faithful geometry, but point-in-polygon-with-holes plus nearest-boundary
  math is fussier, and the admin capture tool becomes a polygon editor. A
  graph is what you get naturally from "walk the corridors once."

## 7. Acoustic zone fingerprinting — the magnetometer replacement (`acoustic/`)

Since the web gives us no magnetometer and no WiFi, the only ambient signal
left that varies room-to-room and is legally readable (with user consent) is
**sound**. During calibration, staff record ~8 s of ambient audio per zone —
the museum stays exactly as silent as it already is; we add no speakers. At
runtime the guide periodically samples ~2 s from the mic and asks: *does this
sound like a room I know?* A confident answer re-anchors dead reckoning — the
automatic version of a manual "tap to confirm you're at the archway"
checkpoint.

**Encoding (`band-energy-v1`).** Hann-windowed 2048-point FFT frames, 50%
overlap → power spectrum → energy summed into 16 log-spaced bands between
100 Hz and 7.2 kHz → averaged over the clip → normalized to sum 1. Normalizing
to a distribution discards absolute loudness (mic gain, AGC differences);
what's kept is the *shape* of the room tone: HVAC rumble, ventilation whine,
street bleed, reverberant coloration. This is the same family of technique as
Shazam-style audio fingerprinting, but pointed at *location* instead of song
identity — and deliberately simpler: quiet rooms have no transient landmarks
to hash, so we characterize the steady texture instead. Echo cancellation /
noise suppression / AGC are explicitly disabled at capture, because those DSP
stages are built to remove exactly the signal we want.

**The acoustic layer is a corrector, never an independent locator.** Dead
reckoning + map matching remain the position authority at all times; acoustic
evidence may only *adjust* their estimate, and only after clearing **four
gates, all mandatory, in order** (`PositionEngine.handleAcousticSample`):

1. **Geometric gate.** The sample is compared only against zones within
   `candidateBaseRadiusM + candidateUncertaintyFactor × uncertainty` of the
   current estimate (defaults: 6 m + 2×, so ≈ 8 m when freshly anchored,
   ≈ 16 m after heavy drift) — **never the full floor blueprint**. A sound
   resembling a room the visitor cannot plausibly have reached is not
   evidence, it's a coincidence — and this gate is what makes acoustically
   identical rooms on opposite sides of the building a non-problem: the
   distant twin is simply never in the candidate set.
2. **Confidence gate:** best similarity ≥ `minConfidence` (default **0.90**).
   The default is 0.90 and not lower for a measured reason: cosine similarity
   between band-energy distributions is permissive for broadband sounds — a
   white-noise-like sample (crowd murmur, rain) scores ≈ 0.86 against a
   high-band-weighted reference despite being a different signal. 0.90 sits
   above that failure mode; genuine same-room samples land at 0.95+. There is
   a test pinning this exact scenario.
3. **Margin gate:** best must beat second-best by ≥ `minMargin` (default
   0.08). Two neighboring galleries on the same HVAC loop sound alike; both
   will score high, and the matcher **applies no correction at all** rather
   than guess — dead reckoning stays in charge. A missed correction is always
   preferable to a wrong one.
4. **Temporal-consistency gate:** `consecutiveAgreements` successive samples
   (default 3, each within `maxStreakGapMs` = 60 s of the previous) must name
   the **same** zone before anything changes. **A single sample never moves
   the reported position** — not even to tighten uncertainty. One anomalous
   reading (a tour group walks past, a door slams) is noise; the same reading
   three times in a row is a room.

**Correction policy once all four gates pass.** If the matched zone already
contains the estimate → tighten uncertainty in place (confirmation, no move).
If it's a different (but geometrically plausible) zone → move the estimate to
that zone's centroid, map-matched onto the graph, and set uncertainty to the
snap radius (3 m — *room-level, on purpose*). The geofence then enters the
zone through its normal debounced path; acoustic evidence gets no shortcut
around the debounce. On anything less than four passed gates: nothing happens
— a null result costs nothing, while a wrong snap teleports the narration to
the wrong room. Every threshold is therefore biased hard toward rejection.

**Field observability.** Every sample — acted on or not — produces an
`AcousticSampleAudit` record (subscribe via `engine.onAcousticAudit`): the
geometric candidate set considered, the margin between the top two
candidates, the streak length, and whether/what correction was applied.
Synthetic unit tests cannot tell you how often this layer fires in a real
building with real HVAC and real crowds; a pilot deployment logging these
records can, and the thresholds above should be re-tuned from that data. Not
a tourist-facing feature.

**Honest limitations — read before trusting this:**

- **Room-level, not meter-level.** A fingerprint says "this sounds like the
  Drum Gallery," never "you are 1.4 m from the drum."
- **Occupancy changes the sound.** A room full of visitors absorbs highs and
  adds babble; a calibration done in an empty museum degrades on a busy day.
  The gates mean degradation shows up as *fewer corrections*, not wrong ones —
  the system falls back to pure dead reckoning + map matching.
- **Acoustically identical *neighboring* rooms are indistinguishable** (that's
  what the margin gate encodes — it never picks between near-twins in the
  same candidate set). Identical rooms *far apart* are handled by the
  geometric gate instead. Venues with N identical adjacent silent rooms get
  acoustic help only in the rooms that differ.
- **Corrections are slow by design.** Three agreeing samples at a ~15 s
  cadence means the fastest possible acoustic correction takes ~45 s in the
  same room. That is the right trade: this layer exists to fix *accumulated*
  drift, and museum dwell times are minutes.
- Recalibrate when the soundscape changes (new AC unit, new fountain, winter
  vs. summer ventilation). Calibration is an 8-second recording per room —
  cheap to redo.
- An optional one-time impulse test (clap → RT60 estimate) can be added to the
  schema later (`method: "impulse-rt60-v1"`); the fingerprint field is
  versioned for exactly that.

## 8. Geofencing (`geofence.ts`)

Zones are polygons checked continuously against the current corrected
position — "is the visitor inside this zone *right now*" — with two
anti-flicker mechanisms (both verified by the boundary-oscillation tests):

- **Spatial hysteresis (`hysteresisM`, 0.5 m):** entering requires being
  ≥ 0.5 m *inside* the polygon; the current zone is only abandoned when the
  position is ≥ 0.5 m *outside* it. Oscillating on the line satisfies neither.
- **Temporal debounce:** a candidate must stay the deepest zone for
  `enterDebounceMs` (1.5 s) before `enter` fires; the position must stay
  definitively outside for `exitDebounceMs` (2.5 s) before `exit` fires.

Overlapping zones are an authoring error; if they exist anyway, the deepest
containment wins. Zones smaller than ~2 × hysteresis are flagged as
untriggerable by the blueprint validator at upload time.

## 9. Wake Lock lifecycle (`platform/wakeLock.ts`)

Request `navigator.wakeLock.request('screen')` at guide start (post-gesture).
The browser auto-releases it whenever the tab loses visibility — that's
routine platform behavior, not an error. The manager listens for the
sentinel's `release` event and for `visibilitychange`, re-requests the lock
the moment the page is visible again, and reports every transition
(`active | released | denied | unsupported`) with an honest user-facing
message. The UI must show this state at all times ("guide active" /
"guide paused — screen may sleep"). No wake lock ⇒ the guide still runs, the
visitor just has to keep the screen from sleeping themselves — and we tell
them exactly that.

## 10. Audio direction (`audio/audioDirector.ts`)

A small state machine consuming zone events, never coordinates:

- `enter` → play that zone's narration in the visitor's language (fall back to
  the venue default language if the translation is missing — and surface a
  warning for the content manager).
- `enter` while something else is playing → **crossfade** (1.2 s), never a
  hard cut.
- Re-entering a zone re-triggers narration, but not within
  `minReplayIntervalMs` (45 s) of its last start — the second line of defense
  against flicker, and the polite answer to a visitor circling a case.
- `exit` → by default the narration finishes naturally (people step away
  mid-listen); `stopOnExit` fades out instead if a venue prefers.

The browser backend (`platform/webAudioBackend.ts`) streams via
`HTMLAudioElement` with ramped volume — multi-minute MP3s on mid-range phones
shouldn't be buffered whole into WebAudio memory.

## 11. Accuracy expectations — the explicit statement

- **Zone detection is room/area-level.** With honest calibration this system
  reliably tells apart *areas the size of museum rooms and large exhibit
  bays* (3 m+ across). It will not distinguish two display cases 2 m apart.
  Author zones accordingly.
- Dead-reckoning error grows roughly 5–10 % of distance walked on a cheap
  phone; map matching bounds it laterally (you stay in the corridor you're
  in), and acoustic re-anchoring opportunistically resets it to ~3 m. Between
  corrections, expect the estimate to be meters off — the zone geometry and
  hysteresis absorb that.
- **The guide only runs held-in-hand, screen on, tab in the foreground.** In a
  pocket or with the screen locked, sensing stops; on return, the wake lock
  and sensors resume automatically and position picks up from the last
  estimate (stale by however far the visitor walked pocketed — the next
  acoustic match or the entrance QR re-scan fixes it).
- Compass quality varies per device and per building (steel, rebar). The
  design assumes the compass is *biased*, not usable as truth — that's the
  map-matcher's whole job. Venues with severe magnetic disturbance should
  expect more corridor-sliding and rely more on acoustic anchors.
- If everything degrades — sensors denied, compass garbage, mic refused — the
  system says so on screen (structured capability messages, tested) and the
  visitor falls back to tapping exhibits manually. **Never silent failure.**

## 12. What the test suite proves (`tests/`)

51 assertions-with-teeth across 9 files, all runnable with `npm test`:

| Scenario (required by spec) | Test file | What is asserted |
|---|---|---|
| Irregular walk: zig-zag, backtrack, skip zone C, re-enter zone A | `irregularWalk.test.ts` | Exact event sequence `A, B, D, A-again` from coordinates alone; C never fires; 136 steps land inside A. |
| Injected 25° compass bias would dead-reckon through a wall | `mapMatching.test.ts` | Raw endpoint is provably non-walkable; every engine-reported position stays walkable; snap events occurred; final position hand-computed. |
| Acoustic: noisy re-sample of a known room matches it | `acoustic.test.ts` | Match with confidence > 0.9 and margin > 0.08; after three consecutive agreeing samples the engine re-anchors to the zone centroid, uncertainty set to 3 m, zone entered via normal debounce. |
| Acoustic: sample resembling nothing stored is rejected | `acoustic.test.ts` | White noise → `null` (incl. the ≈0.86-vs-high-band trap); incompatible band configs never compared. |
| Acoustic: near-identical twin zones in range → no correction | `acoustic.test.ts` | Two fixture zones given deliberately near-identical fingerprints; five samples in a row apply zero corrections (margin gate), audit records show the sub-margin ambiguity. |
| Acoustic: single anomalous sample never moves position | `acoustic.test.ts` | One zone-C-flavored sample mid-corridor changes nothing (not even uncertainty); the same reading repeated 3× consecutively does re-anchor; a conflicting sample or a >60 s gap resets the streak. |
| Acoustic: geometric gate excludes implausible rooms | `acoustic.test.ts` | A far-away zone with an *identical* fingerprint never appears in the audited candidate set; the plausible local zone confirms in place instead of deadlocking on the twin. |
| Boundary flicker | `boundaryFlicker.test.ts` | 20+ oscillations across a zone edge (and across a *shared* edge of two zones): one `enter`, zero `exit`s, exactly one audio track created; genuine departures/switches still work. |
| Permission denied / API missing | `permissions.test.ts` | Rejected `requestPermission()`, denied prompts, absent APIs — every path yields a structured status **plus a non-empty honest message**; nothing throws, nothing is silent. |
| Wake Lock re-acquisition | `wakeLock.test.ts` | Hidden→visible round trip re-requests the lock exactly once and reports `active → released → active`. |
| Supporting | `stepDetector.test.ts`, `blueprint.test.ts`, `server.test.ts` | Cadence detection across soft/hard walkers, zero false steps at rest, refractory cap; schema validation catches every error class; server serves/validates blueprints, blocks traversal. |

## 13. Repository layout

```
src/engine/            the position engine (pure TS, no framework, no DOM assumptions)
  types.ts             blueprint + state + event types (the frozen schema)
  stepDetector.ts      adaptive step detection
  heading.ts           compass smoothing + map-frame conversion
  positionEngine.ts    orchestrator: DR + map-match + acoustic + geofence
  mapMatching.ts       capsule-graph snapping
  geofence.ts          hysteresis + debounce zone containment
  acoustic/            FFT + band-energy fingerprinting + gated matching
  audio/               zone-event → narration state machine
  platform/            browser glue: sensors/permissions, wake lock, mic, audio element
  blueprint.ts         structural validation
src/server/            per-venue JSON + audio file server (plain node:http)
venues/demo/           example floor blueprint for a small four-room museum
tests/                 the proof (see §12)
```

Next.js tourist/admin UIs are Phase C (see HANDOFF.md); the engine is
deliberately framework-free so those UIs stay thin shells over this API.
