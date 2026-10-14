import test from 'node:test';
import assert from 'node:assert/strict';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import app from '../app.js';
import User from '../models/User.js';
import { clearWeatherCache, getWeatherForecast, searchWeatherLocations } from '../services/weatherService.js';
import { buildWeatherAdvisories } from '../services/weatherAdvisoryService.js';

const secret = 'phase-seven-weather-test-secret';
const userId = '64b000000000000000000055';
const farmer = { _id: userId, name: 'Weather Test Farmer', role: 'farmer', location: 'Raipur' };
const dailyTimes = Array.from({ length: 7 }, (_, index) => `2026-10-${String(12 + index).padStart(2, '0')}`);

function forecastFixture(overrides = {}) {
  return {
    latitude: 21.25,
    longitude: 81.63,
    timezone: 'Asia/Kolkata',
    utc_offset_seconds: 19800,
    current_units: { temperature_2m: '°C', relative_humidity_2m: '%', precipitation: 'mm', wind_speed_10m: 'm/s' },
    daily_units: { temperature_2m_max: '°C', precipitation_sum: 'mm', wind_speed_10m_max: 'm/s' },
    current: { time: '2026-10-12T10:00', temperature_2m: 29.4, apparent_temperature: 31.2, relative_humidity_2m: 68, precipitation: 0, rain: 0, weather_code: 2, wind_speed_10m: 2.1 },
    daily: {
      time: dailyTimes,
      weather_code: [2, 61, 3, 0, 1, 2, 3],
      temperature_2m_max: [32, 31, 30, 31, 32, 33, 31],
      temperature_2m_min: [22, 22, 21, 21, 22, 23, 22],
      precipitation_probability_max: [0, 60, 10, 0, 0, 0, 0],
      precipitation_sum: [0, 4.2, 0.2, 0, 0, 0, 0],
      wind_speed_10m_max: [4, 5, 3, 3, 4, 4, 3],
    },
    ...overrides,
  };
}

function geocodeFixture() {
  return { results: [{ id: 1, name: 'Raipur', admin1: 'Chhattisgarh', country: 'India', country_code: 'IN', latitude: 21.25, longitude: 81.63, timezone: 'Asia/Kolkata' }] };
}

function configureAuth(t) {
  const previous = process.env.JWT_SECRET;
  process.env.JWT_SECRET = secret;
  t.after(() => { if (previous === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previous; });
}

async function startApi(t) {
  configureAuth(t);
  t.mock.method(User, 'findById', () => ({ select: async () => farmer }));
  const server = app.listen(0);
  t.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  await new Promise((resolve) => server.once('listening', resolve));
  return async (path, { method = 'GET', body, token = jwt.sign({ id: userId }, secret) } = {}) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`, {
      method,
      headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { response, data: await response.json() };
  };
}

function mockProvider(t, { locations = geocodeFixture(), weather = forecastFixture(), failWeather } = {}) {
  const calls = [];
  t.mock.method(axios, 'get', async (url, options) => {
    calls.push({ url, options });
    if (url.includes('geocoding-api')) return { data: locations };
    if (failWeather) throw failWeather;
    return { data: weather };
  });
  return calls;
}

test('location search calls fixed Open-Meteo geocoding with bounded query settings', async (t) => {
  clearWeatherCache();
  const calls = mockProvider(t);
  const request = await startApi(t);
  const { response, data } = await request('/api/weather/locations?q=Raipur%2C%20India');
  assert.equal(response.status, 200);
  assert.equal(data.provider, 'Open-Meteo');
  assert.deepEqual(data.locations[0], { id: 1, name: 'Raipur', region: 'Chhattisgarh', country: 'India', countryCode: 'IN', latitude: 21.25, longitude: 81.63, timezone: 'Asia/Kolkata' });
  assert.equal(calls[0].url, 'https://geocoding-api.open-meteo.com/v1/search');
  assert.equal(calls[0].options.params.count, 5);
  assert.equal(calls[0].options.params.name, 'Raipur, India');
});

test('manual city request returns normalized current and seven-day forecast with crop context', async (t) => {
  clearWeatherCache();
  const calls = mockProvider(t);
  const request = await startApi(t);
  const { response, data } = await request('/api/weather?location=Raipur&crop=rice');
  assert.equal(response.status, 200);
  assert.equal(data.weather.provider, 'Open-Meteo');
  assert.equal(data.weather.location.name, 'Raipur, Chhattisgarh, India');
  assert.equal(data.weather.current.temperatureC, 29.4);
  assert.equal(data.weather.current.humidityPercent, 68);
  assert.equal(data.weather.daily.length, 7);
  assert.equal(data.weather.daily[1].precipitationMm, 4.2);
  assert.equal(data.weather.timezone, 'Asia/Kolkata');
  assert.ok(data.weather.retrievedAt);
  assert.equal(data.cropContext.name, 'Rice');
  assert.match(data.cropContext.message, /crop stage, soil moisture, and field conditions are unknown/i);
  assert.ok(data.cropContext.sources.length);
  assert.equal(data.advisories[0].officialWarning, false);
  const forecastCall = calls.find((call) => call.url.includes('/v1/forecast'));
  assert.equal(forecastCall.options.params.forecast_days, 7);
  assert.equal(forecastCall.options.params.timezone, 'auto');
  assert.equal(forecastCall.options.params.wind_speed_unit, 'ms');
  assert.equal(forecastCall.options.params.precipitation_unit, 'mm');
});

test('location and coordinate parameters reject malformed, duplicate, unknown, and out-of-range input', async (t) => {
  clearWeatherCache();
  const calls = mockProvider(t);
  const request = await startApi(t);
  for (const path of ['/api/weather/locations?q=x', '/api/weather/locations?q=Raipur&q=Delhi', '/api/weather/locations?q=Raipur&limit=500', '/api/weather?location=x', '/api/weather?location=Raipur&latitude=21']) {
    const { response } = await request(path);
    assert.equal(response.status, 400, path);
  }
  for (const body of [{ latitude: 91, longitude: 0 }, { latitude: 0, longitude: -181 }, { latitude: 10 }, { latitude: '21.25', longitude: 81.63 }, { latitude: 20, longitude: 80, userId: 'not-allowed' }]) {
    const { response } = await request('/api/weather/forecast', { method: 'POST', body });
    assert.equal(response.status, 400);
  }
  assert.equal(calls.length, 0);
});

test('browser geolocation posts bounded coordinates without storing them in the profile', async (t) => {
  clearWeatherCache();
  const calls = mockProvider(t);
  const request = await startApi(t);
  const { response, data } = await request('/api/weather/forecast', { method: 'POST', body: { latitude: 21.251, longitude: 81.632, locationName: 'My current location' } });
  assert.equal(response.status, 200);
  assert.equal(data.weather.location.name, 'My current location');
  const forecastCall = calls.find((call) => call.url.includes('/v1/forecast'));
  assert.equal(forecastCall.options.params.latitude, 21.251);
  assert.equal(forecastCall.options.params.longitude, 81.632);
  assert.equal(Object.hasOwn(farmer, 'latitude'), false);
});

test('profile location remains a supported fallback and empty profile location is clear', async (t) => {
  clearWeatherCache();
  mockProvider(t);
  const request = await startApi(t);
  const fromProfile = await request('/api/weather');
  assert.equal(fromProfile.response.status, 200);
  assert.equal(fromProfile.data.weather.location.name, 'Raipur, Chhattisgarh, India');
  const previousLocation = farmer.location;
  farmer.location = '';
  t.after(() => { farmer.location = previousLocation; });
  const { response, data } = await request('/api/weather');
  assert.equal(response.status, 400);
  assert.match(data.message, /enter a location/i);
});

test('weather endpoint rejects requests without authentication', async (t) => {
  configureAuth(t);
  const server = app.listen(0);
  t.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  await new Promise((resolve) => server.once('listening', resolve));
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/weather/locations?q=Raipur`);
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { message: 'Please sign in to continue.' });
});

test('weather provider timeout returns a safe retryable error', async (t) => {
  clearWeatherCache();
  mockProvider(t, { failWeather: Object.assign(new Error('private timeout detail'), { code: 'ECONNABORTED' }) });
  const request = await startApi(t);
  const { response, data } = await request('/api/weather/forecast', { method: 'POST', body: { latitude: 21.25, longitude: 81.63 } });
  assert.equal(response.status, 504);
  assert.equal(data.code, 'WEATHER_PROVIDER_TIMEOUT');
  assert.doesNotMatch(JSON.stringify(data), /private timeout detail/i);
});

test('weather provider errors and non-success responses do not expose upstream details', async (t) => {
  clearWeatherCache();
  const request = await startApi(t);
  let diagnostic;
  t.mock.method(console, 'warn', (...args) => { diagnostic = args; });
  t.mock.method(axios, 'get', async () => { throw Object.assign(new Error('upstream key=secret'), { response: { status: 429, data: { detail: 'private upstream response' } } }); });
  const { response, data } = await request('/api/weather/forecast', { method: 'POST', body: { latitude: 21.25, longitude: 81.63 } });
  assert.equal(response.status, 503);
  assert.equal(data.code, 'WEATHER_PROVIDER_RATE_LIMITED');
  assert.doesNotMatch(JSON.stringify(data), /secret|private upstream/i);
  assert.deepEqual(diagnostic, ['Weather provider request failed.', { code: 'UNKNOWN', status: 429 }]);
  assert.doesNotMatch(JSON.stringify(diagnostic), /secret|21\.25|81\.63|https?:/i);
});

test('malformed provider payload fails safely and missing weather fields remain unavailable', async (t) => {
  clearWeatherCache();
  mockProvider(t, { weather: { timezone: 'Asia/Kolkata', current: 'bad', daily: { time: 'invalid' } } });
  const request = await startApi(t);
  const malformed = await request('/api/weather/forecast', { method: 'POST', body: { latitude: 21.25, longitude: 81.63 } });
  assert.equal(malformed.response.status, 502);

  clearWeatherCache();
  mockProvider(t, { weather: { timezone: 'Asia/Kolkata', utc_offset_seconds: 19800, daily: { time: dailyTimes } } });
  const missingFields = await request('/api/weather/forecast', { method: 'POST', body: { latitude: 21.25, longitude: 81.63 } });
  assert.equal(missingFields.response.status, 200);
  assert.equal(missingFields.data.weather.current, null);
  assert.equal(missingFields.data.weather.daily[0].temperatureMaxC, null);
  assert.deepEqual(missingFields.data.advisories, []);
});

test('forecast response cache avoids repeated upstream calls for the same coordinates', async (t) => {
  clearWeatherCache();
  const calls = mockProvider(t);
  const request = await startApi(t);
  const body = { latitude: 21.25, longitude: 81.63, locationName: 'Raipur' };
  const first = await request('/api/weather/forecast', { method: 'POST', body });
  const second = await request('/api/weather/forecast', { method: 'POST', body: { ...body, locationName: 'Raipur City' } });
  assert.equal(first.response.status, 200);
  assert.equal(second.response.status, 200);
  assert.equal(second.data.weather.stale, false);
  assert.equal(second.data.weather.location.name, 'Raipur City');
  assert.equal(calls.filter((call) => call.url.includes('/v1/forecast')).length, 1);
});

test('geocoding cache avoids repeated upstream location lookups', async (t) => {
  clearWeatherCache();
  const calls = mockProvider(t);
  await searchWeatherLocations('Raipur');
  await searchWeatherLocations(' raipur ');
  assert.equal(calls.filter((call) => call.url.includes('geocoding-api')).length, 1);
});

test('stale forecast is explicitly marked if refresh fails', async (t) => {
  clearWeatherCache();
  let time = Date.now();
  t.mock.method(Date, 'now', () => time);
  let calls = 0;
  t.mock.method(axios, 'get', async () => {
    calls += 1;
    if (calls === 1) return { data: forecastFixture() };
    throw Object.assign(new Error('provider timeout'), { code: 'ECONNABORTED' });
  });
  const fresh = await getWeatherForecast({ latitude: 21.25, longitude: 81.63, locationName: 'Raipur' });
  time += 11 * 60 * 1000;
  const stale = await getWeatherForecast({ latitude: 21.25, longitude: 81.63, locationName: 'Raipur' });
  assert.equal(fresh.stale, false);
  assert.equal(stale.stale, true);
  assert.equal(stale.retrievedAt, fresh.retrievedAt);
});

test('deterministic advisory notes explain rain and avoid crop-specific prescriptions', () => {
  const rainy = { daily: [{ date: '2026-10-12', precipitationMm: 4.2, precipitationProbabilityPercent: 60 }] };
  const advisories = buildWeatherAdvisories(rainy);
  assert.equal(advisories.length, 1);
  assert.match(advisories[0].basis, /4.2 mm/);
  assert.match(advisories[0].message, /does not establish waterlogging/i);
  assert.equal(advisories[0].officialWarning, false);

  const dry = { daily: [1, 2, 3].map((_, index) => ({ date: dailyTimes[index], precipitationMm: 0, precipitationProbabilityPercent: 0 })) };
  const dryAdvice = buildWeatherAdvisories(dry);
  assert.equal(dryAdvice[0].id, 'irrigation-field-check');
  assert.match(dryAdvice[0].message, /cannot establish whether a crop needs water/i);
  assert.deepEqual(buildWeatherAdvisories({ daily: [{ date: dailyTimes[0], precipitationMm: null, precipitationProbabilityPercent: null }] }), []);
});
