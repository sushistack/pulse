// ===========================================
// pulse - Plane.so API Helper
// ===========================================
// Reusable Plane.so API utilities for n8n Code nodes.
// Follows P-2 standards: base path, auth, pagination, retry.

const {
  PLANE_API_TIMEOUT,
  PLANE_API_ERROR,
  PLANE_AUTH_FAILED,
} = require('./error-codes');

// --- Configuration ---

const getConfig = () => ({
  base_url: process.env.PULSE_PLANE_BASE_URL,
  workspace_slug: process.env.PULSE_PLANE_WORKSPACE_SLUG,
  api_key: process.env.PULSE_PLANE_API_KEY,
  daily_quest_project_id: process.env.PULSE_DAILY_QUEST_PROJECT_ID,
  states: {
    todo: process.env.PULSE_STATE_TODO_ID,
    in_progress: process.env.PULSE_STATE_IN_PROGRESS_ID,
    deferred: process.env.PULSE_STATE_DEFERRED_ID,
    done: process.env.PULSE_STATE_DONE_ID,
    canceled: process.env.PULSE_STATE_CANCELED_ID,
  },
  label_daily_routine: process.env.PULSE_LABEL_DAILY_ROUTINE_ID,
});

const getBasePath = (config) =>
  `${config.base_url}/api/v1/workspaces/${config.workspace_slug}`;

const getHeaders = (config) => ({
  'X-API-Key': config.api_key,
  'Content-Type': 'application/json',
});

// --- Retry Logic ---

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const MAX_RETRIES = 3;
const RETRY_INTERVAL_MS = 5000;

const withRetry = async (fn, context = '') => {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await fn();
      return result;
    } catch (error) {
      const isLastAttempt = attempt === MAX_RETRIES;
      console.log(
        `[RETRY] ${context} attempt ${attempt}/${MAX_RETRIES} failed: ${error.message}`
      );

      if (isLastAttempt) {
        const isTimeout =
          error.code === 'ETIMEDOUT' ||
          error.code === 'ECONNABORTED' ||
          error.message?.includes('timeout');
        const errorCode = isTimeout ? PLANE_API_TIMEOUT : PLANE_API_ERROR;
        throw new PlaneApiError(errorCode, error.message, context);
      }

      await sleep(RETRY_INTERVAL_MS);
    }
  }
};

// --- Custom Error ---

class PlaneApiError extends Error {
  constructor(code, message, context = '') {
    super(`[${code}] ${context}: ${message}`);
    this.code = code;
    this.context = context;
  }
}

// --- Core API Methods ---

const apiRequest = async (config, method, path, body = null) => {
  const url = `${getBasePath(config)}${path}`;
  const headers = getHeaders(config);

  const options = { method, headers };
  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);

  if (response.status === 401 || response.status === 403) {
    throw new PlaneApiError(
      PLANE_AUTH_FAILED,
      `HTTP ${response.status}`,
      path
    );
  }

  if (!response.ok) {
    const text = await response.text().catch(() => 'Unknown error');
    throw new PlaneApiError(
      PLANE_API_ERROR,
      `HTTP ${response.status}: ${text}`,
      path
    );
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
};

// --- Public API ---

const listIssues = async (config, projectId, params = {}) => {
  const query = new URLSearchParams({
    per_page: '100',
    expand: 'labels,state',
    ...params,
  });
  const path = `/projects/${projectId}/issues/?${query.toString()}`;

  return withRetry(
    () => apiRequest(config, 'GET', path),
    `listIssues(${projectId})`
  );
};

const getIssue = async (config, projectId, issueId) => {
  const path = `/projects/${projectId}/issues/${issueId}/?expand=labels,state`;

  return withRetry(
    () => apiRequest(config, 'GET', path),
    `getIssue(${issueId})`
  );
};

const createIssue = async (config, projectId, issueData) => {
  const path = `/projects/${projectId}/issues/`;

  return withRetry(
    () => apiRequest(config, 'POST', path, issueData),
    `createIssue(${projectId})`
  );
};

const updateIssue = async (config, projectId, issueId, updateData) => {
  const path = `/projects/${projectId}/issues/${issueId}/`;

  return withRetry(
    () => apiRequest(config, 'PATCH', path, updateData),
    `updateIssue(${issueId})`
  );
};

const createComment = async (config, projectId, issueId, commentHtml) => {
  const path = `/projects/${projectId}/issues/${issueId}/comments/`;

  return withRetry(
    () =>
      apiRequest(config, 'POST', path, {
        comment_html: `<p>${commentHtml}</p>`,
      }),
    `createComment(${issueId})`
  );
};

const listProjects = async (config) => {
  const path = `/projects/`;

  return withRetry(
    () => apiRequest(config, 'GET', path),
    'listProjects'
  );
};

const listLabels = async (config, projectId) => {
  const path = `/projects/${projectId}/labels/`;

  return withRetry(
    () => apiRequest(config, 'GET', path),
    `listLabels(${projectId})`
  );
};

module.exports = {
  getConfig,
  getBasePath,
  getHeaders,
  withRetry,
  PlaneApiError,
  listIssues,
  getIssue,
  createIssue,
  updateIssue,
  createComment,
  listProjects,
  listLabels,
};
