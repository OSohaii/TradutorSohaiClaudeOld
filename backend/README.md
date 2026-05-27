# MangaLens Backend BFF

Backend for Front (BFF) that proxies all third-party AI/translation providers
(Gemini, Ichigo, Torii, DeepL, Google Translate) so the React frontend never
has to handle API keys or hit external services directly.

## Why this exists

Before this backend was introduced, the frontend embedded the Gemini API key
in the production JS bundle and used `corsproxy.io` to reach Ichigo, Torii,
DeepL and Google Translate. Both are insecure: the key was extractable by any
visitor, and `corsproxy.io` saw every bearer token and image that passed
through it.

With this backend in place:

- Provider keys live in environment variables on the server, never on the
  client.
- The frontend talks only to this backend; the backend talks to providers
  server-to-server (no CORS proxy needed).
- Users can still bring their own keys (BYOK) per request.

## Running locally

Requires Python 3.11 or newer.

```bash
cd backend
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env               # then fill in any keys you want to use
uvicorn app.main:app --reload --port 8000
```

The frontend's Vite dev server proxies `/api/*` to `http://localhost:8000`,
so once the backend is running you can keep using `npm run dev` from the
project root as usual.

## API surface

All routes are prefixed with `/api`.

| Method | Path                  | Purpose                                       |
|--------|-----------------------|-----------------------------------------------|
| GET    | `/health`             | Liveness probe (returns `{ "status": "ok" }`) |
| POST   | `/pipeline`           | Full OCR + translation + optional cleaner     |
| POST   | `/translate`          | Standalone bubble translation                 |
| POST   | `/ichigo/login`       | Exchange Ichigo email/password for a token    |

### BYOK headers (all optional)

The backend uses its server-configured key by default. Clients can override
on a per-request basis by sending one of these headers; no key is persisted
server-side.

| Header              | Used by                                       |
|---------------------|-----------------------------------------------|
| `X-Byok-Gemini`     | All `gemini-*` engines                        |
| `X-Byok-Deepl`      | DeepL engine                                  |
| `X-Byok-Torii`      | Torii engine and Torii inpaint cleaner        |
| `X-Byok-Google`     | Google Cloud Translate paid endpoint (opt.)   |
| `X-Byok-Ichigo`     | Ichigo engine (the bearer token from login)   |

### Error format

Errors are returned as structured JSON so the frontend can react precisely:

```json
{
  "error": {
    "code": "AUTH",
    "engine": "ichigo",
    "message": "Sessão Ichigo expirada ou acesso negado.",
    "recoverable": false
  }
}
```

`code` is one of: `AUTH`, `RATE_LIMIT`, `QUOTA`, `INVALID_KEY`,
`INVALID_INPUT`, `NETWORK`, `UNKNOWN`.

## Layout

```
app/
├── main.py            FastAPI bootstrap, CORS, routers
├── config.py          Pydantic Settings (.env loader)
├── deps.py            BYOK extractor + key resolver
├── errors.py          ProviderError + structured exception handler
├── schemas/           Request/response models (camelCase JSON)
├── providers/         One module per third-party API
├── services/
│   └── pipeline.py    Orchestrator (asyncio.gather + plan_pipeline)
└── routers/           HTTP handlers (thin layer)
tests/                 Smoke + schema tests (no real network calls)
```

## Tests

```bash
pytest -q
```

Tests run without any provider credentials and never hit the network.
