'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { SectionLabel } from './bits';

/**
 * The product-in-action centerpiece, kept from the design export and made
 * real: a floor plan, a walked path, a fuzzy visitor halo, and a narration
 * card that follows the room you're in. Phase 1 drives it with the drag
 * scrubber; Phase 2 additionally scrubs it with scroll (pinned).
 *
 * This is a marketing illustration of the concept — the real positioning
 * happens only in the engine, in the product.
 */

const ROUTE: [number, number][] = [
  [170, 472],
  [170, 300],
  [175, 131],
  [435, 131],
  [675, 206],
  [435, 325],
];

interface ZoneDef {
  id: string;
  label: string;
  rect: [number, number, number, number]; // x y w h
  labelPos: [number, number];
  name: string;
  blurb: string;
  track: string | null;
  duration: string;
}

const ZONES: ZoneDef[] = [
  {
    id: 'masks',
    label: 'MASKS',
    rect: [70, 56, 210, 150],
    labelPos: [86, 82],
    name: 'Hall of Masks',
    blurb: 'Carved for ceremony — each face a lineage, each line a name.',
    track: 'The masks and their makers',
    duration: '2:58',
  },
  {
    id: 'drums',
    label: 'ROYAL DRUMS',
    rect: [320, 56, 230, 150],
    labelPos: [336, 82],
    name: 'Royal Drum Gallery',
    blurb: 'The great drums of the kingdom, sounded only for the king and heard for miles.',
    track: 'The royal drums of the kingdom',
    duration: '3:40',
  },
  {
    id: 'kingdom',
    label: 'THE KINGDOM',
    rect: [590, 56, 170, 300],
    labelPos: [606, 82],
    name: 'The Kingdom',
    blurb: 'A dynasty told through its regalia, from first fire to last king.',
    track: 'Regalia of the kingdom',
    duration: '4:12',
  },
  {
    id: 'textiles',
    label: 'TEXTILES',
    rect: [320, 250, 230, 150],
    labelPos: [336, 276],
    name: 'Imigongo & Textiles',
    blurb: 'Geometry in earth and ash — the patterns that name a home.',
    track: 'Imigongo: earth into pattern',
    duration: '3:05',
  },
];

const BETWEEN = {
  name: 'Between exhibits',
  blurb: 'The guide waits quietly until the next room begins — never twitchy, never guessing.',
  track: null as string | null,
  duration: '',
};

function routeGeometry() {
  const seg: number[] = [];
  let total = 0;
  for (let i = 1; i < ROUTE.length; i++) {
    const [ax, ay] = ROUTE[i - 1]!;
    const [bx, by] = ROUTE[i]!;
    const d = Math.hypot(bx - ax, by - ay);
    seg.push(d);
    total += d;
  }
  return { seg, total };
}

function pointAt(dist: number, seg: number[]): [number, number] {
  let remaining = dist;
  for (let i = 0; i < seg.length; i++) {
    const d = seg[i]!;
    if (remaining <= d) {
      const [ax, ay] = ROUTE[i]!;
      const [bx, by] = ROUTE[i + 1]!;
      const t = d === 0 ? 0 : remaining / d;
      return [ax + (bx - ax) * t, ay + (by - ay) * t];
    }
    remaining -= d;
  }
  return ROUTE[ROUTE.length - 1]!;
}

function zoneAt(x: number, y: number): ZoneDef | null {
  for (const z of ZONES) {
    const [zx, zy, zw, zh] = z.rect;
    if (x >= zx && x <= zx + zw && y >= zy && y <= zy + zh) return z;
  }
  return null;
}

export function ScrollWalk() {
  const { seg, total } = useMemo(routeGeometry, []);
  const [t, setT] = useState(0.52); // static/mobile default: mid-walk, inside the Royal Drum Gallery
  const sectionRef = useRef<HTMLElement | null>(null);
  const planRef = useRef<HTMLDivElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const walked = t * total;
  const [px, py] = pointAt(walked, seg);
  const zone = zoneAt(px, py);
  const card = zone ?? BETWEEN;

  // Desktop: pin the section and let SCROLL walk the gallery — the page's
  // signature interaction. The drag scrubber keeps working inside the pin.
  // Touch/small screens keep direct drag; reduced motion gets the static page.
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let cleanup: (() => void) | undefined;
    let cancelled = false;
    void (async () => {
      const [{ default: gsap }, { ScrollTrigger }] = await Promise.all([
        import('gsap'),
        import('gsap/ScrollTrigger'),
      ]);
      if (cancelled) return;
      gsap.registerPlugin(ScrollTrigger);
      const mm = gsap.matchMedia();
      mm.add('(min-width: 1024px)', () => {
        const proxy = { t: 0 };
        setT(0);
        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: sectionRef.current,
            start: 'top top',
            end: '+=260%',
            pin: true,
            scrub: 0.6,
            anticipatePin: 1,
          },
        });
        // entry: the map grows out of the lantern's minimap, the card follows
        tl.fromTo(
          planRef.current,
          { scale: 0.62, y: 44, transformOrigin: 'center 18%', autoAlpha: 0.35 },
          { scale: 1, y: 0, autoAlpha: 1, duration: 0.16, ease: 'power2.out' },
          0,
        );
        tl.fromTo(
          cardRef.current,
          { x: 48, autoAlpha: 0 },
          { x: 0, autoAlpha: 1, duration: 0.14, ease: 'power2.out' },
          0.04,
        );
        // the walk itself
        tl.to(proxy, {
          t: 1,
          duration: 0.84,
          ease: 'none',
          onUpdate: () => setT(proxy.t),
        });
        return () => {
          setT(0.52);
        };
      });
      cleanup = () => mm.revert();
    })();
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

  return (
    <section
      id="walk"
      ref={sectionRef}
      className="relative border-t border-hairline/50 bg-gradient-to-b from-ink via-[#0a0b0d] to-ink"
    >
      <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 lg:py-32">
        <div className="mb-12 max-w-2xl lg:mb-16">
          <SectionLabel>The product in action</SectionLabel>
          <h2 className="font-display text-[clamp(30px,5vw,56px)] font-medium leading-[1.06] tracking-[-0.02em] text-parchment">
            Walk the gallery. The guide keeps up.
          </h2>
          <p className="mt-5 text-[clamp(16px,1.5vw,18.5px)] leading-[1.65] text-stone">
            No searching, no tapping. As a visitor moves through the rooms, geosteps follows their
            steps and brings up the right story — in whatever order they choose to wander.
          </p>
        </div>

        <div className="flex flex-wrap items-stretch gap-6 lg:gap-10">
          {/* floor plan */}
          <div
            ref={planRef}
            className="min-w-[min(100%,320px)] flex-[1.5_1_480px] rounded-[20px] border border-hairline bg-gradient-to-br from-[#0d0f12] to-[#08090b] p-4 shadow-[0_40px_100px_-50px_rgba(0,0,0,.9)] sm:p-5"
          >
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <span className="font-mono text-[10px] font-medium tracking-[0.2em] text-stone">
                ROYAL PALACE · GROUND FLOOR
              </span>
              <div className="flex items-center gap-4 font-mono text-[9.5px] font-medium tracking-[0.08em] text-[#6b6e74]">
                <span className="flex items-center gap-1.5">
                  <span className="h-[11px] w-[11px] rounded-[3px] border border-brass bg-brass/15" />
                  EXHIBIT ZONE
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-0.5 w-3.5 rounded-sm bg-moss" />
                  WALKED PATH
                </span>
              </div>
            </div>

            <svg viewBox="0 0 820 540" className="block w-full rounded-xl" role="img" aria-label="Floor plan showing a visitor walking between exhibit zones">
              <defs>
                <pattern id="wkGrid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M40 0H0V40" fill="none" stroke="#161a1f" strokeWidth="1" />
                </pattern>
                <radialGradient id="wkHalo" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#ecc887" stopOpacity="0.5" />
                  <stop offset="55%" stopColor="#d2a24c" stopOpacity="0.14" />
                  <stop offset="100%" stopColor="#d2a24c" stopOpacity="0" />
                </radialGradient>
                <filter id="wkBlur" x="-70%" y="-70%" width="240%" height="240%">
                  <feGaussianBlur stdDeviation="7" />
                </filter>
              </defs>
              <rect width="820" height="540" fill="#0a0c0e" />
              <rect width="820" height="540" fill="url(#wkGrid)" opacity="0.6" />

              {ZONES.map((z) => {
                const active = zone?.id === z.id;
                const [x, y, w, h] = z.rect;
                return (
                  <g key={z.id}>
                    <rect
                      x={x}
                      y={y}
                      width={w}
                      height={h}
                      rx="10"
                      fill={active ? 'rgba(210,162,76,.14)' : 'rgba(210,162,76,.05)'}
                      stroke={active ? '#d2a24c' : '#2c3037'}
                      strokeWidth={active ? 1.4 : 1}
                      style={{ transition: 'fill .5s ease, stroke .5s ease' }}
                    />
                    <text
                      x={z.labelPos[0]}
                      y={z.labelPos[1]}
                      fontSize="13"
                      letterSpacing="1.6"
                      fill={active ? '#ecc887' : '#5b5e64'}
                      style={{ fontFamily: 'var(--font-mono)', transition: 'fill .5s ease' }}
                    >
                      {z.label}
                    </text>
                  </g>
                );
              })}

              {/* full route, faint */}
              <polyline
                points={ROUTE.map((p) => p.join(',')).join(' ')}
                fill="none"
                stroke="#8fb562"
                strokeOpacity="0.2"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* walked portion */}
              <polyline
                points={ROUTE.map((p) => p.join(',')).join(' ')}
                fill="none"
                stroke="#8fb562"
                strokeOpacity="0.9"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={total}
                strokeDashoffset={total - walked}
                style={{ filter: 'drop-shadow(0 0 4px rgba(143,181,98,.55))' }}
              />

              <circle cx={ROUTE[0]![0]} cy={ROUTE[0]![1]} r="6" fill="#0e1013" stroke="#8fb562" strokeWidth="1.5" />
              <text x={ROUTE[0]![0] + 18} y={ROUTE[0]![1] + 5} fontSize="11" letterSpacing="1" fill="#99917f" style={{ fontFamily: 'var(--font-mono)' }}>
                ENTRANCE · SCAN QR
              </text>

              {/* the visitor: honest halo first, dot second */}
              <g transform={`translate(${px} ${py})`}>
                <circle r="46" fill="url(#wkHalo)" filter="url(#wkBlur)" />
                <circle r="15" fill="rgba(236,200,135,.10)" />
                <circle r="6.5" fill="#f2d79a" />
              </g>
            </svg>

            <div className="mt-3.5 flex items-center gap-2 px-1">
              <span className="h-2 w-2 shrink-0 rounded-full bg-[radial-gradient(circle,#f2d79a,rgba(242,215,154,0))]" />
              <span className="font-mono text-[11px] tracking-[0.04em] text-[#6b6e74]">
                The soft halo is the visitor&rsquo;s approximate position — room-level, honestly fuzzy,
                never a fake-precise dot.
              </span>
            </div>
          </div>

          {/* narration card */}
          <div
            ref={cardRef}
            className="flex min-w-[min(100%,300px)] flex-[1_1_320px] flex-col rounded-[20px] border border-hairline bg-gradient-to-br from-[#101317] to-[#0b0d10] p-6 sm:p-8"
          >
            <div className="mb-5 flex items-center gap-2 font-mono text-[10px] font-medium tracking-[0.2em] text-moss">
              <span className="h-1.5 w-1.5 animate-guide-pulse rounded-full bg-moss shadow-[0_0_8px] shadow-moss" />
              NOW GUIDING
            </div>
            <div
              key={card.name}
              className="animate-gs-warm font-display text-[clamp(28px,3.6vw,40px)] font-medium leading-[1.04] tracking-[-0.01em] text-brass-bright [animation-duration:.6s] [text-shadow:0_0_30px_rgba(236,200,135,.3)]"
              data-testid="walk-zone-name"
            >
              {card.name}
            </div>
            <p className="mb-auto mt-4 max-w-[38ch] text-[15.5px] leading-[1.65] text-[#c9c1b0]">{card.blurb}</p>

            {card.track && (
              <div className="mt-8 flex items-center gap-3 rounded-2xl border border-hairline bg-[#0c0e11] px-3.5 py-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[radial-gradient(circle_at_38%_32%,#ecc887,#d2a24c_78%)] shadow-[0_0_20px_rgba(210,162,76,.5)]">
                  <span className="flex gap-[3.5px]">
                    <span className="h-[15px] w-[3.5px] rounded-[1px] bg-ink" />
                    <span className="h-[15px] w-[3.5px] rounded-[1px] bg-ink" />
                  </span>
                </span>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 font-mono text-[8px] font-medium tracking-[0.18em] text-stone">NOW PLAYING · EN</div>
                  <div className="truncate text-[13px] text-parchment">{card.track}</div>
                </div>
                <span className="shrink-0 font-mono text-[10px] font-medium text-[#6b6e74]">{card.duration}</span>
              </div>
            )}

            <div className="mt-6">
              <div className="mb-2.5 flex items-center justify-between">
                <span className="font-mono text-[9.5px] font-medium tracking-[0.16em] text-[#6b6e74]">
                  <span className="max-lg:hidden">SCROLL — OR DRAG — TO WALK</span>
                  <span className="lg:hidden">DRAG TO WALK THE GALLERY</span>
                </span>
                <span className="font-mono text-[9.5px] font-medium tracking-[0.1em] text-[#4c4f55]">
                  ENTRANCE → TEXTILES
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={1000}
                value={Math.round(t * 1000)}
                onChange={(e) => setT(Number(e.target.value) / 1000)}
                aria-label="Scrub the visitor's walk through the gallery"
                className="h-1 w-full cursor-pointer accent-[var(--color-brass)]"
                data-testid="walk-scrubber"
              />
            </div>

            <div className="mt-6 flex items-start gap-2.5 border-t border-[#1c1f24] pt-5">
              <span className="mt-1.5 h-[7px] w-[7px] shrink-0 rounded-full bg-brass shadow-[0_0_8px_rgba(210,162,76,.6)]" />
              <span className="text-[12.5px] leading-[1.55] text-stone">
                The story only changes once you&rsquo;ve clearly entered a new room — steady, never
                twitchy, so the narration never fights the visitor.
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
