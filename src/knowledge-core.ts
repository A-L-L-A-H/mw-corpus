import { createHash } from 'node:crypto';
import { Ajv2020 } from 'ajv/dist/2020.js';
import * as formatsModule from 'ajv-formats';
import knowledgeRecordSchema from '../schemas/knowledge-record.schema.json' with { type: 'json' };
import sourceArtifactManifestSchema from '../schemas/source-artifact-manifest.schema.json' with { type: 'json' };

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function sha256Hex(value: string | Uint8Array): string {
  return createHash('sha256').update(value).digest('hex');
}

function quoteJsonString(value: string): string {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) throw new TypeError('Lone Unicode surrogate');
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      throw new TypeError('Lone Unicode surrogate');
    }
  }
  return JSON.stringify(value);
}

/** RFC 8785 serialization of JSON values; never invokes getters or toJSON. */
export function canonicalizeJson(value: unknown): string {
  const active = new Set<object>();
  const serialize = (input: unknown): string => {
    if (input === null) return 'null';
    if (typeof input === 'string') return quoteJsonString(input);
    if (typeof input === 'boolean') return input ? 'true' : 'false';
    if (typeof input === 'number') {
      if (!Number.isFinite(input)) throw new TypeError('Non-finite JSON number');
      return JSON.stringify(input);
    }
    if (typeof input !== 'object') throw new TypeError('Unsupported JSON value');
    if (active.has(input)) throw new TypeError('Cyclic JSON value');
    if (Array.isArray(input) && Object.getPrototypeOf(input) !== Array.prototype) {
      throw new TypeError('JSON arrays must use the standard array prototype');
    }
    if (!Array.isArray(input) && ![Object.prototype, null].includes(Object.getPrototypeOf(input))) {
      throw new TypeError('JSON objects must have a plain or null prototype');
    }
    if (Object.getOwnPropertySymbols(input).length) {
      throw new TypeError('JSON cannot contain symbols');
    }
    active.add(input);
    try {
      const descriptors = Object.getOwnPropertyDescriptors(input);
      const readValue = (key: string): unknown => {
        const descriptor = descriptors[key];
        if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) {
          throw new TypeError('JSON requires enumerable data properties');
        }
        return descriptor.value;
      };
      if (Array.isArray(input)) {
        if (Object.keys(descriptors).length !== input.length + 1) {
          throw new TypeError('JSON arrays cannot contain holes or extra properties');
        }
        return `[${Array.from({ length: input.length }, (_, index) => serialize(readValue(String(index)))).join(',')}]`;
      }
      return `{${Object.keys(descriptors)
        .sort()
        .map((key) => `${quoteJsonString(key)}:${serialize(readValue(key))}`)
        .join(',')}}`;
    } finally {
      active.delete(input);
    }
  };
  return serialize(value);
}

/** Parse JSON without silently accepting duplicate keys or non-I-JSON values. */
export function parseCanonicalJson(text: string): unknown {
  const value: unknown = JSON.parse(text);
  const stack: Array<{ keys?: Set<string>; expectsKey: boolean }> = [];
  for (let index = 0; index < text.length; ) {
    const character = text[index];
    if (character !== undefined && /\s/u.test(character)) {
      index += 1;
      continue;
    }

    if (character === '"') {
      const start = index;
      index += 1;
      while (index < text.length && text[index] !== '"') {
        index += text[index] === '\\' ? 2 : 1;
      }
      index += 1;

      const current = stack.at(-1);
      if (current?.keys && current.expectsKey) {
        const key: unknown = JSON.parse(text.slice(start, index));
        if (typeof key !== 'string') throw new TypeError('Invalid JSON property name');
        if (current.keys.has(key)) throw new TypeError(`Duplicate JSON property: ${key}`);
        current.keys.add(key);
      }
      continue;
    }

    const current = stack.at(-1);
    if (character === '{') stack.push({ keys: new Set(), expectsKey: true });
    else if (character === '[') stack.push({ expectsKey: false });
    else if (character === '}' || character === ']') stack.pop();
    else if (character === ',' && current?.keys) current.expectsKey = true;
    else if (character === ':' && current) current.expectsKey = false;
    index += 1;
  }
  canonicalizeJson(value);
  return value;
}

export function hashCanonicalJson(value: unknown): string {
  return createHash('sha256').update(canonicalizeJson(value), 'utf8').digest('hex');
}

export interface KnowledgeSnapshotInput {
  records: readonly unknown[];
  aliases: readonly unknown[];
  sourceArtifacts: readonly unknown[];
  provenance?: unknown;
}

/** File names and collection order are not part of dataset content identity. */
export function createKnowledgeSnapshot(input: KnowledgeSnapshotInput) {
  const digests = (values: readonly unknown[]): string[] => values.map(hashCanonicalJson).sort();
  const manifest = {
    format: 'moonwitness-knowledge-snapshot/v1' as const,
    canonicalization: 'RFC8785' as const,
    hashAlgorithm: 'sha256' as const,
    records: digests(input.records),
    aliases: digests(input.aliases),
    sourceArtifacts: digests(input.sourceArtifacts),
    provenance: input.provenance === undefined ? null : hashCanonicalJson(input.provenance),
  };
  return { ...manifest, sha256: hashCanonicalJson(manifest) };
}

export const knowledgeRecordKinds = [
  'Entity',
  'Agent',
  'Work',
  'Expression',
  'Edition',
  'Artifact',
  'Passage',
  'Content',
  'Term',
  'Concept',
  'Assertion',
  'Evidence',
  'ProvenanceActivity',
  'Relation',
  'Assessment',
  'ReviewDecision',
  'DatasetRelease',
  'ImportRun',
  'ExternalAlias',
] as const;

export type KnowledgeRecordKind = (typeof knowledgeRecordKinds)[number];

export const knowledgeVisibilityValues = [
  'PUBLIC_APPROVED',
  'INTERNAL',
  'CONFIDENTIAL',
  'RESTRICTED',
  'CHILD_SENSITIVE',
] as const;

export type KnowledgeVisibility = (typeof knowledgeVisibilityValues)[number];
export type KnowledgeLifecycle = 'draft' | 'candidate' | 'active' | 'superseded' | 'withdrawn';

export interface KnowledgeDerivation {
  activity_id: string;
  input_ids: string[];
  method_id: string;
  method_version: string;
}

export interface KnowledgeRecordBase {
  id: string;
  kind: KnowledgeRecordKind;
  schema_version: number;
  lifecycle: KnowledgeLifecycle;
  created_at: string;
  updated_at: string;
  origin_ref: string;
  visibility: KnowledgeVisibility;
  content_revision: number;
  derivation?: KnowledgeDerivation;
}

export type KnowledgeRecord = {
  [Kind in KnowledgeRecordKind]: KnowledgeRecordBase & { kind: Kind };
}[KnowledgeRecordKind];

export interface KnowledgeValidationIssue {
  path: string;
  keyword: string;
  message: string;
}

export type KnowledgeValidationResult =
  | { valid: true; issues: [] }
  | { valid: false; issues: KnowledgeValidationIssue[] };

export type SourceRightsState =
  | 'unknown'
  | 'review_pending'
  | 'permitted'
  | 'restricted'
  | 'disputed'
  | 'withdrawn';

export type SourceAllowedUse =
  | 'read_analyze'
  | 'store'
  | 'transform'
  | 'quote_excerpt'
  | 'redistribute_full'
  | 'model_training';

export interface SourceRightsDecision {
  state: SourceRightsState;
  allowed_uses: SourceAllowedUse[];
  reviewer?: string;
  decision_date?: string;
  evidence_ref?: string;
  scope?: string;
  expiry?: string;
  territories?: string[];
}

export interface SourceAttribution {
  text: string;
  display_locations: string[];
}

export interface SourceArtifactManifestBase {
  schema_version: 1;
  source_id: `mw:source:${string}`;
  edition_id: `mw:edition:${string}`;
  locale: string;
  references?: string[];
  rights: SourceRightsDecision;
  transformations?: Array<{
    recipe: string;
    version: string;
    output_sha256: string;
  }>;
}

export type MetadataOnlySourceArtifactManifest = SourceArtifactManifestBase & {
  artifact: { representation: 'metadata_only'; media_type?: string };
  publication: { mode: 'metadata_only'; release_ref?: string };
};

export type SourceBytesManifest = SourceArtifactManifestBase & {
  artifact: {
    representation: 'source_bytes';
    media_type?: string;
    sha256: string;
    byte_length: number;
    retrieved_at?: string;
  };
  rights: SourceRightsDecision & {
    state: 'permitted';
    reviewer: string;
    decision_date: string;
    evidence_ref: string;
    scope: string;
  };
  attribution: SourceAttribution;
  complaint_process_owner: string;
  publication: { mode: 'source_bytes'; release_ref?: string };
};

export type SourceArtifactManifest = MetadataOnlySourceArtifactManifest | SourceBytesManifest;

type JsonSchemaValue =
  | string
  | number
  | boolean
  | null
  | readonly JsonSchemaValue[]
  | { readonly [key: string]: JsonSchemaValue };

export type JsonSchemaContract = boolean | { readonly [key: string]: JsonSchemaValue };

interface SchemaValidationError {
  instancePath: string;
  keyword: string;
  params: Record<string, unknown>;
  message?: string;
}

interface SchemaValidationFunction {
  (value: unknown): boolean;
  errors?: SchemaValidationError[] | null;
}

type AddFormatsFn = (ajvInstance: Ajv2020, options?: { mode?: 'fast' | 'full' }) => unknown;

function resolveAddFormats(): AddFormatsFn {
  const candidate = formatsModule as unknown as {
    default?: AddFormatsFn | { default?: AddFormatsFn };
  };
  if (typeof candidate.default === 'function') return candidate.default;
  if (candidate.default && typeof candidate.default.default === 'function') {
    return candidate.default.default;
  }
  throw new TypeError('Unable to resolve ajv-formats initializer');
}

function createAjvInstance(): Ajv2020 {
  const instance = new Ajv2020({ allErrors: true, strict: true });
  resolveAddFormats()(instance, { mode: 'full' });
  return instance;
}

const sharedAjv = createAjvInstance();
const compileSchema = sharedAjv.compile.bind(sharedAjv) as (
  schema: JsonSchemaContract
) => SchemaValidationFunction;

export function pointerForIssue(
  instancePath: string,
  keyword: string,
  params: Record<string, unknown>
): string {
  if (keyword === 'required' && typeof params.missingProperty === 'string') {
    return `${instancePath}/${params.missingProperty.replaceAll('~', '~0').replaceAll('/', '~1')}`;
  }
  if (keyword === 'additionalProperties' && typeof params.additionalProperty === 'string') {
    return `${instancePath}/${params.additionalProperty.replaceAll('~', '~0').replaceAll('/', '~1')}`;
  }
  return instancePath || '/';
}

export function createJsonSchemaValidator(
  schema: JsonSchemaContract,
  fallbackMessage = 'does not match the JSON Schema contract'
): (value: unknown) => KnowledgeValidationResult {
  const ajvInstance = createAjvInstance();
  const validate = ajvInstance.compile(schema) as unknown as SchemaValidationFunction;
  return (value) => {
    if (validate(value)) return { valid: true, issues: [] };
    const issues: KnowledgeValidationIssue[] = (validate.errors ?? []).map((error) => ({
      path: pointerForIssue(error.instancePath, error.keyword, error.params),
      keyword: error.keyword,
      message: error.message ?? fallbackMessage,
    }));
    return { valid: false, issues };
  };
}

const validateKnowledgeRecordContract = compileSchema(
  knowledgeRecordSchema as unknown as JsonSchemaContract
);
const validateSourceArtifactManifestContract = compileSchema(
  sourceArtifactManifestSchema as unknown as JsonSchemaContract
);

export function validateKnowledgeRecord(value: unknown): KnowledgeValidationResult {
  if (validateKnowledgeRecordContract(value)) return { valid: true, issues: [] };
  const issues: KnowledgeValidationIssue[] = (validateKnowledgeRecordContract.errors ?? []).map(
    (error) => ({
      path: pointerForIssue(error.instancePath, error.keyword, error.params),
      keyword: error.keyword,
      message: error.message ?? 'does not match the knowledge record contract',
    })
  );
  return { valid: false, issues };
}

export function isKnowledgeRecord(value: unknown): value is KnowledgeRecord {
  return validateKnowledgeRecordContract(value);
}

export function validateSourceArtifactManifest(value: unknown): KnowledgeValidationResult {
  if (validateSourceArtifactManifestContract(value)) return { valid: true, issues: [] };
  const issues: KnowledgeValidationIssue[] = (
    validateSourceArtifactManifestContract.errors ?? []
  ).map((error) => ({
    path: pointerForIssue(error.instancePath, error.keyword, error.params),
    keyword: error.keyword,
    message: error.message ?? 'does not match the source artifact manifest contract',
  }));
  return { valid: false, issues };
}

export { knowledgeRecordSchema, sourceArtifactManifestSchema };
