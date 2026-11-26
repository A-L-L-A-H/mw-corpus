# `@moonwitness/corpus` (`mw-corpus`)

Standalone **MoonWitness Immutable Source Corpus, RGBL / Q4Q / Asmaul Husna & 8-Layer Epistemic Provenance Archive** built in TypeScript / Bun with zero workspace dependencies.

## Quickstart

```sh
bun install
bun test
bun run build
bun run start
```

The zero-dependency Bun HTTP + MCP Citation Server listens on `MW_CORPUS_PORT` (default `4420`).

## Architecture & Guarantees

### 1. 8-Layer Epistemic Separation & Canon Provenance (`src/epistemic-layers.ts`)

Every corpus record MUST carry an explicit single `epistemicLayer` and `originActor`; unlabeled or collapsed multi-layer records are rejected fail-closed:

1. `source_text` — Verbatim source-language scripture bytes with pinned edition, locator, SHA-256 digest, and attribution.
2. `textual_witness` — Specific surviving textual witness, expression, edition, and passage backed by a pinned source artifact.
3. `translation` — Target-language rendering or transliteration bound to a source edition, locale, and translator attribution.
4. `tafsir` — Classical or scholarly exegesis attributed to author, tradition, and edition/source reference.
5. `historical_context` — Historical, philological, or independent research context backed by explicit citations.
6. `personal_reflection` — Owner/user reflection strictly separated from scripture and scholarly tafsir.
7. `creative_metaphor` — Conceptual framework (e.g. RGBL / CRAYON), mnemonic, or narrative metaphor.
8. `ai_hypothesis` — AI-generated draft, synthesis, or hypothesis with `originActor: "ai_assistant"`, `modelId`, and `reviewState`.

Enforced locked governance rules (`CAN-0011..0014`):

- **`CAN-0011`**: Rejects any claim or depiction of Allah as a human, character, or visual object.
- **`CAN-0012`**: Rejects silent canon overwrites or revisions that drop historical versions without preserving source references/digests.
- **`CAN-0013`**: Strictly separates original user ideas from AI-generated drafts, proposals, and assumptions.
- **`CAN-0014`**: Strictly separates scripture text, textual witness, translation, tafsir, historical context, personal reflection, creative metaphor, and AI hypothesis.

### 2. Versioned Q4Q 4-Kitab Comparative Witness Mapping (`src/q4q-schema.ts`)

Schema `moonwitness-q4q/v1` (`schemas/q4q-mapping.schema.json`) models comparative references across **Taurat**, **Zabur**, **Injil**, and **Qur’an** with explicit `evidenceClass` values:

- `Q_EXPLICIT` · `Q_CROSS` · `TRADITION` · `CREED` · `SYNTHESIS` · `HYPOTHESIS`

Policy invariants fail closed on identity collapse:

- `policy.inferIdentityEquivalence === false`
- `policy.canonImpliesRevelationIdentity === false`
- `entry.equatesWitnessToRevelation === false`

Surviving textual witness editions (e.g., `mw:edition:webp-protestant-2020-stable`) remain strictly distinct from named `RevelationIdentity` entities (`mw:work:*-revelation`).

### 3. Zero-Dependency Bun HTTP + MCP Citation Server (`src/server.ts`)

| Endpoint | Description |
| --- | --- |
| `GET /health` | Service status, indexed passage counts, 8-layer & 99-name readiness |
| `GET /api/passages` | Verified passages (`?kind=all\|quran\|textual_witness`, `?q=`, `?edition=`, `?locator=`) |
| `GET /api/asmaul-husna` | 99-name canonical dataset & concept graph (`?ordinal=`, `?cluster=`, `?q=`, `?related=true`) |
| `GET /api/epistemic-layers` | 8 epistemic layers, `CAN-0011..0014` rules, and Q4Q metadata |
| `POST /api/validate-record` | Validates epistemic provenance records or `moonwitness-q4q/v1` mappings |
| `POST /api/mcp` | JSON-RPC 2.0 MCP endpoint (`corpus_search_passages`, `corpus_get_asmaul_husna`, `corpus_validate_epistemic`) |

### 4. Immutable Offline Ingestion, Raw Artifacts & Dataset Releases

- **Deterministic ingestion (`src/ingestion.ts`)**: Pinned local recipe (`schemas/ingestion-recipe.schema.json`), duplicate-key-safe RFC 8785 canonical JSON, SHA-256 snapshot verification, immutable staging + atomic publication.
- **Content-addressed raw artifacts (`src/raw-artifact-store.ts`)**: `putRawArtifact` / `readRawArtifact` under `sha256/<prefix>/<digest>` with idempotent writes and corruption detection.
- **Pinned Qur’an & textual witness slices (`src/quran-passage.ts`, `src/textual-witness-passage.ts`)**: Offline verified `corpus/manifests/quran-passage-index.json` (Tanzil v1.1 Uthmani `Q7:46`) and `corpus/manifests/textual-witness-index.json` (WEBP 2020 `Genesis 1:1`).
- **Private archive intake (`src/private-archive-manifest.ts`)**: Consent-bound external intake metadata and non-overwriting atomic copy outside workspace roots.
- **Immutable dataset release pointers (`src/dataset-release.ts`)**: Content-addressed release manifests, atomic rollback, and deterministic snapshot replay.

## Docker

```sh
docker build -t ghcr.io/a-l-l-a-h/mw-corpus:latest .
docker run -p 4420:4420 ghcr.io/a-l-l-a-h/mw-corpus:latest
```
