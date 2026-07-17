# Conversational Tax Workspace Product Direction
> Created: 2026-07-16 01:43
> Last Updated: 2026-07-17 05:10
> Status: CUI-0~CUI-3 완료 · CUI-4 Preview 승인(PR #271) · **CUI-4 Pre-Code Brief 승인(PR #272)** · 다음 CUI-4a runtime

## 1. Purpose

SemuAgent의 첫 화면을 대화 중심 작업공간으로 발전시키는 제품 방향을 정의한다.
사용자는 AI와 대화하며 자료를 올리고, 작업을 요청하고, 처리 결과와 이유를 설명받는다.

기존 자료수집·자료대조원장·급여·부가세·신고 화면을 채팅 로그로 대체하지 않는다.
대화는 각 작업공간을 운전하는 중심 진입점이고, 구조화 화면은 검토·수정·확정의 표면이다.

## 2. Product Decision

> **대화로 시키고 이해하며, 표에서 검토하고 확정한다.**

첫 화면은 Codex형 대화 중심 작업공간과 유사한 친숙함을 사용할 수 있다. 그러나 세무 제품의
상태 가시성, 원본 대조와 감사 추적을 지키기 위해 순수 채팅 UI로 만들지 않는다.

## 3. AI Persona And Topic Guardrail

**페르소나: "세무·회계 업무를 도와주는 어시스턴트".** "세무회계 전문가"·"세무사"처럼 전문
자격을 가진 것으로 들리는 페르소나는 쓰지 않는다. 사용자가 AI 답변을 실제 세무대리인의
전문 판단처럼 받아들이면, 제품 전반에 이미 적용된 self-filing 보조 경계(세무대리 포지셔닝
금지)와 충돌한다. 대화 답변에는 기존 화면의 책임 경계 문구와 같은 톤 — "세액 집계·판단
보조·신고 준비 상태 확인까지만 지원하며, 최종 판단과 신고·제출은 사용자가 직접 확인하고
진행한다" — 를 필요할 때 함께 노출한다.

**주제 가드레일: 화이트리스트 방식.** 다음 범위 안의 요청만 답변한다.

1. 세무·회계 업무 — 자료수집, 기장검토, 부가세·원천세·급여 등 **현재 제품이 다루는 업무
   흐름과 그 화면·자료에 근거한 설명**. 제품 범위 밖의 일반 세무상담이 아니다.
2. 제품 사용법 — "이 파일 어떻게 올려요?", "이 버튼은 뭐예요?" 같은 SemuAgent 화면·기능
   안내

범위 밖 요청(일반 잡담, 다른 도메인 질문, 코딩 도움, 제품과 무관한 일반 세무상담 등)은
**업무 답변을 생성하지 않고, 범위를 안내하는 짧은 거절 메시지만 표시한다.** 화이트리스트는
세무·회계만으로 좁히지 않고 제품 사용법을 포함해, 정상적인 온보딩 질문까지 막히지 않게
한다. 정확한 판정 방식(분류 프롬프트 vs. 후처리 필터)과 오탐 처리 UX는 CUI-1 Preview에서
화면 문구와 함께 확정한다.

## 4. Responsibility Split

| 계층 | 책임 | 정본 여부 |
|---|---|---|
| 대화 | 요청, 파일 업로드, 설명, 다음 작업 안내, 라우팅 | 정본 아님 |
| 상태 요약 | 다가오는 신고, 미확정, Ready, 최근 결과 | DB 파생 read model |
| 구조화 작업공간 | 원본 대조, 행 검토, 수정, 명시적 확정 | 사용자 검토 표면 |
| DB·감사 로그 | canonical 상태, 확인자·시각, fingerprint, 변경 이력 | 정본 |

채팅 메시지와 대화 이력만으로 신고 상태를 확정하거나 감사 증거를 대신하지 않는다.

## 5. Proposed First Screen

1. **대화 영역**: 요청, 파일 업로드, AI 설명
2. **지속 상태 요약**: 다가오는 신고, 세목별 Ready, 미확정 blocker
3. **실행 카드**: 처리 건수, 오류·미확정 건수, 관련 작업공간 CTA
4. **구조화 검토 표면**: 상세 표, 필터, 원본 비교, 수정·확정

기존 사이드 네비게이션은 숨기지 않는다. 사용자는 AI를 통하지 않고도 각 작업공간으로 직접
이동할 수 있어야 한다. A2A의 세무회계사무소 연결 메뉴도 네비게이션 하단에 유지한다.

## 6. Representative Flow

```text
사용자: 통장·카드 파일 업로드
  -> 기존 자료수집 파이프라인이 저장·파싱·정규화
  -> 대화 화면에 '324건 정리 · 317건 처리 · 7건 확인 필요' 카드 표시
  -> 사용자가 7건 확인 선택
  -> 자료대조원장의 필터된 실제 7개 행 표시
  -> 사용자가 원본과 대조하고 수정·확정
  -> DB 정본에서 대화 홈의 상태 요약 재계산
```

AI가 채팅 문장으로 처리 완료를 선언하는 것만으로 상태를 바꾸지 않는다.

## 7. Trust And Safety Contract

- 첫 화면 로드만으로 LLM provider를 호출하지 않는다.
- 사용자의 요청이나 명시적 재검토에서만 필요한 AI 실행을 시작한다.
- 파일 업로드는 기존 tenant-scoped 자료수집 계약을 사용한다.
- AI 변경 제안은 적용 대상·이전 값·새 값·근거를 구조화해 보여준다.
- 세무·급여·거래 확정은 고정된 행·표·snapshot에서 수행한다.
- mutation 직전 서버가 tenant, fingerprint, 권한과 도메인 gate를 다시 검증한다.
- 대화와 구조화 화면이 다르면 DB canonical 상태를 우선한다.
- 자동 신고, 숨은 자동 확정, 자격증명 원문 저장은 허용하지 않는다.

## 8. UX States

| 상태 | 대화 영역 | 구조화 상태 |
|---|---|---|
| First run | 필요한 첫 자료를 한 단계씩 안내 | 빈 상태와 샘플 여부 명시 |
| Processing | 작업명과 진행 상태, 전체 화면 비차단 | 기존 데이터 계속 열람 |
| Needs review | 확인 건수와 이유 요약 | 필터된 행과 원본 비교 |
| Ready | 세목·기간과 다음 행동 카드 | 최종 snapshot과 확정 상태 |
| Error | 실패 단계·재시도·수동 경로 | 성공한 기존 상태 보존 |

## 9. Delivery Plan

| 단위 | 산출물 | 완료선 |
|---|---|---|
| **CUI-0** | 기존 홈·워크스페이스·AI·업로드 감사와 Q&A | 재사용/변경/금지 경계 승인 |
| **CUI-1** | 대화형 첫 화면 HTML Preview | 데스크톱·모바일 오너 승인 |
| **CUI-2** | read-only 대화 홈 셸·진입/내비·참고 세무 일정(공통 법정 일정). canonical 회사 상태 카드는 후속 | 최초 로드 provider 0회 · 가짜 DB 상태 대화 금지 · 미연결 composer는 disabled |
| **CUI-3** | 대화 파일 업로드·작업 라우팅 | 기존 자료수집 경로 재사용 · [Pre-Code Brief 62](../03_Technical_Specs/62_JC043_CUI3_SEBISEO_UPLOAD_CHAT_PRE_CODE_BRIEF.md) · [QA 12](../05_QA_Validation/12_JC043_CUI3_SEBISEO_TEST_SCENARIOS.md) |
| **CUI-4** | 최근 업로드 세션 결과 카드 1개·필터된 구조화 검토 진입 | [Brief 63](../03_Technical_Specs/63_JC043_CUI4_SEBISEO_UPLOAD_RESULT_CARD_PRE_CODE_BRIEF.md) 승인(PR #272) · CUI-4a runtime 착수 |
| **CUI-5** | 구조화 확정·감사 연결 | 서버 gate·fingerprint·undo 통과 |
| **CUI-6** | 브라우저 E2E·성능·접근성 | 주요 흐름과 모바일 QA 통과 |

각 단위는 별도 오너 확인과 PR로 진행한다. CUI-1 승인 전 runtime UI를 변경하지 않는다.

## 10. Non-Goals

- 기존 세무 작업공간 전체를 채팅 로그로 대체
- 채팅 문장만으로 거래·세액·급여·신고자료 최종 확정
- AI가 사용자를 대신해 숨은 mutation 수행
- 대화 이력을 canonical 원장이나 감사 로그로 간주
- 최초 화면에서 모든 자료를 LLM에 전송
- 새로운 세액 계산 엔진 또는 자동 홈택스 신고
- 기존 사이드 네비게이션 제거
- "세무회계 전문가"·"세무사"처럼 전문 자격을 사칭하는 페르소나
- 세무·회계 업무, 제품 사용법 화이트리스트 밖 주제(잡담, 다른 도메인, 코딩 등) 답변

## 11. 365 Rubric Notes

| Rubric | Meaning here |
|---|---|
| Functionality | 기존 파이프라인과 정본·mutation gate를 재사용한다. |
| Potential Impact | 세무 소프트웨어에 익숙하지 않은 사업자의 시작 비용을 낮춘다. |
| Novelty | 대화형 에이전트와 감사 가능한 세무 작업공간을 연결한다. |
| UX | 메뉴 탐색 부담을 줄이고 미확정·Ready를 항상 보이게 한다. |
| Open-source | 대화 명령과 action card 계약을 독립 모듈로 분리할 수 있다. |
| Business Plan | 직접 신고와 선택적 A2A 연결이 같은 준비 경험에서 시작한다. |

## 12. Related Documents

- **Concept_Design**: [Product Baseline](./01_PRODUCT_BASELINE.md) - 자가신고 보조 목적과 책임 경계
- **Concept_Design**: [Filing Preparation Pipeline](./02_FILING_PREPARATION_PIPELINE.md) - canonical 신고 준비 흐름
- **Concept_Design**: [A2A Master Plan](./03_AGENT_TO_AGENT_TAX_COLLABORATION_MASTER_PLAN.md) - 선택적 사무소 연결 흐름
- **UI_Screens**: [Screen Flow](../02_UI_Screens/00_SCREEN_FLOW.md) - 현행 화면과 향후 대화형 진입
- **UI_Screens**: [UI Design](../02_UI_Screens/01_UI_DESIGN.md) - 화면 구조와 신뢰 UI 기준
- **Logic_Progress**: [Backlog JC-043](../04_Logic_Progress/00_BACKLOG.md) - UI-First 실행 순서
