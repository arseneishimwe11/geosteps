import { PilotForm } from './PilotForm';

export function FinalCta() {
  return (
    <section id="pilot" className="relative overflow-hidden border-t border-hairline/50">
      <div className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[min(860px,95vw)] -translate-x-1/2 bg-[radial-gradient(ellipse_at_50%_0%,rgba(210,162,76,.12),rgba(210,162,76,0)_65%)]" />
      <div className="relative mx-auto max-w-2xl px-5 py-24 text-center sm:px-8 lg:py-32">
        <h2 data-reveal className="font-display text-[clamp(36px,6.5vw,72px)] font-medium leading-[1.02] tracking-[-0.025em] text-parchment">
          Bring it to your museum.
        </h2>
        <p className="mx-auto mt-5 max-w-[42ch] text-[clamp(16px,1.5vw,18.5px)] leading-[1.65] text-stone">
          A pilot needs a phone, a QR code, and an afternoon. Tell us about your space — we&rsquo;ll
          walk you through a calibration together.
        </p>
        <div data-reveal data-reveal-delay="0.12" className="mt-10">
          <PilotForm />
        </div>
      </div>
    </section>
  );
}
