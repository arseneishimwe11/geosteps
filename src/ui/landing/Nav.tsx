/** Minimal sticky nav: brass dot, wordmark, four anchors, one CTA. */
export function Nav() {
  const links = [
    ['#walk', 'How it works'],
    ['#truth', 'The truth'],
    ['#calibrate', 'Setup'],
    ['#languages', 'Languages'],
  ] as const;
  return (
    <nav className="sticky top-0 z-50 border-b border-hairline/50 bg-ink/75 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-5 py-3.5 sm:px-8">
        <a href="#top" className="flex items-center gap-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-brass shadow-[0_0_14px_2px] shadow-brass/70" />
          <span className="font-display text-lg text-parchment">geosteps</span>
        </a>
        <div className="hidden items-center gap-7 md:flex">
          {links.map(([href, label]) => (
            <a key={href} href={href} className="text-sm text-stone transition-colors hover:text-parchment">
              {label}
            </a>
          ))}
        </div>
        <a
          href="#pilot"
          className="rounded-lg bg-brass px-4 py-2 text-sm font-semibold text-ink transition-colors hover:bg-brass-bright"
        >
          Start a pilot
        </a>
      </div>
    </nav>
  );
}
