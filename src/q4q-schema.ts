import q4qMappingSchema from '../schemas/q4q-mapping.schema.json' with { type: 'json' };
import type { EpistemicLayer } from './epistemic-layers.js';
import {
  createJsonSchemaValidator,
  isRecord,
  type JsonSchemaContract,
  type KnowledgeValidationIssue,
  type KnowledgeValidationResult,
} from './knowledge-core.js';

export const Q4Q_FORMAT = 'moonwitness-q4q/v1' as const;
export const Q4Q_SCHEMA_VERSION = 1 as const;

export const Q4Q_KITAB_KEYS = ['taurat', 'zabur', 'injil', 'quran'] as const;
export type Q4QKitab = (typeof Q4Q_KITAB_KEYS)[number];

export type Q4QRevelationIdentityId =
  | 'mw:work:taurat-revelation'
  | 'mw:work:zabur-revelation'
  | 'mw:work:injil-revelation'
  | 'mw:work:quran-revelation';

export const Q4Q_EVIDENCE_CLASSES = [
  'Q_EXPLICIT',
  'Q_CROSS',
  'TRADITION',
  'CREED',
  'SYNTHESIS',
  'HYPOTHESIS',
] as const;

export type Q4QEvidenceClass = (typeof Q4Q_EVIDENCE_CLASSES)[number];

export interface Q4QRevelationIdentityDescriptor {
  readonly kitab: Q4QKitab;
  readonly revelationIdentityId: Q4QRevelationIdentityId;
  readonly identityClass: 'RevelationIdentity';
  readonly label: string;
  readonly tradition: 'islamic';
  readonly witnessEquivalencePolicy: 'never_inferred';
}

export const Q4Q_REVELATION_IDENTITIES: readonly Q4QRevelationIdentityDescriptor[] = Object.freeze([
  Object.freeze({
    kitab: 'taurat',
    revelationIdentityId: 'mw:work:taurat-revelation',
    identityClass: 'RevelationIdentity',
    label: 'Taurat',
    tradition: 'islamic',
    witnessEquivalencePolicy: 'never_inferred',
  }),
  Object.freeze({
    kitab: 'zabur',
    revelationIdentityId: 'mw:work:zabur-revelation',
    identityClass: 'RevelationIdentity',
    label: 'Zabur',
    tradition: 'islamic',
    witnessEquivalencePolicy: 'never_inferred',
  }),
  Object.freeze({
    kitab: 'injil',
    revelationIdentityId: 'mw:work:injil-revelation',
    identityClass: 'RevelationIdentity',
    label: 'Injil',
    tradition: 'islamic',
    witnessEquivalencePolicy: 'never_inferred',
  }),
  Object.freeze({
    kitab: 'quran',
    revelationIdentityId: 'mw:work:quran-revelation',
    identityClass: 'RevelationIdentity',
    label: 'Qur’an',
    tradition: 'islamic',
    witnessEquivalencePolicy: 'never_inferred',
  }),
]);

export interface Q4QEvidenceClassDescriptor {
  readonly code: Q4QEvidenceClass;
  readonly description: string;
  readonly allowedEpistemicLayers: readonly EpistemicLayer[];
}

export const Q4Q_EVIDENCE_CLASS_DESCRIPTORS: readonly Q4QEvidenceClassDescriptor[] = Object.freeze([
  Object.freeze({
    code: 'Q_EXPLICIT',
    description: 'Direct explicit Qur’anic passage citation grounded in pinned source text.',
    allowedEpistemicLayers: Object.freeze(['source_text', 'textual_witness', 'translation'] as const),
  }),
  Object.freeze({
    code: 'Q_CROSS',
    description: 'Cross-passage Qur’anic comparative link grounded in verified text and analysis.',
    allowedEpistemicLayers: Object.freeze([
      'source_text',
      'textual_witness',
      'translation',
      'tafsir',
      'historical_context',
    ] as const),
  }),
  Object.freeze({
    code: 'TRADITION',
    description: 'Comparative witness or exegetical note attributed to a documented scholarly tradition.',
    allowedEpistemicLayers: Object.freeze([
      'textual_witness',
      'translation',
      'tafsir',
      'historical_context',
    ] as const),
  }),
  Object.freeze({
    code: 'CREED',
    description: 'Tradition-scoped creedal or theological position, distinct from raw source text.',
    allowedEpistemicLayers: Object.freeze([
      'tafsir',
      'historical_context',
      'personal_reflection',
    ] as const),
  }),
  Object.freeze({
    code: 'SYNTHESIS',
    description:
      'Analytical comparative synthesis across textual witnesses; explicitly separated from revelation identity.',
    allowedEpistemicLayers: Object.freeze([
      'historical_context',
      'personal_reflection',
      'creative_metaphor',
      'ai_hypothesis',
    ] as const),
  }),
  Object.freeze({
    code: 'HYPOTHESIS',
    description: 'Exploratory comparative hypothesis requiring independent scholarly review.',
    allowedEpistemicLayers: Object.freeze([
      'historical_context',
      'personal_reflection',
      'creative_metaphor',
      'ai_hypothesis',
    ] as const),
  }),
]);

export interface Q4QPolicy {
  readonly inferIdentityEquivalence: false;
  readonly canonImpliesRevelationIdentity: false;
  readonly quranSupervisoryCriterion: boolean;
}

export interface Q4QComparativeWitnessEntry {
  readonly entryId: `mw:q4q-entry:${string}`;
  readonly kitab: Q4QKitab;
  /**
   * Explicit named revelation identity referenced for comparison, OR null when a surviving
   * textual witness edition (e.g. WEBP) intentionally asserts no revelation identity link.
   */
  readonly revelationIdentityId: Q4QRevelationIdentityId | null;
  readonly witnessExpressionId: `mw:expression:${string}`;
  readonly editionId: `mw:edition:${string}`;
  readonly sourceArtifactId?: `mw:artifact:${string}`;
  readonly locator: string;
  readonly traditionCanon?: string;
  readonly evidenceClass: Q4QEvidenceClass;
  readonly epistemicLayer: EpistemicLayer;
  /** Must always be false: surviving textual witness editions are never conflated with revelation identity. */
  readonly equatesWitnessToRevelation: false;
  readonly evidenceIds: readonly string[];
  readonly analyticalNotes?: string;
}

export interface Q4QMappingDocument {
  readonly format: typeof Q4Q_FORMAT;
  readonly schemaVersion: typeof Q4Q_SCHEMA_VERSION;
  readonly mappingId: `mw:q4q:${string}`;
  readonly title: string;
  readonly createdAt?: string;
  readonly policy: Q4QPolicy;
  readonly entries: readonly Q4QComparativeWitnessEntry[];
}

const REVELATION_BY_KITAB = new Map<Q4QKitab, Q4QRevelationIdentityId>(
  Q4Q_REVELATION_IDENTITIES.map((item) => [item.kitab, item.revelationIdentityId])
);
const ALLOWED_LAYERS_BY_EVIDENCE = new Map<Q4QEvidenceClass, readonly EpistemicLayer[]>(
  Q4Q_EVIDENCE_CLASS_DESCRIPTORS.map((item) => [item.code, item.allowedEpistemicLayers])
);

const validateSchema = createJsonSchemaValidator(
  q4qMappingSchema as unknown as JsonSchemaContract,
  'does not match the Q4Q 4-Kitab comparative witness mapping contract'
);

export function getExpectedRevelationIdentityId(kitab: Q4QKitab): Q4QRevelationIdentityId {
  const id = REVELATION_BY_KITAB.get(kitab);
  if (!id) throw new TypeError(`Unknown Q4Q kitab: ${String(kitab)}`);
  return id;
}

function validateSemanticInvariants(value: unknown): KnowledgeValidationIssue[] {
  if (!isRecord(value) || !Array.isArray(value.entries)) return [];
  const issues: KnowledgeValidationIssue[] = [];
  const seenEntryIds = new Set<string>();

  for (const [index, entry] of value.entries.entries()) {
    if (!isRecord(entry)) continue;
    const base = `/entries/${index}`;

    if (typeof entry.entryId === 'string') {
      if (seenEntryIds.has(entry.entryId)) {
        issues.push({
          path: `${base}/entryId`,
          keyword: 'unique',
          message: `Duplicate Q4Q entryId: ${entry.entryId}`,
        });
      }
      seenEntryIds.add(entry.entryId);
    }

    // Separate witness editions from revelation identities strictly.
    if (
      typeof entry.witnessExpressionId === 'string' &&
      typeof entry.editionId === 'string' &&
      entry.witnessExpressionId === entry.editionId
    ) {
      issues.push({
        path: `${base}/editionId`,
        keyword: 'separation',
        message: 'witnessExpressionId and editionId must remain distinct identities',
      });
    }

    const kitab = entry.kitab as Q4QKitab | undefined;
    if (kitab && REVELATION_BY_KITAB.has(kitab)) {
      const expectedRevId = REVELATION_BY_KITAB.get(kitab);
      if (
        entry.revelationIdentityId !== null &&
        entry.revelationIdentityId !== undefined &&
        entry.revelationIdentityId !== expectedRevId
      ) {
        issues.push({
          path: `${base}/revelationIdentityId`,
          keyword: 'revelationBinding',
          message: `kitab "${kitab}" may only bind to "${expectedRevId}" or null (unmapped witness edition)`,
        });
      }
      // Q_EXPLICIT and Q_CROSS apply strictly to Qur'anic references.
      if (
        (entry.evidenceClass === 'Q_EXPLICIT' || entry.evidenceClass === 'Q_CROSS') &&
        kitab !== 'quran'
      ) {
        issues.push({
          path: `${base}/evidenceClass`,
          keyword: 'evidenceClass',
          message: `evidenceClass "${String(entry.evidenceClass)}" is reserved for kitab "quran" references`,
        });
      }
    }

    const evidenceClass = entry.evidenceClass as Q4QEvidenceClass | undefined;
    const epistemicLayer = entry.epistemicLayer as EpistemicLayer | undefined;
    if (evidenceClass && epistemicLayer) {
      const allowed = ALLOWED_LAYERS_BY_EVIDENCE.get(evidenceClass);
      if (allowed && !allowed.includes(epistemicLayer)) {
        issues.push({
          path: `${base}/epistemicLayer`,
          keyword: 'epistemicCoherence',
          message: `evidenceClass "${evidenceClass}" is incompatible with epistemicLayer "${epistemicLayer}" (allowed: ${allowed.join(', ')})`,
        });
      }
    }
  }

  return issues;
}

/** Validate a versioned Q4Q 4-Kitab comparative witness mapping document. */
export function validateQ4QMapping(value: unknown): KnowledgeValidationResult {
  const structural = validateSchema(value);
  const semantic = validateSemanticInvariants(value);
  const issues = [...(structural.valid ? [] : structural.issues), ...semantic];
  return issues.length === 0 ? { valid: true, issues: [] } : { valid: false, issues };
}

export function assertQ4QMapping(value: unknown): Q4QMappingDocument {
  const result = validateQ4QMapping(value);
  if (!result.valid) {
    const details = result.issues.map((issue) => `${issue.path} ${issue.message}`).join('; ');
    throw new TypeError(`Q4Q mapping validation failed: ${details}`);
  }
  return value as Q4QMappingDocument;
}

export function createQ4QMappingDocument(input: {
  mappingId: `mw:q4q:${string}`;
  title: string;
  createdAt?: string;
  quranSupervisoryCriterion?: boolean;
  entries: readonly Q4QComparativeWitnessEntry[];
}): Q4QMappingDocument {
  const doc: Q4QMappingDocument = {
    format: Q4Q_FORMAT,
    schemaVersion: Q4Q_SCHEMA_VERSION,
    mappingId: input.mappingId,
    title: input.title,
    ...(input.createdAt ? { createdAt: input.createdAt } : {}),
    policy: {
      inferIdentityEquivalence: false,
      canonImpliesRevelationIdentity: false,
      quranSupervisoryCriterion: input.quranSupervisoryCriterion ?? true,
    },
    entries: [...input.entries],
  };
  return assertQ4QMapping(doc);
}

/** Reference non-equating Q4Q comparative manifest anchored to the checked-in corpus fixtures. */
export const Q4Q_REFERENCE_MANIFEST: Q4QMappingDocument = Object.freeze(
  createQ4QMappingDocument({
    mappingId: 'mw:q4q:reference-witness-anchor-v1',
    title: 'MoonWitness Reference Q4Q Comparative Witness Anchor (Non-Equating)',
    createdAt: '2026-10-16T00:00:00.000Z',
    quranSupervisoryCriterion: true,
    entries: [
      {
        entryId: 'mw:q4q-entry:quran-tanzil-q7-46',
        kitab: 'quran',
        revelationIdentityId: 'mw:work:quran-revelation',
        witnessExpressionId: 'mw:expression:tanzil-quran-uthmani',
        editionId: 'mw:edition:tanzil-quran-text-v1.1-uthmani-txt2',
        sourceArtifactId: 'mw:artifact:tanzil-quran-uthmani-q7-46',
        locator: 'Q7:46',
        traditionCanon: 'islamic-uthmani',
        evidenceClass: 'Q_EXPLICIT',
        epistemicLayer: 'source_text',
        equatesWitnessToRevelation: false,
        evidenceIds: ['mw:evidence:tanzil-q7-46-source-manifest'],
        analyticalNotes:
          'Verbatim Tanzil v1.1 Uthmani source line Q7:46; edition identity remains distinct from RevelationIdentity.',
      },
      {
        entryId: 'mw:q4q-entry:webp-genesis-1-1-witness',
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
        evidenceIds: ['mw:evidence:ebible-webp-edition-source'],
        analyticalNotes:
          'Public-domain WEBP 2020 English witness sample; intentionally leaves revelationIdentityId null to prevent equating a modern translation edition with original Taurat revelation.',
      },
    ],
  })
);

export { q4qMappingSchema };
