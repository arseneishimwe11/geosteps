export function Footer() {
  return (
    <footer className="border-t border-hairline/50">
      <div className="mx-auto flex max-w-6xl flex-wrap items-start justify-between gap-x-10 gap-y-8 px-5 py-12 sm:px-8">
        <div className="max-w-sm">
          <div className="flex items-center gap-2.5">
            <span className="h-2.5 w-2.5 rounded-full bg-brass shadow-[0_0_14px_2px] shadow-brass/70" />
            <span className="font-display text-lg text-parchment">geosteps</span>
          </div>
          <p className="mt-3 text-[13px] leading-relaxed text-stone">
            An indoor audio guide for museums and cultural sites — built for the venues that need it
            most. Room-level, screen-on, honest about both.
          </p>
        </div>

        <div className="flex flex-col gap-2 font-mono text-[11px] leading-relaxed text-stone/85">
          <span className="mb-1 tracking-[0.2em] text-stone">COLOPHON</span>
          <span>Fonts self-hosted · no trackers · no analytics</span>
          <span>Positioning runs on the visitor&rsquo;s phone; nothing is recorded or uploaded</span>
          <span>
            3-D device:{' '}
            <a
              href="https://sketchfab.com/3d-models/apple-iphone-15-pro-max-black-df17520841214c1792fb8a44c6783ee7"
              rel="license noopener"
              className="underline decoration-stone/30 underline-offset-2 transition-colors hover:text-brass"
            >
              &ldquo;Apple iPhone 15 Pro Max Black&rdquo;
            </a>{' '}
            by{' '}
            <a href="https://sketchfab.com/Polyman_3D" rel="noopener" className="underline decoration-stone/30 underline-offset-2 transition-colors hover:text-brass">
              polyman
            </a>
            ,{' '}
            <a href="https://creativecommons.org/licenses/by/4.0/" rel="license noopener" className="underline decoration-stone/30 underline-offset-2 transition-colors hover:text-brass">
              CC&nbsp;BY&nbsp;4.0
            </a>{' '}
            — modified (debranded)
          </span>
        </div>

        <div className="flex flex-col gap-2 font-mono text-[11px] leading-relaxed">
          <span className="mb-1 tracking-[0.2em] text-stone">FOR DEVELOPERS</span>
          <a href="/tour/demo" className="text-stone/85 transition-colors hover:text-brass">/tour/demo — visitor runtime</a>
          <a href="/admin/demo" className="text-stone/85 transition-colors hover:text-brass">/admin/demo — calibration</a>
          <a href="/dev/audits" className="text-stone/85 transition-colors hover:text-brass">/dev/audits — field observability</a>
        </div>
      </div>
    </footer>
  );
}
