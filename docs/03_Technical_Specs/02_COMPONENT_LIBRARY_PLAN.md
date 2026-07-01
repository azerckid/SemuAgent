# Component & Library Plan
> Created: 2026-07-01 20:05
> Last Updated: 2026-07-01 22:55

## 1. 목적 및 범위

Component & Library Planning Gate 충족을 위한 계획. React 구현 전, 사용할
컴포넌트·라이브러리·shadcn preset 적용 방침을 확정한다.

대상 화면(사용자 확인 완료):
- 회사 홈 — [00_company_home.html](../02_UI_Screens/previews/00_company_home.html)
- 자료수집 — [01_source_collection.html](../02_UI_Screens/previews/01_source_collection.html)

원칙: **JARYO-GIWA 자산 최대 재사용 + 최소 신규 도입(YAGNI/KISS/DRY)**. 이미 설치된
것을 우선 쓰고, 없을 때만 shadcn 표준 컴포넌트를 추가한다. 새 npm 패키지는 이 두 화면
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

이 두 개 외 신규 shadcn 컴포넌트는 두 화면에서 필요 없음.

## 6. 재사용할 기존(GIWA) 컴포넌트

| 컴포넌트 | 경로 | 재사용 조건 |
|:---|:---|:---|
| Sidebar | `app/(dashboard)/_components/sidebar.tsx` | 네비 항목을 회사용(홈·자료수집·기장검토·부가세·급여·신고지원·설정)으로 정리. "고객 요청/회계사" 문구 제거(JC-004 연계) |
| Sidebar nav link | `app/(dashboard)/_components/sidebar-nav-link.tsx` | 활성 상태·라우팅 그대로 사용 |
| Sign-out button | `app/(dashboard)/_components/sidebar-sign-out-button.tsx` | 사용자 영역에 재사용 |
| shadcn `table` | `components/ui/table.tsx` | 최근 제출·영수증(홈), 수집 상태(자료수집) |
| shadcn `card`/`badge`/`button` | `components/ui/*` | 카드·상태칩·CTA 전반 |

주의: `sidebar-mail-nav.tsx`, `usage-help`, `field-test-concierge`는 GIWA 세무사무소
문맥이므로 두 화면 범위에서는 재사용하지 않는다(별도 검토 대상).

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
`EmptyState`, `ErrorState`)는 두 화면이 공유한다(DRY).

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
| `react-hook-form` | 두 화면에 복잡 폼 없음(업로드는 파일 입력 중심). 폼 복잡도 증가 시 재검토. |
| 신규 toast/date/state 라이브러리 | `sonner`/`luxon` 및 서버 컴포넌트+URL 상태로 충분. 전역 상태 매니저 불필요. |

## 9. 상태 관리 방침(요약)

- 회사 홈: **읽기 전용** — Server Component에서 데이터 페치, 클라이언트 상태 최소.
- 자료수집: 업로드/정규화 **mutation 발생** — 업로드 진행·오류는 로컬 컴포넌트 상태 + `sonner` 토스트. 목록 갱신은 서버 재검증.
- 기간 컨텍스트는 URL 파라미터로 관리(전역 스토어 미도입).

## 10. 미결/후속

- 회사 홈 Pre-Code Brief: [04_COMPANY_HOME_PRE_CODE_BRIEF.md](./04_COMPANY_HOME_PRE_CODE_BRIEF.md) (JC-006 구현·머지 완료).
- 자료수집 Pre-Code Brief: [05_SOURCE_COLLECTION_PRE_CODE_BRIEF.md](./05_SOURCE_COLLECTION_PRE_CODE_BRIEF.md) (JC-009 게이트 완료, 구현 착수 가능).
- 기장검토·부가세·급여·신고지원은 구현 전 화면별 Pre-Code Brief와 QA 시나리오가 필요하다.

## 11. Related Documents
- **Concept_Design**: [Product Baseline](../01_Concept_Design/01_PRODUCT_BASELINE.md) - 제품 목적 및 사용자
- **UI_Screens**: [UI Design](../02_UI_Screens/01_UI_DESIGN.md) - 컴포넌트 4.1/4.2 근거
- **UI_Screens**: [Screen Flow](../02_UI_Screens/00_SCREEN_FLOW.md) - 화면 흐름·데이터 입출력
- **UI_Screens**: [HTML Preview 폴더](../02_UI_Screens/previews/) - 화면 프로토타입
- **Technical_Specs**: [Development Setup](./01_DEVELOPMENT_SETUP.md) - 런타임·패키지·스택
- **Technical_Specs**: [Company Home Pre-Code Brief](./04_COMPANY_HOME_PRE_CODE_BRIEF.md) - 회사 홈 데이터 소스·상태·acceptance 계약
- **Technical_Specs**: [Source Collection Pre-Code Brief](./05_SOURCE_COLLECTION_PRE_CODE_BRIEF.md) - 자료수집 mutation·라우트·acceptance 계약
- **Logic_Progress**: [Backlog](../04_Logic_Progress/00_BACKLOG.md) - JC-006/JC-009 Context Lock
