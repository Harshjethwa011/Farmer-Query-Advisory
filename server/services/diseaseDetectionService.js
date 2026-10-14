import axios from 'axios';

/**
 * Provider contract: POST JSON { model, image: { mimeType, data } } with a
 * bearer token. The response must be { disease } and may include crop,
 * confidence (0..1), symptoms, and prevention. Provider calls stay server-side.
 */
export async function detectDisease(imageBuffer, { mimeType } = {}) {
  const provider = process.env.DISEASE_PROVIDER;
  const model = process.env.DISEASE_MODEL;
  const apiUrl = process.env.DISEASE_API_URL;
  const apiKey = process.env.DISEASE_API_KEY;
  if (provider !== 'http-json' || !model || !apiUrl || !apiKey) {
    throw serviceError(503, 'Disease image analysis is not configured. Image validation is available, but no diagnosis was made.', 'DISEASE_PROVIDER_UNAVAILABLE');
  }

  let endpoint;
  try { endpoint = new URL(apiUrl); }
  catch { throw serviceError(503, 'Disease image analysis provider configuration is invalid.', 'DISEASE_PROVIDER_UNAVAILABLE'); }
  const localHttp = endpoint.protocol === 'http:' && ['localhost', '127.0.0.1', '::1'].includes(endpoint.hostname);
  if ((endpoint.protocol !== 'https:' && !localHttp) || endpoint.username || endpoint.password || endpoint.hash) {
    throw serviceError(503, 'Disease image analysis provider configuration is invalid.', 'DISEASE_PROVIDER_UNAVAILABLE');
  }

  const configuredTimeout = Number.parseInt(process.env.DISEASE_TIMEOUT_MS, 10);
  const timeout = Number.isInteger(configuredTimeout) ? Math.min(Math.max(configuredTimeout, 1000), 60_000) : 20_000;
  let response;
  try {
    response = await axios.post(endpoint.href, {
      model,
      image: { mimeType, data: imageBuffer.toString('base64') },
    }, {
      timeout,
      maxRedirects: 0,
      maxBodyLength: 7 * 1024 * 1024,
      maxContentLength: 256 * 1024,
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      throw serviceError(504, 'Disease analysis took too long. Please try again.', 'DISEASE_PROVIDER_TIMEOUT');
    }
    throw serviceError(502, 'The disease analysis provider is temporarily unavailable.', 'DISEASE_PROVIDER_FAILURE');
  }

  const result = normalizeResult(response?.data);
  if (!result) throw serviceError(502, 'The disease analysis provider returned an invalid response.', 'DISEASE_PROVIDER_INVALID_RESPONSE');
  return result;
}

function normalizeResult(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || typeof value.disease !== 'string') return null;
  const disease = value.disease.trim();
  if (!disease || disease.length > 120) return null;
  if (value.crop !== undefined && (typeof value.crop !== 'string' || value.crop.trim().length > 100)) return null;
  if (value.confidence !== undefined && (typeof value.confidence !== 'number' || !Number.isFinite(value.confidence) || value.confidence < 0 || value.confidence > 1)) return null;
  for (const key of ['symptoms']) {
    if (value[key] !== undefined && (typeof value[key] !== 'string' || value[key].length > 1200)) return null;
  }

  return {
    disease,
    ...(value.crop?.trim() ? { crop: value.crop.trim() } : {}),
    ...(value.confidence !== undefined ? { confidence: value.confidence } : {}),
    ...(value.symptoms ? { symptoms: value.symptoms.trim() } : {}),
  };
}

function serviceError(status, message, code) {
  return Object.assign(new Error(message), { status, code });
}
