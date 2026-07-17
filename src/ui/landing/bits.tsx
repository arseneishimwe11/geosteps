/** Tiny shared pieces of the landing page's visual language. */

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-6 font-mono text-[11px] font-medium uppercase tracking-[0.26em] text-brass">
      {children}
    </div>
  );
}

export const LANGUAGES = ['English', 'Français', 'Ikinyarwanda', 'Kiswahili', 'Deutsch'] as const;

export function LanguageChips({ activeFirst = false }: { activeFirst?: boolean }) {
  return (
    <div className="flex flex-wrap gap-2">
      {LANGUAGES.map((lang, i) => (
        <span
          key={lang}
          className={
            'rounded-full border px-3 py-1.5 font-mono text-[11px] font-medium tracking-[0.08em] ' +
            (activeFirst && i === 0
              ? 'border-hairline bg-slate-deep text-parchment'
              : 'border-hairline text-stone')
          }
        >
          {lang}
        </span>
      ))}
    </div>
  );
}

export function ProofRow({ className = '' }: { className?: string }) {
  return (
    <div
      className={
        'flex flex-wrap items-center gap-x-4 gap-y-3 font-mono text-[11px] font-medium tracking-[0.12em] text-stone ' +
        className
      }
    >
      <span>NO APP</span>
      <span className="h-1 w-1 rounded-full bg-hairline" />
      <span>NO BEACONS</span>
      <span className="h-1 w-1 rounded-full bg-hairline" />
      <span>NO HARDWARE IN THE BUILDING</span>
    </div>
  );
}
