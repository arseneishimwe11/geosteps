/**
 * Venue blueprint + audio asset server.
 *
 * Deliberately tiny: one JSON document per venue on disk, plus its audio
 * files. No database, no framework — a regional museum's whole "backend" is
 * a directory. Routes:
 *
 *   GET  /health
 *   GET  /venues/:id/blueprint.json      -> the venue's floor blueprint
 *   PUT  /venues/:id/blueprint.json      -> replace it (validated first; admin tool)
 *   GET  /venues/:id/audio/:file         -> narration files
 *
 * Auth for the PUT route is intentionally out of scope for Phase A/B
 * (see HANDOFF.md) — do not expose this write path to the open internet as-is.
 */
import { createServer as createHttpServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { validateBlueprint } from '../engine/blueprint';

const VENUE_ID = /^[a-z0-9][a-z0-9-]*$/;
const AUDIO_FILE = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;
const MAX_BLUEPRINT_BYTES = 5 * 1024 * 1024;

const AUDIO_TYPES: Record<string, string> = {
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.ogg': 'audio/ogg',
  '.opus': 'audio/opus',
  '.wav': 'audio/wav',
};

function send(res: ServerResponse, status: number, body: string | Buffer, contentType: string): void {
  res.writeHead(status, {
    'content-type': contentType,
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, PUT, OPTIONS',
    'access-control-allow-headers': 'content-type',
  });
  res.end(body);
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  send(res, status, JSON.stringify(body, null, 2), 'application/json; charset=utf-8');
}

async function readBody(req: IncomingMessage, maxBytes: number): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    total += (chunk as Buffer).length;
    if (total > maxBytes) throw new Error(`Body exceeds ${maxBytes} bytes`);
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
}

export function createServer(venuesDir: string): Server {
  const root = resolve(venuesDir);

  return createHttpServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', 'http://localhost');
      const parts = url.pathname.split('/').filter(Boolean);

      if (req.method === 'OPTIONS') {
        send(res, 204, '', 'text/plain');
        return;
      }

      if (req.method === 'GET' && url.pathname === '/health') {
        sendJson(res, 200, { ok: true });
        return;
      }

      // /venues/:id/blueprint.json
      if (parts[0] === 'venues' && parts.length === 3 && parts[2] === 'blueprint.json') {
        const id = parts[1]!;
        if (!VENUE_ID.test(id)) {
          sendJson(res, 400, { error: 'Invalid venue id.' });
          return;
        }
        const path = join(root, id, 'blueprint.json');

        if (req.method === 'GET') {
          try {
            const data = await readFile(path);
            send(res, 200, data, 'application/json; charset=utf-8');
          } catch {
            sendJson(res, 404, { error: `No blueprint for venue "${id}".` });
          }
          return;
        }

        if (req.method === 'PUT') {
          let parsed: unknown;
          try {
            parsed = JSON.parse((await readBody(req, MAX_BLUEPRINT_BYTES)).toString('utf8'));
          } catch (e) {
            sendJson(res, 400, { error: `Body is not valid JSON: ${(e as Error).message}` });
            return;
          }
          const validation = validateBlueprint(parsed);
          if (!validation.ok) {
            sendJson(res, 422, { error: 'Blueprint failed validation.', ...validation });
            return;
          }
          await mkdir(join(root, id), { recursive: true });
          await writeFile(path, JSON.stringify(parsed, null, 2));
          sendJson(res, 200, { ok: true, warnings: validation.warnings });
          return;
        }
      }

      // /venues/:id/audio/:file
      if (req.method === 'GET' && parts[0] === 'venues' && parts.length === 4 && parts[2] === 'audio') {
        const id = parts[1]!;
        const file = parts[3]!;
        if (!VENUE_ID.test(id) || !AUDIO_FILE.test(file) || file.includes('..')) {
          sendJson(res, 400, { error: 'Invalid path.' });
          return;
        }
        const ext = file.slice(file.lastIndexOf('.'));
        const type = AUDIO_TYPES[ext];
        if (!type) {
          sendJson(res, 415, { error: `Unsupported audio type "${ext}".` });
          return;
        }
        try {
          const data = await readFile(join(root, id, 'audio', file));
          send(res, 200, data, type);
        } catch {
          sendJson(res, 404, { error: `No such audio file.` });
        }
        return;
      }

      sendJson(res, 404, { error: 'Not found.' });
    } catch (e) {
      sendJson(res, 500, { error: (e as Error).message });
    }
  });
}

// Run directly: `npm run server`
const isMain = process.argv[1] && resolve(process.argv[1]).includes('server');
if (isMain && process.env.VITEST === undefined) {
  const port = Number(process.env.PORT ?? 4000);
  const dir = process.env.VENUES_DIR ?? 'venues';
  createServer(dir).listen(port, () => {
    console.log(`[geosteps] serving venues from "${dir}" on http://localhost:${port}`);
  });
}
