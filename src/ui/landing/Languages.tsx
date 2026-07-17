'use client';

import { useEffect, useState } from 'react';

const GREETINGS = [
  ['Welcome', 'English'],
  ['Bienvenue', 'Français'],
  ['Murakaza neza', 'Ikinyarwanda'],
  ['Karibu', 'Kiswahili'],
  ['Willkommen', 'Deutsch'],
] as const;

/**
 * The emotional payoff: the same welcome, in every visitor's own words.
 * Crossfades slowly; renders as a static list under prefers-reduced-motion.
 */
export function Languages() {
  const [i, setI] = useState(0);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    if (reduced) return;
    const t = setInterval(() => setI((v) => (v + 1) % GREETINGS.length), 2800);
    return () => clearInterval(t);
  }, [reduced]);

  return (
    <section id="languages" className="relative overflow-hidden border-t border-hairline/50">
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[560px] w-[min(720px,90vw)] -translate-x-1/2 -translate-y-1/2 animate-gs-glow bg-[radial-gradient(circle,rgba(210,162,76,.14)_0%,rgba(210,162,76,0)_62%)]" />
      <div className="relative mx-auto max-w-4xl px-5 py-24 text-center sm:px-8 lg:py-36">
        <div className="mb-6 font-mono text-[11px] font-medium uppercase tracking-[0.26em] text-brass">
          Every visitor · their own language
        </div>

        {reduced ? (
          <div className="flex flex-col gap-3">
            {GREETINGS.map(([word, lang]) => (
              <div key={lang} className="font-display text-[clamp(30px,5vw,54px)] font-medium leading-tight text-brass-bright">
                {word}
                <span className="ml-4 align-middle font-mono text-xs tracking-[0.2em] text-stone">{lang.toUpperCase()}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="relative h-[1.25em] font-display text-[clamp(44px,8vw,92px)] font-medium leading-none tracking-[-0.02em]">
            {GREETINGS.map(([word], idx) => (
              <span
                key={word}
                aria-hidden={idx !== i}
                className="absolute inset-x-0 top-0 text-brass-bright transition-all duration-700 [text-shadow:0_0_40px_rgba(236,200,135,.35)]"
                style={{ opacity: idx === i ? 1 : 0, transform: idx === i ? 'translateY(0)' : 'translateY(10px)', filter: idx === i ? 'blur(0)' : 'blur(6px)' }}
              >
                {word}
              </span>
            ))}
          </div>
        )}

        {!reduced && (
          <div className="mt-4 h-4 font-mono text-xs font-medium tracking-[0.24em] text-stone">
            {GREETINGS[i]?.[1].toUpperCase()}
          </div>
        )}

        <p className="mx-auto mt-10 max-w-[46ch] text-[clamp(16px,1.5vw,19px)] leading-[1.7] text-stone">
          The difference between reading a short label and hearing your own history, told properly,
          in your own words.
        </p>
      </div>
    </section>
  );
}
