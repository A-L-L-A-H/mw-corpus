import { createHash } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'bun:test';

import {
  ASMAUL_HUSNA_DATASET,
  CANON_PROVENANCE_RULES,
  EPISTEMIC_LAYER_IDS,
  activateDatasetRelease,
  canonicalizeJson,
  createDatasetRelease,
  createPrivateArchiveImportManifest,
  getAsmaulHusnaByOrdinal,
  getEpistemicLayer,
  hashCanonicalJson,
  importQuranPassage,
  putRawArtifact,
  readActiveDatasetRelease,
  readDatasetRelease,
  readQuranPassage,
  readRawArtifact,
  readTextualWitnessPassage,
  safeRelativePath,
  searchAsmaulHusna,
  sha256Hex,
  trySafeRelativePath,
  validatePrivateArchiveImportManifest,
} from '../src/index.js';

describe('@moonwitness/epistemic-sdk', () => {
  describe('path-safety', () => {
    it('accepts valid relative POSIX paths', () => {
      const normalized = safeRelativePath('corpus/manifests/index.json', 'manifestPath');
      expect(normalized).toBe(path.join('corpus', 'manifests', 'index.json'));
      expect(trySafeRelativePath('a/b/c.txt')).toBe(path.join('a', 'b', 'c.txt'));
    });

    it('rejects traversal, absolute, backslash, drive-letter, and null-byte paths', () => {
      const unsafePaths = [
        '',
        '/etc/passwd',
        '../secret.txt',
        'a/../b.txt',
        './local.txt',
        'a//b.txt',
        'a\\b.txt',
        'C:/Windows/System32',
        'a/b\0.txt',
      ];
      for (const candidate of unsafePaths) {
        expect(trySafeRelativePath(candidate)).toBeNull();
        expect(() => safeRelativePath(candidate, 'targetPath')).toThrow(TypeError);
      }
    });
  });

  describe('raw-artifact-store', () => {
    it('stores and reads verified artifacts idempotently', async () => {
      const storeDirectory = await mkdtemp(path.join(tmpdir(), 'mw-epistemic-sdk-'));
      try {
        const payload = new TextEncoder().encode('canonical-epistemic-artifact');
        const digest = createHash('sha256').update(payload).digest('hex');

        const first = await putRawArtifact({ storeDirectory, sha256: digest, bytes: payload });
        expect(first.created).toBe(true);
        expect(first.sha256).toBe(digest);
        expect(first.bytes).toBe(payload.byteLength);

        const second = await putRawArtifact({ storeDirectory, sha256: digest, bytes: payload });
        expect(second.created).toBe(false);

        const readBack = await readRawArtifact({ storeDirectory, sha256: digest });
        expect(Buffer.from(readBack).toString('utf8')).toBe('canonical-epistemic-artifact');
      } finally {
        await rm(storeDirectory, { recursive: true, force: true });
      }
    });

    it('rejects checksum mismatch on putRawArtifact', async () => {
      const storeDirectory = await mkdtemp(path.join(tmpdir(), 'mw-epistemic-sdk-mismatch-'));
      try {
        const payload = new TextEncoder().encode('tampered-bytes');
        const wrongSha = '0'.repeat(64);
        await expect(
          putRawArtifact({ storeDirectory, sha256: wrongSha, bytes: payload })
        ).rejects.toThrow(TypeError);
      } finally {
        await rm(storeDirectory, { recursive: true, force: true });
      }
    });
  });

  describe('asmaul-husna and provenance exports', () => {
    it('exposes canonical 99 Asmaul Husna dataset and search helpers', () => {
      expect(ASMAUL_HUSNA_DATASET.length).toBe(99);
      const first = getAsmaulHusnaByOrdinal(1);
      expect(first?.ordinal).toBe(1);
      expect(searchAsmaulHusna('Rahman').length).toBeGreaterThan(0);
    });

    it('exposes epistemic layers and deterministic canonical JSON hashing', () => {
      expect(EPISTEMIC_LAYER_IDS.length).toBeGreaterThan(0);
      expect(CANON_PROVENANCE_RULES.length).toBeGreaterThan(0);
      const firstLayer = getEpistemicLayer(EPISTEMIC_LAYER_IDS[0]);
      expect(firstLayer.id).toBe(EPISTEMIC_LAYER_IDS[0]);

      const a = canonicalizeJson({ b: 2, a: 1 });
      const b = canonicalizeJson({ a: 1, b: 2 });
      expect(a).toBe(b);
      expect(hashCanonicalJson({ a: 1, b: 2 })).toBe(sha256Hex(a));
    });

    it('exports passage, dataset-release, and private-archive-manifest APIs', () => {
      expect(typeof importQuranPassage).toBe('function');
      expect(typeof readQuranPassage).toBe('function');
      expect(typeof readTextualWitnessPassage).toBe('function');
      expect(typeof createDatasetRelease).toBe('function');
      expect(typeof readDatasetRelease).toBe('function');
      expect(typeof activateDatasetRelease).toBe('function');
      expect(typeof readActiveDatasetRelease).toBe('function');
      expect(typeof createPrivateArchiveImportManifest).toBe('function');
      expect(typeof validatePrivateArchiveImportManifest).toBe('function');
    });
  });
});
