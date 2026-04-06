### 1. Epic Dev

Epic {N}의 모든 스토리를 순서대로 구현해줘.

참고 파일:
- 에픽/스토리 정의: _bmad-output/planning-artifacts/epics.md
- 아키텍처: _bmad-output/planning-artifacts/architecture.md
- PRD: _bmad-output/planning-artifacts/prd.md
- 스프린트 상태: _bmad-output/implementation-artifacts/sprint-status.yaml

진행 규칙:
1. sprint-status.yaml에서 Epic {N}의 스토리 목록을 확인하고, backlog 상태인 스토리부터 순서대로 진행
2. 각 스토리 시작 시 sprint-status.yaml 상태를 in-progress로 업데이트
3. 각 스토리 완료 시 sprint-status.yaml 상태를 done으로 업데이트
4. Epic의 첫 스토리 시작 시 epic-{N} 상태도 in-progress로 변경
5. 모든 스토리 완료 후 epic-{N} 상태를 done으로 변경
6. 스토리 하나 완료할 때마다 커밋 생성 (스토리 키를 커밋 메시지에 포함)
7. 이미 done인 스토리는 건너뛰기

### 2. Epic Code Review

Epic {N}의 구현 코드를 리뷰해줘.

참고 파일:
- 에픽/스토리 정의: _bmad-output/planning-artifacts/epics.md
- 아키텍처: _bmad-output/planning-artifacts/architecture.md
- PRD: _bmad-output/planning-artifacts/prd.md

리뷰 기준:
1. 각 스토리의 Acceptance Criteria 충족 여부 검증
2. 아키텍처 문서의 규칙/패턴 준수 여부 확인
3. 코드 품질: 보안 취약점, 에러 처리, 엣지 케이스
4. 스토리 간 일관성 (네이밍, 응답 포맷, 에러 코드 등)
5. 누락된 구현이나 스펙과 다른 부분 식별

출력 형식:
- 스토리별로 그룹핑하여 발견 사항 정리
- 각 항목을 severity로 분류: 🔴 critical / 🟠 major / 🟡 minor / 🔵 suggestion
- 마지막에 수정이 필요한 항목만 체크리스트로 요약


### 3. Epic Fix

Epic {N} 코드 리뷰에서 발견된 아래 항목들을 수정해줘.

참고 파일:
- 에픽/스토리 정의: _bmad-output/planning-artifacts/epics.md
- 아키텍처: _bmad-output/planning-artifacts/architecture.md
- 스프린트 상태: _bmad-output/implementation-artifacts/sprint-status.yaml

[여기에 코드 리뷰 결과의 수정 체크리스트를 붙여넣기]

진행 규칙:
1. critical → major → minor 순서로 수정
2. 수정할 때 기존 동작을 깨뜨리지 않도록 주의
3. 관련된 항목은 묶어서 한 커밋으로 처리
4. 모든 수정 완료 후 커밋 생성