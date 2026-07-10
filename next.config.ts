import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Plain mobile web page opened from a QR code — deliberately NOT an
  // installed PWA (pre-iOS-18.4 Wake Lock bug; see ARCHITECTURE.md §1.4).
  // No service worker, no manifest, no install prompt.
  reactStrictMode: true,
};

export default nextConfig;
