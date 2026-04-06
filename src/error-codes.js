// ===========================================
// pulse - Error Taxonomy Constants
// ===========================================
// Flat string exports for all error codes used across workflows.
// Referenced by W1-W4, W5, and response-formatter.

// --- Plane.so Errors ---
const PLANE_API_TIMEOUT = 'PLANE_API_TIMEOUT';
const PLANE_API_ERROR = 'PLANE_API_ERROR';
const PLANE_AUTH_FAILED = 'PLANE_AUTH_FAILED';
const PLANE_PROJECT_NOT_FOUND = 'PLANE_PROJECT_NOT_FOUND';

// --- DeepSeek Errors ---
const DEEPSEEK_TIMEOUT = 'DEEPSEEK_TIMEOUT';
const DEEPSEEK_API_ERROR = 'DEEPSEEK_API_ERROR';
const DEEPSEEK_JSON_PARSE_ERROR = 'DEEPSEEK_JSON_PARSE_ERROR';
const DEEPSEEK_BUDGET_EXCEEDED = 'DEEPSEEK_BUDGET_EXCEEDED';

// --- Routine & Quest Errors ---
const INVALID_ROUTINE_META = 'INVALID_ROUTINE_META';
const LABEL_MISMATCH = 'LABEL_MISMATCH';
const DUPLICATE_QUEST = 'DUPLICATE_QUEST';
const QUEST_NOT_FOUND = 'QUEST_NOT_FOUND';

// --- Command Errors ---
const UNKNOWN_COMMAND = 'UNKNOWN_COMMAND';
const INVALID_INPUT = 'INVALID_INPUT';
const AMBIGUOUS_MATCH = 'AMBIGUOUS_MATCH';
const SESSION_EXPIRED = 'SESSION_EXPIRED';

// --- System Errors ---
const DEGRADED_MODE = 'DEGRADED_MODE';
const N8N_UNREACHABLE = 'N8N_UNREACHABLE';
const ENV_VALIDATION_FAILED = 'ENV_VALIDATION_FAILED';
const W0_VALIDATION_FAILED = 'W0_VALIDATION_FAILED';
const LOBEHUB_PUSH_FAILED = 'LOBEHUB_PUSH_FAILED';

// --- Error Recovery Messages ---
const RECOVERY = {
  [PLANE_API_TIMEOUT]: 'Please check Plane.so service status and try again later.',
  [PLANE_API_ERROR]: 'Please check Plane.so API configuration.',
  [PLANE_AUTH_FAILED]: 'Please verify PULSE_PLANE_API_KEY in .env.',
  [PLANE_PROJECT_NOT_FOUND]: 'Please verify PULSE_DAILY_QUEST_PROJECT_ID in .env.',
  [DEEPSEEK_TIMEOUT]: 'DeepSeek API is slow or unreachable. System continues in degraded mode.',
  [DEEPSEEK_API_ERROR]: 'Please check DeepSeek API configuration.',
  [DEEPSEEK_JSON_PARSE_ERROR]: 'LLM returned invalid JSON. Retrying with lower temperature.',
  [DEEPSEEK_BUDGET_EXCEEDED]: 'LLM time budget exceeded. Remaining steps skipped.',
  [INVALID_ROUTINE_META]: 'Please check the pulse-meta block in the routine issue description.',
  [LABEL_MISMATCH]: 'Please verify the label name matches "daily-routine" exactly.',
  [UNKNOWN_COMMAND]: 'Type /help for available commands.',
  [INVALID_INPUT]: 'Please check input format and try again.',
  [DUPLICATE_QUEST]: 'A quest for this routine already exists today. No action needed.',
  [QUEST_NOT_FOUND]: 'The referenced quest could not be found in Plane.so. Verify the issue ID.',
  [AMBIGUOUS_MATCH]: 'Multiple matches found. Please refine your search with more specific terms.',
  [SESSION_EXPIRED]: 'Session has expired. Please start a new conversation.',
  [DEGRADED_MODE]: 'System is operating in degraded mode. Some features may be unavailable.',
  [ENV_VALIDATION_FAILED]: 'One or more required environment variables are missing. Run W0 to diagnose.',
  [W0_VALIDATION_FAILED]: 'Environment validation failed. Check W0 output for details.',
  [N8N_UNREACHABLE]: 'Please check n8n service status.',
  [LOBEHUB_PUSH_FAILED]: 'LobeHub notification delivery failed. Check LobeHub service.',
};

module.exports = {
  PLANE_API_TIMEOUT,
  PLANE_API_ERROR,
  PLANE_AUTH_FAILED,
  PLANE_PROJECT_NOT_FOUND,
  DEEPSEEK_TIMEOUT,
  DEEPSEEK_API_ERROR,
  DEEPSEEK_JSON_PARSE_ERROR,
  DEEPSEEK_BUDGET_EXCEEDED,
  INVALID_ROUTINE_META,
  LABEL_MISMATCH,
  DUPLICATE_QUEST,
  QUEST_NOT_FOUND,
  UNKNOWN_COMMAND,
  INVALID_INPUT,
  AMBIGUOUS_MATCH,
  SESSION_EXPIRED,
  DEGRADED_MODE,
  N8N_UNREACHABLE,
  ENV_VALIDATION_FAILED,
  W0_VALIDATION_FAILED,
  LOBEHUB_PUSH_FAILED,
  RECOVERY,
};
