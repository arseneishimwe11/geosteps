import { SectionLabel } from './bits';

const COVERAGE: { lang: string; pct: number; bright: boolean }[] = [
  { lang: 'English', pct: 22, bright: true },
  { lang: 'Français', pct: 12, bright: false },
  { lang: 'Ikinyarwanda', pct: 38, bright: false },
  { lang: 'Kiswahili', pct: 4, bright: false },
  { lang: 'Deutsch', pct: 1, bright: false },
];

/** The editorial breath: why this exists. Near-static by design. */
export function Stakes() {
  return (
    <section className="border-t border-hairline/50">
      <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 lg:py-32">
        <SectionLabel>The human stakes</SectionLabel>
        <h2 className="max-w-[19ch] font-display text-[clamp(30px,5vw,58px)] font-medium leading-[1.08] tracking-[-0.02em] text-parchment">
          Two guides. Four hundred visitors a day. Five languages between them.
        </h2>

        <div className="mt-12 flex flex-wrap items-start gap-x-20 gap-y-10 lg:mt-16">
          <div className="min-w-[min(100%,300px)] flex-[1_1_380px]">
            <p className="mb-6 max-w-[44ch] text-[clamp(16px,1.5vw,19px)] leading-[1.7] text-[#c9c1b0]">
              On a busy morning, two or three guides move through the galleries. They are wonderful —
              and there are hundreds of visitors, speaking languages no small team can cover at once.
            </p>
            <p className="mb-8 max-w-[44ch] text-[clamp(15px,1.4vw,17px)] leading-[1.7] text-stone">
              So most people walk past the drums, the thrones, the masks — reading a short label, if
              there is one at all. The story is there. It just doesn&rsquo;t reach them.
            </p>
            <p className="max-w-[28ch] border-l-2 border-brass/50 pl-5 font-display text-[clamp(19px,2.2vw,25px)] italic leading-[1.45] text-brass-bright">
              geosteps doesn&rsquo;t replace a guide. It reaches the visitors a guide can&rsquo;t.
            </p>
          </div>

          <div className="min-w-[min(100%,300px)] flex-[1_1_340px] rounded-[18px] border border-hairline bg-gradient-to-br from-[#101317] to-[#0b0d10] p-6 sm:p-8">
            <div className="mb-7 flex items-baseline justify-between">
              <span className="font-mono text-[10px] font-medium tracking-[0.2em] text-stone">
                WHO HEARS THE FULL STORY
              </span>
              <span className="font-mono text-[9px] font-medium tracking-[0.14em] text-[#4c4f55]">TODAY</span>
            </div>
            <div className="flex flex-col gap-4">
              {COVERAGE.map(({ lang, pct, bright }) => (
                <div key={lang} className="grid grid-cols-[118px_1fr] items-center gap-3.5">
                  <span className={`text-sm ${bright ? 'text-parchment' : 'text-stone'}`}>{lang}</span>
                  <span className="relative h-1.5 overflow-hidden rounded-[3px] bg-[#1c1f24]">
                    <span
                      className={`absolute inset-y-0 left-0 rounded-[3px] ${
                        bright ? 'bg-gradient-to-r from-brass to-brass-bright' : 'bg-[#8f7a4e]'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-7 flex items-start gap-2.5 border-t border-[#1c1f24] pt-5">
              <span className="mt-[5px] h-[7px] w-[7px] shrink-0 rounded-full bg-moss shadow-[0_0_10px] shadow-moss" />
              <span className="text-[13px] leading-[1.55] text-stone">
                With geosteps, every bar fills — each language, all day, in whatever order visitors
                wander.
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
