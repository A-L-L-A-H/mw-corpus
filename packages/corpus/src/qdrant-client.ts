// Qdrant client with optional offline fallback
// Uses injected fetch for testability
export interface Point {
  id: string | number;
  vector: number[];
  payload?: Record<string, unknown>;
}

export class QdrantClient {
  private fetchFn: typeof fetch;
  private url?: string;
  private apiKey?: string;
  private offlineStore: Map<string, Map<string | number, Point>> = new Map();

  constructor(options: { fetch?: typeof fetch; url?: string; apiKey?: string } = {}) {
    this.fetchFn = options.fetch ?? fetch;
    this.url = options.url ? options.url.replace(/\/+$/, '') : undefined;
    this.apiKey = options.apiKey;
  }

  private getHeaders(): HeadersInit {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.apiKey) headers['API-KEY'] = this.apiKey;
    return headers;
  }

  async upsert(collection: string, points: Point[]): Promise<void> {
    if (!this.url) {
      // offline: store points locally per collection, replace existing by id
      let colStore = this.offlineStore.get(collection);
      if (!colStore) {
        colStore = new Map();
        this.offlineStore.set(collection, colStore);
      }
      for (const p of points) colStore.set(p.id, p);
      return;
    }
    const endpoint = `${this.url}/collections/${encodeURIComponent(collection)}/points?wait=true`;
    const resp = await this.fetchFn(endpoint, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify({ points }),
    });
    if (resp.ok === false) {
      throw new Error(`Qdrant upsert failed with status ${resp.status}`);
    }
  }

  // simple cosine similarity search over offline store
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length === 0 || b.length === 0 || a.length !== b.length) return 0;
    const dot = a.reduce((sum, v, i) => sum + v * b[i], 0);
    const normA = Math.sqrt(a.reduce((s, v) => s + v * v, 0));
    const normB = Math.sqrt(b.reduce((s, v) => s + v * v, 0));
    if (normA === 0 || normB === 0) return 0;
    return dot / (normA * normB);
  }

  async search(
    collection: string,
    vector: number[],
    topK: number = 5,
  ): Promise<Point[]> {
    if (topK <= 0) return [];
    if (!this.url) {
      // offline: brute‑force search in memory
      const colStore = this.offlineStore.get(collection);
      if (!colStore) return [];
      const results = Array.from(colStore.values())
        .map((p) => ({ point: p, score: this.cosineSimilarity(vector, p.vector) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, topK)
        .map((r) => r.point);
      return results;
    }
    const endpoint = `${this.url}/collections/${encodeURIComponent(collection)}/points/search`;
    const resp = await this.fetchFn(endpoint, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ vector, limit: topK }),
    });
    if (resp.ok === false) {
      throw new Error(`Qdrant search failed with status ${resp.status}`);
    }
    const data = (await resp.json()) as { result?: Point[] };
    return data.result ?? [];
  }
}
