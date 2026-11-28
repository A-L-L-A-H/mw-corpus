import { describe, expect, test } from 'bun:test';
import { QdrantClient } from '../src/qdrant-client.js';
import {
  QURAN_SURAH_INDEX,
  computeDeterministicEmbedding,
  generateEpistemicSeedPoints,
  seedQdrantEpistemicCorpus,
} from '../src/qdrant-seed.js';

describe('V59 Qdrant 114-Surah & 99 Asmaul Husna seed generator', () => {
  test('contains complete 114-Surah canonical index with 6236 total ayahs', () => {
    expect(QURAN_SURAH_INDEX).toHaveLength(114);
    expect(QURAN_SURAH_INDEX[0]?.surahNumber).toBe(1);
    expect(QURAN_SURAH_INDEX[0]?.transliteration).toBe('Al-Fatihah');
    expect(QURAN_SURAH_INDEX[113]?.surahNumber).toBe(114);
    expect(QURAN_SURAH_INDEX[113]?.transliteration).toBe('An-Nas');

    const numbers = QURAN_SURAH_INDEX.map((s) => s.surahNumber);
    expect(numbers).toEqual(Array.from({ length: 114 }, (_, idx) => idx + 1));

    const totalAyahs = QURAN_SURAH_INDEX.reduce((sum, s) => sum + s.ayahCount, 0);
    expect(totalAyahs).toBe(6236);
  });

  test('computes deterministic unit-normalized embeddings offline', () => {
    const vecA = computeDeterministicEmbedding('Q1 Al-Fatihah The Opening', 16);
    const vecB = computeDeterministicEmbedding('Q1 Al-Fatihah The Opening', 16);
    const vecC = computeDeterministicEmbedding('AH:1 Ar-Rahman The Most Merciful', 16);

    expect(vecA).toHaveLength(16);
    expect(vecA).toEqual(vecB);
    expect(vecA).not.toEqual(vecC);

    const norm = Math.sqrt(vecA.reduce((acc, v) => acc + v * v, 0));
    expect(norm).toBeCloseTo(1.0, 4);
  });

  test('seeds 213 points (114 Surahs + 99 Asmaul Husna) into offline QdrantClient and retrieves nearest matches', async () => {
    const client = new QdrantClient();
    const points = generateEpistemicSeedPoints({ dimension: 16 });
    expect(points).toHaveLength(213);

    const report = await seedQdrantEpistemicCorpus({
      client,
      collection: 'mw-seed-test',
      dimension: 16,
    });

    expect(report.surahCount).toBe(114);
    expect(report.asmaulHusnaCount).toBe(99);
    expect(report.totalPoints).toBe(213);
    expect(report.merkleDigestSha256).toMatch(/^[a-f0-9]{64}$/);

    const fatihahPoint = report.points.find((p) => p.id === 'mw:surah:1');
    expect(fatihahPoint).toBeDefined();

    const searchSurah = await client.search('mw-seed-test', fatihahPoint!.vector, 3);
    expect(searchSurah[0]?.id).toBe('mw:surah:1');
    expect(searchSurah[0]?.payload?.locator).toBe('Q1');

    const rahmanPoint = report.points.find((p) => p.id === 'mw:asmaul-husna:1');
    expect(rahmanPoint).toBeDefined();
    const searchAsma = await client.search('mw-seed-test', rahmanPoint!.vector, 2);
    expect(searchAsma[0]?.id).toBe('mw:asmaul-husna:1');
    expect(searchAsma[0]?.payload?.locator).toBe('AH:1');
  });
});
