import { SectionLabel } from './bits';

function AcousticBars() {
  const bars = [
    [40, 1.1, 0],
    [72, 0.9, 0.18],
    [52, 1.3, 0.08],
    [88, 1.0, 0.32],
    [60, 1.2, 0.14],
    [44, 0.85, 0.38],
    [78, 1.15, 0.05],
    [50, 0.95, 0.24],
    [66, 1.25, 0.12],
    [40, 1.05, 0.3],
  ] as const;
  return (
    <div className="flex h-9 items-end gap-[3px]" aria-hidden>
      {bars.map(([h, dur, delay], i) => (
        <span
          key={i}
          className="flex-1 origin-bottom animate-gs-bar rounded-sm bg-gradient-to-b from-brass-bright to-brass"
          style={{ height: `${h}%`, animationDuration: `${dur}s`, animationDelay: `${delay}s` }}
        />
      ))}
    </div>
  );
}

const MECHANISMS = [
  {
    tag: 'STEPS',
    title: 'It counts your steps',
    body: 'The phone’s own motion sensor and compass, fused into a walking track — the same sensing every fitness app uses, pointed indoors.',
    viz: (
      <div className="flex items-center gap-2" aria-hidden>
        {[0.25, 0.4, 0.6, 0.85, 1].map((o, i) => (
          <span key={i} className="h-2 w-2 rounded-full bg-brass" style={{ opacity: o }} />
        ))}
        <span className="ml-1 font-mono text-[10px] tracking-[0.14em] text-[#868b93]">0.7 m / STEP</span>
      </div>
    ),
  },
  {
    tag: 'MAP',
    title: 'The floor plan keeps it honest',
    body: 'Your traced walls and walkways snap the track back when it drifts — a visitor can’t be inside a wall, so the guide never believes they are.',
    viz: (
      <svg viewBox="0 0 160 44" className="w-full" aria-hidden>
        <rect x="2" y="4" width="70" height="36" rx="5" fill="none" stroke="#2c3037" />
        <rect x="88" y="4" width="70" height="36" rx="5" fill="none" stroke="#2c3037" />
        <path d="M10 36 C40 30, 50 16, 79 20 S 120 30, 150 14" fill="none" stroke="#8fb562" strokeOpacity="0.8" strokeWidth="2" strokeLinecap="round" strokeDasharray="2 5" />
        <circle cx="150" cy="14" r="3.5" fill="#8fb562" />
      </svg>
    ),
  },
  {
    tag: 'SOUND',
    title: 'Each room has a voice',
    body: 'Every gallery hums differently. A two-second listen — analysed on the phone, never recorded — confirms the room and quietly corrects the track.',
    viz: <AcousticBars />,
  },
] as const;

const TRUTHS = [
  'It knows the room you’re in, not the centimetre you’re on — zones are room-sized, on purpose.',
  'The screen stays on, held in the hand — like any walking navigation. Not a pocket app.',
  'If a sensor is denied, it says so in plain words — and the exhibit list always works by hand.',
] as const;

/** Honesty as the premium feature: how it works, and exactly what it doesn't do. */
export function Truth() {
  return (
    <section id="truth" className="border-t border-hairline/50 bg-gradient-to-b from-ink via-[#0a0b0d] to-ink">
      <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 lg:py-32">
        <SectionLabel>Under the hood</SectionLabel>
        <h2 data-reveal className="font-display text-[clamp(30px,5vw,56px)] font-medium leading-[1.06] tracking-[-0.02em] text-parchment">
          We&rsquo;d rather tell you <em className="font-medium italic text-brass-bright">the truth.</em>
        </h2>
        <p className="mt-5 max-w-[58ch] text-[clamp(16px,1.5vw,18.5px)] leading-[1.65] text-stone">
          Indoor positioning on a plain web page is an engineering problem with honest limits. Here
          is how geosteps actually finds you — and exactly where the limits are.
        </p>

        <div className="mt-12 grid gap-5 md:grid-cols-3 lg:mt-16">
          {MECHANISMS.map((m) => (
            <div key={m.tag} data-reveal className="flex flex-col rounded-[18px] border border-hairline bg-gradient-to-br from-[#101317] to-[#0b0d10] p-6">
              <span className="mb-4 font-mono text-[10px] font-medium tracking-[0.22em] text-brass">{m.tag}</span>
              <h3 className="font-display text-xl font-medium text-parchment">{m.title}</h3>
              <p className="mb-6 mt-3 text-[14px] leading-[1.65] text-stone">{m.body}</p>
              <div className="mt-auto border-t border-[#1c1f24] pt-4">{m.viz}</div>
            </div>
          ))}
        </div>

        <div data-reveal data-reveal-delay="0.1" className="mt-8 rounded-[18px] border border-hairline bg-[#0b0d10] p-6 sm:p-8">
          <div className="mb-5 font-mono text-[10px] font-medium tracking-[0.22em] text-stone">
            WHAT IT DOESN&rsquo;T DO — SAID PLAINLY
          </div>
          <ul className="grid gap-4 md:grid-cols-3">
            {TRUTHS.map((t, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="mt-1.5 h-[7px] w-[7px] shrink-0 rounded-full border border-ember bg-ember/20" />
                <span className="text-[14px] leading-[1.6] text-[#c9c1b0]">{t}</span>
              </li>
            ))}
          </ul>
          {/* quoted verbatim from src/engine/platform/sensors.ts (MSG.motionDenied) —
              the string the product actually shows, not marketing copy about it */}
          <div className="mt-6 border-t border-[#1c1f24] pt-5">
            <div className="mb-2 font-mono text-[9px] font-medium tracking-[0.2em] text-stone">
              VERBATIM — WHAT A VISITOR SEES IF THEY DECLINE MOTION ACCESS
            </div>
            <blockquote className="max-w-[74ch] text-[13.5px] italic leading-[1.65] text-[#c9c1b0]">
              &ldquo;Motion access was declined, so the guide cannot follow your steps. Reload the
              page and allow motion access to enable automatic guiding, or continue in manual
              mode.&rdquo;
            </blockquote>
          </div>
        </div>
      </div>
    </section>
  );
}
