import axios from 'axios';

const DEFAULT_AI_TIMEOUT_MS = 45_000;
const MIN_AI_TIMEOUT_MS = 1_000;
const MAX_AI_TIMEOUT_MS = 120_000;
const OPENAI_CHAT_COMPLETIONS_URL = 'https://api.openai.com/v1/chat/completions';

function configuredTimeout() {
  const value = process.env.AI_TIMEOUT_MS?.trim();
  if (!value) return DEFAULT_AI_TIMEOUT_MS;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= MIN_AI_TIMEOUT_MS && parsed <= MAX_AI_TIMEOUT_MS
    ? parsed
    : DEFAULT_AI_TIMEOUT_MS;
}

function unavailableConfiguration() {
  const error = new Error('AI advisory is not configured yet. Set AI_PROVIDER=openai, AI_API_KEY, and AI_MODEL in server/.env, then restart the backend.');
  error.status = 503;
  return error;
}

function providerError(cause) {
  if (cause.code === 'ECONNABORTED' || cause.code === 'ETIMEDOUT') {
    const error = new Error('The agricultural assistant took too long to respond. Please try again.');
    error.status = 504;
    return error;
  }

  const status = cause.response?.status;
  const providerCode = cause.response?.data?.error?.code;
  if (status === 401 || status === 403) {
    const error = new Error('The AI provider rejected its server credentials. Check AI_API_KEY configuration.');
    error.status = 502;
    return error;
  }
  if (status === 429 && providerCode === 'insufficient_quota') {
    const error = new Error('The AI provider account has no available quota. Check its billing and usage limits.');
    error.status = 503;
    return error;
  }
  if (status === 429) {
    const error = new Error('The AI provider is receiving too many requests. Please try again shortly.');
    error.status = 503;
    return error;
  }
  if (status === 400 && (providerCode === 'model_not_found' || providerCode === 'invalid_model')) {
    const error = new Error('The configured AI model is unavailable. Check AI_MODEL in server/.env.');
    error.status = 502;
    return error;
  }
  const error = new Error('The agricultural assistant is temporarily unavailable. Please try again.');
  error.status = 502;
  return error;
}

/** Provider adapter: credentials stay on the server; replace this module to change providers. */
export async function getFarmAdvice({ question, language = 'English', location = '', cropContext = '' }) {
  const provider = process.env.AI_PROVIDER?.trim().toLowerCase();
  const apiKey = process.env.AI_API_KEY?.trim();
  const model = process.env.AI_MODEL?.trim();
  if (provider !== 'openai' || !apiKey || !model) throw unavailableConfiguration();

  let data;
  try {
    const result = await axios.post(OPENAI_CHAT_COMPLETIONS_URL, {
      model,
      temperature: 0.25,
      messages: [
        { role: 'system', content: `You are a cautious agricultural information assistant. Respond in ${language}. Organize answers under Possible issue, Possible causes, Recommended actions, Prevention and tips, and Caution when relevant. Give general, locally-aware guidance, ask for missing context, avoid guaranteed claims and unsafe chemical dosing, and recommend a local extension officer for serious or uncertain cases.${cropContext ? ` Use the following curated crop context only when relevant. Preserve its source attribution. Treat unavailable details as unknown, do not extrapolate rates or dates, and do not invent pesticide instructions.\n\n${cropContext}` : ''}` },
        { role: 'user', content: `Farmer location context: ${location || 'not provided'}\nFarmer question: ${question}` },
      ],
    }, {
      headers: { Authorization: `Bearer ${apiKey}` },
      timeout: configuredTimeout(),
    });
    data = result.data;
  } catch (cause) {
    throw providerError(cause);
  }

  const answer = data?.choices?.[0]?.message?.content;
  if (typeof answer !== 'string' || !answer.trim()) {
    const error = new Error('The agricultural assistant returned an empty response. Please try again.');
    error.status = 502;
    throw error;
  }
  return answer.trim();
}
