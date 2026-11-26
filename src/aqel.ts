export const AQEL_ENGINE_NAME = 'aqel-arabic-morphology';
export const AQEL_ENGINE_VERSION = '1.0.0';

export const AQEL_PROVENANCE_NOTE =
  'AQEL deterministic Arabic morphological segmentation produces computational candidates only (classification: "computational_candidate", authoritativeTafsir: false). Original Uthmani source text is preserved verbatim without mutation.';

export const AQEL_FUNCTIONAL_PARTICLES = Object.freeze([
  'و',
  'إلى',
  'لا',
  'لن',
  'من',
  'في',
  'على',
  'عن',
  'ما',
  'أن',
] as const);

export type AqelFunctionalParticle = (typeof AQEL_FUNCTIONAL_PARTICLES)[number];

export interface NormalizeArabicOptions {
  readonly stripTashkeel?: boolean;
  readonly normalizeTaMarbuta?: boolean;
  readonly stripTatweel?: boolean;
}

export interface AqelRootCandidate {
  readonly original: string;
  readonly normalized: string;
  readonly stem: string;
  readonly rootCandidate: string;
  readonly letters: readonly string[];
  readonly confidence: 'high' | 'medium' | 'low';
  readonly confidenceNote: string;
  readonly classification: 'computational_candidate';
  readonly authoritativeTafsir: false;
}

export interface AqelToken {
  readonly index: number;
  readonly start: number;
  readonly end: number;
  readonly original: string;
  readonly normalized: string;
  readonly isParticle: boolean;
  readonly particle: AqelFunctionalParticle | null;
  readonly particlesDetected: readonly AqelFunctionalParticle[];
  readonly rootAnalysis: AqelRootCandidate;
}

export interface AqelParticleSummary {
  readonly totalOccurrences: number;
  readonly distinctParticles: readonly AqelFunctionalParticle[];
  readonly counts: Readonly<Record<string, number>>;
}

export interface AqelAnalysisResult {
  readonly engine: typeof AQEL_ENGINE_NAME;
  readonly version: typeof AQEL_ENGINE_VERSION;
  readonly original: string;
  readonly normalized: string;
  readonly tokenCount: number;
  readonly tokens: readonly AqelToken[];
  readonly particleSummary: AqelParticleSummary;
  readonly provenanceNote: string;
}

const TASHKEEL_PATTERN = /[\u064B-\u065F\u0670]/gu;
const TATWEEL_PATTERN = /\u0640/gu;
const ALEF_VARIANTS_PATTERN = /[أإآٱ]/gu;
const ALEF_MAQSURA_PATTERN = /ى/gu;
const TA_MARBUTA_PATTERN = /ة/gu;
const ARABIC_WORD_PATTERN = /[\u0621-\u064A\u064B-\u065F\u0670\u0671\u0640]+/gu;
const ARABIC_LETTER_ONLY_PATTERN = /[^\u0621-\u064A]/gu;

const NORMALIZED_PARTICLE_MAP: ReadonlyMap<string, AqelFunctionalParticle> = new Map([
  ['و', 'و'],
  ['الي', 'إلى'],
  ['لا', 'لا'],
  ['لن', 'لن'],
  ['من', 'من'],
  ['في', 'في'],
  ['علي', 'على'],
  ['عن', 'عن'],
  ['ما', 'ما'],
  ['ان', 'أن'],
]);

const STEMMER_PREFIXES = [
  'وال',
  'فال',
  'بال',
  'كال',
  'لل',
  'است',
  'مست',
  'ال',
  'وت',
  'وي',
  'ون',
  'وا',
  'فت',
  'في',
  'مت',
  'تت',
  'يت',
  'ان',
  'و',
  'ف',
  'ب',
  'ك',
  'ل',
  'س',
  'ي',
  'ت',
  'ن',
  'م',
  'ا',
] as const;

const STEMMER_SUFFIXES = [
  'تما',
  'كم',
  'كن',
  'هم',
  'هن',
  'ها',
  'نا',
  'ني',
  'ون',
  'ين',
  'ان',
  'ات',
  'وا',
  'تم',
  'تن',
  'ية',
  'يه',
  'ة',
  'ه',
  'ي',
  'ك',
  'ت',
  'ا',
  'ن',
] as const;

const INFIX_LETTERS = new Set<string>(['ا', 'و', 'ي', 'ت', 'ن', 'م']);

export function normalizeArabic(
  text: string,
  stripTashkeel: boolean | NormalizeArabicOptions = true
): string {
  const options: NormalizeArabicOptions =
    typeof stripTashkeel === 'boolean' ? { stripTashkeel } : stripTashkeel;

  const shouldStripTashkeel = options.stripTashkeel ?? true;
  const shouldNormalizeTaMarbuta = options.normalizeTaMarbuta ?? false;
  const shouldStripTatweel = options.stripTatweel ?? true;

  let result = text;
  if (shouldStripTashkeel) {
    result = result.replace(TASHKEEL_PATTERN, '');
  }
  if (shouldStripTatweel) {
    result = result.replace(TATWEEL_PATTERN, '');
  }
  result = result.replace(ALEF_VARIANTS_PATTERN, 'ا');
  result = result.replace(ALEF_MAQSURA_PATTERN, 'ي');
  if (shouldNormalizeTaMarbuta) {
    result = result.replace(TA_MARBUTA_PATTERN, 'ه');
  }
  return result;
}

function detectTokenParticles(normalizedWord: string): {
  readonly isParticle: boolean;
  readonly particle: AqelFunctionalParticle | null;
  readonly particlesDetected: readonly AqelFunctionalParticle[];
} {
  const exact = NORMALIZED_PARTICLE_MAP.get(normalizedWord);
  if (exact) {
    return {
      isParticle: true,
      particle: exact,
      particlesDetected: [exact],
    };
  }

  const detected: AqelFunctionalParticle[] = [];

  if (normalizedWord.startsWith('و') && normalizedWord.length >= 2) {
    detected.push('و');
    const afterWa = normalizedWord.slice(1);
    const attachedParticle = NORMALIZED_PARTICLE_MAP.get(afterWa);
    if (attachedParticle && attachedParticle !== 'و') {
      detected.push(attachedParticle);
    }
  } else if (normalizedWord.startsWith('ف') && normalizedWord.length >= 3) {
    const afterFa = normalizedWord.slice(1);
    const attachedParticle = NORMALIZED_PARTICLE_MAP.get(afterFa);
    if (attachedParticle && attachedParticle !== 'و') {
      detected.push(attachedParticle);
    }
  }

  return {
    isParticle: false,
    particle: detected.length === 1 ? detected[0] : null,
    particlesDetected: detected,
  };
}

export function extractRootCandidate(word: string): AqelRootCandidate {
  const normalized = normalizeArabic(word, {
    stripTashkeel: true,
    normalizeTaMarbuta: false,
    stripTatweel: true,
  }).replace(ARABIC_LETTER_ONLY_PATTERN, '');

  const exactParticle = NORMALIZED_PARTICLE_MAP.get(normalized);
  if (exactParticle) {
    const letters = Array.from(normalized);
    return {
      original: word,
      normalized,
      stem: normalized,
      rootCandidate: normalized,
      letters,
      confidence: 'low',
      confidenceNote: `Functional particle "${exactParticle}"; triliteral root derivation does not apply to closed-class particles.`,
      classification: 'computational_candidate',
      authoritativeTafsir: false,
    };
  }

  let stem = normalized;

  if (stem.length > 3) {
    for (const prefix of STEMMER_PREFIXES) {
      if (stem.startsWith(prefix) && stem.length - prefix.length >= 3) {
        stem = stem.slice(prefix.length);
        break;
      }
    }
  }

  if (stem.length > 3) {
    for (const suffix of STEMMER_SUFFIXES) {
      if (stem.endsWith(suffix) && stem.length - suffix.length >= 3) {
        stem = stem.slice(0, stem.length - suffix.length);
        break;
      }
    }
  }

  const candidateChars = Array.from(stem);
  while (candidateChars.length > 3) {
    let removed = false;
    for (let idx = candidateChars.length - 2; idx >= 1; idx -= 1) {
      if (INFIX_LETTERS.has(candidateChars[idx])) {
        candidateChars.splice(idx, 1);
        removed = true;
        break;
      }
    }
    if (!removed) {
      candidateChars.pop();
    }
  }

  const rootCandidate = candidateChars.join('');
  let confidence: 'high' | 'medium' | 'low';
  let confidenceNote: string;

  if (candidateChars.length === 3 && stem.length === 3) {
    confidence = 'high';
    confidenceNote =
      'Deterministic affix stripping converged cleanly to a 3-letter triliteral root candidate.';
  } else if (candidateChars.length === 3) {
    confidence = 'medium';
    confidenceNote =
      'Deterministic prefix/infix/suffix reduction produced a 3-letter heuristic root candidate; verify against classical lexicon.';
  } else {
    confidence = 'low';
    confidenceNote =
      'Token shorter than 3 consonants after normalization; returning normalized consonant skeleton as low-confidence candidate.';
  }

  return {
    original: word,
    normalized,
    stem,
    rootCandidate,
    letters: candidateChars,
    confidence,
    confidenceNote,
    classification: 'computational_candidate',
    authoritativeTafsir: false,
  };
}

export function tokenizeArabicWords(text: string): AqelToken[] {
  const tokens: AqelToken[] = [];
  const matcher = new RegExp(ARABIC_WORD_PATTERN.source, 'gu');
  let match: RegExpExecArray | null;
  let index = 0;

  while ((match = matcher.exec(text)) !== null) {
    const original = match[0];
    const start = match.index;
    const end = start + original.length;
    const normalized = normalizeArabic(original, {
      stripTashkeel: true,
      normalizeTaMarbuta: false,
      stripTatweel: true,
    });
    const particleInfo = detectTokenParticles(normalized);
    const rootAnalysis = extractRootCandidate(original);

    tokens.push({
      index,
      start,
      end,
      original,
      normalized,
      isParticle: particleInfo.isParticle,
      particle: particleInfo.particle,
      particlesDetected: particleInfo.particlesDetected,
      rootAnalysis,
    });
    index += 1;
  }

  return tokens;
}

export function analyzeArabicText(
  text: string,
  options: NormalizeArabicOptions = {}
): AqelAnalysisResult {
  const normalized = normalizeArabic(text, {
    stripTashkeel: options.stripTashkeel ?? true,
    normalizeTaMarbuta: options.normalizeTaMarbuta ?? false,
    stripTatweel: options.stripTatweel ?? true,
  });
  const tokens = tokenizeArabicWords(text);

  const counts: Record<string, number> = {};
  let totalOccurrences = 0;

  for (const token of tokens) {
    for (const particle of token.particlesDetected) {
      counts[particle] = (counts[particle] ?? 0) + 1;
      totalOccurrences += 1;
    }
  }

  const distinctParticles = AQEL_FUNCTIONAL_PARTICLES.filter((p) => (counts[p] ?? 0) > 0);

  return {
    engine: AQEL_ENGINE_NAME,
    version: AQEL_ENGINE_VERSION,
    original: text,
    normalized,
    tokenCount: tokens.length,
    tokens,
    particleSummary: {
      totalOccurrences,
      distinctParticles,
      counts,
    },
    provenanceNote: AQEL_PROVENANCE_NOTE,
  };
}
