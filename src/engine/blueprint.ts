import { distanceToPolygonBoundary, polygonCentroid } from './geometry';
import { DEFAULT_GEOFENCE_CONFIG } from './geofence';
import type { FloorBlueprint, Point } from './types';

export interface BlueprintValidation {
  ok: boolean;
  errors: string[];
  /** Non-fatal issues worth showing in the admin tool. */
  warnings: string[];
}

function isFinitePoint(p: unknown): p is Point {
  return (
    typeof p === 'object' &&
    p !== null &&
    Number.isFinite((p as Point).x) &&
    Number.isFinite((p as Point).y)
  );
}

/**
 * Structural validation of a floor blueprint. Returns every problem found
 * (not just the first) so the admin tool can show a complete fix-list.
 */
export function validateBlueprint(input: unknown): BlueprintValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const fail = (): BlueprintValidation => ({ ok: false, errors, warnings });

  if (typeof input !== 'object' || input === null) {
    errors.push('Blueprint must be a JSON object.');
    return fail();
  }
  const bp = input as Partial<FloorBlueprint>;

  if (bp.schemaVersion !== 1) errors.push(`schemaVersion must be 1 (got ${JSON.stringify(bp.schemaVersion)}).`);

  if (!bp.venue || typeof bp.venue.id !== 'string' || !bp.venue.id) errors.push('venue.id is required.');
  if (!bp.venue || typeof bp.venue.name !== 'string' || !bp.venue.name) errors.push('venue.name is required.');
  if (!bp.venue || !Array.isArray(bp.venue.languages) || bp.venue.languages.length === 0) {
    errors.push('venue.languages must be a non-empty array.');
  }
  if (!bp.venue || typeof bp.venue.defaultLanguage !== 'string') {
    errors.push('venue.defaultLanguage is required.');
  } else if (Array.isArray(bp.venue.languages) && !bp.venue.languages.includes(bp.venue.defaultLanguage)) {
    errors.push(`venue.defaultLanguage "${bp.venue.defaultLanguage}" is not in venue.languages.`);
  }

  if (!bp.entry || !isFinitePoint(bp.entry.position)) errors.push('entry.position must be a finite {x, y}.');

  const hysteresis = bp.calibration?.geofence?.hysteresisM ?? DEFAULT_GEOFENCE_CONFIG.hysteresisM;

  if (!Array.isArray(bp.zones) || bp.zones.length === 0) {
    errors.push('zones must be a non-empty array.');
  } else {
    const ids = new Set<string>();
    bp.zones.forEach((z, i) => {
      const where = `zones[${i}]`;
      if (!z || typeof z.id !== 'string' || !z.id) {
        errors.push(`${where}.id is required.`);
        return;
      }
      if (ids.has(z.id)) errors.push(`${where}: duplicate zone id "${z.id}".`);
      ids.add(z.id);
      if (typeof z.name !== 'string' || !z.name) errors.push(`${where}.name is required.`);
      if (!Array.isArray(z.polygon) || z.polygon.length < 3 || !z.polygon.every(isFinitePoint)) {
        errors.push(`${where}.polygon must have >= 3 finite {x, y} vertices.`);
      } else {
        // A zone the hysteresis margin makes untriggerable is an admin mistake worth flagging.
        const depthAtCentroid = distanceToPolygonBoundary(polygonCentroid(z.polygon), z.polygon);
        if (depthAtCentroid < hysteresis) {
          warnings.push(
            `${where} ("${z.id}"): polygon is so small (max interior depth ~${depthAtCentroid.toFixed(2)} m) ` +
              `that the ${hysteresis} m geofence hysteresis may make it untriggerable.`,
          );
        }
      }
      if (typeof z.audio !== 'object' || z.audio === null) {
        errors.push(`${where}.audio must be an object mapping language -> audio asset.`);
      } else if (bp.venue?.defaultLanguage && !z.audio[bp.venue.defaultLanguage]) {
        warnings.push(`${where} ("${z.id}"): no narration for default language "${bp.venue.defaultLanguage}".`);
      }
      if (z.fingerprint) {
        const fp = z.fingerprint;
        if (fp.method !== 'band-energy-v1') errors.push(`${where}.fingerprint.method must be "band-energy-v1".`);
        if (!Array.isArray(fp.energies) || fp.energies.length !== fp.bandCount) {
          errors.push(`${where}.fingerprint.energies length must equal bandCount.`);
        } else {
          const sum = fp.energies.reduce((s, e) => s + e, 0);
          if (Math.abs(sum - 1) > 1e-3) {
            errors.push(`${where}.fingerprint.energies must sum to 1 (got ${sum.toFixed(4)}).`);
          }
        }
      }
    });
  }

  if (!bp.graph || !Array.isArray(bp.graph.nodes) || !Array.isArray(bp.graph.edges)) {
    errors.push('graph.nodes and graph.edges arrays are required.');
  } else {
    const nodeIds = new Set<string>();
    bp.graph.nodes.forEach((n, i) => {
      if (!n || typeof n.id !== 'string' || !n.id) errors.push(`graph.nodes[${i}].id is required.`);
      else {
        if (nodeIds.has(n.id)) errors.push(`graph.nodes[${i}]: duplicate node id "${n.id}".`);
        nodeIds.add(n.id);
      }
      if (!isFinitePoint(n)) errors.push(`graph.nodes[${i}] must have finite x, y.`);
    });
    if (bp.graph.edges.length === 0) errors.push('graph.edges must be non-empty — nothing would be walkable.');
    bp.graph.edges.forEach((e, i) => {
      if (!e || !nodeIds.has(e.from)) errors.push(`graph.edges[${i}].from references unknown node "${e?.from}".`);
      if (!e || !nodeIds.has(e.to)) errors.push(`graph.edges[${i}].to references unknown node "${e?.to}".`);
      if (!e || !Number.isFinite(e.widthM) || e.widthM <= 0) {
        errors.push(`graph.edges[${i}].widthM must be a positive number.`);
      }
    });
  }

  if (!bp.calibration || !Number.isFinite(bp.calibration.headingOffsetDeg)) {
    errors.push('calibration.headingOffsetDeg is required (compass bearing of the map +Y axis).');
  }
  if (!bp.calibration || !Number.isFinite(bp.calibration.defaultStrideM) || bp.calibration.defaultStrideM <= 0) {
    errors.push('calibration.defaultStrideM must be a positive number.');
  }

  return { ok: errors.length === 0, errors, warnings };
}
