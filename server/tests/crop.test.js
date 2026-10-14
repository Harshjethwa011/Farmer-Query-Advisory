import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import app from '../app.js';
import Crop from '../models/Crop.js';
import User from '../models/User.js';
import cropKnowledge from '../data/cropKnowledge.js';
import { findRelevantCrops, getRelevantCropContext } from '../services/cropKnowledgeService.js';

const secret = 'phase-five-crop-test-secret-not-a-real-credential';
const adminId = '64b000000000000000000009';

async function withServer(t, path, { method = 'GET', body, token, admin = false } = {}) {
  if (token) {
    const previousSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = secret;
    t.after(() => { if (previousSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previousSecret; });
    t.mock.method(User, 'findById', () => ({ select: async () => ({ _id: adminId, name: 'Test Admin', role: admin ? 'admin' : 'farmer' }) }));
    if (!admin) token = jwt.sign({ id: adminId }, secret);
  }
  const server = app.listen(0);
  t.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  await new Promise((resolve) => server.once('listening', resolve));
  const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`, {
    method,
    headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { response, data: response.status === 204 ? null : await response.json() };
}

function restoreDatabaseState(t) {
  const original = mongoose.connection.readyState;
  mongoose.connection.readyState = 1;
  t.after(() => { mongoose.connection.readyState = original; });
}

test('public crop listing returns the five curated crops with structured sections and source metadata', async (t) => {
  const { response, data } = await withServer(t, '/api/crops');
  assert.equal(response.status, 200);
  assert.equal(data.total, 5);
  assert.deepEqual(data.crops.map((crop) => crop.name), ['Chickpea', 'Maize', 'Rice', 'Soybean', 'Wheat']);
  for (const crop of data.crops) {
    assert.ok(crop.soil && crop.climateWater && crop.sowing && crop.growthDuration && crop.harvesting && crop.nutrition);
    assert.ok(Array.isArray(crop.pestsDiseases));
    assert.ok(Array.isArray(crop.ipmPractices));
    assert.ok(crop.sources.length > 0);
    assert.ok(crop.sources.every((source) => source.organization && source.title && source.url.startsWith('https://') && source.lastReviewedAt));
  }
});

test('crop search matches names and aliases, including Hindi aliases', async (t) => {
  for (const [search, expected] of [['wheat', 'Wheat'], ['chana', 'Chickpea'], ['मक्का', 'Maize']]) {
    const { response, data } = await withServer(t, `/api/crops?search=${encodeURIComponent(search)}`);
    assert.equal(response.status, 200);
    assert.deepEqual(data.crops.map((crop) => crop.name), [expected]);
  }
});

test('season filtering returns only crops with supported season metadata', async (t) => {
  const { response, data } = await withServer(t, '/api/crops?season=Rabi');
  assert.equal(response.status, 200);
  assert.deepEqual(data.crops.map((crop) => crop.name), ['Chickpea', 'Wheat']);
  assert.equal(data.total, 2);
});

test('crop listing rejects unsupported filters and malformed query values', async (t) => {
  const invalidQueries = ['/api/crops?soil=black', '/api/crops?season=Monsoon', '/api/crops?page=-1', '/api/crops?limit=lots', `/api/crops?search=${'x'.repeat(81)}`, '/api/crops?search=rice&search=wheat'];
  for (const path of invalidQueries) {
    const { response, data } = await withServer(t, path);
    assert.equal(response.status, 400, path);
    assert.equal(typeof data.message, 'string');
  }
});

test('crop listing pagination is bounded and empty searches return an empty state response', async (t) => {
  const firstPage = await withServer(t, '/api/crops?page=1&limit=2');
  assert.equal(firstPage.response.status, 200);
  assert.equal(firstPage.data.crops.length, 2);
  assert.equal(firstPage.data.total, 5);
  assert.equal(firstPage.data.pages, 3);
  const bounded = await withServer(t, '/api/crops?limit=999');
  assert.equal(bounded.data.limit, 20);
  const empty = await withServer(t, '/api/crops?search=not-a-crop');
  assert.equal(empty.response.status, 200);
  assert.deepEqual(empty.data.crops, []);
  assert.equal(empty.data.total, 0);
});

test('curated records remain available when the connected crop collection is empty', async (t) => {
  restoreDatabaseState(t);
  t.mock.method(Crop, 'find', () => ({ sort() { return this; }, limit() { return { lean: async () => [] }; } }));
  const { response, data } = await withServer(t, '/api/crops');
  assert.equal(response.status, 200);
  assert.equal(data.total, 5);
});

test('crop detail resolves curated slugs and returns consistent missing and malformed errors', async (t) => {
  const found = await withServer(t, '/api/crops/chickpea');
  assert.equal(found.response.status, 200);
  assert.equal(found.data.crop.name, 'Chickpea');
  const missing = await withServer(t, '/api/crops/not-a-crop');
  assert.equal(missing.response.status, 404);
  assert.deepEqual(missing.data, { message: 'Crop not found.' });
  const malformed = await withServer(t, '/api/crops/invalid%20identifier');
  assert.equal(malformed.response.status, 400);
  assert.match(malformed.data.message, /valid crop slug or identifier/);
});

test('crop detail supports existing Mongo records and returns 404 for valid but missing IDs', async (t) => {
  restoreDatabaseState(t);
  const cropId = '64b000000000000000000010';
  t.mock.method(Crop, 'findById', () => ({ lean: async () => ({ _id: cropId, name: 'Legacy crop', seasons: ['Rabi'], suitableConditions: 'Legacy details', sources: [] }) }));
  const found = await withServer(t, `/api/crops/${cropId}`);
  assert.equal(found.response.status, 200);
  assert.equal(found.data.crop.name, 'Legacy crop');
  assert.equal(found.data.crop.soil.status, 'unverified');

  t.mock.method(Crop, 'findById', () => ({ lean: async () => null }));
  const missing = await withServer(t, '/api/crops/64b000000000000000000011');
  assert.equal(missing.response.status, 404);
});

test('database list failures use the shared safe API error response', async (t) => {
  restoreDatabaseState(t);
  t.mock.method(Crop, 'find', () => { throw new Error('private database detail'); });
  t.mock.method(console, 'error', () => {});
  const { response, data } = await withServer(t, '/api/crops');
  assert.equal(response.status, 500);
  assert.deepEqual(data, { message: 'Something went wrong. Please try again.' });
});

test('admin crop creation rejects invalid input and preserves the admin-only endpoint', async (t) => {
  const missingToken = await withServer(t, '/api/crops', { method: 'POST', body: { name: 'Test crop' } });
  assert.equal(missingToken.response.status, 401);
  const farmerToken = jwt.sign({ id: adminId }, secret);
  const forbidden = await withServer(t, '/api/crops', { method: 'POST', body: { name: 'Test crop' }, token: farmerToken });
  assert.equal(forbidden.response.status, 403);

  const adminToken = jwt.sign({ id: adminId }, secret);
  t.mock.method(Crop, 'create', async () => assert.fail('invalid crop body must not write'));
  const invalid = await withServer(t, '/api/crops', { method: 'POST', body: { name: 'Test crop', fertilizerInfo: 7 }, token: adminToken, admin: true });
  assert.equal(invalid.response.status, 400);
});

test('only context matching a crop name or alias is selected for the assistant', async () => {
  assert.deepEqual(findRelevantCrops('What can I do for my maize crop?').map((crop) => crop.slug), ['maize']);
  assert.deepEqual(findRelevantCrops('My chana crop is wilted.').map((crop) => crop.slug), ['chickpea']);
  assert.deepEqual(findRelevantCrops('I need help with my orchard.').map((crop) => crop.slug), []);
  const context = getRelevantCropContext('My rice field has a question.');
  assert.match(context, /Gall midge/);
  assert.match(context, /Indian Council of Agricultural Research/);
  assert.ok(context.length < 6501);
});

test('curated knowledge entries do not invent crop rates or fixed sowing windows', () => {
  assert.equal(cropKnowledge.length, 5);
  for (const crop of cropKnowledge) {
    assert.equal(crop.sowing.window, null);
    assert.match(crop.nutrition.summary, /soil test/i);
    assert.ok(crop.sources.every((source) => source.lastReviewedAt === '2026-10-12'));
  }
});
