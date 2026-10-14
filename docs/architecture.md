# Architecture

```text
React + Vite browser client
  ├── Auth context / React Router
  └── Axios REST client with JWT
          ↓ HTTP JSON or multipart
Express API (helmet, CORS, rate limit, error middleware)
  ├── Routes → controllers → Mongoose models → MongoDB
  └── Services → AI provider / weather provider / future ML provider
```

Provider credentials remain in the backend environment. AI, weather, and image analysis are behind service modules so provider changes do not require UI rewrites. Open-Meteo weather uses fixed backend endpoints and a bounded volatile cache; see `docs/weather-provider.md` for attribution, service terms, and limits. Query answers are persisted only after a real provider response arrives. Disease images use authenticated, rate-limited, bounded in-memory storage and are cleared after processing; the application does not persist the image or result. A compatible configured provider is required before any disease indication can be returned. See `docs/disease-image-provider.md` for the current JSON contract and privacy considerations. The client communicates through the configurable API base URL and sends JWT bearer tokens for protected endpoints.
