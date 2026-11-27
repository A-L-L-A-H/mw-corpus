import { describe, expect, test } from 'bun:test';
import {
  buildFrontierPaperDigest,
  ingestAcademic,
  ingestDailyFrontierDigest,
  normalizeAcademicWhitespace,
  normalizeDoi,
  normalizeTitleForDeduplication,
  type NormalizedRecord,
} from '../src/academic-ingestor.js';

describe('Academic ingestor & V60 daily frontier paper digest', () => {
  test('ingest arxiv entry XML and ignore feed-level title', async () => {
    const fakeFetch = (async (url: string) => {
      if (url.includes('export.arxiv.org')) {
        return {
          ok: true,
          text: async () =>
            '<feed><title>ArXiv Query: id_list=1234.5678</title><entry><title>Test Title</title><summary>Test Abstract</summary><published>2026-11-27T00:00:00Z</published><arxiv:doi>10.1000/ARXIV.1234</arxiv:doi><author><name>Ada Lovelace</name></author></entry></feed>',
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
    expect(rec.source).toBe('arxiv');
    expect(rec.title).toBe('Test Title');
    expect(rec.abstract).toBe('Test Abstract');
    expect(rec.doi).toBe('10.1000/arxiv.1234');
    expect(rec.publishedAt).toBe('2026-11-27');
    expect(rec.authors).toEqual(['Ada Lovelace']);
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
          doi: 'https://doi.org/10.5555/OA.123',
          publication_date: '2026-11-20',
          authorships: [{ author: { display_name: 'Ibn al-Haytham' } }],
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
    expect(directRec.doi).toBe('10.5555/oa.123');
    expect(directRec.publishedAt).toBe('2026-11-20');
    expect(directRec.authors).toEqual(['Ibn al-Haytham']);
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
    })) as unknown as typeof fetch;

    const invertedRec = await ingestAcademic({
      source: 'openalex',
      id: 'W456',
      fetch: invertedFetch,
    });
    expect(invertedRec.title).toBe('Inverted Abstract Title');
    expect(invertedRec.abstract).toBe('Epistemic provenance matters');
  });

  test('ingest crossref works metadata with JATS XML tags stripped and DOI normalized', async () => {
    const crossrefFetch = (async (url: string) => {
      expect(url).toContain('api.crossref.org/works/');
      return {
        ok: true,
        json: async () => ({
          message: {
            DOI: '10.1145/3333333.4444444',
            title: ['Deterministic   Provenance   Graphs'],
            abstract: '<jats:p>We formalize   non-normative   citation graphs.</jats:p>',
            published: { 'date-parts': [[2026, 11, 25]] },
            author: [{ given: 'Al', family: 'Khwarizmi' }],
          },
        }),
      } as unknown as Response;
    }) as typeof fetch;

    const crossrefRec = await ingestAcademic({
      source: 'crossref',
      id: 'https://doi.org/10.1145/3333333.4444444',
      fetch: crossrefFetch,
    });
    expect(crossrefRec.source).toBe('crossref');
    expect(crossrefRec.title).toBe('Deterministic Provenance Graphs');
    expect(crossrefRec.abstract).toBe('We formalize non-normative citation graphs.');
    expect(crossrefRec.doi).toBe('10.1145/3333333.4444444');
    expect(crossrefRec.publishedAt).toBe('2026-11-25');
    expect(crossrefRec.authors).toEqual(['Al Khwarizmi']);
  });

  test('normalizes DOIs, titles, and deduplicates multi-source frontier paper digest', async () => {
    expect(normalizeDoi('https://dx.doi.org/10.1000/XYZ-1')).toBe('10.1000/xyz-1');
    expect(normalizeAcademicWhitespace('<p>Hello   \n  World</p>')).toBe('Hello World');
    expect(normalizeTitleForDeduplication('Epistemic-Provenance: A New Frontier!')).toBe(
      'epistemic provenance a new frontier'
    );

    const report = buildFrontierPaperDigest(
      [
        {
          source: 'arxiv',
          id: '2611.00001',
          title: 'Epistemic Provenance: A New Frontier!',
          abstract: 'Short preprint abstract.',
          doi: 'https://doi.org/10.1000/FRONTIER.1',
          authors: ['Author A'],
        },
        {
          source: 'crossref',
          id: '10.1000/frontier.1',
          title: 'Epistemic Provenance - A New Frontier',
          abstract: '<jats:p>Expanded journal abstract with full verification details.</jats:p>',
          doi: '10.1000/FRONTIER.1',
          publishedAt: '2026-11-27',
          authors: ['Author A', 'Author B'],
        },
        {
          source: 'openalex',
          id: 'W999',
          title: 'epistemic provenance: a new frontier',
          abstract: 'Indexed OpenAlex abstract.',
          authors: ['Author C'],
        },
        {
          source: 'arxiv',
          id: '2611.00002',
          title: 'Disjoint Corpus Merkle Verification',
          abstract: 'Second independent paper.',
        },
      ],
      { digestDate: '2026-11-27' }
    );

    expect(report.digestDate).toBe('2026-11-27');
    expect(report.inputCount).toBe(4);
    expect(report.uniqueCount).toBe(2);
    expect(report.duplicateCount).toBe(2);
    expect(report.digestSha256).toMatch(/^[a-f0-9]{64}$/);

    const first = report.entries[0]!;
    expect(first.mergedSources).toEqual(['arxiv', 'crossref', 'openalex']);
    expect(first.sourceIds).toEqual([
      'arxiv:2611.00001',
      'crossref:10.1000/frontier.1',
      'openalex:W999',
    ]);
    expect(first.doi).toBe('10.1000/frontier.1');
    expect(first.abstract).toBe('Expanded journal abstract with full verification details.');
    expect(first.authors).toEqual(['Author A', 'Author B', 'Author C']);

    const multiFetch = (async (url: string) => {
      if (url.includes('export.arxiv.org')) {
        return new Response(
          '<feed><entry><title>Unified Quantum Witness</title><summary>Arxiv abstract</summary></entry></feed>',
          { status: 200 }
        );
      }
      if (url.includes('api.crossref.org')) {
        return new Response(
          JSON.stringify({
            message: {
              DOI: '10.1000/uqw.1',
              title: ['Unified Quantum Witness!'],
              abstract: 'Crossref long abstract for unified quantum witness.',
            },
          }),
          { status: 200 }
        );
      }
      return new Response(
        JSON.stringify({
          title: 'Unified Quantum Witness',
          abstract: 'OpenAlex summary',
          doi: 'https://doi.org/10.1000/uqw.1',
        }),
        { status: 200 }
      );
    }) as typeof fetch;

    const liveDigest = await ingestDailyFrontierDigest({
      digestDate: '2026-11-27',
      fetch: multiFetch,
      items: [
        { source: 'arxiv', id: '2611.11111' },
        { source: 'crossref', id: '10.1000/uqw.1' },
        { source: 'openalex', id: 'W777' },
      ],
    });
    expect(liveDigest.uniqueCount).toBe(1);
    expect(liveDigest.duplicateCount).toBe(2);
    expect(liveDigest.entries[0]?.mergedSources).toEqual(['arxiv', 'crossref', 'openalex']);
  });

  test('throws when upstream HTTP response is not ok', async () => {
    const errorFetch = (async () =>
      new Response('Not Found', { status: 404 })) as typeof fetch;

    await expect(
      ingestAcademic({ source: 'openalex', id: 'W404', fetch: errorFetch }),
    ).rejects.toThrow('Academic JSON fetch failed with status 404');
  });
});
