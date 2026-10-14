# Submission readiness checklist

## Local run

1. Install Node.js 20+ and MongoDB Community locally, or obtain a development MongoDB URI.
2. From the repository root run:

   ```powershell
   npm install
   Copy-Item server/.env.example server/.env
   ```

3. Set `MONGODB_URI` and a unique, strong `JWT_SECRET` in `server/.env`. Optional AI settings are `AI_PROVIDER=openai`, `AI_API_KEY`, and `AI_MODEL`. Disease analysis additionally requires an exact compatible provider, model, HTTPS URL, and key; see `disease-image-provider.md`. Weather uses Open-Meteo and no key for non-commercial use; review `weather-provider.md` before deployment.
4. Run `npm run dev`, open <http://localhost:5173>, and check <http://localhost:5000/api/health> for `database: "connected"`.

## Verification record (12 October 2026)

- Full backend suite without live test database: **66 passed, 0 failed, 1 skipped** (the isolated MongoDB test is opt-in).
- Isolated MongoDB integration: **1 passed** using `mongodb://127.0.0.1:27017/farmer_advisory_test_phase8`; the test is restricted to loopback and `farmer_advisory_test_*` databases and dropped only that test database after completion. It covered registration, duplicate registration, login and incorrect password, authenticated profile/dashboard requests, mocked AI chat persistence, history and ownership isolation, curated crops without records, and an added database crop record. AI was mocked; this did not verify an AI vendor.
- Frontend production build: **passed** (`npm run build`).
- Browser walkthrough through the local UI: registration, login failure/success, logout, session restoration after reload, protected-route redirect, dashboard empty state, crop search/detail, missing-AI configuration state, and weather search failure were observed.
- Automated image-upload tests cover format validation and provider-unavailable responses. The browser walkthrough confirmed the disease upload screen's provider-unavailable explanation but did not submit a file because browser file-chooser automation is not installed. Forecast rendering with live weather and a mobile viewport were also not browser-verified.
- Live MongoDB: **verified** against a loopback test-only database. No production URI or user data was used.
- Live Open-Meteo: **not available from this environment**. A direct request resolved the host but the TCP connection to `api.open-meteo.com:443` failed with `EACCES`; the application safely presents a retryable unavailable state. No live weather result is claimed.
- Live AI and disease providers: **not configured or verified**. Provider behavior tests mock HTTP; the UI clearly reports assistant configuration is missing and disease analysis requires a provider.
- Lint: no lint script or lint dependency is configured. Server syntax checks passed in the Phase 7 verification; Vite production compilation passed here.
- Startup without `MONGODB_URI`: logged that database features are unavailable, returned health `database: "disconnected"`, and registration returned HTTP 503 when `JWT_SECRET` was missing. An isolated failing loopback test URI logged only `MongooseServerSelectionError`; health remained `disconnected`.

To rerun the isolated MongoDB integration safely from the `server` directory, use the following PowerShell commands. The integration test itself refuses non-loopback hosts, credentialed URIs, and database names without the explicit test prefix, and it removes only that test database.

```powershell
$env:MONGODB_TEST_URI = 'mongodb://127.0.0.1:27017/farmer_advisory_test_local'
node --test tests/query.persistence.integration.test.js
Remove-Item Env:MONGODB_TEST_URI
```

## Provider and privacy review before a public demo

- OpenAI chat sends each farmer question, selected language, profile location, and only matching crop context to the configured backend provider. API usage is token-metered, with model pricing and rate limits determined by the current account/model; check [OpenAI API pricing](https://developers.openai.com/api/docs/pricing) and [rate limits](https://developers.openai.com/api/docs/guides/rate-limits). Review current [API data controls](https://developers.openai.com/api/docs/guides/your-data); provider policy and retention settings may change. Add spend limits and do not send identifying or sensitive farm information unless the deployment has an appropriate privacy basis.
- Disease photos leave the server only when a compatible provider is configured. No vendor is selected or verified; assess cost, rate limits, image retention/training, processing location, and applicable privacy requirements before enabling one.
- Open-Meteo free API use is currently non-commercial, requires attribution, and has usage limits/no uptime guarantee. Confirm current [pricing](https://open-meteo.com/en/pricing) and [terms](https://open-meteo.com/en/terms); use a suitable commercial plan/provider for a commercial deployment.
- JWTs currently live in browser `localStorage`, so an XSS flaw could expose them. Review `README.md`; consider a separately planned `HttpOnly`, `Secure`, `SameSite` cookie migration with CSRF protections before production use.
- The disease upload checks MIME/container metadata and image dimensions, not full pixel decode or malware scanning. Reverse proxies and providers may retain request data under their own policies.

## Final checks before submission

- [ ] Confirm `.env` and provider secrets are not committed; there is currently no `.git` directory in this workspace, so initialize/review version control before submission.
- [ ] Keep MongoDB test credentials and test-only databases separate from any demonstration or production data.
- [ ] Run `npm test` and `npm run build` after the final code edit; record skipped tests.
- [ ] For a full live demonstration, configure MongoDB, add a compatible AI provider, and use a weather network/provider reachable from the demo host.
- [ ] Present disease classification as unavailable until a real compatible provider has been configured and tested.
- [ ] Cite crop-source metadata and explain that crop and weather content is general information requiring local confirmation.
- [ ] Check the deployment's privacy notice, provider terms, secret storage, HTTPS, backups, and data deletion behavior.
