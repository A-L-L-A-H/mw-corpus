import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { Q4Q_REFERENCE_MANIFEST, createCorpusServer } from '../src/index.js';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

describe('zero-dependency Bun HTTP + MCP citation server', () => {
  let server: ReturnType<typeof createCorpusServer>;
  let baseUrl: string;

  beforeAll(() => {
    server = createCorpusServer({
      port: 0,
      hostname: '127.0.0.1',
      rootDirectory: repositoryRoot,
    });
    baseUrl = `http://127.0.0.1:${server.port}`;
  });

  afterAll(() => {
    server.stop(true);
  });

  it('serves GET /health with verified corpus counts and 8 epistemic layers', async () => {
    const response = await fetch(`${baseUrl}/health`);
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      status: string;
      service: string;
      epistemicLayers: number;
      asmaulHusnaCount: number;
      indexedPassages: { total: number; quran: number; textualWitness: number };
    };
    expect(body.status).toBe('ok');
    expect(body.service).toBe('mw-corpus');
    expect(body.epistemicLayers).toBe(8);
    expect(body.asmaulHusnaCount).toBe(99);
    expect(body.indexedPassages).toEqual({ total: 2, quran: 1, textualWitness: 1 });
  });

  it('serves GET /api/passages with SHA-256 verified Qur’an and textual witness slices', async () => {
    const allRes = await fetch(`${baseUrl}/api/passages`);
    expect(allRes.status).toBe(200);
    const allBody = (await allRes.json()) as {
      count: number;
      passages: Array<{ kind: string; locator: string; epistemicLayer: string; sha256: string }>;
    };
    expect(allBody.count).toBe(2);
    expect(allBody.passages.map((item) => item.locator).sort()).toEqual(['Genesis 1:1', 'Q7:46']);

    const quranRes = await fetch(`${baseUrl}/api/passages?kind=quran&locator=Q7:46`);
    expect(quranRes.status).toBe(200);
    const quranBody = (await quranRes.json()) as {
      count: number;
      passages: Array<{ epistemicLayer: string; sha256: string }>;
    };
    expect(quranBody.count).toBe(1);
    expect(quranBody.passages[0]?.epistemicLayer).toBe('source_text');
    expect(quranBody.passages[0]?.sha256).toBe(
      '6ff83b01099fb7992b5f7fa101cfab3d6556607ca6b1fe69d53cb76f97027760'
    );
  });

  it('serves GET /api/asmaul-husna by ordinal, cluster, and bilingual search', async () => {
    const fullRes = await fetch(`${baseUrl}/api/asmaul-husna`);
    expect(fullRes.status).toBe(200);
    const fullBody = (await fullRes.json()) as { count: number; entries: unknown[] };
    expect(fullBody.count).toBe(99);

    const singleRes = await fetch(`${baseUrl}/api/asmaul-husna?ordinal=1&related=true`);
    expect(singleRes.status).toBe(200);
    const singleBody = (await singleRes.json()) as {
      entries: Array<{ transliteration: string }>;
      related: Array<{ ordinal: number }>;
    };
    expect(singleBody.entries[0]?.transliteration).toBe('Ar-Rahman');
    expect(singleBody.related.map((entry) => entry.ordinal)).toContain(2);

    const searchRes = await fetch(`${baseUrl}/api/asmaul-husna?q=Pengasih`);
    expect(searchRes.status).toBe(200);
    const searchBody = (await searchRes.json()) as { entries: Array<{ ordinal: number }> };
    expect(searchBody.entries.some((entry) => entry.ordinal === 1)).toBe(true);
  });

  it('serves GET /api/epistemic-layers with all 8 layers, CAN-0011..0014, and Q4Q metadata', async () => {
    const response = await fetch(`${baseUrl}/api/epistemic-layers`);
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      layerCount: number;
      canonRules: Array<{ id: string }>;
      q4q: { format: string; revelationIdentities: unknown[] };
    };
    expect(body.layerCount).toBe(8);
    expect(body.canonRules.map((rule) => rule.id)).toEqual([
      'CAN-0011',
      'CAN-0012',
      'CAN-0013',
      'CAN-0014',
    ]);
    expect(body.q4q.format).toBe('moonwitness-q4q/v1');
    expect(body.q4q.revelationIdentities).toHaveLength(4);
  });

  it('validates epistemic and Q4Q records via POST /api/validate-record', async () => {
    const validRes = await fetch(`${baseUrl}/api/validate-record`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        id: 'mw:record:api-valid-reflection',
        epistemicLayer: 'personal_reflection',
        originActor: 'user_original',
        content: 'Personal gratitude note separated from scripture.',
        provenance: { authorRef: 'urn:owner:bjo163' },
      }),
    });
    expect(validRes.status).toBe(200);
    expect(((await validRes.json()) as { valid: boolean }).valid).toBe(true);

    const invalidRes = await fetch(`${baseUrl}/api/validate-record`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        id: 'mw:record:unlabeled',
        originActor: 'ai_assistant',
        content: 'Missing epistemicLayer and collapsed.',
      }),
    });
    expect(invalidRes.status).toBe(422);
    const invalidBody = (await invalidRes.json()) as {
      valid: boolean;
      canonChecks: Record<string, string>;
    };
    expect(invalidBody.valid).toBe(false);
    expect(invalidBody.canonChecks['CAN-0014']).toBe('fail');

    const q4qRes = await fetch(`${baseUrl}/api/validate-record`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(Q4Q_REFERENCE_MANIFEST),
    });
    expect(q4qRes.status).toBe(200);
    const q4qBody = (await q4qRes.json()) as { kind: string; valid: boolean };
    expect(q4qBody).toMatchObject({ kind: 'q4q_mapping', valid: true });
  });

  it('handles JSON-RPC 2.0 MCP methods and all 3 citation tools via POST /api/mcp', async () => {
    const listRes = await fetch(`${baseUrl}/api/mcp`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    });
    expect(listRes.status).toBe(200);
    const listBody = (await listRes.json()) as {
      result: { tools: Array<{ name: string }> };
    };
    expect(listBody.result.tools.map((tool) => tool.name)).toEqual([
      'corpus_search_passages',
      'corpus_get_asmaul_husna',
      'corpus_validate_epistemic',
    ]);

    const searchRes = await fetch(`${baseUrl}/api/mcp`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: { name: 'corpus_search_passages', arguments: { query: 'Genesis' } },
      }),
    });
    const searchBody = (await searchRes.json()) as {
      result: { structuredContent: { count: number; passages: Array<{ locator: string }> } };
    };
    expect(searchBody.result.structuredContent.count).toBe(1);
    expect(searchBody.result.structuredContent.passages[0]?.locator).toBe('Genesis 1:1');

    const asmaRes = await fetch(`${baseUrl}/api/mcp`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'corpus_get_asmaul_husna',
          arguments: { ordinal: 93, includeRelated: true },
        },
      }),
    });
    const asmaBody = (await asmaRes.json()) as {
      result: { structuredContent: { entries: Array<{ transliteration: string }> } };
    };
    expect(asmaBody.result.structuredContent.entries[0]?.transliteration).toBe('An-Nur');

    const validateRes = await fetch(`${baseUrl}/api/mcp`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: {
          name: 'corpus_validate_epistemic',
          arguments: {
            record: {
              id: 'mw:record:mcp-collapsed',
              epistemicLayer: 'tafsir',
              aiGenerated: true,
              originActor: 'ai_assistant',
              content: 'AI output mislabeled as tafsir',
              provenance: { author: 'AI', tradition: 'None', edition: 'v1' },
            },
          },
        },
      }),
    });
    const validateBody = (await validateRes.json()) as {
      result: { isError: boolean; structuredContent: { valid: boolean } };
    };
    expect(validateBody.result.isError).toBe(true);
    expect(validateBody.result.structuredContent.valid).toBe(false);
  });

  it('returns clean 404 and 405 responses for unknown routes or wrong HTTP verbs', async () => {
    const notFound = await fetch(`${baseUrl}/api/unknown`);
    expect(notFound.status).toBe(404);
    const wrongMethod = await fetch(`${baseUrl}/health`, { method: 'POST' });
    expect(wrongMethod.status).toBe(405);
  });
});
