/**
 * Client for the venue server (src/server) — the only backend. The Next app
 * never stores content itself; a venue is a directory behind this API.
 */
import { validateBlueprint } from '../engine/blueprint';
import type { FloorBlueprint } from '../engine/types';

export const VENUE_API = process.env.NEXT_PUBLIC_VENUE_API ?? 'http://localhost:4000';

export class VenueApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly details?: string[],
  ) {
    super(message);
  }
}

async function parseError(res: Response, fallback: string): Promise<VenueApiError> {
  try {
    const body = await res.json();
    return new VenueApiError(body.error ?? fallback, res.status, body.errors);
  } catch {
    return new VenueApiError(fallback, res.status);
  }
}

/** Fetch and structurally validate a venue's floor blueprint. */
export async function fetchBlueprint(venueId: string): Promise<FloorBlueprint> {
  let res: Response;
  try {
    res = await fetch(`${VENUE_API}/venues/${venueId}/blueprint.json`, { cache: 'no-store' });
  } catch {
    throw new VenueApiError(
      `Could not reach the venue server at ${VENUE_API}. Is it running? (npm run server)`,
    );
  }
  if (!res.ok) throw await parseError(res, `No blueprint for venue "${venueId}".`);
  const json = await res.json();
  const validation = validateBlueprint(json);
  if (!validation.ok) {
    throw new VenueApiError(
      `Venue "${venueId}" has an invalid blueprint — fix it in the admin tool before guiding visitors.`,
      res.status,
      validation.errors,
    );
  }
  return json as FloorBlueprint;
}

/** Save a blueprint (admin). The caller is responsible for validating first. */
export async function saveBlueprint(venueId: string, blueprint: FloorBlueprint): Promise<{ warnings: string[] }> {
  const res = await fetch(`${VENUE_API}/venues/${venueId}/blueprint.json`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(blueprint, null, 2),
  });
  if (!res.ok) throw await parseError(res, 'Saving the blueprint failed.');
  const body = await res.json();
  return { warnings: body.warnings ?? [] };
}

/** Upload one audio file into the venue's audio directory. Returns the blueprint-relative URL. */
export async function uploadAudio(
  venueId: string,
  filename: string,
  data: Blob | Uint8Array,
): Promise<{ url: string }> {
  const body: BodyInit = data instanceof Blob ? data : new Blob([data.buffer as ArrayBuffer]);
  const res = await fetch(`${VENUE_API}/venues/${venueId}/audio/${encodeURIComponent(filename)}`, {
    method: 'PUT',
    body,
  });
  if (!res.ok) throw await parseError(res, `Uploading "${filename}" failed.`);
  return res.json();
}

/** Resolve a blueprint-relative audio URL ("audio/x.wav") to an absolute one. */
export function audioUrl(venueId: string, relativeUrl: string): string {
  if (/^https?:\/\//.test(relativeUrl)) return relativeUrl;
  return `${VENUE_API}/venues/${venueId}/${relativeUrl}`;
}
