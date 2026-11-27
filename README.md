# mw-corpus — Immutable epistemic source corpus with HTTP and MCP citation APIs.

**Repository:** [`A-L-L-A-H/mw-corpus`](https://github.com/A-L-L-A-H/mw-corpus) · **Stack:** TypeScript · Bun · Docker

## What it does

Stores versioned RGBL/Q4Q/Asmaul Husna references with SHA-256 provenance and strict eight-layer separation.

## Quick start

```bash
bun install
bun run build
bun run start
```

## Verify

```bash
bun test
bun run typecheck
```

## Configuration

- **Port:** 4420
- **Key configuration:** MW_CORPUS_PORT

```bash
docker build -t ghcr.io/a-l-l-a-h/mw-corpus:latest .
docker run -p 4420:4420 ghcr.io/a-l-l-a-h/mw-corpus:latest
```

## Notes

Each record carries one explicit epistemic layer and origin actor; unlabeled records fail closed.
