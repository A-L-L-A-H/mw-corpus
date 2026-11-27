import { describe, expect, test } from 'bun:test';
import { QdrantClient, type Point } from '../src/qdrant-client.js';

describe('QdrantClient offline mode', () => {
  test('upsert stores points and ranks cosine similarity', async () => {
    const client = new QdrantClient({ url: undefined });
    const points: Point[] = [
      { id: 'a', vector: [1, 0], payload: { text: 'alpha' } },
      { id: 'b', vector: [0, 1], payload: { text: 'beta' } },
      { id: 'c', vector: [0.5, 0.5], payload: { text: 'gamma' } },
    ];
    await client.upsert('test', points);
    const result = await client.search('test', [0.6, 0.4], 2);
    expect(result.map((p) => p.id)).toEqual(['c', 'a']);
  });

  test('isolates collections and replaces existing points by id', async () => {
    const client = new QdrantClient({});
    await client.upsert('col1', [{ id: 'x', vector: [1, 0] }]);
    await client.upsert('col1', [{ id: 'x', vector: [0, 1], payload: { updated: true } }]);
    await client.upsert('col2', [{ id: 'y', vector: [1, 0] }]);

    const col1Res = await client.search('col1', [0, 1], 5);
    expect(col1Res).toHaveLength(1);
    expect(col1Res[0].payload).toEqual({ updated: true });

    const missingCol = await client.search('nonexistent', [1, 0], 5);
    expect(missingCol).toEqual([]);
  });

  test('handles zero-norm query vectors and non-positive topK safely', async () => {
    const client = new QdrantClient({});
    await client.upsert('test', [{ id: 'a', vector: [1, 0] }]);

    const zeroQuery = await client.search('test', [0, 0], 1);
    expect(zeroQuery).toHaveLength(1);
    expect(zeroQuery[0].id).toBe('a');

    expect(await client.search('test', [1, 0], 0)).toEqual([]);
  });
});

describe('QdrantClient remote HTTP mode', () => {
  test('sends PUT upsert and POST search with API-KEY header', async () => {
    const calls: Array<{ url: string; method?: string; headers?: HeadersInit; body?: unknown }> = [];
    const fakeFetch: typeof fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      calls.push({ url, method: init?.method, headers: init?.headers, body: init?.body });
      if (init?.method === 'PUT') {
        return new Response(JSON.stringify({ status: 'ok' }), { status: 200 });
      }
      return new Response(
        JSON.stringify({ result: [{ id: 'r1', vector: [1, 0], payload: { src: 'remote' } }] }),
        { status: 200 },
      );
    }) as typeof fetch;

    const client = new QdrantClient({
      url: 'https://qdrant.example.local/',
      apiKey: 'secret-key',
      fetch: fakeFetch,
    });

    await client.upsert('docs', [{ id: 'r1', vector: [1, 0] }]);
    const found = await client.search('docs', [1, 0], 3);

    expect(calls).toHaveLength(2);
    expect(calls[0].url).toBe('https://qdrant.example.local/collections/docs/points?wait=true');
    expect(calls[0].method).toBe('PUT');
    expect((calls[0].headers as Record<string, string>)['API-KEY']).toBe('secret-key');
    expect(calls[1].url).toBe('https://qdrant.example.local/collections/docs/points/search');
    expect(calls[1].method).toBe('POST');
    expect(found).toHaveLength(1);
    expect(found[0].id).toBe('r1');
  });

  test('throws on non-ok HTTP responses for upsert and search', async () => {
    const failingFetch: typeof fetch = (async () =>
      new Response('Bad Gateway', { status: 502 })) as typeof fetch;

    const client = new QdrantClient({ url: 'https://qdrant.example.local', fetch: failingFetch });

    await expect(client.upsert('docs', [{ id: '1', vector: [1, 0] }])).rejects.toThrow(
      'Qdrant upsert failed with status 502',
    );
    await expect(client.search('docs', [1, 0], 2)).rejects.toThrow(
      'Qdrant search failed with status 502',
    );
  });
});
