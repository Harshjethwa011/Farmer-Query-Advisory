import test from 'node:test';
import assert from 'node:assert/strict';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import app from '../app.js';
import User from '../models/User.js';

const secret = 'phase-six-test-secret-not-a-credential';
const farmerId = '64b000000000000000000011';
const farmer = { _id: farmerId, name: 'Upload Test Farmer', email: 'upload@example.test', role: 'farmer' };
const imageBytes = {
  'image/jpeg': makeJpeg(),
  'image/png': makePng(),
  'image/webp': makeWebp(),
};

function configureProvider(t, enabled = true) {
  const prior = Object.fromEntries(['JWT_SECRET', 'DISEASE_PROVIDER', 'DISEASE_MODEL', 'DISEASE_API_URL', 'DISEASE_API_KEY', 'DISEASE_TIMEOUT_MS'].map((key) => [key, process.env[key]]));
  process.env.JWT_SECRET = secret;
  if (enabled) {
    process.env.DISEASE_PROVIDER = 'http-json';
    process.env.DISEASE_MODEL = 'test-image-model';
    process.env.DISEASE_API_URL = 'https://provider.example.test/analyze';
    process.env.DISEASE_API_KEY = 'test-provider-key';
    process.env.DISEASE_TIMEOUT_MS = '5000';
  } else {
    for (const key of ['DISEASE_PROVIDER', 'DISEASE_MODEL', 'DISEASE_API_URL', 'DISEASE_API_KEY']) delete process.env[key];
  }
  t.after(() => {
    for (const [key, value] of Object.entries(prior)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });
}

async function withServer(t, { token = true, form, rawBody, contentType } = {}) {
  if (token) {
    t.mock.method(User, 'findById', () => ({ select: async () => farmer }));
  }
  const server = app.listen(0);
  t.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  await new Promise((resolve) => server.once('listening', resolve));
  const headers = {};
  let body;
  if (form) body = form;
  else if (rawBody !== undefined) { body = rawBody; headers['Content-Type'] = contentType; }
  if (token) headers.Authorization = `Bearer ${jwt.sign({ id: farmerId }, secret, { expiresIn: '1h' })}`;
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/disease/detect`, { method: 'POST', headers, body });
  return { response, data: await response.json() };
}

function formWithImage(bytes = imageBytes['image/jpeg'], mimeType = 'image/jpeg', filename = 'untrusted-path.jpg') {
  const form = new FormData();
  form.append('image', new Blob([bytes], { type: mimeType }), filename);
  return form;
}

function makePng() {
  const png = Buffer.alloc(58);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(png, 0);
  png.writeUInt32BE(13, 8); png.write('IHDR', 12, 'ascii'); png.writeUInt32BE(1, 16); png.writeUInt32BE(1, 20); png[24] = 8; png[25] = 2;
  png.writeUInt32BE(1, 33); png.write('IDAT', 37, 'ascii'); png[41] = 0;
  png.writeUInt32BE(0, 46); png.write('IEND', 50, 'ascii');
  return png;
}

function makeWebp() {
  const webp = Buffer.alloc(26);
  webp.write('RIFF', 0, 'ascii');
  webp.writeUInt32LE(webp.length - 8, 4);
  webp.write('WEBP', 8, 'ascii');
  webp.write('VP8L', 12, 'ascii'); webp.writeUInt32LE(5, 16); webp[20] = 0x2f;
  return webp;
}

function makeJpeg() {
  return Buffer.from([
    0xff, 0xd8,
    0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01, 0x00, 0x01, 0x01, 0x01, 0x11, 0x00,
    0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, 0x11,
    0xff, 0xd9,
  ]);
}

test('authenticated image upload accepts JPEG, PNG, and WebP with validated provider result', async (t) => {
  configureProvider(t);
  const received = [];
  t.mock.method(axios, 'post', async (_url, body, options) => {
    received.push({ body, options });
    return { data: { disease: 'Possible leaf spot', crop: 'Rice', confidence: 0.82, symptoms: 'Test note' } };
  });

  for (const [mimeType, bytes] of Object.entries(imageBytes)) {
    const { response, data } = await withServer(t, { form: formWithImage(bytes, mimeType) });
    assert.equal(response.status, 200);
    assert.equal(data.result.disease, 'Possible leaf spot');
    assert.equal(data.result.confidence, 0.82);
    assert.match(data.disclaimer, /not a confirmed diagnosis/i);
  }
  assert.deepEqual(received.map(({ body }) => body.image.mimeType), Object.keys(imageBytes));
  assert.ok(received.every(({ body, options }) => body.model === 'test-image-model' && options.headers.Authorization === 'Bearer test-provider-key' && options.timeout === 5000 && options.maxRedirects === 0));
  assert.equal(received[0].body.image.data, imageBytes['image/jpeg'].toString('base64'));
});

test('missing image returns a validation error', async (t) => {
  configureProvider(t);
  const { response, data } = await withServer(t, { form: new FormData() });
  assert.equal(response.status, 400);
  assert.match(data.message, /choose a crop image/i);
});

test('unsupported declared MIME type is rejected before provider invocation', async (t) => {
  configureProvider(t);
  t.mock.method(axios, 'post', async () => assert.fail('unsupported type must not reach provider'));
  const { response, data } = await withServer(t, { form: formWithImage(Buffer.from('GIF89a'), 'image/gif', 'test.gif') });
  assert.equal(response.status, 415);
  assert.match(data.message, /JPEG, PNG, or WebP/);
});

test('invalid or mismatched image signatures are rejected', async (t) => {
  configureProvider(t);
  t.mock.method(axios, 'post', async () => assert.fail('invalid bytes must not reach provider'));
  for (const [bytes, mimeType] of [[Buffer.from('not an image'), 'image/jpeg'], [imageBytes['image/png'], 'image/jpeg']]) {
    const { response } = await withServer(t, { form: formWithImage(bytes, mimeType) });
    assert.equal(response.status, 415);
  }
});

test('oversized upload returns 413 without calling provider', async (t) => {
  configureProvider(t);
  t.mock.method(axios, 'post', async () => assert.fail('oversized file must not reach provider'));
  const bytes = Buffer.alloc(5 * 1024 * 1024 + 1);
  const signature = imageBytes['image/jpeg'];
  signature.copy(bytes);
  const { response, data } = await withServer(t, { form: formWithImage(bytes) });
  assert.equal(response.status, 413);
  assert.match(data.message, /size limit/i);
});

test('malformed multipart request returns a safe 400 response', async (t) => {
  configureProvider(t);
  const { response, data } = await withServer(t, { rawBody: '--broken\r\nContent-Disposition: form-data; name="image"; filename="x.jpg"\r\n', contentType: 'multipart/form-data; boundary=broken' });
  assert.equal(response.status, 400);
  assert.deepEqual(data, { message: 'Malformed multipart image upload.' });
});

test('upload route requires authentication before accepting an image', async (t) => {
  configureProvider(t);
  t.mock.method(axios, 'post', async () => assert.fail('unauthenticated upload must not reach provider'));
  const { response, data } = await withServer(t, { token: false, form: formWithImage() });
  assert.equal(response.status, 401);
  assert.deepEqual(data, { message: 'Please sign in to continue.' });
});

test('analysis unavailable response is explicit when provider configuration is missing', async (t) => {
  configureProvider(t, false);
  t.mock.method(axios, 'post', async () => assert.fail('unconfigured provider must not be called'));
  const { response, data } = await withServer(t, { form: formWithImage() });
  assert.equal(response.status, 503);
  assert.equal(data.code, 'DISEASE_PROVIDER_UNAVAILABLE');
  assert.match(data.message, /no diagnosis was made/i);
});

test('provider timeouts are distinguishable and safe', async (t) => {
  configureProvider(t);
  t.mock.method(axios, 'post', async () => { throw Object.assign(new Error('private timeout details'), { code: 'ECONNABORTED' }); });
  const { response, data } = await withServer(t, { form: formWithImage() });
  assert.equal(response.status, 504);
  assert.equal(data.code, 'DISEASE_PROVIDER_TIMEOUT');
  assert.doesNotMatch(JSON.stringify(data), /private timeout details|provider-key|test-model/i);
});

test('remote insecure provider URLs are rejected and provider redirects are disabled', async (t) => {
  configureProvider(t);
  process.env.DISEASE_API_URL = 'http://provider.example.test/analyze';
  const post = t.mock.method(axios, 'post', async () => assert.fail('insecure remote provider must not be called'));
  const { response, data } = await withServer(t, { form: formWithImage() });
  assert.equal(response.status, 503);
  assert.equal(data.code, 'DISEASE_PROVIDER_UNAVAILABLE');
  assert.equal(post.mock.calls.length, 0);
});

test('provider failures return a safe gateway response', async (t) => {
  configureProvider(t);
  t.mock.method(axios, 'post', async () => { throw Object.assign(new Error('secret endpoint and response data'), { response: { data: { key: 'private' } } }); });
  const { response, data } = await withServer(t, { form: formWithImage() });
  assert.equal(response.status, 502);
  assert.equal(data.code, 'DISEASE_PROVIDER_FAILURE');
  assert.doesNotMatch(JSON.stringify(data), /secret endpoint|private|provider-key/i);
});

test('malformed provider response is rejected instead of shown as a prediction', async (t) => {
  configureProvider(t);
  t.mock.method(axios, 'post', async () => ({ data: { answer: 'Your plant is sick.' } }));
  const { response, data } = await withServer(t, { form: formWithImage() });
  assert.equal(response.status, 502);
  assert.equal(data.code, 'DISEASE_PROVIDER_INVALID_RESPONSE');
});

test('invalid confidence values are rejected rather than normalized into a score', async (t) => {
  configureProvider(t);
  t.mock.method(axios, 'post', async () => ({ data: { disease: 'Possible leaf spot', confidence: 82 } }));
  const { response, data } = await withServer(t, { form: formWithImage() });
  assert.equal(response.status, 502);
  assert.equal(data.code, 'DISEASE_PROVIDER_INVALID_RESPONSE');
});

test('analysis results are transient and are not exposed through a result lookup API', async (t) => {
  configureProvider(t);
  t.mock.method(axios, 'post', async () => ({ data: { disease: 'Possible leaf spot' } }));
  const uploaded = await withServer(t, { form: formWithImage() });
  assert.equal(uploaded.response.status, 200);
  assert.equal(uploaded.data.result.userId, undefined);
  assert.equal(uploaded.data.analysisId, undefined);
  const server = app.listen(0);
  t.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  await new Promise((resolve) => server.once('listening', resolve));
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/disease/results/64b000000000000000000099`, { headers: { Authorization: `Bearer ${jwt.sign({ id: '64b000000000000000000099' }, secret)}` } });
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { message: 'The requested resource was not found.' });
});
