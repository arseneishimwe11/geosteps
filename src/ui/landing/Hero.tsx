import { LanguageChips, ProofRow } from './bits';
import { HeroDevice } from './hero3d/HeroDevice';

/**
 * The lantern moment (direction 1c from the design exploration): a dark
 * gallery, one lit device, the story warming up. The headline is plain HTML
 * and paints immediately — it is the LCP; nothing here blocks first paint.
 */
export function Hero() {
  return (
    <header id="top" className="relative overflow-x-clip">
      {/* faint gallery-wall grid, receding into the dark */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg,transparent 0 47px, rgba(38,41,46,.5) 47px 48px),repeating-linear-gradient(90deg,transparent 0 47px, rgba(38,41,46,.5) 47px 48px)',
          maskImage: 'radial-gradient(120% 90% at 60% 40%, black 30%, transparent 75%)',
        }}
      />
      {/* the single light source, behind the device */}
      <div data-hero-glow className="pointer-events-none absolute right-[-8%] top-[6%] h-[720px] w-[min(740px,85vw)] max-h-[92%] animate-gs-glow bg-[radial-gradient(circle_at_62%_42%,rgba(210,162,76,.17)_0%,rgba(210,162,76,.05)_34%,rgba(210,162,76,0)_62%)]" />

      <div className="relative z-[2] mx-auto flex max-w-6xl flex-wrap items-center gap-x-16 gap-y-14 px-5 pb-16 pt-14 sm:px-8 lg:pb-24 lg:pt-24">
        {/* wall text */}
        <div className="min-w-[min(100%,320px)] flex-[1_1_460px]">
          <div className="mb-7 flex items-center gap-2.5 font-mono text-[11px] font-medium tracking-[0.26em] text-brass">
            <span className="h-1.5 w-1.5 rounded-full bg-moss shadow-[0_0_10px] shadow-moss" />
            SELF-GUIDED AUDIO · FOR MUSEUMS &amp; CULTURAL SITES
          </div>
          <h1 className="animate-gs-warm font-display text-[clamp(42px,7vw,76px)] font-medium leading-[1.02] tracking-[-0.022em] text-parchment">
            Scan. Walk. Listen&nbsp;—<br />
            the story <em className="font-medium italic text-brass-bright">finds you.</em>
          </h1>
          <p className="mt-6 max-w-[38ch] text-[clamp(16px,1.5vw,18.5px)] leading-[1.62] text-stone">
            A web audio guide for museums. Every visitor hears each exhibit in their own language —
            no app to install, no beacons, nothing added to the building.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-4">
            <a
              href="#pilot"
              className="rounded-xl bg-brass px-6 py-4 text-[15px] font-semibold text-ink shadow-[0_12px_40px_-14px_rgba(210,162,76,.7)] transition-colors hover:bg-brass-bright"
            >
              Bring it to your museum
            </a>
            <a href="#walk" className="group flex items-center gap-2 text-[15px] text-parchment transition-colors hover:text-brass-bright">
              See how it works
              <span className="font-mono transition-transform group-hover:translate-x-0.5">→</span>
            </a>
          </div>
          <ProofRow className="mt-10" />
          <div className="mt-7">
            <LanguageChips activeFirst />
          </div>
        </div>

        {/* the lantern */}
        <div className="flex min-w-[min(100%,300px)] flex-[1_1_320px] justify-center">
          <div className="relative" data-hero-phone>
            {/* waypoints trailing into the dark, toward the device */}
            <span className="absolute -left-24 top-6 h-[7px] w-[7px] rounded-full bg-brass/25 max-lg:hidden" />
            <span className="absolute -left-16 top-16 h-[7px] w-[7px] rounded-full bg-brass/40 max-lg:hidden" />
            <span className="absolute -left-9 top-28 h-2 w-2 rounded-full bg-brass/60 max-lg:hidden" />
            <span className="absolute -left-6 top-40 h-[9px] w-[9px] rounded-full bg-brass-bright/85 shadow-[0_0_12px_rgba(236,200,135,.7)] max-lg:hidden" />
            <HeroDevice />
          </div>
        </div>
      </div>
    </header>
  );
}
