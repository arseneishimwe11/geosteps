import { SectionLabel } from './bits';

const STEPS = [
  ['UPLOAD', 'Photograph or scan the floor plan and drop it on the canvas.'],
  ['TRACE', 'Draw each exhibit zone and the walkable paths — click by click, snap-assisted.'],
  ['LISTEN', 'Stand in each room and record eight seconds of its ordinary quiet.'],
] as const;

/**
 * The staff story. The window below is a real capture of the actual admin
 * calibration surface at /admin/demo — staged with the tool itself (floor
 * plan uploaded as the tracing backdrop, scale calibrated, the Royal Drum
 * Gallery selected), then screenshotted at 2x. Not a mockup.
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
        <div data-reveal className="overflow-hidden rounded-2xl border border-[#2c3037] bg-[#0c0e11] shadow-[0_60px_150px_-60px_rgba(0,0,0,.95)]">
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

          <img
            src="/landing/admin-canvas.webp"
            width={2752}
            height={1560}
            loading="lazy"
            decoding="async"
            className="block w-full"
            alt="The real geosteps calibration canvas: a scanned floor plan of the Royal Palace Museum with four exhibit zones traced over its galleries, the Royal Drum Gallery selected with its corner handles visible, and a dashed walkable path connecting the rooms. The side panel shows a zone's recorded acoustic snapshot as amber frequency bars and narration upload slots for English, French, Kinyarwanda and Swahili."
          />
        </div>
      </div>
    </section>
  );
}
