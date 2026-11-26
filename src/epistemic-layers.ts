import { isRecord } from './knowledge-core.js';

export const EPISTEMIC_LAYER_IDS = [
  'source_text',
  'textual_witness',
  'translation',
  'tafsir',
  'historical_context',
  'personal_reflection',
  'creative_metaphor',
  'ai_hypothesis',
] as const;

export type EpistemicLayer = (typeof EPISTEMIC_LAYER_IDS)[number];

export type EpistemicOriginActor =
  | 'scripture_source'
  | 'scholar'
  | 'historian'
  | 'user_original'
  | 'ai_assistant'
  | 'editorial';

export type CanonProvenanceRuleId = 'CAN-0011' | 'CAN-0012' | 'CAN-0013' | 'CAN-0014';

export interface CanonProvenanceRule {
  readonly id: CanonProvenanceRuleId;
  readonly status: 'LOCKED';
  readonly domain: string;
  readonly rule: string;
}

export const CANON_PROVENANCE_RULES: readonly CanonProvenanceRule[] = Object.freeze([
  Object.freeze({
    id: 'CAN-0011',
    status: 'LOCKED',
    domain: 'Religious / visual boundary',
    rule: 'Do not depict Allah as a human, character, or visual object.',
  }),
  Object.freeze({
    id: 'CAN-0012',
    status: 'LOCKED',
    domain: 'Archive / canon governance',
    rule: 'Do not silently change canon, remove historical versions, or replace original wording without preserving the source.',
  }),
  Object.freeze({
    id: 'CAN-0013',
    status: 'LOCKED',
    domain: 'Archive / provenance',
    rule: 'Distinguish original user ideas from AI suggestions, drafts, proposals, and assumptions.',
  }),
  Object.freeze({
    id: 'CAN-0014',
    status: 'LOCKED',
    domain: 'Religious / editorial',
    rule: 'Distinguish scripture text, hadith, tafsir, translation, personal interpretation, metaphor, and creative concept.',
  }),
]);

export interface EpistemicLayerDefinition {
  readonly order: number;
  readonly id: EpistemicLayer;
  readonly title: string;
  readonly description: string;
  readonly allowedOriginActors: readonly EpistemicOriginActor[];
  readonly requiredProvenanceFields: readonly string[];
  readonly isPrimarySource: boolean;
}

export const EPISTEMIC_LAYERS: readonly EpistemicLayerDefinition[] = Object.freeze([
  Object.freeze({
    order: 1,
    id: 'source_text',
    title: 'Source Text',
    description:
      'Original source-language scripture text reproduced verbatim with pinned edition identity, locator, SHA-256 digest, and attribution.',
    allowedOriginActors: Object.freeze(['scripture_source'] as const),
    requiredProvenanceFields: Object.freeze(['editionId', 'locator', 'sourceSha256', 'attribution']),
    isPrimarySource: true,
  }),
  Object.freeze({
    order: 2,
    id: 'textual_witness',
    title: 'Textual Witness',
    description:
      'Surviving textual witness, expression, edition, and passage backed by a pinned source artifact without asserting automatic revelation equivalence.',
    allowedOriginActors: Object.freeze(['scripture_source', 'editorial'] as const),
    requiredProvenanceFields: Object.freeze([
      'expressionId',
      'editionId',
      'locator',
      'sourceArtifactId|sourceSha256',
      'attribution',
    ]),
    isPrimarySource: true,
  }),
  Object.freeze({
    order: 3,
    id: 'translation',
    title: 'Translation / Transliteration',
    description:
      'Target-language rendering or transliteration explicitly bound to a source edition, locale, and translator or edition attribution.',
    allowedOriginActors: Object.freeze(['scholar', 'editorial'] as const),
    requiredProvenanceFields: Object.freeze([
      'sourceEditionId|editionId',
      'translator|attribution',
      'locale',
    ]),
    isPrimarySource: false,
  }),
  Object.freeze({
    order: 4,
    id: 'tafsir',
    title: 'Tafsir / Scholarly Commentary',
    description:
      'Classical or scholarly exegesis explicitly attributed to a named author, tradition, and edition or source reference.',
    allowedOriginActors: Object.freeze(['scholar'] as const),
    requiredProvenanceFields: Object.freeze(['author', 'tradition', 'edition|sourceRef']),
    isPrimarySource: false,
  }),
  Object.freeze({
    order: 5,
    id: 'historical_context',
    title: 'Historical Context & Independent Research',
    description:
      'Historical, philological, transmission, or independent research context backed by explicit external citations.',
    allowedOriginActors: Object.freeze(['historian', 'scholar', 'editorial'] as const),
    requiredProvenanceFields: Object.freeze(['sourceRefs|sourceRef']),
    isPrimarySource: false,
  }),
  Object.freeze({
    order: 6,
    id: 'personal_reflection',
    title: 'Personal Reflection / Interpretation',
    description:
      'Owner or user personal reflection, devotional note, or interpretation strictly separated from scripture and scholarly tafsir.',
    allowedOriginActors: Object.freeze(['user_original', 'editorial'] as const),
    requiredProvenanceFields: Object.freeze(['authorRef']),
    isPrimarySource: false,
  }),
  Object.freeze({
    order: 7,
    id: 'creative_metaphor',
    title: 'Creative Metaphor / Conceptual Framework',
    description:
      'Symbolic metaphor, mnemonic, conceptual framework (such as RGBL or CRAYON), or creative narrative that must not be presented as scripture, tafsir, or empirical science.',
    allowedOriginActors: Object.freeze(['user_original', 'editorial'] as const),
    requiredProvenanceFields: Object.freeze(['authorRef|frameworkName']),
    isPrimarySource: false,
  }),
  Object.freeze({
    order: 8,
    id: 'ai_hypothesis',
    title: 'AI Hypothesis / Draft Summary',
    description:
      'AI-generated hypothesis, synthesis, draft, proposal, or assumption explicitly attributed to a model and marked for human verification.',
    allowedOriginActors: Object.freeze(['ai_assistant'] as const),
    requiredProvenanceFields: Object.freeze(['modelId', 'reviewState']),
    isPrimarySource: false,
  }),
]);

export interface EpistemicProvenanceMetadata {
  readonly editionId?: string;
  readonly sourceEditionId?: string;
  readonly expressionId?: string;
  readonly sourceArtifactId?: string;
  readonly locator?: string;
  readonly sourceSha256?: string;
  readonly previousVersionSha256?: string;
  readonly preservedSourceRef?: string;
  readonly attribution?: string;
  readonly translator?: string;
  readonly locale?: string;
  readonly author?: string;
  readonly authorRef?: string;
  readonly tradition?: string;
  readonly edition?: string;
  readonly sourceRef?: string;
  readonly sourceRefs?: readonly string[];
  readonly frameworkName?: string;
  readonly modelId?: string;
  readonly reviewState?: 'unverified' | 'review_pending' | 'human_reviewed' | 'rejected';
  readonly supersedes?: string;
  readonly revises?: string;
  readonly modifiedFromOriginal?: boolean;
  readonly silentOverwrite?: boolean;
  readonly dropsHistoricalVersion?: boolean;
}

export interface EpistemicClaimFlags {
  readonly isScripture?: boolean;
  readonly isTafsir?: boolean;
  readonly isScientificFact?: boolean;
  readonly canonicalAuthority?: boolean;
  readonly depictsAllahVisually?: boolean;
  readonly depictsDivineAsHuman?: boolean;
  readonly visualDepictionTarget?: string;
}

export interface EpistemicProvenanceRecord {
  readonly id: string;
  readonly epistemicLayer: EpistemicLayer;
  readonly originActor: EpistemicOriginActor;
  readonly content: string;
  readonly provenance: EpistemicProvenanceMetadata;
  readonly aiGenerated?: boolean;
  readonly claims?: EpistemicClaimFlags;
  readonly createdAt?: string;
}

export interface EpistemicValidationIssue {
  readonly rule: CanonProvenanceRuleId | 'SCHEMA';
  readonly path: string;
  readonly message: string;
}

export interface EpistemicValidationResult {
  readonly valid: boolean;
  readonly layer: EpistemicLayer | null;
  readonly canonChecks: Readonly<Record<CanonProvenanceRuleId, 'pass' | 'fail'>>;
  readonly issues: readonly EpistemicValidationIssue[];
}

const LAYER_SET = new Set<string>(EPISTEMIC_LAYER_IDS);
const LAYER_BY_ID = new Map<EpistemicLayer, EpistemicLayerDefinition>(
  EPISTEMIC_LAYERS.map((definition) => [definition.id, definition])
);
const ORIGIN_ACTORS = new Set<string>([
  'scripture_source',
  'scholar',
  'historian',
  'user_original',
  'ai_assistant',
  'editorial',
]);
const REVIEW_STATES = new Set<string>([
  'unverified',
  'review_pending',
  'human_reviewed',
  'rejected',
]);
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const EDITION_PATTERN = /^mw:edition:[a-z0-9][a-z0-9._-]{0,99}$/u;
const EXPRESSION_PATTERN = /^mw:expression:[a-z0-9][a-z0-9._-]{0,99}$/u;
const ARTIFACT_PATTERN = /^mw:artifact:[a-z0-9][a-z0-9._-]{0,99}$/u;
const ALLAH_VISUAL_DEPICTION_PATTERN =
  /\b(?:depict(?:s|ing|ed)?|draw(?:s|ing)?|render(?:s|ing)?|portray(?:s|ing|ed)?|illustrat(?:e|es|ing|ed)|visual(?:ly)?\s+represent(?:s|ing|ed)?)\s+(?:allah|god)\s+as\s+(?:a\s+)?(?:human|person|character|man|woman|figure|creature|statue|visual\s+object|object|avatar)\b/iu;

export function isEpistemicLayer(value: unknown): value is EpistemicLayer {
  return typeof value === 'string' && LAYER_SET.has(value);
}

export function getEpistemicLayer(layer: EpistemicLayer): EpistemicLayerDefinition {
  const definition = LAYER_BY_ID.get(layer);
  if (!definition) throw new TypeError(`Unknown epistemic layer: ${String(layer)}`);
  return definition;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isNonEmptyStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.every(isNonEmptyString);
}

/**
 * Validates an epistemic corpus record against the 8-Layer Epistemic Separation contract
 * and CAN-0011..0014 governance rules. Rejects unlabeled records, collapsed multi-layer
 * records, disguised AI content, silent canon rewrites, and divine visual depiction claims.
 */
export function validateEpistemicRecord(candidate: unknown): EpistemicValidationResult {
  const issues: EpistemicValidationIssue[] = [];
  const push = (rule: EpistemicValidationIssue['rule'], issuePath: string, message: string) => {
    issues.push({ rule, path: issuePath, message });
  };

  if (!isRecord(candidate)) {
    push('SCHEMA', '/', 'Epistemic record must be a JSON object');
    return buildResult(null, issues);
  }

  if (!isNonEmptyString(candidate.id)) {
    push('SCHEMA', '/id', 'Record id must be a non-empty string');
  }
  if (!isNonEmptyString(candidate.content)) {
    push('SCHEMA', '/content', 'Record content must be a non-empty string');
  }

  // Reject collapsed multi-layer structures explicitly under CAN-0014.
  for (const forbiddenCollapseKey of [
    'layers',
    'epistemicLayers',
    'secondaryLayers',
    'collapsedLayers',
    'mixedLayers',
  ]) {
    if (candidate[forbiddenCollapseKey] !== undefined) {
      push(
        'CAN-0014',
        `/${forbiddenCollapseKey}`,
        `Collapsed multi-layer field "${forbiddenCollapseKey}" is forbidden; split each epistemic layer into its own labeled record`
      );
    }
  }

  // Enforce explicit single epistemicLayer label (reject unlabeled or composite labels).
  const rawLayer = candidate.epistemicLayer;
  let layer: EpistemicLayer | null = null;
  if (Array.isArray(rawLayer)) {
    push(
      'CAN-0014',
      '/epistemicLayer',
      'epistemicLayer must be a single layer string, not an array of collapsed layers'
    );
  } else if (!isNonEmptyString(rawLayer)) {
    push(
      'CAN-0014',
      '/epistemicLayer',
      'Unlabeled record rejected: epistemicLayer is required and must name one of the 8 epistemic layers'
    );
  } else if (/[+,|/;]/u.test(rawLayer)) {
    push(
      'CAN-0014',
      '/epistemicLayer',
      `Collapsed layer label "${rawLayer}" is forbidden; assign exactly one epistemic layer`
    );
  } else if (!isEpistemicLayer(rawLayer)) {
    push(
      'CAN-0014',
      '/epistemicLayer',
      `Unknown epistemicLayer "${rawLayer}"; expected one of: ${EPISTEMIC_LAYER_IDS.join(', ')}`
    );
  } else {
    layer = rawLayer;
  }

  // CAN-0013: Explicit originActor separating user ideas from AI drafts/hypotheses.
  const rawOriginActor = candidate.originActor;
  let originActor: EpistemicOriginActor | null = null;
  if (!isNonEmptyString(rawOriginActor) || !ORIGIN_ACTORS.has(rawOriginActor)) {
    push(
      'CAN-0013',
      '/originActor',
      'originActor is required and must be one of: scripture_source, scholar, historian, user_original, ai_assistant, editorial'
    );
  } else {
    originActor = rawOriginActor as EpistemicOriginActor;
  }

  const aiGeneratedFlag = candidate.aiGenerated === true;
  if (candidate.aiGenerated !== undefined && typeof candidate.aiGenerated !== 'boolean') {
    push('CAN-0013', '/aiGenerated', 'aiGenerated must be a boolean when provided');
  }

  if ((aiGeneratedFlag || originActor === 'ai_assistant') && layer !== 'ai_hypothesis') {
    push(
      'CAN-0013',
      '/epistemicLayer',
      'AI-generated content or originActor "ai_assistant" must be classified exclusively under epistemicLayer "ai_hypothesis"'
    );
  }
  if (layer === 'ai_hypothesis' && originActor !== null && originActor !== 'ai_assistant') {
    push(
      'CAN-0013',
      '/originActor',
      'Records in epistemicLayer "ai_hypothesis" must declare originActor "ai_assistant"'
    );
  }

  if (layer !== null && originActor !== null) {
    const definition = getEpistemicLayer(layer);
    if (!definition.allowedOriginActors.includes(originActor)) {
      push(
        originActor === 'ai_assistant' ? 'CAN-0013' : 'CAN-0014',
        '/originActor',
        `originActor "${originActor}" is not permitted for epistemicLayer "${layer}" (allowed: ${definition.allowedOriginActors.join(', ')})`
      );
    }
  }

  // CAN-0011: Do not depict Allah as a human, character, or visual object.
  const claims = isRecord(candidate.claims) ? candidate.claims : undefined;
  if (candidate.claims !== undefined && !claims) {
    push('SCHEMA', '/claims', 'claims must be an object when provided');
  }
  if (
    candidate.depictsAllahVisually === true ||
    candidate.depictsDivineAsHuman === true ||
    claims?.depictsAllahVisually === true ||
    claims?.depictsDivineAsHuman === true
  ) {
    push(
      'CAN-0011',
      '/claims',
      'CAN-0011 violation: depicting Allah as a human, character, or visual object is strictly prohibited'
    );
  }
  const visualTarget =
    (typeof claims?.visualDepictionTarget === 'string' ? claims.visualDepictionTarget : undefined) ??
    (typeof candidate.visualDepictionTarget === 'string'
      ? candidate.visualDepictionTarget
      : undefined);
  if (visualTarget && /\b(?:allah|divine_essence|god_avatar)\b/iu.test(visualTarget)) {
    push(
      'CAN-0011',
      '/claims/visualDepictionTarget',
      'CAN-0011 violation: visualDepictionTarget cannot target Allah as a character or visual object'
    );
  }
  if (typeof candidate.content === 'string' && ALLAH_VISUAL_DEPICTION_PATTERN.test(candidate.content)) {
    push(
      'CAN-0011',
      '/content',
      'CAN-0011 violation: content asserts a prohibited visual, human, character, or object depiction of Allah'
    );
  }

  // Provenance object validation (CAN-0012, CAN-0013, CAN-0014)
  const provenance = isRecord(candidate.provenance) ? candidate.provenance : null;
  if (!provenance) {
    push(
      'CAN-0014',
      '/provenance',
      'provenance metadata object is required for every epistemic record'
    );
  } else {
    // CAN-0012: Preserve historical versions and original wording; reject silent overwrites.
    if (provenance.silentOverwrite === true) {
      push(
        'CAN-0012',
        '/provenance/silentOverwrite',
        'CAN-0012 violation: silent overwrites of canon or historical versions are forbidden'
      );
    }
    if (provenance.dropsHistoricalVersion === true) {
      push(
        'CAN-0012',
        '/provenance/dropsHistoricalVersion',
        'CAN-0012 violation: removing historical versions is forbidden'
      );
    }
    const isRevision =
      isNonEmptyString(provenance.supersedes) ||
      isNonEmptyString(provenance.revises) ||
      provenance.modifiedFromOriginal === true;
    if (isRevision) {
      const hasPreservedOriginal =
        isNonEmptyString(provenance.preservedSourceRef) ||
        (typeof provenance.previousVersionSha256 === 'string' &&
          SHA256_PATTERN.test(provenance.previousVersionSha256)) ||
        (typeof provenance.sourceSha256 === 'string' &&
          SHA256_PATTERN.test(provenance.sourceSha256));
      if (!hasPreservedOriginal) {
        push(
          'CAN-0012',
          '/provenance',
          'CAN-0012 violation: revising or superseding wording requires preservedSourceRef, previousVersionSha256, or sourceSha256 to preserve the original source'
        );
      }
    }
    if (
      provenance.sourceSha256 !== undefined &&
      (typeof provenance.sourceSha256 !== 'string' || !SHA256_PATTERN.test(provenance.sourceSha256))
    ) {
      push(
        'CAN-0012',
        '/provenance/sourceSha256',
        'sourceSha256 must be a 64-character lowercase hexadecimal SHA-256 digest'
      );
    }
    if (
      provenance.previousVersionSha256 !== undefined &&
      (typeof provenance.previousVersionSha256 !== 'string' ||
        !SHA256_PATTERN.test(provenance.previousVersionSha256))
    ) {
      push(
        'CAN-0012',
        '/provenance/previousVersionSha256',
        'previousVersionSha256 must be a 64-character lowercase hexadecimal SHA-256 digest'
      );
    }

    // Layer-specific provenance contracts (CAN-0014 & CAN-0013)
    if (layer === 'source_text') {
      if (typeof provenance.editionId !== 'string' || !EDITION_PATTERN.test(provenance.editionId)) {
        push(
          'CAN-0014',
          '/provenance/editionId',
          'source_text requires provenance.editionId matching mw:edition:<id>'
        );
      }
      if (!isNonEmptyString(provenance.locator)) {
        push('CAN-0014', '/provenance/locator', 'source_text requires provenance.locator');
      }
      if (
        typeof provenance.sourceSha256 !== 'string' ||
        !SHA256_PATTERN.test(provenance.sourceSha256)
      ) {
        push(
          'CAN-0012',
          '/provenance/sourceSha256',
          'source_text requires a 64-character lowercase SHA-256 digest in provenance.sourceSha256'
        );
      }
      if (!isNonEmptyString(provenance.attribution)) {
        push('CAN-0014', '/provenance/attribution', 'source_text requires provenance.attribution');
      }
      if (provenance.modifiedFromOriginal === true) {
        push(
          'CAN-0012',
          '/provenance/modifiedFromOriginal',
          'source_text must preserve verbatim original bytes and cannot set modifiedFromOriginal=true'
        );
      }
    } else if (layer === 'textual_witness') {
      if (
        typeof provenance.expressionId !== 'string' ||
        !EXPRESSION_PATTERN.test(provenance.expressionId)
      ) {
        push(
          'CAN-0014',
          '/provenance/expressionId',
          'textual_witness requires provenance.expressionId matching mw:expression:<id>'
        );
      }
      if (typeof provenance.editionId !== 'string' || !EDITION_PATTERN.test(provenance.editionId)) {
        push(
          'CAN-0014',
          '/provenance/editionId',
          'textual_witness requires provenance.editionId matching mw:edition:<id>'
        );
      }
      if (
        typeof provenance.expressionId === 'string' &&
        typeof provenance.editionId === 'string' &&
        provenance.expressionId === provenance.editionId
      ) {
        push(
          'CAN-0014',
          '/provenance/editionId',
          'textual_witness must keep expressionId and editionId distinct'
        );
      }
      if (!isNonEmptyString(provenance.locator)) {
        push('CAN-0014', '/provenance/locator', 'textual_witness requires provenance.locator');
      }
      const hasArtifactRef =
        (typeof provenance.sourceArtifactId === 'string' &&
          ARTIFACT_PATTERN.test(provenance.sourceArtifactId)) ||
        (typeof provenance.sourceSha256 === 'string' &&
          SHA256_PATTERN.test(provenance.sourceSha256));
      if (!hasArtifactRef) {
        push(
          'CAN-0014',
          '/provenance/sourceArtifactId',
          'textual_witness requires provenance.sourceArtifactId (mw:artifact:<id>) or provenance.sourceSha256'
        );
      }
      if (!isNonEmptyString(provenance.attribution)) {
        push(
          'CAN-0014',
          '/provenance/attribution',
          'textual_witness requires provenance.attribution'
        );
      }
    } else if (layer === 'translation') {
      const boundEdition = provenance.sourceEditionId ?? provenance.editionId;
      if (typeof boundEdition !== 'string' || !EDITION_PATTERN.test(boundEdition)) {
        push(
          'CAN-0014',
          '/provenance/sourceEditionId',
          'translation requires provenance.sourceEditionId (or editionId) matching mw:edition:<id>'
        );
      }
      if (!isNonEmptyString(provenance.translator) && !isNonEmptyString(provenance.attribution)) {
        push(
          'CAN-0014',
          '/provenance/translator',
          'translation requires provenance.translator or provenance.attribution'
        );
      }
      if (!isNonEmptyString(provenance.locale)) {
        push('CAN-0014', '/provenance/locale', 'translation requires provenance.locale');
      }
    } else if (layer === 'tafsir') {
      if (!isNonEmptyString(provenance.author)) {
        push('CAN-0014', '/provenance/author', 'tafsir requires provenance.author');
      }
      if (!isNonEmptyString(provenance.tradition)) {
        push('CAN-0014', '/provenance/tradition', 'tafsir requires provenance.tradition');
      }
      if (!isNonEmptyString(provenance.edition) && !isNonEmptyString(provenance.sourceRef)) {
        push(
          'CAN-0014',
          '/provenance/edition',
          'tafsir requires provenance.edition or provenance.sourceRef'
        );
      }
    } else if (layer === 'historical_context') {
      if (
        !isNonEmptyStringArray(provenance.sourceRefs) &&
        !isNonEmptyString(provenance.sourceRef)
      ) {
        push(
          'CAN-0014',
          '/provenance/sourceRefs',
          'historical_context requires provenance.sourceRefs (non-empty array) or provenance.sourceRef'
        );
      }
    } else if (layer === 'personal_reflection') {
      if (!isNonEmptyString(provenance.authorRef)) {
        push(
          'CAN-0013',
          '/provenance/authorRef',
          'personal_reflection requires provenance.authorRef identifying the human author'
        );
      }
    } else if (layer === 'creative_metaphor') {
      if (!isNonEmptyString(provenance.authorRef) && !isNonEmptyString(provenance.frameworkName)) {
        push(
          'CAN-0014',
          '/provenance/frameworkName',
          'creative_metaphor requires provenance.frameworkName or provenance.authorRef'
        );
      }
    } else if (layer === 'ai_hypothesis') {
      if (!isNonEmptyString(provenance.modelId)) {
        push(
          'CAN-0013',
          '/provenance/modelId',
          'ai_hypothesis requires provenance.modelId identifying the generating model'
        );
      }
      if (
        typeof provenance.reviewState !== 'string' ||
        !REVIEW_STATES.has(provenance.reviewState)
      ) {
        push(
          'CAN-0013',
          '/provenance/reviewState',
          'ai_hypothesis requires provenance.reviewState (unverified | review_pending | human_reviewed | rejected)'
        );
      }
    }
  }

  // CAN-0014: Prevent non-scripture / non-tafsir layers from claiming scripture or tafsir status.
  if (claims && layer !== null) {
    if (claims.isScripture === true && layer !== 'source_text') {
      push(
        'CAN-0014',
        '/claims/isScripture',
        `Layer "${layer}" cannot claim isScripture=true; only verified "source_text" records represent scripture text`
      );
    }
    if (claims.isTafsir === true && layer !== 'tafsir') {
      push(
        'CAN-0014',
        '/claims/isTafsir',
        `Layer "${layer}" cannot claim isTafsir=true; only attributed "tafsir" records represent scholarly tafsir`
      );
    }
    if (
      claims.canonicalAuthority === true &&
      (layer === 'personal_reflection' || layer === 'creative_metaphor' || layer === 'ai_hypothesis')
    ) {
      push(
        'CAN-0014',
        '/claims/canonicalAuthority',
        `Layer "${layer}" cannot assert canonicalAuthority=true`
      );
    }
    if (
      claims.isScientificFact === true &&
      (layer === 'creative_metaphor' || layer === 'personal_reflection' || layer === 'ai_hypothesis')
    ) {
      push(
        'CAN-0014',
        '/claims/isScientificFact',
        `Layer "${layer}" cannot assert isScientificFact=true without empirical research separation`
      );
    }
  }

  return buildResult(layer, issues);
}

function buildResult(
  layer: EpistemicLayer | null,
  issues: EpistemicValidationIssue[]
): EpistemicValidationResult {
  const failedRules = new Set<string>(issues.map((issue) => issue.rule));
  const canonChecks: Record<CanonProvenanceRuleId, 'pass' | 'fail'> = {
    'CAN-0011': failedRules.has('CAN-0011') ? 'fail' : 'pass',
    'CAN-0012': failedRules.has('CAN-0012') ? 'fail' : 'pass',
    'CAN-0013': failedRules.has('CAN-0013') ? 'fail' : 'pass',
    'CAN-0014': failedRules.has('CAN-0014') ? 'fail' : 'pass',
  };
  return {
    valid: issues.length === 0,
    layer,
    canonChecks: Object.freeze(canonChecks),
    issues: Object.freeze(issues),
  };
}

export function assertEpistemicRecord(candidate: unknown): EpistemicProvenanceRecord {
  const result = validateEpistemicRecord(candidate);
  if (!result.valid) {
    const summary = result.issues
      .map((issue) => `[${issue.rule}] ${issue.path}: ${issue.message}`)
      .join('; ');
    throw new TypeError(`Epistemic record validation failed: ${summary}`);
  }
  return candidate as EpistemicProvenanceRecord;
}
