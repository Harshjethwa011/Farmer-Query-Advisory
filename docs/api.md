# API reference

Base URL: `http://localhost:5000/api`. Protected routes require `Authorization: Bearer <token>`. JSON errors use `{ "message": "..." }`.

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/health` | Public | API and database status |
| POST | `/auth/register` | Public | Create a farmer and return token/user |
| POST | `/auth/login` | Public | Verify credentials and return token/user |
| GET | `/auth/me` | Farmer | Current profile |
| PATCH | `/auth/me` | Farmer | Update name, phone, location, language, crops |
| POST | `/queries` | Farmer | Ask configured AI and store response; `{question, language?}` |
| GET | `/queries?search=` | Farmer | Own query history, newest first |
| GET/DELETE | `/queries/:id` | Owner | Read or delete own query |
| GET | `/crops?search=&season=&page=&limit=` | Public | Search crop names/aliases; filter by supported season; paginated curated and admin records (maximum limit 20) |
| GET | `/crops/:id` | Public | Crop detail by curated slug or Mongo ID |
| POST | `/crops` | Admin | Add a validated crop record; source URLs must use HTTPS |
| POST | `/disease/detect` | Farmer | Multipart image field `image`; JPEG/PNG/WebP, maximum 5 MB; provider optional; rate-limited |
| GET | `/diseases` | Public | Disease information records |
| GET | `/diseases/:id` | Public | Disease record by Mongo ID |
| GET | `/weather?location=&crop=` | Farmer | Seven-day forecast for query or profile location plus cautious planning notes |
| GET | `/weather/locations?q=` | Farmer | Search up to five provider geocoding matches |
| POST | `/weather/forecast` | Farmer | Forecast for validated coordinates, optional label, and supported crop |
| GET | `/admin/overview` | Admin | Farmer/query counts and crop/disease records |
| GET | `/admin/farmers` | Admin | Farmer directory (maximum 200) |

Register accepts name, email, password, and optional phone/location/preferredLanguage/crops. Passwords need at least 8 characters. Invalid or duplicate data receives a useful 4xx response. Missing service credentials return 503; an invalid weather location returns 404. Image upload requires authentication, checks the declared media type and basic file structure, accepts JPEG/PNG/WebP only, and is capped at 5 MB. Provider output is transient; this API does not persist uploaded images or analyses. Without a configured compatible provider, upload validation still runs and analysis returns 503 without a prediction.

Crop list/detail reads are intentionally public: the curated reference catalog does not contain private farmer data. Supported list filters are `search` (up to 80 characters), `season` (`Kharif`, `Rabi`, `Zaid`), `page`, and `limit` (default 10, maximum 20). Unsupported filters and malformed query values return 400. A well-formed unknown slug or Mongo ID returns 404; a malformed ID returns 400. Core curated content is served from the repository and does not require MongoDB or an AI provider.

Weather endpoints require authentication and use Open-Meteo without an API key for non-commercial use. The forecast request accepts numeric `latitude` and `longitude` within geographic bounds and never saves them to the user profile. See [weather provider notes](weather-provider.md) for attribution, caching, and limitations.
