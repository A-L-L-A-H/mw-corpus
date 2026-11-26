import { describe, expect, it } from 'bun:test';
import {
  Q4Q_EVIDENCE_CLASSES,
  Q4Q_FORMAT,
  Q4Q_KITAB_KEYS,
  Q4Q_REFERENCE_MANIFEST,
  Q4Q_REVELATION_IDENTITIES,
  assertQ4QMapping,
  createQ4QMappingDocument,
  getExpectedRevelationIdentityId,
  validateQ4QMapping,
} from '../src/index.js';

describe('versioned Q4Q 4-Kitab comparative witness schema', () => {
  it('registers all 4 revelation identities and all 6 explicit evidence classes', () => {
    expect(Q4Q_KITAB_KEYS).toEqual(['taurat', 'zabur', 'injil', 'quran']);
    expect(Q4Q_REVELATION_IDENTITIES.map((item) => item.revelationIdentityId)).toEqual([
      'mw:work:taurat-revelation',
      'mw:work:zabur-revelation',
      'mw:work:injil-revelation',
      'mw:work:quran-revelation',
    ]);
    expect(Q4Q_EVIDENCE_CLASSES).toEqual([
      'Q_EXPLICIT',
      'Q_CROSS',
      'TRADITION',
      'CREED',
      'SYNTHESIS',
      'HYPOTHESIS',
    ]);
    expect(getExpectedRevelationIdentityId('zabur')).toBe('mw:work:zabur-revelation');
    expect(validateQ4QMapping(Q4Q_REFERENCE_MANIFEST)).toEqual({ valid: true, issues: [] });
  });

  it('validates a complete 4-Kitab comparative document across all evidence classes', () => {
    const document = createQ4QMappingDocument({
      mappingId: 'mw:q4q:four-kitab-comparative-v1',
      title: 'Comparative 4-Kitab Witness Anchor (Synthetic)',
      createdAt: '2026-11-26T00:00:00.000Z',
      entries: [
        {
          entryId: 'mw:q4q-entry:quran-explicit',
          kitab: 'quran',
          revelationIdentityId: 'mw:work:quran-revelation',
          witnessExpressionId: 'mw:expression:tanzil-quran-uthmani',
          editionId: 'mw:edition:tanzil-quran-text-v1.1-uthmani-txt2',
          locator: 'Q7:46',
          evidenceClass: 'Q_EXPLICIT',
          epistemicLayer: 'source_text',
          equatesWitnessToRevelation: false,
          evidenceIds: ['mw:evidence:tanzil-q7-46'],
        },
        {
          entryId: 'mw:q4q-entry:quran-cross',
          kitab: 'quran',
          revelationIdentityId: 'mw:work:quran-revelation',
          witnessExpressionId: 'mw:expression:tanzil-quran-uthmani',
          editionId: 'mw:edition:tanzil-quran-text-v1.1-uthmani-txt2',
          locator: 'Q5:48',
          evidenceClass: 'Q_CROSS',
          epistemicLayer: 'tafsir',
          equatesWitnessToRevelation: false,
          evidenceIds: ['mw:evidence:q5-48-cross'],
        },
        {
          entryId: 'mw:q4q-entry:taurat-witness',
          kitab: 'taurat',
          revelationIdentityId: null,
          witnessExpressionId: 'mw:expression:webp-protestant',
          editionId: 'mw:edition:webp-protestant-2020-stable',
          sourceArtifactId: 'mw:artifact:webp-protestant-genesis-1-1',
          locator: 'Genesis 1:1',
          traditionCanon: 'protestant-66',
          evidenceClass: 'TRADITION',
          epistemicLayer: 'textual_witness',
          equatesWitnessToRevelation: false,
          evidenceIds: ['mw:evidence:ebible-webp'],
        },
        {
          entryId: 'mw:q4q-entry:zabur-creed',
          kitab: 'zabur',
          revelationIdentityId: 'mw:work:zabur-revelation',
          witnessExpressionId: 'mw:expression:psalms-masoretic-ref',
          editionId: 'mw:edition:psalms-masoretic-sample',
          locator: 'Psalm 23:1',
          traditionCanon: 'masoretic',
          evidenceClass: 'CREED',
          epistemicLayer: 'historical_context',
          equatesWitnessToRevelation: false,
          evidenceIds: ['mw:evidence:zabur-tradition-note'],
        },
        {
          entryId: 'mw:q4q-entry:injil-hypothesis',
          kitab: 'injil',
          revelationIdentityId: null,
          witnessExpressionId: 'mw:expression:gospel-witness-sample',
          editionId: 'mw:edition:gospel-witness-sample-v1',
          locator: 'Matthew 5:3',
          traditionCanon: 'new-testament-27',
          evidenceClass: 'HYPOTHESIS',
          epistemicLayer: 'ai_hypothesis',
          equatesWitnessToRevelation: false,
          evidenceIds: ['mw:evidence:comparative-draft-1'],
        },
      ],
    });

    expect(document.format).toBe(Q4Q_FORMAT);
    expect(document.entries).toHaveLength(5);
    expect(assertQ4QMapping(document)).toEqual(document);
  });

  it('forbids equating surviving witness editions to original revelation identities', () => {
    const collapsedEquivalence = {
      ...Q4Q_REFERENCE_MANIFEST,
      policy: {
        inferIdentityEquivalence: true,
        canonImpliesRevelationIdentity: true,
        quranSupervisoryCriterion: true,
      },
      entries: [
        {
          ...Q4Q_REFERENCE_MANIFEST.entries[1]!,
          equatesWitnessToRevelation: true,
        },
      ],
    };

    const result = validateQ4QMapping(collapsedEquivalence);
    expect(result.valid).toBe(false);
    const paths = result.issues.map((issue) => issue.path);
    expect(paths).toContain('/policy/inferIdentityEquivalence');
    expect(paths).toContain('/policy/canonImpliesRevelationIdentity');
    expect(paths).toContain('/entries/0/equatesWitnessToRevelation');
  });

  it('rejects mismatched kitab/revelation binding and incompatible evidenceClass/epistemicLayer', () => {
    const invalidMapping = {
      ...Q4Q_REFERENCE_MANIFEST,
      entries: [
        {
          ...Q4Q_REFERENCE_MANIFEST.entries[1]!,
          kitab: 'taurat',
          revelationIdentityId: 'mw:work:injil-revelation',
          evidenceClass: 'Q_EXPLICIT',
          epistemicLayer: 'creative_metaphor',
        },
      ],
    };

    const result = validateQ4QMapping(invalidMapping);
    expect(result.valid).toBe(false);
    const paths = result.issues.map((issue) => issue.path);
    expect(paths).toContain('/entries/0/revelationIdentityId');
    expect(paths).toContain('/entries/0/evidenceClass');
    expect(paths).toContain('/entries/0/epistemicLayer');
  });
});
