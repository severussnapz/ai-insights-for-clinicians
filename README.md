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
- Inline troubleshooting hints for common API failures
- Export options: TXT, Markdown, PDF
- Local draft and version history (save, load, delete)

## Run Locally

No build tooling is required.

1. Open index.html in your browser.
2. Enter your reflection context.
3. Choose either Generate With AI or Generate Draft Only.
4. Copy and paste any section into your appraisal workflow.

## AI Setup

In the AI Connection Settings panel:

1. Select a provider preset:
	 - OpenAI
	 - Azure OpenAI
	 - OpenRouter
2. Confirm or edit API Endpoint and Model Name.
3. Paste API key.
4. Fill provider-specific optional fields when relevant.
5. Optionally enable "Remember endpoint and model".
6. Click Test Connection before generating output.

Model templates:

- The app now shows one-click model template chips per selected provider.
- Clicking a chip fills the Model Name field instantly.
- If you type a custom model, it remains supported.

Connection testing:

- Use Test Connection to validate endpoint, model/deployment, key, and provider request format.
- If the check fails, inline troubleshooting hints are shown with likely causes and fixes.
- After a successful test, a "last successful connection" badge shows provider, model, and timestamp.
- Use "Clear connection history" to remove stored last-connection metadata from this browser.

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

- API keys are used only in-browser for the current session and are not saved by default.
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
- Network/CORS failures: guidance to retry or use a backend proxy

## Exporting

- Export TXT: plain text output
- Export Markdown: heading-structured markdown output
- Export PDF: one-click PDF download of all generated sections

## Draft And Version History

- Save Version stores the current input and outputs in browser local storage.
- Load restores a saved version.
- Delete removes a saved version.
- Draft history is device/browser-local and not synced.

## Notes

- Keep entries de-identified.
- This tool supports drafting and reflection structure. It does not replace clinical judgment or official RCGP/FourteenFish documentation.
