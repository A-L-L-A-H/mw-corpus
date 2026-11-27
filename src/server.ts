import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ASMAUL_HUSNA_CONCEPT_EDGES,
  ASMAUL_HUSNA_DATASET,
  getAsmaulHusnaByCluster,
  getAsmaulHusnaByOrdinal,
  getRelatedAsmaulHusna,
  searchAsmaulHusna,
  summarizeAsmaulHusnaClusters,
  type AsmaulHusnaCluster,
} from './asmaul-husna.js';
import { analyzeArabicText } from './aqel.js';
import {
  CANON_PROVENANCE_RULES,
  EPISTEMIC_LAYERS,
  validateEpistemicRecord,
} from './epistemic-layers.js';
import { isRecord, parseCanonicalJson } from './knowledge-core.js';
import {
  Q4Q_EVIDENCE_CLASS_DESCRIPTORS,
  Q4Q_FORMAT,
  Q4Q_REFERENCE_MANIFEST,
  Q4Q_REVELATION_IDENTITIES,
  validateQ4QMapping,
} from './q4q-schema.js';
import { readQuranPassage } from './quran-passage.js';
import { readTextualWitnessPassage } from './textual-witness-passage.js';
import { QdrantClient, type Point } from './qdrant-client.js';
import { ingestAcademic } from './academic-ingestor.js';

export const DEFAULT_CORPUS_PORT = 4420;
const defaultQdrantClient = new QdrantClient({
  url: process.env.QDRANT_URL,
  apiKey: process.env.QDRANT_API_KEY,
});
export const SERVICE_NAME = 'mw-corpus';
export const SERVICE_VERSION = '1.0.0';

export interface IndexedPassageRecord {
  readonly kind: 'quran' | 'textual_witness';
  readonly epistemicLayer: 'source_text' | 'textual_witness';
  readonly editionId: string;
  readonly expressionId?: string;
  readonly sourceId?: string;
  readonly locale: string;
  readonly locator: string;
  readonly text: string;
  readonly sha256: string;
  readonly attribution: string;
  readonly references?: readonly string[];
}

export interface CorpusServerContext {
  readonly rootDirectory: string;
  readonly port: number;
}

export interface CorpusServerOptions {
  readonly port?: number;
  readonly hostname?: string;
  readonly rootDirectory?: string;
}

const VALID_CLUSTERS = new Set<string>([
  'Mercy',
  'Sovereignty',
  'Knowledge',
  'Creation',
  'Justice',
  'Guidance',
  'Sustenance',
  'Majesty',
]);

function resolveDefaultRootDirectory(): string {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(currentDir, '..'),
    path.resolve(currentDir, '../..'),
    process.cwd(),
  ];
  for (const candidate of candidates) {
    if (existsSync(path.join(candidate, 'corpus/manifests/quran-passage-index.json'))) {
      return candidate;
    }
  }
  return path.resolve(currentDir, '..');
}

const DEFAULT_ROOT_DIRECTORY = resolveDefaultRootDirectory();

export const MCP_TOOL_DEFINITIONS = Object.freeze([
  Object.freeze({
    name: 'corpus_search_passages',
    description:
      'Search and retrieve SHA-256 verified immutable passages from the local MoonWitness source corpus (Qur’an source_text and textual_witness slices).',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Optional substring to match text, locator, or editionId.' },
        kind: {
          type: 'string',
          enum: ['all', 'quran', 'textual_witness'],
          description: 'Filter by passage kind (default: all).',
        },
        editionId: { type: 'string', description: 'Optional exact edition ID filter.' },
        locator: { type: 'string', description: 'Optional exact locator filter (e.g. Q7:46 or Genesis 1:1).' },
      },
      additionalProperties: false,
    },
  }),
  Object.freeze({
    name: 'corpus_get_asmaul_husna',
    description:
      'Query the 99-name Asmaul Husna canonical dataset and concept graph by ordinal, thematic cluster, or Arabic/English/Indonesian search query.',
    inputSchema: {
      type: 'object',
      properties: {
        ordinal: { type: 'integer', minimum: 1, maximum: 99 },
        cluster: {
          type: 'string',
          enum: [
            'Mercy',
            'Sovereignty',
            'Knowledge',
            'Creation',
            'Justice',
            'Guidance',
            'Sustenance',
            'Majesty',
          ],
        },
        query: { type: 'string' },
        includeRelated: { type: 'boolean' },
      },
      additionalProperties: false,
    },
  }),
  Object.freeze({
    name: 'corpus_validate_epistemic',
    description:
      'Validate a corpus record against the 8-Layer Epistemic Separation contract and CAN-0011..0014 governance rules (or a Q4Q mapping document when format is moonwitness-q4q/v1).',
    inputSchema: {
      type: 'object',
      required: ['record'],
      properties: {
        record: {
          type: 'object',
          description: 'Epistemic provenance record or Q4Q comparative mapping document to validate.',
        },
      },
      additionalProperties: false,
    },
  }),
  Object.freeze({
    name: 'corpus_aqel_analyze',
    description:
      'Run AQEL Arabic-first morphological & lexical segmentation (Uthmani-preserving normalization, functional particle detection, deterministic 3-letter root candidates stamped computational_candidate).',
    inputSchema: {
      type: 'object',
      required: ['text'],
      properties: {
        text: {
          type: 'string',
          description: 'Arabic or Qur’anic Uthmani text to analyze.',
        },
        stripTashkeel: {
          type: 'boolean',
          description: 'Strip Arabic diacritics/tashkeel in normalized output (default: true).',
        },
        normalizeTaMarbuta: {
          type: 'boolean',
          description: 'Normalize ta marbuta (ة -> ه) in normalized output (default: false).',
        },
      },
      additionalProperties: false,
    },
  }),
]);

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(`${JSON.stringify(body)}\n`, {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, POST, OPTIONS',
      'access-control-allow-headers': 'content-type',
      'x-content-type-options': 'nosniff',
    },
  });
}

export async function loadIndexedPassages(
  rootDirectory: string,
  filters: {
    query?: string;
    kind?: 'all' | 'quran' | 'textual_witness';
    editionId?: string;
    locator?: string;
  } = {}
): Promise<IndexedPassageRecord[]> {
  const kind = filters.kind ?? 'all';
  const results: IndexedPassageRecord[] = [];

  if (kind === 'all' || kind === 'quran') {
    const quranIndexRaw = await readFile(
      path.join(rootDirectory, 'corpus/manifests/quran-passage-index.json'),
      'utf8'
    );
    const quranIndex = parseCanonicalJson(quranIndexRaw) as {
      entries: Array<{ edition_id: string; locator: string }>;
    };
    for (const entry of quranIndex.entries) {
      const passage = await readQuranPassage({
        rootDirectory,
        editionId: entry.edition_id,
        locator: entry.locator,
      });
      results.push({
        kind: 'quran',
        epistemicLayer: 'source_text',
        editionId: passage.editionId,
        locale: 'ar',
        locator: passage.locator,
        text: passage.text,
        sha256: passage.sha256,
        attribution: passage.attribution,
      });
    }
  }

  if (kind === 'all' || kind === 'textual_witness') {
    const witnessIndexRaw = await readFile(
      path.join(rootDirectory, 'corpus/manifests/textual-witness-index.json'),
      'utf8'
    );
    const witnessIndex = parseCanonicalJson(witnessIndexRaw) as {
      entries: Array<{ expression_id: string; edition_id: string; locator: string }>;
    };
    for (const entry of witnessIndex.entries) {
      const passage = await readTextualWitnessPassage({
        rootDirectory,
        expressionId: entry.expression_id,
        editionId: entry.edition_id,
        locator: entry.locator,
      });
      results.push({
        kind: 'textual_witness',
        epistemicLayer: 'textual_witness',
        sourceId: passage.sourceId,
        expressionId: passage.expressionId,
        editionId: passage.editionId,
        locale: passage.locale,
        locator: passage.locator,
        text: passage.text,
        sha256: passage.sha256,
        attribution: passage.attribution,
        references: passage.references,
      });
    }
  }

  const normalizedQuery = filters.query?.trim().toLowerCase() ?? '';
  return results.filter((item) => {
    if (filters.editionId && item.editionId !== filters.editionId) return false;
    if (filters.locator && item.locator.toLowerCase() !== filters.locator.trim().toLowerCase()) {
      return false;
    }
    if (normalizedQuery.length > 0) {
      const rawQuery = filters.query!.trim();
      const matches =
        item.text.includes(rawQuery) ||
        item.text.toLowerCase().includes(normalizedQuery) ||
        item.locator.toLowerCase().includes(normalizedQuery) ||
        item.editionId.toLowerCase().includes(normalizedQuery) ||
        item.attribution.toLowerCase().includes(normalizedQuery);
      if (!matches) return false;
    }
    return true;
  });
}

function queryAsmaulHusnaPayload(params: {
  ordinal?: number;
  cluster?: string;
  query?: string;
  includeRelated?: boolean;
}) {
  if (params.ordinal !== undefined) {
    if (!Number.isInteger(params.ordinal) || params.ordinal < 1 || params.ordinal > 99) {
      return { error: 'ordinal must be an integer between 1 and 99', status: 400 as const };
    }
    const entry = getAsmaulHusnaByOrdinal(params.ordinal);
    return {
      status: 200 as const,
      body: {
        count: entry ? 1 : 0,
        entries: entry ? [entry] : [],
        related: params.includeRelated && entry ? getRelatedAsmaulHusna(entry.ordinal) : undefined,
      },
    };
  }

  if (params.cluster !== undefined) {
    if (!VALID_CLUSTERS.has(params.cluster)) {
      return {
        error: `Unknown cluster "${params.cluster}". Valid clusters: ${Array.from(VALID_CLUSTERS).join(', ')}`,
        status: 400 as const,
      };
    }
    const entries = getAsmaulHusnaByCluster(params.cluster as AsmaulHusnaCluster);
    return {
      status: 200 as const,
      body: {
        cluster: params.cluster,
        count: entries.length,
        entries,
      },
    };
  }

  if (params.query !== undefined && params.query.trim().length > 0) {
    const entries = searchAsmaulHusna(params.query);
    return {
      status: 200 as const,
      body: {
        query: params.query.trim(),
        count: entries.length,
        entries,
      },
    };
  }

  return {
    status: 200 as const,
    body: {
      count: ASMAUL_HUSNA_DATASET.length,
      clusters: summarizeAsmaulHusnaClusters(),
      conceptEdgeCount: ASMAUL_HUSNA_CONCEPT_EDGES.length,
      entries: ASMAUL_HUSNA_DATASET,
    },
  };
}

function validateRecordPayload(candidate: unknown) {
  if (isRecord(candidate) && candidate.format === Q4Q_FORMAT) {
    const q4q = validateQ4QMapping(candidate);
    return {
      kind: 'q4q_mapping' as const,
      valid: q4q.valid,
      issues: q4q.issues,
    };
  }
  const epistemic = validateEpistemicRecord(candidate);
  return {
    kind: 'epistemic_record' as const,
    ...epistemic,
  };
}

async function handleMcpRequest(
  request: Request,
  context: CorpusServerContext
): Promise<Response> {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse(
      {
        jsonrpc: '2.0',
        id: null,
        error: { code: -32700, message: 'Parse error: request body must be valid JSON' },
      },
      400
    );
  }

  if (!isRecord(payload) || payload.jsonrpc !== '2.0' || typeof payload.method !== 'string') {
    return jsonResponse(
      {
        jsonrpc: '2.0',
        id: isRecord(payload) && 'id' in payload ? payload.id : null,
        error: { code: -32600, message: 'Invalid JSON-RPC 2.0 request' },
      },
      400
    );
  }

  const rpcId = 'id' in payload ? payload.id : null;
  const method = payload.method;
  const params = isRecord(payload.params) ? payload.params : {};

  if (method === 'initialize') {
    return jsonResponse({
      jsonrpc: '2.0',
      id: rpcId,
      result: {
        protocolVersion: '2025-03-26',
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: SERVICE_NAME, version: SERVICE_VERSION },
      },
    });
  }

  if (method === 'notifications/initialized' || method === 'ping') {
    return jsonResponse({ jsonrpc: '2.0', id: rpcId, result: {} });
  }

  if (method === 'tools/list') {
    return jsonResponse({
      jsonrpc: '2.0',
      id: rpcId,
      result: { tools: MCP_TOOL_DEFINITIONS },
    });
  }

  if (method === 'tools/call') {
    const toolName = typeof params.name === 'string' ? params.name : '';
    const args = isRecord(params.arguments) ? params.arguments : {};

    if (toolName === 'corpus_search_passages') {
      const kind =
        args.kind === 'quran' || args.kind === 'textual_witness' || args.kind === 'all'
          ? args.kind
          : 'all';
      const passages = await loadIndexedPassages(context.rootDirectory, {
        query: typeof args.query === 'string' ? args.query : undefined,
        kind,
        editionId: typeof args.editionId === 'string' ? args.editionId : undefined,
        locator: typeof args.locator === 'string' ? args.locator : undefined,
      });
      const structured = { count: passages.length, passages };
      return jsonResponse({
        jsonrpc: '2.0',
        id: rpcId,
        result: {
          content: [{ type: 'text', text: JSON.stringify(structured) }],
          structuredContent: structured,
          isError: false,
        },
      });
    }

    if (toolName === 'corpus_get_asmaul_husna') {
      const ordinal = typeof args.ordinal === 'number' ? args.ordinal : undefined;
      const cluster = typeof args.cluster === 'string' ? args.cluster : undefined;
      const query = typeof args.query === 'string' ? args.query : undefined;
      const includeRelated = args.includeRelated === true;
      const outcome = queryAsmaulHusnaPayload({ ordinal, cluster, query, includeRelated });
      if ('error' in outcome) {
        return jsonResponse({
          jsonrpc: '2.0',
          id: rpcId,
          result: {
            content: [{ type: 'text', text: JSON.stringify({ error: outcome.error }) }],
            isError: true,
          },
        });
      }
      return jsonResponse({
        jsonrpc: '2.0',
        id: rpcId,
        result: {
          content: [{ type: 'text', text: JSON.stringify(outcome.body) }],
          structuredContent: outcome.body,
          isError: false,
        },
      });
    }

    if (toolName === 'corpus_validate_epistemic') {
      const target = 'record' in args ? args.record : args;
      const outcome = validateRecordPayload(target);
      return jsonResponse({
        jsonrpc: '2.0',
        id: rpcId,
        result: {
          content: [{ type: 'text', text: JSON.stringify(outcome) }],
          structuredContent: outcome,
          isError: !outcome.valid,
        },
      });
    }

    if (toolName === 'corpus_aqel_analyze') {
      const text = typeof args.text === 'string' ? args.text : '';
      if (text.trim().length === 0) {
        return jsonResponse({
          jsonrpc: '2.0',
          id: rpcId,
          result: {
            content: [{ type: 'text', text: JSON.stringify({ error: 'text must be a non-empty string' }) }],
            isError: true,
          },
        });
      }
      const outcome = analyzeArabicText(text, {
        stripTashkeel: typeof args.stripTashkeel === 'boolean' ? args.stripTashkeel : true,
        normalizeTaMarbuta:
          typeof args.normalizeTaMarbuta === 'boolean' ? args.normalizeTaMarbuta : false,
      });
      return jsonResponse({
        jsonrpc: '2.0',
        id: rpcId,
        result: {
          content: [{ type: 'text', text: JSON.stringify(outcome) }],
          structuredContent: outcome,
          isError: false,
        },
      });
    }

    return jsonResponse({
      jsonrpc: '2.0',
      id: rpcId,
      error: { code: -32602, message: `Unknown MCP tool: ${toolName}` },
    });
  }

  return jsonResponse({
    jsonrpc: '2.0',
    id: rpcId,
    error: { code: -32601, message: `Method not found: ${method}` },
  });
}

export async function handleCorpusRequest(
  request: Request,
  context: CorpusServerContext
): Promise<Response> {
  const url = new URL(request.url);
  const { pathname } = url;

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'GET, POST, OPTIONS',
        'access-control-allow-headers': 'content-type',
      },
    });
  }

  if (pathname === '/health') {
    if (request.method !== 'GET') return jsonResponse({ error: 'Method Not Allowed' }, 405);
    const passages = await loadIndexedPassages(context.rootDirectory);
    const quranCount = passages.filter((item) => item.kind === 'quran').length;
    const witnessCount = passages.filter((item) => item.kind === 'textual_witness').length;
    return jsonResponse({
      status: 'ok',
      service: SERVICE_NAME,
      version: SERVICE_VERSION,
      port: context.port,
      epistemicLayers: EPISTEMIC_LAYERS.length,
      canonRules: CANON_PROVENANCE_RULES.map((rule) => rule.id),
      asmaulHusnaCount: ASMAUL_HUSNA_DATASET.length,
      indexedPassages: {
        total: passages.length,
        quran: quranCount,
        textualWitness: witnessCount,
      },
      timestamp: new Date().toISOString(),
    });
  }

  if (pathname === '/api/passages') {
    if (request.method !== 'GET') return jsonResponse({ error: 'Method Not Allowed' }, 405);
    const kindParam = url.searchParams.get('kind') ?? 'all';
    if (kindParam !== 'all' && kindParam !== 'quran' && kindParam !== 'textual_witness') {
      return jsonResponse({ error: 'kind must be one of: all, quran, textual_witness' }, 400);
    }
    const passages = await loadIndexedPassages(context.rootDirectory, {
      query: url.searchParams.get('q') ?? undefined,
      kind: kindParam,
      editionId: url.searchParams.get('edition') ?? undefined,
      locator: url.searchParams.get('locator') ?? undefined,
    });
    return jsonResponse({
      count: passages.length,
      passages,
    });
  }

  if (pathname === '/api/asmaul-husna') {
    if (request.method !== 'GET') return jsonResponse({ error: 'Method Not Allowed' }, 405);
    const ordinalParam = url.searchParams.get('ordinal');
    let ordinal: number | undefined;
    if (ordinalParam !== null) {
      if (!/^\d+$/u.test(ordinalParam)) {
        return jsonResponse({ error: 'ordinal must be an integer between 1 and 99' }, 400);
      }
      ordinal = Number(ordinalParam);
    }
    const outcome = queryAsmaulHusnaPayload({
      ordinal,
      cluster: url.searchParams.get('cluster') ?? undefined,
      query: url.searchParams.get('q') ?? undefined,
      includeRelated: url.searchParams.get('related') === 'true',
    });
    if ('error' in outcome) return jsonResponse({ error: outcome.error }, outcome.status);
    return jsonResponse(outcome.body, outcome.status);
  }

  if (pathname === '/api/epistemic-layers') {
    if (request.method !== 'GET') return jsonResponse({ error: 'Method Not Allowed' }, 405);
    return jsonResponse({
      layerCount: EPISTEMIC_LAYERS.length,
      layers: EPISTEMIC_LAYERS,
      canonRules: CANON_PROVENANCE_RULES,
      q4q: {
        format: Q4Q_FORMAT,
        revelationIdentities: Q4Q_REVELATION_IDENTITIES,
        evidenceClasses: Q4Q_EVIDENCE_CLASS_DESCRIPTORS,
        referenceManifest: Q4Q_REFERENCE_MANIFEST,
      },
    });
  }

  if (pathname === '/api/validate-record') {
    if (request.method !== 'POST') return jsonResponse({ error: 'Method Not Allowed' }, 405);
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: 'Request body must be valid JSON' }, 400);
    }
    const target = isRecord(body) && 'record' in body ? body.record : body;
    const outcome = validateRecordPayload(target);
    return jsonResponse(outcome, outcome.valid ? 200 : 422);
  }

  if (pathname === '/api/aqel/analyze') {
    if (request.method !== 'POST') return jsonResponse({ error: 'Method Not Allowed' }, 405);
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: 'Request body must be valid JSON' }, 400);
    }
    if (!isRecord(body) || typeof body.text !== 'string' || body.text.trim().length === 0) {
      return jsonResponse({ error: 'text must be a non-empty string' }, 400);
    }
    const outcome = analyzeArabicText(body.text, {
      stripTashkeel: typeof body.stripTashkeel === 'boolean' ? body.stripTashkeel : true,
      normalizeTaMarbuta:
        typeof body.normalizeTaMarbuta === 'boolean' ? body.normalizeTaMarbuta : false,
    });
    return jsonResponse(outcome, 200);
  }

  if (pathname === '/api/corpus/search') {
    if (request.method !== 'POST') return jsonResponse({ error: 'Method Not Allowed' }, 405);
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: 'Request body must be valid JSON' }, 400);
    }
    if (!isRecord(body)) {
      return jsonResponse({ error: 'Request body must be a JSON object' }, 400);
    }
    const collection = typeof body.collection === 'string' && body.collection.trim().length > 0
      ? body.collection.trim()
      : 'corpus';
    const topK = typeof body.topK === 'number' && Number.isInteger(body.topK) && body.topK > 0
      ? body.topK
      : 5;

    if (Array.isArray(body.upsertPoints)) {
      const pointsToUpsert: Point[] = [];
      for (const candidate of body.upsertPoints) {
        if (
          isRecord(candidate) &&
          (typeof candidate.id === 'string' || typeof candidate.id === 'number') &&
          Array.isArray(candidate.vector) &&
          candidate.vector.every((val) => typeof val === 'number')
        ) {
          pointsToUpsert.push({
            id: candidate.id,
            vector: candidate.vector as number[],
            payload: isRecord(candidate.payload) ? candidate.payload : undefined,
          });
        }
      }
      if (pointsToUpsert.length > 0) {
        await defaultQdrantClient.upsert(collection, pointsToUpsert);
      }
    }

    if (Array.isArray(body.vector) && body.vector.every((val) => typeof val === 'number')) {
      const points = await defaultQdrantClient.search(collection, body.vector as number[], topK);
      return jsonResponse({
        mode: 'vector',
        collection,
        topK,
        count: points.length,
        results: points,
      }, 200);
    }

    const query = typeof body.query === 'string' ? body.query : undefined;
    const kind =
      body.kind === 'quran' || body.kind === 'textual_witness' || body.kind === 'all'
        ? body.kind
        : 'all';
    const editionId = typeof body.editionId === 'string' ? body.editionId : undefined;
    const locator = typeof body.locator === 'string' ? body.locator : undefined;
    if (!query && !editionId && !locator && !Array.isArray(body.vector)) {
      return jsonResponse({ error: 'Provide either vector (number[]) or query/editionId/locator' }, 400);
    }
    const passages = await loadIndexedPassages(context.rootDirectory, {
      query,
      kind,
      editionId,
      locator,
    });
    const sliced = passages.slice(0, topK);
    return jsonResponse({
      mode: 'lexical',
      topK,
      count: sliced.length,
      results: sliced,
      passages: sliced,
    }, 200);
  }

  if (pathname === '/api/corpus/ingest/academic') {
    if (request.method !== 'POST') return jsonResponse({ error: 'Method Not Allowed' }, 405);
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: 'Request body must be valid JSON' }, 400);
    }
    if (
      !isRecord(body) ||
      (body.source !== 'arxiv' && body.source !== 'openalex') ||
      typeof body.id !== 'string' ||
      body.id.trim().length === 0
    ) {
      return jsonResponse(
        { error: 'source must be "arxiv" or "openalex" and id must be a non-empty string' },
        400,
      );
    }
    try {
      const inlineFetch: typeof fetch | undefined =
        typeof body.mockXml === 'string'
          ? ((async () => new Response(body.mockXml as string, { status: 200 })) as unknown as typeof fetch)
          : isRecord(body.mockJson)
            ? ((async () =>
                new Response(JSON.stringify(body.mockJson), { status: 200 })) as unknown as typeof fetch)
            : undefined;
      const record = await ingestAcademic({
        source: body.source,
        id: body.id.trim(),
        fetch: inlineFetch,
      });
      return jsonResponse({ status: 'ingested', record }, 200);
    } catch (err) {
      return jsonResponse(
        { error: err instanceof Error ? err.message : 'Academic ingestion failed' },
        502,
      );
    }
  }

  if (pathname === '/api/mcp') {
    if (request.method !== 'POST') return jsonResponse({ error: 'Method Not Allowed' }, 405);
    return handleMcpRequest(request, context);
  }

  return jsonResponse({ error: 'Not Found', path: pathname }, 404);
}

export function createCorpusServer(options: CorpusServerOptions = {}) {
  const envPort = process.env.MW_CORPUS_PORT ? Number(process.env.MW_CORPUS_PORT) : undefined;
  const resolvedPort =
    options.port ??
    (envPort !== undefined && Number.isInteger(envPort) && envPort >= 0
      ? envPort
      : DEFAULT_CORPUS_PORT);
  const rootDirectory = path.resolve(options.rootDirectory ?? DEFAULT_ROOT_DIRECTORY);

  const server: ReturnType<typeof Bun.serve> = Bun.serve({
    port: resolvedPort,
    hostname: options.hostname ?? '0.0.0.0',
    fetch(request, runningServer): Promise<Response> {
      return handleCorpusRequest(request, {
        rootDirectory,
        port: runningServer.port ?? resolvedPort,
      });
    },
  });

  return server;
}

if (import.meta.main) {
  const server = createCorpusServer();
  console.log(
    JSON.stringify({
      event: 'mw_corpus_server_started',
      service: SERVICE_NAME,
      port: server.port,
      url: server.url.toString(),
    })
  );
}
