# Sebiseo First Vertical Journey Prototype Review (S2)
> Created: 2026-07-19
> Last Updated: 2026-07-19
> Status: **Owner screen review pending** (HTML UI Preview Gate / UI-First Gate)
> Related Screen Flow: [00_SCREEN_FLOW.md §2.1](./00_SCREEN_FLOW.md)
> Related UI Design: [01_UI_DESIGN.md §6–7](./01_UI_DESIGN.md)
> Related Preview: [20_sebiseo_first_vertical_journey.html](./previews/20_sebiseo_first_vertical_journey.html)
> Related Execution Plan: [01_EXECUTION_PLAN.md §S2](../04_Logic_Progress/01_EXECUTION_PLAN.md)
> Base: `main` after shell PR #286 · **CUI-4d Brief/runtime 미포함**

## 1. HTML UI Preview

- Preview: [첫 세로 여정](./previews/20_sebiseo_first_vertical_journey.html)
- 확인 방식: 브라우저에서 HTML 파일 **직접 열람** (localhost 앱·staging 아님)
- 범위: 디자인 시안만. DB·API·runtime 변경 없음
- 제작 목적: 파일 단위 결과와 거래 단위 확인 필요를 구분하고, 필터된 자료대조원장에서만
  확정한 뒤 세비서 진행상황 카드를 재조회하는 첫 세로 여정을 오너가 화면으로 확인

## 2. Prototype Scope

포함:

- 세비서: 파일 결과 카드 vs 확인 필요 거래 카드 (단위·카피 분리)
- CTA → 필터된 자료대조원장 (확인 전)
- 확정 흐름 상태: 적용 직전 / stale / 성공 / undo / 부분 실패
- 확정 후 세비서 진행상황 카드 재조회
- 사이드바 직접 진입·AI 장애 시 표로 복구 안내

제외:

- CUI-4d Pre-Code Brief·QA·runtime
- CUI-5 mutation 구현
- staging 배포·로그인 QA

## 3. Key User Flow

```text
파일 업로드 결과 카드 (파일 수)
  -> 확인 필요 거래 카드 (거래 수) · CTA
  -> 필터된 자료대조원장
  -> 확인 전 / 적용 직전 / stale / 성공 / undo / 부분 실패
  -> 세비서 진행상황 카드 재조회
```

## 4. Decisions To Confirm (Owner)

| ID | 질문 | 권고 |
|:---|:---|:---|
| S2-1 | 파일 카드와 거래 카드 단위가 화면에서 충분히 구분되는가 | 구분 유지 |
| S2-2 | CTA가 자료수집이 아니라 자료대조원장(필터)으로 가는 방향이 맞는가 | 원장 맞음 |
| S2-3 | 확정 상태(직전/stale/성공/undo/부분실패) 표현이 이해되는가 | 표 쪽만 확정 |
| S2-4 | 확정 후 세비서 재조회 카드가 다음 단계로 충분한가 | 유지 |
| S2-5 | 사이드바·AI 장애 복구 경로가 보이는가 | 유지 |

## 5. Owner Feedback Log

| 일시 | 피드백 | 반영 |
|:---|:---|:---|
| (대기) | 오너 화면 확인 후 기록 | — |

## 6. Gate

- [ ] HTML UI Preview Gate — 오너가 `20_` 화면 확인
- [ ] UI-First Gate — §4 결정 확인·피드백 기록
- [ ] Screen Flow §2.1 · UI Design §6–7 · 본 Prototype Review 링크 유지

Gate 통과 후에만 CUI-4d Brief(#287 Draft) Ready 전환·승인을 진행한다.
