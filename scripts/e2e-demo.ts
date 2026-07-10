/**
 * End-to-end demo proof for Phase C run 1.
 *
 *   npx tsx scripts/e2e-demo.ts [screenshot-dir]
 *
 * Drives the real tourist runtime and admin surface in the preinstalled
 * Chromium (fake mic device so getUserMedia works headlessly), asserts the
 * acceptance criteria along the way, and drops numbered screenshots as the
 * visible proof. Exits non-zero on the first failed assertion.
 *
 * Prereqs: `npm run server` (:4000) and `npm run dev` (:3000) running,
 * demo venue seeded with placeholder tones.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium, type Page } from 'playwright';

const OUT = process.argv[2] ?? 'e2e-shots';
const APP = 'http://localhost:3000';
const tid = (id: string) => `[data-testid="${id}"]`;

let step = 0;
function log(msg: string) {
  console.log(`  ${msg}`);
}
async function shot(page: Page, name: string) {
  step++;
  const file = join(OUT, `${String(step).padStart(2, '0')}-${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`📸 ${file}`);
}
function fail(msg: string): never {
  console.error(`❌ ${msg}`);
  process.exit(1);
}
async function expectVisible(page: Page, testId: string, what: string, timeout = 8000) {
  try {
    await page.locator(tid(testId)).first().waitFor({ state: 'visible', timeout });
    log(`✓ ${what}`);
  } catch {
    fail(`${what} — [data-testid=${testId}] not visible within ${timeout} ms`);
  }
}
async function expectText(page: Page, testId: string, text: string, what: string, timeout = 10000) {
  try {
    await page.locator(tid(testId)).first().filter({ hasText: text }).waitFor({ state: 'visible', timeout });
    log(`✓ ${what}`);
  } catch {
    const actual = await page.locator(tid(testId)).first().textContent().catch(() => '(missing)');
    fail(`${what} — expected “${text}” in [data-testid=${testId}], got “${actual}”`);
  }
}

async function clickTimes(page: Page, testId: string, times: number) {
  for (let i = 0; i < times; i++) {
    await page.locator(tid(testId)).click();
    await page.waitForTimeout(60);
  }
}

/** Click a map-frame world coordinate on the floor canvas (reads the live view transform). */
async function worldClick(page: Page, wx: number, wy: number) {
  const svg = page.locator(tid('floor-canvas'));
  const box = (await svg.boundingBox())!;
  const s = Number(await svg.getAttribute('data-scale'));
  const ox = Number(await svg.getAttribute('data-ox'));
  const oy = Number(await svg.getAttribute('data-oy'));
  await page.mouse.click(box.x + ox + s * wx, box.y + oy - s * wy);
  await page.waitForTimeout(140);
}

async function run() {
  await mkdir(OUT, { recursive: true });
  // Snapshot the venue as committed; the script restores it at the end so
  // repeated runs (and the repo) stay canonical.
  const originalBlueprint = await (await fetch('http://localhost:4000/venues/demo/blueprint.json')).text();
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium',
    headless: true,
    args: [
      '--no-sandbox',
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      '--autoplay-policy=no-user-gesture-required',
    ],
  });

  const errors: string[] = [];
  const trackErrors = (page: Page) => {
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
  };

  // ---------------------------------------------------------------- tourist
  console.log('\n— Tourist runtime —');
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.grantPermissions(['microphone'], { origin: APP });
  const page = await ctx.newPage();
  trackErrors(page);

  await page.goto(`${APP}/tour/demo?dev=1`);
  await expectVisible(page, 'start-guide', 'start screen renders with the start button');
  await expectVisible(page, 'lang-rw', 'language picker offers Kinyarwanda');
  await page.locator(tid('lang-rw')).click();
  await page.waitForTimeout(250); // let the chip re-render before the shot
  await shot(page, 'tour-start-screen');

  await page.locator(tid('start-guide')).click();
  await expectVisible(page, 'guide-active', 'guide-active indicator on after the single start tap');
  await expectVisible(page, 'wakelock-chip', 'wake-lock chip visible');
  const wakeState = await page.locator(tid('wakelock-chip')).getAttribute('data-state');
  log(`  wake-lock state reported by the engine: ${wakeState}`);
  if (!['active', 'released', 'denied', 'unsupported'].includes(wakeState ?? '')) {
    fail(`wake-lock chip has no honest state (got ${wakeState})`);
  }
  await shot(page, 'tour-guide-between-exhibits');

  // Walk into the Entrance Hall: 6 simulated steps north, then let the
  // geofence debounce (1.5 s) mature on the engine's real 500 ms ticks.
  await page.locator(tid('sim-step-n5')).click();
  await page.locator(tid('sim-step-n')).click();
  await expectText(page, 'zone-name', 'Entrance Hall', 'zone display shows Entrance Hall (engine-driven)');
  await expectVisible(page, 'now-playing', 'narration started on zone enter');
  await expectText(page, 'now-playing', 'Placeholder tone', 'audio is honestly labeled as placeholder');
  await shot(page, 'tour-zone-entrance-hall');

  // Irregular walk on to the Royal Drum Gallery: south to the corridor,
  // east along the spine, north up the spur.
  await clickTimes(page, 'sim-step-s', 6);
  await clickTimes(page, 'sim-step-e', 15);
  await page.locator(tid('sim-step-n5')).click();
  await page.locator(tid('sim-step-n')).click();
  await expectText(page, 'zone-name', 'Royal Drum Gallery', 'crossfade to Royal Drum Gallery');
  await shot(page, 'tour-zone-royal-drums');

  // Acoustic corrector demo: three consecutive samples that sound like the
  // Kingdom History Room. 1 + 2 build the streak (no movement — the audit
  // rows prove it), the 3rd re-anchors, then the geofence enters the zone.
  await page.locator(tid('sim-acoustic-kingdom-history')).click();
  await page.waitForTimeout(300);
  await page.locator(tid('sim-acoustic-kingdom-history')).click();
  await page.waitForTimeout(300);
  await expectText(page, 'audit-table', 'streak-building', 'audit table shows the streak building');
  await page.locator(tid('sim-acoustic-kingdom-history')).click();
  await expectText(page, 'audit-table', 'reanchored', 'third agreeing sample re-anchored (audited)');
  await expectText(page, 'zone-name', 'Kingdom History Room', 'zone follows the acoustic re-anchor via normal debounce');
  await shot(page, 'tour-acoustic-reanchor-audits');

  await page.locator(tid('manual-toggle')).click();
  await expectVisible(page, 'manual-list', 'manual exhibit fallback is one tap away');
  await shot(page, 'tour-manual-fallback');
  await ctx.close();

  // -------------------------------------------------- honesty: no sensors
  console.log('\n— Honest failure states (sensors unsupported, mic denied) —');
  const bare = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const hPage = await bare.newPage();
  trackErrors(hPage);
  await hPage.addInitScript(() => {
    Object.defineProperty(window, 'DeviceMotionEvent', { value: undefined });
    Object.defineProperty(window, 'DeviceOrientationEvent', { value: undefined });
  });
  await hPage.goto(`${APP}/tour/demo`);
  await expectVisible(hPage, 'capability-msg-deviceMotion', 'motion-unsupported message shown verbatim before start');
  const msg = await hPage.locator(tid('capability-msg-deviceMotion')).textContent();
  if (!msg?.includes('manual')) fail('motion-unsupported message does not offer the manual fallback');
  log(`  message: “${msg?.slice(0, 80)}…”`);
  await shot(hPage, 'tour-honest-unsupported-sensors');
  await bare.close();

  // ----------------------------------------------------------------- admin
  console.log('\n— Admin calibration surface —');
  const admin = await browser.newContext({ viewport: { width: 1100, height: 950 } });
  await admin.grantPermissions(['microphone'], { origin: APP });
  const aPage = await admin.newPage();
  trackErrors(aPage);
  await aPage.goto(`${APP}/admin/demo`);
  await expectVisible(aPage, 'admin-warning', 'unauthenticated-write warning banner visible');
  await expectVisible(aPage, 'validation-status', 'live schema validation panel visible');
  const ok = await aPage.locator(tid('validation-status')).getAttribute('data-ok');
  if (ok !== 'true') fail('demo blueprint should validate');
  log('✓ blueprint validates against the frozen schema');
  await shot(aPage, 'admin-overview');

  // Record an acoustic snapshot for the one zone that has none (fake mic tone).
  await aPage.locator(tid('record-zone-contemporary-wing')).scrollIntoViewIfNeeded();
  await aPage.locator(tid('record-zone-contemporary-wing')).click();
  await expectVisible(aPage, 'fingerprint-viz-contemporary-wing', '8 s recording produced a fingerprint (band viz)', 15000);
  await shot(aPage, 'admin-recorded-fingerprint');

  // Generate + upload a placeholder tone for one slot, then save.
  await aPage.locator(tid('gen-placeholder-contemporary-wing-en')).scrollIntoViewIfNeeded();
  await aPage.locator(tid('gen-placeholder-contemporary-wing-en')).click();
  await expectVisible(aPage, 'audio-preview-contemporary-wing-en', 'placeholder uploaded and previewable');
  await aPage.locator(tid('save-blueprint')).click();
  await expectText(aPage, 'save-result', 'Saved', 'validated blueprint saved to the venue server');
  await shot(aPage, 'admin-saved');

  // The saved blueprint must round-trip: the server now serves the fingerprint.
  const served = await (await fetch('http://localhost:4000/venues/demo/blueprint.json')).json();
  const cw = served.zones.find((z: { id: string }) => z.id === 'contemporary-wing');
  if (!cw?.fingerprint || cw.fingerprint.method !== 'band-energy-v1') {
    fail('saved blueprint does not contain the newly recorded fingerprint in the frozen format');
  }
  log('✓ server round-trip: recorded fingerprint present, frozen band-energy-v1 format');

  // ------------------------------------------------ the drawing canvas
  console.log('\n— Floor-plan drawing canvas —');
  await expectVisible(aPage, 'floor-canvas', 'canvas renders');

  // Upload a synthetic floor-plan image as the tracing backdrop.
  const floorplanDataUrl = await aPage.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 800;
    c.height = 500;
    const g = c.getContext('2d')!;
    g.fillStyle = '#f4efe4';
    g.fillRect(0, 0, 800, 500);
    g.strokeStyle = '#8a7a5c';
    g.lineWidth = 6;
    g.strokeRect(20, 20, 760, 460);
    g.strokeRect(60, 60, 300, 180);
    g.strokeRect(440, 60, 300, 180);
    g.strokeRect(60, 300, 680, 140);
    return c.toDataURL('image/png');
  });
  const tmpPng = join(OUT, 'floorplan.png');
  await writeFile(tmpPng, Buffer.from(floorplanDataUrl.split(',')[1]!, 'base64'));
  await aPage.locator(tid('backdrop-file')).setInputFiles(tmpPng);
  await aPage.waitForTimeout(500);
  if (!(await aPage.getByText('Backdrop not calibrated').isVisible())) {
    fail('uncalibrated backdrop must show the calibration warning');
  }
  log('✓ backdrop uploaded; honest "not calibrated" warning shown');

  // Calibrate: two picks a known 5 m apart (tool auto-selected after upload).
  await worldClick(aPage, 5, 5);
  await worldClick(aPage, 15, 5);
  await expectVisible(aPage, 'calib-meters-input', 'calibration dialog opened after two picks');
  await aPage.locator(tid('calib-meters-input')).fill('5');
  await aPage.locator(tid('calib-confirm')).click();
  await aPage.waitForTimeout(400);
  if (await aPage.getByText('Backdrop not calibrated').isVisible()) {
    fail('calibration warning should clear after applying the scale');
  }
  log('✓ scale calibrated (backdrop rescaled, geometry untouched)');

  // Draw a new zone: four corners, close by tapping the first corner again.
  await aPage.locator(tid('tool-draw-zone')).click();
  await worldClick(aPage, 2, 16);
  await worldClick(aPage, 8, 16);
  await worldClick(aPage, 8, 22);
  await worldClick(aPage, 2, 22);
  await worldClick(aPage, 2, 16); // close
  await expectVisible(aPage, 'zone-name-input', 'zone naming dialog opened on close');
  await aPage.locator(tid('zone-name-input')).fill('Temporary Exhibit');
  await shot(aPage, 'admin-canvas-zone-dialog');
  await aPage.locator(tid('zone-name-confirm')).click();
  await expectVisible(aPage, 'zone-card-temporary-exhibit', 'new zone gets a full zone card (recorder + audio slots)');

  // Trace a walkable path: continue from the existing "hall" node, add two nodes.
  await aPage.locator(tid('tool-draw-path')).click();
  await worldClick(aPage, 5, 11); // existing node "hall" → chain anchor, no new node
  await worldClick(aPage, 5, 19); // new node + edge hall→n9
  await worldClick(aPage, 7, 21); // new node + edge n9→n10
  await shot(aPage, 'admin-canvas-drawn');

  // Undo removes the last node+edge; redo restores it; save proves the result.
  await aPage.locator(tid('canvas-undo')).click();
  await aPage.locator(tid('canvas-redo')).click();
  const okAfterDraw = await aPage.locator(tid('validation-status')).getAttribute('data-ok');
  if (okAfterDraw !== 'true') fail('blueprint must still validate after canvas edits');
  await aPage.locator(tid('save-blueprint')).click();
  await expectText(aPage, 'save-result', 'Saved', 'canvas-drawn blueprint saved');

  const drawn = await (await fetch('http://localhost:4000/venues/demo/blueprint.json')).json();
  const newZone = drawn.zones.find((z: { id: string }) => z.id === 'temporary-exhibit');
  if (!newZone) fail('saved blueprint is missing the drawn zone');
  if (newZone.polygon.length !== 4) fail(`drawn zone should have 4 vertices, got ${newZone.polygon.length}`);
  if (newZone.polygon[0].x !== 2 || newZone.polygon[0].y !== 16) {
    fail(`drawn zone vertex 0 should be (2,16) after 0.5 m snap, got (${newZone.polygon[0].x},${newZone.polygon[0].y})`);
  }
  const nodeIds = drawn.graph.nodes.map((n: { id: string }) => n.id);
  if (!nodeIds.includes('n9') || !nodeIds.includes('n10')) {
    fail(`expected traced nodes n9,n10 in the graph, got ${nodeIds.join(',')}`);
  }
  const hasEdge = (a: string, b: string) =>
    drawn.graph.edges.some(
      (e: { from: string; to: string }) => (e.from === a && e.to === b) || (e.from === b && e.to === a),
    );
  if (!hasEdge('hall', 'n9') || !hasEdge('n9', 'n10')) fail('traced edges missing from the saved graph');
  log('✓ saved blueprint contains the drawn zone (snapped, 4 vertices) and the traced path (hall→n9→n10, undo/redo survived)');
  await admin.close();

  // Mobile viewport: the same admin surface, stacked and touch-ready.
  const adminMobile = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const mPage = await adminMobile.newPage();
  trackErrors(mPage);
  await mPage.goto(`${APP}/admin/demo`);
  await expectVisible(mPage, 'floor-canvas', 'canvas renders at phone width');
  await shot(mPage, 'admin-canvas-mobile');
  await adminMobile.close();

  // Desktop viewport: the tourist runtime's two-column layout.
  const tourDesktop = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await tourDesktop.grantPermissions(['microphone'], { origin: APP });
  const dPage = await tourDesktop.newPage();
  trackErrors(dPage);
  await dPage.goto(`${APP}/tour/demo?dev=1`);
  await dPage.locator(tid('start-guide')).click();
  await dPage.locator(tid('sim-step-n5')).click();
  await dPage.locator(tid('sim-step-n')).click();
  await expectText(dPage, 'zone-name', 'Entrance Hall', 'tour works at desktop width too');
  await shot(dPage, 'tour-desktop-two-column');
  await tourDesktop.close();

  // ------------------------------------------------------------ audits page
  console.log('\n— Field-observability page —');
  const audCtx = await browser.newContext({ viewport: { width: 1100, height: 950 } });
  const audPage = await audCtx.newPage();
  trackErrors(audPage);
  // localStorage is per-context; seed it from the tour run is gone — instead
  // run a quick tour in THIS context to generate audits, then view the page.
  await audPage.goto(`${APP}/tour/demo?dev=1`);
  await audPage.locator(tid('start-guide')).click();
  await audPage.locator(tid('sim-acoustic-entrance-hall')).click();
  await audPage.waitForTimeout(300);
  await audPage.locator(tid('sim-acoustic-entrance-hall')).click();
  await audPage.goto(`${APP}/dev/audits`);
  await expectVisible(audPage, 'audit-table', 'persisted audits visible on /dev/audits');
  await expectVisible(audPage, 'export-audits', 'JSON export available');
  await shot(audPage, 'dev-audits-page');
  await audCtx.close();

  await browser.close();

  // Put the venue back exactly as committed (removes the demo's test edits).
  const restore = await fetch('http://localhost:4000/venues/demo/blueprint.json', {
    method: 'PUT',
    body: originalBlueprint,
  });
  if (!restore.ok) fail('restoring the original demo blueprint failed');
  log('✓ demo venue restored to its committed state');

  const realErrors = errors.filter(
    (e) => !e.includes('favicon') && !e.includes('Download the React DevTools'),
  );
  if (realErrors.length > 0) {
    console.warn(`\n⚠ console/page errors observed (${realErrors.length}):`);
    realErrors.slice(0, 5).forEach((e) => console.warn('   ' + e.slice(0, 200)));
  }
  console.log('\n✅ All end-to-end assertions passed.');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
