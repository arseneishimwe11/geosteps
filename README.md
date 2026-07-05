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
  47-test proof suite.
- **Next (Phase C):** admin calibration UI, tourist-facing dark UI,
  audio content management. See HANDOFF.md.

## Commands

```bash
npm install
npm test          # the position-engine proof suite (47 tests)
npm run typecheck
npm run server    # serves venues/ on :4000 (GET /venues/demo/blueprint.json)
```

## Layout

- `src/engine/` — the position engine (pure TypeScript, framework-free)
- `src/server/` — one-directory-per-venue blueprint + audio server
- `venues/demo/` — example floor blueprint (four-room museum)
- `tests/` — simulated-walk scenarios: irregular routes, injected compass
  drift, acoustic false-positive rejection, boundary flicker, permission
  denials, wake-lock lifecycle
