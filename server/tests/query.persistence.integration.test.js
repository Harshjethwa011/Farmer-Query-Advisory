import test from 'node:test';
import assert from 'node:assert/strict';
import axios from 'axios';
import mongoose from 'mongoose';
import app from '../app.js';
import Query from '../models/Query.js';
import Crop from '../models/Crop.js';

const secret = 'phase-four-isolated-integration-test-secret';

test('authenticated farmer flow, dashboard, chat history, ownership, and crop catalog work with isolated local MongoDB', async (t) => {
  const uri = process.env.MONGODB_TEST_URI;
  if (!uri) {
    t.skip('Set MONGODB_TEST_URI to an isolated local farmer_advisory_test_* database to run live persistence verification.');
    return;
  }

  const parsed = new URL(uri);
  const databaseName = decodeURIComponent(parsed.pathname.slice(1));
  assert.ok(['127.0.0.1', 'localhost', '::1'].includes(parsed.hostname), 'integration test only permits loopback MongoDB');
  assert.equal(parsed.username, '', 'test URI must not contain credentials');
  assert.equal(parsed.password, '', 'test URI must not contain credentials');
  assert.match(databaseName, /^farmer_advisory_test_[a-z0-9_]+$/i, 'database name must use the explicit test prefix');

  const previous = Object.fromEntries(['JWT_SECRET', 'AI_PROVIDER', 'AI_API_KEY', 'AI_MODEL'].map((key) => [key, process.env[key]]));
  process.env.JWT_SECRET = secret;
  process.env.AI_PROVIDER = 'openai';
  process.env.AI_API_KEY = 'isolated-test-provider-key';
  process.env.AI_MODEL = 'test-model';
  let server;
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    await mongoose.connection.dropDatabase();
    t.mock.method(axios, 'post', async () => ({ data: { choices: [{ message: { content: 'Check the soil moisture and local rainfall.' } }] } }));

    server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    const baseUrl = `http://127.0.0.1:${server.address().port}/api`;
    const send = (path, { method = 'GET', token, body } = {}) => fetch(`${baseUrl}${path}`, {
      method,
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });

    const registration = await send('/auth/register', { method: 'POST', body: { name: 'Integration Farmer One', email: 'farmer-one@example.test', password: 'integration-password', location: 'Raipur' } });
    assert.equal(registration.status, 201);
    const registered = await registration.json();
    assert.ok(registered.token);
    assert.equal(registered.user.email, 'farmer-one@example.test');
    assert.equal(Object.hasOwn(registered.user, 'password'), false);
    const duplicate = await send('/auth/register', { method: 'POST', body: { name: 'Duplicate Farmer', email: 'farmer-one@example.test', password: 'integration-password' } });
    assert.equal(duplicate.status, 409);
    const badLogin = await send('/auth/login', { method: 'POST', body: { email: 'farmer-one@example.test', password: 'wrong-password' } });
    assert.equal(badLogin.status, 401);
    const login = await send('/auth/login', { method: 'POST', body: { email: 'farmer-one@example.test', password: 'integration-password' } });
    assert.equal(login.status, 200);
    const loggedIn = await login.json();
    const farmerToken = loggedIn.token;
    const farmerId = loggedIn.user.id;
    const profile = await send('/auth/me', { token: farmerToken });
    assert.equal(profile.status, 200);
    assert.equal((await profile.json()).user.location, 'Raipur');
    const otherRegistration = await send('/auth/register', { method: 'POST', body: { name: 'Integration Farmer Two', email: 'farmer-two@example.test', password: 'integration-password' } });
    assert.equal(otherRegistration.status, 201);
    const otherFarmerToken = (await otherRegistration.json()).token;

    const dashboardBefore = await send('/queries', { token: farmerToken });
    assert.equal(dashboardBefore.status, 200);
    assert.equal((await dashboardBefore.json()).total, 0);

    const initialCrops = await send('/crops');
    assert.equal(initialCrops.status, 200);
    assert.equal((await initialCrops.json()).total, 5);
    const customCrop = await Crop.create({ name: 'Integration Test Millet', slug: 'integration-test-millet', region: 'Test region' });
    const cropsWithRecord = await send('/crops?search=Integration%20Test%20Millet');
    assert.equal(cropsWithRecord.status, 200);
    assert.equal((await cropsWithRecord.json()).total, 1);
    const cropDetail = await send(`/crops/${customCrop._id}`);
    assert.equal(cropDetail.status, 200);
    assert.equal((await cropDetail.json()).crop.name, 'Integration Test Millet');

    const createResponse = await send('/queries', {
      method: 'POST',
      token: farmerToken,
      body: { question: 'Why are the lower leaves yellow?' },
    });
    assert.equal(createResponse.status, 201);
    const created = await createResponse.json();
    assert.equal(created.query.response, 'Check the soil moisture and local rainfall.');
    assert.equal(String(created.query.userId), String(farmerId));

    const stored = await Query.findById(created.query._id).lean();
    assert.equal(stored.question, 'Why are the lower leaves yellow?');
    assert.equal(stored.response, created.query.response);

    const listForOwner = await send('/queries', { token: farmerToken });
    assert.equal(listForOwner.status, 200);
    assert.equal((await listForOwner.json()).total, 1);
    const listForOther = await send('/queries', { token: otherFarmerToken });
    assert.equal(listForOther.status, 200);
    assert.equal((await listForOther.json()).total, 0);
    const detailForOther = await send(`/queries/${created.query._id}`, { token: otherFarmerToken });
    assert.equal(detailForOther.status, 404);
  } finally {
    if (server?.listening) await new Promise((resolve) => server.close(resolve));
    if (mongoose.connection.readyState === 1 && mongoose.connection.name === databaseName) await mongoose.connection.dropDatabase();
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});
