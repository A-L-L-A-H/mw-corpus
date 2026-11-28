import { createHash } from 'node:crypto';

export type AcademicSource = 'arxiv' | 'openalex' | 'crossref';

export interface NormalizedRecord {
  id: string;
  title: string;
  abstract: string;
  sha256: string;
  source?: AcademicSource;
  doi?: string;
  publishedAt?: string;
  authors?: string[];
}

export interface FrontierPaperCandidate {
  source: AcademicSource;
  id: string;
  title: string;
  abstract: string;
  doi?: string;
  publishedAt?: string;
  authors?: string[];
}

export interface FrontierDigestEntry {
  canonicalId: string;
  primarySource: AcademicSource;
  mergedSources: AcademicSource[];
  sourceIds: string[];
  doi?: string;
  title: string;
   normalizedTitleKey: string;
  abstract: string;
  publishedAt?: string;
  authors: string[];
  sha256: string;
}

export interface FrontierDigestReport {
  digestDate: string;
  inputCount: number;
  uniqueCount: number;
  duplicateCount: number;
  digestSha256: string;
  entries: FrontierDigestEntry[];
}

async function fetchXml(url: string, fetchFn: typeof fetch): Promise<string> {
  const resp = await fetchFn(url);
  if (resp.ok === false) {
    throw new Error(`Academic XML fetch failed with status ${resp.status}`);
  }
  return await resp.text();
}

async function fetchJson(url: string, fetchFn: typeof fetch): Promise<Record<string, unknown>> {
  const resp = await fetchFn(url);
  if (resp.ok === false) {
    throw new Error(`Academic JSON fetch failed with status ${resp.status}`);
  }
  return (await resp.json()) as Record<string, unknown>;
}

function sha256Hex(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}

export function normalizeAcademicWhitespace(text: string): string {
  return text
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeTitleForDeduplication(title: string): string {
  return normalizeAcademicWhitespace(title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function normalizeDoi(rawDoi?: string): string | undefined {
  if (!rawDoi || typeof rawDoi !== 'string') return undefined;
  const cleaned = rawDoi
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//, '')
    .trim();
  return cleaned.length > 0 ? cleaned : undefined;
}

function reconstructAbstractFromInvertedIndex(index: unknown): string {
  if (!index || typeof index !== 'object' || Array.isArray(index)) return '';
  const words: string[] = [];
  for (const [word, positions] of Object.entries(index as Record<string, unknown>)) {
    if (!Array.isArray(positions)) continue;
    for (const pos of positions) {
      if (typeof pos === 'number' && Number.isInteger(pos) && pos >= 0) {
        words[pos] = word;
      }
    }
  }
  return words.filter((w) => typeof w === 'string').join(' ').trim();
}

function extractCrossrefDate(message: Record<string, unknown>): string | undefined {
  const candidates = [message.published, message['published-print'], message['published-online'], message.created];
  for (const candidate of candidates) {
    if (candidate && typeof candidate === 'object' && 'date-parts' in candidate) {
      const parts = (candidate as { 'date-parts'?: unknown })['date-parts'];
      if (Array.isArray(parts) && Array.isArray(parts[0]) && parts[0].length > 0) {
        const [year, month = 1, day = 1] = parts[0] as number[];
        if (typeof year === 'number') {
          return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        }
      }
    }
  }
  return undefined;
}

function extractCrossrefAuthors(message: Record<string, unknown>): string[] {
  if (!Array.isArray(message.author)) return [];
  const names: string[] = [];
  for (const entry of message.author) {
    if (entry && typeof entry === 'object') {
      const given = typeof (entry as { given?: unknown }).given === 'string' ? (entry as { given: string }).given.trim() : '';
      const family = typeof (entry as { family?: unknown }).family === 'string' ? (entry as { family: string }).family.trim() : '';
      const full = `${given} ${family}`.trim();
      if (full.length > 0) names.push(full);
    }
  }
  return names;
}

export async function ingestAcademic(params: {
  source: AcademicSource;
  id: string;
  fetch?: typeof fetch;
}): Promise<NormalizedRecord> {
  const fetchFn = params.fetch ?? fetch;
  if (params.source === 'arxiv') {
    const url = `http://export.arxiv.org/api/query?id_list=${encodeURIComponent(params.id)}`;
    const xml = await fetchXml(url, fetchFn);
    const entryMatch = xml.match(/<entry>([\s\S]*?)<\/entry>/);
    const targetXml = entryMatch ? entryMatch[1] : xml;
    const titleMatch = targetXml.match(/<title[^>]*>([\s\S]*?)<\/title>/);
    const summaryMatch = targetXml.match(/<summary[^>]*>([\s\S]*?)<\/summary>/);
    const publishedMatch = targetXml.match(/<published[^>]*>([\s\S]*?)<\/published>/);
    const doiMatch = targetXml.match(/<arxiv:doi[^>]*>([\s\S]*?)<\/arxiv:doi>/);
    const authorMatches = Array.from(targetXml.matchAll(/<author>\s*<name>([\s\S]*?)<\/name>/g)).map((m) =>
      m[1].trim()
    );
    const title = titleMatch ? titleMatch[1].trim() : '';
    const abstract = summaryMatch ? summaryMatch[1].trim() : '';
    const sha = sha256Hex(JSON.stringify({ title, abstract }));
    return {
      id: params.id,
      source: 'arxiv',
      title,
      abstract,
      sha256: sha,
      doi: normalizeDoi(doiMatch ? doiMatch[1] : undefined),
      publishedAt: publishedMatch ? publishedMatch[1].trim().slice(0, 10) : undefined,
      authors: authorMatches.length > 0 ? authorMatches : undefined,
    };
  } else if (params.source === 'openalex') {
    const url = `https://api.openalex.org/works/${encodeURIComponent(params.id)}`;
    const json = await fetchJson(url, fetchFn);
    const title = typeof json.title === 'string' ? json.title : '';
    const abstract =
      typeof json.abstract === 'string'
        ? json.abstract
        : reconstructAbstractFromInvertedIndex(json.abstract_inverted_index);
    const sha = sha256Hex(JSON.stringify({ title, abstract }));
    const rawDoi = typeof json.doi === 'string' ? json.doi : undefined;
    const publishedAt =
      typeof json.publication_date === 'string' ? json.publication_date.trim() : undefined;
    const authors = Array.isArray(json.authorships)
      ? json.authorships
          .map((a) => {
            if (a && typeof a === 'object' && 'author' in a) {
              const authorObj = (a as { author?: { display_name?: unknown } }).author;
              return typeof authorObj?.display_name === 'string' ? authorObj.display_name.trim() : '';
            }
            return '';
          })
          .filter((name) => name.length > 0)
      : undefined;
    return {
      id: params.id,
      source: 'openalex',
      title,
      abstract,
      sha256: sha,
      doi: normalizeDoi(rawDoi),
      publishedAt,
      authors: authors && authors.length > 0 ? authors : undefined,
    };
  } else {
    const normalizedId = normalizeDoi(params.id) ?? params.id.trim();
    const url = `https://api.crossref.org/works/${encodeURIComponent(normalizedId)}`;
    const json = await fetchJson(url, fetchFn);
    const message =
      json.message && typeof json.message === 'object' && !Array.isArray(json.message)
        ? (json.message as Record<string, unknown>)
        : json;
    const rawTitle = Array.isArray(message.title) && typeof message.title[0] === 'string'
      ? message.title[0]
      : typeof message.title === 'string'
        ? message.title
        : '';
    const rawAbstract = typeof message.abstract === 'string' ? message.abstract : '';
    const title = normalizeAcademicWhitespace(rawTitle);
    const abstract = normalizeAcademicWhitespace(rawAbstract);
    const sha = sha256Hex(JSON.stringify({ title, abstract }));
    const doi = normalizeDoi(typeof message.DOI === 'string' ? message.DOI : normalizedId);
    const publishedAt = extractCrossrefDate(message);
    const authors = extractCrossrefAuthors(message);
    return {
      id: params.id,
      source: 'crossref',
      title,
      abstract,
      sha256: sha,
      doi,
      publishedAt,
      authors: authors.length > 0 ? authors : undefined,
    };
  }
}

/**
 * Deduplicates and normalizes daily frontier paper records across arXiv, Crossref, and OpenAlex.
 * Merging occurs by canonical DOI first, then by normalized title key.
 */
export function buildFrontierPaperDigest(
  candidates: readonly FrontierPaperCandidate[],
  options: { digestDate?: string } = {}
): FrontierDigestReport {
  const digestDate = options.digestDate ?? new Date().toISOString().slice(0, 10);
  const byKey = new Map<string, FrontierDigestEntry>();
  const doiToKey = new Map<string, string>();
  const titleToKey = new Map<string, string>();

  let duplicateCount = 0;

  for (const candidate of candidates) {
    const cleanTitle = normalizeAcademicWhitespace(candidate.title);
    const cleanAbstract = normalizeAcademicWhitespace(candidate.abstract);
    const normalizedTitleKey = normalizeTitleForDeduplication(cleanTitle);
    const cleanDoi = normalizeDoi(candidate.doi);

    let existingKey: string | undefined;
    if (cleanDoi && doiToKey.has(cleanDoi)) {
      existingKey = doiToKey.get(cleanDoi);
    } else if (normalizedTitleKey.length > 0 && titleToKey.has(normalizedTitleKey)) {
      existingKey = titleToKey.get(normalizedTitleKey);
    }

    if (existingKey && byKey.has(existingKey)) {
      duplicateCount += 1;
      const current = byKey.get(existingKey)!;
      if (!current.mergedSources.includes(candidate.source)) {
        current.mergedSources.push(candidate.source);
      }
      const sourceRef = `${candidate.source}:${candidate.id.trim()}`;
      if (!current.sourceIds.includes(sourceRef)) {
        current.sourceIds.push(sourceRef);
      }
      if (!current.doi && cleanDoi) {
        current.doi = cleanDoi;
        doiToKey.set(cleanDoi, existingKey);
      }
      if (cleanAbstract.length > current.abstract.length) {
        current.abstract = cleanAbstract;
      }
      if (!current.publishedAt && candidate.publishedAt) {
        current.publishedAt = candidate.publishedAt;
      }
      for (const author of candidate.authors ?? []) {
        const trimmedAuthor = author.trim();
        if (trimmedAuthor.length > 0 && !current.authors.includes(trimmedAuthor)) {
          current.authors.push(trimmedAuthor);
        }
      }
      current.sha256 = sha256Hex(
        JSON.stringify({
          title: current.title,
          abstract: current.abstract,
          doi: current.doi ?? null,
        })
      );
      continue;
    }

    const canonicalKey = cleanDoi
      ? `doi:${cleanDoi}`
      : normalizedTitleKey.length > 0
        ? `title:${normalizedTitleKey}`
        : `${candidate.source}:${candidate.id.trim()}`;

    const entrySha = sha256Hex(
      JSON.stringify({
        title: cleanTitle,
        abstract: cleanAbstract,
        doi: cleanDoi ?? null,
      })
    );

    const newEntry: FrontierDigestEntry = {
      canonicalId: `mw:frontier:${entrySha.slice(0, 16)}`,
      primarySource: candidate.source,
      mergedSources: [candidate.source],
      sourceIds: [`${candidate.source}:${candidate.id.trim()}`],
      doi: cleanDoi,
      title: cleanTitle,
      normalizedTitleKey,
      abstract: cleanAbstract,
      publishedAt: candidate.publishedAt,
      authors: (candidate.authors ?? []).map((a) => a.trim()).filter((a) => a.length > 0),
      sha256: entrySha,
    };

    byKey.set(canonicalKey, newEntry);
    if (cleanDoi) doiToKey.set(cleanDoi, canonicalKey);
    if (normalizedTitleKey.length > 0) titleToKey.set(normalizedTitleKey, canonicalKey);
  }

  const entries = Array.from(byKey.values());
  const digestSha256 = sha256Hex(
    JSON.stringify({
      digestDate,
      entries: entries.map((e) => ({ id: e.canonicalId, sha256: e.sha256, sources: e.sourceIds })),
    })
  );

  return {
    digestDate,
    inputCount: candidates.length,
    uniqueCount: entries.length,
    duplicateCount,
    digestSha256,
    entries,
  };
}

export async function ingestDailyFrontierDigest(params: {
  items: ReadonlyArray<{ source: AcademicSource; id: string }>;
  digestDate?: string;
  fetch?: typeof fetch;
}): Promise<FrontierDigestReport> {
  const candidates: FrontierPaperCandidate[] = [];
  for (const item of params.items) {
    const rec = await ingestAcademic({
      source: item.source,
      id: item.id,
      fetch: params.fetch,
    });
    candidates.push({
      source: item.source,
      id: rec.id,
      title: rec.title,
      abstract: rec.abstract,
      doi: rec.doi,
      publishedAt: rec.publishedAt,
      authors: rec.authors,
    });
  }
  return buildFrontierPaperDigest(candidates, { digestDate: params.digestDate });
}
