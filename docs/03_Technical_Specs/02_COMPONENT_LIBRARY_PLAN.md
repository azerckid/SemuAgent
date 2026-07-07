# Component & Library Plan
> Created: 2026-07-01 20:05
> Last Updated: 2026-07-08 05:12 KST

## 1. 목적 및 범위

Component & Library Planning Gate 충족을 위한 계획. React 구현 전, 사용할
컴포넌트·라이브러리·shadcn preset 적용 방침을 확정한다.

대상 화면(사용자 확인 완료, 화면별 매핑은 §7):
- 회사 홈 — [00_company_home.html](../02_UI_Screens/previews/00_company_home.html)
- 자료수집 — [01_source_collection.html](../02_UI_Screens/previews/01_source_collection.html)
- 기장검토 — [02_bookkeeping_review.html](../02_UI_Screens/previews/02_bookkeeping_review.html)
- 자료대조원장 — [12_reconciliation_ledger.html](../02_UI_Screens/previews/12_reconciliation_ledger.html)
- 부가세 — [03_vat.html](../02_UI_Screens/previews/03_vat.html)
- 급여 — [04_payroll.html](../02_UI_Screens/previews/04_payroll.html)
- 신고지원 — [05_filing_support.html](../02_UI_Screens/previews/05_filing_support.html)

원칙: **JARYO-GIWA 자산 최대 재사용 + 최소 신규 도입(YAGNI/KISS/DRY)**. 이미 설치된
것을 우선 쓰고, 없을 때만 shadcn 표준 컴포넌트를 추가한다. 새 npm 패키지는 대상 화면
범위에서 도입하지 않는다.

## 2. Project Initialization / shadcn 상태

- shadcn는 **이미 초기화됨**(`components.json` 존재). 신규 `init` 불필요.
- 설정: `style: base-nova`, `baseColor: neutral`, `iconLibrary: lucide`, `rsc: true`, Base UI(`@base-ui/react`) 기반.
- 신규 컴포넌트 추가는 `init`이 아니라 **`apply`(개별 add)** 로 수행한다.

## 3. UI Theme Strategy

- **기존 GIWA 테마(neutral · base-nova) 그대로 유지.** 새 테마 도입 없음.
- 디자인 토큰은 UI Design 문서 기준(중립 팔레트, radius 12px, ok/warn/danger/muted/blue 상태색).
- 아이콘: lucide-react 사용(HTML Preview의 문자 아이콘은 구현 시 lucide로 대체).
- shadcn preset action: **`apply --only theme` 불필요**(테마 유지). 필요한 개별 컴포넌트만 `apply`.

## 4. 기존 shadcn/ui 인벤토리 (`components/ui`)

설치되어 재사용 가능: `badge` · `button` · `card` · `calendar` · `dialog` ·
`dropdown-menu` · `input` · `popover` · `select` · `sheet` · `table` · `tabs` · `textarea`.

미설치(추가 필요): `progress`, `skeleton`.

## 5. 추가할 shadcn 컴포넌트

| 컴포넌트 | 용도 | action |
|:---|:---|:---|
| `progress` | 회계기간 진행률, 수집 완결성, import 진행 바(mini-progress) | `apply progress` |
| `skeleton` | Loading 상태(카드·표 스켈레톤) | `apply skeleton` |

이 두 개 외 신규 shadcn 컴포넌트는 대상 화면에서 필요 없음.

## 6. 재사용할 기존(GIWA) 컴포넌트

| 컴포넌트 | 경로 | 재사용 조건 |
|:---|:---|:---|
| Sidebar | `app/(dashboard)/_components/sidebar.tsx` | 네비 항목을 회사용(홈·자료수집·기장검토/자료대조원장·부가세·급여·신고지원·설정)으로 정리. "고객 요청/회계사" 문구 제거(JC-004 연계) |
| Sidebar nav link | `app/(dashboard)/_components/sidebar-nav-link.tsx` | 활성 상태·라우팅 그대로 사용 |
| Sign-out button | `app/(dashboard)/_components/sidebar-sign-out-button.tsx` | 사용자 영역에 재사용 |
| shadcn `table` | `components/ui/table.tsx` | 최근 제출·영수증(홈), 수집 상태(자료수집) |
| shadcn `card`/`badge`/`button` | `components/ui/*` | 카드·상태칩·CTA 전반 |

주의: `sidebar-mail-nav.tsx`, `usage-help`는 GIWA 세무사무소 문맥이므로 대상 화면
범위에서는 재사용하지 않는다. `field-test-concierge`는 JC-004 노출 표면 감사에서
미렌더 dead code로 확인되어 삭제했다.

## 7. 화면별 컴포넌트 매핑

### 7.1 회사 홈 (UI Design 4.1)

| 화면 컴포넌트 | 구현 방식 | 기반 |
|:---|:---|:---|
| 사이드바 | 재사용 | GIWA sidebar + nav-link |
| 기간 선택 pill(Topbar) | 커스텀 `PeriodSelector` | shadcn `dropdown-menu` 또는 `select` |
| 회계기간 Hero | 커스텀 `PeriodStatusHero` | `card` + `progress` |
| Action Row(다음 할 일) | 커스텀 `ActionRow`/`ActionList` | `card` + `button` + 상태 dot(커스텀) |
| Status Card | 커스텀 `WorkspaceStatusCard` | `card` + `badge`, 클릭 라우팅 |
| Recent Table | 커스텀 `RecentSubmissionsTable` | `table` + `badge` |
| State(로딩/빈/오류) | 커스텀 공용 `LoadingState`/`EmptyState`/`ErrorState` | `skeleton` + `button` |

### 7.2 자료수집 (UI Design 4.2)

| 화면 컴포넌트 | 구현 방식 | 기반 |
|:---|:---|:---|
| Completeness Header | 커스텀 `CompletenessHeader` | `card` + `progress` |
| Upload Dropzone | 커스텀 `UploadDropzone` | 네이티브 HTML5 drag&drop + `input[type=file]` + `button` |
| Source Type Tile | 커스텀 `SourceTypeTile` | `card` + `badge` |
| Import Status Table | 커스텀 `ImportStatusTable` | `table` + `badge` + `progress`(행별) |
| Missing Checklist | 커스텀 `MissingChecklist` | `card` + `button` + 상태 dot(커스텀) |
| State(로딩/빈/오류) | 공용 재사용(7.1과 동일) | `skeleton` + `button` |

공용 원자 컴포넌트(`StatusChip`, 상태 `Dot`, `MiniProgress`, `LoadingState`,
`EmptyState`, `ErrorState`)는 대상 화면들이 공유한다(DRY).

### 7.3 기장검토 (UI Design 4.3)

| 화면 컴포넌트 | 구현 방식 | 기반 |
|:---|:---|:---|
| Classification Header | 커스텀 `BookkeepingClassificationHeader` - 기장검토 제목·AI 계정분류 대기열 설명 | `card` + `progress` |
| Queue Tabs | 커스텀 `BookkeepingReviewTabs` | 세그먼트 탭(`button`) + 건수 배지 |
| Bulk Action Bar | 커스텀 `BookkeepingBulkActions` | `button`(선택 N건 승인/일괄 변경) |
| Classification Queue Table | 커스텀 `BookkeepingClassificationQueue` | `table` + `badge`(AI 배지) + `Confidence Bar` + 행 액션(승인/수정/계정 지정) |
| Confidence Bar | 커스텀 `ConfidenceBar` | plain div (high/mid/low = ok/warn/danger) |
| Journal Entry Preview | 커스텀 `JournalEntryPreview` | `card` + 전표 표(차/대변, 균형) |
| Period Attribution / Approval | 커스텀 `BookkeepingRowDetail` | 속성 리스트 + 상태칩 + `button`(이 거래 승인) |
| State(로딩/빈/오류) | 공용 재사용 | `skeleton` + `button` |

- 신규 shadcn 없음(progress·skeleton은 자료수집 단계에서 확보). 신규 라이브러리 없음.
- 승인/수정 mutation은 **기존 세션 API 호출**(신규 컴포넌트에서 fetch). GIWA `/dashboard/reviews` 워크스페이스 컴포넌트는 재사용/import하지 않는다(Preview 계약, Brief §0).
- 공용 원자 컴포넌트(StatusChip·Dot·State*)는 앞 화면들과 공유(DRY).

### 7.3a 자료대조원장 (UI Design 4.3a)

| 화면 컴포넌트 | 구현 방식 | 기반 |
|:---|:---|:---|
| Reconciliation Readiness Hero | 커스텀 `ReconciliationLedgerHero` - Path 1 데이터 관문 준비율 | `card` + `progress` + metrics |
| Source Summary Cards | 커스텀 `ReconciliationSourceSummary` | `card` grid + status chip |
| Next Action Queue | 커스텀 `ReconciliationNextActionQueue` | `card`/button list + priority chip |
| Source Tabs / Filters | 커스텀 `ReconciliationLedgerFilters` | segmented tabs + search input + display settings button |
| Reconciliation Ledger Table | 커스텀 `ReconciliationLedgerTable` | dense `table`, source marker, linked evidence chip, account/counterparty controls |
| Evidence Link Status | 공용 `StatusChip` 확장 | ok/warn/danger/muted |
| Work Panel Conclusion | 커스텀 `ReconciliationWorkPanelConclusion` | 선택 행 한 줄 결론 + primary action |
| Batch Suggestion Bar | 커스텀 `ReconciliationBatchSuggestionBar` | 동일 근거 반복 제안 그룹 + 명시 확인 버튼 |
| Exclusion Review Action | 커스텀 row action group | 업무사용/제외/메모 버튼 |
| Tax File Gate Panel | 커스텀 `TaxFileReadinessPanel` | line list + status chip |
| Tax Blocker Reasons | 커스텀 `ReconciliationTaxBlockerReasons` | 세목별 blocker reason list |
| Closing Checklist | 커스텀 `ReconciliationClosingChecklist` | 증빙·소명·계정·제외·세목 blocker zero-state |
| Source Back Link / Recent Undo | 커스텀 `ReconciliationResolutionActions` | 자료수집 context link + 최근 적용 1건 취소 |
| State(로딩/빈/오류/권한 없음) | 공용 재사용 | skeleton + empty/error/no-permission state |

- 신규 라이브러리 없음. 사용자 제공 Clobe 참고 화면은 dense source ledger UX의 참고일 뿐, SemuAgent 컴포넌트는 기존 card/table/chip/button 패턴으로 만든다.
- 자료대조원장은 기존 기장검토 분류 큐를 대체하지 않고, Path 1 양식 생성 전 증빙 연결·계정확정·제외 검토를 한 화면에서 점검하는 하위 관문으로 구현한다.
- 기본 흐름은 `ReconciliationNextActionQueue`에서 시작하고, 출처 탭은 보조 탐색으로 둔다. 일괄 수락은 같은 근거·같은 추천을 가진 안전한 그룹에만 노출한다.

### 7.4 부가세 (UI Design 4.4)

| 화면 컴포넌트 | 구현 방식 | 기반 |
|:---|:---|:---|
| VAT Summary Hero | 커스텀 `VatSummaryHero` | `card` + 3셀 계산 레이아웃 + 상태 안내 |
| Sales Grouping Cards | 커스텀 `VatSalesGroupCards` | `card` + `badge` |
| Deduction Review Table | 커스텀 `VatDeductionReviewTable` | `table` + `badge` + 행 액션 `button` |
| Deduction Action Controls | 커스텀 `VatDeductionActions` | `button` + `sonner` 피드백 |
| Schedule Status List | 커스텀 `VatScheduleList` | `card` + 상태칩 |
| Filing Package Preview | 커스텀 `VatPackagePreview` | `card` + disabled `button` wrapper |
| Locked Action Wrapper | 커스텀 `LockedActionButton` | visible locknote + `aria-describedby`; 별도 tooltip 패키지 미도입 |
| State(로딩/빈/오류) | 공용 재사용 | `skeleton` + `button` |

- 신규 shadcn 없음. `progress`/`skeleton`과 기존 `card`/`badge`/`button`/`table` 재사용.
- 패키지 생성 버튼은 공제 검토 완료 전 `disabled` + `aria-disabled="true"` + visible locknote를 사용한다. 브라우저별 `title` 툴팁에 의존하지 않는다.
- 부가세 화면은 회사용 `/dashboard/vat`로 새로 구성하며, GIWA `/dashboard/reviews` 워크스페이스 컴포넌트를 import/render하지 않는다.
- 자동 홈택스 제출·자동 납부 UI는 만들지 않는다. 신고 준비값 확인과 접수증 보관은 JC-013 신고지원에서 최종 연결한다.

### 7.5 급여 (UI Design 4.5)

| 화면 컴포넌트 | 구현 방식 | 기반 |
|:---|:---|:---|
| Payroll Summary Hero | 커스텀 `PayrollSummaryHero` | `card` + 3셀 계산 레이아웃 + 상태칩 |
| Missing Employee Alert | 커스텀 `PayrollIssueAlert` | `card` + warn dot + `button` |
| Payroll Register Table | 커스텀 `PayrollRegisterTable` | `table` + `badge` + 가로 스크롤 |
| Deduction Breakdown | 커스텀 `PayrollDeductionBreakdown` | `card` + 항목 리스트 |
| Insurance Notice Import/Match | 커스텀 `PayrollInsuranceNoticePanel` | 파일 입력 + `button` + `badge` |
| Documents / Close | 커스텀 `PayrollDocumentsAndClose` | `card` + disabled `button` wrapper |
| Locked Action Wrapper | 공용 `LockedActionButton` 재사용 | visible locknote + `aria-describedby` |
| State(로딩/빈/오류) | 공용 재사용 | `skeleton` + `button` |

- 신규 shadcn 없음. 기존 `card`/`badge`/`button`/`table`/`input`/`skeleton` 재사용.
- 급여 화면은 회사용 `/dashboard/payroll`로 새로 구성하며, GIWA 사업장 상세의 급여 규칙 관리 패널을 import/render하지 않는다. 급여 규칙/추출/Excel draft 서비스는 순수 로직으로만 재사용한다.
- 4대보험은 건강보험 EDI/사회보험 고지내역 업로드 또는 수동 입력 후 직원별 매칭을 제공한다. 자동 로그인·공동인증서 저장·자동 제출은 만들지 않는다.
- 급여 마감 버튼은 확인 필요 직원이 있으면 `disabled` + `aria-disabled="true"` + visible locknote를 사용한다. 브라우저별 `title` 툴팁에 의존하지 않는다.
- 개인정보(주민등록번호·계좌·전화번호·storage key)는 화면에 노출하지 않고, 권한이 부족하면 직원명/급여액을 마스킹한다.

### 7.6 신고지원 (UI Design 4.6)

| 화면 컴포넌트 | 구현 방식 | 기반 |
|:---|:---|:---|
| Responsibility Banner | 커스텀 `FilingResponsibilityBanner` | `card` 계열 컨테이너 + 상태 아이콘 |
| Filing Item Card/List | 커스텀 `FilingItemList` / `FilingItemCard` | `card` + `badge` + `button` |
| Filing Package Actions | 커스텀 `FilingPackageActions` | `button` + 공용 `LockedActionButton` |
| Filing Preparation Values | 커스텀 `FilingPreparationValues` | 단계 리스트 + 확인 CTA |
| Receipt Storage | 커스텀 `FilingReceiptList` / `ReceiptUploadButton` | 파일 입력 + `button` + `badge` |
| Post-filing Checklist | 커스텀 `FilingChecklist` | checkbox/버튼형 토글 + 상태 텍스트 |
| State(로딩/빈/오류) | 공용 재사용 | `skeleton` + `button` |

- 신규 shadcn 없음. 기존 `card`/`badge`/`button`/`input`/`skeleton` 재사용.
- 신고지원 화면은 회사용 `/dashboard/filing-support`로 구성하며, 회사 홈 신고지원 카드는 전용 route로 연결한다.
- 부가세(JC-011)의 `vat_period_summary` package 상태와 급여(JC-012)의 `payroll_period_summary` 문서 상태를 내부 의존성으로 읽는다.
- 자동 홈택스 제출·자동 납부·홈택스/EDI 자격증명 저장 UI는 만들지 않는다. 책임 경계 배너와 하단 안내에서 사용자가 직접 제출/납부함을 명시한다.
- 접수증은 private storage에 저장하고 화면에는 안전한 파일명·제출일·보관 상태만 표시한다. `storageKey`/Blob URL은 렌더하지 않는다.

### 7.7 First-run Sample Data (UI Design 4.10)

| 화면 컴포넌트 | 구현 방식 | 기반 |
|:---|:---|:---|
| SampleDataBanner | 공용 `SampleDataBanner` | `card` + `badge` + `button` |
| SampleDataBadge | 공용 `SampleDataBadge` | `badge` |
| DeleteSampleDataDialog | 공용 `DeleteSampleDataDialog` | `dialog` + `button` |
| SampleRetryAction | 공용 `SampleRetryAction` | `button` + `sonner` |

- 신규 shadcn 없음. 기존 `card`/`badge`/`button`/`dialog`/`sonner` 재사용.
- 모든 dashboard workspace shell에서 같은 banner를 사용한다(DRY).
- 삭제 버튼은 destructive copy를 쓰되, 실제 색은 제품 톤을 해치지 않도록 muted danger accent로 제한한다.
- 구현 계약은 [First-run Sample Data Pre-Code Brief](./12_FIRST_RUN_SAMPLE_DATA_PRE_CODE_BRIEF.md)를 따른다.

## 8. Library Plan

### 8.1 이미 설치됨 — 재사용 (신규 설치 없음)

| 목적 | 라이브러리 | 사용처 |
|:---|:---|:---|
| UI 프리미티브 | `@base-ui/react`, `class-variance-authority`, `clsx`, `tailwind-merge`, `tw-animate-css` | shadcn 컴포넌트 기반 |
| 아이콘 | `lucide-react` | 사이드바·카드 아이콘 |
| Toast 피드백 | `sonner` | 업로드 성공/실패 알림 |
| 검증 | `zod` | 업로드 메타·API 입출력 검증 |
| 날짜/시간 | `luxon` | 마감 D-day, 업로드 일시 표시 |
| 파일 저장 | `@vercel/blob` | 업로드 원본 저장 |
| 파일 파싱 | `xlsx`, `pdf-parse`, `mammoth`, `word-extractor`, `officecrypto-tool` | 자료유형 정규화(기존 `lib/ai/extract`) |
| DB/Auth | `drizzle-orm`, `@libsql/client`, `better-auth` | 데이터·인증 |

### 8.2 의도적으로 추가하지 않음

| 후보 | 제외 사유 |
|:---|:---|
| `react-dropzone` | 네이티브 HTML5 drag&drop + `input[type=file]`로 충분. 의존성 최소화. |
| `@tanstack/react-table` | 홈·자료수집 표는 읽기/단순 상태 표시 수준. shadcn `table`로 충분. 정렬·가상화 요구 발생 시 재검토. |
| `react-hook-form` | 대상 화면에 복잡 폼 없음(업로드는 파일 입력 중심). 폼 복잡도 증가 시 재검토. |
| 신규 toast/date/state 라이브러리 | `sonner`/`luxon` 및 서버 컴포넌트+URL 상태로 충분. 전역 상태 매니저 불필요. |

## 9. 상태 관리 방침(요약)

- 회사 홈: **읽기 전용** — Server Component에서 데이터 페치, 클라이언트 상태 최소.
- 자료수집: 업로드/정규화 **mutation 발생** — 업로드 진행·오류는 로컬 컴포넌트 상태 + `sonner` 토스트. 목록 갱신은 서버 재검증.
- 급여: 직원 line 수정·고지액 import/match·명세서 생성·마감 **mutation 발생** — 로컬 입력 상태 + `sonner` 토스트, 성공 후 서버 재검증.
- 신고지원: 접수증 업로드/삭제·체크리스트 토글 **mutation 발생** — 성공 후 서버 재검증. 홈택스 직접입력용 준비값 복사는 제공하지 않음.
- 기간 컨텍스트는 URL 파라미터로 관리(전역 스토어 미도입).

## 10. 미결/후속

- 회사 홈 Pre-Code Brief: [04_COMPANY_HOME_PRE_CODE_BRIEF.md](./04_COMPANY_HOME_PRE_CODE_BRIEF.md) (JC-006 구현·머지 완료).
- 자료수집 Pre-Code Brief: [05_SOURCE_COLLECTION_PRE_CODE_BRIEF.md](./05_SOURCE_COLLECTION_PRE_CODE_BRIEF.md) (JC-009 구현·머지 완료).
- 기장검토 Pre-Code Brief: [06_BOOKKEEPING_REVIEW_PRE_CODE_BRIEF.md](./06_BOOKKEEPING_REVIEW_PRE_CODE_BRIEF.md) (JC-010 구현·머지 완료).
- 부가세 Pre-Code Brief: [07_VAT_PRE_CODE_BRIEF.md](./07_VAT_PRE_CODE_BRIEF.md) (JC-011 구현·머지 완료).
- 급여 Pre-Code Brief: [08_PAYROLL_PRE_CODE_BRIEF.md](./08_PAYROLL_PRE_CODE_BRIEF.md) (JC-012 구현·머지 완료).
- 신고지원 Pre-Code Brief: [09_FILING_SUPPORT_PRE_CODE_BRIEF.md](./09_FILING_SUPPORT_PRE_CODE_BRIEF.md) (JC-013 게이트 완료, 구현 PR에서 물리 migration·workspace 적용).
- First-run Sample Data Pre-Code Brief: [12_FIRST_RUN_SAMPLE_DATA_PRE_CODE_BRIEF.md](./12_FIRST_RUN_SAMPLE_DATA_PRE_CODE_BRIEF.md) (JC-019 게이트 완료 후 구현 PR에서 migration·seed/delete API 적용).
- Business Status Report Pre-Code Brief: [23_BUSINESS_STATUS_REPORT_PRE_CODE_BRIEF.md](./23_BUSINESS_STATUS_REPORT_PRE_CODE_BRIEF.md) (JC-028 UI-First Gate 승인 후 구현 계약).

## 11. Related Documents
- **Concept_Design**: [Product Baseline](../01_Concept_Design/01_PRODUCT_BASELINE.md) - 제품 목적 및 사용자
- **UI_Screens**: [UI Design](../02_UI_Screens/01_UI_DESIGN.md) - 컴포넌트 4.1~4.5 근거
- **UI_Screens**: [Screen Flow](../02_UI_Screens/00_SCREEN_FLOW.md) - 화면 흐름·데이터 입출력
- **UI_Screens**: [HTML Preview 폴더](../02_UI_Screens/previews/) - 화면 프로토타입
- **Technical_Specs**: [Development Setup](./01_DEVELOPMENT_SETUP.md) - 런타임·패키지·스택
- **Technical_Specs**: [Company Home Pre-Code Brief](./04_COMPANY_HOME_PRE_CODE_BRIEF.md) - 회사 홈 데이터 소스·상태·acceptance 계약
- **Technical_Specs**: [Source Collection Pre-Code Brief](./05_SOURCE_COLLECTION_PRE_CODE_BRIEF.md) - 자료수집 mutation·라우트·acceptance 계약
- **Technical_Specs**: [Bookkeeping Review Pre-Code Brief](./06_BOOKKEEPING_REVIEW_PRE_CODE_BRIEF.md) - 기장검토 분류 큐·승인 mutation·Preview 계약
- **Technical_Specs**: [VAT Pre-Code Brief](./07_VAT_PRE_CODE_BRIEF.md) - 부가세 세액 집계·공제 검토·패키지 잠금 계약
- **Technical_Specs**: [Payroll Pre-Code Brief](./08_PAYROLL_PRE_CODE_BRIEF.md) - 급여대장·고지액 매칭·마감 잠금 계약
- **Technical_Specs**: [Filing Support Pre-Code Brief](./09_FILING_SUPPORT_PRE_CODE_BRIEF.md) - 신고 항목·준비값 확인·접수증 보관 계약
- **Technical_Specs**: [First-run Sample Data Pre-Code Brief](./12_FIRST_RUN_SAMPLE_DATA_PRE_CODE_BRIEF.md) - 샘플 banner/dialog 컴포넌트 계약
- **Technical_Specs**: [Business Status Report Pre-Code Brief](./23_BUSINESS_STATUS_REPORT_PRE_CODE_BRIEF.md) - 사업장현황신고 read-only 집계·허브 트랙 계약
- **Logic_Progress**: [Backlog](../04_Logic_Progress/00_BACKLOG.md) - JC-006/JC-009/JC-010/JC-011/JC-012/JC-013 Context Lock
