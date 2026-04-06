#!/usr/bin/env bash
# ===========================================
# pulse - Plane.so Project & State Setup
# ===========================================
# Creates the "Daily Quests" project with required states and labels.
# Outputs environment variable values for .env configuration.
#
# Prerequisites:
#   - PULSE_PLANE_API_KEY, PULSE_PLANE_BASE_URL, PULSE_PLANE_WORKSPACE_SLUG set in .env
#   - jq installed (https://jqlang.github.io/jq/)
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

# --- Check prerequisites ---
if ! command -v jq &> /dev/null; then
  echo "ERROR: jq is required but not installed. Install it via: brew install jq (macOS) or apt-get install jq (Linux)"
  exit 1
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
echo "[1/5] Validating Plane.so API connectivity..."
api_call GET "/projects/" > /dev/null
echo "  OK - API connection successful"

# --- Step 2: Create "Daily Quests" project ---
echo "[2/5] Creating 'Daily Quests' project..."
PROJECT_RESPONSE=$(api_call POST "/projects/" '{
  "name": "Daily Quests",
  "description": "Auto-generated daily quest board managed by pulse",
  "network": 0,
  "identifier": "DQ"
}')
PROJECT_ID=$(echo "$PROJECT_RESPONSE" | jq -r '.id')
echo "  OK - Project created: $PROJECT_ID"

# --- Step 3: Create custom states ---
echo "[3/5] Creating custom states..."

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
  STATE_IDS[$key]=$(echo "$response" | jq -r '.id')
  echo "  OK - State '$name' ($group): ${STATE_IDS[$key]}"
}

create_state "To-Do"       "unstarted"  "#3a3a3a" "TODO"
create_state "In Progress"  "started"    "#f59e0b" "IN_PROGRESS"
create_state "Deferred"     "backlog"    "#6b7280" "DEFERRED"
create_state "Done"         "completed"  "#16a34a" "DONE"
create_state "Canceled"     "cancelled"  "#ef4444" "CANCELED"

# --- Step 4: Create daily-routine label ---
echo "[4/5] Creating 'daily-routine' label..."
LABEL_RESPONSE=$(api_call POST "/projects/${PROJECT_ID}/labels/" '{
  "name": "daily-routine",
  "color": "#8b5cf6"
}')
LABEL_ID=$(echo "$LABEL_RESPONSE" | jq -r '.id')
echo "  OK - Label 'daily-routine': $LABEL_ID"

# --- Step 5: Create sample routine issues ---
echo "[5/5] Creating sample routine issues..."

PULSE_META_TEMPLATE='{
  "schema_version": 1,
  "routine_type": "%s",
  "routine_days": %s,
  "routine_time": "%s",
  "routine_duration_min": %d,
  "routine_priority": "%s",
  "routine_mandatory": %s,
  "routine_active_from": "%s",
  "routine_active_until": null,
  "routine_cooldown_days": 0,
  "source_project_id": "%s",
  "source_issue_id": ""
}'

TODAY=$(date +%Y-%m-%d)

create_sample_routine() {
  local name="$1"
  local routine_type="$2"
  local days="$3"
  local time="$4"
  local duration="$5"
  local priority="$6"
  local mandatory="$7"

  # Build pulse-meta JSON
  # shellcheck disable=SC2059
  local meta
  meta=$(printf "$PULSE_META_TEMPLATE" \
    "$routine_type" "$days" "$time" "$duration" "$priority" "$mandatory" "$TODAY" "$PROJECT_ID")

  local description
  description=$(printf '### pulse-meta\n```json\n%s\n```' "$meta")

  local response
  response=$(api_call POST "/projects/${PROJECT_ID}/issues/" "$(jq -n \
    --arg name "$name" \
    --arg desc "$description" \
    --arg state "${STATE_IDS[TODO]}" \
    --arg label "$LABEL_ID" \
    '{name: $name, description: $desc, state: $state, labels: [$label]}')")

  local issue_id
  issue_id=$(echo "$response" | jq -r '.id')

  # Backfill source_issue_id in the description
  meta=$(echo "$meta" | jq --arg iid "$issue_id" '.source_issue_id = $iid')
  description=$(printf '### pulse-meta\n```json\n%s\n```' "$meta")
  api_call PATCH "/projects/${PROJECT_ID}/issues/${issue_id}/" "$(jq -n \
    --arg desc "$description" \
    '{description: $desc}')" > /dev/null

  echo "  OK - Sample routine '$name': $issue_id"
}

create_sample_routine "Morning Stretch" \
  "daily" '["mon","tue","wed","thu","fri"]' "07:00" 15 "medium" "true"
create_sample_routine "Weekly Review" \
  "weekly" '["fri"]' "17:00" 30 "high" "true"
create_sample_routine "Read Tech Articles" \
  "weekly" '["tue","thu","sat"]' "21:00" 30 "low" "false"

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
