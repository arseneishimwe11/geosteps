import { SectionLabel } from './bits';

const STEPS = [
  ['UPLOAD', 'Photograph or scan the floor plan and drop it on the canvas.'],
  ['TRACE', 'Draw each exhibit zone and the walkable paths — click by click, snap-assisted.'],
  ['LISTEN', 'Stand in each room and record eight seconds of its ordinary quiet.'],
] as const;

/**
 * The staff story. The window below is a faithful mock of the real
 * calibration canvas (same tools, same visual language); it is swapped for a
 * live capture of the actual admin surface in Phase 4.
 */
export function Calibrate() {
  return (
    <section id="calibrate" className="border-t border-hairline/50">
      <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 lg:py-32">
        <div className="mb-12 flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-xl">
            <SectionLabel>For your team</SectionLabel>
            <h2 className="font-display text-[clamp(30px,5vw,52px)] font-medium leading-[1.06] tracking-[-0.02em] text-parchment">
              Calibrate once, in an afternoon.
            </h2>
            <p className="mt-5 text-[clamp(16px,1.5vw,18.5px)] leading-[1.65] text-stone">
              No integrators, no site survey. A member of staff walks the museum once with the
              calibration tool — then it just runs.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            {STEPS.map(([tag, body]) => (
              <div key={tag} className="flex items-baseline gap-4">
                <span className="w-16 font-mono text-[10px] font-medium tracking-[0.2em] text-brass">{tag}</span>
                <span className="max-w-[40ch] text-sm leading-relaxed text-stone">{body}</span>
              </div>
            ))}
          </div>
        </div>

        {/* the calibration window */}
        <div className="overflow-hidden rounded-2xl border border-[#2c3037] bg-[#0c0e11] shadow-[0_60px_150px_-60px_rgba(0,0,0,.95)]">
          <div className="flex items-center gap-3.5 border-b border-[#1c1f24] bg-gradient-to-b from-[#16191e] to-[#101317] px-4 py-3">
            <div className="flex gap-2">
              <span className="h-3 w-3 rounded-full bg-ember" />
              <span className="h-3 w-3 rounded-full bg-brass" />
              <span className="h-3 w-3 rounded-full bg-moss" />
            </div>
            <div className="ml-1.5 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-brass shadow-[0_0_10px_rgba(210,162,76,.6)]" />
              <span className="font-display text-[15px] text-parchment">geosteps</span>
              <span className="font-mono text-[10px] font-medium tracking-[0.1em] text-[#6b6e74]">calibration</span>
            </div>
            <span className="ml-auto hidden rounded-lg border border-hairline px-3 py-1.5 font-mono text-[11px] text-[#c9c1b0] sm:block">
              Royal Palace Museum ▾
            </span>
          </div>

          <div className="flex flex-wrap">
            <div className="min-w-[min(100%,320px)] flex-[2_1_440px] border-r border-[#1c1f24] bg-[#08090b] p-4">
              <svg viewBox="0 0 760 500" className="block w-full" role="img" aria-label="Calibration canvas: exhibit zones and a walkable path traced over a floor plan">
                <defs>
                  <pattern id="calStripe" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                    <rect width="12" height="12" fill="#0d1013" />
                    <line x1="0" y1="0" x2="0" y2="12" stroke="#151a1f" strokeWidth="6" />
                  </pattern>
                </defs>
                <rect width="760" height="500" rx="8" fill="url(#calStripe)" />
                <text x="24" y="36" fontSize="12" letterSpacing="1.4" fill="#4c4f55" style={{ fontFamily: 'var(--font-mono)' }}>
                  FLOOR PLAN · ROYAL-PALACE-GROUND.PNG
                </text>
                <polygon points="80,100 300,100 300,240 80,240" fill="rgba(210,162,76,.08)" stroke="#8f7a4e" strokeWidth="1.5" />
                <text x="98" y="128" fontSize="13" letterSpacing="1.4" fill="#b78f4e" style={{ fontFamily: 'var(--font-mono)' }}>MASKS</text>
                <polygon points="80,280 300,280 300,430 80,430" fill="rgba(210,162,76,.08)" stroke="#8f7a4e" strokeWidth="1.5" />
                <text x="98" y="308" fontSize="13" letterSpacing="1.4" fill="#b78f4e" style={{ fontFamily: 'var(--font-mono)' }}>TEXTILES</text>
                <polygon points="360,90 660,90 660,300 520,300 520,220 360,220" fill="rgba(210,162,76,.15)" stroke="#d2a24c" strokeWidth="2" />
                <text x="378" y="118" fontSize="13" letterSpacing="1.4" fill="#ecc887" style={{ fontFamily: 'var(--font-mono)' }}>ROYAL DRUMS</text>
                {[[354, 84], [654, 84], [654, 294], [514, 294, true], [514, 214], [354, 214]].map(([x, y, active], i) => (
                  <rect key={i} x={x as number} y={y as number} width="12" height="12" fill={active ? '#ecc887' : '#0e1013'} stroke="#ecc887" strokeWidth="1.5" />
                ))}
                <polyline points="190,430 190,360 190,170 460,170 460,340" fill="none" stroke="#8fb562" strokeOpacity="0.85" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                {[[190, 430], [190, 170], [460, 170]].map(([x, y], i) => (
                  <circle key={i} cx={x} cy={y} r="5.5" fill="#0e1013" stroke="#8fb562" strokeWidth="1.5" />
                ))}
                <circle cx="460" cy="340" r="5.5" fill="#8fb562" stroke="#8fb562" strokeWidth="1.5" />
                <line x1="96" y1="462" x2="320" y2="462" stroke="#99917f" strokeWidth="1.5" />
                <line x1="96" y1="454" x2="96" y2="470" stroke="#99917f" strokeWidth="1.5" />
                <line x1="320" y1="454" x2="320" y2="470" stroke="#99917f" strokeWidth="1.5" />
                <text x="168" y="454" fontSize="12" letterSpacing="1" fill="#c9c1b0" style={{ fontFamily: 'var(--font-mono)' }}>12.0 m</text>
              </svg>
            </div>

            <div className="flex min-w-[min(100%,280px)] flex-[1_1_300px] flex-col gap-5 bg-[#0b0d10] p-5 sm:p-6">
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="font-mono text-[10px] font-medium tracking-[0.18em] text-stone">ZONE</span>
                  <span className="rounded-[5px] border border-brass/35 px-1.5 py-[3px] font-mono text-[9px] font-medium tracking-[0.1em] text-brass">SELECTED</span>
                </div>
                <div className="font-display text-2xl font-medium text-parchment">Royal Drums</div>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 font-mono text-[11px] text-[#6b6e74]">
                  <span>6 vertices</span>
                  <span className="text-[#2c3037]">|</span>
                  <span>84 m²</span>
                  <span className="text-[#2c3037]">|</span>
                  <span className="text-moss">inside plan ✓</span>
                </div>
              </div>

              <div className="rounded-xl border border-hairline bg-[#0c0e11] p-4">
                <div className="mb-3 font-mono text-[9px] font-medium tracking-[0.16em] text-stone">ACOUSTIC SNAPSHOT</div>
                <div className="mb-3 flex h-[34px] items-end gap-[3px]" aria-hidden>
                  {[40, 72, 52, 88, 60, 44, 78, 50, 66, 40].map((h, i) => (
                    <span
                      key={i}
                      className="flex-1 origin-bottom animate-gs-bar rounded-sm bg-gradient-to-b from-brass-bright to-brass"
                      style={{ height: `${h}%`, animationDuration: `${0.85 + (i % 5) * 0.12}s`, animationDelay: `${(i % 4) * 0.11}s` }}
                    />
                  ))}
                </div>
                <div className="flex w-full items-center justify-center gap-2 rounded-[9px] border border-ember/35 bg-ember/10 py-2.5 text-[12.5px] font-semibold text-[#e79a8d]">
                  <span className="h-2 w-2 rounded-full bg-ember shadow-[0_0_8px] shadow-ember" />
                  Stand here · tap to record
                </div>
              </div>

              <div className="mt-auto rounded-xl border border-moss/25 bg-moss-deep/25 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="font-mono text-[9px] font-medium tracking-[0.16em] text-stone">VALIDATION</span>
                  <span className="font-mono text-[9px] font-medium tracking-[0.08em] text-moss">READY</span>
                </div>
                <div className="flex flex-col gap-2 text-xs text-stone">
                  <span><span className="text-moss">✓</span> Geometry &amp; scale valid</span>
                  <span><span className="text-moss">✓</span> Acoustic snapshot present</span>
                  <span><span className="text-moss">✓</span> Four languages ready</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
