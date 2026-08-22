import type { Viewport } from 'next';
import { TourApp } from '../../../ui/tour/TourApp';

/**
 * The guide is a held-in-hand instrument; accidental pinch-zoom while walking
 * is far more likely than a deliberate one. This restriction is deliberate and
 * scoped to this route only — it used to sit in the root layout, where it also
 * suppressed zoom on the marketing page and the admin tool for no reason.
 * (It remains a WCAG 1.4.4 trade-off worth revisiting with real visitors.)
 */
export const viewport: Viewport = {
  maximumScale: 1,
  userScalable: false,
};

export default async function TourPage({ params }: { params: Promise<{ venue: string }> }) {
  const { venue } = await params;
  return <TourApp venueId={venue} />;
}
