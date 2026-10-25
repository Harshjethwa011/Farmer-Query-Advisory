
import axios from 'axios';

const DEFAULT_AI_TIMEOUT_MS = 45_000;
const MIN_AI_TIMEOUT_MS = 1_000;
const MAX_AI_TIMEOUT_MS = 120_000;

const OPENAI_CHAT_COMPLETIONS_URL =
  'https://api.openai.com/v1/chat/completions';

const GROQ_CHAT_COMPLETIONS_URL =
  'https://api.groq.com/openai/v1/chat/completions';

const DEFAULT_OLLAMA_BASE_URL = 'http://127.0.0.1:11434';

const API_PROVIDERS = ['openai', 'groq', 'ollama'];

function configuredTimeout() {
  const value = process.env.AI_TIMEOUT_MS?.trim();

  if (!value) return DEFAULT_AI_TIMEOUT_MS;

  const parsed = Number(value);

  return Number.isSafeInteger(parsed) &&
    parsed >= MIN_AI_TIMEOUT_MS &&
    parsed <= MAX_AI_TIMEOUT_MS
    ? parsed
    : DEFAULT_AI_TIMEOUT_MS;
}

function configurationError(provider) {
  const message = API_PROVIDERS.includes(provider)
    ? `AI advisory is not configured yet. Set AI_PROVIDER to ${provider}, configure the required credentials, and set AI_MODEL in server/.env.`
    : 'AI advisory is not configured. Set AI_PROVIDER to openai, groq, or ollama and provide a valid AI_MODEL in server/.env.';

  const error = new Error(message);
  error.status = 503;
  return error;
}

function safeError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function providerError(cause, provider) {
  if (
    cause.code === 'ECONNABORTED' ||
    cause.code === 'ETIMEDOUT'
  ) {
    return safeError(
      'The agricultural assistant took too long to respond. Please try again.',
      504
    );
  }

  const status = cause.response?.status;
  const providerCode = cause.response?.data?.error?.code;

  if (provider === 'ollama') {
    if (
      cause.code === 'ECONNREFUSED' ||
      cause.code === 'ENOTFOUND'
    ) {
      return safeError(
        'Cannot reach Ollama. Start the local Ollama service and try again.',
        503
      );
    }

    if (status === 404) {
      return safeError(
        'The configured Ollama model is unavailable. Check AI_MODEL and pull the model if needed.',
        503
      );
    }

    if (status === 429) {
      return safeError(
        'The local Ollama service is busy. Please try again shortly.',
        503
      );
    }
  } else {
    if (status === 401 || status === 403) {
      return safeError(
        'The AI provider rejected its credentials. Check AI_API_KEY in server/.env.',
        502
      );
    }

    if (status === 429 && providerCode === 'insufficient_quota') {
      return safeError(
        'The AI provider account has no available quota. Check usage limits.',
        503
      );
    }

    if (status === 429) {
      return safeError(
        'The AI provider is receiving too many requests. Please try again shortly.',
        503
      );
    }

    if (
      status === 400 &&
      ['model_not_found', 'invalid_model'].includes(providerCode)
    ) {
      return safeError(
        'The configured AI model is unavailable. Check AI_MODEL in server/.env.',
        502
      );
    }
  }

  return safeError(
    'The agricultural assistant is temporarily unavailable. Please try again.',
    502
  );
}

function getMessages({
  question,
  language,
  location,
  cropContext,
}) {
  const systemPrompt = [
    `You are a cautious agricultural information assistant. Respond in ${language}.`,
    'Organize answers under Possible issue, Possible causes, Recommended actions, Prevention and tips, and Caution when relevant.',
    'Give practical, locally-aware guidance and ask for missing context when needed.',
    'Do not guarantee results or invent facts, weather data, crop prices, or pesticide instructions.',
    'Avoid unsafe chemical dosing. Recommend a local agricultural extension officer for serious or uncertain cases.',
  ];

  if (cropContext) {
    systemPrompt.push(
      'Use the following curated crop context only when relevant. Preserve its source attribution. Treat unavailable details as unknown. Do not extrapolate rates or dates or invent pesticide instructions.',
      `Curated crop context:\n${cropContext}`
    );
  }

  return [
    {
      role: 'system',
      content: systemPrompt.join('\n\n'),
    },
    {
      role: 'user',
      content: `Farmer location context: ${
        location || 'not provided'
      }\nFarmer question: ${question}`,
    },
  ];
}

/**
 * Backend-only AI provider adapter.
 * API keys are never sent to the browser.
 */
export async function getFarmAdvice({
  question,
  language = 'English',
  location = '',
  cropContext = '',
}) {
  const provider =
    process.env.AI_PROVIDER?.trim().toLowerCase() || 'openai';

  const model = process.env.AI_MODEL?.trim();
  const apiKey = process.env.AI_API_KEY?.trim();

  if (
    !API_PROVIDERS.includes(provider) ||
    !model ||
    (['openai', 'groq'].includes(provider) && !apiKey)
  ) {
    throw configurationError(provider);
  }

  const messages = getMessages({
    question,
    language,
    location,
    cropContext,
  });

  let data;

  try {
    let result;

    if (provider === 'openai' || provider === 'groq') {
      const url =
        provider === 'groq'
          ? GROQ_CHAT_COMPLETIONS_URL
          : OPENAI_CHAT_COMPLETIONS_URL;

      result = await axios.post(
        url,
        {
          model,
          temperature: 0.25,
          messages,
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
          timeout: configuredTimeout(),
        }
      );

      data = result.data;
    } else {
      const baseUrl = (
        process.env.OLLAMA_BASE_URL?.trim() ||
        DEFAULT_OLLAMA_BASE_URL
      ).replace(/\/+$/, '');

      result = await axios.post(
        `${baseUrl}/api/chat`,
        {
          model,
          messages,
          stream: false,
          options: {
            temperature: 0.25,
          },
        },
        {
          timeout: configuredTimeout(),
        }
      );

      data = result.data;
    }
  } catch (cause) {
    throw providerError(cause, provider);
  }

  const answer = ['openai', 'groq'].includes(provider)
    ? data?.choices?.[0]?.message?.content
    : data?.message?.content;

  if (typeof answer !== 'string' || !answer.trim()) {
    throw safeError(
      'The agricultural assistant returned an empty response. Please try again.',
      502
    );
  }

  return answer.trim();
}
