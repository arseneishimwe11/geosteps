import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import { createServer } from '../src/server/server';
import { makeTestBlueprint } from './fixtures';

let server: Server;
let base: string;
let dir: string;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'geosteps-venues-'));
  await mkdir(join(dir, 'museum-x', 'audio'), { recursive: true });
  await writeFile(join(dir, 'museum-x', 'blueprint.json'), JSON.stringify(makeTestBlueprint()));
  await writeFile(join(dir, 'museum-x', 'audio', 'zone-a.en.mp3'), Buffer.from([0x49, 0x44, 0x33]));
  server = createServer(dir);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

describe('blueprint server', () => {
  it('serves health', async () => {
    const res = await fetch(`${base}/health`);
    expect(res.status).toBe(200);
  });

  it('serves a venue blueprint with CORS headers', async () => {
    const res = await fetch(`${base}/venues/museum-x/blueprint.json`);
    expect(res.status).toBe(200);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    const bp = await res.json();
    expect(bp.venue.id).toBe('test-museum');
  });

  it('404s unknown venues', async () => {
    expect((await fetch(`${base}/venues/nope/blueprint.json`)).status).toBe(404);
  });

  it('rejects an invalid blueprint on PUT with the validation errors', async () => {
    const res = await fetch(`${base}/venues/museum-y/blueprint.json`, {
      method: 'PUT',
      body: JSON.stringify({ schemaVersion: 2 }),
    });
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.errors.length).toBeGreaterThan(0);
  });

  it('accepts a valid blueprint on PUT and serves it back', async () => {
    const bp = makeTestBlueprint();
    const put = await fetch(`${base}/venues/museum-y/blueprint.json`, {
      method: 'PUT',
      body: JSON.stringify(bp),
    });
    expect(put.status).toBe(200);
    const got = await fetch(`${base}/venues/museum-y/blueprint.json`);
    expect(got.status).toBe(200);
    expect((await got.json()).venue.id).toBe('test-museum');
  });

  it('serves audio files with the right content type', async () => {
    const res = await fetch(`${base}/venues/museum-x/audio/zone-a.en.mp3`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('audio/mpeg');
  });

  it('blocks path traversal and junk ids', async () => {
    expect((await fetch(`${base}/venues/museum-x/audio/..%2Fblueprint.json`)).status).toBe(400);
    expect((await fetch(`${base}/venues/..%2F..%2Fetc/blueprint.json`)).status).toBe(400);
  });
});
