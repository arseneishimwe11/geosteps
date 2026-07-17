/**
 * The hero device — Phase 1: the design export's CSS frame, rebuilt on
 * tokens. This exact component remains the low-power / reduced-motion /
 * no-WebGL fallback once the 3D device lands in Phase 3, so the screen
 * content is built once and shared.
 *
 * The screen mirrors the real tourist guide UI (same states, same tokens,
 * same honest caption) — swapped for the live app screen in Phase 4.
 */

function StatusBar() {
  return (
    <div className="relative z-[5] flex items-center justify-between px-6 pt-3">
      <span className="text-[13px] font-semibold tracking-[0.01em] text-parchment">9:41</span>
      <div className="flex items-center gap-1.5">
        <span className="flex h-[11px] items-end gap-[1.5px]">
          {[4, 6, 8, 11].map((h) => (
            <span key={h} className="w-[2.5px] rounded-[1px] bg-parchment" style={{ height: h }} />
          ))}
        </span>
        <span className="relative flex h-[11px] w-[22px] items-center rounded-[3px] border border-parchment/60 p-[1.5px]">
          <span className="h-full w-[70%] rounded-[1px] bg-parchment" />
          <span className="absolute -right-[3px] top-1/2 h-1 w-[1.5px] -translate-y-1/2 rounded-r-[1px] bg-parchment/60" />
        </span>
      </div>
    </div>
  );
}

function MiniMap() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-hairline bg-gradient-to-br from-[#101317] to-[#0b0d10] p-2.5">
      <svg viewBox="0 0 240 172" className="block w-full" aria-label="Floor minimap with the visitor's approximate position">
        <defs>
          <radialGradient id="hpHalo" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ecc887" stopOpacity="0.55" />
            <stop offset="55%" stopColor="#d2a24c" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#d2a24c" stopOpacity="0" />
          </radialGradient>
          <filter id="hpBlur" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="5" />
          </filter>
        </defs>
        <rect x="14" y="12" width="86" height="58" rx="6" fill="none" stroke="#2c3037" strokeWidth="1" />
        <rect x="14" y="86" width="98" height="74" rx="6" fill="none" stroke="#2c3037" strokeWidth="1" />
        <rect x="128" y="94" width="98" height="66" rx="6" fill="none" stroke="#2c3037" strokeWidth="1" />
        <rect x="116" y="12" width="110" height="70" rx="7" fill="rgba(210,162,76,.09)" stroke="#d2a24c" strokeWidth="1.2" />
        <polyline
          points="60,150 60,110 60,52 112,44 168,44"
          fill="none"
          stroke="#8fb562"
          strokeOpacity="0.55"
          strokeWidth="2"
          strokeDasharray="1 6"
          strokeLinecap="round"
        />
        <circle cx="60" cy="150" r="3" fill="#8fb562" fillOpacity="0.7" />
        <circle cx="176" cy="46" r="40" fill="url(#hpHalo)" filter="url(#hpBlur)" />
        <circle cx="176" cy="46" r="4.5" fill="#f2d79a" fillOpacity="0.85" />
        <text x="124" y="28" fontSize="8" letterSpacing="1.4" fill="#ecc887" style={{ fontFamily: 'var(--font-mono)' }}>
          ROYAL DRUMS
        </text>
        <text x="22" y="26" fontSize="7.5" letterSpacing="1.2" fill="#5b5e64" style={{ fontFamily: 'var(--font-mono)' }}>
          MASKS
        </text>
        <text x="22" y="100" fontSize="7.5" letterSpacing="1.2" fill="#5b5e64" style={{ fontFamily: 'var(--font-mono)' }}>
          KINGDOM
        </text>
      </svg>
      <div className="mt-2 flex items-center gap-1.5 px-0.5">
        <span className="h-[7px] w-[7px] rounded-full bg-[radial-gradient(circle,#f2d79a,rgba(242,215,154,0))]" />
        <span className="font-mono text-[8px] tracking-[0.08em] text-[#6b6e74]">
          approximate position — room-level, not a precise dot
        </span>
      </div>
    </div>
  );
}

export function HeroPhone() {
  return (
    <div className="relative w-[clamp(280px,30vw,330px)] rounded-[clamp(44px,4.4vw,52px)] bg-gradient-to-br from-[#232830] via-[#14171b] to-[#0a0c0e] p-[10px] shadow-[0_0_0_1.5px_#34383f,inset_0_1px_1px_rgba(255,255,255,.14),inset_0_-2px_3px_rgba(0,0,0,.6),0_50px_120px_-34px_rgba(210,162,76,.5),0_30px_90px_-30px_rgba(0,0,0,.9)]" style={{ aspectRatio: '9/19.5' }}>
      <div className="relative flex h-full w-full flex-col overflow-hidden rounded-[clamp(36px,3.6vw,42px)] bg-ink">
        {/* top screen glow — the lantern */}
        <div className="pointer-events-none absolute left-1/2 top-[-6%] h-[44%] w-[150%] -translate-x-1/2 bg-[radial-gradient(ellipse_at_50%_0%,rgba(210,162,76,.14),rgba(210,162,76,0)_70%)]" />
        {/* dynamic island */}
        <div className="absolute left-1/2 top-[11px] z-[8] h-[27px] w-[92px] -translate-x-1/2 rounded-2xl bg-ink shadow-[inset_0_0_0_1px_#16181c]" />
        <StatusBar />

        <div className="relative z-[3] flex min-h-0 flex-1 flex-col px-5 pt-5">
          <div className="mb-5 flex items-center justify-between">
            <span className="font-mono text-[10px] font-medium tracking-[0.18em] text-stone">ROYAL PALACE</span>
            <span className="flex items-center gap-1.5 whitespace-nowrap rounded-full border border-moss/30 bg-moss/5 px-2 py-1 font-mono text-[9.5px] font-medium tracking-[0.06em] text-moss">
              <span className="h-[5px] w-[5px] rounded-full bg-moss shadow-[0_0_8px] shadow-moss" />
              WAKE LOCK
            </span>
          </div>

          <div className="mb-3 font-mono text-[9px] font-medium tracking-[0.26em] text-stone">NOW APPROACHING</div>
          <div
            className="animate-gs-warm font-display text-[clamp(30px,3.4vw,36px)] font-medium leading-none tracking-[-0.01em] text-brass-bright [animation-delay:.3s] [text-shadow:0_0_30px_rgba(236,200,135,.4)]"
          >
            Royal Drum
            <br />
            Gallery
          </div>

          <div className="mb-5 mt-4 flex items-center gap-2">
            <span className="relative h-[9px] w-[9px]">
              <span className="absolute -inset-1 animate-gs-ring rounded-full border-[1.5px] border-moss" />
              <span className="absolute inset-0 animate-guide-pulse rounded-full bg-moss shadow-[0_0_8px] shadow-moss" />
            </span>
            <span className="text-[12.5px] font-medium text-moss">Guide active</span>
            <span className="ml-auto flex flex-col items-end leading-tight">
              <span className="font-mono text-xs font-medium text-parchment">±3 m</span>
              <span className="mt-[3px] font-mono text-[7.5px] tracking-[0.12em] text-[#4c4f55]">CONFIDENCE</span>
            </span>
          </div>

          <MiniMap />

          <div className="mb-4 mt-auto pt-4">
            <div className="flex items-center gap-3 rounded-2xl border border-hairline bg-gradient-to-br from-[#16191e] to-[#0d0f12] px-3 py-2.5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[radial-gradient(circle_at_38%_32%,#ecc887,#d2a24c_78%)] shadow-[0_0_18px_rgba(210,162,76,.55)]">
                <span className="flex gap-[3px]">
                  <span className="h-[13px] w-[3px] rounded-[1px] bg-ink" />
                  <span className="h-[13px] w-[3px] rounded-[1px] bg-ink" />
                </span>
              </span>
              <div className="min-w-0 flex-1">
                <div className="mb-1 font-mono text-[8px] font-medium tracking-[0.16em] text-stone">NOW PLAYING · EN</div>
                <div className="truncate text-[12.5px] text-parchment">The royal drums of the kingdom</div>
                <div className="mt-2 flex items-center gap-2">
                  <div className="relative h-[3px] flex-1 rounded-sm bg-hairline">
                    <div className="h-full w-[38%] rounded-sm bg-gradient-to-r from-brass to-brass-bright" />
                    <span className="absolute left-[38%] top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brass-bright shadow-[0_0_8px_rgba(236,200,135,.8)]" />
                  </div>
                  <span className="font-mono text-[8.5px] font-medium text-[#6b6e74]">1:12</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* home indicator */}
        <div className="absolute bottom-2 left-1/2 z-[6] h-[5px] w-[120px] -translate-x-1/2 rounded-[3px] bg-parchment/40" />
      </div>
    </div>
  );
}
