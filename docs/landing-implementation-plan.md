# geosteps Landing Page & UI Polish — Implementation Plan

Status: **analysis complete, awaiting review — nothing implemented.**
Sources analyzed: the full codebase (built in this repo, known line-by-line) and the
Claude Design project *"Geosteps landing page design"* — all three files
(`Hero Concepts.dc.html`, `Geosteps Landing Page.dc.html`, `Geosteps App Screens.dc.html`)
plus its screenshots. Per the brief: the export is raw material, not a spec.

---

## 1. What the real product is (the truths the page must obey)

- A **web** indoor audio guide: QR at the door → language → one tap → narration
  finds the visitor as they walk. No app, no beacons, no hardware in the building.
- ICP: directors/curators of **low-budget regional & cultural museums**
  (motivating case: Rwanda / East Africa), plus heritage funders. Two or three
  guides, hundreds of visitors, four-plus languages.
- The engine is honest by design: **zone-level** (±3 m-ish) positioning, screen-on,
  verbatim failure messages, a fuzzy uncertainty halo instead of a fake-precise dot,
  a manual exhibit list that always works. **The landing page must never promise
  per-artifact magic** — "the story finds you as you move through the space."
- Real, running UI available to show: tourist start/guide screens, honest-states,
  manual list; admin calibration with the floor-plan drawing canvas; acoustic
  band-energy viz; audit table. The app's own rule — no external font/CDN fetches —
  extends to the landing page.
- Current `/` is a developer chooser, not a landing page. It will be replaced;
  its links move to the footer's small print.

## 2. Design-export catalog — keep / adapt / rebuild

**KEEP (genuinely at the bar — reuse assets & animation logic as-is or near-as-is):**
- The **SVG floor-plan figures**: fuzzy position halo (radialGradient + feGaussianBlur),
  walked-path dash animation (`stroke-dashoffset` on a `data-role="traveled"` polyline),
  zone highlight states, honest captions. This is the product's best visual idea.
- The **"drag to walk the gallery"** interactive concept (floor plan + narration card
  that crossfades per zone). Promoted to the page's centerpiece, converted to
  scroll-driven (details §5.2).
- The **animated acoustic band-energy bars** (staggered `gsBar` keyframes).
- The motion vocabulary: `gsWarm` (text/light "warming up" — the lantern moment),
  `gsPulse`/`gsRing` (guide-active), `gsGlow` (ambient breathing light).
- The **typography voice**: Newsreader (serif, incl. italic accent phrases) +
  IBM Plex Mono (technical readouts). Both are open (OFL) and will be
  **self-hosted via `next/font`** — keeping the voice while killing the export's
  render-blocking Google-CDN `<link>`.
- Most of the **copy**: "Scan. Walk. Listen — the story finds you." / "Two guides.
  Four hundred visitors a day. Five languages between them." / "We'd rather tell you
  the truth." / the NO APP · NO BEACONS · NO HARDWARE proof row.
- The **App Screens** set as reference DOM for phone-screen content (start, guide,
  honest-states, exhibit list) — they mirror the real app's states and tokens.
- Hero Concepts **1c "Lantern in Motion"** as the compositional direction for the
  hero (cinematic, the phone as the only light, waypoints trailing into the dark) —
  stronger than 1b (the safe editorial split the export's full page actually used).

**REBUILD (generic / below the bar):**
- **No scroll experience at all** — the export is a static stack; the single biggest
  gap vs. the Linear/Stripe tier. All choreography added fresh (GSAP + Lenis).
- **One identical section rhythm** (mono label → serif H2 with italic brass em →
  two columns) repeated eight times; the italic-em tic loses all power by section 3.
  Kept as a signature but **rationed to ≤3 uses page-wide**; each section gets its
  own compositional rhythm.
- The CSS-only phone frame → replaced by the real 3D device (§6), with the CSS frame
  retained as the low-power/reduced-motion fallback (it's decent — worth keeping alive).
- Nav and footer boilerplate; thin "Who it's for"; the fake pilot form (we will not
  fabricate a backend — see open questions); inline-styled markup (rebuilt as
  Tailwind components on the app's existing tokens).

## 3. Identity — the point of view

**"After-hours gallery."** A museum at night: true-black rooms, one brass light
moving through them — and the light is the product. Quiet, museum-grade confidence
with visible engineering honesty; the luxury signal is *restraint and truth-telling*,
not spectacle. Voice: museum wall-text written by an engineer who cares. This fits
because it is literally what the product is (a lit screen guiding you through a dark
building) and who buys it (curators who respect craft and distrust overselling).
Palette = the app's exact tokens (ink `#000`, panels `#14171b`, parchment `#ece5d6`,
stone `#99917f`, brass `#d2a24c`/`#ecc887`, moss `#8fb562`, ember `#e06a58`) so the
site and app read as one object. Type: Newsreader display / system sans body /
IBM Plex Mono data — all self-hosted.

## 4. Motion & technique — the decision

**GSAP + ScrollTrigger + Lenis for all scroll choreography; exactly one 3D element
— the hero phone (React Three Fiber + Drei), at the user's explicit direction —
DRACO/KTX2-compressed, lazy-loaded after first paint, with a static fallback; no
post-processing stack, no other WebGL anywhere.**
Justification (one sentence): this audience buys trust, not spectacle, and the
product's brand *is* honest restraint — so the craft budget goes into timing,
typography, and one impeccable device moment rather than a page full of shaders;
the single 3D phone is the user-mandated exception and is contained accordingly.

## 5. Section structure & choreography

The **first-impression principle governs the effort split: roughly half of all
design/motion effort goes to §5.1 + the 5.1→5.2 transition.** Later sections are
deliberately calmer.

1. **HERO — "the lantern."** Full-viewport black. Left/center: the headline
   ("Scan. Walk. Listen — the story finds you.") warming in via `gsWarm` — pure HTML,
   paints immediately, is the LCP. The 3D phone floats right-of-center, screen ON,
   running the **real guide screen** (§7), its glow the only light source; brass
   waypoint dots trail into the darkness behind it (from concept 1c). Proof row +
   language chips beneath. **First transition (the signature move):** as you scroll,
   the phone tilts toward top-down and its on-screen minimap appears to *expand out
   of the device* into the full-bleed floor plan of §5.2 — the lantern becomes the map.
   (Implementation: GSAP-scrubbed camera/rotation + crossfade handoff from the 3D
   screen to the DOM SVG at matched scale; fallback path does a simple scale/fade.)
2. **THE PRODUCT IN ACTION — the scroll-walk (centerpiece).** Pinned section.
   Scrolling advances the visitor's halo along the walked path (the export's
   `traveled` dash animation, now scrubbed by scroll); zones light up as entered;
   the narration card crossfades per zone (real zone names/copy); acoustic bars
   tick when the corrector confirms. The export's drag-scrubber is kept as a direct
   pointer affordance inside the pinned view. Honest caption preserved verbatim.
3. **THE HUMAN STAKES.** Editorial interlude, near-static: the "Two guides…"
   headline plus the language-coverage bars filling on entry. One breath of stillness
   after the centerpiece.
4. **HOW IT WORKS.** Three steps (Scan the QR · Choose your language · Walk),
   mono-numbered, one line each, simple stagger reveal.
5. **UNDER THE HOOD / THE TRUTH.** Merges the export's "Honestly" section with the
   engineering story: three quiet mono cards — step dead-reckoning, map-matching to
   the traced floor plan, acoustic re-anchoring (with the animated bars) — plus a
   plain-language "what it doesn't do" list (zone-level not centimeter; screen stays
   on; works without any of it via the exhibit list). Honesty presented as premium.
6. **CALIBRATE ONCE.** The staff story: **real captures** of the admin drawing
   canvas (zones + walkable path over a floor plan) inside the export's desktop-window
   chrome; three mono steps (upload plan · trace rooms & paths · record 8 s per room).
7. **LANGUAGES.** The emotional payoff: Welcome / Bienvenue / Murakaza neza /
   Karibu — large serif, slow crossfade — over one line about who finally gets the story.
8. **FINAL CTA.** "Bring it to your museum." One brass button → real contact
   destination (open question below); sub-line: "a pilot needs a phone, a QR code,
   and an afternoon." No fabricated form.
9. **Footer.** Minimal: brass dot, colophon (model attribution if CC-BY, "fonts
   self-hosted, no trackers"), dev links (tour/admin/audits) in small print.

## 6. The phone frame (user-mandated realistic 3D device)

Candidate models found (free, commercially usable, glTF/GLB, for R3F):

| Model | Source | License | Notes |
|---|---|---|---|
| iPhone 16 Pro Max by shig0 | sketchfab.com/3d-models/iphone-16-pro-max-56f0840754654be3a9e4679c84d4ed64 | CC Attribution | Current-gen silhouette; glTF/GLB download; needs footer credit |
| iPhone 15 Pro Max by "Apple Guy" | sketchfab.com/3d-models/iphone-15-pro-max-1d21c2bde65d4c0b85e4e978e4d7b1ed | CC Attribution | glTF; good topology per listing |
| Apple iPhone 15 Pro Black by polyman Studio | sketchfab.com/3d-models/apple-iphone-15-pro-black-6fd1283ec05d412d99a3f23b2e80e473 | CC Attribution | Dark body suits our palette |
| iPhone X | github.com/pmndrs/market-assets | **CC0** | No attribution needed; older silhouette; battle-tested in R3F |
| Lighting HDRI (studio) | polyhaven.com (HDRIs) | **CC0** | Poly Haven has no phone models — used for lighting/reflections instead |

**Recommendation:** primary = **shig0's iPhone 16 Pro Max (CC-BY)** with a visible
credit in the footer colophon; fallback = the CC0 pmndrs model if you'd rather have
zero attribution. Two cautions I owe you honestly: (a) I could not open the Sketchfab
download pages from this environment to verify mesh quality/poly count — final pick
happens in Phase 3 after downloading and inspecting both; (b) copyright license ≠
trademark: a photoreal *Apple-branded* device on a commercial marketing page carries
trade-dress considerations, so I will **debrand** (strip the logo texture, neutral
dark-titanium material) — which also reads more premium and vendor-neutral.
The screen is **not a baked texture**: a Drei `<Html transform occlude>` plane shows
the live guide UI (§7). Pipeline: `gltf-transform` → DRACO + KTX2, target ≤ 1.5 MB;
lazy chunk mounted after LCP via IntersectionObserver; graceful chain of fallbacks
(no WebGL / low-power / `prefers-reduced-motion` / mobile-data → the export's CSS
device frame with the same live screen content).

**Phase 3 outcome (shipped).** Sketchfab downloads require an authenticated
browser session, which this environment doesn't have — so the model was obtained
from a public GitHub mirror whose GLB carries the author's own embedded
provenance (`asset.extras`: author, license, source URL). Final pick =
**"Apple iPhone 15 Pro Max Black" by polyman, CC BY 4.0** (candidate 3 in the
table — the dark body we wanted anyway). Debranded surgically with a
gltf-transform script: the Apple-logo decal mesh deleted and the logo-emboss
triangles stripped out of the frosted back-glass mesh (camera plateau and
sensor cap kept), verified by headless renders. Shipped at
`public/models/phone.glb`, DRACO + WebP, **1.07 MB** (+250 KB lazy local DRACO
decoder in `public/draco/` — no CDN). Attribution: footer colophon line,
`public/models/LICENSE-phone.md`, and the GLB's embedded metadata, all noting
the modification. One implementation trap worth recording: drei's Html
`transform` maps world units 1:1 to CSS px, so a metres-scale scene makes the
CSS3D plane ~4500× the canvas and Chromium silently skips rasterising it — the
scene is therefore mounted at ×150 scale (camera z = 63), which keeps the
intermediate layer ~13k px and paints reliably.

## 7. Consistency with the real product

- The hero phone's screen runs the **actual tourist UI** — the real `GuideSession`
  + components in a new "attract mode" that drives the engine through the existing
  simulator (inputs only; the engine remains the sole authority — the acceptance
  criterion from HANDOFF.md § 4.1 continues to hold on the marketing page).
- §5.6 uses **fresh real captures** of the admin canvas (the e2e screenshot rig
  already produces them).
- The export's App Screens DOM is used only where a live state is impractical to
  stage (the honest-states screen) — and its message strings are replaced with the
  engine's real verbatim strings from `sensors.ts`/`wakeLock.ts`.

**Phase 4 outcome (shipped).** The hero screen is now engine-driven:
`useAttractGuide` instantiates the real `PositionEngine` on the real demo
blueprint and walks a scripted loop using the dev simulator's exact input
patterns (heading burst + `stepOnce`; jittered stored fingerprints for
ambient samples). `GuideSession` itself is not mounted — it is platform glue
(permissions, wake lock, mic, audio unlock) that has no meaning without a
gesture on a marketing page — but every rendered value (zone, ±confidence,
step count, minimap dot and disc) is engine output, and the minimap is the
real tourist-runtime `Minimap` component. Verified live: geofence
enter/exit with debounce, honest uncertainty growth along the corridor, and
the acoustic re-anchor snapping ±4.3 m → ±3.0 m mid-dwell. Reduced motion
keeps one frozen frame of the same data. The calibration window is a real
2× capture of `/admin/demo`, staged with the tool itself (floor-plan
backdrop uploaded, scale calibrated 44 m, zone selected; nothing saved) at
`public/landing/admin-canvas.webp`. The Truth section quotes
`MSG.motionDenied` verbatim. A11y: global brass `:focus-visible` treatment,
footer contrast raised to AA.

## 8. Performance & accessibility budget (hard gates before ship)

- Hero headline is server-rendered HTML; **no animation or 3D blocks first paint**;
  layout space for the device is reserved (zero CLS).
- Fonts self-hosted (`next/font`), subset, `display: swap`-safe fallbacks.
- `prefers-reduced-motion`: full static page — no pin, no scrub, no 3D; content
  order stands alone.
- Landing route JS ≤ ~250 KB gz **excluding** the lazy 3D chunk; 3D chunk ≤ ~1.8 MB
  incl. model; Lenis/GSAP loaded once, tree-shaken.
- Keyboard/screen-reader pass: pinned sections must not trap; all figures get
  meaningful `aria-label`s; contrast on stone-on-black text rechecked (AA).
- Verified in Phase 5 with the existing Playwright rig: Lighthouse + screenshots at
  390 / 768 / 1440.

**Phase 5 outcome (measured on the production build, `next start`).**

| profile | FCP | LCP | CLS | TBT |
|---|---|---|---|---|
| mobile 390, Slow-4G + 4× CPU | 1120 ms | 1740 ms | **0.0039** | 655 ms |
| desktop 1440 | 292 ms | 292 ms | **0** | 56 ms |
| desktop 1440, reduced motion | 284 ms | 284 ms | **0** | 37 ms |

Bytes over the wire: **baseline 382 KB, of which JS 212 KB** (budget 250 KB) —
this is what every visitor loads. The lazy 3D chunk adds **1.20 MB**
(252 KB JS + 873 KB model + 74 KB DRACO decoder; budget 1.8 MB) and only on
desktops that pass the gate. Zero 3D bytes on mobile, reduced motion, or
software renderers. `axe-core` (wcag2a/2aa/21a/21aa + best-practice): **no
violations** at any of the five profiles. Keyboard: 18 stops, every one
visible with a focus ring, correct order, no pin traps.

Four real defects were found and fixed at this gate, none of them cosmetic:

1. **CLS 0.044 → 0.004.** The hero headline re-wrapped from two lines to
   three when Newsreader swapped in, dragging the whole hero down.
   `size-adjust` (which next/font applies) corrects vertical metrics but
   cannot correct glyph advance widths, so the wrap itself moved. Fixed by
   authoring every line break explicitly — the same three lines the loaded
   font produces.
2. **Un-revealed sections were invisible to assistive tech.** The reveal
   animation used gsap's `autoAlpha`, which adds `visibility: hidden`,
   dropping every not-yet-scrolled section out of the accessibility tree and
   the tab order: a keyboard visitor tabbed from the hero straight to the
   footer, never reaching the pilot form. Reveals now animate `opacity`, and
   a `focusin` handler completes a reveal the instant focus enters it.
3. **Zoom was disabled site-wide.** `user-scalable=no` sat in the root
   layout — deliberate for the walking guide, but it also suppressed
   pinch-zoom on the marketing page and the admin tool (WCAG 1.4.4). Now
   scoped to the `/tour/[venue]` route only.
4. **Software renderers now fall back.** With no GPU, compiling ~30 PBR
   programs and convolving the environment map blocked the main thread for
   **8.4 s (one 6.5 s task)** — versus 27 ms with the 3D off. Lowering `dpr`
   changed nothing, confirming it is shader/environment setup rather than
   pixel work. `deviceCan3D` now reads `WEBGL_debug_renderer_info` and
   refuses SwiftShader/llvmpipe, so machines that would freeze get the CSS
   device instead. Desktop TBT on this container: 8394 ms → 56 ms.

Also fixed here: the attract walk now runs as a single module-scoped engine
shared via `useSyncExternalStore`, because the 3D screen mounted its own
second engine and visibly restarted the walk at the crossfade.

Two honest caveats. This container has **no GPU** (SwiftShader), so the 3D
path's cost on real hardware is unmeasured — it is verified functionally by
stubbing the renderer string from the test side, never in product code. And
Lighthouse itself was not run (not installed offline); the numbers above are
direct `PerformanceObserver` measurements of the same metrics, which is
what Lighthouse reports for LCP/CLS/TBT anyway.

## 9. Explicitly avoided

Centered-hero-with-gradient-blob; Inter/default sans; stock people-at-laptops or
fake-specific "African museum" stock photography (the product UI and the floor-plan
figures ARE the imagery); fabricated logos/testimonials/forms; "impressive demo,
weak message" (every motion beat maps to a product truth: the walk, the light-up,
the honesty); and the export's own tics (italic-em everywhere, uniform section rhythm,
CDN fonts).

## 10. Phases (each: implement → show proof → wait for review)

1. **Foundation** — replace `/`: tokens/fonts (self-hosted), nav/footer, full copy,
   all sections laid out static-first with the CSS-frame phone; already responsive.
   *Proof: screenshots at 3 viewports.*
2. **Scroll choreography** — Lenis + GSAP; hero entrance, the hero→map signature
   transition (2D version), the pinned scroll-walk centerpiece, section reveals,
   reduced-motion path. *Proof: screen recordings + reduced-motion screenshots.*
3. **The 3D phone** — download/inspect candidates, debrand, compress, R3F scene,
   live-screen embed, fallback chain, perf check. *Proof: bundle sizes + visual.*
4. **Real-capture integration & polish** — admin captures, attract-mode screen,
   copy pass, a11y pass.
5. **Ship gate** — Lighthouse/CWV numbers, Playwright screenshot suite, cross-viewport
   QA, docs, push.

## Open questions (need your answers before Phase 1)

1. **CTA destination** — what real contact exists today? (`mailto:` is fine and
   on-brand; I will not build a fake form.)
2. **Attribution OK?** CC-BY model credit line in the footer — acceptable, or prefer
   the CC0 model / a purchased license later?
3. **Debranding the device** (no Apple logo) — confirm you're comfortable with that
   interpretation of "realistic phone frame."
4. `/` currently serves the dev chooser — confirm replacing it with the landing page
   (dev links demoted to footer).
