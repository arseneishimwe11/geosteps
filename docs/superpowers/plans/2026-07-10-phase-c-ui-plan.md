# Phase C UI (run 1 — no drawing canvas) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. *(This session: neither sub-skill is installed; executed inline by the planning session itself, which has full context.)*

**Goal:** Ship the tourist runtime UI, the admin acoustic-recorder + audio-management surface, and the acoustic-audit observability view on top of the frozen PositionEngine — everything in Phase C except the polygon/graph drawing canvas.

**Architecture:** Next.js app lives at the repo root (`src/app`), importing the engine relatively from `src/engine` (one TS tree, no monorepo plumbing). The existing `src/server` venue server stays the only backend and gains one audio-upload route. A single `guideSession` module is the only place platform APIs meet the engine; all React components are presentational subscribers.

**Tech Stack:** Next.js 15 (app router) + React 19 + TypeScript strict; Tailwind CSS v4 via `@tailwindcss/postcss` (`@import "tailwindcss"` + `@theme`, no tailwind.config); Web Audio/getUserMedia through the existing engine platform helpers; Playwright (MCP/webapp-testing) for the demo proof.

## Global Constraints

- The UI never computes position/zone logic — it renders `PositionState`/`ZoneEvent`/`AcousticSampleAudit` from the engine only (HANDOFF §4.1).
- Engine source (`src/engine/**`) and its 51 tests are frozen — zero diffs there.
- Every non-ok capability/wake-lock state renders its engine message **verbatim**; no silent failure (HANDOFF §4.2).
- One-tap start: permissions + wake lock + audio unlock all inside the single "Start the guide" gesture (HANDOFF §4.3).
- Plain web page; no PWA install, no service worker (ARCHITECTURE §1.4).
- Uncertainty rendered as a fuzzy disc, never a confident dot (HANDOFF §4.5).
- Manual exhibit list reachable within one tap of any error state (HANDOFF §4.6).
- Placeholder audio must be labeled "Placeholder tone — not narration" everywhere it appears.
- Blueprint saves are gated on `validateBlueprint(...).ok` client-side; server still re-validates.
- `npm test` (engine + server) stays green; `npx tsc --noEmit` stays clean.

---

### Task 1: Venue server audio-upload route (TDD)

**Files:**
- Modify: `src/server/server.ts` (add PUT branch in the audio route section)
- Test: `tests/server.test.ts`

**Interfaces:**
- Produces: `PUT /venues/:id/audio/:file` — body = raw audio bytes; 200 `{ok:true, url:"audio/<file>"}`; 400 invalid id/name; 413 >15 MiB; 415 unknown extension. GET of the same path serves it back with the right content-type.

- [ ] Write failing tests: PUT wav → 200 and GET round-trips bytes/content-type; PUT `.exe` → 415; PUT traversal name → 400; PUT 16 MiB → 413.
- [ ] Run `npx vitest run tests/server.test.ts` — new tests FAIL (route missing).
- [ ] Implement: extend the existing `parts[2] === 'audio'` branch with `req.method === 'PUT'`: validate `VENUE_ID`/`AUDIO_FILE` + extension against `AUDIO_TYPES`, `readBody(req, 15 * 1024 * 1024)` (catch → 413), `mkdir -p`, `writeFile`.
- [ ] `npx vitest run` — all green. Commit `feat(server): audio upload route`.

### Task 2: Placeholder-tone WAV synthesis + demo seed (TDD)

**Files:**
- Create: `src/ui/audio/placeholderTone.ts` — pure function, no DOM.
- Create: `scripts/generate-placeholder-tones.ts` (tsx-run; writes `venues/demo/audio/*.wav`, rewrites blueprint `audio` refs to `.wav` + placeholder titles)
- Test: `tests/placeholderTone.test.ts`

**Interfaces:**
- Produces: `renderPlaceholderToneWav(opts: {zoneName: string; language: string; seed: number; seconds?: number}): Uint8Array` — 16-bit PCM mono 22050 Hz RIFF/WAVE; distinct base pitch per seed (220 Hz × 2^(seed×5/12)), two-note motif + fade, so zones are audibly distinguishable.
- Produces: script CLI `npx tsx scripts/generate-placeholder-tones.ts demo`.

- [ ] Failing test: header bytes `RIFF`/`WAVE`/`fmt `/`data`, length matches seconds×rate×2+44, RMS of samples > 0.05 (non-silent), two different seeds differ.
- [ ] Implement synth (sine + envelope, hand-built 44-byte header). Tests green.
- [ ] Run seed script for `demo`; verify files exist and blueprint still passes `validateBlueprint` (blueprint test already enforces). Commit `feat(audio): placeholder tone pipeline + demo seed`.

### Task 3: Next.js scaffold wired to the engine

**Files:**
- Modify: `package.json` (deps: `next react react-dom`; dev: `tailwindcss @tailwindcss/postcss postcss @types/react @types/react-dom`; scripts `dev/build/start`), `tsconfig.json` (jsx preserve, next plugin, incremental — accept Next's auto-edits), `.gitignore` (`.next/`)
- Create: `next.config.ts`, `postcss.config.mjs`, `next-env.d.ts` (auto), `src/app/layout.tsx`, `src/app/globals.css` (`@import "tailwindcss"; @theme { --color-brass:#d4a24e; … }` true-black palette), `src/app/page.tsx` (venue chooser linking to /tour/demo + /admin/demo)
- Create: `src/ui/api.ts`

**Interfaces:**
- Produces: `VENUE_API` (from `NEXT_PUBLIC_VENUE_API`, default `http://localhost:4000`); `fetchBlueprint(venueId): Promise<FloorBlueprint>` (validates + throws readable error); `saveBlueprint(venueId, bp)`; `uploadAudio(venueId, filename, bytes|Blob): Promise<{url}>`; `audioUrl(venueId, relativeUrl): string`.

- [ ] Install deps; create files; `npm run dev` boots; `curl localhost:3000` renders chooser.
- [ ] `npx tsc --noEmit` clean and `npx vitest run` still 51+new green (vitest must not pick up .next). Commit `feat(ui): Next.js scaffold + venue API client`.

### Task 4: guideSession — the one platform↔engine wiring module

**Files:**
- Create: `src/ui/session/guideSession.ts`
- Create: `src/ui/session/simulator.ts` (dev-only drivers)

**Interfaces:**
- Produces: `class GuideSession` with `snapshot(): GuideSnapshot`, `subscribe(cb): unsub` (useSyncExternalStore-compatible), `async start(language)` (MUST be called from the tap handler: `requestMotionPermissions(window)` → capability merge → `WakeLockManager.start()` → sensor streams (`startMotionStream`/`startHeadingStream` throttled ~10 Hz) → 500 ms `engine.tick` interval → `AudioDirector` on `HtmlAudioBackend` with URLs resolved via `audioUrl` → optional mic sampling loop every 15 s, 2 s clips via `captureAmbientClip`+`computeFingerprint` → `engine.handleAcousticSample`), `stop()`, `setLanguage(lang)`.
- `GuideSnapshot = { phase:'idle'|'starting'|'active'|'error'; capabilities: CapabilityReport|null; wakeLock:{state:WakeLockState; message:string}|null; position: PositionState|null; lastZoneEvent: ZoneEvent|null; nowPlaying:{zoneId:string; title?:string}|null; micActive:boolean; audits: AcousticSampleAudit[] (ring 200, mirrored to localStorage `geosteps.audits.<venue>`); startError:string|null }`.
- Simulator: `simStep(session, compassDeg, n)` (heading+`stepOnce` with real timestamps), `simAcoustic(session, zoneId, noise)` (builds fingerprint from that zone's stored energies + jitter — uses blueprint data as *input to the engine*, computes nothing), `simTick(session)`.

- [ ] Implement; `npx tsc --noEmit` clean. (Behavioral proof lands in Task 8's browser run — unit-testing this module would mean mocking every platform API the engine tests already cover.) Commit `feat(ui): guide session store + dev simulator`.

### Task 5: Tourist runtime `/tour/[venue]`

**Files:**
- Create: `src/app/tour/[venue]/page.tsx` (server shell) + `src/ui/tour/TourApp.tsx` (client root)
- Create: `src/ui/tour/StartScreen.tsx` (language picker from `venue.languages`, capability preflight list, giant Start button), `GuideScreen.tsx` (zone name display, guide-active pulse, wake-lock chip, uncertainty text, now-playing bar), `Minimap.tsx` (SVG: zone outlines + walkable graph from blueprint, position dot + blurred uncertainty circle — pure render of `PositionState`), `StatusChips.tsx` (per-capability verbatim messages), `ManualList.tsx` (exhibit list + play buttons; the one-tap fallback), `DevDrawer.tsx` (visible only with `?dev=1`: arrow step buttons, acoustic inject per fingerprinted zone, visibility hint, audit table link)
- Reuse: everything through `GuideSession` only.

**Interfaces:** Consumes Task 3 `fetchBlueprint`/`audioUrl`, Task 4 `GuideSession`+simulator. Produces `data-testid`s for Task 8: `start-guide`, `zone-name`, `wakelock-chip`, `guide-active`, `capability-msg-<name>`, `now-playing`, `sim-step-n|s|e|w`, `sim-acoustic-<zoneId>`, `manual-list`.

- [ ] Build screens per spec §2 design direction (true black, brass accent, display serif zone names, big touch targets).
- [ ] Manual check in dev browser with `?dev=1`: start → active, sim-walk into a zone → zone name + placeholder tone plays, wake-lock chip states. Commit `feat(ui): tourist runtime`.

### Task 6: Admin surface `/admin/[venue]` (no drawing canvas)

**Files:**
- Create: `src/app/admin/[venue]/page.tsx` + `src/ui/admin/AdminApp.tsx`, `ZoneCard.tsx` (geometry read-only summary), `RecorderPanel.tsx` (stand-here instructions → `captureAmbientClip(8)` → `computeFingerprint` → band-energy bar viz → set into working blueprint; honest denied/unsupported states from `detectCapabilities`), `AudioSlots.tsx` (per language: current ref, file upload → `uploadAudio` → set `{url,title}`; "Generate placeholder tone" → `renderPlaceholderToneWav` → upload; inline preview `<audio>`), `ValidationPanel.tsx` (`validateBlueprint` errors/warnings live; Save disabled until ok → `saveBlueprint`), `ComingNextPanel.tsx` (honest polygon/graph-editor placeholder), unauthenticated-write banner.

**Interfaces:** Consumes Tasks 2–4 exports. Produces test-ids: `record-zone-<id>`, `fingerprint-viz-<id>`, `upload-<zoneId>-<lang>`, `gen-placeholder-<zoneId>-<lang>`, `validation-status`, `save-blueprint`, `admin-warning`.

- [ ] Build; manual check: generate placeholder for a slot, save round-trips (GET shows new blueprint). Commit `feat(ui): admin recorder + audio management + validation gate`.

### Task 7: Audit observability view

**Files:**
- Create: `src/ui/tour/AuditTable.tsx` (monospace table: time, candidates, top-two margin, streak, action, Δposition; empty-state explains what audits are), wire into DevDrawer + `src/app/dev/audits/page.tsx` (reads localStorage ring, per-venue selector, Export JSON button `geosteps-audits-<venue>-<date>.json`).

**Interfaces:** Consumes `GuideSnapshot.audits` + localStorage key from Task 4.

- [ ] Build; verify records appear after `sim-acoustic` injections and survive reload. Commit `feat(ui): acoustic audit observability`.

### Task 8: Playwright end-to-end proof

**Files:** screenshots to scratchpad; no repo files except any bugfixes found.

- [ ] Start `npm run server` (:4000) + `npm run dev` (:3000) in background.
- [ ] Tourist: open `/tour/demo?dev=1` → screenshot start screen → tap Start → assert `guide-active` + `wakelock-chip=active` → sim-walk north+east into Royal Drums → assert `zone-name` and `now-playing` (placeholder label) → screenshot → inject 3× acoustic zone-c → assert audit rows grow and reanchor row appears → screenshot audit table.
- [ ] Honesty path: reload with mic/motion denied via CDP overrides where feasible; assert verbatim capability messages visible; screenshot.
- [ ] Admin: open `/admin/demo` → banner visible → generate placeholder for a slot → validation ok → Save → re-GET blueprint shows change → screenshot.
- [ ] Send screenshots to user. Fix anything found; keep suite green.

### Task 9: Docs + ship

- [ ] README: `npm run dev` + `npm run server` two-terminal quickstart, routes table, `?dev=1` note.
- [ ] HANDOFF §3: mark shipped items; remaining = drawing canvas (next run), upload-route auth, real narration content.
- [ ] `npx tsc --noEmit` + `npx vitest run` green → commit `docs: Phase C run-1 status` → push branch.

## Self-Review

- **Spec coverage:** spec §1 tourist/admin/observability → Tasks 5/6/7; validation gate → 6; placeholder pipeline → 2+6; upload route → 1; simulator-not-computing constraint → 4; demo proof → 8; docs → 9. Drawing canvas intentionally absent (spec scope cut). ✓
- **Placeholder scan:** the only "placeholder" strings are the audio-tone product feature itself. ✓
- **Type consistency:** `GuideSnapshot`/simulator names defined once in Task 4 and only consumed afterward; server route contract defined in Task 1 and consumed by `uploadAudio` (Task 3) and admin (Task 6). ✓
