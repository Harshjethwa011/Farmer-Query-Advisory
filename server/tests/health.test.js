import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../app.js';
import mongoose from 'mongoose';

test('GET /api/health reports API and database status', async (t) => {
  const server = app.listen(0);
  t.after(() => server.close());
  await new Promise((resolve) => server.once('listening', resolve));
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    status: 'ok',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  });
});

test('unknown routes return a consistent JSON 404', async (t) => {
  const server = app.listen(0);
  t.after(() => server.close());
  await new Promise((resolve) => server.once('listening', resolve));
  const response = await fetch(`http://127.0.0.1:${server.address().port}/missing`);
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { message: 'The requested resource was not found.' });
});
