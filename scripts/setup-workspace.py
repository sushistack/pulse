#!/usr/bin/env python3
"""
pulse - Plane.so Full Workspace Setup
======================================
plane-structure.md 스펙에 따라 전체 워크스페이스를 구성합니다.

생성 항목:
  - 프로젝트 6개 (P1~P5 + Daily Quests)
  - Daily Quests 프로젝트: States 5개, 추적용 Labels 8개
  - 각 프로젝트: daily-routine Label, Modules, Cycles
  - 각 프로젝트: 루틴 이슈 (pulse-meta 포함), 백로그 이슈
  - .env 업데이트용 ID 출력

Prerequisites:
  - pip install requests python-dotenv
  - .env 파일에 PULSE_PLANE_API_KEY, PULSE_PLANE_BASE_URL, PULSE_PLANE_WORKSPACE_SLUG 설정

Usage:
  python scripts/setup-workspace.py
  python scripts/setup-workspace.py --dry-run
"""

import argparse
import json
import os
import sys
import time
from datetime import date
from pathlib import Path

import requests
from dotenv import load_dotenv

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

PROJECT_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(PROJECT_ROOT / ".env")

API_KEY = os.getenv("PULSE_PLANE_API_KEY", "")
BASE_URL = os.getenv("PULSE_PLANE_BASE_URL", "").rstrip("/")
WORKSPACE_SLUG = os.getenv("PULSE_PLANE_WORKSPACE_SLUG", "")

TODAY = date.today().isoformat()

# ---------------------------------------------------------------------------
# API Client
# ---------------------------------------------------------------------------


class PlaneClient:
    def __init__(self, base_url: str, workspace_slug: str, api_key: str, dry_run: bool = False):
        self.base = f"{base_url}/api/v1/workspaces/{workspace_slug}"
        self.headers = {
            "X-API-Key": api_key,
            "Content-Type": "application/json",
        }
        self.dry_run = dry_run

    # -- low-level --

    def _request(self, method: str, path: str, body: dict | None = None) -> dict | None:
        url = f"{self.base}{path}"
        if self.dry_run and method != "GET":
            print(f"  [DRY-RUN] {method} {path}")
            if body:
                print(f"            {json.dumps(body, ensure_ascii=False)[:200]}")
            return {"id": "dry-run-id"}

        for attempt in range(1, 6):
            try:
                resp = requests.request(method, url, headers=self.headers, json=body, timeout=30)
            except requests.RequestException as e:
                if attempt == 5:
                    raise
                print(f"  [RETRY {attempt}/5] {e}")
                time.sleep(attempt * 2)
                continue

            if resp.status_code == 204:
                return None
            if resp.ok:
                # Throttle to avoid rate limits
                time.sleep(0.3)
                return resp.json()

            # Conflict (409) on duplicate
            if resp.status_code == 409:
                return None

            # Already exists (400 with ID in response) — return existing resource
            if resp.status_code == 400:
                try:
                    err_body = resp.json()
                    if "id" in err_body and ("ALREADY_EXISTS" in str(err_body.get("code", ""))):
                        return {"id": err_body["id"], "_existing": True}
                except (ValueError, KeyError):
                    pass

            # Rate limited (429) — wait and retry
            if resp.status_code == 429:
                wait = min(attempt * 3, 15)
                print(f"  [RATE-LIMITED] Waiting {wait}s before retry {attempt}/5...")
                time.sleep(wait)
                continue

            if attempt < 5 and resp.status_code >= 500:
                print(f"  [RETRY {attempt}/5] HTTP {resp.status_code}")
                time.sleep(attempt * 2)
                continue

            print(f"  ERROR: {method} {path} -> HTTP {resp.status_code}")
            print(f"  {resp.text[:500]}")
            resp.raise_for_status()

        return None

    def get(self, path: str) -> dict | None:
        return self._request("GET", path)

    def post(self, path: str, body: dict) -> dict | None:
        return self._request("POST", path, body)

    def patch(self, path: str, body: dict) -> dict | None:
        return self._request("PATCH", path, body)

    # -- high-level --

    def create_project(self, name: str, identifier: str, description: str = "") -> dict:
        return self.post("/projects/", {
            "name": name,
            "description": description,
            "network": 0,
            "identifier": identifier,
            "module_view": True,
            "cycle_view": True,
        })

    def list_states(self, project_id: str) -> list[dict]:
        resp = self.get(f"/projects/{project_id}/states/")
        if resp and "results" in resp:
            return resp["results"]
        return resp if isinstance(resp, list) else []

    def update_state(self, project_id: str, state_id: str, name: str, color: str) -> dict:
        return self.patch(f"/projects/{project_id}/states/{state_id}/", {
            "name": name,
            "color": color,
        })

    def delete_state(self, project_id: str, state_id: str) -> None:
        self._request("DELETE", f"/projects/{project_id}/states/{state_id}/")

    def create_state(self, project_id: str, name: str, group: str, color: str) -> dict:
        return self.post(f"/projects/{project_id}/states/", {
            "name": name,
            "group": group,
            "color": color,
        })

    def create_label(self, project_id: str, name: str, color: str) -> dict:
        return self.post(f"/projects/{project_id}/labels/", {
            "name": name,
            "color": color,
        })

    def create_module(self, project_id: str, name: str, description: str = "") -> dict:
        return self.post(f"/projects/{project_id}/modules/", {
            "name": name,
            "description": description,
        })

    def create_cycle(self, project_id: str, name: str, start_date: str, end_date: str) -> dict:
        return self.post(f"/projects/{project_id}/cycles/", {
            "name": name,
            "start_date": start_date,
            "end_date": end_date,
            "project_id": project_id,
        })

    def create_issue(self, project_id: str, name: str, description: str = "",
                     state_id: str = None, priority: str = "medium",
                     label_ids: list[str] = None,
                     start_date: str = None, target_date: str = None) -> dict:
        body = {"name": name, "description": description, "priority": priority}
        if state_id:
            body["state"] = state_id
        if label_ids:
            body["labels"] = label_ids
        if start_date:
            body["start_date"] = start_date
        if target_date:
            body["target_date"] = target_date
        return self.post(f"/projects/{project_id}/issues/", body)

    def update_issue(self, project_id: str, issue_id: str, body: dict) -> dict:
        return self.patch(f"/projects/{project_id}/issues/{issue_id}/", body)


# ---------------------------------------------------------------------------
# Pulse-meta builder
# ---------------------------------------------------------------------------

PRIORITY_MAP = {"urgent": "urgent", "high": "high", "medium": "medium", "low": "low"}


def build_pulse_meta(
    routine_type: str,
    routine_days: list[str],
    routine_time: str,
    duration_min: int,
    priority: str,
    mandatory: bool,
    source_project_id: str,
    source_issue_id: str = "",
    active_from: str = TODAY,
    active_until: str | None = None,
    cooldown_days: int = 0,
) -> dict:
    return {
        "schema_version": 1,
        "routine_type": routine_type,
        "routine_days": routine_days,
        "routine_time": routine_time,
        "routine_duration_min": duration_min,
        "routine_priority": priority,
        "routine_mandatory": mandatory,
        "routine_active_from": active_from,
        "routine_active_until": active_until,
        "routine_cooldown_days": cooldown_days,
        "source_project_id": source_project_id,
        "source_issue_id": source_issue_id,
        "defer_count": 0,
    }


def meta_to_description(meta: dict) -> str:
    meta_json = json.dumps(meta, indent=2, ensure_ascii=False)
    return f"### pulse-meta\n```json\n{meta_json}\n```"


# ---------------------------------------------------------------------------
# Data definitions (from plane-structure.md)
# ---------------------------------------------------------------------------

WEEKDAYS = ["mon", "tue", "wed", "thu", "fri"]
WEEKEND = ["sat", "sun"]
ALL_DAYS = WEEKDAYS + WEEKEND

PROJECTS = [
    {
        "key": "P1",
        "name": "일본 IT 취업 마스터플랜",
        "identifier": "P1",
        "description": "2026년 내 일본 IT 회사 취업 — 6개월 플랜",
        "modules": [
            ("JLPT N2 시험 대비", "7월 5일 시험 목표, 한자/어휘/문법/독해/청해"),
            ("비즈니스 일본어", "면접·업무용 일본어 준비"),
            ("일본 취업 활동", "회사 탐색, 이력서, 코딩 테스트, 면접"),
        ],
        "cycles": [
            ("N2 기초 다지기", "2026-04-07", "2026-04-30"),
            ("N2 실전 훈련", "2026-05-01", "2026-05-31"),
            ("N2 파이널", "2026-06-01", "2026-07-05"),
            ("취업 활동 Phase 1", "2026-07-06", "2026-09-30"),
            ("취업 활동 Phase 2", "2026-10-01", "2026-12-31"),
        ],
        "active_until": "2026-12-31",  # 일본 취업 달성 목표일
        "routines": [
            # (name, routine_type, days, time, duration, priority, mandatory, label_on)
            ("안키 - JLPT 한자", "daily", ALL_DAYS, "19:30", 30, "high", True, True),
            ("안키 - JLPT 어휘", "daily", ALL_DAYS, "20:00", 30, "high", True, True),
            ("일본어 리딩 3문제", "daily", ALL_DAYS, "21:00", 30, "high", True, True),
            ("일본어 문법 3문제", "daily", ALL_DAYS, "21:30", 30, "high", True, True),
            ("일본어 회화 (여친)", "daily", ALL_DAYS, "22:00", 30, "medium", False, True),
            ("일본어 모의고사 1회분", "weekly", WEEKEND, "14:00", 120, "high", True, True),
            ("안키 - 비즈니스 일본어 5개", "daily", ALL_DAYS, "20:15", 10, "medium", False, False),
            ("일본어 쉐도잉", "daily", ALL_DAYS, "08:20", 15, "low", False, False),
            ("일본어 듣기 (유튜브 5분)", "daily", ALL_DAYS, "08:35", 5, "low", False, False),
            ("일본어 개발 문서 읽기", "daily", ALL_DAYS, "12:30", 15, "low", False, False),
        ],
        "issues": [
            ("일본어 모의고사 교재 선정 및 구매", "high"),
            ("JLPT N2 접수 (접수 기간 확인 필요)", "urgent"),
            ("비즈니스 일본어 안키 덱 등록", "urgent"),
            ("일본어 개발 문서 리딩 리스트 정리", "medium"),
            ("일본 IT 회사 리스트업 (최소 20개)", "high"),
            ("일본어 이력서(履歴書) 작성", "high"),
            ("일본어 직무경력서(職務経歴書) 작성", "high"),
        ],
    },
    {
        "key": "P2",
        "name": "영어권 IT 취업 마스터플랜",
        "identifier": "P2",
        "description": "IELTS 6.5 달성 → 영어권 IT 회사 취업 — 1년 플랜",
        "modules": [
            ("IELTS 대비", "Speaking, Writing, Listening, Reading"),
            ("비즈니스 영어", "업무·면접용 영어"),
            ("영어권 취업 활동", "회사 탐색, 이력서, 면접 (일본 취업 후 활성화)"),
        ],
        "cycles": [
            ("영어 기초 유지", "2026-04-07", "2026-12-31"),
        ],
        "active_until": None,  # 장기 (무기한)
        "routines": [
            ("영어 IELTS 회화", "weekly", ["tue", "thu"], "20:00", 30, "high", True, True),
            ("안키 - 영어 문장 만들기", "daily", ALL_DAYS, "20:30", 15, "medium", True, True),
            ("안키 - 비즈니스 영어 5개", "daily", ALL_DAYS, "20:45", 10, "medium", False, False),
            ("영어 쉐도잉", "daily", ALL_DAYS, "08:40", 15, "low", False, False),
            ("영어 듣기 (유튜브 5분)", "daily", ALL_DAYS, "08:55", 5, "low", False, False),
            ("영어 개발 문서 읽기", "daily", ALL_DAYS, "12:45", 15, "low", False, False),
        ],
        "issues": [
            ("비즈니스 영어 안키 덱 등록", "urgent"),
            ("영어 공부를 위한 AWS 문서 정리", "high"),
            ("IELTS 교재 선정", "medium"),
        ],
    },
    {
        "key": "P3",
        "name": "AWS 자격증",
        "identifier": "P3",
        "description": "AWS AI Practitioner (AIP-C01) 합격 — 단기 (5월 말 시험)",
        "modules": [
            ("덤프 문제 풀이", "기출/예상 문제 반복 학습"),
            ("개념 정리", "취약 영역 개념 보강"),
        ],
        "cycles": [
            ("문제풀이 집중", "2026-04-07", "2026-05-15"),
            ("파이널 리뷰", "2026-05-16", "2026-05-31"),
        ],
        "active_until": "2026-05-31",  # AWS 시험일
        "routines": [
            ("출근 AWS 팟캐스트 청취", "weekly", WEEKDAYS, "08:20", 40, "medium", True, True),
            ("AWS 덤프 문제 풀이 (평일)", "weekly", WEEKDAYS, "13:00", 60, "high", True, True),
            ("AWS 덤프 문제 풀이 (주말)", "weekly", WEEKEND, "16:00", 120, "high", True, True),
        ],
        "issues": [
            ("영어 공부를 위한 AWS 문서 정리 (P2 연동)", "high"),
            ("일본어 공부를 위한 AWS 일본어 문서 정리 (P1 연동)", "high"),
            ("덤프 문제 세트 확보", "high"),
            ("오답 노트 정리", "medium"),
        ],
    },
    {
        "key": "P4",
        "name": "SCP 유튜브",
        "identifier": "P4",
        "description": "AI 기반 자동 영상 생성 파이프라인 완성 및 정기 업로드",
        "modules": [
            ("영상 자동화 파이프라인", "AI 베이스 영상 생성 (현재 80% 완료)"),
            ("채널 운영", "업로드 주기, 피드백 루프, 성장 전략"),
        ],
        "cycles": [
            ("파이프라인 완성", "2026-04-07", "2026-04-30"),
            ("채널 론칭", "2026-05-01", "2026-05-31"),
        ],
        "active_until": None,  # 지속
        "routines": [
            ("사이드 프로젝트 개발", "weekly", WEEKEND, "18:00", 120, "medium", False, True),
        ],
        "issues": [
            ("영상 자동화 파이프라인 나머지 20% 구현", "high"),
            ("업로드 주기 결정", "medium"),
            ("피드백 수집 체계 구성", "medium"),
            ("채널 브랜딩 (썸네일, 인트로 등)", "low"),
        ],
    },
    {
        "key": "P5",
        "name": "건강 관리",
        "identifier": "P5",
        "description": "체력 유지 및 건강한 생활 습관 형성 — 지속",
        "modules": [
            ("운동", "자전거, 스트레칭 등 정기 운동 관리"),
            ("생활 습관", "수면, 식단, 컨디션 관리"),
        ],
        "cycles": [
            ("운동 습관 정착", "2026-04-07", "2026-06-30"),
        ],
        "active_until": None,  # 지속
        "routines": [
            ("자전거 (1시간)", "weekly", WEEKEND, "13:00", 60, "high", True, True),
        ],
        "issues": [
            ("주중 운동 루틴 추가 검토 (스트레칭, 홈트 등)", "medium"),
            ("건강 검진 일정 확인", "low"),
        ],
    },
]

# Daily Quests (루틴) 프로젝트 — 별도 처리
DAILY_QUESTS_PROJECT = {
    "name": "Daily Quests",
    "identifier": "DQ",
    "description": "Auto-generated daily quest board managed by pulse",
}

DAILY_QUESTS_STATES = [
    ("To-Do", "unstarted", "#3a3a3a"),
    ("In Progress", "started", "#f59e0b"),
    ("Deferred", "backlog", "#6b7280"),
    ("Done", "completed", "#16a34a"),
    ("Canceled", "cancelled", "#ef4444"),
]

DAILY_QUESTS_TRACKING_LABELS = [
    ("P1-일본취업", "#ef4444"),   # Red
    ("P2-영어취업", "#3b82f6"),   # Blue
    ("P3-AWS", "#f97316"),        # Orange
    ("P4-SCP유튜브", "#a855f7"),  # Purple
    ("P5-건강관리", "#14b8a6"),   # Teal
    ("기타루틴", "#9ca3af"),      # Gray
    ("llm-generated", "#22c55e"), # Green
    ("user-created", "#eab308"),  # Yellow
]

# 프로젝트 미연동 공통 루틴
COMMON_ROUTINES = [
    ("이민 회사 탐색 / 코딩테스트 / 비즈니스 언어", "weekly", WEEKEND, "20:00", 60, "medium", False, True),
]


# ---------------------------------------------------------------------------
# Main setup
# ---------------------------------------------------------------------------

def run_setup(dry_run: bool = False):
    # Validate env (skip for dry-run)
    missing = [v for v in ("PULSE_PLANE_API_KEY", "PULSE_PLANE_BASE_URL", "PULSE_PLANE_WORKSPACE_SLUG")
               if not os.getenv(v)]
    if missing and not dry_run:
        print(f"ERROR: Missing environment variables: {', '.join(missing)}")
        print("Please configure them in .env")
        sys.exit(1)

    base_url = BASE_URL or "https://plane.example.com"
    workspace_slug = WORKSPACE_SLUG or "pulse"
    api_key = API_KEY or "dry-run-key"
    client = PlaneClient(base_url, workspace_slug, api_key, dry_run=dry_run)

    # Validate API connectivity & fetch existing projects
    print("=== pulse Plane.so Full Workspace Setup ===\n")
    print("[0] Validating API connectivity...")
    existing_projects = {}  # identifier -> project dict
    if not dry_run:
        resp = client.get("/projects/")
        if resp and "results" in resp:
            for p in resp["results"]:
                existing_projects[p["identifier"]] = p
    print(f"  OK - {len(existing_projects)} existing project(s) found\n")

    # Store all generated IDs
    env_output = {}
    project_ids = {}  # key -> project_id

    # -----------------------------------------------------------------
    # Step 1: Create projects (P1~P5)
    # -----------------------------------------------------------------
    print("[1/7] Creating projects (P1~P5)...")
    for proj in PROJECTS:
        if proj["identifier"] in existing_projects:
            pid = existing_projects[proj["identifier"]]["id"]
            project_ids[proj["key"]] = pid
            # Ensure module/cycle views are enabled
            client.patch(f"/projects/{pid}/", {"module_view": True, "cycle_view": True})
            print(f"  SKIP - [{proj['key']}] {proj['name']}: {pid} [already exists, views enabled]")
        else:
            resp = client.create_project(proj["name"], proj["identifier"], proj["description"])
            pid = resp["id"]
            project_ids[proj["key"]] = pid
            print(f"  OK - [{proj['key']}] {proj['name']}: {pid}")
    print()

    # -----------------------------------------------------------------
    # Step 2: Create Daily Quests project + states + tracking labels
    # -----------------------------------------------------------------
    print("[2/7] Creating Daily Quests project...")
    dq = DAILY_QUESTS_PROJECT
    if dq["identifier"] in existing_projects:
        dq_project_id = existing_projects[dq["identifier"]]["id"]
        client.patch(f"/projects/{dq_project_id}/", {"module_view": True, "cycle_view": True})
        print(f"  SKIP - Daily Quests: {dq_project_id} [already exists, views enabled]")
    else:
        resp = client.create_project(dq["name"], dq["identifier"], dq["description"])
        dq_project_id = resp["id"]
    project_ids["DQ"] = dq_project_id
    env_output["PULSE_DAILY_QUEST_PROJECT_ID"] = dq_project_id
    print(f"  OK - Daily Quests: {dq_project_id}")

    print("  Configuring states (update defaults + create missing)...")

    # Plane.so auto-creates: Backlog(backlog), Todo(unstarted), In Progress(started), Done(completed), Cancelled(cancelled)
    # We need: To-Do(unstarted), In Progress(started), Deferred(backlog), Done(completed), Canceled(cancelled)
    # Strategy: rename defaults by group match, then handle mismatches

    TARGET_STATES = {
        # group -> (target_name, color, env_key)
        "unstarted": ("To-Do", "#3a3a3a", "PULSE_STATE_TODO_ID"),
        "started": ("In Progress", "#f59e0b", "PULSE_STATE_IN_PROGRESS_ID"),
        "backlog": ("Deferred", "#6b7280", "PULSE_STATE_DEFERRED_ID"),
        "completed": ("Done", "#16a34a", "PULSE_STATE_DONE_ID"),
        "cancelled": ("Canceled", "#ef4444", "PULSE_STATE_CANCELED_ID"),
    }

    existing_states = client.list_states(dq_project_id) if not dry_run else []
    used_groups = set()

    for state in existing_states:
        group = state["group"]
        if group in TARGET_STATES and group not in used_groups:
            target_name, color, env_key = TARGET_STATES[group]
            client.update_state(dq_project_id, state["id"], target_name, color)
            env_output[env_key] = state["id"]
            used_groups.add(group)
            print(f"    OK - State '{target_name}' ({group}): {state['id']} [updated from '{state['name']}']")
        else:
            # Duplicate group or unneeded state — skip (keep for safety)
            print(f"    SKIP - '{state['name']}' ({group}): {state['id']}")

    # Create any missing states (e.g., if Plane.so didn't auto-create them)
    for group, (target_name, color, env_key) in TARGET_STATES.items():
        if group not in used_groups:
            resp = client.create_state(dq_project_id, target_name, group, color)
            if resp:
                env_output[env_key] = resp["id"]
                print(f"    OK - State '{target_name}' ({group}): {resp['id']} [created]")
            else:
                print(f"    WARN - State '{target_name}' ({group}): creation returned None")

    # In dry-run mode, fill dummy values
    if dry_run:
        for group, (_, _, env_key) in TARGET_STATES.items():
            env_output.setdefault(env_key, "dry-run-id")

    print("  Creating tracking labels...")
    for label_name, color in DAILY_QUESTS_TRACKING_LABELS:
        resp = client.create_label(dq_project_id, label_name, color)
        if resp:
            print(f"    OK - Label '{label_name}': {resp['id']}")
        else:
            print(f"    SKIP - Label '{label_name}' [already exists]")
    print()

    # -----------------------------------------------------------------
    # Step 3: Create daily-routine label for each project (P1~P5 + DQ)
    # -----------------------------------------------------------------
    print("[3/7] Creating 'daily-routine' label for each project...")

    def ensure_label(project_id: str, label_name: str, color: str) -> str:
        """Create label or find existing one. Returns label ID."""
        resp = client.create_label(project_id, label_name, color)
        if resp and resp.get("id") and resp["id"] != "dry-run-id":
            return resp["id"]
        # Label already exists — fetch from list
        if not dry_run:
            labels_resp = client.get(f"/projects/{project_id}/labels/")
            labels = labels_resp.get("results", []) if labels_resp and isinstance(labels_resp, dict) else (labels_resp or [])
            for lbl in labels:
                if lbl["name"] == label_name:
                    return lbl["id"]
        return resp["id"] if resp else "dry-run-id"

    label_ids = {}  # project_key -> label_id
    for proj in PROJECTS:
        pid = project_ids[proj["key"]]
        lid = ensure_label(pid, "daily-routine", "#8b5cf6")
        label_ids[proj["key"]] = lid
        print(f"  OK - [{proj['key']}] daily-routine: {lid}")

    # Also ensure daily-routine label on DQ project
    dq_label_id = ensure_label(dq_project_id, "daily-routine", "#8b5cf6")
    env_output["PULSE_LABEL_DAILY_ROUTINE_ID"] = dq_label_id
    print(f"  OK - [DQ] daily-routine: {dq_label_id}")
    print()

    # -----------------------------------------------------------------
    # Step 4: Create modules for each project
    # -----------------------------------------------------------------
    print("[4/7] Creating modules...")
    for proj in PROJECTS:
        pid = project_ids[proj["key"]]
        for mod_name, mod_desc in proj["modules"]:
            resp = client.create_module(pid, mod_name, mod_desc)
            if resp:
                print(f"  OK - [{proj['key']}] Module '{mod_name}': {resp['id']}")
            else:
                print(f"  SKIP - [{proj['key']}] Module '{mod_name}' [already exists]")
    print()

    # -----------------------------------------------------------------
    # Step 5: Create cycles for each project
    # -----------------------------------------------------------------
    print("[5/7] Creating cycles...")
    for proj in PROJECTS:
        pid = project_ids[proj["key"]]
        for cycle_name, start, end in proj["cycles"]:
            resp = client.create_cycle(pid, cycle_name, start, end)
            if resp:
                print(f"  OK - [{proj['key']}] Cycle '{cycle_name}': {resp['id']}")
            else:
                print(f"  SKIP - [{proj['key']}] Cycle '{cycle_name}' [already exists]")
    print()

    # -----------------------------------------------------------------
    # Step 6: Create routine issues (with pulse-meta)
    # -----------------------------------------------------------------
    print("[6/7] Creating routine issues with pulse-meta...")

    for proj in PROJECTS:
        pid = project_ids[proj["key"]]
        lid = label_ids[proj["key"]]
        proj_active_until = proj.get("active_until")

        for routine in proj["routines"]:
            name, rtype, days, rtime, duration, priority, mandatory, label_on = routine

            # Build pulse-meta
            meta = build_pulse_meta(
                routine_type=rtype,
                routine_days=days,
                routine_time=rtime,
                duration_min=duration,
                priority=priority,
                mandatory=mandatory,
                source_project_id=pid,
                active_until=proj_active_until,
            )

            # label_on 상태를 description에 표기
            label_status = "on" if label_on else "off"
            desc = meta_to_description(meta)
            desc += f"\n\n> label: `{label_status}`"

            resp = client.create_issue(
                project_id=pid,
                name=name,
                description=desc,
                priority=priority,
                label_ids=[lid],
                start_date=TODAY,
                target_date=proj_active_until,
            )
            issue_id = resp["id"]

            # Backfill source_issue_id
            meta["source_issue_id"] = issue_id
            updated_desc = meta_to_description(meta)
            updated_desc += f"\n\n> label: `{label_status}`"
            client.update_issue(pid, issue_id, {"description": updated_desc})

            print(f"  OK - [{proj['key']}] '{name}' ({label_status}): {issue_id}")

    # Common routines (프로젝트 미연동) — DQ 프로젝트에 직접 등록
    print("  -- Common routines (기타루틴) --")
    for routine in COMMON_ROUTINES:
        name, rtype, days, rtime, duration, priority, mandatory, label_on = routine
        meta = build_pulse_meta(
            routine_type=rtype,
            routine_days=days,
            routine_time=rtime,
            duration_min=duration,
            priority=priority,
            mandatory=mandatory,
            source_project_id=dq_project_id,
        )
        label_status = "on" if label_on else "off"
        desc = meta_to_description(meta)
        desc += f"\n\n> label: `{label_status}`"

        resp = client.create_issue(
            project_id=dq_project_id,
            name=name,
            description=desc,
            priority=priority,
            label_ids=[dq_label_id],
            start_date=TODAY,
        )
        issue_id = resp["id"]
        meta["source_issue_id"] = issue_id
        updated_desc = meta_to_description(meta)
        updated_desc += f"\n\n> label: `{label_status}`"
        client.update_issue(dq_project_id, issue_id, {"description": updated_desc})
        print(f"  OK - [공통] '{name}' ({label_status}): {issue_id}")
    print()

    # -----------------------------------------------------------------
    # Step 7: Create backlog issues
    # -----------------------------------------------------------------
    print("[7/7] Creating backlog issues...")
    for proj in PROJECTS:
        pid = project_ids[proj["key"]]
        proj_active_until = proj.get("active_until")
        for issue_name, priority in proj["issues"]:
            resp = client.create_issue(
                project_id=pid,
                name=issue_name,
                priority=priority,
                start_date=TODAY,
                target_date=proj_active_until,
            )
            print(f"  OK - [{proj['key']}] '{issue_name}': {resp['id']}")
    print()

    # -----------------------------------------------------------------
    # Output .env values
    # -----------------------------------------------------------------
    print("=" * 50)
    print("=== Setup Complete ===")
    print("=" * 50)
    print()
    print("# Add these to your .env file:")
    print()
    for key, val in env_output.items():
        print(f"{key}={val}")
    print()
    print("# Project IDs (for reference):")
    for key, val in project_ids.items():
        print(f"# {key}: {val}")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="pulse - Plane.so Full Workspace Setup")
    parser.add_argument("--dry-run", action="store_true", help="Print API calls without executing")
    args = parser.parse_args()

    run_setup(dry_run=args.dry_run)
