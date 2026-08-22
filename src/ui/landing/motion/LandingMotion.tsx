'use client';

import { useEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

/**
 * The landing page's scroll choreography, mounted once. Progressive
 * enhancement by construction: the page is fully laid out and visible with
 * no JS; this module only *adds* motion. Under prefers-reduced-motion it
 * does nothing at all — the static page IS the reduced experience.
 *
 * Targets are declared with data attributes in the (server-rendered)
 * sections:
 *   data-reveal            fade/rise once when scrolled into view
 *   data-reveal-delay      optional seconds offset for simple staggers
 *   data-bar-fill          horizontal bar that grows in from the left
 *   data-draw              SVG path/polyline that draws itself in
 *   data-hero-phone        gentle parallax as the hero scrolls away
 *   data-hero-glow         the gallery light brightens slightly on scroll
 */
export function LandingMotion() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    gsap.registerPlugin(ScrollTrigger);

    const lenis = new Lenis({ autoRaf: false, lerp: 0.12 });
    lenis.on('scroll', ScrollTrigger.update);
    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    // Reveals hide with `opacity`, deliberately NOT gsap's `autoAlpha`.
    // autoAlpha adds visibility:hidden, which drops every un-revealed section
    // out of the accessibility tree and the tab order — a keyboard visitor
    // tabbed straight from the hero to the footer, never reaching the pilot
    // form. Opacity keeps the content present and focusable; the focusin
    // handler below finishes a reveal the instant focus lands inside one, so
    // nobody is ever focused on something they cannot see.
    const revealTweens = new Map<HTMLElement, gsap.core.Tween>();

    const ctx = gsap.context(() => {
      // --- reveals -----------------------------------------------------------
      document.querySelectorAll<HTMLElement>('[data-reveal]').forEach((el) => {
        revealTweens.set(
          el,
          gsap.from(el, {
            y: 28,
            opacity: 0,
            duration: 0.9,
            ease: 'power3.out',
            delay: Number(el.dataset.revealDelay ?? 0),
            scrollTrigger: { trigger: el, start: 'top 86%', once: true },
          }),
        );
      });

      // --- language-coverage bars -------------------------------------------
      const bars = document.querySelectorAll<HTMLElement>('[data-bar-fill]');
      bars.forEach((el, i) => {
        gsap.from(el, {
          scaleX: 0,
          transformOrigin: 'left center',
          duration: 1.1,
          ease: 'power2.out',
          delay: i * 0.12,
          scrollTrigger: { trigger: el, start: 'top 88%', once: true },
        });
      });

      // --- self-drawing traced paths (calibration canvas) --------------------
      document.querySelectorAll<SVGGeometryElement>('[data-draw]').forEach((path) => {
        const len = path.getTotalLength();
        gsap.fromTo(
          path,
          { strokeDasharray: len, strokeDashoffset: len },
          {
            strokeDashoffset: 0,
            duration: 1.8,
            ease: 'power2.inOut',
            scrollTrigger: { trigger: path, start: 'top 82%', once: true },
          },
        );
      });

      // --- hero: the lantern drifts as you leave it --------------------------
      const heroPhone = document.querySelector('[data-hero-phone]');
      if (heroPhone) {
        gsap.to(heroPhone, {
          yPercent: -7,
          scale: 0.96,
          ease: 'none',
          scrollTrigger: { trigger: '#top', start: 'top top', end: 'bottom top', scrub: 0.5 },
        });
      }
      const heroGlow = document.querySelector('[data-hero-glow]');
      if (heroGlow) {
        gsap.to(heroGlow, {
          opacity: 1,
          scale: 1.08,
          ease: 'none',
          scrollTrigger: { trigger: '#top', start: 'top top', end: 'bottom 40%', scrub: 0.5 },
        });
      }

      // --- nav: quiet until the gallery starts scrolling ---------------------
      const nav = document.querySelector('[data-nav]');
      if (nav) {
        ScrollTrigger.create({
          start: 80,
          onToggle: (self) => nav.classList.toggle('nav-scrolled', self.isActive),
        });
      }
    });

    // Tabbing into a section that has not revealed yet finishes its reveal at
    // once, and scrolls it into view — keyboard navigation never lands on
    // something the visitor cannot see.
    const onFocusIn = (e: Event) => {
      const el = (e.target as Element)?.closest?.('[data-reveal]') as HTMLElement | null;
      if (!el) return;
      const tween = revealTweens.get(el);
      if (tween && tween.progress() < 1) {
        tween.progress(1);
        el.scrollIntoView({ block: 'nearest', behavior: 'auto' });
      }
    };
    document.addEventListener('focusin', onFocusIn);

    // Lenis owns wheel/touch scrolling; keep anchor links working through it.
    const onAnchorClick = (e: Event) => {
      const a = (e.target as Element).closest('a[href^="#"]');
      if (!a) return;
      const id = a.getAttribute('href')!;
      const target = id === '#top' ? 0 : (document.querySelector(id) as HTMLElement | null);
      if (target !== null) {
        e.preventDefault();
        lenis.scrollTo(target, { offset: id === '#top' ? 0 : -60 });
      }
    };
    document.addEventListener('click', onAnchorClick);

    return () => {
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('click', onAnchorClick);
      ctx.revert();
      gsap.ticker.remove(tick);
      lenis.destroy();
    };
  }, []);

  return null;
}
