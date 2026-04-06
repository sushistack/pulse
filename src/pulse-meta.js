// ===========================================
// pulse - pulse-meta JSON Parser & Validator
// ===========================================
// Extracts and validates pulse-meta JSON blocks from
// Plane.so issue description_html fields.
// Handles 4 extraction patterns (F-4).

const path = require('path');
const { INVALID_ROUTINE_META } = require('./error-codes');

// --- Load Schema from JSON file ---
const schemaPath = path.resolve(__dirname, '..', 'schemas', 'pulse-meta.schema.json');
const SCHEMA_JSON = require(schemaPath);

// --- Extraction Patterns (F-4) ---

const extractPulseMeta = (descriptionHtml) => {
  if (!descriptionHtml || typeof descriptionHtml !== 'string') {
    return null;
  }

  // Pattern 1: Raw markdown fenced code block
  //   ```pulse-meta\n{...}\n```
  const markdownMatch = descriptionHtml.match(
    /```pulse-meta\s*\n([\s\S]*?)\n\s*```/
  );
  if (markdownMatch) {
    return markdownMatch[1].trim();
  }

  // Pattern 2: HTML with class attribute
  //   <pre><code class="language-pulse-meta">...</code></pre>
  const htmlClassMatch = descriptionHtml.match(
    /<pre><code\s+class="language-pulse-meta">([\s\S]*?)<\/code><\/pre>/
  );
  if (htmlClassMatch) {
    return decodeHtmlEntities(htmlClassMatch[1].trim());
  }

  // Pattern 3: HTML without class (fallback — only if content looks like pulse-meta JSON)
  //   <pre><code>...</code></pre>
  const htmlNoClassMatch = descriptionHtml.match(
    /<pre><code>([\s\S]*?)<\/code><\/pre>/
  );
  if (htmlNoClassMatch) {
    const content = decodeHtmlEntities(htmlNoClassMatch[1].trim());
    if (content.includes('"schema_version"')) {
      return content;
    }
  }

  // Pattern 4: HTML entities variant (covered by Pattern 2 + decodeHtmlEntities)
  // Already handled above via decodeHtmlEntities

  return null;
};

// --- HTML Entity Decoder ---

const decodeHtmlEntities = (str) =>
  str
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");

// --- Schema Validation (derived from schemas/pulse-meta.schema.json) ---

const SCHEMA = {
  required: SCHEMA_JSON.required,
  enums: {
    routine_type: SCHEMA_JSON.properties.routine_type.enum,
    routine_priority: SCHEMA_JSON.properties.routine_priority.enum,
    routine_days_items: SCHEMA_JSON.properties.routine_days.items.enum,
  },
};

const validatePulseMeta = (data) => {
  const errors = [];

  // Check required fields
  for (const field of SCHEMA.required) {
    if (data[field] === undefined || data[field] === null) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // Type & value checks
  if (data.schema_version !== 1) {
    errors.push(`Invalid schema_version: expected 1, got ${data.schema_version}`);
  }

  if (!SCHEMA.enums.routine_type.includes(data.routine_type)) {
    errors.push(`Invalid routine_type: ${data.routine_type}`);
  }

  if (!Array.isArray(data.routine_days) || data.routine_days.length === 0) {
    errors.push('routine_days must be a non-empty array');
  } else {
    for (const day of data.routine_days) {
      if (!SCHEMA.enums.routine_days_items.includes(day)) {
        errors.push(`Invalid routine_days value: ${day}`);
      }
    }
  }

  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(data.routine_time)) {
    errors.push(`Invalid routine_time format: ${data.routine_time}`);
  }

  if (
    typeof data.routine_duration_min !== 'number' ||
    data.routine_duration_min < 1 ||
    data.routine_duration_min > 480
  ) {
    errors.push(`Invalid routine_duration_min: ${data.routine_duration_min}`);
  }

  if (!SCHEMA.enums.routine_priority.includes(data.routine_priority)) {
    errors.push(`Invalid routine_priority: ${data.routine_priority}`);
  }

  if (typeof data.routine_mandatory !== 'boolean') {
    errors.push(`routine_mandatory must be boolean: ${data.routine_mandatory}`);
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.routine_active_from)) {
    errors.push(`Invalid routine_active_from date: ${data.routine_active_from}`);
  }

  if (
    data.routine_active_until !== undefined &&
    data.routine_active_until !== null &&
    !/^\d{4}-\d{2}-\d{2}$/.test(data.routine_active_until)
  ) {
    errors.push(`Invalid routine_active_until date: ${data.routine_active_until}`);
  }

  if (
    typeof data.routine_cooldown_days !== 'number' ||
    data.routine_cooldown_days < 0
  ) {
    errors.push(`Invalid routine_cooldown_days: ${data.routine_cooldown_days}`);
  }

  if (typeof data.source_project_id !== 'string' || !data.source_project_id) {
    errors.push('source_project_id must be a non-empty string');
  }

  if (typeof data.source_issue_id !== 'string' || !data.source_issue_id) {
    errors.push('source_issue_id must be a non-empty string');
  }

  return errors.length > 0
    ? { valid: false, errors }
    : { valid: true, errors: [] };
};

// --- Main Parse Function ---

const parsePulseMeta = (descriptionHtml, issueTitle = 'unknown') => {
  const raw = extractPulseMeta(descriptionHtml);

  if (!raw) {
    return {
      success: false,
      error_code: INVALID_ROUTINE_META,
      message: `No pulse-meta block found in issue '${issueTitle}'`,
      data: null,
    };
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    return {
      success: false,
      error_code: INVALID_ROUTINE_META,
      message: `JSON parse error in issue '${issueTitle}': ${e.message}`,
      data: null,
    };
  }

  const validation = validatePulseMeta(parsed);
  if (!validation.valid) {
    return {
      success: false,
      error_code: INVALID_ROUTINE_META,
      message: `Validation failed for issue '${issueTitle}': ${validation.errors.join('; ')}`,
      data: null,
    };
  }

  return {
    success: true,
    error_code: null,
    message: null,
    data: parsed,
  };
};

module.exports = {
  extractPulseMeta,
  decodeHtmlEntities,
  validatePulseMeta,
  parsePulseMeta,
};
