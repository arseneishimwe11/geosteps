import { norm360 } from '../geometry';
import type { MotionSample } from '../types';

/**
 * Sensor bootstrapping & permission layer.
 *
 * The hard platform facts this encodes:
 *  - iOS 13+ gates DeviceMotionEvent / DeviceOrientationEvent behind an
 *    explicit requestPermission() call that MUST run inside a user gesture
 *    (a tap). Calling it outside a gesture rejects.
 *  - Android Chrome exposes the same events with no permission call at all —
 *    requestPermission simply doesn't exist there.
 *  - Safari has no raw magnetometer, but exposes a fused compass heading via
 *    the non-standard `webkitCompassHeading` property (deg CW from magnetic
 *    north). Chrome exposes `deviceorientationabsolute` where heading =
 *    360 - alpha.
 *
 * Every capability resolves to a structured { status, message } — the UI's
 * contract is to render these messages verbatim. Nothing here fails silently:
 * unsupported and denied are ordinary return values, never exceptions.
 */

export type CapabilityStatus = 'ok' | 'needs-user-gesture' | 'denied' | 'unsupported';

export interface Capability {
  status: CapabilityStatus;
  /** Honest, user-facing explanation. Non-empty for every non-'ok' status. */
  message: string;
}

export interface CapabilityReport {
  deviceMotion: Capability;
  deviceOrientation: Capability;
  wakeLock: Capability;
  microphone: Capability;
}

/** Structural slice of `window` — tests inject fakes, the browser passes `window` itself. */
export interface BrowserEnv {
  DeviceMotionEvent?: { requestPermission?: () => Promise<string> };
  DeviceOrientationEvent?: { requestPermission?: () => Promise<string> };
  navigator?: {
    wakeLock?: unknown;
    mediaDevices?: { getUserMedia?: unknown };
  };
}

const MSG = {
  motionUnsupported:
    'This browser does not expose motion sensors to web pages, so the guide cannot count your steps here. ' +
    'You can still pick exhibits and play their audio manually.',
  motionNeedsGesture:
    'Tap "Start the guide" to allow motion access — this browser only grants sensor access after a tap.',
  motionDenied:
    'Motion access was declined, so the guide cannot follow your steps. Reload the page and allow motion ' +
    'access to enable automatic guiding, or continue in manual mode.',
  orientationUnsupported:
    'This browser does not expose a compass heading to web pages, so the guide cannot tell which way you are walking. ' +
    'You can still pick exhibits and play their audio manually.',
  orientationDenied:
    'Compass access was declined, so the guide cannot tell which way you are walking. Reload the page and allow ' +
    'access to enable automatic guiding, or continue in manual mode.',
  wakeLockUnsupported:
    'This browser cannot keep the screen awake automatically. The guide only works while the screen is on — ' +
    'please keep your phone unlocked and this page visible while you walk.',
  micUnsupported:
    'This browser does not allow microphone access, so the guide cannot use ambient sound to double-check which ' +
    'room you are in. Step tracking still works; positioning may drift a little more.',
} as const;

const OK: Capability = { status: 'ok', message: '' };

/** Synchronous feature detection — safe to call at page load, before any user gesture. */
export function detectCapabilities(env: BrowserEnv): CapabilityReport {
  const motion: Capability = !env.DeviceMotionEvent
    ? { status: 'unsupported', message: MSG.motionUnsupported }
    : typeof env.DeviceMotionEvent.requestPermission === 'function'
      ? { status: 'needs-user-gesture', message: MSG.motionNeedsGesture }
      : OK;

  const orientation: Capability = !env.DeviceOrientationEvent
    ? { status: 'unsupported', message: MSG.orientationUnsupported }
    : typeof env.DeviceOrientationEvent.requestPermission === 'function'
      ? { status: 'needs-user-gesture', message: MSG.motionNeedsGesture }
      : OK;

  const wakeLock: Capability = env.navigator?.wakeLock
    ? OK
    : { status: 'unsupported', message: MSG.wakeLockUnsupported };

  const microphone: Capability = env.navigator?.mediaDevices?.getUserMedia
    ? OK
    : { status: 'unsupported', message: MSG.micUnsupported };

  return { deviceMotion: motion, deviceOrientation: orientation, wakeLock, microphone };
}

export interface MotionPermissionOutcome {
  deviceMotion: Capability;
  deviceOrientation: Capability;
}

/**
 * Request motion + orientation permission. MUST be called from a user-gesture
 * handler (the "Start the guide" tap) on iOS. Never throws: a rejected or
 * denied permission comes back as a structured 'denied' capability with an
 * honest message for the UI to show.
 */
export async function requestMotionPermissions(env: BrowserEnv): Promise<MotionPermissionOutcome> {
  return {
    deviceMotion: await requestOne(env.DeviceMotionEvent, MSG.motionUnsupported, MSG.motionDenied),
    deviceOrientation: await requestOne(
      env.DeviceOrientationEvent,
      MSG.orientationUnsupported,
      MSG.orientationDenied,
    ),
  };
}

async function requestOne(
  ctor: { requestPermission?: () => Promise<string> } | undefined,
  unsupportedMsg: string,
  deniedMsg: string,
): Promise<Capability> {
  if (!ctor) return { status: 'unsupported', message: unsupportedMsg };
  if (typeof ctor.requestPermission !== 'function') return OK; // Android path: no gate exists
  try {
    const result = await ctor.requestPermission();
    return result === 'granted' ? OK : { status: 'denied', message: deniedMsg };
  } catch {
    // iOS rejects when called outside a user gesture, or on internal errors.
    return {
      status: 'denied',
      message: deniedMsg + ' (The permission prompt could not be shown — it must be triggered by a tap.)',
    };
  }
}

// ---------------------------------------------------------------------------
// Event-stream glue (browser runtime; simulations bypass this entirely)
// ---------------------------------------------------------------------------

interface EventTargetLike {
  addEventListener(type: string, cb: (ev: any) => void): void;
  removeEventListener(type: string, cb: (ev: any) => void): void;
}

/** Subscribe to devicemotion as MotionSamples; returns an unsubscribe function. */
export function startMotionStream(
  target: EventTargetLike,
  onSample: (s: MotionSample) => void,
  now: () => number = () => Date.now(),
): () => void {
  const handler = (ev: any) => {
    const a = ev.accelerationIncludingGravity;
    if (!a || a.x == null || a.y == null || a.z == null) return;
    onSample({ tMs: now(), ax: a.x, ay: a.y, az: a.z });
  };
  target.addEventListener('devicemotion', handler);
  return () => target.removeEventListener('devicemotion', handler);
}

export interface HeadingReading {
  /** Compass heading, deg CW from north. */
  headingDeg: number;
  /** False when derived from a non-absolute alpha (drifts; needs a manual align step). */
  absolute: boolean;
}

/**
 * Subscribe to compass headings. Prefers `webkitCompassHeading` (iOS Safari),
 * then absolute `deviceorientationabsolute`/`deviceorientation` alpha
 * (heading = 360 - alpha). Non-absolute alpha is reported with
 * absolute=false so the caller can require a manual "face the entrance sign
 * and tap" alignment before trusting it.
 */
export function startHeadingStream(
  target: EventTargetLike,
  onHeading: (h: HeadingReading) => void,
): () => void {
  const handler = (ev: any) => {
    if (typeof ev.webkitCompassHeading === 'number' && !Number.isNaN(ev.webkitCompassHeading)) {
      onHeading({ headingDeg: norm360(ev.webkitCompassHeading), absolute: true });
    } else if (typeof ev.alpha === 'number') {
      onHeading({ headingDeg: norm360(360 - ev.alpha), absolute: ev.absolute === true });
    }
  };
  target.addEventListener('deviceorientationabsolute', handler);
  target.addEventListener('deviceorientation', handler);
  return () => {
    target.removeEventListener('deviceorientationabsolute', handler);
    target.removeEventListener('deviceorientation', handler);
  };
}
