// ===========================================
// pulse - DeepSeek LLM Client
// ===========================================
// Reusable DeepSeek API utilities for n8n Code nodes.
// Follows P-3 (LLM branching pattern): Call → Validate → Retry → Skip.
// Uses OpenAI-compatible API with Base URL override.

const {
  DEEPSEEK_TIMEOUT,
  DEEPSEEK_API_ERROR,
  DEEPSEEK_JSON_PARSE_ERROR,
  DEEPSEEK_BUDGET_EXCEEDED,
} = require('./error-codes');

// --- Configuration ---

const getDeepSeekConfig = () => ({
  api_key: process.env.PULSE_DEEPSEEK_API_KEY,
  base_url: process.env.PULSE_DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1',
  model: process.env.PULSE_DEEPSEEK_MODEL || 'deepseek-chat',
});

// --- Custom Error ---

class DeepSeekError extends Error {
  constructor(code, message, step = '') {
    super(`[${code}] ${step}: ${message}`);
    this.code = code;
    this.step = step;
  }
}

// --- Exponential Backoff Retry (1s→2s→4s) ---

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const BACKOFF_DELAYS = [1000, 2000, 4000];
const MAX_RETRIES = 3;

const withBackoff = async (fn, step = '') => {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const isLastAttempt = attempt === MAX_RETRIES - 1;
      console.log(
        `[RETRY] DeepSeek ${step} attempt ${attempt + 1}/${MAX_RETRIES}: ${error.message}`
      );

      if (isLastAttempt) {
        const isTimeout =
          error.code === 'ETIMEDOUT' ||
          error.code === 'ECONNABORTED' ||
          error.name === 'AbortError' ||
          error.message?.includes('timeout');
        const errorCode = isTimeout ? DEEPSEEK_TIMEOUT : DEEPSEEK_API_ERROR;
        throw new DeepSeekError(errorCode, error.message, step);
      }

      await sleep(BACKOFF_DELAYS[attempt]);
    }
  }
};

// --- Core API Call ---

const PER_STEP_TIMEOUT_MS = 60000;

const callDeepSeek = async (config, systemPrompt, userPrompt, options = {}) => {
  const {
    temperature = 0.7,
    timeout = PER_STEP_TIMEOUT_MS,
    maxTokens = 2048,
  } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(`${config.base_url}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.api_key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature,
        max_tokens: maxTokens,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => 'Unknown error');
      throw new Error(`HTTP ${response.status}: ${text}`);
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content;
    const usage = result.usage || {};

    return { content, usage };
  } finally {
    clearTimeout(timeoutId);
  }
};

// --- P-3 Pattern: Call → Validate → Retry → Skip ---

const callWithValidation = async (config, systemPrompt, userPrompt, validateFn, step = '') => {
  const startTime = Date.now();

  // First attempt with normal temperature
  let result;
  try {
    result = await withBackoff(
      () => callDeepSeek(config, systemPrompt, userPrompt, { temperature: 0.7 }),
      step
    );
  } catch (error) {
    return {
      success: false,
      error: { code: error.code || DEEPSEEK_API_ERROR, message: error.message },
      duration_ms: Date.now() - startTime,
      usage: {},
    };
  }

  // Parse JSON
  let parsed;
  try {
    parsed = JSON.parse(result.content);
    const validationError = validateFn(parsed);
    if (validationError) throw new Error(validationError);
  } catch (parseError) {
    console.log(`[WARN] ${step} JSON parse/validation failed: ${parseError.message}. Retrying with temperature: 0.1`);

    // Retry once with temperature: 0.1
    try {
      result = await callDeepSeek(config, systemPrompt, userPrompt, { temperature: 0.1 });
      parsed = JSON.parse(result.content);
      const validationError = validateFn(parsed);
      if (validationError) throw new Error(validationError);
    } catch (retryError) {
      console.log(`[ERROR] ${step} second parse/validation failed: ${retryError.message}`);
      return {
        success: false,
        error: { code: DEEPSEEK_JSON_PARSE_ERROR, message: retryError.message },
        duration_ms: Date.now() - startTime,
        usage: result.usage || {},
      };
    }
  }

  return {
    success: true,
    data: parsed,
    duration_ms: Date.now() - startTime,
    usage: result.usage || {},
  };
};

// --- LLM Budget Tracker ---

class LlmBudgetTracker {
  constructor(maxBudgetMs = 180000) {
    this.maxBudgetMs = maxBudgetMs;
    this.totalElapsedMs = 0;
    this.steps = [];
  }

  recordStep(stepName, durationMs) {
    this.totalElapsedMs += durationMs;
    this.steps.push({ step: stepName, duration_ms: durationMs });
  }

  isExceeded() {
    return this.totalElapsedMs >= this.maxBudgetMs;
  }

  remainingMs() {
    return Math.max(0, this.maxBudgetMs - this.totalElapsedMs);
  }

  getSummary() {
    return {
      total_elapsed_ms: this.totalElapsedMs,
      max_budget_ms: this.maxBudgetMs,
      exceeded: this.isExceeded(),
      steps: this.steps,
    };
  }
}

module.exports = {
  getDeepSeekConfig,
  DeepSeekError,
  callDeepSeek,
  callWithValidation,
  withBackoff,
  LlmBudgetTracker,
  PER_STEP_TIMEOUT_MS,
  DEEPSEEK_TIMEOUT,
  DEEPSEEK_API_ERROR,
  DEEPSEEK_JSON_PARSE_ERROR,
  DEEPSEEK_BUDGET_EXCEEDED,
};
