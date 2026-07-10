/**
 * Seed a venue with placeholder narration tones so the tourist runtime is
 * demonstrable before real audio content exists.
 *
 *   npx tsx scripts/generate-placeholder-tones.ts demo
 *
 * Writes venues/<id>/audio/<zone>.<lang>.wav for every zone × venue
 * language, and rewrites the blueprint's audio refs to point at them with
 * the honest placeholder title. Validates the blueprint before writing it
 * back. Real narration uploaded later through the admin UI simply replaces
 * these slot by slot.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { validateBlueprint } from '../src/engine/blueprint';
import type { FloorBlueprint } from '../src/engine/types';
import {
  PLACEHOLDER_TITLE,
  placeholderFilename,
  renderPlaceholderToneWav,
} from '../src/ui/audio/placeholderTone';

const venueId = process.argv[2] ?? 'demo';
const venueDir = join(process.env.VENUES_DIR ?? 'venues', venueId);

const raw = JSON.parse(await readFile(join(venueDir, 'blueprint.json'), 'utf8')) as FloorBlueprint;
await mkdir(join(venueDir, 'audio'), { recursive: true });

let files = 0;
raw.zones.forEach((zone, seed) => {
  for (const lang of raw.venue.languages) {
    const filename = placeholderFilename(zone.id, lang);
    const wav = renderPlaceholderToneWav({ zoneName: zone.name, language: lang, seed });
    void writeFile(join(venueDir, 'audio', filename), wav);
    zone.audio[lang] = { url: `audio/${filename}`, title: PLACEHOLDER_TITLE, durationSec: 2 };
    files++;
  }
});

const validation = validateBlueprint(raw);
if (!validation.ok) {
  console.error('Refusing to write an invalid blueprint:', validation.errors);
  process.exit(1);
}
await writeFile(join(venueDir, 'blueprint.json'), JSON.stringify(raw, null, 2) + '\n');
console.log(`Seeded ${files} placeholder tones for venue "${venueId}" and updated blueprint audio refs.`);
if (validation.warnings.length) console.log('Warnings:', validation.warnings);
