import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { validateBlueprint } from '../src/engine/blueprint';
import { makeTestBlueprint } from './fixtures';

describe('validateBlueprint', () => {
  it('accepts the shipped demo venue blueprint', async () => {
    const raw = JSON.parse(await readFile(new URL('../venues/demo/blueprint.json', import.meta.url), 'utf8'));
    const result = validateBlueprint(raw);
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it('accepts the test fixture blueprint', () => {
    const result = validateBlueprint(makeTestBlueprint());
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it('collects every structural problem instead of stopping at the first', () => {
    const broken = makeTestBlueprint() as any;
    broken.zones[0].polygon = [{ x: 0, y: 0 }, { x: 1, y: 0 }]; // 2 vertices
    broken.zones[1].id = broken.zones[2].id; // duplicate id
    broken.graph.edges.push({ from: 'nope', to: 'also-nope', widthM: -1 });
    broken.calibration.defaultStrideM = 0;

    const result = validateBlueprint(broken);
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(5);
    expect(result.errors.join('\n')).toMatch(/polygon/);
    expect(result.errors.join('\n')).toMatch(/duplicate zone id/);
    expect(result.errors.join('\n')).toMatch(/unknown node/);
    expect(result.errors.join('\n')).toMatch(/defaultStrideM/);
  });

  it('warns about zones the geofence hysteresis would make untriggerable', () => {
    const bp = makeTestBlueprint() as any;
    bp.zones[0].polygon = [
      { x: 0, y: 0 },
      { x: 0.6, y: 0 },
      { x: 0.6, y: 0.6 },
      { x: 0, y: 0.6 },
    ]; // 0.6 m square vs 0.5 m hysteresis
    const result = validateBlueprint(bp);
    expect(result.ok).toBe(true); // a warning, not an error
    expect(result.warnings.join('\n')).toMatch(/untriggerable/);
  });

  it('rejects fingerprints whose energies do not form a distribution', () => {
    const bp = makeTestBlueprint() as any;
    bp.zones[0].fingerprint.energies = bp.zones[0].fingerprint.energies.map((e: number) => e * 2);
    const result = validateBlueprint(bp);
    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toMatch(/sum to 1/);
  });
});
