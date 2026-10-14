# Fieldwise — Farmer Query Advisory

A responsive React and Express application for agricultural information. It includes authentication, a farmer dashboard, an AI assistant with persisted query history, a source-attributed crop knowledge directory, and an Open-Meteo weather page. AI still requires credentials; disease image validation exists but a disease classification provider is not connected.

## Requirements

- Node.js 20 or newer and npm
- MongoDB running locally or a MongoDB connection string

## Install and configure

From the repository root:

```powershell
npm install
Copy-Item server/.env.example server/.env
```

Edit `server/.env` and set at least `MONGODB_URI` and a unique, random `JWT_SECRET` (32 or more random bytes is a good choice). The server resolves this file relative to `server/server.js`, so both the root npm scripts and `node server/server.js` load the same configuration regardless of the shell's working directory. A non-empty operating-system environment variable takes precedence; a blank `JWT_SECRET` falls back to the configured file value. Never commit `.env` files or put provider secrets in the browser environment. MongoDB can be local or hosted; the configured URI must be reachable by the server.

## Run

Start both development servers from the root:

```powershell
npm run dev
```

Open <http://localhost:5173>. The API runs at <http://localhost:5000>; check <http://localhost:5000/api/health> for API and database status. To run either process separately:

```powershell
npm run dev --prefix server
npm run dev --prefix client
```

Create the production client bundle with `npm run build`. Start the API with `npm start` (root) or `npm start --prefix server`.

## Configuration

The backend loads `server/.env`. `server/.env.example` documents configuration without real credentials:

- `MONGODB_URI` — required for persistent data and database-backed features.
- `JWT_SECRET` — required for authentication; no default secret is provided.
- `PORT` — API port, default `5000`.
- `CLIENT_URL` — allowed browser origin, default `http://localhost:5173`.
- `AI_PROVIDER=openai`, `AI_API_KEY`, `AI_MODEL` — optional assistant provider settings. The key must be a valid OpenAI API key with API access and available quota; it belongs only in the ignored `server/.env`, never in `client/.env` or browser code. Restart the backend after changing it.
- `AI_TIMEOUT_MS` — optional provider request timeout in milliseconds (1,000–120,000; default `45,000`). Invalid values use the default.
- Weather uses the Open-Meteo forecast and geocoding APIs without an API key for non-commercial use. See [weather provider notes](docs/weather-provider.md) for attribution and service limits.
- `MAX_UPLOAD_MB` — optional lower disease-image limit in MB; the server never allows more than 5 MB.
- `DISEASE_PROVIDER`, `DISEASE_MODEL`, `DISEASE_API_URL`, `DISEASE_API_KEY` — optional disease image provider. The provider ID must currently be `http-json` and conform to the documented contract.
- `DISEASE_TIMEOUT_MS` — optional provider timeout in milliseconds, clamped between 1,000 and 60,000 (default `20,000`).

The browser optionally reads `VITE_API_URL`, which defaults to same-origin `/api`. Vite proxies `/api` to the backend at `http://127.0.0.1:5000` during development, so LAN/mobile browsers do not try to reach their own `localhost`. For deployment, keep `/api` when a reverse proxy serves the API on the same origin, or set `VITE_API_URL` to the full API origin and path when the API is hosted separately. Restart Vite after changing client environment configuration. Disease image uploads accept JPEG, PNG, and WebP up to 5 MB. Images are kept in memory for the request, are not saved by this application, and are sent only after the farmer submits the form. The analysis provider is optional; upload validation works without one, but no diagnosis is returned unless a compatible provider is configured. See [the disease provider contract](docs/disease-image-provider.md) before configuring one. Live AI responses require provider credentials; weather responses require network access to Open-Meteo, but no weather credential.

## Assistant and conversation history

The assistant API is protected by the same bearer-token middleware as the farmer profile. New entries are created at `POST /api/queries`; history is available at `GET /api/queries` with optional `page`, `limit` (maximum 100), and literal `search` parameters. Query detail and delete operations are scoped to the authenticated account. The server calls the OpenAI Chat Completions API through `AI_PROVIDER=openai`; its bearer key remains in `server/.env`. Set nonblank `AI_PROVIDER=openai`, `AI_API_KEY`, and `AI_MODEL` values, then restart the backend. Provider authentication, rate-limit/quota, model, and timeout failures return safe messages; provider response details and credentials are not returned. Automated provider tests mock outbound HTTP requests and do not verify a live provider account.

## Crop knowledge

The public crop directory includes a small curated catalog for rice, wheat, maize, chickpea, and soybean in `server/data/cropKnowledge.js`. Each crop carries source organization, source URL, publication date when known, and a review date. The first catalog is intentionally conservative: crop-specific soil, duration, water, nutrient, harvest, or pest-management claims are marked unavailable when the selected sources do not substantiate them. The catalog is available without an AI key and even when MongoDB is disconnected; MongoDB-backed admin crop records remain supported as extensions. Season filters are limited to values represented by the cited records; unsupported filters are rejected. No fertilizer rates or pesticide instructions are included.

The crop content is currently English; common Hindi crop aliases are indexed for search, but the project does not yet contain a full localization framework.

## Authentication security note

The current browser client stores its JWT in `localStorage` and sends it as a bearer token. JavaScript running in the page origin can read that token, so a successful cross-site scripting (XSS) attack could steal and replay it until it expires. Frontend styling or other UI-only changes do not remove this risk. Keep server secrets out of browser environment variables and logs, validate and encode untrusted content, and consider moving sessions to `HttpOnly`, `Secure`, `SameSite` cookies with appropriate CSRF protection before production deployment.

## Checks

```powershell
npm test
npm run build
```

The health tests start an ephemeral local HTTP server and do not require MongoDB. A health response reports `database: "disconnected"` when no database connection is established; that does not mean persistence is ready.

For the current integration-test results, provider verification status, privacy review, and final submission checklist, see [the submission readiness checklist](docs/submission-checklist.md). To run the opt-in live MongoDB test, use an isolated loopback URI whose database name begins with `farmer_advisory_test_`; the test drops that test-only database after it finishes. Do not point it at a demonstration or production database.

## Project layout

```text
client/   React, Vite, Tailwind/PostCSS configuration, and browser UI
server/   Express app, API routes, controllers, models, services, and tests
docs/     Existing architecture, API, database, and project-plan notes
```
