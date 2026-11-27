import { describe, expect, test } from 'bun:test';
import { ingestAcademic, type NormalizedRecord } from '../src/academic-ingestor.js';

describe('Academic ingestor', () => {
  test('ingest arxiv entry XML and ignore feed-level title', async () => {
    const fakeFetch = (async (url: string) => {
      if (url.includes('export.arxiv.org')) {
        return {
          ok: true,
          text: async () =>
            '<feed><title>ArXiv Query: id_list=1234.5678</title><entry><title>Test Title</title><summary>Test Abstract</summary></entry></feed>',
        } as unknown as Response;
      }
      throw new Error('Unexpected URL');
    }) as typeof fetch;

    const rec: NormalizedRecord = await ingestAcademic({
      source: 'arxiv',
      id: '1234.5678',
      fetch: fakeFetch,
    });
    expect(rec.id).toBe('1234.5678');
    expect(rec.title).toBe('Test Title');
    expect(rec.abstract).toBe('Test Abstract');
    expect(rec.sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  test('ingest openalex direct abstract and inverted index fallback', async () => {
    const directFetch = (async (url: string) => {
      expect(url).toBe('https://api.openalex.org/works/W123');
      return {
        ok: true,
        json: async () => ({
          title: 'OpenAlex Direct Title',
          abstract: 'Direct abstract text.',
        }),
      } as unknown as Response;
    }) as typeof fetch;

    const directRec = await ingestAcademic({
      source: 'openalex',
      id: 'W123',
      fetch: directFetch,
    });
    expect(directRec.id).toBe('W123');
    expect(directRec.title).toBe('OpenAlex Direct Title');
    expect(directRec.abstract).toBe('Direct abstract text.');
    expect(directRec.sha256).toMatch(/^[a-f0-9]{64}$/);

    const invertedFetch = (async () => ({
      ok: true,
      json: async () => ({
        title: 'Inverted Abstract Title',
        abstract_inverted_index: {
          Epistemic: [0],
          provenance: [1],
          matters: [2],
        },
      }),
    })) as unknown as fetch;

    const invertedRec = await ingestAcademic({
      source: 'openalex',
      id: 'W456',
      fetch: invertedFetch,
    });
    expect(invertedRec.title).toBe('Inverted Abstract Title');
    expect(invertedRec.abstract).toBe('Epistemic provenance matters');
  });

  test('throws when upstream HTTP response is not ok', async () => {
    const errorFetch = (async () =>
      new Response('Not Found', { status: 404 })) as typeof fetch;

    await expect(
      ingestAcademic({ source: 'openalex', id: 'W404', fetch: errorFetch }),
    ).rejects.toThrow('Academic JSON fetch failed with status 404');
  });
});
