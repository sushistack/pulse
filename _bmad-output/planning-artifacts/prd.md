---
stepsCompleted: ['step-01-init', 'step-02-discovery', 'step-02b-vision', 'step-02c-executive-summary', 'step-03-success', 'step-04-journeys', 'step-05-domain', 'step-06-innovation', 'step-07-project-type', 'step-08-scoping', 'step-09-functional', 'step-10-nonfunctional', 'step-11-polish', 'step-12-complete']
inputDocuments:
  - docs/start.spec.md
  - docs/plane-openapi.yaml
documentCounts:
  briefs: 0
  research: 0
  projectDocs: 2
  projectContext: 0
workflowType: 'prd'
classification:
  projectType: 'Conversational AI Orchestration Platform'
  domain: 'Personal Productivity + Behavioral Coaching'
  complexity: 'Medium-High'
  projectContext: 'Greenfield product on brownfield infrastructure'
---

# Product Requirements Document - pulse

**Author:** 사용자
**Date:** 2026-04-06

## Executive Summary

pulse automatically converts routines defined across multiple life projects into a ready-made daily quest board — no manual planning required. Every morning, the system scans routine definitions in Plane.so, applies scheduling rules, handles deferred tasks, and delivers a prioritized, time-optimized quest list directly to a chat window. The user opens LobeHub and their day is already structured.

This is a **single-user, self-hosted** system. The user owns their data, their infrastructure, and their automation. pulse is designed to operate fully without LLM availability — deterministic automation handles the core pipeline, while DeepSeek LLM enhances it with schedule optimization, adaptive task suggestions, and natural language command parsing when available.

The target user is someone already managing long-term projects in Plane.so (health, career development, learning, etc.) who wants consistent daily execution without the cognitive overhead of translating goals into action manually. They interact through LobeHub's chat interface using slash commands (`/today`, `/complete`, `/defer`) or natural language — a single conversational window replaces dashboard-hopping.

### What Makes This Special

pulse's core differentiator is **seamless, invisible automation**. Unlike task management apps that require users to organize their own day, pulse does the planning automatically. Every morning, the user receives a quest board with optimized scheduling and priority-based ordering — all through a single chat window.

The system follows an incremental AI adoption strategy: deterministic automation first, AI-assisted optimization second, autonomous AI coaching third — only after guardrails are proven. The conversational interface is a strategic bet on future extensibility; natural language interaction will become essential as AI autonomy increases.

## Project Classification

- **Type:** Conversational AI Orchestration Platform — event-driven orchestration via webhooks and cron jobs, integrating LobeHub (chat UI), n8n (workflow engine), Plane.so (data store), and DeepSeek (LLM)
- **Domain:** Personal Productivity + Behavioral Coaching
- **Complexity:** Medium-High — 4 independent self-hosted systems (Docker), LLM-in-the-loop with graceful degradation, stateful interactive chat sessions, asynchronous workflow orchestration
- **Context:** Greenfield product on brownfield infrastructure — Plane.so, LobeHub, and n8n are existing self-hosted deployments; the quest system, workflow logic, and LLM integration are entirely new
- **Deployment:** Fully self-hosted; user is also the operator

## Success Criteria

### User Success

- **Planning time reduction:** The user spends near-zero time deciding "what should I do today" — pulse handles daily planning entirely. Success = the user opens LobeHub and immediately starts executing, not planning.
- **Milestone progress:** Long-term Plane.so project milestones show measurable forward movement as a direct result of consistent daily quest execution. The routine-to-quest pipeline reliably translates long-term goals into daily action.
- **Sustained engagement:** The user maintains a consistent quest completion pattern over weeks, not just days. Stats and weekly reports reinforce this loop.

### Business Success

- **Full system operational within single deployment cycle:** All 4 n8n workflows (W1-W4), all 15 slash commands, LLM integration, and advanced features deployed and functional as a single release.
- **Daily reliability:** The system runs autonomously every day without manual intervention — quest generation at 00:00, summary at 23:00, weekly cleanup on Sundays.
- **Self-hosted sustainability:** The system runs stably on the user's own infrastructure with minimal maintenance overhead.

### Technical Success

- **Quest generation reliability:** The daily-quest-generator (W1) at 00:00 KST must have a near-zero failure rate. When it fails, the failure must be clearly logged with actionable error information.
- **Command success rate:** All 15 slash commands must execute successfully under normal conditions. Failures must return clear, specific error codes — not silent failures or ambiguous messages.
- **Graceful degradation:** When DeepSeek is unavailable, the system must continue operating in deterministic mode (routine copy, manual commands) without user-visible errors. LLM-dependent features (Steps 3-5, intent classification) degrade cleanly.
- **Clear error taxonomy:** Every failure path (Plane.so API down, DeepSeek timeout, JSON parse error, ambiguous task match) must return a distinct, documented error code to the user.

### Measurable Outcomes

| Metric | Target |
|---|---|
| Daily quest generation success rate | >99% |
| Slash command success rate | >99% under normal conditions |
| Error response clarity | 100% of failures return specific error codes |
| LLM degradation transparency | User notified when operating in degraded mode |
| Daily planning time | Target: <1 minute (open chat → start executing) |

## Product Scope

### Full Release (All Phases Combined)

This is a single-release product. All features ship together.

**Core Automation:**
- Plane.so workspace structure with routine buckets and quest project
- W1: daily-quest-generator — all 5 steps (deferred handling, routine copy, LLM task generation, schedule optimization, deferred restoration)
- W2: lobehub-command-handler — 15 core slash commands
- LobeHub agent setup with system prompt and function call plugin
- DeepSeek API integration via n8n OpenAI-compatible nodes

**AI Enhancement:**
- LLM-based task generation and schedule optimization (W1 Steps 3-5)
- Natural language intent classification (DeepSeek-powered command mapping)
- W3: daily-summary-reporter (23:00 KST daily report via LobeHub)

**Advanced Features:**
- Task editing command (`/edit` — scoped to time and priority for v1)
- W4: deferred-cleanup (weekly automatic cleanup)
- `/weekly` and `/brief [all]` reports
- `/preview` dry-run for routine verification
- All notifications consolidated through LobeHub (single channel)
- All user-facing interface text in English

### Future Enhancements (Post-Release)

- **Nice-to-have commands:** `/swap` (task time exchange), `/memo` (task comments)
- **Gamification:** streaks, weekly achievements, level system, LLM coaching messages, quest metaphor UI enhancements
- Google Calendar integration (schedule conflict prevention)
- Multi-user support (user_id-based isolation)
- Additional LLM providers beyond DeepSeek
- Autonomous AI coaching mode (after guardrails proven)

## User Journeys

### Journey 1: Daily Quest Execution (Primary — Happy Path)

**Persona:** 민수 — 개발자이자 자기계발에 진심인 30대. Plane.so에 "건강 관리", "개발 역량 강화", "독서" 등 여러 장기 프로젝트를 운영 중. 매일 아침 뭘 해야 할지 정리하는 데 15분을 쓰고, 그마저도 자주 빼먹는다.

**Opening Scene:** 월요일 아침 7시. 민수는 출근 준비를 하며 LobeHub을 연다. 별도의 계획 없이 채팅창만 열었을 뿐인데, pulse가 이미 오늘의 퀘스트 8개를 준비해 놓았다. 아침 운동(07:00), 영어 공부(09:00), 코드 리뷰(14:00)... 시간대별로 정리되어 있다. 만약 밤사이 DeepSeek이 불안정했다면, 상단에 "⚠️ AI 최적화 없이 루틴 기반으로 생성됨" 알림이 함께 표시된다.

**Rising Action:** 민수는 `/today`로 전체 일정을 확인한다. 오전에 집중력이 필요한 태스크, 오후에 가벼운 태스크가 배치되어 있다. 아침 운동을 마치고 `/complete`를 입력하면 번호 리스트가 뜨고, "1"을 선택하면 완료 처리된다. 점심 후 예상 외 미팅이 잡혀서 코드 리뷰를 `/defer`한다. 퇴근 후 `/stats 7`로 이번 주 패턴을 확인한다.

**Climax:** 2주째 사용 중. 민수는 아침에 "오늘 뭐 하지?"를 더 이상 생각하지 않는다. LobeHub을 열면 이미 하루가 설계되어 있다. `/brief`로 확인한 "건강 관리" 마일스톤이 78%로 올라가 있다 — 매일의 작은 루틴이 실제로 장기 목표를 움직이고 있다.

**Resolution:** 민수의 일일 계획 시간: 15분 → 0분. 장기 프로젝트 진행률이 눈에 보이기 시작한다. "그냥 시키는 대로 하면 되니까" — 인지 부하가 사라졌다.

**Capabilities revealed:** `/today`, `/complete`, `/cancel`, `/defer`, `/stats`, `/brief`, W1 daily generation, schedule optimization, proactive degraded mode notification

---

### Journey 2: Routine Creation & Management (Primary — Setup Path)

**Persona:** 같은 민수. 새로운 장기 프로젝트 "사이드 프로젝트"를 시작하면서 매일 1시간씩 코딩 루틴을 추가하고 싶다.

**Opening Scene — Path A (LobeHub):** 민수가 LobeHub에서 자연어로 "매일 저녁 8시에 사이드 프로젝트 코딩 1시간 루틴 추가해줘"라고 입력한다. pulse가 인텐트를 파악하고, 어느 프로젝트에 연결할지, 우선순위는 무엇인지 확인 질문을 한다. 민수가 답하면 Plane.so에 루틴 이슈가 자동 생성된다. pulse가 묻는다: "오늘 퀘스트에도 바로 추가할까요?" — 민수가 승인하면 즉시 오늘의 To-Do에 반영된다.

**Opening Scene — Path B (Plane.so):** 민수가 Plane.so의 "사이드 프로젝트" 프로젝트에 직접 이슈를 만들고, Label을 "daily-routine"으로 설정, description에 루틴 메타데이터 JSON 블록을 채운다. 이 경로는 다음 W1 실행(00:00 KST)에서 자동 감지된다 — **오늘 즉시 반영되지는 않는다.** 급하면 `/regen`으로 오늘 퀘스트를 재생성할 수 있다.

> **Design note:** LobeHub 경로는 즉시 반영 옵션 제공. Plane.so 직접 경로는 batch 처리(다음 W1). 이 차이는 의도된 설계이며 사용자에게 명시적으로 안내한다.

**Rising Action:** 일주일 후, 민수는 코딩 루틴의 시간을 조정하고 싶다. `/edit`으로 루틴 시간을 20:00 → 21:00으로 변경한다. 또한 주말에는 쉬고 싶어서 루틴의 routine_days를 월~금으로 수정한다.

**Verification:** 민수가 `/preview`를 입력하면 "내일 생성 예정인 퀘스트 목록"이 표시된다. 새로 추가한 코딩 루틴이 포함된 것을 확인하고 안심한다.

**Resolution:** 루틴 추가/수정의 진입 장벽이 사라진다. 두 경로 모두 동일한 Plane.so 데이터를 사용하므로 결과는 일관적이다.

**Capabilities revealed:** Natural language routine creation (LobeHub), immediate quest generation option, Plane.so direct creation (batch), `/edit`, `/preview` (dry-run), `/regen`, routine metadata management

---

### Journey 3: System Recovery & Edge Cases (Primary — Failure Path)

**Persona:** 같은 민수. 어느 날 아침, 뭔가 다르다.

**Scenario A — DeepSeek Down:** 화요일 아침. `/today` 결과에 LLM 추천 태스크와 스케줄 최적화가 빠져 있다. 상단에 proactive 알림: "⚠️ [DEGRADED_MODE] AI 기능이 일시적으로 비활성 상태입니다. 루틴 기반 퀘스트는 정상 생성되었습니다." 루틴 복사(Step 1-2)는 정상 작동. 민수는 `/add 코드 리뷰 1h`로 수동 보완한다.

**Scenario B — Plane.so API Failure:** `/complete`를 눌렀는데 Plane.so가 504를 반환한다. 명확한 에러: "❌ [PLANE_API_TIMEOUT] Plane.so 서버 응답 없음. 3회 재시도 실패. 잠시 후 다시 시도해주세요." 5분 후 재시도하여 성공.

**Scenario C — n8n Down (Single Point of Failure):** 민수가 `/today`를 입력했는데 응답이 없다. LobeHub → n8n webhook이 타임아웃. LobeHub 에이전트가 자체적으로 "❌ [N8N_UNREACHABLE] 자동화 서버에 연결할 수 없습니다. n8n 서비스 상태를 확인해주세요."를 반환한다. 민수는 n8n Docker 컨테이너를 재시작하고 복구한다. 이 동안 Plane.so에서 직접 태스크를 확인하는 것은 가능하다.

**Scenario D — Chronic Deferral:** `/defer`로 "블로그 포스팅"을 5번째 연기. pulse 경고: "⚠️ 이 퀘스트는 5회째 연기 중이에요. 루틴에서 제외를 고려해보세요."

**Scenario E — Interactive Session Timeout:** `/complete`를 입력하고 번호 리스트를 받았는데, 자리를 비운다. 5분 후 세션 만료. 돌아와서 "1"을 입력하면 pulse가 "⏰ 이전 세션이 만료되었습니다. `/complete`를 다시 입력해주세요."로 안내한다.

**Scenario F — Data Inconsistency:** 민수가 LobeHub으로 루틴을 만든 후, Plane.so에서 직접 메타데이터를 수정한다. W1은 항상 Plane.so의 현재 상태를 source of truth로 사용하므로, Plane.so에서 수정한 내용이 다음 퀘스트 생성에 반영된다. 원본 루틴이 삭제된 경우, 이미 생성된 오늘의 퀘스트는 유지되지만 다음 날부터 생성되지 않는다.

**Resolution:** 모든 실패 경로에서 사용자는 명확한 에러 코드와 복구 가이드를 받는다. n8n이 유일한 단일 장애점(SPOF)이며, 이 경우 Plane.so 직접 접근이 수동 fallback으로 동작한다.

**Capabilities revealed:** Degraded mode, proactive notifications, clear error codes per failure type, n8n SPOF handling, session timeout management, Plane.so as source of truth, orphan quest handling

---

### Journey 4: Initial Setup & Onboarding (Operator Path)

**Persona:** 같은 민수, 시스템 관리자 모드. pulse를 처음 설치한다.

**Opening Scene:** 민수는 이미 Plane.so, LobeHub, n8n을 self-host하고 있다. Plane.so에는 "건강 관리", "개발 역량 강화" 등 마일스톤 기반 프로젝트가 세팅되어 있다.

**Rising Action:**
1. **Plane.so 루틴 프로젝트 생성**: 전용 "일일 퀘스트" 프로젝트 생성, State 설정 (To-Do, In Progress, Deferred, Done, Canceled). State 매핑과 커스텀 필드 설정에서 가이드 필요.
2. **기존 프로젝트에 루틴 버킷 추가**: 각 장기 프로젝트에 Label "daily-routine" 생성, 루틴 이슈 등록 및 메타데이터 JSON 블록 작성.
3. **n8n 워크플로우 배포**: W1~W4 워크플로우를 n8n에 임포트. 환경변수 설정. Webhook URL 확인.
4. **LobeHub 에이전트 설정**: 시스템 프롬프트 적용, Function Call 플러그인 설정, n8n webhook URL 연결.
5. **검증**: `/today`로 첫 퀘스트 생성 확인. `/preview`로 내일 예상 퀘스트가 올바른지 검증.

**Climax:** 첫 번째 `/today`에서 오늘의 퀘스트가 표시된다. `/preview`로 내일 예상 목록도 정확하다. 모든 시스템이 연결된 순간.

**Resolution:** 초기 세팅은 한 번의 노력. 이후 자동 운영. Plane.so 마일스톤 프로젝트는 민수가 직접 관리, pulse 자동화가 그 위에서 동작한다.

**Capabilities revealed:** Plane.so project/state configuration, routine bucket setup, n8n workflow deployment, LobeHub agent configuration, `/preview` verification, end-to-end connectivity test

---

### Journey 5: Automated System Operations (System Agent Path)

**Persona:** pulse 자체 — n8n cron 기반 자동화 에이전트.

**00:00 KST — W1 Daily Quest Generator:**
1. 어제의 미완료 태스크를 Deferred로 이동, defer_count 증가
2. 모든 프로젝트의 daily-routine 라벨 이슈를 스캔, 오늘 조건에 맞는 루틴을 퀘스트 프로젝트에 복사
3. DeepSeek에 컨텍스트 전달 → 추가 태스크 0~3개 제안 → 이슈 생성
4. 전체 To-Do 목록을 DeepSeek에 전달 → 시간 최적화 → 각 이슈 업데이트
5. Deferred 태스크 중 복원 가능한 것을 DeepSeek이 판단 → To-Do로 복원
6. **Observability:** 실행 결과 요약을 LobeHub에 proactive 메시지로 전송. 정상 시 무음, degraded mode 또는 실패 시 명시적 알림

**23:00 KST — W3 Daily Summary Reporter:**
1. 오늘의 완료/미완료 통계 수집
2. DeepSeek으로 피드백 메시지 생성
3. LobeHub 채팅으로 일일 리포트 전송

**일요일 00:00 KST — W4 Deferred Cleanup:**
1. defer_count >= 7인 태스크 조회
2. mandatory 여부에 따라 DeepSeek이 취소/유지 판단
3. 자동 취소 또는 유지 처리, 주간 Deferred 리포트 생성

**Capabilities revealed:** Cron scheduling, step-by-step workflow execution, per-step failure isolation, proactive LobeHub notifications, degraded mode alerting, automated reporting, cleanup policies

---

### Journey 6: Weekly Review Ritual (Primary — Reflection Path)

**Persona:** 같은 민수. 일요일 저녁, 한 주를 돌아본다.

**Opening Scene:** 일요일 21시. 민수가 `/weekly`를 입력한다. 이번 주 월~일 달성 요약이 표시된다: 평균 달성률 75%, 월요일이 가장 생산적(90%), 수요일이 가장 낮았다(55%).

**Rising Action:** `/stats 30`으로 한 달 추세를 확인한다. 특정 루틴("블로그 포스팅")이 계속 연기되고 있다 — 주 3회에서 주 1회로 줄이기로 결정. LobeHub에서 "블로그 포스팅 루틴을 주 1회 토요일로 변경해줘"라고 입력. `/brief all`로 전체 마일스톤을 점검한다 — "개발 역량" 마일스톤이 30%에서 멈춰 있어서, 관련 루틴의 duration을 늘리기로 한다.

**Climax:** 루틴을 조정한 후 `/preview`로 다음 주 월요일 예상 퀘스트를 확인한다. 조정 사항이 반영된 것을 확인.

**Resolution:** 주간 리뷰가 5~10분이면 끝난다. 데이터 기반으로 루틴을 진화시킨다 — 감이 아니라 숫자로 판단한다. 이 피드백 루프가 pulse의 장기적 가치를 증명한다.

**Capabilities revealed:** `/weekly`, `/stats`, `/brief all`, natural language routine editing, `/preview`, data-driven routine optimization

---

### Journey 7: Mid-Day Replanning (Primary — Adaptation Path)

**Persona:** 같은 민수. 오후 2시, 계획이 틀어졌다.

**Opening Scene:** 오전에 긴급 장애 대응으로 2시간을 쓴다. 오전에 예정되었던 "영어 공부"와 "코드 리뷰"를 하지 못했다.

**Rising Action:** 민수는 현재 상황에 맞게 오후를 재구성하고 싶다. `/defer`로 오늘 하기 어려운 "영어 공부"를 연기한다. `/add 장애 리포트 작성 1h`로 긴급 태스크를 추가한다. `/edit`으로 "코드 리뷰"의 시간을 저녁으로 변경한다.

**Alternative:** 상황이 완전히 바뀌었다면 `/regen`을 사용할 수 있다 — 단, Done을 제외한 모든 태스크가 재생성된다. 확인 프롬프트가 뜨므로 실수로 실행되지 않는다.

**Resolution:** `/defer` + `/add` + `/edit` 조합으로 대부분의 mid-day 변경을 세밀하게 처리할 수 있다. `/regen`은 "전면 리셋"이 필요한 극단적 상황용.

**Capabilities revealed:** `/defer`, `/add`, `/edit`, `/regen` (with confirmation), granular mid-day adjustment vs full reset

---

### Journey Requirements Summary

| Journey | Key Capabilities Required |
|---|---|
| Daily Execution | `/today`, `/complete`, `/cancel`, `/defer`, `/stats`, `/brief`, W1, schedule optimization, proactive degraded notification |
| Routine Creation | NL routine creation (LobeHub), immediate quest option, Plane.so direct (batch), `/edit`, `/preview`, `/regen` |
| System Recovery | Degraded mode, error codes, n8n SPOF handling, session timeout, Plane.so source of truth, orphan handling |
| Initial Setup | Plane.so config, n8n deployment, LobeHub setup, `/preview` verification |
| Automated Ops | W1/W3/W4 cron, per-step isolation, proactive LobeHub notifications, degraded alerting |
| Weekly Review | `/weekly`, `/stats`, `/brief all`, NL routine editing, `/preview`, data-driven optimization |
| Mid-Day Replan | `/defer` + `/add` + `/edit` granular adjust, `/regen` full reset with confirmation |

**Cross-cutting requirements revealed:**
- **`/preview`** (new command): Dry-run showing next day's expected quests — critical for routine verification
- Dual routine creation with explicit temporal difference (LobeHub=immediate option, Plane.so=batch)
- Plane.so as single source of truth for all routine data
- Proactive LobeHub notifications for overnight system events
- n8n as acknowledged SPOF with Plane.so direct access as manual fallback
- Session timeout handling with clear re-entry guidance

## Orchestration Platform Specific Requirements

### Project-Type Overview

pulse is a **workflow orchestration platform** where the primary code artifacts are n8n workflow definitions (JSON), LobeHub plugin configuration (OpenAPI-compatible), and Plane.so project structure setup. There is no custom backend application — n8n serves as both the execution engine and the API layer.

### Interface Language

All user-facing text is in **English only**:
- Bot responses, error messages, status displays
- Quest metaphor language ("Quest completed!", status labels)
- LobeHub system prompt enforces English output
- DeepSeek prompts request English responses
- Plane.so project names, state names, labels in English

### Command Set (15 Core Commands)

| Command | Description | Type |
|---|---|---|
| `/today` | Today's quest board (by state bucket) | Query |
| `/complete` | Mark quests as done (interactive) | Interactive |
| `/cancel` | Cancel quests (interactive) | Interactive |
| `/defer` | Defer quests to later (interactive) | Interactive |
| `/restore` | Restore deferred quests (interactive) | Interactive |
| `/add {name} {duration}` | Manually add a quest | Immediate |
| `/edit {target}` | Edit quest time or priority (v1 scope) | Interactive |
| `/regen` | Regenerate today's quests (with confirmation) | Confirm → Execute |
| `/brief [all]` | Milestone briefing (top 5, or all) | Query |
| `/stats {N}` | Last N days statistics | Query |
| `/weekly` | Weekly report | Query |
| `/deferred` | View all deferred quests | Query |
| `/preview` | Dry-run: tomorrow's expected quests | Query |
| `/help` | Command reference | Query |

**Nice-to-have (post-release):** `/swap`, `/memo`
**Removed by design:** `/focus` (n8n timer limitation), `/start` (unnecessary for single user)

### Technical Architecture Considerations

**Plane.so API Integration (v1):**
- All API calls target `/api/v1/` endpoints
- Authentication via API key (`PLANE_API_KEY`) in request headers
- Primary operations: issue CRUD, state transitions, label filtering, comment creation
- Rate limits: subject to Plane.so self-hosted instance capacity
- Data format: JSON request/response throughout

**Plane.so Label Management (Critical):**
- Label `daily-routine` is the routing key for the entire routine pipeline — must be exact-match, case-sensitive
- W1 must validate labels at scan time: if a label approximates but doesn't exact-match `daily-routine`, log warning: "⚠️ [LABEL_MISMATCH] Issue '{title}' has label '{label}' — did you mean 'daily-routine'?"
- `/preview` surfaces label mismatches as part of verification
- Setup guide must document exact label convention (lowercase, hyphenated)
- All Plane.so labels, project names, and state names in English

**Routine Metadata Storage:**
- Stored as JSON blocks in Plane.so issue descriptions using fenced delimiter: ` ```pulse-meta ... ``` `
- W1 validates JSON schema before processing — invalid metadata logged and skipped: "⚠️ [INVALID_ROUTINE_META] Routine '{title}' has invalid metadata — skipped"
- Plane.so is single source of truth — any direct edits in Plane.so take precedence over LobeHub-originated data
- If source routine is deleted in Plane.so, existing today's quests persist but no new quests generated

**n8n Workflow Architecture:**
- 4 workflow definitions exported as JSON templates for portability
- Webhook nodes handle synchronous LobeHub command requests
- Cron trigger nodes handle scheduled automation (W1, W3, W4)
- Environment variables for all secrets and configuration
- Max routine scan ceiling: ~100 issues per W1 run to prevent execution timeouts

**Conversation State Management (Design Decision):**
- Interactive commands (`/complete`, `/cancel`, `/defer`, `/restore`, `/edit`) require multi-turn exchanges
- **LobeHub's LLM conversation memory** serves as session state — n8n remains fully stateless
- Each n8n webhook call is self-contained; LobeHub's system prompt instructs the LLM to include resolved context (specific issue IDs) in the follow-up call
- Timeout handling: implicit via LobeHub conversation context window — stale context naturally expires

**LobeHub Plugin Integration:**
- OpenAPI-compatible plugin definition targeting n8n webhook endpoints
- Single `quest_command` function with `action`, `target`, `params` parameters
- System prompt defines persona, tone, interactive behavior rules, and English-only output
- Plugin registered via LobeHub's Custom Plugins interface

### Communication Pattern

| Pattern | Use Case | Mechanism |
|---|---|---|
| **Synchronous request-response** | All slash commands | LobeHub → n8n webhook → process → respond |
| **Scheduled push** | Daily quest generation, daily summary, weekly cleanup | n8n cron → process → LobeHub webhook callback |
| **Interactive session** | `/complete`, `/cancel`, `/defer`, `/restore`, `/edit` | Multi-turn via LobeHub LLM conversation memory; n8n stateless |

### Data Flow & Source of Truth

- **Plane.so** is the single source of truth for all routine and quest data
- **n8n** is the orchestration engine — fully stateless, no persistent data
- **LobeHub** is a pure presentation layer — no data storage
- **Routine metadata** stored as ` ```pulse-meta``` ` JSON blocks in Plane.so issue descriptions

### Workflow Template Portability

- All 4 workflows (W1-W4) exported as n8n JSON templates
- Environment variables externalized for easy configuration
- Template includes: node configurations, webhook paths, credential placeholders
- Import process: n8n UI → Import from File → configure environment variables → activate

## Project Scoping & Phased Development

### MVP Strategy & Philosophy

**Approach:** Single-release, full-feature deployment. No phased rollout — all capabilities ship together. This is a personal productivity tool for a single user who is also the developer; the fastest path to value is a complete system that works end-to-end on day one.

**Resource:** Solo developer with existing self-hosted infrastructure (Plane.so, LobeHub, n8n already operational).

**Development Rhythm:** Treat priority tiers as internal milestones. After completing Priority 1, use the system for a week before building further. Build → use → build more. This gives real feedback on the daily loop, confirms the foundation is solid, and maintains motivation through a working product.

### Implementation Priority Order

All features ship together, but implementation follows a dependency chain. If scope pressure arises, cut from the bottom up:

**Priority 1 — Foundation (must work first):**
- Plane.so project structure: quest project, states, labels, routine buckets
- W1 Steps 1-2: deferred handling + deterministic routine copy
- Core commands: `/today`, `/complete`, `/cancel`, `/defer`, `/add`
- LobeHub agent + n8n webhook connectivity
- `pulse-meta` JSON block parsing and validation
- Interactive command flow via LobeHub conversation memory (n8n stays stateless)

**Priority 2 — Core Loop (must work second):**
- Query commands: `/brief`, `/stats`, `/deferred`, `/preview`, `/help`
- W3: daily-summary-reporter (23:00 KST)
- Proactive degraded mode notifications
- Label validation and mismatch warnings

**Priority 3 — AI Layer (must work third):**
- W1 Steps 3-5: DeepSeek task generation, schedule optimization, deferred restoration
- Natural language intent classification
- Natural language routine creation via LobeHub

**Priority 4 — Polish (must work last):**
- `/regen`, `/edit`, `/restore`, `/weekly`
- W4: deferred-cleanup (weekly)
- Error taxonomy completeness

### Testing Strategy

- **DRY_RUN mode:** Environment variable `DRY_RUN=true` makes W1 log all actions (issue creation, state transitions, LLM calls) without executing them. Cheap to implement, critical safety net for workflow changes.
- **`/preview` as debugging tool:** In addition to showing tomorrow's expected quests, `/preview` validates current routine configuration — surfacing label mismatches, invalid metadata, and missing fields.
- **Test project:** Dedicated test project in Plane.so with known routines and expected outputs for manual verification after workflow changes.

### Risk Mitigation Strategy

**Technical Risks:**

| Risk | Impact | Mitigation |
|---|---|---|
| n8n execution timeout on large routine scans | W1 fails silently | Cap at ~100 routines per scan; log execution time |
| DeepSeek API instability | LLM features unavailable | Degraded mode: Steps 3-5 skip cleanly, core pipeline unaffected |
| Plane.so API breaking changes | All operations fail | Pin to v1 API; monitor Plane.so release notes |
| JSON metadata corruption in issue descriptions | Routine silently skipped | Schema validation + clear error logging per routine |
| n8n single point of failure | Entire system down | Plane.so direct access as manual fallback; Docker restart guide |
| n8n workflow regression | Silent behavior change | DRY_RUN toggle + `/preview` validation + test project |

**Operational Risks:**

| Risk | Impact | Mitigation |
|---|---|---|
| Routine misconfiguration (wrong label, bad JSON) | Quests not generated | `/preview` verification; label mismatch warnings; validation errors |
| Environment variable misconfiguration | Silent failures | Startup validation workflow that tests all connections |
| Solo dev motivation stall | Project abandoned mid-build | Internal milestone rhythm: build P1 → use 1 week → build P2 → etc. |

## Functional Requirements

### Quest Generation & Lifecycle

- FR1: System can automatically generate daily quests from routine definitions at scheduled time (00:00 KST)
- FR2: System can detect and copy qualifying routine issues (by label, schedule rules, active dates, cooldown) from long-term projects to the quest project
- FR3: System can automatically move yesterday's incomplete quests to Deferred state with defer_count increment
- FR4: System can request LLM to generate 0-3 additional task suggestions based on current context
- FR5: System can request LLM to optimize quest scheduling (time slots, priority ordering, rest breaks)
- FR6: System can request LLM to evaluate deferred quests for restoration based on available capacity
- FR7: System can operate in degraded mode when LLM is unavailable, completing deterministic steps without LLM
- FR8: System can proactively notify the user via LobeHub when operating in degraded mode
- FR9: System can enforce a maximum routine scan limit per generation run
- FR10: System can handle deleted source routines gracefully — existing quests persist, no new quests generated from deleted sources

### Routine Management

- FR11: User can create routines via LobeHub natural language with immediate quest generation option
- FR12: User can create routines directly in Plane.so with `daily-routine` label and routine metadata block
- FR13: System can detect new `daily-routine` labeled issues in Plane.so during scheduled generation
- FR14: User can edit routine properties (time, priority, schedule) via `/edit` command (scoped to time and priority for v1)
- FR15: System can validate routine metadata integrity before processing and log clear errors for invalid entries
- FR16: System can detect and warn about label near-mismatches to `daily-routine`

### Daily Quest Interaction

- FR17: User can view today's complete quest board grouped by state via `/today`
- FR18: User can mark quests as completed via `/complete` (interactive selection)
- FR19: User can cancel quests via `/cancel` (interactive selection)
- FR20: User can defer quests via `/defer` (interactive selection with defer_count tracking)
- FR21: User can restore deferred quests to today's To-Do via `/restore`
- FR22: User can manually add ad-hoc quests with name and duration via `/add`
- FR23: User can regenerate today's quests (excluding Done) via `/regen` with confirmation prompt
- FR24: System can warn when a quest has been deferred 3+ times

### Reporting & Analytics

- FR25: User can view milestone briefing (top 5 by D-Day) via `/brief`
- FR26: User can view all milestones across all projects via `/brief all`
- FR27: User can view N-day statistics (completion rates, patterns, streaks) via `/stats`
- FR28: User can view weekly summary with day-by-day breakdown via `/weekly`
- FR29: User can view all currently deferred quests via `/deferred`
- FR30: User can preview next day's expected quest generation and validate routine configuration via `/preview`
- FR31: System can generate and send daily summary report at 23:00 KST via LobeHub

### Natural Language Processing

- FR32: System can classify natural language input into command intents via LLM with configurable confidence threshold
- FR33: System can request user clarification when intent confidence is below configured threshold
- FR34: System can handle natural language routine creation and editing requests with confirmation flow
- FR35: System can fall back to literal command parsing when LLM is unavailable

### Automated Maintenance

- FR36: System can automatically clean up quests deferred 7+ times via weekly workflow
- FR37: System can distinguish mandatory vs non-mandatory routines for cleanup decisions
- FR38: System can generate weekly deferred task report

### Error Handling & Observability

- FR39: System can return specific, documented error codes for all failure paths
- FR40: System can retry failed Plane.so API calls before reporting failure
- FR41: System can retry failed LLM API calls before falling back to degraded mode
- FR42: System can detect n8n unreachability and display clear error via LobeHub agent
- FR43: System can validate all environment variables and connections on startup

### System Configuration & Setup

- FR44: Operator can import n8n workflow templates (W1-W4) from JSON files
- FR45: Operator can configure system via environment variables (API keys, URLs, user preferences)
- FR46: Operator can register LobeHub plugin via OpenAPI-compatible definition
- FR47: Operator can enable DRY_RUN mode for safe workflow testing
- FR48: User can view command reference via `/help`

### Cross-Cutting

- FR49: All system-generated user-facing output (responses, errors, reports, notifications) must be in English

## Non-Functional Requirements

### Performance

**Command Response Times (two tiers):**
- Simple commands (`/today`, `/complete`, `/cancel`, `/defer`, `/add`, `/restore`, `/help`): within 5 seconds
- Analytical commands (`/stats`, `/brief`, `/brief all`, `/weekly`, `/preview`): within 15 seconds
- Show "processing..." indicator for any command expected to take >3 seconds

**W1 Daily Quest Generation (tiered):**
- Steps 1-2 (deterministic: deferred handling + routine copy): within 60 seconds
- Steps 3-5 (LLM: task generation + optimization + deferred restoration): within 5 minutes, with per-step timeout at 60 seconds
- Total LLM budget per W1 run: 3 minutes max — if exceeded, remaining LLM steps are skipped (partial degraded mode)
- Total W1 worst case: within 6 minutes — still 6+ hours before default wake time (07:00 KST)

**Other:**
- `/preview` dry-run: within 30 seconds
- DeepSeek API timeout: 30 seconds per individual request

### Security

- All API keys (Plane.so, DeepSeek) stored exclusively in environment variables, never in workflow definitions or code
- n8n webhook endpoints secured with API key or HMAC signature verification
- All LobeHub → n8n communication over HTTPS
- No sensitive data logged in n8n execution logs (API keys masked)

### Reliability

- W1 (00:00 KST) must execute successfully >99% of days — a missed run means the user has no quests
- W3 (23:00 KST) and W4 (weekly) failures are non-critical but must be logged
- Each W1 step must be independently recoverable — failure at Step 3 must not prevent Steps 1-2 completion
- n8n Docker container must auto-restart on crash (Docker restart policy: `unless-stopped`)
- Degraded mode must be fully functional — the system is usable without LLM indefinitely

### Integration

- Plane.so API v1 compatibility required; no dependency on undocumented or beta endpoints
- DeepSeek API accessed via OpenAI-compatible interface (n8n OpenAI node with custom base URL)
- LobeHub plugin must conform to OpenAPI-compatible plugin specification
- n8n webhook endpoints must accept and return JSON with consistent response schema
- All integrations must handle network timeouts gracefully with user-visible error messages

### Maintainability

- Each n8n workflow node must have a descriptive name reflecting its purpose (not default names like "HTTP Request 1")
- Each workflow must include a sticky note documenting: purpose, trigger, inputs/outputs, dependencies on other workflows
- All environment variables must follow `PULSE_` prefix convention (e.g., `PULSE_PLANE_API_KEY`, `PULSE_DEEPSEEK_MODEL`)
- Error messages must include originating workflow and step for debugging (e.g., "[W1-STEP3] DeepSeek timeout after 30s")

### Logging & Observability

- Each W1 execution must log: start time, steps completed, steps skipped, issues created count, errors encountered, total execution time
- Each LLM call must log: step origin, request duration, success/failure, token usage (if available)
- Failed workflow executions must be visually distinguishable in n8n execution history
- Logs must be sufficient to diagnose "why are my quests wrong this morning?" from n8n UI alone — no external logging infrastructure required for v1

