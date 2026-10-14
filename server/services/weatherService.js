import axios from 'axios';

const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const FORECAST_TTL_MS = 10 * 60 * 1000;
const STALE_FORECAST_MAX_AGE_MS = 2 * 60 * 60 * 1000;
const GEOCODING_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_CACHE_ENTRIES = 200;
const cache = new Map();

export async function searchWeatherLocations(query) {
  const normalized = query.trim().toLowerCase();
  const key = `location:${normalized}`;
  const cached = getFreshCache(key);
  if (cached) return cached;

  let response;
  try {
    response = await axios.get(GEOCODING_URL, {
      params: { name: query.trim(), count: 5, language: 'en', format: 'json' },
      timeout: 10_000,
      maxRedirects: 0,
    });
  } catch (error) {
    throw providerError(error, 'Location search is temporarily unavailable. Please try again.');
  }

  if (!response.data || typeof response.data !== 'object' || !Array.isArray(response.data.results)) {
    throw serviceError(502, 'The location service returned an invalid response.', 'WEATHER_PROVIDER_INVALID_RESPONSE');
  }
  const locations = response.data.results.map(normalizeLocation).filter(Boolean);
  setCache(key, locations, GEOCODING_TTL_MS);
  return locations;
}

export async function getWeatherForecast({ latitude, longitude, locationName = '' }) {
  if (!isCoordinate(latitude, -90, 90) || !isCoordinate(longitude, -180, 180)) {
    throw serviceError(400, 'Enter valid latitude and longitude coordinates.', 'WEATHER_INVALID_COORDINATES');
  }
  const lat = Number(latitude);
  const lon = Number(longitude);
  const key = `forecast:${lat.toFixed(3)}:${lon.toFixed(3)}`;
  const staleEntry = cache.get(key);
  const fresh = getFreshCache(key);
  if (fresh) return { ...fresh, location: { ...fresh.location, name: locationName || fresh.location.name }, stale: false };

  let response;
  try {
    response = await axios.get(FORECAST_URL, {
      params: {
        latitude: lat,
        longitude: lon,
        current: 'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,weather_code,wind_speed_10m',
        daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,wind_speed_10m_max',
        forecast_days: 7,
        timezone: 'auto',
        temperature_unit: 'celsius',
        wind_speed_unit: 'ms',
        precipitation_unit: 'mm',
        timeformat: 'iso8601',
      },
      timeout: 12_000,
      maxRedirects: 0,
    });
  } catch (error) {
    if (staleEntry && staleEntry.key.startsWith('forecast:') && Date.now() - staleEntry.expiresAt <= STALE_FORECAST_MAX_AGE_MS) {
      return { ...staleEntry.value, stale: true, location: { ...staleEntry.value.location, name: locationName || staleEntry.value.location.name } };
    }
    throw providerError(error, 'The weather service is temporarily unavailable. Please try again.');
  }

  const forecast = normalizeForecast(response.data, { latitude: lat, longitude: lon, locationName });
  if (!forecast) throw serviceError(502, 'The weather service returned incomplete or invalid forecast data.', 'WEATHER_PROVIDER_INVALID_RESPONSE');
  setCache(key, forecast, FORECAST_TTL_MS);
  return { ...forecast, stale: false };
}

export function clearWeatherCache() { cache.clear(); }

function normalizeLocation(value) {
  if (!value || typeof value !== 'object') return null;
  const latitude = finiteOrNull(value.latitude);
  const longitude = finiteOrNull(value.longitude);
  if (!isCoordinate(latitude, -90, 90) || !isCoordinate(longitude, -180, 180) || typeof value.name !== 'string' || !value.name.trim()) return null;
  return {
    id: Number.isSafeInteger(value.id) ? value.id : null,
    name: value.name.trim().slice(0, 100),
    region: typeof value.admin1 === 'string' ? value.admin1.trim().slice(0, 100) : '',
    country: typeof value.country === 'string' ? value.country.trim().slice(0, 100) : '',
    countryCode: typeof value.country_code === 'string' ? value.country_code.trim().slice(0, 2) : '',
    latitude,
    longitude,
    timezone: typeof value.timezone === 'string' ? value.timezone.trim().slice(0, 80) : null,
  };
}

function normalizeForecast(data, requested) {
  if (!data || typeof data !== 'object' || Array.isArray(data) || typeof data.timezone !== 'string' || !data.timezone.trim()) return null;
  const current = data.current && typeof data.current === 'object' ? data.current : null;
  const daily = data.daily && typeof data.daily === 'object' && Array.isArray(data.daily.time) ? data.daily : null;
  if (!current && !daily?.time?.length) return null;
  const dailyDates = (daily?.time || []).slice(0, 7);
  if (dailyDates.some((date) => typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`)))) return null;

  const currentValue = current ? {
    time: safeTimestamp(current.time),
    temperatureC: finiteOrNull(current.temperature_2m),
    apparentTemperatureC: finiteOrNull(current.apparent_temperature),
    humidityPercent: finiteOrNull(current.relative_humidity_2m),
    precipitationMm: finiteOrNull(current.precipitation),
    rainMm: finiteOrNull(current.rain),
    windSpeedMps: finiteOrNull(current.wind_speed_10m),
    weatherCode: finiteOrNull(current.weather_code),
    condition: describeWeatherCode(current.weather_code),
  } : null;

  const dailyForecast = dailyDates.map((date, index) => ({
    date,
    temperatureMaxC: arrayNumberOrNull(daily.temperature_2m_max, index),
    temperatureMinC: arrayNumberOrNull(daily.temperature_2m_min, index),
    precipitationProbabilityPercent: arrayNumberOrNull(daily.precipitation_probability_max, index),
    precipitationMm: arrayNumberOrNull(daily.precipitation_sum, index),
    windSpeedMaxMps: arrayNumberOrNull(daily.wind_speed_10m_max, index),
    weatherCode: arrayNumberOrNull(daily.weather_code, index),
    condition: describeWeatherCode(arrayNumberOrNull(daily.weather_code, index)),
  }));

  return {
    provider: 'Open-Meteo',
    attributionUrl: 'https://open-meteo.com/',
    location: {
      name: requested.locationName || 'Selected location',
    },
    timezone: data.timezone,
    utcOffsetSeconds: finiteOrNull(data.utc_offset_seconds),
    retrievedAt: new Date().toISOString(),
    stale: false,
    units: { temperature: '°C', precipitation: 'mm', windSpeed: 'm/s', humidity: '%' },
    current: currentValue,
    daily: dailyForecast,
  };
}

function getFreshCache(key) {
  const entry = cache.get(key);
  if (!entry || entry.expiresAt <= Date.now()) return null;
  return entry.value;
}

function setCache(key, value, ttlMs) {
  cache.delete(key);
  cache.set(key, { key, value, expiresAt: Date.now() + ttlMs });
  while (cache.size > MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value);
}

function providerError(error, fallback) {
  const diagnostic = {
    code: typeof error?.code === 'string' && /^[A-Z0-9_]{1,40}$/.test(error.code) ? error.code : 'UNKNOWN',
    status: Number.isInteger(error?.response?.status) ? error.response.status : null,
  };
  console.warn('Weather provider request failed.', diagnostic);
  if (diagnostic.status === 429) return serviceError(503, 'The weather service is busy. Please try again shortly.', 'WEATHER_PROVIDER_RATE_LIMITED');
  if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') return serviceError(504, 'The weather service took too long to respond. Please try again.', 'WEATHER_PROVIDER_TIMEOUT');
  return serviceError(502, fallback, 'WEATHER_PROVIDER_UNAVAILABLE');
}

function serviceError(status, message, code) { return Object.assign(new Error(message), { status, code }); }
function isCoordinate(value, min, max) { return (typeof value === 'number' || (typeof value === 'string' && value.trim() !== '')) && Number.isFinite(Number(value)) && Number(value) >= min && Number(value) <= max; }
function finiteOrNull(value) { return typeof value === 'number' && Number.isFinite(value) ? value : null; }
function arrayNumberOrNull(value, index) { return Array.isArray(value) ? finiteOrNull(value[index]) : null; }
function safeTimestamp(value) { return typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? value : null; }

function describeWeatherCode(value) {
  const code = finiteOrNull(value);
  const descriptions = {
    0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
    45: 'Fog', 48: 'Depositing rime fog', 51: 'Light drizzle', 53: 'Moderate drizzle', 55: 'Dense drizzle',
    56: 'Light freezing drizzle', 57: 'Dense freezing drizzle', 61: 'Slight rain', 63: 'Moderate rain', 65: 'Heavy rain',
    66: 'Light freezing rain', 67: 'Heavy freezing rain', 71: 'Slight snow', 73: 'Moderate snow', 75: 'Heavy snow',
    77: 'Snow grains', 80: 'Slight rain showers', 81: 'Moderate rain showers', 82: 'Violent rain showers',
    85: 'Slight snow showers', 86: 'Heavy snow showers', 95: 'Thunderstorm', 96: 'Thunderstorm with slight hail', 99: 'Thunderstorm with heavy hail',
  };
  return code === null ? 'Unavailable' : (descriptions[code] || 'Conditions unavailable');
}
