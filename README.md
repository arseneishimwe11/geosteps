# geosteps

Web-based indoor audio guide for museums and cultural sites — built for
low-budget venues with no digital infrastructure (the motivating case:
regional museums in Rwanda / East Africa, where two or three tour guides
cover both capacity and language gaps for daily visitor volume).

A visitor scans a QR code at the entrance, picks a language, and — holding
the phone like any walking-nav app — hears pre-recorded narration
automatically as they approach each exhibit zone, in whatever order they
actually walk. No app store, no beacons, no WiFi surveys, no hardware added
to the building. This does not replace tour guides; it scales multilingual
coverage to the visitors guides can't get to.

**How it works, honestly:** step detection + compass dead reckoning,
corrected by map-matching against an admin-recorded walkable-floor graph and
opportunistically re-anchored by per-room ambient-audio fingerprints.
Room-level accuracy, screen-on operation. The full design — including the
web-platform constraints that shaped it and the accuracy limits stated
plainly — is in [ARCHITECTURE.md](./ARCHITECTURE.md). What's frozen vs. what
remains is in [HANDOFF.md](./HANDOFF.md).

## Status

- **Done (Phase A):** position engine (step detection, dead reckoning,
  map matching, geofencing, acoustic fingerprinting, wake-lock manager,
  audio director), floor-blueprint schema + validator, venue server,
  proof suite.
- **Done (Phase C, run 1):** tourist runtime UI, admin calibration surface
  (acoustic recorder + narration management + validation-gated save),
  placeholder-audio pipeline, acoustic-audit observability, scripted
  end-to-end browser proof.
- **Next:** the admin floor-plan canvas (draw zone polygons, trace the
  walkable graph), auth for the server's write routes, real narration
  content. See HANDOFF.md.

## Running the demo

Two terminals:

```bash
npm install
npm run server    # venue content API on :4000
npm run dev       # web app on :3000
```

| Route | What it is |
|---|---|
| `/tour/demo` | Tourist runtime (what the entrance QR code opens) |
| `/tour/demo?dev=1` | Same, plus the dev simulator drawer (drive the engine without sensors) |
| `/admin/demo` | Staff calibration: acoustic snapshots, narration slots, validated save |
| `/dev/audits` | Acoustic-corrector audit log collected on this device, JSON export |

Prove it end-to-end in a real browser (starts nothing — expects both servers up):

```bash
npx tsx scripts/e2e-demo.ts            # asserts the full tour + admin flow, drops screenshots
npx tsx scripts/generate-placeholder-tones.ts demo   # (re)seed placeholder narration
npm test          # engine + server + tone suite (59 tests)
npm run typecheck
```

## Layout

- `src/engine/` — the position engine (pure TypeScript, framework-free, frozen)
- `src/server/` — one-directory-per-venue blueprint + audio server
- `src/app/`, `src/ui/` — Next.js app: tourist runtime, admin surface, audit views
- `venues/demo/` — example floor blueprint (four-room museum) + placeholder audio
- `tests/` — simulated-walk scenarios: irregular routes, injected compass
  drift, acoustic false-positive rejection, boundary flicker, permission
  denials, wake-lock lifecycle, upload/validation routes
