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

If another local service already uses backend port `5000`, start both app servers on an available port instead (the frontend proxy follows the same `PORT` value):

```powershell
$env:PORT = '5001'
npm run dev
```

Open the frontend URL printed by Vite. The API listens on port `5000` by default, or the selected `PORT`; check `/api/health` on that port for API and database status. To run either process separately:

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
- `AI_PROVIDER` — `openai` (default), `groq`, or `ollama`.
- `AI_API_KEY`, `AI_MODEL` — backend provider credentials and model. OpenAI and Groq require a provider key; Ollama does not. Put provider keys only in ignored `server/.env` or the backend host's secret settings, never in `client/.env` or browser code. For Ollama, `AI_MODEL` must name a model installed in Ollama.
- `AI_TIMEOUT_MS` — optional provider request timeout in milliseconds (1,000–120,000; default `45,000`). Invalid values use the default.
- `OLLAMA_BASE_URL` — optional Ollama server origin, default `http://127.0.0.1:11434`.
- Weather uses the Open-Meteo forecast and geocoding APIs without an API key for non-commercial use. See [weather provider notes](docs/weather-provider.md) for attribution and service limits.
- `MAX_UPLOAD_MB` — optional lower disease-image limit in MB; the server never allows more than 5 MB.
- `DISEASE_PROVIDER`, `DISEASE_MODEL`, `DISEASE_API_URL`, `DISEASE_API_KEY` — optional disease image provider. The provider ID must currently be `http-json` and conform to the documented contract.
- `DISEASE_TIMEOUT_MS` — optional provider timeout in milliseconds, clamped between 1,000 and 60,000 (default `20,000`).

The browser optionally reads `VITE_API_URL`, which defaults to same-origin `/api`. Vite proxies `/api` to the backend at `http://127.0.0.1:5000` during development, so LAN/mobile browsers do not try to reach their own `localhost`. For deployment, keep `/api` when a reverse proxy serves the API on the same origin, or set `VITE_API_URL` to the full API origin and `/api` path when the API is hosted separately. Restart Vite after changing client environment configuration. Disease image uploads accept JPEG, PNG, and WebP up to 5 MB. Images are kept in memory for the request, are not saved by this application, and are sent only after the farmer submits the form. The analysis provider is optional; upload validation works without one, but no diagnosis is returned unless a compatible provider is configured. See [the disease provider contract](docs/disease-image-provider.md) before configuring one. Live AI responses require provider credentials; weather responses require network access to Open-Meteo, but no weather credential.

## Production deployment (Render, Vercel, and MongoDB Atlas)

Create a MongoDB Atlas cluster and database user, and create a Groq API key before deploying. In Atlas Network Access, allow the Render service's outbound IP range or configure dedicated outbound IPs for the Render service. Do not use `0.0.0.0/0` as a permanent database access rule. MongoDB Atlas accepts the standard `mongodb+srv://` connection string through `MONGODB_URI`; store it only in Render's backend environment settings. See [Atlas IP access lists](https://www.mongodb.com/docs/atlas/security/ip-access-list/) and [Render outbound IP addresses](https://render.com/docs/outbound-ip-addresses).

Deploy the backend as a Render Web Service from this repository with **Root Directory** `server`, **Build Command** `npm install`, and **Start Command** `npm start`. Render supplies `PORT`; the server listens on that port. Set the Render health check path to `/api/health`. The endpoint returns only API status and whether MongoDB is connected.

Set these backend environment variables in the Render dashboard. Enter secret values directly in the dashboard; do not commit them or put them in Vercel variables.

| Variable | Requirement | Value |
| --- | --- | --- |
| `MONGODB_URI` | Required | Atlas application connection string (`mongodb+srv://...`) |
| `JWT_SECRET` | Required | Unique, randomly generated secret with at least 32 random bytes |
| `CLIENT_URL` | Required for browser access | Exact Vercel production origin, such as `https://your-app.vercel.app`, with no path or trailing slash |
| `AI_PROVIDER` | Required for Groq advice | `groq` |
| `AI_API_KEY` | Required for Groq advice | Groq API key; backend only |
| `AI_MODEL` | Required for Groq advice | A model ID enabled for your Groq account |
| `JWT_EXPIRES_IN` | Optional | Token lifetime; defaults to `7d` |
| `AI_TIMEOUT_MS` | Optional | Provider request timeout in milliseconds; defaults to `45000` |
| `MAX_UPLOAD_MB` | Optional | Disease image upload limit; defaults to 5 MB |

The disease image provider is not required for deployment. Configure `DISEASE_PROVIDER`, `DISEASE_MODEL`, `DISEASE_API_URL`, and `DISEASE_API_KEY` only if using a compatible provider; `DISEASE_TIMEOUT_MS` is optional. Weather uses Open-Meteo and requires no API key. `PORT` is supplied by Render. Do not set `AUTH_LOGIN_DIAGNOSTICS` to `true` in production.

Create a separate Vercel project for the same repository with **Root Directory** `client`, **Build Command** `npm run build`, and **Output Directory** `dist`. Use the Vite framework preset and set this non-secret environment variable for Production:

```text
VITE_API_URL=https://your-render-service.onrender.com/api
```

Deploy the backend first, then deploy the frontend. Set Render's `CLIENT_URL` to the Vercel production origin and set Vercel's `VITE_API_URL` to the Render service URL ending in `/api`. The backend CORS configuration allows the exact `CLIENT_URL` origin; it does not allow every origin. `client/vercel.json` supplies the SPA fallback so direct visits and refreshes on routes such as `/assistant` work. See [Vercel's Vite deployment guide](https://vercel.com/docs/frameworks/frontend/vite) and [monorepo setup](https://vercel.com/docs/monorepos).

## Assistant and conversation history

The assistant API is protected by the same bearer-token middleware as the farmer profile. New entries are created at `POST /api/queries`; history is available at `GET /api/queries` with optional `page`, `limit` (maximum 100), and literal `search` parameters. Query detail and delete operations are scoped to the authenticated account. The backend supports OpenAI and Groq chat completions and keeps their API keys server-side. Set `AI_PROVIDER` to the chosen provider, then configure its `AI_API_KEY` and an available `AI_MODEL` in backend environment settings. For local Ollama, install/start Ollama, pull a model with `ollama pull <model-name>`, set `AI_PROVIDER=ollama` and `AI_MODEL=<same-model-name>`, and optionally set `OLLAMA_BASE_URL`. Ollama must be running where the backend can reach it. Provider authentication, rate-limit/quota, model, and timeout failures return safe messages; provider response details and credentials are not returned. Automated provider tests mock outbound requests and do not verify a live provider account or local Ollama installation.

If the server reports missing configuration, confirm you edited `server/.env` (not the root `.env.example`), check that the selected provider, model, and required OpenAI key are nonblank, and restart the backend. HTTP 502/503 errors describe provider auth, model, quota, or availability issues; HTTP 504 indicates the configured request timed out. Never place provider keys in Vite variables because they are bundled for browser use.

The root `.env.example` is a reference template only. If a provider key was ever committed to a repository, revoke it and create a replacement; keep the replacement only in the backend's secret settings or ignored `server/.env`.

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
