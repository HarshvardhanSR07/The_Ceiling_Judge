# Forge

**Offline-first hackathon submission & judging portal**  
Built for Dogfood 2026 · Mathematical core: **IMBR** (Interactive Multi-Facet Bayesian Ranking) · Replaces Gavel

## Quick start

```bash
# 1. Place official fixtures next to docker-compose.yml
#    (download from https://dogfoodhack.com/spec → fixtures.json)

# 2. Start everything (network can be off after images are pulled)
docker compose up --build

# 3. Open http://localhost:8080
# 4. Seed prints auth headers — paste them into .dogfood.toml
# 5. Run the official checker
python3 run.py .dogfood.toml > acceptance-report.txt
```

## What it does

- Public gallery + project submission (T1)
- Backend-enforced role isolation (T2)
- Judge scoring via **IMBR** (soft preferences + optional facet feedback + clarifying questions)
- Organizer CSV export + live ranking
- Local RAG assistance (Ollama + LanceDB)
- Fully offline after first model pull

## Documentation

| File | Purpose |
|------|---------|
| `ARCHITECTURE.md` | System design |
| `DATA-MODEL.md` | Schema & import/export |
| `JUDGING.md` | **IMBR mathematics** (most important for points) |

## License

MIT
