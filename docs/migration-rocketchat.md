# LobeHub → Rocket.Chat 마이그레이션 스펙

## 1. 개요

### 1.1 목적

기존 LobeHub 기반 채팅 인터페이스를 Rocket.Chat으로 교체한다. 핵심 비즈니스 로직(n8n 워크플로우, Plane.so 연동, DeepSeek LLM)은 그대로 유지하며, 유저 인터페이스 레이어만 변경한다.

### 1.2 변경 범위

| 영역 | 변경 유형 | 설명 |
|---|---|---|
| 채팅 인터페이스 | **교체** | LobeHub → Rocket.Chat |
| 커맨드 입력 방식 | **변경** | LLM Function Call → Trigger Word 기반 Outgoing Webhook |
| 응답 포맷 | **변경** | JSON 구조체 (LLM 해석) → 마크다운 텍스트 (직접 표시) |
| 알림 푸시 | **변경** | LobeHub Webhook → RC REST API `chat.postMessage` |
| AI 에이전트 | **교체** | LobeHub 내장 LLM → RC OpenAI-compatible 설정 (DeepSeek) |
| 인터랙티브 세션 | **변경** | 2-턴 대화 → 원커맨드 방식 |

### 1.3 변경되지 않는 영역

- n8n 워크플로우 핵심 로직 (W1 퀘스트 생성, W3 리포팅, W4 클린업)
- Plane.so 연동 전체
- DeepSeek LLM 연동 (프롬프트, API 호출)
- `schemas/` (pulse-meta 스키마)
- `src/pulse-meta.js`, `src/error-codes.js`
- 17개 커맨드의 비즈니스 로직 자체

---

## 2. 아키텍처 변경

### 2.1 AS-IS (LobeHub)

```
[유저] → [LobeHub LLM Agent]
            ├── 자연어 해석 (NL → Function Call)
            └── quest_command(action, target, params)
                    │
                    ▼
            [n8n Webhook: POST /webhook/pulse-command]
                    │
                    ▼
            [n8n W2: Command Handler]
             /              \
    [Plane.so API]    [DeepSeek API]
             \              /
            [JSON Response]
                    │
                    ▼
            [LobeHub LLM Agent] → 응답 해석/포맷 → [유저]
```

### 2.2 TO-BE (Rocket.Chat)

```
[유저] → [Rocket.Chat 채널: #pulse-quests]
            │
            ├── (A) 슬래시 커맨드: "!pulse today"
            │       │
            │       ▼
            │   [RC Outgoing Webhook]
            │       │
            │       ▼
            │   [n8n Webhook: POST /webhook/pulse-command]
            │       │
            │       ▼
            │   [n8n W2: Command Handler]
            │    /              \
            │   [Plane.so API]  [DeepSeek API]
            │    \              /
            │   [마크다운 텍스트 응답] → [RC 채널에 직접 표시]
            │
            └── (B) AI Agent (선택, RC 앱 단 설정)
                    │
                    ▼
                [RC OpenAI-compatible → DeepSeek API]
                    │
                    ▼
                [자연어 → 커맨드 변환 → Outgoing Webhook → n8n]
```

### 2.3 핵심 차이점

1. **LLM 에이전트 위치 이동**: n8n 바깥(LobeHub) → n8n 바깥(RC 앱 단)
2. **응답 해석 주체 제거**: LobeHub LLM이 JSON을 해석/포맷하던 역할 제거 → n8n이 마크다운을 직접 생성
3. **인터랙티브 세션 제거**: 2-턴 대화 불필요 → 원커맨드로 모든 동작 완결

---

## 3. Rocket.Chat 인프라 설정

### 3.1 Bot 계정

| 항목 | 값 |
|---|---|
| Username | `pulse-bot` |
| Role | `bot` |
| Display Name | `pulse Quest Manager` |

### 3.2 채널

| 항목 | 값 |
|---|---|
| 채널명 | `#pulse-quests` |
| 유형 | Private Channel |
| 멤버 | 유저 + `pulse-bot` |

### 3.3 Outgoing Webhook 설정

| 항목 | 값 |
|---|---|
| Event Trigger | Message Sent |
| Channel | `#pulse-quests` |
| Trigger Words | `!pulse` |
| URLs | `https://n8n.eli.kr/webhook/pulse-command` |
| Token | `{PULSE_ROCKETCHAT_WEBHOOK_TOKEN}` (검증용) |
| Post as | `pulse-bot` |

### 3.4 AI Agent 설정 (RC 앱 단, 선택)

Rocket.Chat의 OpenAI-compatible API 설정으로 DeepSeek를 연결한다:

| 항목 | 값 |
|---|---|
| API Base URL | `https://api.deepseek.com/v1` |
| API Key | `{PULSE_DEEPSEEK_API_KEY}` |
| Model | `deepseek-chat` |
| 용도 | 자연어 입력을 `!pulse {command}` 형태로 변환 |

> RC 앱 단에서 OpenAI-compatible API를 직접 연동하므로, 별도 봇 프로세스나 미들웨어 불필요.

---

## 4. 커맨드 인터페이스 변경

### 4.1 커맨드 형식

**AS-IS (LobeHub):**
- 자연어: "오늘 퀘스트 보여줘" → LLM이 `quest_command(action: "today")` 호출
- 슬래시: `/today` → LLM이 해석하여 Function Call

**TO-BE (Rocket.Chat):**
- Trigger Word: `!pulse today` → Outgoing Webhook → n8n
- AI Agent 경유 (선택): "오늘 퀘스트 보여줘" → RC AI → `!pulse today` → Webhook → n8n

### 4.2 커맨드 매핑

| 기존 (LobeHub) | 변경 후 (RC) | 비고 |
|---|---|---|
| `/today` | `!pulse today` | |
| `/complete` (2-턴) | `!pulse complete 1,3` | 원커맨드 (번호 필수) |
| `/complete` (목록만) | `!pulse complete` | 번호 없으면 목록만 표시 |
| `/cancel` (2-턴) | `!pulse cancel 2` | 원커맨드 |
| `/defer` (2-턴) | `!pulse defer 1-3` | 원커맨드 |
| `/restore` (2-턴) | `!pulse restore 1,2` | 원커맨드 |
| `/edit` (2-턴) | `!pulse edit 3 time 14:00` | 원커맨드 (필드+값 직접 지정) |
| `/add {name} {dur}` | `!pulse add 장보기 45m` | 동일 |
| `/regen` | `!pulse regen` | 확인 절차 변경 (아래 참고) |
| `/brief` | `!pulse brief` | |
| `/brief all` | `!pulse brief all` | |
| `/stats {N}` | `!pulse stats 7` | |
| `/deferred` | `!pulse deferred` | |
| `/preview` | `!pulse preview` | |
| `/weekly` | `!pulse weekly` | |
| `/help` | `!pulse help` | |
| `/ping` | `!pulse ping` | |
| `/classify` | **삭제** | RC AI Agent로 대체 |
| `/create_routine` (NL) | `!pulse routine ...` | 명시적 파라미터 방식으로 변경 |

### 4.3 인터랙티브 커맨드 → 원커맨드 변환

기존 2-턴 인터랙션을 1-턴으로 통합한다:

**기존 (LobeHub, 2-턴):**
```
유저: /complete
봇:   1. 아침 운동  2. 영어 공부  3. 코드 리뷰
      번호를 입력하세요:
유저: 1,3
봇:   ✅ 2개 완료!
```

**변경 후 (RC, 1-턴):**
```
유저: !pulse complete 1,3
봇:   ✅ 2개 퀘스트 완료!
      • 아침 운동 ✓
      • 코드 리뷰 ✓
      🎯 오늘 진행률: 4/8 (50%)
```

번호를 모를 때:
```
유저: !pulse complete
봇:   📝 완료 가능한 퀘스트:
      1. 🔴 아침 운동 — 07:00 (30분)
      2. 🟡 영어 공부 — 09:00 (45분)
      3. 🟠 코드 리뷰 — 14:00 (60분)
      
      👉 `!pulse complete 1,3` 또는 `!pulse complete 1-3` 으로 완료하세요.
```

### 4.4 `/regen` 확인 절차 변경

2-턴 확인 대화 불가하므로, 플래그 방식으로 변경:

```
유저: !pulse regen
봇:   ⚠️ Done을 제외한 오늘의 모든 퀘스트가 삭제 후 재생성됩니다.
      확인하려면: `!pulse regen confirm`

유저: !pulse regen confirm
봇:   🔄 퀘스트 재생성 완료! (아래 /today 결과)
      ...
```

### 4.5 `/routine` 커맨드 (기존 `/create_routine` 대체)

자연어 파싱 대신 명시적 파라미터:

```
!pulse routine add "아침 명상" daily 06:30 15m high
!pulse routine add "주간 회고" weekly mon,fri 18:00 30m medium
!pulse routine list
!pulse routine delete {routine_id}
```

파라미터:
```
!pulse routine add "{이름}" {유형} [요일] {시간} {소요시간} {우선순위}
  - 유형: daily | weekly | custom
  - 요일: mon,tue,wed,thu,fri,sat,sun (weekly/custom만)
  - 시간: HH:MM
  - 소요시간: Nm 또는 Nh (예: 30m, 1h30m)
  - 우선순위: urgent | high | medium | low
```

---

## 5. W2 커맨드 핸들러 변경

### 5.1 입력 페이로드 변환

**AS-IS (LobeHub → n8n):**
```json
{
  "action": "complete",
  "target": "1,3",
  "params": {}
}
```

**TO-BE (RC Outgoing Webhook → n8n):**
```json
{
  "token": "webhook-token",
  "channel_id": "CHANNEL_ID",
  "channel_name": "pulse-quests",
  "user_id": "USER_ID",
  "user_name": "nhn",
  "text": "!pulse complete 1,3",
  "trigger_word": "!pulse"
}
```

### 5.2 텍스트 파서 (신규)

n8n W2 진입부에 텍스트 파싱 레이어를 추가한다:

```javascript
// RC Outgoing Webhook payload에서 커맨드 추출
function parseRocketChatCommand(payload) {
  const text = payload.text.trim();
  // trigger word 제거: "!pulse complete 1,3" → "complete 1,3"
  const withoutTrigger = text.replace(/^!pulse\s*/i, '').trim();
  
  if (!withoutTrigger) {
    return { action: 'today', target: null, params: {} };
  }
  
  const parts = withoutTrigger.split(/\s+/);
  const action = parts[0].toLowerCase();
  const rest = parts.slice(1).join(' ');
  
  // 액션별 파싱
  switch (action) {
    case 'complete':
    case 'cancel':
    case 'defer':
    case 'restore':
      return { action, target: rest || null, params: {} };
    
    case 'add':
      // "장보기 45m" → name="장보기", duration="45m"
      return parseAddCommand(rest);
    
    case 'edit':
      // "3 time 14:00" → target="3", params={ field: "time", value: "14:00" }
      return parseEditCommand(rest);
    
    case 'stats':
      return { action, target: null, params: { days: parseInt(rest) || 7 } };
    
    case 'brief':
      return { action, target: rest === 'all' ? 'all' : null, params: {} };
    
    case 'regen':
      return { action, target: rest === 'confirm' ? 'confirm' : null, params: {} };
    
    case 'routine':
      return parseRoutineCommand(rest);
    
    default:
      return { action, target: rest || null, params: {} };
  }
}
```

### 5.3 인증 변경

**AS-IS:**
```
Header: X-API-Key: {PULSE_N8N_WEBHOOK_SECRET}
```

**TO-BE:**
```
Body field: token === {PULSE_ROCKETCHAT_WEBHOOK_TOKEN}
```

### 5.4 응답 포맷 변경

**AS-IS (JSON → LobeHub LLM이 해석):**
```json
{
  "response_type": "quest_board",
  "message": "📋 2026-04-07 (Mon) Today's Quests\n...",
  "data": { "total": 8, "by_state": { ... } },
  "suggestions": ["Try /complete to mark quests done"],
  "awaiting_input": false
}
```

**TO-BE (마크다운 텍스트 → RC에 직접 표시):**
```json
{
  "text": "📋 2026-04-07 (Mon) Today's Quests\n\n📋 **To-Do** (4)\n  🔴 아침 운동 — 07:00 (30분)\n  🟡 영어 공부 — 09:00 (45분)\n  ...\n\n💡 `!pulse complete 1,3` 으로 완료 처리하세요."
}
```

> RC Outgoing Webhook 응답은 `{ "text": "..." }` 형태로 반환하면 RC가 채널에 표시한다.

---

## 6. response-formatter.js 변경

### 6.1 변경 방향

- `buildResponse()`: JSON 구조체 대신 `{ text: string }` 반환
- `formatQuestBoard()`: `data` 필드 제거, 마크다운 텍스트만 생성
- `formatInteractiveList()`: `awaiting_input` 제거, 힌트 메시지(`!pulse {action} 1,3`)를 텍스트에 포함
- `buildError()`, `buildSuccess()`: `text` 필드만 반환

### 6.2 RC 마크다운 지원 범위

| 포맷 | 지원 | 문법 |
|---|---|---|
| 굵게 | O | `*bold*` 또는 `**bold**` |
| 기울임 | O | `_italic_` |
| 취소선 | O | `~strikethrough~` |
| 인라인 코드 | O | `` `code` `` |
| 코드 블록 | O | ` ```lang\ncode\n``` ` |
| 링크 | O | `[text](url)` |
| 인용 | O | `> quoted text` |
| 비순서 목록 | O | `- item` |
| 순서 목록 | O | `1. item` |
| **테이블** | **X** | 미지원 — 코드 블록 또는 목록으로 대체 |
| 멘션 | O | `@username`, `@all`, `@here` |

### 6.3 테이블 대체 전략

기존 `/stats` 등에서 테이블을 사용하던 부분은 코드 블록으로 대체:

```
📊 최근 7일 통계

`03/31 (월) ██████████ 90% (9/10)`
`04/01 (화) ████████░░ 80% (8/10)`
`04/02 (수) ██████░░░░ 60% (6/10) ← 최저`
```

### 6.4 Attachments 활용 (선택)

RC는 `attachments` 필드를 지원하여 색상 강조가 가능하다:

```json
{
  "text": "📋 오늘의 퀘스트",
  "attachments": [
    {
      "title": "📋 To-Do (4)",
      "text": "🔴 아침 운동 — 07:00 (30분)\n🟡 영어 공부 — 09:00 (45분)",
      "color": "#2196F3"
    },
    {
      "title": "✅ Done (2)",
      "text": "🟡 명상 — 06:30 (15분) ✓\n🟢 물 마시기 — (5분) ✓",
      "color": "#4CAF50"
    }
  ]
}
```

---

## 7. 알림 푸시 변경 (W1, W3, W4, W5)

### 7.1 AS-IS

```
n8n HTTP Request Node:
  POST {PULSE_LOBEHUB_WEBHOOK_URL}
  Header: X-API-Key: {PULSE_LOBEHUB_API_KEY}
  Body: { "message": "..." }
```

### 7.2 TO-BE

```
n8n HTTP Request Node:
  POST {PULSE_ROCKETCHAT_URL}/api/v1/chat.postMessage
  Headers:
    X-Auth-Token: {PULSE_ROCKETCHAT_AUTH_TOKEN}
    X-User-Id: {PULSE_ROCKETCHAT_USER_ID}
    Content-Type: application/json
  Body:
    {
      "channel": "{PULSE_ROCKETCHAT_CHANNEL}",
      "text": "...",
      "alias": "pulse Bot",
      "emoji": ":clipboard:"
    }
```

### 7.3 워크플로우별 알림 내용

| 워크플로우 | 알림 시점 | 내용 |
|---|---|---|
| W1 | 매일 00:00 퀘스트 생성 후 | "📋 오늘의 퀘스트가 생성되었습니다! `!pulse today`로 확인하세요." |
| W3 | 매일 23:00 일일 리포트 | 달성률, 미완료 목록, DeepSeek 코멘트 |
| W4 | 매주 일요일 클린업 후 | 자동 취소된 퀘스트 목록, 루틴 조정 제안 |
| W5 | 에러 발생 시 | 에러 코드, 영향 범위, 복구 상태 |

---

## 8. 환경 변수 변경

### 8.1 삭제

```env
# --- LobeHub --- (삭제)
PULSE_LOBEHUB_WEBHOOK_URL=...
PULSE_LOBEHUB_API_KEY=...

# --- NL Classification --- (삭제)
PULSE_CLASSIFY_CONFIDENCE_THRESHOLD=...
PULSE_CLASSIFY_TIMEOUT_MS=...
```

### 8.2 추가

```env
# --- Rocket.Chat ---
PULSE_ROCKETCHAT_URL=https://chat.eli.kr
PULSE_ROCKETCHAT_USER_ID=pulse-bot-user-id
PULSE_ROCKETCHAT_AUTH_TOKEN=pulse-bot-auth-token
PULSE_ROCKETCHAT_CHANNEL=#pulse-quests
PULSE_ROCKETCHAT_WEBHOOK_TOKEN=outgoing-webhook-token
```

### 8.3 유지

```env
# 변경 없음
PULSE_PLANE_API_KEY=...
PULSE_PLANE_BASE_URL=...
PULSE_PLANE_WORKSPACE_SLUG=...
PULSE_DAILY_QUEST_PROJECT_ID=...
PULSE_STATE_*_ID=...
PULSE_LABEL_DAILY_ROUTINE_ID=...
PULSE_DEEPSEEK_API_KEY=...
PULSE_DEEPSEEK_BASE_URL=...
PULSE_DEEPSEEK_MODEL=...
PULSE_N8N_WEBHOOK_SECRET=...
PULSE_USER_TIMEZONE=...
PULSE_DRY_RUN=...
```

---

## 9. 파일 변경 목록

### 9.1 삭제

| 파일 | 사유 |
|---|---|
| `lobehub/plugin-manifest.json` | LobeHub 전용 플러그인 매니페스트 |
| `workflows/w6-manifest-server.json` | 매니페스트 서빙 워크플로우 |
| `prompts/lobehub-system-prompt.md` | LobeHub LLM 에이전트 시스템 프롬프트 |
| `prompts/w2-intent-classification.md` | NL 인텐트 분류 프롬프트 (`/classify` 제거) |

### 9.2 수정

| 파일 | 변경 내용 |
|---|---|
| `workflows/w2-lobehub-command-handler.json` | 파일명 변경 → `w2-command-handler.json`, 입력 파싱/인증/응답 포맷 변경 |
| `workflows/w1-daily-quest-generator.json` | 알림 푸시를 RC REST API로 변경 |
| `workflows/w3-daily-summary-reporter.json` | 알림 푸시를 RC REST API로 변경 |
| `workflows/w4-weekly-deferred-cleanup.json` | 알림 푸시를 RC REST API로 변경 |
| `workflows/w5-error-handler.json` | 알림 푸시를 RC REST API로 변경 |
| `workflows/w0-environment-validator.json` | LobeHub 연결 테스트 → RC 연결 테스트로 변경 |
| `src/response-formatter.js` | JSON 구조체 → `{ text }` 마크다운 직접 반환 |
| `.env.example` | LobeHub 변수 삭제, RC 변수 추가 |
| `.env` | 동일 |

### 9.3 신규

| 파일 | 설명 |
|---|---|
| `src/rocketchat-parser.js` | RC Outgoing Webhook 페이로드 파싱 (`text` → `action/target/params`) |

---

## 10. 구현 순서

### Phase 1: RC 인프라 설정
1. Rocket.Chat Bot 계정 생성 (`pulse-bot`)
2. `#pulse-quests` 채널 생성
3. Outgoing Webhook 설정 (trigger word: `!pulse`)
4. RC OpenAI-compatible 설정으로 DeepSeek 연결 (AI Agent)

### Phase 2: W2 입력 레이어 변경
5. `src/rocketchat-parser.js` 작성 (텍스트 → action/target/params 파서)
6. W2 Webhook 진입부: RC payload 파싱 레이어 추가
7. W2 인증: `X-API-Key` → RC `token` 필드 검증으로 변경
8. `/classify` 커맨드 브랜치 제거
9. 인터랙티브 커맨드 → 원커맨드 방식 변경 (`/complete`, `/cancel`, `/defer`, `/restore`, `/edit`)
10. `/create_routine` → `!pulse routine add ...` 명시적 파라미터 방식으로 변경
11. `/regen` 확인 절차: `!pulse regen` → `!pulse regen confirm` 2단계

### Phase 3: 출력 레이어 변경
12. `src/response-formatter.js` 수정: `{ text }` 마크다운 직접 반환
13. RC 마크다운 호환성 적용 (테이블 → 코드 블록, attachments 활용)
14. 모든 W2 커맨드 브랜치의 응답을 새 포맷으로 변경

### Phase 4: 알림 푸시 변경
15. W1, W3, W4, W5의 LobeHub 알림 → RC `chat.postMessage` API 호출로 변경
16. W0 환경 검증: LobeHub 연결 테스트 → RC 연결 테스트로 변경

### Phase 5: 정리
17. `lobehub/` 디렉토리 삭제
18. `workflows/w6-manifest-server.json` 삭제
19. `prompts/lobehub-system-prompt.md` 삭제
20. `prompts/w2-intent-classification.md` 삭제
21. W2 워크플로우 파일명: `w2-lobehub-command-handler.json` → `w2-command-handler.json`
22. `.env.example`, `.env` 업데이트
23. `docs/start.spec.md` 내 LobeHub 참조 업데이트 (또는 별도 RC 스펙 작성)

---

## 11. 하위 호환성 및 롤백

### 11.1 하위 호환성

- n8n W2 webhook URL(`/webhook/pulse-command`)은 유지한다.
- 내부 커맨드 라우팅 로직은 동일하므로, 파서 레이어만 교체하면 된다.
- `PULSE_N8N_WEBHOOK_SECRET`은 유지하되, RC 외부 직접 호출 시 사용한다.

### 11.2 롤백 계획

1. 모든 변경은 별도 브랜치에서 진행한다.
2. LobeHub 설정은 RC 마이그레이션 완료 확인 후에만 제거한다.
3. 전환 기간 동안 양쪽 인터페이스를 동시 운영할 수 있다:
   - n8n W2에서 입력 소스(LobeHub JSON / RC text)를 자동 감지하는 분기 추가
