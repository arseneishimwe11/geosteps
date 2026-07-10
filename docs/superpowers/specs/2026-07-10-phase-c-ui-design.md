# Phase C UI — Design Spec (run 1: everything except the drawing canvas)

Date: 2026-07-10 · Status: approved-by-master-prompt (autonomous session)

This spec is the brainstorming-skill output for Phase C. The user's master
prompt plus the committed HANDOFF.md already answer the clarifying questions
a live session would ask; where they are silent, the assumption is recorded
here. **Explicit scope cut for this run (user instruction): the admin
floor-graph / zone-polygon drawing canvas is deferred to a follow-up
max-effort run.** Everything else in Phase C ships now.

## 1. Purpose & success criteria

Two user-facing surfaces over the frozen, 51/51-tested `PositionEngine`:

- **Tourist runtime** — QR-landing → language → one-tap start → dark
  screen-on guide that renders (never computes) engine state and plays
  per-zone narration.
- **Admin surface** — per-zone acoustic snapshot recorder, per-zone
  per-language audio management with a placeholder-tone pipeline, client-side
  blueprint validation gate, save to the venue server. (Polygon/graph editor:
  next run; its slot in the UI is an honest "coming next" panel, not a stub
  pretending to work.)
- **Field observability** — a developer view of `AcousticSampleAudit`
  records, persisted locally, exportable.

Success = a running local demo, driven end-to-end in a real browser
(Playwright), with screenshots: guide start, zone enter with audio trigger,
wake-lock state transitions, honest permission-denied messaging, recorder
flow, placeholder upload, validated save. Carried acceptance criteria:
UI computes nothing; exported blueprint validates before save; nothing fails
silently.

## 2. Decisions & alternatives considered

**App location — Next.js at the repo root (`src/app`), engine imported
relatively.** Alternatives: (a) `apps/web` workspace — rejected: needs
monorepo plumbing (`externalDir`/`transpilePackages`) for zero benefit at
this size; (b) separate repo — rejected: HANDOFF freezes engine+UI in one
history on purpose. Root placement keeps `../engine/index` imports inside
one TS tree; vitest/tsc setups already include `src/**`.

**Backend — keep the existing `src/server` venue server as the only
backend; add one route (`PUT /venues/:id/audio/:file`).** Alternative:
Next API routes — rejected: the venue server is the deployment story for
cheap venues (a directory + a tiny Node process); duplicating storage
behind Next couples content to the UI host. The tourist app reads
`NEXT_PUBLIC_VENUE_API` (default `http://localhost:4000`).

**Write-route auth — stays off, loudly.** Per master prompt: acceptable for
local/demo; the admin UI shows a permanent banner naming the risk. A shared
`ADMIN_TOKEN` env check is a follow-up noted in HANDOFF, not built now
(YAGNI for the local demo; building half an auth story invites false
confidence).

**Demo drivability — a dev-only simulator drawer on the tour page.**
The container (and any desktop browser) has no walking sensors. The drawer
injects *inputs into the engine* (`handleHeading` + `stepOnce`, canned
acoustic fingerprints via `handleAcousticSample`) — the UI still renders
only engine output, so the acceptance criterion holds. Enabled by
`?dev=1`, clearly labeled, invisible otherwise. Alternative — synthetic
`devicemotion` event dispatch — rejected: flakier, proves nothing extra.

**Placeholder audio — client- and script-generated WAV tones.** Distinct
pitch per zone, spoken-free, `title: "Placeholder tone — not narration"`.
WAV because the browser can synthesize it dependency-free
(engine-adjacent code already does DSP); server already serves
`audio/wav`. A seed script fills the demo venue so the tourist flow works
out of the box; the admin UI can regenerate/upload per slot to prove the
management pipeline.

**Audit persistence — localStorage ring buffer (last 200) + JSON export
button.** Alternative — POST to server — rejected for this run: pilot
protocol isn't designed yet; a copy-out button gets field data today
without inventing a telemetry schema.

**Design direction (frontend-design skill applied):** the tourist surface
is an instrument, not a brochure — true-black AMOLED ground, one warm
accent (amber/gold, museum brass), large display serif for zone names
(local fallback stack — no external font fetches on a venue's flaky WiFi),
tabular monospace for the audit table. Admin shares the palette on
near-black slate so staff learn one visual language. All state chips
(wake lock, sensors, mic) use the engine's exact message strings.

## 3. Architecture

```
src/app/                      Next.js (app router)
  page.tsx                    venue chooser (dev convenience)
  tour/[venue]/page.tsx       tourist runtime (client component tree)
  admin/[venue]/page.tsx      admin surface (client component tree)
src/ui/
  api.ts                      blueprint fetch/save, audio upload (venue server client)
  session/guideSession.ts     the ONE place that wires platform → engine →
                              director; exposes a React store (useSyncExternalStore)
  session/simulator.ts        dev-only engine drivers (steps, headings, canned fingerprints)
  audio/placeholderTone.ts    WAV synthesis (shared by admin UI + seed script)
  components/…                presentational only; props in, DOM out
scripts/generate-placeholder-tones.ts   seeds venues/demo/audio + blueprint refs
src/server/server.ts          + PUT audio route (only non-UI change)
```

`guideSession` owns lifecycle: capability detection → gesture-gated
permission requests → wake-lock manager → sensor streams → engine ticks →
`AudioDirector` → audit ring buffer. Components subscribe to its snapshot;
none of them touch geometry or platform APIs. The engine and its tests are
not modified anywhere in this phase.

## 4. Error handling & honesty rules

Every capability (`motion`, `orientation`, `wakeLock`, `microphone`) renders
its engine-provided message verbatim when non-ok, with the manual exhibit
list reachable in one tap from any error state. Wake-lock chip states map
1:1 to `WakeLockState`. Mic denial downgrades the acoustic layer only (guide
continues; chip says so). Upload/save failures surface the server's error
body next to the control that caused them. No toast-and-vanish: states
persist until resolved.

## 5. Testing

- Server upload route: extend `tests/server.test.ts` (happy path, bad
  extension, traversal, size cap).
- Placeholder WAV synthesis: unit test (RIFF header, duration, non-silence).
- UI: Playwright-driven demo (tour flow incl. zone-enter audio trigger and
  wake-lock visibility round-trip; admin recorder + upload + validation
  gate), screenshots as the deliverable proof. Engine suite must stay 51/51
  untouched.
