import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Mono, Newsreader } from 'next/font/google';
import './globals.css';

// Self-hosted at build time by next/font — no runtime CDN fetch, per the
// product's own no-external-fetch rule. These feed the --font-display and
// --font-mono tokens in globals.css.
const newsreader = Newsreader({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  weight: ['400', '500', '600'],
  variable: '--font-newsreader',
  display: 'swap',
});
const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-plex-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'geosteps',
  description: 'Indoor audio guide — no app install, no added hardware.',
};

// Pinch-zoom stays available everywhere by default (WCAG 1.4.4). The one
// route that suppresses it is the walking guide, which sets its own viewport
// — see src/app/tour/[venue]/page.tsx.
export const viewport: Viewport = {
  themeColor: '#000000',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${newsreader.variable} ${plexMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
