# Weather integration

The weather page calls the backend, which uses the fixed Open-Meteo geocoding and forecast endpoints. The browser never receives a provider key, and no weather API key is required. The application requests current conditions and a seven-day forecast in Celsius, millimetres, metres per second, and the selected location's timezone.

## API

- `GET /api/weather/locations?q=<name>` searches up to five matching places.
- `POST /api/weather/forecast` accepts `{ "latitude": number, "longitude": number, "locationName"?: string, "crop"?: string }`. Coordinates are range-checked and are neither stored in a user profile nor returned in the forecast response.
- `GET /api/weather?location=<name>&crop=<slug>` preserves the profile-location fallback for existing callers.

The protected routes require the existing bearer token. Browser geolocation is requested only after the user selects “Use my location”. Coordinates are sent to the backend for the provider request. The backend keeps a bounded in-process cache keyed by coordinates rounded to three decimal places. Forecast entries are fresh for ten minutes; a failed refresh may use an entry for at most two hours. The cache is volatile and is not persisted to MongoDB or disk.

## Advisory limits

Weather-aware notes are deterministic, cautious planning prompts based on forecast precipitation fields. They are not official alerts and do not diagnose field moisture, waterlogging, crop stage, or irrigation need. Crop context links to the existing catalog sources, but does not turn general weather rules into crop-specific prescriptions. The page displays available temperature, rain, wind, and humidity fields with units; it does not invent heat thresholds or pesticide instructions. Farmers should check local observations and current official warnings before decisions.

## Attribution and service conditions

The upstream APIs are documented at [Open-Meteo Forecast API](https://open-meteo.com/en/docs) and [Open-Meteo Geocoding API](https://open-meteo.com/en/docs/geocoding-api). The UI attributes forecast data to Open-Meteo. Open-Meteo's [terms](https://open-meteo.com/en/terms) and [pricing](https://open-meteo.com/en/pricing) currently restrict the free API to non-commercial use and require attribution; it has usage limits and no uptime guarantee. Confirm those terms for the intended deployment and arrange a suitable paid plan or another compliant provider before commercial use. Upstream requests require outbound network access. Provider or network failure returns a safe retryable API error; the page can show a bounded stale forecast when one is cached.

## Verification

Automated weather tests mock outbound requests and verify request normalization, caching, errors, access control, and advisory behavior. They do not establish that a live Open-Meteo request or a MongoDB-backed authenticated session works in a particular deployment. A direct provider check can be made from the server environment by invoking `getWeatherForecast` with a known test location; full UI verification still requires a running MongoDB, configured `MONGODB_URI` and `JWT_SECRET`, and the application servers.
