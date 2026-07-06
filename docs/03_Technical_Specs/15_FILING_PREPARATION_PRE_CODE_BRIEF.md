# Filing Preparation Hub Pre-Code Technical Brief
> Created: 2026-07-04 21:20
> Last Updated: 2026-07-07 04:20 KST

## 0. Governing Principle

JC-029 신고 준비 허브는 "홈택스·위택스에 넣을 확정 데이터가 어디까지 준비됐는가"를 한 화면에서 보여주는 **read-only 현황 허브**다. 달력/일정표가 중심이 아니다.

- **실행 우선순위:** 신고 완료는 **Path 1(홈택스 양식 기입·신고 보조)** 이 최우선이다. Path 2(JC-034 ZIP) 구현은 Path 1 세목 확대 후 ([Path 1 Roadmap](./36_PATH1_FORM_FILL_ROADMAP.md)).

- **신규 산출 엔진·신규 DB 테이블·세액 계산 로직·자동 제출은 범위 밖.** 이 화면은 기존 도메인 read model을 집계·재프레임할 뿐이다.
- 최종 제출·납부는 사용자가 홈택스·위택스에서 직접 수행한다(자동 제출은 JC-023 게이트 전 미도입).
- 세무 일정(달력)은 하단 보조 섹션으로만 둔다.
- 기준 화면·문구·상태는 승인된 HTML Preview [08_filing_preparation.html](../02_UI_Screens/previews/08_filing_preparation.html)를 따른다(UI-First Gate 승인 완료 2026-07-04).

## 1. Scope

포함한다.

1. 사이드바 "신고 준비" 진입 → `/dashboard/filing-preparation` read-only 화면
2. Hero: 전체 준비율·확인 필요 건수·Path 2 handoff 준비 수 (파생 지표, 신규 저장 없음)
3. **3 Filing Paths** 섹션 + JC-034 export 패널 (Preview; 구현은 Path 1 세목 확대 후)
4. 다음 할 일(blocker) 목록 + 선행 워크스페이스로 라우팅 CTA
4. 공통 기반(자료수집 → 기장검토) 산출 상태
5. 병렬 신고 트랙(원천세·부가세·지급명세서/연말정산·지방소득세)의 입력·산출·handoff 표시
6. 다가오는 세무 일정(보조 섹션, D-day) — `lib/tax-calendar.ts` 기반
7. 책임 경계 안내
8. 사업자 유형(개인/법인/면세)별 해당 없는 세목 트랙 **흐림(dimmed) 처리**
9. 로딩·빈·오류·권한 없음 상태

제외한다(후속).

- 지급명세서/연말정산(JC-024)·지방소득세(JC-027) **산출 엔진** — 트랙은 로드맵 플레이스홀더(plan chip)로만 표시, 라이브 수치 없음
- 신규 DB 테이블·세액 계산·전자신고 파일 생성(JC-030)·자동 제출(JC-023)

## 2. Route and Component Boundary

| 항목 | 결정 |
|:---|:---|
| Route | `/dashboard/filing-preparation` (신규) |
| 화면 성격 | read-only 현황 허브 (mutation 없음) |
| Read model | 신규 `lib/filing-preparation/summary.ts` |
| Persistence | **없음** — 신규 테이블/마이그레이션 없음 |
| Mutation API | **없음** — 모든 작업은 선행 워크스페이스에서 수행, 이 화면은 라우팅만 |
| Client UI | Hero, 다음 할 일, 공통 기반 카드, 트랙 카드, 세무 일정, 상태 |
| Sidebar | "운영 흐름" 그룹의 신고지원 아래 "신고 준비" 항목 추가(attention count badge) |

## 3. Data Sources (기존 read model 재사용, 신규 저장 없음)

`lib/filing-preparation/summary.ts`는 기존 요약을 집계한다. JC-016의 `loadInternalReminderAttentionItems`가 이미 동일 5개 도메인을 병렬 집계하므로 같은 패턴을 따른다.

| 블록 | 소스 |
|:---|:---|
| 기준 기간·준비율·D-day | `buildCompanyHomePeriod` (`lib/company-home/summary`) |
| 공통 기반: 자료수집 | `loadSourceCollectionSummary` |
| 공통 기반: 기장검토 | `loadBookkeepingReviewSummary` |
| 트랙: 부가세 | `loadVatSummary` (매출/매입세액·공제 검토 수) |
| 트랙: 원천세 | `loadPayrollWorkspaceSummary` + `loadFilingSupportSummary`(원천세 항목 handoff) |
| 트랙: 지급명세서/연말정산 | 로드맵 플레이스홀더(JC-024) — 라이브 소스 없음 |
| 트랙: 지방소득세 | 로드맵 플레이스홀더(JC-027) — 라이브 소스 없음 |
| 세무 일정(보조) | `lib/tax-calendar.ts` (세목별 마감·D-day) |
| 다음 할 일(blocker) | 위 도메인 요약의 확인 필요 건수 집계(회사 홈 "다음 할 일"과 동일 성격) |

준비율은 **파생 지표**다: 공통 기반 + 라이브 트랙(부가세·원천세)의 확인 필요/완료 비율로 계산하며 저장하지 않는다. 계산식은 구현 시 `summary.ts`에 단위 테스트와 함께 확정한다.

## 4. 사업자 유형별 노출 규칙 (흐림 처리)

`business_entity`의 사업자 유형(개인/법인/면세)에 따라 해당 없는 세목 트랙을 **흐림(dimmed) + "해당 없음" 배지**로 표시한다(숨김 아님 — 전체 세무 구조를 보여주고 유형 전환 시 레이아웃 점프를 없앤다).

| 세목 트랙 | 개인 | 법인 | 면세 개인 |
|:---|:---:|:---:|:---:|
| 부가세 | 해당 | 해당 | **흐림**(사업장현황신고로 대체·JC-028) |
| 원천세 | 해당 | 해당 | 해당 |
| 지급명세서/연말정산 | 해당 | 해당 | 해당 |
| 지방소득세 | 해당 | 해당 | 해당 |

- 향후 세목(JC-024~026)이 붙으면: 종합소득세=개인만 해당(법인 흐림), 법인세=법인만 해당(개인 흐림).
- v1 실제 흐림 대상은 **면세 개인의 부가세 트랙**이 핵심. 유형↔세목 매핑은 순수 함수로 두어 테스트한다.

## 5. Screen States

| 상태 | 표시 |
|:---|:---|
| Loading | "신고 준비 상태를 불러오는 중입니다." (카드/트랙 스켈레톤) |
| Empty | "자료수집과 기장검토를 먼저 완료하면 신고 준비 트랙이 채워집니다." |
| Error | "신고 준비 상태를 불러오지 못했습니다. 다시 시도해 주세요." |
| No Permission | "회사 권한이 있는 담당자만 신고 준비 현황을 볼 수 있습니다." |

문구는 승인된 Preview의 "화면 상태 예시"와 일치시킨다.

## 6. Component & Library Plan

- shadcn/ui components: 기존 대시보드에서 쓰는 것만 재사용. 신규 설치 없음.
- Custom components: `FilingPreparationHub`(서버 컴포넌트 진입), 트랙 카드·공통기반 카드·세무일정 행은 이 화면 전용 프레젠테이션 컴포넌트로 신설(회사 홈/리마인드 카드 패턴 재사용).
- Reused components: 사이드바(`app/(dashboard)/_components/sidebar.tsx`)에 항목 추가, 상태칩/진행바 등 기존 유틸(`lib/status-tone.ts`) 재사용.
- New libraries: **없음** — drizzle·luxon·기존 요약 로더로 충분.
- Libraries intentionally not added: 차트/그리드 라이브러리 불필요(정적 카드·표).
- shadcn preset action: N/A - UI 라이브러리 변경 없음.

## 7. Acceptance Criteria (백로그 JC-029와 일치)

- [ ] 사이드바 "신고 준비" 진입 시 준비율·확인 필요 blocker·다음 액션이 표시된다.
- [ ] 공통 기반(자료수집 → 기장검토)과 병렬 트랙(원천세·부가세·지급명세서/연말정산·지방소득세)이 한 화면에 표시된다.
- [ ] 각 트랙이 입력·산출·handoff 기준으로 읽힌다.
- [ ] 세무 일정은 하단 보조 섹션으로 표시되고 화면 중심은 일정표가 아니다.
- [ ] 사업자 유형별 해당 없는 세목 트랙이 흐림 + "해당 없음"으로 표시된다.
- [ ] 최종 제출·납부는 사용자가 직접 수행한다는 책임 경계가 명시된다.
- [ ] 신규 산출 엔진·신규 DB·자동 제출은 포함하지 않는다(read-only 집계).
- [ ] 로딩·빈·오류·권한 없음 상태가 구현된다.
- [ ] 화면은 read-only이며 mutation을 수행하지 않는다.

## 8. Related Documents
- **Concept_Design**: [Filing Preparation Pipeline](../01_Concept_Design/02_FILING_PREPARATION_PIPELINE.md) - 재프레임 방향·데이터 계약 · [Product Baseline](../01_Concept_Design/01_PRODUCT_BASELINE.md) - 세목 커버리지·책임 경계
- **UI_Screens**: [Screen Flow 4g](../02_UI_Screens/00_SCREEN_FLOW.md) · [UI Design 4.10](../02_UI_Screens/01_UI_DESIGN.md) · [08_filing_preparation.html](../02_UI_Screens/previews/08_filing_preparation.html) - 승인된 화면
- **Technical_Specs**: [Internal Reminder Cron Pre-Code Brief](./14_INTERNAL_REMINDER_CRON_PRE_CODE_BRIEF.md) - 동일 5개 도메인 집계 패턴(`loadInternalReminderAttentionItems`) 참조
- **Logic_Progress**: [Backlog](../04_Logic_Progress/00_BACKLOG.md) - JC-029 Context Lock
