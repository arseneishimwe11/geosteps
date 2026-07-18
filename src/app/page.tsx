import type { Metadata } from 'next';
import { LandingMotion } from '../ui/landing/motion/LandingMotion';
import { Calibrate } from '../ui/landing/Calibrate';
import { FinalCta } from '../ui/landing/FinalCta';
import { Footer } from '../ui/landing/Footer';
import { Hero } from '../ui/landing/Hero';
import { HowItWorks } from '../ui/landing/HowItWorks';
import { Languages } from '../ui/landing/Languages';
import { Nav } from '../ui/landing/Nav';
import { ScrollWalk } from '../ui/landing/ScrollWalk';
import { Stakes } from '../ui/landing/Stakes';
import { Truth } from '../ui/landing/Truth';

export const metadata: Metadata = {
  title: 'geosteps — the story finds you',
  description:
    'A web audio guide for museums and cultural sites. Every visitor hears each exhibit in their own language — no app, no beacons, nothing added to the building.',
};

/**
 * The landing page — "after-hours gallery": true black, one brass light,
 * honesty as the luxury. Static-first (Phase 1); scroll choreography lands
 * in Phase 2, the 3D device in Phase 3.
 */
export default function LandingPage() {
  return (
    <div className="bg-ink">
      <LandingMotion />
      <Nav />
      <main>
        <Hero />
        <ScrollWalk />
        <Stakes />
        <HowItWorks />
        <Truth />
        <Calibrate />
        <Languages />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
