import Link from 'next/link';

/**
 * Landing / venue chooser. In production a visitor never sees this — the QR
 * code deep-links straight to /tour/<venue>. It exists for development and
 * for staff to reach the admin surface.
 */
export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-10 px-6 py-16">
      <header>
        <p className="mb-2 text-xs uppercase tracking-[0.3em] text-brass">geosteps</p>
        <h1 className="font-display text-4xl leading-tight text-parchment">
          Indoor audio guide,
          <br />
          no app required.
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-stone">
          Visitors scan a QR code at the entrance. Staff calibrate once. Everything below runs on
          the demo venue.
        </p>
      </header>

      <nav className="flex flex-col gap-3">
        <Link
          href="/tour/demo"
          className="rounded-2xl border border-brass/40 bg-panel px-5 py-4 transition-colors hover:border-brass"
        >
          <span className="block font-display text-xl text-brass-bright">Tourist runtime</span>
          <span className="mt-1 block text-sm text-stone">
            What the visitor's QR code opens — language pick, one-tap start, hands-free guiding.
          </span>
        </Link>
        <Link
          href="/admin/demo"
          className="rounded-2xl border border-hairline bg-panel px-5 py-4 transition-colors hover:border-stone"
        >
          <span className="block font-display text-xl text-parchment">Admin calibration</span>
          <span className="mt-1 block text-sm text-stone">
            Acoustic snapshots, narration slots, blueprint validation & save.
          </span>
        </Link>
        <Link
          href="/dev/audits"
          className="rounded-2xl border border-hairline bg-panel px-5 py-4 transition-colors hover:border-stone"
        >
          <span className="block font-mono text-sm text-moss">/dev/audits</span>
          <span className="mt-1 block text-sm text-stone">
            Field-observability: recent acoustic-corrector audit records.
          </span>
        </Link>
      </nav>

      <footer className="text-xs leading-relaxed text-stone/70">
        Requires the venue server: <code className="font-mono">npm run server</code> (port 4000).
        Tourist dev simulator: append <code className="font-mono">?dev=1</code>.
      </footer>
    </main>
  );
}
