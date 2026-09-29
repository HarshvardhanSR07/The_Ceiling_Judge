/**
 * @file index.ts
 * @description Express application entry point.
 *
 * Startup sequence
 * ────────────────
 * 1. Import `authConfig` (throws immediately if JWT_SECRET is absent in prod)
 * 2. Connect to MongoDB
 * 3. Run idempotent seed (warns on failure, never blocks startup)
 * 4. Bind to the configured port
 * 5. Register SIGTERM / SIGINT handlers for graceful shutdown
 *
 * CORS
 * ────
 * The previous `cors({ origin: true, credentials: true })` reflected any
 * origin with credentials, which is equivalent to a wildcard bypass.  This
 * version reads the allowed origins from `config.corsOrigins` (a comma-
 * separated env var) and rejects all others.  For local dev the default list
 * includes localhost:5173 and localhost:8080.
 *
 * Graceful shutdown
 * ─────────────────
 * On SIGTERM (Docker stop / k8s pod termination), the server stops accepting
 * new connections, waits up to 10 seconds for in-flight requests to drain,
 * then closes the MongoDB connection and exits.  This prevents dropped
 * requests during rolling deploys.
 */

import express         from "express";
import cors            from "cors";
import cookieParser    from "cookie-parser";
import morgan          from "morgan";
import mongoose        from "mongoose";
import path            from "path";
import { fileURLToPath } from "url";

// Config is imported first so that a missing JWT_SECRET throws at startup
// rather than silently falling back to the committed dev default.
import { config }      from "./config/index.js";
import { authConfig }  from "./config/auth.js"; // validates JWT_SECRET

import { attachUser }       from "./middleware/auth.js";
import authRouter           from "./routes/auth.js";
import assignmentsRouter    from "./routes/assignments.js";
import projectsRouter       from "./routes/projects.js";
import scoresRouter         from "./routes/scores.js";
import exportRouter         from "./routes/export.js";
import judgesRouter         from "./routes/judges.js";
import { bootstrapSeed }    from "./seed/bootstrap.js";

// ---------------------------------------------------------------------------
// Application setup
// ---------------------------------------------------------------------------

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app       = express();

// --- CORS -------------------------------------------------------------------
// Reflect only the explicitly listed origins.  Requests from unlisted origins
// receive a CORS error; credentials (cookies) are still allowed for listed ones.
app.use(cors({
  origin(origin, callback) {
    // Allow same-origin and listed origins; block everything else
    if (!origin || config.corsOrigins.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error(`CORS: origin "${origin}" is not allowed`));
  },
  credentials: true,
}));

// --- Body parsing & logging ------------------------------------------------
app.use(express.json());
app.use(cookieParser());
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

// --- Auth user resolution --------------------------------------------------
// Populates req.user on every request before any route handler runs.
app.use(attachUser);

// --- API routes ------------------------------------------------------------
app.use(authRouter);
app.use(assignmentsRouter);
app.use(projectsRouter);
app.use(scoresRouter);
app.use(exportRouter);
app.use(judgesRouter);

// --- Health check ----------------------------------------------------------
app.get("/health", (_req, res) => res.json({ ok: true, service: "forge-backend" }));

// --- Static frontend -------------------------------------------------------
// Serves the Vite build output if present.  In development, Vite runs its own
// dev server; this path is only active in the Docker Compose production stack.
const publicDir = path.join(__dirname, "../../frontend/dist");

app.use(express.static(publicDir));

// Catch-all SPA fallback — sends index.html for any non-API path so that
// client-side routing works after a hard refresh.
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api") || req.path === "/projects") return next();
  res.sendFile(path.join(publicDir, "index.html"), (err) => {
    if (err) res.status(404).send("Forge API is running. Frontend not built yet.");
  });
});

// ---------------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  // Validate JWT_SECRET early (authConfig import above already runs this check,
  // but an explicit log here confirms it in the startup trace).
  void authConfig.jwtSecret; // referenced so the import is not tree-shaken

  await mongoose.connect(config.mongoUri);
  console.log("[forge] connected to MongoDB:", config.mongoUri.replace(/\/\/.*@/, "//<creds>@"));

  // Run idempotent seed — safe to call on every boot.
  // A seed failure is a warning, not a fatal error, so existing data is not blocked.
  try {
    await bootstrapSeed();
    console.log("[forge] seed complete");
  } catch (err) {
    console.warn("[forge] seed warning (non-fatal):", (err as Error).message);
  }

  const server = app.listen(config.port, () => {
    console.log(`[forge] listening on http://localhost:${config.port}`);
  });

  // --- Graceful shutdown ---------------------------------------------------
  // On SIGTERM (Docker / k8s pod stop), drain in-flight requests before exit.
  const shutdown = (signal: string) => async () => {
    console.log(`[forge] received ${signal} — shutting down gracefully`);
    server.close(async () => {
      try {
        await mongoose.connection.close();
        console.log("[forge] MongoDB connection closed");
      } catch (err) {
        console.error("[forge] error closing MongoDB:", err);
      }
      process.exit(0);
    });

    // Hard-kill after 10 seconds if drain takes too long
    setTimeout(() => {
      console.error("[forge] shutdown timed out — forcing exit");
      process.exit(1);
    }, 10_000).unref();
  };

  process.once("SIGTERM", shutdown("SIGTERM"));
  process.once("SIGINT",  shutdown("SIGINT"));
}

main().catch((err) => {
  console.error("[forge] fatal startup error:", err);
  process.exit(1);
});
