'use client';

/**
 * Decides which hero device the visitor gets, and never guesses upward:
 *
 *   1. server render + first paint      -> CSS frame (it is part of the LCP)
 *   2. reduced motion                   -> CSS frame, permanently
 *   3. viewport below lg / coarse-only  -> CSS frame (no 1 MB model on phones)
 *   4. Save-Data or low device memory   -> CSS frame
 *   5. no WebGL                         -> CSS frame
 *   6. otherwise                        -> lazy-load the 3D scene, keep the
 *      CSS frame visible until the model's first frame, then crossfade
 *   7. any load/render error            -> back to the CSS frame, silently
 *
 * The GSAP hero parallax targets the wrapper ([data-hero-phone] in Hero),
 * so both devices ride the same scroll motion.
 */

import dynamic from 'next/dynamic';
import { Component, type ReactNode, useEffect, useRef, useState } from 'react';
import { HeroPhone } from '../HeroPhone';

const PhoneScene = dynamic(() => import('./PhoneScene'), { ssr: false });

class SceneErrorBoundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function deviceCan3D(): boolean {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  if (!window.matchMedia('(min-width: 1024px)').matches) return false;
  const nav = navigator as Navigator & { connection?: { saveData?: boolean }; deviceMemory?: number };
  if (nav.connection?.saveData) return false;
  if (nav.deviceMemory !== undefined && nav.deviceMemory < 4) return false;
  try {
    const probe = document.createElement('canvas');
    if (!probe.getContext('webgl2') && !probe.getContext('webgl')) return false;
  } catch {
    return false;
  }
  return true;
}

export function HeroDevice() {
  const [mode, setMode] = useState<'css' | '3d'>('css');
  const [sceneLive, setSceneLive] = useState(false);
  const [inView, setInView] = useState(true);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (deviceCan3D()) setMode('3d');
  }, []);

  // stop paying for WebGL frames once the hero scrolls away
  useEffect(() => {
    if (mode !== '3d' || !wrapRef.current) return;
    const io = new IntersectionObserver((entries) => {
      const e = entries[0];
      if (e) setInView(e.isIntersecting);
    }, { rootMargin: '80px' });
    io.observe(wrapRef.current);
    return () => io.disconnect();
  }, [mode]);

  return (
    <div ref={wrapRef} className="relative">
      <div
        className="transition-opacity duration-700"
        style={{ opacity: sceneLive ? 0 : 1 }}
        aria-hidden={sceneLive}
      >
        <HeroPhone />
      </div>
      {mode === '3d' && (
        <div
          className="absolute -inset-x-[18%] -inset-y-[9%] transition-opacity duration-700"
          style={{ opacity: sceneLive ? 1 : 0 }}
        >
          <SceneErrorBoundary
            onError={() => {
              setMode('css');
              setSceneLive(false);
            }}
          >
            <PhoneScene paused={!inView} onReady={() => setSceneLive(true)} />
          </SceneErrorBoundary>
        </div>
      )}
    </div>
  );
}
