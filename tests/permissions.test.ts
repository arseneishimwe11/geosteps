import { describe, expect, it } from 'vitest';
import { detectCapabilities, requestMotionPermissions, type BrowserEnv } from '../src/engine/platform/sensors';

/**
 * The permission layer's contract: every outcome is a structured
 * { status, message } with an honest, user-facing message — never a thrown
 * error the UI forgets to catch, never a silent no-op.
 */
describe('capability detection', () => {
  it('reports ok on a fully capable Android-like browser (no permission gate)', () => {
    const env: BrowserEnv = {
      DeviceMotionEvent: {},
      DeviceOrientationEvent: {},
      navigator: { wakeLock: {}, mediaDevices: { getUserMedia: () => Promise.resolve() } },
    };
    const report = detectCapabilities(env);
    expect(report.deviceMotion.status).toBe('ok');
    expect(report.deviceOrientation.status).toBe('ok');
    expect(report.wakeLock.status).toBe('ok');
    expect(report.microphone.status).toBe('ok');
  });

  it('reports needs-user-gesture on an iOS-like browser, with instructions', () => {
    const env: BrowserEnv = {
      DeviceMotionEvent: { requestPermission: async () => 'granted' },
      DeviceOrientationEvent: { requestPermission: async () => 'granted' },
      navigator: { wakeLock: {} },
    };
    const report = detectCapabilities(env);
    expect(report.deviceMotion.status).toBe('needs-user-gesture');
    expect(report.deviceMotion.message).toMatch(/tap/i);
  });

  it('missing Wake Lock API yields an honest on-screen message, not a silent failure', () => {
    const env: BrowserEnv = { DeviceMotionEvent: {}, DeviceOrientationEvent: {}, navigator: {} };
    const report = detectCapabilities(env);
    expect(report.wakeLock.status).toBe('unsupported');
    expect(report.wakeLock.message.length).toBeGreaterThan(20);
    expect(report.wakeLock.message).toMatch(/screen/i);
  });

  it('missing motion sensors yields an honest message that offers the manual fallback', () => {
    const report = detectCapabilities({ navigator: {} });
    expect(report.deviceMotion.status).toBe('unsupported');
    expect(report.deviceMotion.message).toMatch(/manual/i);
  });
});

describe('requestMotionPermissions', () => {
  it('granted on iOS-like prompt', async () => {
    const env: BrowserEnv = {
      DeviceMotionEvent: { requestPermission: async () => 'granted' },
      DeviceOrientationEvent: { requestPermission: async () => 'granted' },
    };
    const out = await requestMotionPermissions(env);
    expect(out.deviceMotion.status).toBe('ok');
    expect(out.deviceOrientation.status).toBe('ok');
  });

  it('user tapped "Don\'t Allow": structured denial with an honest message', async () => {
    const env: BrowserEnv = {
      DeviceMotionEvent: { requestPermission: async () => 'denied' },
      DeviceOrientationEvent: { requestPermission: async () => 'denied' },
    };
    const out = await requestMotionPermissions(env);
    expect(out.deviceMotion.status).toBe('denied');
    expect(out.deviceMotion.message).toMatch(/declined/i);
    expect(out.deviceMotion.message.length).toBeGreaterThan(20);
    expect(out.deviceOrientation.status).toBe('denied');
  });

  it('requestPermission REJECTING (called outside a user gesture) resolves to a denial — it never throws', async () => {
    const env: BrowserEnv = {
      DeviceMotionEvent: {
        requestPermission: async () => {
          throw new DOMException('NotAllowedError');
        },
      },
      DeviceOrientationEvent: {
        requestPermission: async () => {
          throw new DOMException('NotAllowedError');
        },
      },
    };
    const out = await requestMotionPermissions(env); // must not reject
    expect(out.deviceMotion.status).toBe('denied');
    expect(out.deviceMotion.message).toMatch(/tap/i);
  });

  it('no motion API at all: unsupported with a message, not a crash', async () => {
    const out = await requestMotionPermissions({});
    expect(out.deviceMotion.status).toBe('unsupported');
    expect(out.deviceMotion.message.length).toBeGreaterThan(20);
    expect(out.deviceOrientation.status).toBe('unsupported');
  });

  it('Android path (API present, no gate) resolves ok without ever calling a prompt', async () => {
    const out = await requestMotionPermissions({ DeviceMotionEvent: {}, DeviceOrientationEvent: {} });
    expect(out.deviceMotion.status).toBe('ok');
    expect(out.deviceOrientation.status).toBe('ok');
  });
});
