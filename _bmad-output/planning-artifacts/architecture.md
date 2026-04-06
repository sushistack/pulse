---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
lastStep: 8
status: 'complete'
completedAt: '2026-04-06'
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - docs/start.spec.md
  - docs/plane-openapi.yaml
workflowType: 'architecture'
project_name: 'pulse'
user_name: '사용자'
date: '2026-04-06'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**
49 FRs across 8 categories. The system is a workflow orchestration platform where n8n serves as both the execution engine and API layer — no custom backend code exists. Primary code artifacts are n8n workflow JSON definitions (W1-W4), LobeHub plugin configuration (OpenAPI-compatible function call), and Plane.so project structure setup.

The quest generation pipeline (FR1-FR10) is the architectural centerpiece: a 5-step daily cron workflow that combines deterministic automation (Steps 1-2: deferred handling + routine copy) with LLM-enhanced optimization (Steps 3-5: task generation, schedule optimization, deferred restoration). Each step must be independently recoverable — LLM step failures must not prevent deterministic step completion.

Routine management (FR11-FR16) operates on two creation paths with explicitly different temporal behavior: LobeHub natural language (immediate quest generation option) vs Plane.so direct creation (batch processing at next W1 run). This dual-path design is intentional and must be preserved architecturally.

Interactive commands (FR17-FR24) require multi-turn conversation sessions managed entirely by LobeHub's LLM conversation memory — n8n remains fully stateless. Each webhook call is self-contained; LobeHub's system prompt instructs the LLM to include resolved context (specific issue IDs) in follow-up calls.

**Non-Functional Requirements:**
- Performance: Two-tier command response times (simple ≤5s, analytical ≤15s). W1 deterministic steps ≤60s, LLM steps ≤5min with 60s per-step timeout. Total LLM budget per W1: 3min max.
- Security: API keys in environment variables only. n8n webhooks secured with API key or HMAC. HTTPS for all LobeHub→n8n communication.
- Reliability: W1 >99% daily success rate. Per-step independent recovery. Degraded mode fully functional without LLM indefinitely. Docker auto-restart policy.

**Scale & Complexity:**
- Primary domain: Workflow Orchestration (no-code, n8n-based)
- Complexity level: Medium-High
- Estimated architectural components: ~12 (4 workflows, command handler with 15 commands, LobeHub agent, Plane.so project structure)
- Single user, self-hosted — no multi-tenancy, no horizontal scaling concerns
- Routine scan ceiling: ~100 issues per W1 run

### Technical Constraints & Dependencies

**Plane.so API v1 Constraints:**
- No custom fields API — routine metadata must be stored as `pulse-meta` JSON blocks in issue `description_html`
- Cursor-based pagination with max 100 items per page
- State management via UUID references to project-specific state objects (groups: backlog, unstarted, started, completed, cancelled, triage)
- Labels are project-scoped — `daily-routine` label must exist in each long-term project
- Issue schema: `name`, `description_html`, `priority` (enum), `state` (UUID), `target_date` (date), `start_date` (date), `completed_at` (datetime)
- `expand` parameter supports `labels`, `state`, `assignees` for reducing API call count

**n8n Platform Constraints:**
- n8n is the single point of failure (SPOF) — all automation stops if n8n is down
- Mitigated by: Docker `restart: unless-stopped` (auto-recovery) + Uptime Kuma (external monitoring and alerting) + Plane.so direct access (manual fallback)
- Webhook nodes handle synchronous requests (30s timeout)
- Cron trigger nodes for scheduled automation
- OpenAI-compatible nodes for DeepSeek integration (Base URL override)
- No built-in persistent state — all state must live in Plane.so
- Workflow definitions are JSON templates for portability

**DeepSeek LLM Constraints:**
- OpenAI SDK compatible via Base URL override
- JSON mode (`response_format: { "type": "json_object" }`) requires explicit JSON instruction in system prompt
- Two models: `deepseek-chat` (V3, general) and `deepseek-reasoner` (R1, complex reasoning)
- Rate limiting with exponential backoff (1s→2s→4s, 3 retries before degraded mode)

**LobeHub Constraints:**
- Function Call plugin with single `quest_command` function (action, target, params)
- System prompt defines persona, tone, interactive behavior rules
- LLM conversation memory serves as session state for interactive commands
- Session timeout implicit via conversation context window expiry

### Cross-Cutting Concerns Identified

1. **Error Taxonomy**: Every failure path must return a distinct, documented error code (e.g., PLANE_API_TIMEOUT, DEGRADED_MODE, LABEL_MISMATCH, INVALID_ROUTINE_META, N8N_UNREACHABLE). This spans all 4 workflows and the command handler.

2. **Graceful Degradation**: LLM unavailability must be detected at each LLM call site. Deterministic features continue unaffected. User receives proactive notification when operating in degraded mode. Partial degraded mode possible (e.g., LLM budget exceeded mid-W1).

3. **English-Only Output (FR49)**: All user-facing text — bot responses, error messages, status displays, quest labels, Plane.so project/state/label names — must be in English.

4. **pulse-meta JSON Schema Validation**: The `pulse-meta` JSON block in issue descriptions is the bridge between routine definitions and quest generation. Schema validation occurs at: W1 routine scan, `/preview` dry-run, LobeHub routine creation, `/edit` command. Invalid metadata must be logged and skipped, never crash the pipeline.

5. **KST Timezone Consistency**: All date/time handling uses Asia/Seoul (UTC+9). Quest dates, scheduled times, cron triggers, due dates, and report periods must all align to KST.

6. **Plane.so as Source of Truth**: Any direct edits in Plane.so take precedence. Deleted source routines = existing quests persist, no new generation. Duplicate prevention via `quest_date` + `source_issue_id` combination.

7. **Proactive Notifications**: System events (W1 completion, degraded mode, chronic deferrals) push messages to LobeHub. Normal operation = silent; anomalies = explicit notification.

### Architectural Gaps Identified (Party Mode Review)

The following gaps were identified through multi-agent collaborative review and should be addressed in architectural decisions:

1. **`pulse-meta` JSON Schema Specification**: The routine metadata schema must be formally defined with versioning and evolution strategy. Plane.so UI edits may corrupt fenced code blocks — validation must handle malformed HTML wrapping gracefully.

2. **Session Collision Handling**: When a user initiates a new command during an active interactive session (e.g., `/today` while `/complete` is awaiting input), the expected behavior must be explicitly defined. This is a user behavior guidance concern rather than a technical solution.

3. **Environment Variable Validation Workflow (W0)**: FR43 requires startup connection validation. A dedicated validation mechanism should test all external connections (Plane.so API, DeepSeek API, LobeHub webhook callback) and report status before W1-W4 activate.

4. **Partial Failure Scenarios in W1 Pipeline**: Steps 3-5 have implicit dependencies (Step 4 optimizes Step 3's output). When Step 3 succeeds but Step 4 fails, the system has "half-optimized" quests. The architecture must define whether partially-enhanced quests are acceptable or whether LLM steps are all-or-nothing.

5. **Plane.so Write Failure During W1**: If routine data reads succeed but quest issue creation fails mid-batch, the retry strategy must be defined at issue-level (retry individual creates) not step-level (retry entire step) to avoid duplicates.

## Starter Template Evaluation

### Primary Technology Domain

Workflow Orchestration (no-code, n8n-based) — no custom backend application. Primary code artifacts are n8n workflow JSON definitions, LobeHub plugin configuration, DeepSeek prompt templates, and utility scripts. The existing infrastructure (n8n, LobeHub, Plane.so) is already self-hosted and operational.

### Starter Options Considered

Traditional web/backend starter templates (Next.js, NestJS, T3, etc.) do not apply. pulse's "starter" is the repository structure and development workflow for managing n8n workflows, prompts, schemas, and custom code.

**Option A: n8n UI only (no repo)** — Rejected. No version control, no reproducible deployments.
**Option B: Git repo with structured artifact management** — Selected. Enables version control, diff review, and reproducible setup.

### Selected Approach: Lean Repository Structure

**Rationale:** Start lean, grow organically. Directory structure reflects actual artifacts, not speculative abstractions. Informed by collaborative review (Party Mode) that identified over-engineering risks in the initial proposal.

**Repository Structure:**

```
pulse/
├── workflows/              # n8n workflow JSON definitions (core deliverables)
│   ├── w1-daily-quest-generator.json
│   ├── w2-lobehub-command-handler.json
│   ├── w3-daily-summary-reporter.json
│   └── w4-deferred-cleanup.json
├── src/                    # Reference implementations for n8n Code nodes (canonical logic)
│   ├── pulse-meta.js       # pulse-meta JSON parsing & validation
│   ├── plane-api.js        # Plane.so API helper utilities
│   ├── error-codes.js      # Error taxonomy constants
│   ├── dry-run.js          # DRY_RUN mode support (P-4)
│   └── response-formatter.js  # LobeHub response formatting (F-3, F-5)
├── prompts/                # DeepSeek prompt templates (separated from code — content, not logic)
│   ├── w1-task-generation.md
│   ├── w1-schedule-optimization.md
│   ├── w1-deferred-restoration.md
│   ├── w2-intent-classification.md
│   ├── w3-daily-summary.md
│   ├── w4-cleanup-decision.md
│   └── lobehub-system-prompt.md
├── schemas/                # JSON Schema definitions
│   └── pulse-meta.schema.json
├── lobehub/                # LobeHub configuration
│   └── plugin-manifest.json
├── scripts/                # Setup and utility scripts
│   ├── setup.sh            # Initial Plane.so project/state/label setup via API
│   ├── validate-env.sh     # Environment variable validation (W0 concept)
│   └── sync-code.sh        # Bidirectional n8n JSON ↔ src/ code sync
├── .env.example            # Environment variable template
└── docs/                   # Project documentation
```

**Key Design Decisions:**

| Decision | Choice | Rationale |
|---|---|---|
| n8n workflow management | JSON export → Git repo | Version control, diffable, reproducible deployments |
| n8n Code node language | JavaScript | n8n Code nodes natively support JS; no additional setup |
| Custom code structure | Flat `src/` directory | Avoid premature abstraction; subfolder when >3 files per concern |
| Prompt management | Top-level `prompts/` directory | Prompts are content, not code; higher change frequency; easy to find and edit |
| Plane.so setup | `scripts/setup.sh` via API calls | No `plane/` config directory; JSON files don't auto-apply to Plane.so |
| Docker Compose | Not included | Existing infrastructure already running separately; compose would couple update cycles |
| Configuration | `.env.example` + docs | Standard self-hosted pattern; no compose-level orchestration needed |

**n8n Code Sync Strategy:**

n8n Code nodes cannot `require()` external files, so each handler inlines its own copy of shared logic (retry, meta extraction, formatting, etc.). The `src/` files serve as **canonical reference implementations** — they define the authoritative patterns that inline code must follow.

**Current workflow:** Edit `src/` reference files first, then propagate changes to the n8n JSON Code nodes inline code. A `scripts/sync-code.sh` bidirectional sync script is planned for future automation:

```bash
# Extract: n8n JSON → src/ (after editing in n8n UI)
scripts/sync-code.sh extract

# Inject: src/ → n8n JSON (after editing in IDE)
scripts/sync-code.sh inject
```

Decision to implement this script is deferred until Code node count stabilizes (expected 20-30 nodes across W1-W4 + commands).

**Intentionally Excluded:**

- `plane/states.json`, `plane/labels.json` — Plane.so setup is procedural (API calls), not declarative config
- `docker-compose.yml` — Would conflict with existing independently-managed Docker services
- Nested `src/` subdirectories (`parsers/`, `generators/`, `commands/`, `utils/`) — Premature; add when code volume justifies it
- Build pipeline — Sync script is sufficient for single-developer workflow

**Note:** Repository initialization and project scaffolding should be the first implementation story.

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**
All 14 decisions below are confirmed and block implementation if unresolved.

**Deferred Decisions (Post-MVP):**
- Multi-user support (user_id isolation)
- Google Calendar integration
- Additional LLM providers beyond DeepSeek
- Gamification system (streaks, levels, achievements)

### Data Architecture

| Decision | Choice | Rationale |
|---|---|---|
| pulse-meta schema versioning | `schema_version` field included in every pulse-meta JSON block | Enables future migration paths for breaking schema changes at near-zero cost |
| Deferred State group mapping | Plane.so `backlog` group | Separates Deferred from To-Do (`unstarted`) at group level, preventing W1 from misidentifying Deferred quests as incomplete To-Do items |
| Quest duplication prevention | List-query then in-memory comparison | Single API call to fetch today's quests (`due_date=today`, max 100), extract `source_issue_id` set, O(1) lookup during routine scan. Reuses data already needed by W1 Step 1 |

**Plane.so State Mapping (Complete):**

| pulse State | Plane.so Custom State Name | Plane.so group |
|---|---|---|
| To-Do | "To-Do" | `unstarted` |
| In Progress | "In Progress" | `started` |
| Deferred | "Deferred" | `backlog` |
| Done | "Done" | `completed` |
| Canceled | "Canceled" | `cancelled` |

### Authentication & Security

| Decision | Choice | Rationale |
|---|---|---|
| n8n Webhook authentication | Header API Key (`X-API-Key`) | n8n webhook endpoints are externally accessible; Header Auth is n8n built-in feature, minimal implementation cost |

**Implementation:** `.env` contains `N8N_WEBHOOK_SECRET`. n8n webhook node configured with Header Authentication. LobeHub plugin sends `X-API-Key` header with every request.

### API & Communication Patterns

| Decision | Choice | Rationale |
|---|---|---|
| Proactive message delivery | LobeHub Scheduled Tasks + n8n webhook combination | LobeHub runs in PostgreSQL server mode, enabling Scheduled Tasks feature. Single-channel principle preserved (all notifications via LobeHub chat) |
| Error code naming | Flat string constants (e.g., `PLANE_API_TIMEOUT`, `DEEPSEEK_TIMEOUT`, `INVALID_ROUTINE_META`) | Readable, self-descriptive; sufficient for system with <50 error codes |
| n8n response format | start.spec JSON structure (`response_type`, `message`, `data`, `suggestions`, `awaiting_input`) | Structured data allows LobeHub Agent to adapt presentation contextually |

**Proactive Message Architecture:**

| Message Type | Trigger | Delivery Path |
|---|---|---|
| W1 execution result / degraded alert | n8n cron (00:00 KST) | n8n → LobeHub (push path, requires implementation verification) |
| W3 daily report | n8n cron (23:00 KST) | n8n → LobeHub (push path) |
| W4 weekly cleanup report | n8n cron (Sunday 00:00 KST) | n8n → LobeHub (push path) |
| Chronic deferral warning | Command response time | Inline in command response (no push needed) |

**Risk:** LobeHub Scheduled Tasks rely on LLM to execute Function Calls — not guaranteed reliable. W1/W3/W4 must remain n8n cron-triggered (deterministic). LobeHub Scheduled Tasks used only for "last-mile" delivery to chat. Push path from n8n to LobeHub requires additional verification during implementation.

### Degraded Mode & Error Handling

| Decision | Choice | Rationale |
|---|---|---|
| W1 LLM Steps partial failure | Partial success allowed | Step 3 results preserved even if Step 4 fails; user gets LLM-generated tasks with default scheduling rather than losing them entirely. User notified of partial degradation |
| Plane.so write failure retry | Per-issue retry (3 attempts) → skip + log | Already-created quests preserved; failed individual creates retried independently; prevents duplicate creation |
| DeepSeek JSON parse failure | Retry once with `temperature: 0.1` (from default `0.3`), same prompt → skip Step on second failure | Lower temperature increases JSON compliance. "Parse failure" = invalid JSON OR valid JSON missing required fields. Error: `DEEPSEEK_JSON_PARSE_ERROR` |
| n8n error handling pattern | Hybrid: node-level try-catch + workflow-level Error Workflow | Node try-catch enables partial success (decisions #7, #8). Error Workflow catches unexpected fatal errors and routes notification to LobeHub |

**Degraded Mode Matrix (Complete):**

| Component Down | Impact | Handling | User Notification |
|---|---|---|---|
| DeepSeek unavailable | W1 Steps 3-5 skipped, intent classification falls back to literal parsing | Per-step skip with `DEGRADED_MODE` flag | "⚠️ AI features temporarily unavailable. Routine-based quests generated normally." |
| DeepSeek JSON parse failure | Individual Step skipped | Retry once (low temperature) → skip | Included in W1 execution summary |
| Plane.so API timeout/5xx | Affected operations fail | 3 retries per operation (5s interval) → `PLANE_API_TIMEOUT` | Specific error code returned to user |
| Plane.so write partial failure | Some quests not created | Per-issue retry → skip + log failed issues | W1 summary lists skipped routines |
| n8n crash | All automation stops | Docker `restart: unless-stopped` + Uptime Kuma alerting | Uptime Kuma notification (external to pulse) |
| LobeHub down | User interface unavailable | Plane.so direct access as manual fallback | N/A (no notification channel available) |

### Observability

| Decision | Choice | Rationale |
|---|---|---|
| Logging strategy | Dual: Plane.so issue comments (user-facing history) + n8n execution logs (system debugging) | User sees quest lifecycle events as comments; developer debugs via n8n execution history |
| Environment validation | W0: dedicated n8n workflow for connection testing | Tests Plane.so API, DeepSeek API, LobeHub connectivity using actual n8n credentials. Run manually after setup or configuration changes |

**Logging Role Separation:**

| Log Target | Content | Audience |
|---|---|---|
| Plane.so issue comments | Quest events: completion, deferral, restoration, auto-generation source | User (visible in Plane.so and via `/today`) |
| n8n execution logs | API call details, response times, error stack traces, retry attempts | Developer/operator (visible in n8n UI) |

### Infrastructure & Deployment

| Decision | Choice | Rationale |
|---|---|---|
| Workflow deployment | Manual import via n8n UI | W1-W4 change infrequently after stabilization; prompt tuning handled separately in `prompts/` directory |
| LobeHub database mode | PostgreSQL server mode | Enables Scheduled Tasks, cross-device sync, and server-side features required for proactive messaging |

### Additional Architectural Constraints (from Party Mode Review)

1. **pulse-meta HTML parsing tolerance**: The `pulse-meta` parser in `src/pulse-meta.js` must handle HTML-wrapped fenced code blocks gracefully. Plane.so's rich text editor may transform ` ```pulse-meta``` ` blocks into `<pre><code>` elements, escape quotes, or alter whitespace. Parser must extract JSON from multiple HTML representations.

2. **Session collision behavior**: When a user sends a new command during an active interactive session (e.g., `/today` while `/complete` awaits input), the new command takes precedence and the previous session is implicitly abandoned. LobeHub system prompt must instruct this behavior.

### Decision Impact Analysis

**Implementation Sequence:**
1. Plane.so project structure + State/Label setup (foundation for all workflows)
2. pulse-meta JSON Schema definition with `schema_version: 1`
3. W0 environment validation workflow
4. W1 Steps 1-2 (deterministic) with error handling patterns
5. W2 core commands (`/today`, `/complete`, `/cancel`, `/defer`, `/add`)
6. W1 Steps 3-5 (LLM) with degraded mode + partial failure handling
7. W2 remaining commands + W3/W4
8. LobeHub agent setup + proactive message push path verification

**Cross-Component Dependencies:**
- Decisions #1-1 (schema_version) and pulse-meta HTML parsing tolerance → both feed into `src/pulse-meta.js`
- Decisions #3-1 (partial success) and #5-3 (hybrid error handling) → must be implemented together in W1
- Decision #2-2 (proactive messages) depends on LobeHub push path verification → may fall back to alternative channel if LobeHub API is insufficient
- Decision #1-3 (duplicate prevention) reuses W1 Step 1 query results → Step 1 and Step 2 share data context within n8n workflow

## Implementation Patterns & Consistency Rules

### Pattern Categories Defined

**15 consistency patterns** across 6 categories to prevent AI agent implementation conflicts.

### Naming Patterns

**N-1: n8n Node & Workflow Naming**
- Workflow names: `kebab-case` (e.g., `daily-quest-generator`, `lobehub-command-handler`)
- Node names: `[Action] [Target]` Title Case (e.g., `Fetch Today Quests`, `Create Quest Issue`)
- Code nodes: `Code: [Purpose]` (e.g., `Code: Parse Pulse Meta`, `Code: Build Quest Payload`)
- Error Workflow nodes: `Error: [Target]` (e.g., `Error: Notify LobeHub`)

**N-2: JSON Field Naming**
- All JSON fields use `snake_case` — consistent with Plane.so API, no transformation needed
- Applies to: pulse-meta, n8n inter-node data, webhook responses, DeepSeek prompt variables

**N-3: Environment Variable Naming**
- Pattern: `PULSE_{SERVICE}_{PROPERTY}` in `UPPER_SNAKE_CASE`
- Examples: `PULSE_PLANE_BASE_URL`, `PULSE_DEEPSEEK_API_KEY`, `PULSE_USER_TIMEZONE`, `PULSE_DRY_RUN`

**N-4: JavaScript Coding Conventions**
- `const` by default, `let` only when reassignment needed, `var` forbidden
- `async/await` exclusively — `.then()` chains forbidden
- Template literals exclusively — string concatenation forbidden
- Arrow functions by default: `const foo = () => {}`

### Format Patterns

**F-1: Plane.so Issue Comment Format**
```
{emoji} [{HH:MM}] {message} ({detail})
```
- Time always KST HH:MM
- Automated actions use `[00:00]` (W1 execution time)
- User actions use actual time
- Language: English only (FR49)

Examples:
- `✅ [14:30] Quest completed by user`
- `⏸️ [14:30] Deferred by user (count: 3)`
- `⏳ [00:00] Auto-deferred: incomplete (count: 2)`
- `🔄 [00:00] Restored from deferred by LLM (reason: high priority)`
- `🗑️ [00:00] Auto-canceled: deferred 7+ times`

**F-2: DeepSeek Prompt Template Structure**

All files in `prompts/` directory follow this structure:
```markdown
# {Workflow} {Step} Prompt

## Role
System prompt content.

## User Template
User prompt with `{variable}` placeholders.

## Variables
| Variable | Source | Description |
|---|---|---|
| {variable_name} | Source location | What it contains |

## Expected Response Schema
```json
{ ... }
```

## Notes
Temperature, model, retry settings, and other call configuration.
```

**F-3: User-Facing Message Format**

All LobeHub responses follow consistent emoji + structure by message type:

| Type | Format | Example |
|---|---|---|
| Success | `✅ {message}` | `✅ 2 quests completed!` |
| Warning | `⚠️ [{CODE}] {message}` | `⚠️ [DEGRADED_MODE] AI features temporarily unavailable.` |
| Error | `❌ [{CODE}] {message}. {recovery}` | `❌ [PLANE_API_TIMEOUT] Server not responding. Please try again later.` |
| Info | `📋 {message}` | `📋 2026-04-07 (Mon) Today's Quests` |
| Progress | `🎯 {message}` | `🎯 Progress: 4/8 (50%) — Keep going!` |
| Deferral warn | `⚠️ {message}` | `⚠️ This quest has been deferred 5 times. Consider removing it.` |

**F-4: pulse-meta Extraction Patterns**

Parser must handle all HTML variants from Plane.so rich text editor:

```
Pattern 1 (raw markdown):    ```pulse-meta\n{...}\n```
Pattern 2 (HTML with class):  <pre><code class="language-pulse-meta">{...}</code></pre>
Pattern 3 (HTML no class):    <pre><code>{...}</code></pre>
Pattern 4 (HTML entities):    <pre><code class="language-pulse-meta">{&quot;...&quot;}</code></pre>
```

Rules:
- All 4 patterns must be accepted
- No pulse-meta block found → `INVALID_ROUTINE_META` log + skip issue
- JSON parse failure after extraction → same handling
- Content outside pulse-meta block is ignored (user notes, descriptions)

**F-5: Interactive Number List Format**

All interactive commands (`/complete`, `/cancel`, `/defer`, `/restore`, `/edit`) use identical list format:

```
1. [🔴 urgent] Morning Exercise — 07:00 (30min)
2. [🟠 high] Code Review — 14:00 (60min)
3. [🟡 medium] English Study — 09:00 (45min)
4. [🟢 low] Reading — 21:00 (30min)
```

Rules:
- Numbers: `N.` format (no zero-padding)
- Priority emoji: 🔴 urgent / 🟠 high / 🟡 medium / 🟢 low
- Format: `[priority] title — HH:MM (duration)`
- Deferred issues append: `(deferred x3)` suffix
- Input prompt: `Enter number(s) (e.g., 1,3 or 1-3):`

### Process Patterns

**P-1: n8n Inter-Node Data Wrapper**

All Code nodes output this standard wrapper:
```json
{
  "success": true,
  "data": { ... },
  "error": null,
  "metadata": {
    "step": "step_2_routine_copy",
    "timestamp": "2026-04-06T00:00:00+09:00",
    "items_processed": 10,
    "items_failed": 1
  }
}
```

Rules:
- All Code nodes must use this wrapper
- `success: false` requires `error` field with error code + message
- `metadata` enables downstream nodes to assess partial failure
- Timestamps: ISO 8601 format, timezone from `USER_TIMEZONE` environment variable (no hardcoded offset)

**P-2: Plane.so API Call Standards**

| Parameter | Standard Value | Notes |
|---|---|---|
| Base path | `{PLANE_BASE_URL}/api/v1/workspaces/{PLANE_WORKSPACE_SLUG}` | All calls use this prefix |
| Auth header | `X-API-Key: {PLANE_API_KEY}` | Every request |
| List queries | `per_page=100`, `expand=labels,state` | Default for all list operations |
| Retry | 3 attempts, 5s interval | Per-operation, not per-step |
| Date filter format | `YYYY-MM-DD` | Plane.so `target_date` field |
| Failure | Return error code after 3 retries exhausted | `PLANE_API_TIMEOUT` or `PLANE_API_ERROR` |

**P-3: LLM Step Branching Pattern**

Standard flow for W1 Steps 3, 4, 5:
```
[Call DeepSeek: {Step Name}]
    → [Code: Validate {Step Name} Response]
        → [IF: {Step Name} Success]
            ├─ true  → [Code: Process {Step Name} Result] → [Next Step]
            └─ false → [Code: Log Skip {Step Name}] → [Next Step]
```

All three LLM steps use identical structure — only node names and processing logic differ.

**P-4: DRY_RUN Mode Behavior**

When `DRY_RUN=true` environment variable is set:

| Operation Type | Behavior |
|---|---|
| Plane.so reads (query, search) | ✅ Normal execution |
| Plane.so writes (create, update, comment) | ❌ Blocked → `[DRY_RUN]` log only |
| DeepSeek API calls | ✅ Normal execution (verify prompts/responses) |
| LobeHub notifications | ❌ Blocked → `[DRY_RUN]` log only |

Log format: `[DRY_RUN] Would create issue: "Morning Exercise" in quest project`

The `/preview` command internally reuses DRY_RUN mode for tomorrow's quest dry-run.

### Data Patterns

**D-1: pulse-meta Canonical Example**

`schemas/pulse-meta.example.json` — reference data for all implementations and tests:
```json
{
  "schema_version": 1,
  "routine_type": "weekly",
  "routine_days": ["mon", "wed", "fri"],
  "routine_time": "07:00",
  "routine_duration_min": 30,
  "routine_priority": "high",
  "routine_mandatory": true,
  "routine_active_from": "2026-01-01",
  "routine_active_until": null,
  "routine_cooldown_days": 0,
  "source_project_id": "project_abc123",
  "source_issue_id": "issue_xyz789"
}
```

Rules:
- `routine_days`: lowercase 3-letter abbreviations (`mon`, `tue`, `wed`, `thu`, `fri`, `sat`, `sun`)
- `routine_time`: `HH:MM` (24-hour, no seconds)
- `routine_active_until`: `null` = indefinite
- Dates: `YYYY-MM-DD`

### Operational Rules

**O-1: n8n Workflow JSON Git Management**

- Never commit position-only changes (node coordinate shifts produce meaningless diffs)
- Only commit when node/logic changes are present
- `scripts/sync-code.sh` should include position normalization (future implementation)

### Enforcement Guidelines

**All AI Agents MUST:**
- Follow naming conventions (N-1 through N-4) in all generated code and configurations
- Use the inter-node data wrapper (P-1) for every Code node output
- Apply the LLM branching pattern (P-3) for all DeepSeek integration points
- Reference `schemas/pulse-meta.example.json` (D-1) as the canonical data format
- Use English for all user-facing output (F-1, F-3, F-5)

**Pattern Violations:**
- Violations caught during code review must be fixed before merge
- If a pattern proves impractical during implementation, propose amendment rather than silently deviating

## Project Structure & Boundaries

### Complete Project Directory Structure

```
pulse/
├── .env.example                           # Environment variable template (all services)
├── .gitignore                             # Git ignore rules
├── .gitattributes                         # Git diff strategy for workflow JSON
│
├── workflows/                             # n8n workflow JSON definitions (core deliverables)
│   ├── w0-environment-validator.json      # Startup connection validation
│   ├── w1-daily-quest-generator.json      # Daily 00:00 KST — quest generation pipeline
│   ├── w2-lobehub-command-handler.json    # Webhook — 15 slash commands + NL intent
│   ├── w3-daily-summary-reporter.json     # Daily 23:00 KST — summary report
│   ├── w4-deferred-cleanup.json           # Weekly Sunday 00:00 KST — cleanup
│   └── w5-error-handler.json              # Error Workflow — fatal error routing
│
├── src/                                   # Custom code for n8n Code nodes
│   ├── pulse-meta.js                      # pulse-meta JSON parsing & validation (F-4 patterns)
│   ├── plane-api.js                       # Plane.so API helper (P-2 standards)
│   ├── error-codes.js                     # Error taxonomy constants (flat strings)
│   ├── dry-run.js                         # DRY_RUN mode support (P-4 pattern)
│   └── response-formatter.js              # LobeHub response formatting (F-3, F-5 patterns)
│
├── prompts/                               # DeepSeek prompt templates (F-2 structure)
│   ├── w1-task-generation.md              # W1 Step 3: additional task suggestions
│   ├── w1-schedule-optimization.md        # W1 Step 4: time slot optimization
│   ├── w1-deferred-restoration.md         # W1 Step 5: deferred quest evaluation
│   ├── w2-intent-classification.md        # W2: natural language → command mapping
│   ├── w3-daily-summary.md                # W3: daily report commentary
│   ├── w4-cleanup-decision.md             # W4: deferred cleanup judgment
│   └── lobehub-system-prompt.md           # LobeHub agent persona & behavior rules
│
├── schemas/                               # JSON Schema definitions
│   ├── pulse-meta.schema.json             # Routine metadata schema (with schema_version)
│   └── pulse-meta.example.json            # Canonical example data (D-1)
│
├── lobehub/                               # LobeHub configuration
│   └── plugin-manifest.json               # OpenAPI plugin definition (quest_command function)
│
├── scripts/                               # Setup and utility scripts
│   ├── setup.sh                           # Initial Plane.so project/state/label setup via API
│   ├── validate-env.sh                    # Quick environment variable presence check
│   └── sync-code.sh                       # Bidirectional n8n JSON ↔ src/ code sync
│
└── docs/                                  # Project documentation
    ├── start.spec.md                      # Original system specification
    └── plane-openapi.yaml                 # Plane.so API reference
```

### Architectural Boundaries

**External System Integration Boundaries:**

```
                    ┌─────────────────────────────────┐
                    │           pulse repo             │
                    │                                  │
[LobeHub] ─────────┤  workflows/w2 (webhook entry)    │
  (Chat UI)   HTTP  │       ↓                         │
  Plugin Call  POST │  src/ (business logic)           │
                    │       ↓                         │
                    │  Plane.so API ←── src/plane-api.js
                    │  DeepSeek API ←── prompts/*.md   │
                    │       ↓                         │
                    │  workflows/w2 (webhook response) │
                    └─────────────────┤───────────────┘
                                      │
[n8n Cron] ─────── workflows/w1,w3,w4 (scheduled)
                          ↓
                    src/ + prompts/ + Plane.so API
                          ↓
                    LobeHub (push notification)
```

**Data Boundaries:**
- **Plane.so**: Sole persistent data store (source of truth for all routine and quest data)
- **n8n**: Fully stateless — only execution logs retained in n8n internal DB
- **LobeHub**: Conversation history (PostgreSQL server mode) — serves as session state for interactive commands
- **pulse repo**: Configuration and logic only — no runtime data

**Workflow Boundaries:**

| Workflow | Trigger | Error Handling | Independence |
|---|---|---|---|
| W0 | Manual | Self-contained | Fully independent |
| W1 | Cron (00:00 KST) | References W5 as Error Workflow | Independent execution |
| W2 | Webhook (HTTP POST) | References W5 as Error Workflow | Independent execution |
| W3 | Cron (23:00 KST) | References W5 as Error Workflow | Independent execution |
| W4 | Cron (Sunday 00:00 KST) | References W5 as Error Workflow | Independent execution |
| W5 | Error Workflow only | Terminal handler | Never directly executed |

**`src/` Dependency Boundaries:**
- `pulse-meta.js` ← references `schemas/pulse-meta.schema.json`
- `plane-api.js` ← references `.env` environment variables
- `response-formatter.js` ← references `error-codes.js`
- Each `src/` file is independently usable — minimize cross-imports
- No circular dependencies allowed

### Requirements to Structure Mapping

**FR Category → File Mapping:**

| FR Category | Primary Files | Secondary Files |
|---|---|---|
| Quest Generation (FR1-10) | `workflows/w1-*.json` | `src/pulse-meta.js`, `prompts/w1-*.md` |
| Routine Management (FR11-16) | `workflows/w2-*.json` | `src/pulse-meta.js`, `schemas/pulse-meta.schema.json` |
| Daily Quest Interaction (FR17-24) | `workflows/w2-*.json` | `src/response-formatter.js`, `src/plane-api.js` |
| Reporting & Analytics (FR25-31) | `workflows/w2-*.json`, `workflows/w3-*.json` | `prompts/w3-*.md`, `src/response-formatter.js` |
| NLP (FR32-35) | `workflows/w2-*.json` | `prompts/w2-intent-classification.md` |
| Automated Maintenance (FR36-38) | `workflows/w4-*.json` | `prompts/w4-*.md` |
| Error Handling (FR39-43) | `workflows/w5-*.json`, `src/error-codes.js` | All workflows (cross-cutting) |
| System Config (FR44-49) | `scripts/setup.sh`, `scripts/validate-env.sh`, `.env.example`, `lobehub/` | `workflows/w0-*.json` |
| English Output (FR49) | `src/response-formatter.js`, `prompts/lobehub-system-prompt.md` | All `prompts/*.md`, `src/error-codes.js` |

**Cross-Cutting Concerns → File Mapping:**

| Concern | Primary Location | Notes |
|---|---|---|
| Error taxonomy | `src/error-codes.js` | Imported by all Code nodes that return errors |
| pulse-meta validation | `src/pulse-meta.js` + `schemas/` | Used by W1 (scan), W2 (`/preview`, `/edit`), LobeHub (routine creation) |
| Plane.so API access | `src/plane-api.js` | Standardized helper for all Plane.so operations |
| Response formatting | `src/response-formatter.js` | All W2 command responses, W3 report |
| DRY_RUN mode | `src/dry-run.js` | All workflows, P-4 pattern — checked at every Plane.so write and LobeHub push |

### Data Flow

**W1 Daily Quest Generation (00:00 KST):**
```
Cron trigger
  → Step 1: Fetch today's quests (Plane.so READ) → Identify incomplete → Move to Deferred (Plane.so WRITE)
  → Step 2: Fetch all daily-routine issues (Plane.so READ) → Filter by schedule → Create quests (Plane.so WRITE)
  → Step 3: Call DeepSeek (prompts/w1-task-generation.md) → Validate → Create issues (Plane.so WRITE)
  → Step 4: Call DeepSeek (prompts/w1-schedule-optimization.md) → Validate → Update issues (Plane.so WRITE)
  → Step 5: Call DeepSeek (prompts/w1-deferred-restoration.md) → Validate → Restore issues (Plane.so WRITE)
  → Push summary to LobeHub
```

**W2 Command Handler (Webhook):**
```
LobeHub HTTP POST → Webhook node
  → Parse action from request body
  → Route to command handler (Switch node)
  → Execute command logic (Plane.so READ/WRITE as needed)
  → Format response (src/response-formatter.js)
  → Return JSON response to LobeHub
```

### Development Workflow

**Daily Development Cycle:**
1. Edit in n8n Editor UI (workflows) or IDE (`src/`, `prompts/`, `schemas/`)
2. Test via n8n manual execution or DRY_RUN mode
3. Export workflow JSON from n8n → save to `workflows/`
4. Run `scripts/sync-code.sh extract` if Code nodes were edited in n8n
5. Git commit meaningful changes (ignore position-only diffs)

**Deployment Cycle:**
1. Git pull latest changes
2. Import workflow JSON via n8n UI
3. Run `scripts/sync-code.sh inject` if `src/` was edited in IDE
4. Run W0 to validate all connections
5. Activate workflows

## Architecture Validation Results

### Coherence Validation ✅

**Decision Compatibility:**
All 14 architectural decisions verified for mutual compatibility. Zero contradictions found. Key validations:
- Plane.so State group mapping aligns with API spec enum values
- snake_case convention (N-2) matches Plane.so API natively — no transformation layer needed
- Error Workflow (W5) architecture supports both node-level try-catch and workflow-level fatal error handling
- DRY_RUN mode (P-4) cleanly reusable by `/preview` command
- LobeHub PostgreSQL server mode prerequisite satisfied for Scheduled Tasks feature

**Pattern Consistency:**
All 15 implementation patterns support the architectural decisions without conflict. Naming conventions (N-1 through N-4) are internally consistent and technology-appropriate.

**Structure Alignment:**
Project directory structure directly maps to all architectural decisions. Every `src/` file has a clear purpose tied to specific FR categories. No orphan files or missing structural elements.

### Requirements Coverage Validation ✅

**Functional Requirements Coverage:**
All 49 FRs (FR1-FR49) across 8 categories have explicit architectural support. Each FR category maps to specific files and workflows in the project structure.

**Non-Functional Requirements Coverage:**
- Performance: API call minimization (per_page=100, expand, in-memory dedup), per-step timeouts, LLM budget cap
- Security: Header API Key for webhooks, environment variable isolation, HTTPS requirement
- Reliability: Per-step independent recovery, partial success, degraded mode matrix (6 scenarios), Docker auto-restart + Uptime Kuma
- Observability: Dual logging (Plane.so comments + n8n logs), W0 validation workflow, error taxonomy

### Implementation Readiness Validation ✅

**Decision Completeness:** 14 decisions documented with rationale, alternatives considered, and implementation notes.

**Structure Completeness:** Complete file-level project tree with every file's purpose annotated. FR → file mapping covers all 49 requirements.

**Pattern Completeness:** 15 patterns with concrete examples covering naming, format, process, data, and operational concerns.

### Gap Analysis Results

**No Critical Gaps Found.**

**Important Gaps (1):**
- LobeHub proactive push path from n8n remains unverified. Mitigation: documented as implementation-time verification task with Telegram/Discord as fallback option.

**Nice-to-Have Gaps (1):**
- Quick Reference section for AI agents — deferred to implementation phase, will be addressed via `project-context.md` or `CLAUDE.md`.

### Validation Issues Addressed (from Party Mode Review)

**Issue 1: setup.sh output → .env ID propagation**
`scripts/setup.sh` creates Plane.so project, states, and labels via API and receives UUIDs in response. The script must output these IDs in a copy-paste-ready format:
```
# Add these to your .env file:
DAILY_QUEST_PROJECT_ID=<created_project_uuid>
STATE_TODO_ID=<created_state_uuid>
STATE_IN_PROGRESS_ID=<created_state_uuid>
STATE_DEFERRED_ID=<created_state_uuid>
STATE_DONE_ID=<created_state_uuid>
STATE_CANCELED_ID=<created_state_uuid>
LABEL_DAILY_ROUTINE_ID=<created_label_uuid>
```
These IDs must be added to `.env` before W1-W4 can operate. `.env.example` must include all ID placeholders.

**Issue 2: W2 command handler scaling guideline**
W2 contains all 15 slash commands in a single workflow. If the workflow exceeds 50 nodes during implementation, consider splitting by command type:
- W2a: Query commands (`/today`, `/brief`, `/stats`, `/deferred`, `/preview`, `/weekly`, `/help`)
- W2b: Interactive commands (`/complete`, `/cancel`, `/defer`, `/restore`, `/edit`)
- W2c: Action commands (`/add`, `/regen`)

The webhook entry node would route to the appropriate sub-workflow. This split is NOT required now — only evaluate if W2 becomes unwieldy during implementation.

### Architecture Completeness Checklist

**✅ Requirements Analysis**
- [x] Project context thoroughly analyzed (PRD, start.spec, Plane.so OpenAPI)
- [x] Scale and complexity assessed (Medium-High)
- [x] Technical constraints identified (Plane.so API limits, n8n SPOF, no custom fields)
- [x] Cross-cutting concerns mapped (7 concerns)

**✅ Architectural Decisions**
- [x] 14 critical decisions documented with rationale
- [x] Technology stack fully specified (n8n + LobeHub + Plane.so + DeepSeek)
- [x] Integration patterns defined (webhook, cron, API, LLM)
- [x] Degraded mode matrix complete (6 failure scenarios)

**✅ Implementation Patterns**
- [x] Naming conventions established (4 patterns: N-1 through N-4)
- [x] Format patterns defined (5 patterns: F-1 through F-5)
- [x] Process patterns specified (4 patterns: P-1 through P-4)
- [x] Data patterns documented (1 pattern: D-1)
- [x] Operational rules defined (1 rule: O-1)

**✅ Project Structure**
- [x] Complete directory structure defined (file-level)
- [x] Architectural boundaries established (external, data, workflow, src/)
- [x] Integration points mapped (data flow diagrams for W1, W2)
- [x] Requirements to structure mapping complete (49 FRs → files)

### Architecture Readiness Assessment

**Overall Status:** READY FOR IMPLEMENTATION

**Confidence Level:** High

**Key Strengths:**
- Comprehensive degraded mode design — system is fully usable without LLM
- Clean separation of concerns — workflows, code, prompts, schemas all isolated
- Plane.so as single source of truth — no data consistency conflicts
- 15 implementation patterns prevent AI agent divergence
- Lean structure with clear growth path (flat src/, W2 split guideline)

**Areas for Future Enhancement:**
- LobeHub push path verification (implementation-time)
- `scripts/sync-code.sh` bidirectional sync implementation (deferred until Code node count confirmed)
- W2 potential split if exceeding 50 nodes
- Quick Reference extraction for AI agent efficiency

### Implementation Handoff

**AI Agent Guidelines:**
- Follow all 14 architectural decisions exactly as documented
- Use all 15 implementation patterns consistently across all components
- Respect project structure and `src/` dependency boundaries
- Reference this document for all architectural questions
- When a pattern proves impractical, propose amendment rather than silently deviating

**First Implementation Priority:**
1. Repository scaffolding (create directory structure from project tree)
2. `scripts/setup.sh` — Plane.so project, states, labels creation
3. `.env` configuration with generated IDs
4. `schemas/pulse-meta.schema.json` + `schemas/pulse-meta.example.json`
5. W0 environment validation workflow
6. W1 Steps 1-2 (deterministic quest generation)
