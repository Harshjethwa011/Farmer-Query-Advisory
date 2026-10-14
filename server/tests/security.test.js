import test from 'node:test';
import assert from 'node:assert/strict';
import { errorHandler } from '../middleware/errorHandler.js';

test('unexpected API errors do not log credential-like values or expose internal messages', (t) => {
  const logged = [];
  t.mock.method(console, 'error', (...args) => logged.push(args.join(' ')));
  const responseBody = {};
  const response = { status(code) { this.statusCode = code; return this; }, json(body) { Object.assign(responseBody, body); return this; } };
  errorHandler(new Error('Bearer sentinel-token mongodb://sentinel-user:sentinel-password@127.0.0.1/test'), {}, response, () => {});
  assert.equal(response.statusCode, 500);
  assert.deepEqual(responseBody, { message: 'Something went wrong. Please try again.' });
  assert.equal(logged.join(' ').includes('sentinel'), false);
});
