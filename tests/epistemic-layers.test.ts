import { describe, expect, it } from 'bun:test';
import {
  CANON_PROVENANCE_RULES,
  EPISTEMIC_LAYERS,
  EPISTEMIC_LAYER_IDS,
  assertEpistemicRecord,
  getEpistemicLayer,
  isEpistemicLayer,
  validateEpistemicRecord,
  type EpistemicProvenanceRecord,
} from '../src/index.js';

const SAMPLE_SHA256 = '6ff83b01099fb7992b5f7fa101cfab3d6556607ca6b1fe69d53cb76f97027760';

function validRecordsByLayer(): readonly EpistemicProvenanceRecord[] {
  return [
    {
      id: 'mw:record:source-q7-46',
      epistemicLayer: 'source_text',
      originActor: 'scripture_source',
      content: 'وَبَيْنَهُمَا حِجَابٌ',
      provenance: {
        editionId: 'mw:edition:tanzil-quran-text-v1.1-uthmani-txt2',
        locator: 'Q7:46',
        sourceSha256: SAMPLE_SHA256,
        attribution: 'Tanzil Quran Text v1.1 Uthmani (CC BY 3.0)',
      },
    },
    {
      id: 'mw:record:witness-webp-gen-1-1',
      epistemicLayer: 'textual_witness',
      originActor: 'scripture_source',
      content: 'In the beginning, God created the heavens and the earth.',
      provenance: {
        expressionId: 'mw:expression:webp-protestant',
        editionId: 'mw:edition:webp-protestant-2020-stable',
        sourceArtifactId: 'mw:artifact:webp-protestant-genesis-1-1',
        locator: 'Genesis 1:1',
        attribution: 'World English Bible Protestant (2020 stable), eBible.org',
      },
    },
    {
      id: 'mw:record:translation-q7-46-en',
      epistemicLayer: 'translation',
      originActor: 'scholar',
      content: 'And between them will be a partition...',
      provenance: {
        sourceEditionId: 'mw:edition:tanzil-quran-text-v1.1-uthmani-txt2',
        translator: 'Synthetic Reference Translation',
        locale: 'en-US',
      },
    },
    {
      id: 'mw:record:tafsir-q7-46',
      epistemicLayer: 'tafsir',
      originActor: 'scholar',
      content: 'Classical commentary discussing the barrier between paradise and hellfire.',
      provenance: {
        author: 'Ibn Kathir',
        tradition: 'Sunni Classical Tafsir',
        edition: 'Tafsir al-Quran al-Azim (Dar Taybah)',
      },
    },
    {
      id: 'mw:record:historical-context-uthmani',
      epistemicLayer: 'historical_context',
      originActor: 'historian',
      content: 'Orthographic codification notes on early Hijazi and Uthmani manuscript traditions.',
      provenance: {
        sourceRefs: ['doi:10.1000/synthetic-manuscript-study'],
      },
    },
    {
      id: 'mw:record:reflection-boundary',
      epistemicLayer: 'personal_reflection',
      originActor: 'user_original',
      content: 'Personal reflection on accountability and inner boundaries.',
      provenance: {
        authorRef: 'urn:owner:bjo163',
      },
    },
    {
      id: 'mw:record:metaphor-crayon-rgbl',
      epistemicLayer: 'creative_metaphor',
      originActor: 'user_original',
      content: 'CRAYON RGBL four-layer conceptual teaching metaphor.',
      provenance: {
        authorRef: 'urn:owner:bjo163',
        frameworkName: 'CRAYON v1.3',
      },
    },
    {
      id: 'mw:record:ai-hypothesis-lexical',
      epistemicLayer: 'ai_hypothesis',
      originActor: 'ai_assistant',
      aiGenerated: true,
      content: 'Draft lexical segmentation hypothesis requiring human philological review.',
      provenance: {
        modelId: 'gemini-research-draft',
        reviewState: 'review_pending',
      },
    },
  ];
}

describe('8-layer epistemic separation & CAN-0011..0014 governance', () => {
  it('defines exactly 8 ordered epistemic layers and 4 locked canon provenance rules', () => {
    expect(EPISTEMIC_LAYER_IDS).toHaveLength(8);
    expect(EPISTEMIC_LAYERS).toHaveLength(8);
    expect(EPISTEMIC_LAYERS.map((item) => item.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(CANON_PROVENANCE_RULES.map((rule) => rule.id)).toEqual([
      'CAN-0011',
      'CAN-0012',
      'CAN-0013',
      'CAN-0014',
    ]);
    expect(isEpistemicLayer('source_text')).toBe(true);
    expect(isEpistemicLayer('unlabeled')).toBe(false);
    expect(getEpistemicLayer('ai_hypothesis').order).toBe(8);
  });

  it('accepts properly attributed records across all 8 epistemic layers', () => {
    for (const record of validRecordsByLayer()) {
      const result = validateEpistemicRecord(record);
      expect(result.valid).toBe(true);
      expect(result.layer).toBe(record.epistemicLayer);
      expect(result.canonChecks).toEqual({
        'CAN-0011': 'pass',
        'CAN-0012': 'pass',
        'CAN-0013': 'pass',
        'CAN-0014': 'pass',
      });
      expect(assertEpistemicRecord(record)).toEqual(record);
    }
  });

  it('rejects unlabeled records and collapsed multi-layer records (CAN-0014)', () => {
    const unlabeled = validateEpistemicRecord({
      id: 'mw:record:unlabeled',
      originActor: 'user_original',
      content: 'Unlabeled observation',
      provenance: { authorRef: 'urn:owner:bjo163' },
    });
    expect(unlabeled.valid).toBe(false);
    expect(unlabeled.layer).toBeNull();
    expect(unlabeled.canonChecks['CAN-0014']).toBe('fail');

    const compositeLabel = validateEpistemicRecord({
      id: 'mw:record:collapsed-string',
      epistemicLayer: 'source_text+tafsir',
      originActor: 'scholar',
      content: 'Collapsed scripture and commentary',
      provenance: { author: 'Scholar', tradition: 'Classical', edition: 'v1' },
    });
    expect(compositeLabel.valid).toBe(false);
    expect(compositeLabel.canonChecks['CAN-0014']).toBe('fail');

    const secondaryLayerField = validateEpistemicRecord({
      id: 'mw:record:collapsed-array',
      epistemicLayer: 'personal_reflection',
      collapsedLayers: ['source_text', 'personal_reflection'],
      originActor: 'user_original',
      content: 'Mixed layer attempt',
      provenance: { authorRef: 'urn:owner:bjo163' },
    });
    expect(secondaryLayerField.valid).toBe(false);
    expect(secondaryLayerField.canonChecks['CAN-0014']).toBe('fail');
  });

  it('enforces CAN-0011 against visual or anthropomorphic depiction of Allah', () => {
    const flagged = validateEpistemicRecord({
      id: 'mw:record:can11-flag',
      epistemicLayer: 'creative_metaphor',
      originActor: 'user_original',
      content: 'Visual character scene description.',
      provenance: { authorRef: 'urn:owner:bjo163' },
      claims: { depictsAllahVisually: true },
    });
    expect(flagged.valid).toBe(false);
    expect(flagged.canonChecks['CAN-0011']).toBe('fail');

    const textDepiction = validateEpistemicRecord({
      id: 'mw:record:can11-text',
      epistemicLayer: 'creative_metaphor',
      originActor: 'user_original',
      content: 'Prompt to depict Allah as a human character standing on a hill.',
      provenance: { authorRef: 'urn:owner:bjo163' },
    });
    expect(textDepiction.valid).toBe(false);
    expect(textDepiction.canonChecks['CAN-0011']).toBe('fail');
  });

  it('enforces CAN-0012 against silent canon rewrites or unpreserved revisions', () => {
    const silentRewrite = validateEpistemicRecord({
      id: 'mw:record:can12-silent',
      epistemicLayer: 'historical_context',
      originActor: 'editorial',
      content: 'Updated canon wording.',
      provenance: {
        sourceRef: 'docs/history.md',
        supersedes: 'mw:record:old-v1',
        silentOverwrite: true,
      },
    });
    expect(silentRewrite.valid).toBe(false);
    expect(silentRewrite.canonChecks['CAN-0012']).toBe('fail');

    const preservedRevision = validateEpistemicRecord({
      id: 'mw:record:can12-preserved',
      epistemicLayer: 'historical_context',
      originActor: 'editorial',
      content: 'Revision with preserved prior snapshot hash.',
      provenance: {
        sourceRef: 'docs/history.md',
        supersedes: 'mw:record:old-v1',
        previousVersionSha256: SAMPLE_SHA256,
      },
    });
    expect(preservedRevision.valid).toBe(true);
    expect(preservedRevision.canonChecks['CAN-0012']).toBe('pass');
  });

  it('enforces CAN-0013 separating AI-generated drafts from original user ideas and scripture', () => {
    const disguisedAi = validateEpistemicRecord({
      id: 'mw:record:can13-disguised-ai',
      epistemicLayer: 'personal_reflection',
      originActor: 'ai_assistant',
      aiGenerated: true,
      content: 'AI summary masquerading as personal reflection.',
      provenance: { authorRef: 'urn:owner:bjo163' },
    });
    expect(disguisedAi.valid).toBe(false);
    expect(disguisedAi.canonChecks['CAN-0013']).toBe('fail');

    const missingModel = validateEpistemicRecord({
      id: 'mw:record:can13-no-model',
      epistemicLayer: 'ai_hypothesis',
      originActor: 'ai_assistant',
      content: 'AI draft without model attribution.',
      provenance: { reviewState: 'unverified' },
    });
    expect(missingModel.valid).toBe(false);
    expect(missingModel.canonChecks['CAN-0013']).toBe('fail');
  });

  it('rejects non-scripture layers claiming scripture, tafsir, or canonical authority', () => {
    const metaphorAsScripture = validateEpistemicRecord({
      id: 'mw:record:metaphor-claim',
      epistemicLayer: 'creative_metaphor',
      originActor: 'user_original',
      content: 'Mnemonic framework',
      provenance: { frameworkName: 'GOD-PROMISE 1-6-3' },
      claims: { isScripture: true, canonicalAuthority: true, isScientificFact: true },
    });
    expect(metaphorAsScripture.valid).toBe(false);
    expect(metaphorAsScripture.canonChecks['CAN-0014']).toBe('fail');
    expect(() => assertEpistemicRecord(metaphorAsScripture)).toThrow(
      /Epistemic record validation failed/
    );
  });
});
