---
stepsCompleted: ['step-01-validate-prerequisites', 'step-02-design-epics', 'step-03-create-stories', 'step-04-final-validation']
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/architecture.md
---

# pulse - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for pulse, decomposing the requirements from the PRD and Architecture requirements into implementable stories.

## Requirements Inventory

### Functional Requirements

FR1: System can automatically generate daily quests from routine definitions at scheduled time (00:00 KST)
FR2: System can detect and copy qualifying routine issues (by label, schedule rules, active dates, cooldown) from long-term projects to the quest project
FR3: System can automatically move yesterday's incomplete quests to Deferred state with defer_count increment
FR4: System can request LLM to generate 0-3 additional task suggestions based on current context
FR5: System can request LLM to optimize quest scheduling (time slots, priority ordering, rest breaks)
FR6: System can request LLM to evaluate deferred quests for restoration based on available capacity
FR7: System can operate in degraded mode when LLM is unavailable, completing deterministic steps without LLM
FR8: System can proactively notify the user via LobeHub when operating in degraded mode
FR9: System can enforce a maximum routine scan limit per generation run
FR10: System can handle deleted source routines gracefully — existing quests persist, no new quests generated from deleted sources
FR11: User can create routines via LobeHub natural language with immediate quest generation option
FR12: User can create routines directly in Plane.so with daily-routine label and routine metadata block
FR13: System can detect new daily-routine labeled issues in Plane.so during scheduled generation
FR14: User can edit routine properties (time, priority, schedule) via /edit command (scoped to time and priority for v1)
FR15: System can validate routine metadata integrity before processing and log clear errors for invalid entries
FR16: System can detect and warn about label near-mismatches to daily-routine
FR17: User can view today's complete quest board grouped by state via /today
FR18: User can mark quests as completed via /complete (interactive selection)
FR19: User can cancel quests via /cancel (interactive selection)
FR20: User can defer quests via /defer (interactive selection with defer_count tracking)
FR21: User can restore deferred quests to today's To-Do via /restore
FR22: User can manually add ad-hoc quests with name and duration via /add
FR23: User can regenerate today's quests (excluding Done) via /regen with confirmation prompt
FR24: System can warn when a quest has been deferred 3+ times
FR25: User can view milestone briefing (top 5 by D-Day) via /brief
FR26: User can view all milestones across all projects via /brief all
FR27: User can view N-day statistics (completion rates, patterns, streaks) via /stats
FR28: User can view weekly summary with day-by-day breakdown via /weekly
FR29: User can view all currently deferred quests via /deferred
FR30: User can preview next day's expected quest generation and validate routine configuration via /preview
FR31: System can generate and send daily summary report at 23:00 KST via LobeHub
FR32: System can classify natural language input into command intents via LLM with configurable confidence threshold
FR33: System can request user clarification when intent confidence is below configured threshold
FR34: System can handle natural language routine creation and editing requests with confirmation flow
FR35: System can fall back to literal command parsing when LLM is unavailable
FR36: System can automatically clean up quests deferred 7+ times via weekly workflow
FR37: System can distinguish mandatory vs non-mandatory routines for cleanup decisions
FR38: System can generate weekly deferred task report
FR39: System can return specific, documented error codes for all failure paths
FR40: System can retry failed Plane.so API calls before reporting failure
FR41: System can retry failed LLM API calls before falling back to degraded mode
FR42: System can detect n8n unreachability and display clear error via LobeHub agent
FR43: System can validate all environment variables and connections on startup
FR44: Operator can import n8n workflow templates (W1-W4) from JSON files
FR45: Operator can configure system via environment variables (API keys, URLs, user preferences)
FR46: Operator can register LobeHub plugin via OpenAPI-compatible definition
FR47: Operator can enable DRY_RUN mode for safe workflow testing
FR48: User can view command reference via /help
FR49: All system-generated user-facing output (responses, errors, reports, notifications) must be in English

### NonFunctional Requirements

NFR1: Simple commands (/today, /complete, /cancel, /defer, /add, /restore, /help) must respond within 5 seconds
NFR2: Analytical commands (/stats, /brief, /brief all, /weekly, /preview) must respond within 15 seconds
NFR3: Show "processing..." indicator for any command expected to take >3 seconds
NFR4: W1 Steps 1-2 (deterministic) must complete within 60 seconds
NFR5: W1 Steps 3-5 (LLM) must complete within 5 minutes, with per-step timeout at 60 seconds
NFR6: Total LLM budget per W1 run: 3 minutes max — remaining LLM steps skipped if exceeded (partial degraded mode)
NFR7: /preview dry-run must complete within 30 seconds
NFR8: DeepSeek API timeout: 30 seconds per individual request
NFR9: All API keys stored exclusively in environment variables, never in workflow definitions or code
NFR10: n8n webhook endpoints secured with API key or HMAC signature verification
NFR11: All LobeHub → n8n communication over HTTPS
NFR12: No sensitive data logged in n8n execution logs (API keys masked)
NFR13: W1 (00:00 KST) must execute successfully >99% of days
NFR14: W3 and W4 failures are non-critical but must be logged
NFR15: Each W1 step must be independently recoverable — failure at Step 3 must not prevent Steps 1-2 completion
NFR16: n8n Docker container must auto-restart on crash (restart policy: unless-stopped)
NFR17: Degraded mode must be fully functional — system usable without LLM indefinitely
NFR18: Plane.so API v1 compatibility required; no dependency on undocumented or beta endpoints
NFR19: DeepSeek API accessed via OpenAI-compatible interface (n8n OpenAI node with custom base URL)
NFR20: LobeHub plugin must conform to OpenAPI-compatible plugin specification
NFR21: n8n webhook endpoints must accept and return JSON with consistent response schema
NFR22: All integrations must handle network timeouts gracefully with user-visible error messages
NFR23: Each n8n workflow node must have a descriptive name reflecting its purpose
NFR24: Each workflow must include a sticky note documenting: purpose, trigger, inputs/outputs, dependencies
NFR25: All environment variables must follow PULSE_ prefix convention
NFR26: Error messages must include originating workflow and step for debugging
NFR27: Each W1 execution must log: start time, steps completed, steps skipped, issues created count, errors encountered, total execution time
NFR28: Each LLM call must log: step origin, request duration, success/failure, token usage
NFR29: Failed workflow executions must be visually distinguishable in n8n execution history
NFR30: Logs must be sufficient to diagnose "why are my quests wrong this morning?" from n8n UI alone

### Additional Requirements

- Architecture specifies a **Lean Repository Structure** as starter template — git repo with structured artifact management (workflows/, src/, prompts/, schemas/, lobehub/, scripts/, docs/)
- **W0: Environment Validator workflow** — dedicated n8n workflow for startup connection testing (Plane.so API, DeepSeek API, LobeHub connectivity)
- **W5: Error Handler workflow** — Error Workflow for fatal error routing to LobeHub notification
- **pulse-meta JSON Schema** with `schema_version: 1` field for future migration paths
- **pulse-meta HTML parsing tolerance** — parser must handle 4 HTML variants from Plane.so rich text editor (raw markdown, HTML with class, HTML no class, HTML entities)
- **Plane.so State Mapping**: To-Do (unstarted), In Progress (started), Deferred (backlog), Done (completed), Canceled (cancelled)
- **Plane.so Label Management**: `daily-routine` label exact-match case-sensitive routing key
- **Session collision behavior**: new command during active interactive session implicitly abandons previous session
- **W1 LLM partial failure**: partial success allowed — Step 3 results preserved even if Step 4 fails
- **Plane.so write failure retry**: per-issue retry (3 attempts) → skip + log to avoid duplicates
- **DeepSeek JSON parse failure**: retry once with temperature: 0.1 → skip Step on second failure
- **n8n error handling pattern**: hybrid node-level try-catch + workflow-level Error Workflow (W5)
- **Dual logging**: Plane.so issue comments (user-facing history) + n8n execution logs (system debugging)
- **Proactive message delivery**: LobeHub Scheduled Tasks + n8n webhook combination
- **n8n Code Sync Strategy**: bidirectional sync script (scripts/sync-code.sh) for src/ ↔ n8n JSON Code nodes
- **15 consistency patterns** across 6 categories (Naming N1-N4, Format F1-F5, Process P1-P4, Data D-1, Operational O-1)
- **DRY_RUN mode**: environment variable blocks Plane.so writes and LobeHub notifications, allows reads and DeepSeek calls
- **Implementation Priority Order**: P1 Foundation → P2 Core Loop → P3 AI Layer → P4 Polish

### UX Design Requirements

N/A — No UX Design document exists for this project. pulse is a conversational interface (LobeHub chat) with no custom UI components.

### FR Coverage Map

FR1: Epic 2 - Daily quest auto-generation (00:00 KST)
FR2: Epic 2 - Routine issue scan and quest copy
FR3: Epic 2 - Incomplete quests → Deferred auto-move
FR4: Epic 5 - LLM additional task suggestions
FR5: Epic 5 - LLM schedule optimization
FR6: Epic 5 - LLM deferred quest restoration judgment
FR7: Epic 2 - Degraded mode operation
FR8: Epic 2 - Degraded mode proactive notification
FR9: Epic 2 - Routine scan limit enforcement
FR10: Epic 2 - Deleted source routine graceful handling
FR11: Epic 6 - Natural language routine creation
FR12: Epic 2 - Plane.so direct routine creation
FR13: Epic 2 - New daily-routine issue detection
FR14: Epic 7 - /edit routine property modification
FR15: Epic 2 - Routine metadata validation
FR16: Epic 2 - Label near-mismatch warning
FR17: Epic 2 - /today quest board view
FR18: Epic 3 - /complete interactive completion
FR19: Epic 3 - /cancel interactive cancellation
FR20: Epic 3 - /defer interactive deferral
FR21: Epic 7 - /restore deferred quest restoration
FR22: Epic 3 - /add manual quest addition
FR23: Epic 7 - /regen quest regeneration
FR24: Epic 3 - 3+ deferral warning
FR25: Epic 4 - /brief milestone briefing
FR26: Epic 4 - /brief all full milestone view
FR27: Epic 4 - /stats N-day statistics
FR28: Epic 4 - /weekly summary report
FR29: Epic 4 - /deferred quest list
FR30: Epic 4 - /preview next-day dry-run
FR31: Epic 4 - W3 daily summary report (23:00 KST)
FR32: Epic 6 - NL intent classification
FR33: Epic 6 - Low-confidence clarification request
FR34: Epic 6 - NL routine creation/editing
FR35: Epic 3 - Literal command parsing fallback
FR36: Epic 7 - 7+ deferral auto-cleanup
FR37: Epic 7 - Mandatory/non-mandatory distinction
FR38: Epic 7 - Weekly deferred task report
FR39: Epic 2 - Error code taxonomy
FR40: Epic 2 - Plane.so API retry
FR41: Epic 5 - LLM API retry → degraded fallback
FR42: Epic 3 - n8n unreachability error display
FR43: Epic 1 - Environment variable/connection validation
FR44: Epic 1 - n8n workflow template import
FR45: Epic 1 - Environment variable configuration
FR46: Epic 3 - LobeHub plugin registration
FR47: Epic 1 - DRY_RUN mode enablement
FR48: Epic 3 - /help command reference
FR49: Epic 3 - English-only output

## Epic List

### Epic 1: Project Foundation & Infrastructure Setup
Establish the repository structure, Plane.so project/state/label configuration, environment validation, and development tooling. After this epic, the operator has verified all external system connections and is ready to begin workflow development.
**FRs covered:** FR43, FR44, FR45, FR47
**Additional:** Lean Repository Structure (starter template), W0 environment validator, Plane.so state/label mapping, .env.example, pulse-meta JSON schema definition, scripts/setup.sh, scripts/validate-env.sh

### Epic 2: Daily Quest Generation & Board View
Automatically generate daily quests from routine definitions at 00:00 KST and enable the user to view their quest board via /today. Handles deferred quest migration, routine scanning, metadata validation, label warnings, duplicate prevention, and degraded mode operation. The user opens LobeHub each morning and sees their day already structured.
**FRs covered:** FR1, FR2, FR3, FR7, FR8, FR9, FR10, FR12, FR13, FR15, FR16, FR17, FR39, FR40
**Additional:** W1 Steps 1-2 (deterministic), W2 /today command handler, W5 error handler, pulse-meta HTML parsing (4 patterns), per-issue retry, label validation, duplicate prevention, LobeHub agent + webhook connectivity

### Epic 3: Core Quest Interaction Commands
Enable interactive quest management through LobeHub chat: complete (/complete), cancel (/cancel), defer (/defer), manually add (/add), view help (/help). The user can manage their daily quests entirely through conversational commands.
**FRs covered:** FR18, FR19, FR20, FR22, FR24, FR35, FR42, FR46, FR48, FR49
**Additional:** W2 command handler expansion, LobeHub plugin setup, system prompt, interactive session management (number list format), session collision behavior, error code responses, English-only output

### Epic 4: Reporting, Analytics & Query Commands
Provide milestone briefings (/brief), statistics (/stats), deferred list (/deferred), next-day preview (/preview), weekly report (/weekly), and automated daily summary (W3 at 23:00 KST). The user gains data-driven insights into their quest patterns and long-term project progress.
**FRs covered:** FR25, FR26, FR27, FR28, FR29, FR30, FR31
**Additional:** W3 daily summary reporter, /preview DRY_RUN mode reuse, proactive degraded mode notifications, proactive message push path (LobeHub Scheduled Tasks + n8n webhook)

### Epic 5: AI-Enhanced Quest Intelligence
Integrate DeepSeek LLM into the W1 pipeline: context-based additional task suggestions (Step 3), time-slot schedule optimization (Step 4), and deferred quest restoration judgment (Step 5). Graceful degradation ensures the core pipeline is unaffected when LLM is unavailable.
**FRs covered:** FR4, FR5, FR6, FR41
**Additional:** W1 Steps 3-5, DeepSeek prompt templates, partial failure handling (step-level independence), JSON parse retry (temperature: 0.1), LLM budget 3-min cap, LLM branching pattern (P-3)

### Epic 6: Natural Language & Conversational Intelligence
Enable natural language interaction: intent classification for command mapping, natural language routine creation/editing with confirmation flow, and immediate quest generation option. Falls back to literal parsing when LLM is unavailable.
**FRs covered:** FR11, FR32, FR33, FR34
**Additional:** W2 intent classification prompt, LobeHub natural language routine creation path (immediate vs batch), confidence threshold configuration, confirmation flow

### Epic 7: Advanced Quest Management & Maintenance
Complete the management toolkit: edit quest properties (/edit), regenerate quests (/regen with confirmation), restore deferred quests (/restore), and automated weekly cleanup (W4). The user can fine-tune routines and the system self-maintains over time.
**FRs covered:** FR14, FR21, FR23, FR36, FR37, FR38
**Additional:** W4 deferred-cleanup workflow, /regen confirmation prompt, mandatory/non-mandatory distinction, weekly deferred report, /edit scoped to time and priority for v1

## Epic 1: Project Foundation & Infrastructure Setup

Establish the repository structure, Plane.so project/state/label configuration, environment validation, and development tooling. After this epic, the operator has verified all external system connections and is ready to begin workflow development.

### Story 1.1: Repository Scaffolding & Project Configuration

As an **operator**,
I want the pulse repository initialized with the complete directory structure and configuration files,
So that I have a versioned, reproducible foundation for all workflow development.

**Acceptance Criteria:**

**Given** the operator clones the pulse repository
**When** they inspect the directory structure
**Then** the following directories exist: `workflows/`, `src/`, `prompts/`, `schemas/`, `lobehub/`, `scripts/`, `docs/`
**And** `.env.example` contains all required environment variables with `PULSE_` prefix and placeholder values
**And** `.gitignore` excludes `.env`, `node_modules/`, and n8n temporary files
**And** `schemas/pulse-meta.schema.json` defines the pulse-meta JSON schema with `schema_version: 1`
**And** `schemas/pulse-meta.example.json` contains the canonical example data matching the schema

### Story 1.2: Plane.so Project & State Configuration

As an **operator**,
I want to set up the Plane.so quest project with correct states, labels, and sample routines via an automated setup script,
So that the quest generation pipeline has the required data structure to operate.

**Acceptance Criteria:**

**Given** the operator has configured `PULSE_PLANE_API_KEY`, `PULSE_PLANE_BASE_URL`, and `PULSE_PLANE_WORKSPACE_SLUG` in `.env`
**When** they run `scripts/setup.sh`
**Then** a "Daily Quests" project is created in the configured Plane.so workspace
**And** custom states are created: "To-Do" (unstarted), "In Progress" (started), "Deferred" (backlog), "Done" (completed), "Canceled" (cancelled)
**And** the script outputs the state UUIDs for environment variable configuration
**And** the script validates that the Plane.so API responds successfully before proceeding
**And** if any API call fails, the script exits with a clear error message indicating which step failed

### Story 1.3: Environment Validation Workflow (W0)

As an **operator**,
I want a dedicated n8n workflow that tests all external connections on demand,
So that I can verify the system is correctly configured before activating automated workflows.

**Acceptance Criteria:**

**Given** the operator imports `workflows/w0-environment-validator.json` into n8n
**When** they manually trigger the W0 workflow
**Then** it tests Plane.so API connectivity (list projects endpoint)
**And** it tests DeepSeek API connectivity (simple completion request)
**And** it tests LobeHub webhook callback (if configured)
**And** it validates all required environment variables are present and non-empty
**And** each test result is reported as pass/fail with specific error details
**And** the workflow follows n8n node naming convention: `[Action] [Target]` Title Case
**And** the workflow includes a sticky note documenting: purpose, trigger, inputs/outputs
**And** `DRY_RUN` mode has no effect on W0 (validation always executes reads)

### Story 1.4: Error Handler Workflow (W5) & DRY_RUN Support

As an **operator**,
I want a centralized error handling workflow and DRY_RUN mode support,
So that fatal errors are routed to LobeHub notification and I can safely test workflows without side effects.

**Acceptance Criteria:**

**Given** the operator imports `workflows/w5-error-handler.json` into n8n
**When** any workflow (W1-W4) encounters an unhandled fatal error
**Then** W5 captures the error details (workflow name, step, error message, timestamp)
**And** W5 sends a formatted error notification to LobeHub with error code and recovery guidance
**And** the notification follows the format: `❌ [{ERROR_CODE}] {message}. {recovery}`
**And** `src/error-codes.js` defines all error taxonomy constants as flat string exports
**And** when `DRY_RUN=true` environment variable is set, Plane.so write operations are blocked and logged as `[DRY_RUN] Would {action}`
**And** when `DRY_RUN=true`, LobeHub push notifications are blocked and logged
**And** when `DRY_RUN=true`, Plane.so read operations and DeepSeek API calls execute normally

## Epic 2: Daily Quest Generation & Board View

Automatically generate daily quests from routine definitions at 00:00 KST and enable the user to view their quest board via /today. Handles deferred quest migration, routine scanning, metadata validation, label warnings, duplicate prevention, and degraded mode operation. The user opens LobeHub each morning and sees their day already structured.

### Story 2.1: Plane.so API Helper & pulse-meta Parser

As a **developer**,
I want reusable Plane.so API utilities and a robust pulse-meta JSON parser,
So that all workflows can interact with Plane.so consistently and parse routine metadata reliably.

**Acceptance Criteria:**

**Given** `src/plane-api.js` is imported into an n8n Code node
**When** a Plane.so API call is made
**Then** it uses the standard base path `{PLANE_BASE_URL}/api/v1/workspaces/{PLANE_WORKSPACE_SLUG}`
**And** it includes `X-API-Key` authentication header from environment variable
**And** list queries default to `per_page=100` with `expand=labels,state`
**And** failed API calls retry 3 times with 5-second intervals before returning `PLANE_API_TIMEOUT` or `PLANE_API_ERROR`
**And** all JSON fields use `snake_case` naming convention

**Given** `src/pulse-meta.js` receives a Plane.so issue `description_html`
**When** it parses the pulse-meta block
**Then** it extracts JSON from raw markdown (` ```pulse-meta ``` `), HTML with class (`<pre><code class="language-pulse-meta">`), HTML without class (`<pre><code>`), and HTML entities patterns
**And** it validates the extracted JSON against `schemas/pulse-meta.schema.json`
**And** invalid or missing pulse-meta blocks return `INVALID_ROUTINE_META` error and skip the issue
**And** content outside the pulse-meta block is ignored

### Story 2.2: W1 Step 1 — Deferred Quest Migration

As a **user**,
I want yesterday's incomplete quests automatically moved to Deferred state each morning,
So that my today's quest board starts fresh and unfinished tasks are tracked with deferral counts.

**Acceptance Criteria:**

**Given** the W1 workflow triggers at 00:00 KST via cron
**When** Step 1 executes
**Then** it fetches all quests in the "Daily Quests" project with state "To-Do" and `target_date` before today
**And** each incomplete quest is moved to "Deferred" state
**And** a `defer_count` field is incremented in the quest's pulse-meta or issue comment
**And** a Plane.so issue comment is added: `⏳ [00:00] Auto-deferred: incomplete (count: {N})`
**And** Step 1 completes within 60 seconds
**And** if Plane.so API fails for a specific issue, it retries per-issue (3 attempts) then skips and logs
**And** Step 1 outputs the standard inter-node data wrapper with `metadata.items_processed` and `metadata.items_failed`
**And** the set of today's existing quest `source_issue_id` values is collected for duplicate prevention in Step 2

### Story 2.3: W1 Step 2 — Deterministic Routine Copy

As a **user**,
I want qualifying routines automatically copied as today's quests each morning,
So that my daily quest board is populated without any manual planning.

**Acceptance Criteria:**

**Given** Step 1 has completed successfully
**When** Step 2 executes
**Then** it scans all projects for issues with the exact label `daily-routine`
**And** for each routine, it evaluates: `routine_days` matches today's day, `routine_active_from` <= today, `routine_active_until` is null or >= today, `routine_cooldown_days` is satisfied
**And** qualifying routines are created as new issues in the "Daily Quests" project with state "To-Do", `target_date` = today, time and priority from pulse-meta
**And** duplicate quests are prevented by checking `source_issue_id` against already-existing today's quests (from Step 1 data)
**And** the routine scan enforces a maximum of ~100 issues per run
**And** if a label approximates but doesn't exact-match `daily-routine`, a warning is logged: `⚠️ [LABEL_MISMATCH] Issue '{title}' has label '{label}' — did you mean 'daily-routine'?`
**And** routines with invalid pulse-meta are logged as `⚠️ [INVALID_ROUTINE_META] Routine '{title}' has invalid metadata — skipped` and skipped
**And** if a source routine has been deleted, no new quest is generated
**And** Steps 1-2 combined complete within 60 seconds
**And** Step 2 outputs the inter-node data wrapper with quest creation results

### Story 2.4: W1 Degraded Mode & Execution Summary

As a **user**,
I want the quest generation pipeline to work reliably even when the LLM is unavailable, with clear status notifications,
So that I always have my daily quests regardless of AI service status.

**Acceptance Criteria:**

**Given** W1 Steps 1-2 have completed
**When** the LLM (DeepSeek) is unavailable or Steps 3-5 are not yet implemented
**Then** W1 completes successfully with only deterministic steps (Steps 1-2)
**And** the system sets a `DEGRADED_MODE` flag in the execution context
**And** a proactive notification is sent to LobeHub: `⚠️ [DEGRADED_MODE] AI features temporarily unavailable. Routine-based quests generated normally.`
**And** the W1 execution summary logs: start time, steps completed, steps skipped, issues created count, errors encountered, total execution time
**And** when operating normally (LLM available), no degraded mode notification is sent (normal operation = silent)
**And** the workflow references W5 as its Error Workflow for unhandled fatal errors

### Story 2.5: LobeHub Agent Setup & /today Command

As a **user**,
I want to view my daily quest board by typing `/today` in LobeHub chat,
So that I can see my structured day at a glance through a single conversational interface.

**Acceptance Criteria:**

**Given** the LobeHub agent is configured with the system prompt from `prompts/lobehub-system-prompt.md`
**And** the Function Call plugin is registered using `lobehub/plugin-manifest.json` with `quest_command` function
**When** the user sends `/today` in LobeHub
**Then** LobeHub calls the n8n webhook with `action: "today"`
**And** the W2 webhook handler queries the "Daily Quests" project for today's issues
**And** returns quests grouped by state bucket (To-Do, In Progress, Deferred, Done, Canceled)
**And** each quest displays: priority emoji (🔴/🟠/🟡/🟢), title, scheduled time (HH:MM), duration
**And** the header shows: `📋 {YYYY-MM-DD} ({Day}) Today's Quests`
**And** if degraded mode was active during generation, the header includes the degraded mode warning
**And** the response is in English only
**And** the response completes within 5 seconds
**And** n8n webhook is secured with `X-API-Key` header authentication
**And** the webhook returns JSON using the standard response format: `response_type`, `message`, `data`, `suggestions`, `awaiting_input`

## Epic 3: Core Quest Interaction Commands

Enable interactive quest management through LobeHub chat: complete (/complete), cancel (/cancel), defer (/defer), manually add (/add), view help (/help). The user can manage their daily quests entirely through conversational commands.

### Story 3.1: W2 Command Router & Response Formatter

As a **developer**,
I want a W2 webhook command handler with routing logic and standardized response formatting,
So that all slash commands are dispatched consistently and responses follow the unified format.

**Acceptance Criteria:**

**Given** LobeHub sends an HTTP POST to the W2 webhook with `action`, `target`, `params` fields
**When** the webhook node receives the request
**Then** it validates the `X-API-Key` header against `PULSE_N8N_WEBHOOK_SECRET`
**And** a Switch node routes the request to the correct command handler based on `action`
**And** unrecognized actions return an error: `❌ [UNKNOWN_COMMAND] Unknown command '{action}'. Type /help for available commands.`
**And** `src/response-formatter.js` formats all responses using the standard JSON structure: `response_type`, `message`, `data`, `suggestions`, `awaiting_input`
**And** all user-facing text in responses is in English only
**And** error messages include originating workflow and step: `[W2-{COMMAND}] {error detail}`
**And** when LLM is unavailable, commands fall back to literal command parsing (no intent classification)
**And** when n8n is unreachable, LobeHub agent's system prompt instructs it to return: `❌ [N8N_UNREACHABLE] Automation server unavailable. Please check n8n service status.`

### Story 3.2: /complete — Interactive Quest Completion

As a **user**,
I want to mark quests as completed through an interactive selection flow in LobeHub,
So that I can track my daily progress with minimal friction.

**Acceptance Criteria:**

**Given** the user sends `/complete` in LobeHub
**When** the W2 handler processes the command
**Then** it fetches today's quests in "To-Do" and "In Progress" states
**And** returns a numbered list in the format: `N. [🔴 priority] Title — HH:MM (duration)`
**And** deferred issues append `(deferred x{N})` suffix
**And** the response includes `awaiting_input: true` with prompt: `Enter number(s) (e.g., 1,3 or 1-3):`
**And** when LobeHub sends the follow-up with selected numbers (resolved to issue IDs by LobeHub LLM)
**Then** the selected quests are moved to "Done" state in Plane.so
**And** a comment is added to each: `✅ [{HH:MM}] Quest completed by user`
**And** the response confirms: `✅ {N} quests completed!`
**And** the command responds within 5 seconds

### Story 3.3: /cancel — Interactive Quest Cancellation

As a **user**,
I want to cancel quests I no longer intend to do today,
So that my quest board accurately reflects my planned activities.

**Acceptance Criteria:**

**Given** the user sends `/cancel` in LobeHub
**When** the W2 handler processes the command
**Then** it fetches today's quests in "To-Do" and "In Progress" states
**And** returns the same numbered list format as `/complete`
**And** the response includes `awaiting_input: true`
**When** the user selects quest numbers
**Then** the selected quests are moved to "Canceled" state in Plane.so
**And** a comment is added to each: `🚫 [{HH:MM}] Canceled by user`
**And** the response confirms the cancellation count
**And** the command responds within 5 seconds

### Story 3.4: /defer — Interactive Quest Deferral with Warning

As a **user**,
I want to defer quests to later with tracking of how many times each quest has been deferred,
So that I can manage my workload dynamically while being aware of chronic deferrals.

**Acceptance Criteria:**

**Given** the user sends `/defer` in LobeHub
**When** the W2 handler processes the command
**Then** it fetches today's quests in "To-Do" and "In Progress" states
**And** returns the numbered list with existing defer counts shown
**When** the user selects quest numbers
**Then** the selected quests are moved to "Deferred" state
**And** `defer_count` is incremented for each quest
**And** a comment is added: `⏸️ [{HH:MM}] Deferred by user (count: {N})`
**And** if any quest reaches `defer_count >= 3`, the response includes a warning: `⚠️ This quest has been deferred {N} times. Consider removing it.`
**And** the command responds within 5 seconds

### Story 3.5: /add — Manual Quest Addition

As a **user**,
I want to manually add ad-hoc quests with a name and duration,
So that I can incorporate unplanned tasks into my daily quest board.

**Acceptance Criteria:**

**Given** the user sends `/add {name} {duration}` in LobeHub (e.g., `/add Code Review 1h`)
**When** the W2 handler processes the command
**Then** a new issue is created in the "Daily Quests" project with state "To-Do" and `target_date` = today
**And** the quest name and duration are parsed from the command parameters
**And** the quest is assigned default medium priority if not specified
**And** the response confirms: `✅ Quest added: "{name}" ({duration})`
**And** the command responds within 5 seconds
**And** if name or duration is missing, return: `❌ [INVALID_PARAMS] Usage: /add {name} {duration} (e.g., /add Code Review 1h)`

### Story 3.6: /help — Command Reference

As a **user**,
I want to view a list of all available commands and their descriptions,
So that I can quickly reference how to interact with pulse.

**Acceptance Criteria:**

**Given** the user sends `/help` in LobeHub
**When** the W2 handler processes the command
**Then** it returns a formatted list of all 14 commands with descriptions and usage examples
**And** commands are grouped by type: Query, Interactive, Immediate, Confirm
**And** the response is in English only
**And** the command responds within 5 seconds

## Epic 4: Reporting, Analytics & Query Commands

Provide milestone briefings (/brief), statistics (/stats), deferred list (/deferred), next-day preview (/preview), weekly report (/weekly), and automated daily summary (W3 at 23:00 KST). The user gains data-driven insights into their quest patterns and long-term project progress.

### Story 4.1: /brief & /brief all — Milestone Briefing

As a **user**,
I want to view milestone progress across my long-term projects,
So that I can see how daily quest execution is advancing my bigger goals.

**Acceptance Criteria:**

**Given** the user sends `/brief` in LobeHub
**When** the W2 handler processes the command
**Then** it queries all Plane.so projects for milestones with due dates
**And** returns the top 5 milestones sorted by D-Day (closest deadline first)
**And** each milestone displays: project name, milestone name, progress percentage, D-Day count
**And** the response format uses: `🎯 {project} — {milestone}: {progress}% (D-{N})`
**And** the command responds within 15 seconds

**Given** the user sends `/brief all` in LobeHub
**When** the W2 handler processes the command
**Then** it returns all milestones across all projects (not limited to top 5)
**And** milestones are grouped by project
**And** the command responds within 15 seconds

### Story 4.2: /stats — N-Day Statistics

As a **user**,
I want to view my quest completion statistics for a given period,
So that I can track my productivity trends and identify patterns.

**Acceptance Criteria:**

**Given** the user sends `/stats {N}` in LobeHub (e.g., `/stats 7`)
**When** the W2 handler processes the command
**Then** it queries completed, deferred, and canceled quests for the past N days
**And** returns: total quests generated, completion count and rate, deferral count and rate, cancellation count
**And** shows daily breakdown with per-day completion rates
**And** identifies best and worst performing days
**And** if N is not provided, defaults to 7
**And** the command responds within 15 seconds

### Story 4.3: /deferred — View Deferred Quests

As a **user**,
I want to view all currently deferred quests with their deferral counts,
So that I can decide which to restore, cancel, or leave deferred.

**Acceptance Criteria:**

**Given** the user sends `/deferred` in LobeHub
**When** the W2 handler processes the command
**Then** it queries all issues in the "Daily Quests" project with state "Deferred"
**And** returns a list showing: quest title, original source project, defer_count, original date
**And** quests with `defer_count >= 5` are highlighted with: `⚠️ (deferred x{N} — consider removing)`
**And** the response includes a suggestion: `Use /restore to bring quests back, or /cancel to remove them.`
**And** the command responds within 5 seconds

### Story 4.4: /preview — Next-Day Quest Dry-Run

As a **user**,
I want to preview what quests will be generated tomorrow,
So that I can verify my routine configuration is correct before the next W1 run.

**Acceptance Criteria:**

**Given** the user sends `/preview` in LobeHub
**When** the W2 handler processes the command
**Then** it internally runs W1 Step 2 logic in DRY_RUN mode for tomorrow's date
**And** returns a list of routines that would generate quests tomorrow
**And** each routine shows: source project, routine name, scheduled time, priority
**And** label mismatches are surfaced as warnings: `⚠️ [LABEL_MISMATCH] Issue '{title}' has label '{label}' — did you mean 'daily-routine'?`
**And** invalid pulse-meta blocks are surfaced: `⚠️ [INVALID_ROUTINE_META] Routine '{title}' — {reason}`
**And** the response header: `📋 {YYYY-MM-DD} ({Day}) Preview — Expected Quests`
**And** the command responds within 30 seconds

### Story 4.5: /weekly — Weekly Summary Report

As a **user**,
I want a weekly summary with day-by-day breakdown of my quest activity,
So that I can review my week and make data-driven adjustments to my routines.

**Acceptance Criteria:**

**Given** the user sends `/weekly` in LobeHub
**When** the W2 handler processes the command
**Then** it queries quest data for the current week (Monday through today or Sunday)
**And** returns a day-by-day breakdown: date, quests generated, completed, deferred, canceled, completion rate
**And** shows weekly averages and totals
**And** identifies the most and least productive days
**And** the command responds within 15 seconds

### Story 4.6: W3 — Daily Summary Reporter

As a **user**,
I want an automated daily summary pushed to my LobeHub chat at 23:00 KST,
So that I can reflect on my day's progress without having to request it.

**Acceptance Criteria:**

**Given** the W3 workflow triggers at 23:00 KST via cron
**When** it executes
**Then** it queries today's quest completion data from Plane.so
**And** calculates: total quests, completed count, completion rate, deferred count, canceled count
**And** sends a formatted summary to LobeHub: `🎯 Daily Summary — {date}: {completed}/{total} ({rate}%)`
**And** includes a progress message (e.g., "Great day!" / "Keep going!" based on completion rate)
**And** the workflow references W5 as its Error Workflow
**And** the workflow includes a sticky note documenting its purpose, trigger, and outputs
**And** W3 failure is non-critical — it is logged but does not affect system operation
**And** when `DRY_RUN=true`, the LobeHub push is blocked and logged

## Epic 5: AI-Enhanced Quest Intelligence

Integrate DeepSeek LLM into the W1 pipeline: context-based additional task suggestions (Step 3), time-slot schedule optimization (Step 4), and deferred quest restoration judgment (Step 5). Graceful degradation ensures the core pipeline is unaffected when LLM is unavailable.

### Story 5.1: W1 Step 3 — LLM Task Generation

As a **user**,
I want the system to suggest 0-3 additional tasks based on my current context each morning,
So that I receive proactive recommendations beyond my routine definitions.

**Acceptance Criteria:**

**Given** W1 Steps 1-2 have completed successfully
**When** Step 3 executes and DeepSeek is available
**Then** it sends today's quest list, recent completion history, and project context to DeepSeek using the prompt template `prompts/w1-task-generation.md`
**And** DeepSeek returns 0-3 task suggestions in JSON format with name, duration, priority, and rationale
**And** the response JSON is validated — if invalid, retry once with `temperature: 0.1`
**And** on second parse failure, Step 3 is skipped with `DEEPSEEK_JSON_PARSE_ERROR` logged
**And** valid suggestions are created as new quest issues in Plane.so with state "To-Do"
**And** each AI-generated quest includes a Plane.so comment: `🤖 [00:00] AI-suggested task (source: W1 Step 3)`
**And** the LLM call logs: step origin, request duration, success/failure, token usage
**And** Step 3 respects the per-step timeout of 60 seconds
**And** the node follows the standard LLM branching pattern (P-3): Call → Validate → IF Success → Process/Log Skip

**Given** DeepSeek is unavailable
**When** Step 3 attempts to execute
**Then** it is skipped entirely with `DEGRADED_MODE` flag set
**And** no quest suggestions are generated
**And** the skip is logged in the W1 execution summary

### Story 5.2: W1 Step 4 — LLM Schedule Optimization

As a **user**,
I want my daily quests optimized for time slots and priority ordering,
So that my schedule accounts for energy levels and task dependencies.

**Acceptance Criteria:**

**Given** Steps 1-3 have completed (Step 3 results preserved even if partial)
**When** Step 4 executes and DeepSeek is available
**Then** it sends the full today's quest list (including any Step 3 additions) to DeepSeek using `prompts/w1-schedule-optimization.md`
**And** DeepSeek returns optimized `routine_time` and ordering for each quest in JSON format
**And** the response JSON is validated — retry once with `temperature: 0.1` on parse failure
**And** on second failure, Step 4 is skipped and quests retain their original scheduling
**And** valid optimizations update each quest issue's time and priority in Plane.so
**And** Step 4 respects the per-step timeout of 60 seconds
**And** if the total LLM budget (3 minutes) is exceeded, Step 4 is skipped with partial degraded mode notification

**Given** Step 3 failed but produced partial results
**When** Step 4 executes
**Then** it optimizes whatever quests exist (Step 2 deterministic + any Step 3 successes)
**And** partial failure from Step 3 does not prevent Step 4 execution

### Story 5.3: W1 Step 5 — LLM Deferred Quest Restoration

As a **user**,
I want the system to evaluate my deferred quests and restore appropriate ones each morning,
So that important deferred tasks are automatically re-surfaced based on my available capacity.

**Acceptance Criteria:**

**Given** Steps 1-4 have completed
**When** Step 5 executes and DeepSeek is available
**Then** it sends the deferred quest list and today's current quest load to DeepSeek using `prompts/w1-deferred-restoration.md`
**And** DeepSeek evaluates each deferred quest for restoration based on: priority, defer_count, available time slots, mandatory flag
**And** the response JSON is validated — retry once with `temperature: 0.1` on parse failure
**And** approved quests are moved from "Deferred" to "To-Do" state with `target_date` = today
**And** a comment is added: `🔄 [00:00] Restored from deferred by LLM (reason: {rationale})`
**And** Step 5 respects the per-step timeout of 60 seconds
**And** if the total LLM budget (3 minutes) is exceeded, Step 5 is skipped
**And** DeepSeek API call retries use exponential backoff (1s→2s→4s, 3 retries) before degraded mode

## Epic 6: Natural Language & Conversational Intelligence

Enable natural language interaction: intent classification for command mapping, natural language routine creation/editing with confirmation flow, and immediate quest generation option. Falls back to literal parsing when LLM is unavailable.

### Story 6.1: Natural Language Intent Classification

As a **user**,
I want to interact with pulse using natural language instead of slash commands,
So that I can manage my quests conversationally without memorizing command syntax.

**Acceptance Criteria:**

**Given** the user sends a natural language message in LobeHub (e.g., "show me today's quests")
**When** LobeHub's LLM processes the message with the system prompt
**Then** the system prompt instructs the LLM to classify the intent and map it to a `quest_command` function call
**And** the intent classification uses the DeepSeek prompt `prompts/w2-intent-classification.md` when additional disambiguation is needed
**And** if intent confidence is high, the mapped command executes automatically
**And** if intent confidence is below the configured threshold, the system asks for clarification: `I'm not sure what you mean. Did you want to: [option list]?`
**And** ambiguous inputs like "done" or "skip" are disambiguated with context (e.g., active interactive session vs new command)

**Given** DeepSeek is unavailable
**When** the user sends a natural language message
**Then** the system falls back to literal command parsing (exact slash command match only)
**And** non-matching inputs return: `⚠️ [DEGRADED_MODE] Natural language processing unavailable. Please use slash commands (type /help for list).`

### Story 6.2: Natural Language Routine Creation

As a **user**,
I want to create new routines by describing them in natural language through LobeHub,
So that I can add routines without manually editing Plane.so issue metadata.

**Acceptance Criteria:**

**Given** the user sends a natural language routine creation request (e.g., "add a daily coding routine at 8pm for 1 hour, high priority, weekdays only")
**When** the system classifies the intent as routine creation
**Then** it extracts: routine name, time, duration, priority, schedule (days), target project
**And** if any required field is ambiguous or missing, the system asks clarifying questions one at a time
**And** once all fields are confirmed, it presents a summary for user confirmation: project, name, time, duration, priority, days
**And** on user confirmation, it creates a new issue in the target Plane.so project with `daily-routine` label and valid `pulse-meta` JSON block
**And** the system asks: "Would you like to add this to today's quests as well?"
**And** if the user confirms immediate addition, a quest is created in the "Daily Quests" project for today
**And** the confirmation flow uses LobeHub's conversation memory — n8n remains stateless

### Story 6.3: Session Collision Handling

As a **user**,
I want new commands to take precedence when I send them during an active interactive session,
So that I'm never stuck in a stale session and can switch context freely.

**Acceptance Criteria:**

**Given** the user is in an active interactive session (e.g., `/complete` awaiting number input)
**When** the user sends a new command (e.g., `/today`)
**Then** the previous session is implicitly abandoned
**And** the new command executes immediately
**And** LobeHub's system prompt enforces this behavior — the LLM does not attempt to continue the previous session
**And** no error or warning is shown for the abandoned session

## Epic 7: Advanced Quest Management & Maintenance

Complete the management toolkit: edit quest properties (/edit), regenerate quests (/regen with confirmation), restore deferred quests (/restore), and automated weekly cleanup (W4). The user can fine-tune routines and the system self-maintains over time.

### Story 7.1: /restore — Restore Deferred Quests

As a **user**,
I want to manually restore deferred quests back to today's To-Do list,
So that I can bring back previously deferred tasks when I have capacity.

**Acceptance Criteria:**

**Given** the user sends `/restore` in LobeHub
**When** the W2 handler processes the command
**Then** it fetches all quests in "Deferred" state from the "Daily Quests" project
**And** returns a numbered list in the standard interactive format
**And** the response includes `awaiting_input: true`
**When** the user selects quest numbers
**Then** the selected quests are moved to "To-Do" state with `target_date` = today
**And** a comment is added: `🔄 [{HH:MM}] Restored by user`
**And** the response confirms: `✅ {N} quests restored to today's board!`
**And** the command responds within 5 seconds

### Story 7.2: /edit — Edit Quest Time & Priority

As a **user**,
I want to edit a quest's scheduled time or priority,
So that I can adjust my daily plan without canceling and recreating quests.

**Acceptance Criteria:**

**Given** the user sends `/edit` in LobeHub
**When** the W2 handler processes the command
**Then** it fetches today's quests in "To-Do" and "In Progress" states
**And** returns a numbered list in the standard interactive format
**And** the response includes `awaiting_input: true` with prompt: `Select a quest to edit:`
**When** the user selects a quest number
**Then** the system asks: `What would you like to change? [time/priority]`
**When** the user specifies the field and new value (e.g., "time 21:00" or "priority high")
**Then** the quest's corresponding field is updated in Plane.so
**And** a comment is added: `✏️ [{HH:MM}] Edited by user: {field} → {new_value}`
**And** the response confirms: `✅ Quest updated: "{title}" — {field} changed to {new_value}`
**And** v1 scope is limited to time and priority only — other fields return: `⚠️ Only time and priority can be edited in this version.`
**And** the command responds within 5 seconds

### Story 7.3: /regen — Regenerate Today's Quests

As a **user**,
I want to regenerate today's quests from scratch with a confirmation prompt,
So that I can fully reset my day when circumstances change dramatically.

**Acceptance Criteria:**

**Given** the user sends `/regen` in LobeHub
**When** the W2 handler processes the command
**Then** it first shows a confirmation prompt: `⚠️ This will regenerate all quests except completed ones. Are you sure? (yes/no)`
**And** the response includes `awaiting_input: true`
**When** the user confirms with "yes"
**Then** all today's quests except those in "Done" state are canceled
**And** W1 Steps 1-2 (and Steps 3-5 if LLM available) are re-executed for today
**And** the response confirms: `✅ Today's quests regenerated! Use /today to see the new board.`
**When** the user responds with "no"
**Then** the operation is canceled: `👍 Regeneration canceled. Your current quest board is unchanged.`
**And** the command responds within 5 seconds for the confirmation, full W1 execution time for the regeneration

### Story 7.4: W4 — Weekly Deferred Cleanup

As a **user**,
I want quests that have been deferred 7+ times to be automatically cleaned up weekly,
So that my deferred list doesn't grow indefinitely with tasks I'm unlikely to complete.

**Acceptance Criteria:**

**Given** the W4 workflow triggers at Sunday 00:00 KST via cron
**When** it executes
**Then** it queries all "Deferred" quests with `defer_count >= 7`
**And** for each qualifying quest, it checks the `routine_mandatory` field from the source routine's pulse-meta
**And** non-mandatory quests are automatically moved to "Canceled" state with comment: `🗑️ [00:00] Auto-canceled: deferred 7+ times`
**And** mandatory quests are kept in "Deferred" state with comment: `⚠️ [00:00] Chronic deferral (count: {N}) — mandatory routine, kept deferred`
**And** if DeepSeek is available, it is consulted for cancel/keep decisions using `prompts/w4-cleanup-decision.md`
**And** a weekly deferred report is generated and sent to LobeHub listing: quests canceled, quests kept, total deferred remaining
**And** the workflow references W5 as its Error Workflow
**And** W4 failure is non-critical — logged but does not affect daily operations
**And** when `DRY_RUN=true`, cancellations are blocked and logged
