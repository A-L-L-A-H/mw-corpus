import { createHash } from 'node:crypto';

export interface NormalizedRecord {
  id: string;
  title: string;
  abstract: string;
  sha256: string;
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

export async function ingestAcademic(params: {
  source: 'arxiv' | 'openalex';
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
    const title = titleMatch ? titleMatch[1].trim() : '';
    const abstract = summaryMatch ? summaryMatch[1].trim() : '';
    const sha = sha256Hex(JSON.stringify({ title, abstract }));
    return { id: params.id, title, abstract, sha256: sha };
  } else {
    const url = `https://api.openalex.org/works/${encodeURIComponent(params.id)}`;
    const json = await fetchJson(url, fetchFn);
    const title = typeof json.title === 'string' ? json.title : '';
    const abstract =
      typeof json.abstract === 'string'
        ? json.abstract
        : reconstructAbstractFromInvertedIndex(json.abstract_inverted_index);
    const sha = sha256Hex(JSON.stringify({ title, abstract }));
    return { id: params.id, title, abstract, sha256: sha };
  }
}
