#!/usr/bin/env bash
# ===========================================
# pulse - Plane.so Project & State Setup
# ===========================================
# Creates the "Daily Quests" project with required states and labels.
# Outputs environment variable values for .env configuration.
#
# Prerequisites:
#   - PULSE_PLANE_API_KEY, PULSE_PLANE_BASE_URL, PULSE_PLANE_WORKSPACE_SLUG set in .env
#
# Usage:
#   ./scripts/setup.sh

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

# --- Validate required env vars ---
REQUIRED_VARS=(PULSE_PLANE_API_KEY PULSE_PLANE_BASE_URL PULSE_PLANE_WORKSPACE_SLUG)
for var in "${REQUIRED_VARS[@]}"; do
  if [[ -z "${!var:-}" ]]; then
    echo "ERROR: $var is not set. Please configure it in .env"
    exit 1
  fi
done

BASE_URL="${PULSE_PLANE_BASE_URL}/api/v1/workspaces/${PULSE_PLANE_WORKSPACE_SLUG}"
AUTH_HEADER="X-API-Key: ${PULSE_PLANE_API_KEY}"

# --- Helper: API call with error handling ---
api_call() {
  local method="$1"
  local endpoint="$2"
  local data="${3:-}"
  local response

  if [[ -n "$data" ]]; then
    response=$(curl -s -w "\n%{http_code}" -X "$method" \
      "${BASE_URL}${endpoint}" \
      -H "$AUTH_HEADER" \
      -H "Content-Type: application/json" \
      -d "$data")
  else
    response=$(curl -s -w "\n%{http_code}" -X "$method" \
      "${BASE_URL}${endpoint}" \
      -H "$AUTH_HEADER" \
      -H "Content-Type: application/json")
  fi

  local http_code
  http_code=$(echo "$response" | tail -n1)
  local body
  body=$(echo "$response" | sed '$d')

  if [[ "$http_code" -ge 400 ]]; then
    echo "ERROR: API call failed (HTTP $http_code) - $method ${BASE_URL}${endpoint}"
    echo "Response: $body"
    return 1
  fi

  echo "$body"
}

echo "=== pulse Plane.so Setup ==="
echo ""

# --- Step 1: Validate API connectivity ---
echo "[1/4] Validating Plane.so API connectivity..."
api_call GET "/projects/" > /dev/null
echo "  OK - API connection successful"

# --- Step 2: Create "Daily Quests" project ---
echo "[2/4] Creating 'Daily Quests' project..."
PROJECT_RESPONSE=$(api_call POST "/projects/" '{
  "name": "Daily Quests",
  "description": "Auto-generated daily quest board managed by pulse",
  "network": 0,
  "identifier": "DQ"
}')
PROJECT_ID=$(echo "$PROJECT_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "  OK - Project created: $PROJECT_ID"

# --- Step 3: Create custom states ---
echo "[3/4] Creating custom states..."

declare -A STATE_IDS

create_state() {
  local name="$1"
  local group="$2"
  local color="$3"
  local key="$4"

  local response
  response=$(api_call POST "/projects/${PROJECT_ID}/states/" "{
    \"name\": \"$name\",
    \"group\": \"$group\",
    \"color\": \"$color\"
  }")
  STATE_IDS[$key]=$(echo "$response" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
  echo "  OK - State '$name' ($group): ${STATE_IDS[$key]}"
}

create_state "To-Do"       "unstarted"  "#3a3a3a" "TODO"
create_state "In Progress"  "started"    "#f59e0b" "IN_PROGRESS"
create_state "Deferred"     "backlog"    "#6b7280" "DEFERRED"
create_state "Done"         "completed"  "#16a34a" "DONE"
create_state "Canceled"     "cancelled"  "#ef4444" "CANCELED"

# --- Step 4: Create daily-routine label ---
echo "[4/4] Creating 'daily-routine' label..."
LABEL_RESPONSE=$(api_call POST "/projects/${PROJECT_ID}/labels/" '{
  "name": "daily-routine",
  "color": "#8b5cf6"
}')
LABEL_ID=$(echo "$LABEL_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "  OK - Label 'daily-routine': $LABEL_ID"

# --- Output summary ---
echo ""
echo "=== Setup Complete ==="
echo ""
echo "# Add these to your .env file:"
echo "PULSE_DAILY_QUEST_PROJECT_ID=${PROJECT_ID}"
echo "PULSE_STATE_TODO_ID=${STATE_IDS[TODO]}"
echo "PULSE_STATE_IN_PROGRESS_ID=${STATE_IDS[IN_PROGRESS]}"
echo "PULSE_STATE_DEFERRED_ID=${STATE_IDS[DEFERRED]}"
echo "PULSE_STATE_DONE_ID=${STATE_IDS[DONE]}"
echo "PULSE_STATE_CANCELED_ID=${STATE_IDS[CANCELED]}"
echo "PULSE_LABEL_DAILY_ROUTINE_ID=${LABEL_ID}"
