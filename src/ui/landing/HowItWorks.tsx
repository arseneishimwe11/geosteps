import { SectionLabel } from './bits';

const STEPS = [
  {
    n: '01',
    title: 'Scan the QR at the door',
    body: 'A plain web page opens. Nothing to install, nothing to sign up for.',
  },
  {
    n: '02',
    title: 'Choose your language',
    body: 'English, Français, Ikinyarwanda, Kiswahili, Deutsch — one tap, and the screen stays on like any walking map.',
  },
  {
    n: '03',
    title: 'Walk',
    body: 'The narration comes up on its own as you reach each exhibit — in any order, backtracking welcome.',
  },
] as const;

/** Three wide rows, mono-numbered. Deliberately the calmest section on the page. */
export function HowItWorks() {
  return (
    <section className="border-t border-hairline/50">
      <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 lg:py-28">
        <SectionLabel>How it works</SectionLabel>
        <h2 data-reveal className="font-display text-[clamp(30px,5vw,52px)] font-medium leading-[1.06] tracking-[-0.02em] text-parchment">
          Three things a visitor does. That&rsquo;s all.
        </h2>
        <div className="mt-12 divide-y divide-hairline/60 border-y border-hairline/60">
          {STEPS.map((s) => (
            <div key={s.n} data-reveal className="grid items-baseline gap-x-10 gap-y-2 py-7 sm:grid-cols-[80px_280px_1fr] lg:py-9">
              <span className="font-mono text-sm font-medium tracking-[0.2em] text-brass">{s.n}</span>
              <h3 className="font-display text-xl font-medium text-parchment lg:text-2xl">{s.title}</h3>
              <p className="max-w-[52ch] text-[15px] leading-[1.65] text-stone">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
