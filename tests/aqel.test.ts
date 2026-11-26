import { describe, expect, test } from 'bun:test';
import path from 'node:path';
import {
  AQEL_ENGINE_NAME,
  analyzeArabicText,
  extractRootCandidate,
  normalizeArabic,
  tokenizeArabicWords,
} from '../src/aqel.js';
import { handleCorpusRequest } from '../src/server.js';

const ROOT_DIR = path.resolve(import.meta.dir, '..');
const Q47_35_UTHMANI =
  'فَلَا تَهِنُوا وَتَدْعُوا إِلَى السَّلْمِ وَأَنتُمُ الْأَعْلَوْنَ وَاللَّهُ مَعَكُمْ وَلَن يَتِرَكُمْ أَعْمَالَكُمْ';

describe('AQEL Arabic-first morphological & lexical segmentation engine', () => {
  test('normalizeArabic normalizes alef forms, alef maqsura, optional ta marbuta, and tashkeel while preserving original', () => {
    const uthmani = 'إِلَىٰ أَحْمَدَ آتَىٰ رَحْمَةً';
    const stripped = normalizeArabic(uthmani, true);
    expect(stripped).toBe('الي احمد اتي رحمة');

    const withTaMarbuta = normalizeArabic(uthmani, {
      stripTashkeel: true,
      normalizeTaMarbuta: true,
    });
    expect(withTaMarbuta).toBe('الي احمد اتي رحمه');

    const preservedTashkeel = normalizeArabic(uthmani, false);
    expect(preservedTashkeel).toContain('\u064E');
    expect(uthmani).toBe('إِلَىٰ أَحْمَدَ آتَىٰ رَحْمَةً');
  });

  test('tokenizeArabicWords segments Q47:35 with exact offsets and detects و / إلى / لا / لن particles', () => {
    const tokens = tokenizeArabicWords(Q47_35_UTHMANI);
    expect(tokens.length).toBeGreaterThanOrEqual(11);

    for (const token of tokens) {
      expect(Q47_35_UTHMANI.slice(token.start, token.end)).toBe(token.original);
    }

    const analysis = analyzeArabicText(Q47_35_UTHMANI);
    expect(analysis.original).toBe(Q47_35_UTHMANI);
    expect(analysis.tokenCount).toBe(tokens.length);
    expect(analysis.particleSummary.distinctParticles).toContain('و');
    expect(analysis.particleSummary.distinctParticles).toContain('إلى');
    expect(analysis.particleSummary.distinctParticles).toContain('لا');
    expect(analysis.particleSummary.distinctParticles).toContain('لن');
    expect(analysis.provenanceNote).toContain('computational_candidate');
    expect(analysis.provenanceNote).toContain('authoritativeTafsir: false');
  });

  test('tokenizeArabicWords detects full Arabic functional particle set reproducibly', () => {
    const phrase = 'وَمِنْ فِي عَلَى عَن مَا أَن لَا لَن إِلَى';
    const analysis = analyzeArabicText(phrase);
    const expected = ['و', 'من', 'في', 'على', 'عن', 'ما', 'أن', 'لا', 'لن', 'إلى'];
    for (const particle of expected) {
      expect(analysis.particleSummary.distinctParticles).toContain(particle);
    }
  });

  test('extractRootCandidate produces deterministic 3-letter root candidates stamped computational_candidate', () => {
    const first = extractRootCandidate('السَّلْمِ');
    const second = extractRootCandidate('السَّلْمِ');
    expect(first).toEqual(second);
    expect(first.rootCandidate).toBe('سلم');
    expect(first.letters).toEqual(['س', 'ل', 'م']);
    expect(first.classification).toBe('computational_candidate');
    expect(first.authoritativeTafsir).toBe(false);

    const kitaba = extractRootCandidate('الْمَكْتُوبُونَ');
    expect(kitaba.rootCandidate.length).toBe(3);
    expect(kitaba.classification).toBe('computational_candidate');
    expect(kitaba.authoritativeTafsir).toBe(false);
  });

  test('POST /api/aqel/analyze and MCP tool corpus_aqel_analyze return structured AQEL analysis', async () => {
    const context = { rootDirectory: ROOT_DIR, port: 4420 };

    const httpResponse = await handleCorpusRequest(
      new Request('http://127.0.0.1:4420/api/aqel/analyze', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: Q47_35_UTHMANI }),
      }),
      context
    );
    expect(httpResponse.status).toBe(200);
    const httpBody = (await httpResponse.json()) as {
      engine: string;
      original: string;
      tokenCount: number;
      particleSummary: { distinctParticles: string[] };
    };
    expect(httpBody.engine).toBe(AQEL_ENGINE_NAME);
    expect(httpBody.original).toBe(Q47_35_UTHMANI);
    expect(httpBody.tokenCount).toBeGreaterThanOrEqual(11);
    expect(httpBody.particleSummary.distinctParticles).toContain('إلى');

    const badResponse = await handleCorpusRequest(
      new Request('http://127.0.0.1:4420/api/aqel/analyze', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: '   ' }),
      }),
      context
    );
    expect(badResponse.status).toBe(400);

    const mcpResponse = await handleCorpusRequest(
      new Request('http://127.0.0.1:4420/api/mcp', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 77,
          method: 'tools/call',
          params: {
            name: 'corpus_aqel_analyze',
            arguments: { text: Q47_35_UTHMANI },
          },
        }),
      }),
      context
    );
    expect(mcpResponse.status).toBe(200);
    const mcpBody = (await mcpResponse.json()) as {
      result: {
        isError: boolean;
        structuredContent: {
          engine: string;
          original: string;
          particleSummary: { distinctParticles: string[] };
        };
      };
    };
    expect(mcpBody.result.isError).toBe(false);
    expect(mcpBody.result.structuredContent.engine).toBe(AQEL_ENGINE_NAME);
    expect(mcpBody.result.structuredContent.original).toBe(Q47_35_UTHMANI);
    expect(mcpBody.result.structuredContent.particleSummary.distinctParticles).toContain('لن');
  });
});
