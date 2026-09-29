/**
 * @file config/index.ts
 * @description Application-level configuration.
 *
 * All five previously-scattered `DEFAULT_EVENT` constants are replaced by a
 * single canonical value here.  CORS origins are also listed here so they can
 * be tightened without hunting across route files.
 */

export const config = {
  /** HTTP port the Express server binds to. */
  port: Number(process.env.PORT ?? 8080),

  /** MongoDB connection URI. */
  mongoUri: process.env.MONGO_URI ?? "mongodb://127.0.0.1:27017/forge",

  /** Base URL of the local Ollama instance (embeddings / LLM summaries). */
  ollamaUrl: process.env.OLLAMA_URL ?? "http://127.0.0.1:11434",

  /** Base URL of the Python RAG microservice. */
  ragUrl: process.env.RAG_URL ?? "http://127.0.0.1:8001",

  /** Absolute path to the fixtures JSON loaded by the seed script. */
  fixturesPath: process.env.FIXTURES_PATH ?? "/app/fixtures.json",

  /**
   * The event ID used when no explicit `eventId` is supplied in a request.
   * Centralised here so changing it requires a single edit rather than five.
   */
  defaultEventId: process.env.DEFAULT_EVENT_ID ?? "evt_01",

  /**
   * Comma-separated list of allowed CORS origins.
   * Example: CORS_ORIGINS=https://forge.example.com,https://admin.forge.example.com
   *
   * Defaults to localhost dev origins.  In production, set this to the real
   * domain(s) so the wildcard-reflect behaviour is never active.
   */
  corsOrigins: (process.env.CORS_ORIGINS ?? "http://localhost:5173,http://localhost:8080")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),
} as const;
