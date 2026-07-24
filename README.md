# AI Insights for Clinicians

AI Insights for Clinicians is a static single-page website that helps clinicians produce concise, appraisal-ready reflective writing.

## Features

- Simple clinical reflection input form
- Entry type selector (Learning Log, Case Review, Significant Event, Consultation Reflection, PDP Plan)
- Generated AI prompt template aligned with:
	- common FourteenFish-style portfolio structure
	- RCGP reflective practice headings/themes
- Clean, copy-ready output sections:
	- AI Prompt
	- Suggested Entry Summary
	- Learning Points
	- Action Plan
	- Capability Mapping (RCGP style)
- One-click copy on each field plus Copy All
- AI API generation mode (with draft fallback)
- Secure backend proxy mode (recommended) with server-side API keys
- Structured safeguards: PHI pattern screening and clinician acknowledgment gate
- Tone and length controls for output quality
- Regenerate-by-section controls (Summary, Learning Points, Action Plan)
- Inline troubleshooting hints for common API failures
- Export options: TXT, Markdown, PDF
- Local draft and version history (save, load, delete)

## Run Locally

No build tooling is required.

1. Open a terminal in `backend`.
2. Create and activate a virtual environment:
	- `python3 -m venv .venv`
	- `source .venv/bin/activate`
3. Install dependencies:
	- `pip install -r requirements.txt`
4. Create env file from template:
	- `cp .env.example .env`
5. Add at least one provider key in `.env`:
	- `OPENAI_API_KEY=...` or `AZURE_OPENAI_API_KEY=...` or `OPENROUTER_API_KEY=...`
6. Start the backend (which now also serves the frontend):
	- `python app.py`
7. Open `http://localhost:8000` in your browser.

## Secure Backend Proxy (Recommended)

This keeps provider keys on your server instead of in the browser.

1. Open a terminal in `backend`.
2. Create a virtual environment:
	- `python3 -m venv .venv`
	- `source .venv/bin/activate`
3. Install dependencies:
	- `pip install -r requirements.txt`
4. Create env file from template:
	- `cp .env.example .env`
5. Add at least one provider key in `.env`:
	- `OPENAI_API_KEY=...` or `AZURE_OPENAI_API_KEY=...` or `OPENROUTER_API_KEY=...`
6. Start the backend:
	- `python app.py`
7. In frontend settings:
	- keep secure backend mode enabled (always-on)
	- click `Test Connection`

Backend endpoints:

- `GET /health`
- `POST /api/test-connection`
- `POST /api/generate`

Error contract:

- Failed backend responses include: `ok=false`, `error`, `errorCode`, `requestId`
- Common `errorCode` values:
	- `INVALID_JSON`
	- `INVALID_PAYLOAD`
	- `PROMPT_REQUIRED`
	- `VALIDATION_ERROR`
	- `UPSTREAM_NETWORK_ERROR`
	- `UPSTREAM_ERROR`
	- `ORIGIN_NOT_ALLOWED`

## Deployment And Hardening

### Stable hosted deployment (single service)

Deploy only the `backend` service. It now serves:

- Frontend UI at `/`
- API endpoints at `/health`, `/api/test-connection`, `/api/generate`

This gives one stable URL for you and colleagues, and avoids temporary tunnel expiry.

Recommended flow on Render:

1. Create a new Web Service from this repo.
2. Set Root Directory to `backend`.
3. Build command: `pip install -r requirements.txt`
4. Start command: `gunicorn -w 2 -b 0.0.0.0:$PORT app:app`
5. Add environment variable(s):
	- `OPENAI_API_KEY` (or Azure/OpenRouter equivalent)
	- `ALLOWED_ORIGINS` set to your Render domain (for example `https://your-app.onrender.com`)
6. Deploy and share the single Render URL.

### Backend security defaults

- CORS allowlist is controlled by `ALLOWED_ORIGINS` (comma-separated exact origins).
- Requests from disallowed origins are rejected with 403.
- Every response includes `X-Request-ID` for traceability.

### Backend logging

- Structured JSON logs include event name, request ID, provider, status, and timing.
- Configure log level with `LOG_LEVEL`.

### Production backend run

- WSGI server: `gunicorn` (configured in `backend/Procfile`)
- Python runtime pin: `backend/runtime.txt`

Example:

1. `cd backend`
2. `pip install -r requirements.txt`
3. `gunicorn -w 2 -b 0.0.0.0:$PORT app:app`

### Render deployment scaffold

- `backend/render.yaml` includes a deploy-ready service definition.
- Set provider keys as secret env vars in Render.
- Set `ALLOWED_ORIGINS` to your deployed frontend origin.

## AI Setup

In the AI Connection Settings panel:

1. Click `Check backend health` and then `Test Connection`.
2. Generate output once the backend is reachable.

In the reflection form:

- Select an `AI Agent` style:
	- `Balanced Coach`
	- `Concise Scribe`
	- `Reflective Mentor`

Provider, endpoint, model, and API keys are now managed on the backend and are not user-selectable in the frontend.

Auth modes:

- Proxy mode only: API keys are stored in backend environment variables.

Quality controls:

- Tone selector: Brief, Standard, Detailed
- Length selector: Short, Medium, Long
- Regenerate buttons on key sections:
	- Suggested Entry Summary
	- Learning Points
	- Action Plan

Regenerate actions still enforce safeguard checks before running.

Model templates:

- The app now shows one-click model template chips per selected provider.
- Clicking a chip fills the Model Name field instantly.
- If you type a custom model, it remains supported.

Connection testing:

- Use Test Connection to validate endpoint, model/deployment, key, and provider request format.
- If the check fails, inline troubleshooting hints are shown with likely causes and fixes.
- After a successful test, a "last successful connection" badge shows provider, model, and timestamp.
- Use "Clear connection history" to remove stored last-connection metadata from this browser.
- The AI settings panel includes a "Proxy health" badge and "Check backend health" action for quick backend availability checks.

### Provider Presets

- OpenAI:
	- Default endpoint: `https://api.openai.com/v1/chat/completions`
	- Uses `Authorization: Bearer <key>`
	- Requires model name
	- Quick models: gpt-4o-mini, gpt-4.1-mini, gpt-4.1, o4-mini

- Azure OpenAI:
	- Default endpoint: `https://your-resource.openai.azure.com`
	- Uses `api-key: <key>`
	- Supports API version field (default `2024-02-15-preview`)
	- Optional deployment name can be used to auto-build a deployment chat completions URL
	- Quick models: gpt-4o-mini, gpt-4o, gpt-4.1-mini, gpt-4.1

- OpenRouter:
	- Default endpoint: `https://openrouter.ai/api/v1/chat/completions`
	- Uses `Authorization: Bearer <key>`
	- Supports optional `HTTP-Referer` (Site URL) and `X-Title` (App Name) headers
	- Requires model name
	- Quick models: openai/gpt-4o-mini, openai/gpt-4.1-mini, anthropic/claude-3.5-sonnet, google/gemini-2.0-flash-001

Notes:

- In proxy mode, API keys are not required in-browser.
- In direct mode, API keys are used only in-browser for the current session and are not saved by default.
- If the AI request fails, the app automatically generates a local draft template instead.
- The app now shows provider-aware troubleshooting hints for common errors.

### Inline Troubleshooting

When AI generation fails, a troubleshooting panel appears with targeted suggestions for:

- 400: payload/request format issues
- 401: invalid API key
- 403: permission or policy restrictions
- 404: endpoint/deployment path issues
- 408/409/422: timeout/conflict/validation issues
- 429: rate limiting
- 5xx: provider service instability
- Network/CORS failures: guidance to retry and check backend availability/CORS settings

The frontend also shows a request diagnostics panel with backend metadata when available:

- HTTP status
- backend `errorCode`
- backend `requestId`
- selected provider context

## Structured Safeguards

Before generating output, the app enforces a safeguard flow:

- Mandatory confirmation that the entry is de-identified and clinician-reviewed.
- Pattern screening for potential identifiers (email, phone, date, postcode, NHS-number-like sequence).
- If potential identifiers are detected, a warning panel appears and requires explicit acknowledgment before generation.

This safeguard applies to both AI generation and draft-only generation.

## Exporting

- Export TXT: plain text output
- Export Markdown: heading-structured markdown output
- Export PDF: one-click PDF download of all generated sections

## Draft And Version History

- Save Version stores the current input and outputs in browser local storage.
- Load restores a saved version.
- Delete removes a saved version.
- Draft history is device/browser-local and not synced.

## Continuous Integration

- GitHub Actions workflow: `.github/workflows/ci.yml`
- Triggered on:
	- pushes to `main`
	- all pull requests
- CI checks:
	- installs backend dependencies
	- runs backend unit tests in `backend/tests`
	- compiles backend Python modules to catch syntax errors early

## Deployment Smoke Test

Run a lightweight backend smoke test after deployment to verify health and validation contracts.

1. Ensure backend is running.
2. Run:
	- `backend/scripts/smoke_test.sh http://localhost:8000`
	- or with your deployed URL, e.g. `backend/scripts/smoke_test.sh https://your-backend.example`

Checks included:

- `GET /health` returns 200 and JSON
- `POST /api/generate` with `{}` returns 400 and `errorCode=PROMPT_REQUIRED`
- `POST /api/generate` with invalid JSON returns 400 and `errorCode=INVALID_JSON`

## Notes

- Keep entries de-identified.
- This tool supports drafting and reflection structure. It does not replace clinical judgment or official RCGP/FourteenFish documentation.
