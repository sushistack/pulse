#!/usr/bin/env bash
# ===========================================
# pulse - Environment Variable Validation
# ===========================================
# Quick check that all required environment variables are present and non-empty.
#
# Usage:
#   ./scripts/validate-env.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Load .env if present
if [[ -f "$PROJECT_ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$PROJECT_ROOT/.env"
  set +a
fi

REQUIRED_VARS=(
  PULSE_PLANE_API_KEY
  PULSE_PLANE_BASE_URL
  PULSE_PLANE_WORKSPACE_SLUG
  PULSE_DAILY_QUEST_PROJECT_ID
  PULSE_STATE_TODO_ID
  PULSE_STATE_IN_PROGRESS_ID
  PULSE_STATE_DEFERRED_ID
  PULSE_STATE_DONE_ID
  PULSE_STATE_CANCELED_ID
  PULSE_LABEL_DAILY_ROUTINE_ID
  PULSE_DEEPSEEK_API_KEY
  PULSE_DEEPSEEK_BASE_URL
  PULSE_N8N_WEBHOOK_SECRET
  PULSE_USER_TIMEZONE
)

MISSING=0
echo "=== pulse Environment Validation ==="
echo ""

for var in "${REQUIRED_VARS[@]}"; do
  if [[ -z "${!var:-}" ]]; then
    echo "  FAIL - $var is not set"
    MISSING=$((MISSING + 1))
  else
    echo "  OK   - $var"
  fi
done

echo ""
if [[ $MISSING -gt 0 ]]; then
  echo "RESULT: $MISSING variable(s) missing. Please check .env"
  exit 1
else
  echo "RESULT: All required variables are set."
fi
