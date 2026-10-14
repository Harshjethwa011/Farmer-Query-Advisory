import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import app from '../app.js';
import User from '../models/User.js';
import Query from '../models/Query.js';

const secret = 'phase-two-test-secret-that-is-not-a-real-credential';
const farmerId = '64b000000000000000000001';
const farmer = { _id: farmerId, name: 'Test Farmer', email: 'farmer@example.test', phone: '', location: 'Test district', preferredLanguage: 'English', crops: [], role: 'farmer' };

async function withServer(t, path, { method = 'GET', body, token } = {}) {
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

function tokenFor(id = farmerId, expiresIn = '1h') {
  return jwt.sign({ id }, secret, { expiresIn });
}

test('a configured JWT_SECRET allows registration and signs a token without exposing credentials', async (t) => {
  const previous = process.env.JWT_SECRET;
  process.env.JWT_SECRET = secret;
  t.after(() => { if (previous === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previous; });
  let created;
  t.mock.method(User, 'create', async (values) => {
    created = values;
    return { ...farmer, ...values };
  });
  const { response, data } = await withServer(t, '/api/auth/register', { method: 'POST', body: { name: ' Test Farmer ', email: 'FARMER@example.test', password: 'safe-password' } });
  assert.equal(response.status, 201);
  assert.equal(created.name, 'Test Farmer');
  assert.equal(created.email, 'farmer@example.test');
  assert.notEqual(created.password, 'safe-password');
  assert.equal(await bcrypt.compare('safe-password', created.password), true);
  assert.equal(jwt.verify(data.token, secret).id, farmerId);
  assert.equal(data.user.password, undefined);
  assert.equal(data.user.email, 'farmer@example.test');
});

test('duplicate registration returns a conflict without leaking database details', async (t) => {
  process.env.JWT_SECRET = secret;
  t.mock.method(User, 'create', async () => { throw Object.assign(new Error('E11000 private index details'), { code: 11000 }); });
  const { response, data } = await withServer(t, '/api/auth/register', { method: 'POST', body: { name: 'Farmer', email: 'farmer@example.test', password: 'safe-password' } });
  assert.equal(response.status, 409);
  assert.deepEqual(data, { message: 'An account with this email already exists.' });
});

test('login accepts a correct password and returns a signed token without the hash', async (t) => {
  process.env.JWT_SECRET = secret;
  const password = await bcrypt.hash('safe-password', 4);
  t.mock.method(User, 'findOne', () => ({ select: async () => ({ ...farmer, password }) }));
  const { response, data } = await withServer(t, '/api/auth/login', { method: 'POST', body: { email: 'FARMER@example.test', password: 'safe-password' } });
  assert.equal(response.status, 200);
  assert.equal(jwt.verify(data.token, secret).id, farmerId);
  assert.equal(data.user.password, undefined);
});

test('login rejects an incorrect password', async (t) => {
  process.env.JWT_SECRET = secret;
  const password = await bcrypt.hash('safe-password', 4);
  t.mock.method(User, 'findOne', () => ({ select: async () => ({ ...farmer, password }) }));
  const { response, data } = await withServer(t, '/api/auth/login', { method: 'POST', body: { email: farmer.email, password: 'wrong-password' } });
  assert.equal(response.status, 401);
  assert.deepEqual(data, { message: 'Email or password is incorrect.' });
});

test('registration and login reject missing or malformed values with 400', async (t) => {
  process.env.JWT_SECRET = secret;
  t.mock.method(User, 'create', async () => assert.fail('invalid registration must not write'));
  t.mock.method(User, 'findOne', async () => assert.fail('invalid login must not query users'));
  for (const body of [{}, { name: 42, email: 'farmer@example.test', password: 'safe-password' }, { name: 'Farmer', email: 'bad-address', password: 'safe-password' }, { name: 'Farmer', email: 'farmer@example.test', password: 123 }]) {
    const { response } = await withServer(t, '/api/auth/register', { method: 'POST', body });
    assert.equal(response.status, 400);
  }
  for (const body of [{}, { email: 'bad-address', password: 'x' }, { email: farmer.email, password: 42 }]) {
    const { response } = await withServer(t, '/api/auth/login', { method: 'POST', body });
    assert.equal(response.status, 400);
  }
});

test('registration fails clearly when JWT_SECRET is not configured and does not write a user', async (t) => {
  const previous = process.env.JWT_SECRET;
  delete process.env.JWT_SECRET;
  t.after(() => { if (previous === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previous; });
  t.mock.method(User, 'create', async () => assert.fail('must not create an account without token configuration'));
  const { response, data } = await withServer(t, '/api/auth/register', { method: 'POST', body: { name: 'Farmer', email: farmer.email, password: 'safe-password' } });
  assert.equal(response.status, 503);
  assert.equal(data.message, 'Authentication is not configured on this server.');
});

test('registration rejects a blank JWT_SECRET and does not write a user', async (t) => {
  const previous = process.env.JWT_SECRET;
  process.env.JWT_SECRET = '   ';
  t.after(() => { if (previous === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previous; });
  t.mock.method(User, 'create', async () => assert.fail('must not create an account with a blank token secret'));
  const { response, data } = await withServer(t, '/api/auth/register', { method: 'POST', body: { name: 'Farmer', email: farmer.email, password: 'safe-password' } });
  assert.equal(response.status, 503);
  assert.equal(data.message, 'Authentication is not configured on this server.');
});

test('protected profile rejects requests without a bearer token', async (t) => {
  const { response, data } = await withServer(t, '/api/auth/me');
  assert.equal(response.status, 401);
  assert.deepEqual(data, { message: 'Please sign in to continue.' });
});

test('protected profile loads the user for the verified token and omits the password field', async (t) => {
  process.env.JWT_SECRET = secret;
  let selected;
  t.mock.method(User, 'findById', (id) => ({ select: async (fields) => { selected = { id, fields }; return { ...farmer, password: 'private hash' }; } }));
  const { response, data } = await withServer(t, '/api/auth/me', { token: tokenFor() });
  assert.equal(response.status, 200);
  assert.equal(selected.id, farmerId);
  assert.equal(selected.fields, '-password');
  assert.equal(data.user.password, undefined);
});

test('protected profile rejects invalid and expired JWTs', async (t) => {
  process.env.JWT_SECRET = secret;
  t.mock.method(User, 'findById', async () => assert.fail('invalid tokens must not query users'));
  for (const token of ['not-a-jwt', tokenFor(farmerId, '-1s')]) {
    const { response } = await withServer(t, '/api/auth/me', { token });
    assert.equal(response.status, 401);
  }
});

test('protected profile distinguishes database failures from invalid sessions', async (t) => {
  process.env.JWT_SECRET = secret;
  t.mock.method(User, 'findById', () => { throw new Error('private database failure'); });
  t.mock.method(console, 'error', () => {});
  const { response, data } = await withServer(t, '/api/auth/me', { token: tokenFor() });
  assert.equal(response.status, 500);
  assert.deepEqual(data, { message: 'Something went wrong. Please try again.' });
});

test('profile and query resources are scoped to the identity in the verified JWT', async (t) => {
  process.env.JWT_SECRET = secret;
  const anotherUserQueryId = '64b000000000000000000099';
  let queryFilter;
  t.mock.method(User, 'findById', () => ({ select: async () => farmer }));
  t.mock.method(Query, 'findOne', async (filter) => { queryFilter = filter; return null; });
  const { response, data } = await withServer(t, `/api/queries/${anotherUserQueryId}`, { token: tokenFor() });
  assert.equal(response.status, 404);
  assert.deepEqual(data, { message: 'Query not found.' });
  assert.equal(queryFilter._id, anotherUserQueryId);
  assert.equal(String(queryFilter.userId), farmerId);
});

test('dashboard query endpoint returns the signed-in farmer’s recent questions', async (t) => {
  process.env.JWT_SECRET = secret;
  let queryFilter;
  const rows = [{ _id: 'q1', userId: farmerId, question: 'When should I water?', createdAt: new Date().toISOString() }];
  t.mock.method(User, 'findById', () => ({ select: async () => farmer }));
  t.mock.method(Query, 'find', (filter) => { queryFilter = filter; return { sort() { return this; }, skip() { return this; }, limit: async () => rows }; });
  t.mock.method(Query, 'countDocuments', async () => rows.length);
  const { response, data } = await withServer(t, '/api/queries', { token: tokenFor() });
  assert.equal(response.status, 200);
  assert.deepEqual(data.queries, rows);
  assert.equal(String(queryFilter.userId), farmerId);
});

test('dashboard query endpoint returns a consistent error if the database request fails', async (t) => {
  process.env.JWT_SECRET = secret;
  t.mock.method(User, 'findById', () => ({ select: async () => farmer }));
  t.mock.method(Query, 'find', () => { throw new Error('private database failure'); });
  t.mock.method(Query, 'countDocuments', async () => 0);
  t.mock.method(console, 'error', () => {});
  const { response, data } = await withServer(t, '/api/queries', { token: tokenFor() });
  assert.equal(response.status, 500);
  assert.deepEqual(data, { message: 'Something went wrong. Please try again.' });
});
