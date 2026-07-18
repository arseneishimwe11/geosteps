'use client';

/**
 * The hero device's screen and its CSS-frame fallback.
 *
 * The screen is NOT a mockup: `useAttractGuide` runs the real frozen
 * PositionEngine over the real demo-venue blueprint on a scripted loop, and
 * everything below — zone name, confidence radius, step count, the minimap
 * dot and disc — renders the engine's own output. The minimap is the actual
 * tourist-runtime `Minimap` component. Under reduced motion (and during
 * SSR) the screen shows one frozen mid-visit frame of the same data.
 */

import { Minimap } from '../tour/Minimap';
import { demoBlueprint, useAttractGuide } from './attract/useAttractGuide';

/** Illustrative narration titles for the demo venue's zones (the seeded
 * blueprint ships placeholder tones; real titles read better than
 * "Placeholder tone — not narration" on a wall). */
const NARRATION_TITLES: Record<string, string> = {
  'entrance-hall': 'Welcome to the royal court',
  'royal-drums': 'The royal drums of the kingdom',
  'kingdom-history': 'Four centuries, one thread',
  'contemporary-wing': 'New voices, old threads',
};

function StatusBar() {
  return (
    <div className="relative z-[5] flex items-center justify-between px-6 pt-3">
      <span className="text-[13px] font-semibold tracking-[0.01em] text-parchment">9:41</span>
      <div className="flex items-center gap-1.5">
        <span className="flex h-[11px] items-end gap-[1.5px]">
          {[4, 6, 8, 11].map((h) => (
            <span key={h} className="w-[2.5px] rounded-[1px] bg-parchment" style={{ height: h }} />
          ))}
        </span>
        <span className="relative flex h-[11px] w-[22px] items-center rounded-[3px] border border-parchment/60 p-[1.5px]">
          <span className="h-full w-[70%] rounded-[1px] bg-parchment" />
          <span className="absolute -right-[3px] top-1/2 h-1 w-[1.5px] -translate-y-1/2 rounded-r-[1px] bg-parchment/60" />
        </span>
      </div>
    </div>
  );
}

/**
 * The lit screen surface, shared verbatim between the CSS device frame
 * below and the 3D device's DOM overlay — one source of truth for what the
 * guide looks like mid-visit.
 */
export function GuideScreen({ className = '' }: { className?: string }) {
  const { position, lastZoneId } = useAttractGuide();
  const zone = position.currentZoneId
    ? demoBlueprint.zones.find((z) => z.id === position.currentZoneId)
    : null;
  const playingZone = lastZoneId ? demoBlueprint.zones.find((z) => z.id === lastZoneId) : null;

  return (
    <div className={`relative flex h-full w-full flex-col overflow-hidden bg-ink ${className}`}>
      {/* top screen glow — the lantern */}
      <div className="pointer-events-none absolute left-1/2 top-[-6%] h-[44%] w-[150%] -translate-x-1/2 bg-[radial-gradient(ellipse_at_50%_0%,rgba(210,162,76,.14),rgba(210,162,76,0)_70%)]" />
      {/* dynamic island */}
      <div className="absolute left-1/2 top-[11px] z-[8] h-[27px] w-[92px] -translate-x-1/2 rounded-2xl bg-ink shadow-[inset_0_0_0_1px_#16181c]" />
      <StatusBar />

      <div className="relative z-[3] flex min-h-0 flex-1 flex-col px-5 pt-5">
        <div className="mb-5 flex items-center justify-between">
          <span className="font-mono text-[10px] font-medium tracking-[0.18em] text-stone">ROYAL PALACE</span>
          <span className="flex items-center gap-1.5 whitespace-nowrap rounded-full border border-moss/30 bg-moss/5 px-2 py-1 font-mono text-[9.5px] font-medium tracking-[0.06em] text-moss">
            <span className="h-[5px] w-[5px] rounded-full bg-moss shadow-[0_0_8px] shadow-moss" />
            WAKE LOCK
          </span>
        </div>

        <div className="mb-3 font-mono text-[9px] font-medium tracking-[0.26em] text-stone">
          {zone ? 'YOU ARE IN' : 'BETWEEN EXHIBITS'}
        </div>
        <div
          key={zone?.id ?? 'between'}
          className="animate-gs-warm font-display text-[clamp(26px,3.1vw,31px)] font-medium leading-[1.04] tracking-[-0.01em] text-brass-bright [animation-delay:.15s] [text-shadow:0_0_30px_rgba(236,200,135,.4)]"
        >
          {zone ? zone.name : '· · ·'}
        </div>

        <div className="mb-4 mt-3.5 flex items-center gap-2">
          <span className="relative h-[9px] w-[9px]">
            <span className="absolute -inset-1 animate-gs-ring rounded-full border-[1.5px] border-moss" />
            <span className="absolute inset-0 animate-guide-pulse rounded-full bg-moss shadow-[0_0_8px] shadow-moss" />
          </span>
          <span className="text-[12.5px] font-medium text-moss">Guide active</span>
          <span className="ml-auto flex flex-col items-end leading-tight">
            <span className="font-mono text-xs font-medium text-parchment">
              ±{position.uncertaintyM.toFixed(1)} m
            </span>
            <span className="mt-[3px] font-mono text-[7.5px] tracking-[0.12em] text-[#4c4f55]">
              CONFIDENCE · {position.stepCount} STEPS
            </span>
          </span>
        </div>

        {/* the real tourist-runtime minimap, fed by the real engine */}
        <Minimap blueprint={demoBlueprint} position={position} />
        <div className="mt-2 flex items-center gap-1.5 px-0.5">
          <span className="h-[7px] w-[7px] rounded-full bg-[radial-gradient(circle,#f2d79a,rgba(242,215,154,0))]" />
          <span className="font-mono text-[8px] tracking-[0.08em] text-[#6b6e74]">
            approximate position — room-level, not a precise dot
          </span>
        </div>

        {/* the runtime's manual-browse affordance (decorative here) */}
        <div className="mt-3 rounded-xl border border-hairline px-4 py-2.5 text-center text-[11.5px] text-stone">
          Browse exhibits manually
        </div>

        <div className="mb-4 mt-auto pt-4">
          <div className="flex items-center gap-3 rounded-2xl border border-hairline bg-gradient-to-br from-[#16191e] to-[#0d0f12] px-3 py-2.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[radial-gradient(circle_at_38%_32%,#ecc887,#d2a24c_78%)] shadow-[0_0_18px_rgba(210,162,76,.55)]">
              <span className="flex gap-[3px]">
                <span className="h-[13px] w-[3px] rounded-[1px] bg-ink" />
                <span className="h-[13px] w-[3px] rounded-[1px] bg-ink" />
              </span>
            </span>
            <div className="min-w-0 flex-1">
              <div className="mb-1 font-mono text-[8px] font-medium tracking-[0.16em] text-stone">
                NOW PLAYING · EN
              </div>
              <div className="truncate text-[12.5px] text-parchment">
                {(playingZone && NARRATION_TITLES[playingZone.id]) ?? 'Narration playing'}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <div className="relative h-[3px] flex-1 rounded-sm bg-hairline">
                  <div className="h-full w-[38%] rounded-sm bg-gradient-to-r from-brass to-brass-bright" />
                  <span className="absolute left-[38%] top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brass-bright shadow-[0_0_8px_rgba(236,200,135,.8)]" />
                </div>
                <span className="font-mono text-[8.5px] font-medium text-[#6b6e74]">1:12</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* home indicator */}
      <div className="absolute bottom-2 left-1/2 z-[6] h-[5px] w-[120px] -translate-x-1/2 rounded-[3px] bg-parchment/40" />
    </div>
  );
}

export function HeroPhone() {
  return (
    <div className="relative w-[clamp(280px,30vw,330px)] rounded-[clamp(44px,4.4vw,52px)] bg-gradient-to-br from-[#232830] via-[#14171b] to-[#0a0c0e] p-[10px] shadow-[0_0_0_1.5px_#34383f,inset_0_1px_1px_rgba(255,255,255,.14),inset_0_-2px_3px_rgba(0,0,0,.6),0_50px_120px_-34px_rgba(210,162,76,.5),0_30px_90px_-30px_rgba(0,0,0,.9)]" style={{ aspectRatio: '9/19.5' }}>
      <GuideScreen className="rounded-[clamp(36px,3.6vw,42px)]" />
    </div>
  );
}
