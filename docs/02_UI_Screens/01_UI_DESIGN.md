# SemuAgent UI Design
> Created: 2026-07-01 19:40
> Last Updated: 2026-07-04 17:13

## 1. 디자인 방향

- 성격: B2B 세무·회계 운영 도구. 신뢰감·가독성·밀도 우선. 장식보다 정보 명료성.
- 기반: JARYO-GIWA의 shadcn/ui + Tailwind 자산 재사용. 중립(zinc/slate) 팔레트.
- 톤: 마케팅적 과장 없음. 첫 화면부터 "작동하는 제품"(대시보드).
- 이모지 미사용, 상태는 색상 + 텍스트 라벨로 이중 전달.

## 2. 디자인 토큰 (HTML Preview 기준)

| 토큰 | 값 | 용도 |
|:---|:---|:---|
| bg | `#f6f6f7` | 앱 배경 |
| surface | `#ffffff` | 카드·패널 |
| border | `#e4e4e7` | 기본 경계선 |
| fg | `#18181b` | 본문 텍스트 |
| fg-muted | `#71717a` | 보조 텍스트 |
| accent | `#2563eb` | 주요 강조·링크 |
| ok / warn / danger | `#16a34a` / `#d97706` / `#dc2626` | 상태 (완료/주의/위험) |
| radius | `12px` | 카드 모서리 |

상태칩은 각 색상의 soft 배경 + 동일 색 테두리로 표현한다 (ok/warn/danger/muted).

## 3. 레이아웃 구조

```
┌───────────┬─────────────────────────────────────┐
│  Sidebar  │  Topbar (화면명 · 회사명 · 기간선택)   │
│  248px    ├─────────────────────────────────────┤
│           │  Content (max 1200px)                │
│  브랜드    │   1) 회계기간 Hero (진행률·마감 D-day) │
│  네비게이션 │   2) 다음 할 일 (신고 전 blockers)     │
│  (홈 활성) │   3) 준비 현황 카드 3열 그리드          │
│           │   4) 최근 제출·영수증 테이블            │
│  사용자    │   5) 화면 상태 예시(로딩/빈/오류)       │
└───────────┴─────────────────────────────────────┘
```

- Sidebar: 브랜드 → "회사 홈"(활성) → 운영 흐름(자료수집·기장검토·부가세·급여·신고지원·신고 준비) → 관리(설정) → 사용자.
  아직 미구현 화면은 "다음" 배지로 표기.
- Topbar: 회계기간·신고구분 선택 pill을 우측 정렬. 컨텍스트 전환의 단일 지점.

## 4. 핵심 컴포넌트

### 4.1 회사 홈 (00_company_home.html)

| 컴포넌트 | 역할 | 상태 |
|:---|:---|:---|
| 회계기간 Hero | 현재 기간·진행률·마감일 강조 | 진행 중 / 마감 임박(D-day 강조) |
| Action Row | 신고 전 해결 항목 + CTA | danger/warn/ok dot로 우선순위 |
| Status Card | 워크스페이스 집계 요약 | 값 + 상태칩, 클릭 시 라우팅 |
| Recent Table | 제출·영수증 이력 | 구분·항목·기간·상태·일시 |
| State Card | 로딩/빈/오류 표준 | 스켈레톤·빈안내·오류+재시도 |

### 4.2 자료수집 (01_source_collection.html)

| 컴포넌트 | 역할 | 상태 |
|:---|:---|:---|
| Completeness Header | 수집 완결성 진행률 + 미수집 건수 강조 | 진행률 바 + 우측 카운트 |
| Upload Dropzone | 회사 내부 파일 업로드 진입점 | 지원 형식·용량 안내 + primary "파일 선택" |
| Source Type Tile | 자료유형별(세금계산서/통장/카드/영수증) 집계·정규화 상태 | ok(정규화 완료) / warn(미수집) / blue(정규화 대기) |
| Import Status Table | 업로드→파싱→정규화 진행 상황 | mini-progress 바 + 상태칩, 파싱 오류는 danger + "다시 시도" |
| Missing Checklist | 신고 전 확보해야 할 자료 목록 + CTA | warn/ok dot, "다시 업로드"·"정규화 확인" |
| State Card | 로딩/빈/오류 표준 (홈과 공용) | 스켈레톤·빈안내·오류+재시도 |

- 상태칩 색상 규약은 두 화면 공통(ok/warn/danger/muted/blue). 표·카드·상태 예시(State Card)는 화면 간 재사용한다.
- 자료수집은 mutation(업로드·정규화)이 발생하므로, 업로드/재시도 CTA에 진행(mini-progress)·오류(danger) 상태를 명시적으로 노출한다.

### 4.3 기장검토 (02_bookkeeping_review.html)

| 컴포넌트 | 역할 | 상태 |
|:---|:---|:---|
| Classification Header | 거래 분류 현황(확정/대기)·진행률 강조 | 진행률 바 + 우측 대기 카운트(danger) |
| Queue Tabs | 검토 대기 / 신뢰도 낮음 / 확정 / 전체 필터 | 세그먼트 탭(active 강조) + 건수 배지 |
| Bulk Action Bar | 다중 선택 일괄 승인·계정 변경 | primary "선택 N건 승인" + ghost "일괄 변경" |
| Classification Queue Table | 거래별 AI 추천 계정과목·신뢰도·처리 | 체크박스 + AI 배지 + Confidence Bar + 행 액션(승인/수정/계정 지정) |
| Confidence Bar | AI 추천 신뢰도 시각화 | high(ok) / mid(warn) / low(danger), 낮으면 "계정 지정" 강제 |
| Journal Entry Preview | 확정 전 분개(차변/대변) 미리보기 | `card` 내 전표 표(부가세대급금 포함), 차·대변 합계 일치 표시 |
| Period Attribution / Approval | 귀속 기간·증빙·부가세 공제·승인 | 속성 리스트 + 상태칩 + "이 거래 승인" |
| State Card | 로딩/빈/오류 표준 (공용) | 스켈레톤·빈안내(확정 전표 보기)·오류+재시도 |

- 사이드바 "기장검토"에는 검토 대기 건수 카운트 배지(danger)를 노출한다.
- AI 추천은 초안이며 확정 책임은 사용자에게 있다. 신뢰도 낮은 항목은 승인 전 "계정 지정"으로 강제 확인시킨다.
- 상태칩·State Card·Table 골격은 회사 홈/자료수집과 공통(DRY).

### 4.4 부가세 (03_vat.html)

| 컴포넌트 | 역할 | 상태 |
|:---|:---|:---|
| Tax Summary Hero | 매출세액 − 매입세액 = 납부(예정)세액 강조, 마감 D-day | 3셀 계산 레이아웃 + 예정치 안내 + D-day 칩 |
| Sales Grouping Cards | 과세 / 영세율 / 면세 그룹별 공급가액·매출세액 | 3카드, 그룹 태그(tax/zero/exempt) |
| Deduction Review Table | 매입세액 공제 검토 | 공제 확정(ok) / 불공제 후보(danger) / 안분 필요(warn), 판정·사유·처리 |
| Schedules List | 부속 명세(합계표·수취명세서·불공제명세서) 준비 상태 | 서식별 준비됨/검토 대기 상태칩 |
| Filing Package Preview | 신고 패키지(PDF) + 홈택스 입력 가이드 | 미리보기 파일 + **생성 버튼 잠금**(검토 완료 전) |
| State Card | 로딩/빈/오류 표준 (공용) | 스켈레톤·빈안내(기장검토 먼저 확정)·오류+재시도 |

- 사이드바 "부가세"에 공제 검토 대기 건수 카운트 배지(warn)를 노출한다.
- **패키지 생성 잠금**: 불공제 후보 검토가 끝나기 전에는 `is-disabled` + `disabled` + `aria-disabled="true"` muted 버튼으로 잠금을 명시하고, 위에 사유(locknote)를 함께 노출한다.
  - 구현 노트: disabled 버튼의 `title` 툴팁은 브라우저별 표시가 일관되지 않으므로, React 구현 시 비활성 버튼을 래퍼(tooltip 컴포넌트)로 감싸 잠금 사유를 접근성 있게 노출한다.
- **자동 홈택스 제출은 범위 밖**(패키지 생성 + 입력 가이드까지). 세액은 검토 완료 전 "예정"으로 표기한다.
- 상태칩·State Card·Table 골격은 앞 화면들과 공통(DRY).

### 4.5 급여 (04_payroll.html)

| 컴포넌트 | 역할 | 상태 |
|:---|:---|:---|
| Payroll Summary Hero | 지급총액·공제총액·실지급액·마감상태 요약 | 3셀 계산 레이아웃 + 마감 상태칩(확인 필요/미마감) |
| Missing/Error Alert | 확인 필요(오류·누락) 직원 경고 + CTA | warn 배경 알림, 마감 전 처리 유도 |
| Payroll Register Table | 직원별 기본급·수당·지급계·원천세·4대보험·공제계·실지급 | 가로 스크롤 표, 오류 직원 행 강조 + "확인 필요" 플래그, tfoot 합계 |
| Deduction Breakdown | 소득세·지방소득세·국민연금·건강보험·장기요양·고용보험 집계 | `card` 내 항목 리스트 + 총계, 고지액 반영 여부 |
| Insurance Notice Match | 건강보험 EDI/사회보험 고지내역 업로드·수동 입력·직원 매칭 | 파일/수동 입력 CTA + 매칭 상태칩 |
| Documents / Close | 급여명세서·지급명세서 미리보기 + 급여 마감·확정 | 문서 리스트 + **마감 버튼 잠금**(확인 필요 처리 전) |
| State Card | 로딩/빈/오류 표준 (공용) | 스켈레톤·빈안내(급여 자료 불러오기)·오류+재시도 |

- **금액 정합성 규칙**: 지급계=기본급+수당, 공제계=원천세+4대보험, 실지급=지급계−공제계. 합계 행은 각 열의 합과 일치해야 한다(구현 시 파생 계산으로 강제, 하드코딩 금지).
- **4대보험 고지액 규칙**: 건강보험 EDI/사회보험 고지내역을 업로드 또는 수동 입력으로 반영한다. 고지액이 있으면 계산 추정값보다 우선하고, 미매칭/차이는 확인 필요로 표시한다. 자동 로그인·공동인증서 저장·자동 제출은 만들지 않는다.
- **마감 잠금**: 확인 필요(오류/누락) 직원이 있으면 마감 버튼을 `is-disabled`+`disabled`+`aria-disabled="true"` muted로 잠그고 사유를 병기한다. React 구현 시 disabled 버튼을 래퍼(tooltip)로 감싼다(부가세 패키지 생성 버튼과 동일 규칙).
- **개인정보**: 급여·주민정보 등 민감정보 표시. 접근 권한·마스킹·감사로그는 구현 단계에서 확정.
- 원천징수 지급명세서 등은 신고지원 화면으로 전달한다.
- 상태칩·State Card·Table 골격은 앞 화면들과 공통(DRY).

### 4.6 신고지원 (05_filing_support.html)

| 컴포넌트 | 역할 | 상태 |
|:---|:---|:---|
| Responsibility Banner | 자동 제출·납부 없음(책임 경계) 상단 고지 | accent 배너, 하단 안내와 반복 |
| Filing Item Card | 신고 항목별(부가세/원천세/4대보험) 패키지 상태 + CTA | 준비됨(ok)/패키지 대기(warn)/확인 필요, 부가세 패키지는 검토 전 잠금 |
| Hometax Input Guide | 홈택스 단계별 입력 값 안내 | 단계 리스트(done/대기) + 입력 값 강조 + "가이드 값 복사" |
| Receipts Storage | 제출 접수증 업로드·보관 | 접수증 목록 + 빈 항목(제출 후 업로드 대기) |
| Post-filing Checklist | 납부·보관 사후 확인 | 체크박스(완료 취소선) |
| State Card | 로딩/빈/오류 표준 (공용) | 스켈레톤·빈안내(부가세·급여 먼저 확정)·오류+재시도 |

- **책임 경계 규칙**: 자동 홈택스 제출·자동 납부·자격증명 서버 저장은 제공하지 않는다. 배너·항목·하단 안내에 반복 노출한다.
- 신고 항목은 부가세(JC-011)·급여(JC-012) 산출물과 연동한다. 부가세 패키지는 공제 검토 완료 전 잠금(부가세 화면 규칙과 동일).
- 상태칩·State Card·Table 골격은 앞 화면들과 공통(DRY).

### 4.7 화면 간 내비게이션

- 사이드바 항목·브랜드·breadcrumb를 모두 `<a>`로 처리(`a { color: inherit; text-decoration: none }`).
- 회사 홈 → 자료수집/기장검토/부가세: 사이드바 + 해당 Action Row "…열기". 급여·신고지원은 사이드바로 진입.
- 운영 흐름 화면(자료수집·기장검토·부가세·급여·신고지원) → 회사 홈: 사이드바 "회사 홈" + 브랜드 + 상단 breadcrumb.
- 신고지원 항목의 "부가세 열기 / 급여 열기"로 선행 화면과 직접 연동.
- 운영 흐름 6개 화면 전체가 사이드바로 상호 이동 가능하다.
- 직원 명부는 사이드바 "관리" 그룹의 설정 아래 항목으로 진입하며, 6개 워크스페이스 프리뷰와 상호 이동한다.
- 리마인드는 사이드바 "관리" 그룹의 직원 명부 아래 항목으로 진입하며, 전 화면과 상호 이동한다.
- 신고 준비는 사이드바 "운영 흐름" 그룹의 신고지원 아래 항목으로 진입하며, 공통 기반(자료수집·기장검토)과 병렬 신고 트랙의 입력·산출·handoff 상태를 보여준다(JC-029).
- 구현된 화면은 사이드바 "다음" 배지를 제거한다.

### 4.8 직원 명부 (06_employee_directory.html)

| 컴포넌트 | 역할 | 상태 |
|:---|:---|:---|
| Stats Row | 재직·급여 대상·4대보험 확인 필요·퇴사 카운트 | 확인 필요 카드는 warn 강조 |
| Toolbar | 이름·사번·부서 검색 + 재직 상태/급여 대상 필터 | 세그먼트 토글 |
| Employee Table | 직원별 재직 상태·급여 대상·4대보험 확인·입사일·최근 급여·업무 이메일 | 상태칩(재직/휴직/퇴사, 대상/제외, 가입 확인/확인 필요/해당 없음), 확인 필요 행 강조 |
| Add/Edit Panel | 직원 추가·수정(이름·사번·부서·직책·재직상태·입사일·업무 이메일), 급여 대상·리마인드 수신 토글 | 개인정보 최소 수집 안내 포함 |
| Linkage Card | 급여·4대보험 매칭·내부 리마인드 연결 상태 | 참조 화면 표시 |
| State Card | 로딩/빈(첫 직원 추가)/오류 표준 (공용) | 스켈레톤·빈안내·오류+재시도 |

- **개인정보 경계 규칙**: 주민등록번호·계좌번호·전화번호 원문은 저장·노출하지 않는다. 이름·사번·부서·업무 이메일만 관리한다. 패널·하단 안내에 반복 노출한다.
- 직원 명부는 급여 실행 결과(`payroll_employee_line`)와 분리된 상시 마스터이며, 급여·4대보험 고지액 매칭·내부 리마인드(JC-016) 수신자의 기준 데이터다.
- 상태칩·State Card·Table 골격은 앞 화면들과 공통(DRY).

### 4.9 리마인드 (07_internal_reminder.html)

| 컴포넌트 | 역할 | 상태 |
|:---|:---|:---|
| Internal-only Banner | 회사 내부 업무 알림 책임 경계 고지 | accent 배너, 고객사 메일·자동 제출/납부 없음 반복 |
| Stats Row | 활성 규칙·리마인드 대상(확인 필요)·발송 실패 카운트 | 대상 카드는 warn 강조 |
| Rule List | 업무 영역별(자료수집/기장검토/부가세/급여/신고지원) 규칙 | 트리거 태그(마감 D-7/D-3/D-1·일일 요약·수동), 활성 토글, 테스트 발송 |
| Recipient Preview | 담당자 본인·내부 staff 수신자 | 본인/staff 칩, 알림 꺼짐 대상은 제외 표시 |
| Send Log Table | 최근 발송 로그 | 상태칩(발송됨/실패/스킵), 실패 사유·중복 방지(idempotency) |
| State Card | 로딩/빈/오류 + provider missing 표준 | 스켈레톤·빈안내(첫 규칙)·오류+재시도·발송 설정 안내 |

- **책임 경계 규칙**: 회사 내부 업무 알림이다. 고객사 요청 메일, 외부 업로드 포털 초대, 자동 홈택스 제출·납부는 제공하지 않는다. 배너·하단 안내에 반복 노출한다.
- 수신자는 담당자 본인·내부 staff에서 파생하며, notification 꺼진 대상은 제외한다. 직원 명부(JC-015) 기반 직원 수신은 후속.
- 신고 준비 일정(마감 D-day)·확인 필요 상태를 담당자 본인에게 리마인드하는 자가 알림이 v1 핵심 흐름이다.
- 상태칩·State Card·Table 골격은 앞 화면들과 공통(DRY).

### 4.10 신고 준비 (08_filing_preparation.html)

| 컴포넌트 | 역할 | 상태 |
|:---|:---|:---|
| Filing Preparation Hero | 신고서에 넣을 확정 데이터 준비율·확인 필요·handoff 상태를 요약 | 진행률 + blocker 카운트 |
| Next Action List | 신고 전 처리해야 할 blocker와 해당 워크스페이스 CTA | danger/warn/ok dot + 라우팅 |
| Common Foundation Cards | 자료수집 -> 기장검토 공통 기반의 입력·산출 상태 | 누락/검토대기/원장 준비 상태칩 |
| Track Cards | 원천세·부가세·지급명세서/연말정산·지방소득세 병렬 트랙 | 입력/산출/handoff 3단 계약 + 상태칩 |
| Schedule Strip | 다가오는 마감·D-day | 일정은 보조 정보, 중심 프레임 아님 |
| Responsibility Boundary | 직접 신고·자동제출 제외 경계 | accent 안내 박스 |
| State Card | 로딩/빈/오류/권한 없음 표준 | 스켈레톤·빈안내·오류+재시도 |

- 화면의 중심 질문은 "언제까지 무엇을 해야 하는가"가 아니라 "홈택스·위택스에 넣을 확정 데이터가 준비됐는가"다.
- 세무 일정은 하단 보조 섹션으로만 둔다.
- 자동제출·신규 산출 엔진·신규 DB는 JC-029 Preview 범위 밖이다.
- 상태칩·State Card·Table 골격은 앞 화면들과 공통(DRY).

### 4.11 지급명세서·연말정산 (09_payment_year_end.html, JC-024)

신고 준비 허브(4.10)의 "지급명세서/연말정산" 트랙 "열기"로 진입하는 전용 검토 화면. 급여·직원 명부 데이터를 반기/연 단위로 집계한 **read-only** 화면이다.

| 컴포넌트 | 역할 | 상태 |
|:---|:---|:---|
| Prep Hero | 대상 인원·확인 필요(누락)·데이터 준비 완료 요약 | 진행률 + 카운트 |
| Next Action List | 급여 미확정·인적사항 누락 blocker + 급여/직원 명부 CTA | danger/warn dot + 라우팅 |
| 간이지급명세서 Table | 직원별 귀속기간·지급총액·원천징수세액·준비 상태(근로소득 반기) | 준비완료/누락 월/확인 필요 상태칩 |
| 연말정산 Table | 직원별 재직·연간 지급합계·기납부 원천세·누락·검토 상태 | 검토 준비/월 급여 필요/중도정산 검토 |
| Responsibility Boundary | 신고 준비 데이터까지·정산액 계산·전자신고 파일(JC-030)·홈택스 제출 제외 | accent 안내 박스 |
| State Card | 로딩/빈/오류/권한 없음 표준 | 스켈레톤·빈안내·오류+재시도 |

- 화면 언어는 "제출용"이 아니라 **"신고 준비 데이터"** 로 통일한다(제출 대행 뉘앙스 회피).
- 단일 스크롤·직원 중심 표. mutation 없음(확인 필요는 기존 업무 화면으로 라우팅).
- 정산액 계산·전자신고 파일 생성·자동제출은 JC-024 v1 범위 밖. 상태칩·State Card·Table 골격은 공통(DRY).

### 4.12 지방소득세 (10_local_income_tax.html, JC-027)

신고 준비 허브(4.10)의 "지방소득세" 트랙 "검토 화면"으로 진입하는 전용 화면. 허브의 마지막 roadmap 트랙을 live로 채운다. 급여에 이미 기록된 `localIncomeTaxKrw`(원천세 특별징수분)를 집계한 **read-only** 화면이다.

| 컴포넌트 | 역할 | 상태 |
|:---|:---|:---|
| Prep Hero | 대상 인원·확인 필요·지방소득세 합계 요약, "근사치 재계산 아님" 명시 | 진행률 + 카운트 |
| Next Action List | 급여 미확정 blocker + 급여 CTA | danger dot + 라우팅 |
| 지방소득세 Table | 직원별 지급총액·소득세(국세)·지방소득세(특별징수)·상태 + 합계 행 | 준비완료/급여 미확정 상태칩 |
| Consistency Banner | 신고지원(JC-013)과 동일한 실제값임을 명시 | plan 톤 안내 박스 |
| Responsibility Boundary | 종합소득세·법인세분 지방소득세·위택스 제출 제외 | accent 안내 박스 |
| State Card | 로딩/빈/오류/권한 없음 표준 | 스켈레톤·빈안내·오류+재시도 |

- v1은 **원천세 특별징수분만**. 종합소득세분·법인세분 지방소득세는 JC-025/026 이후.
- 화면 언어는 "귀속기간·원천세 신고 주기 기준"으로, 월 단위를 못박지 않는다(반기납부 특례 고려).
- 소득세(국세)와 지방소득세(특별징수)를 컬럼으로 명확히 분리해 "원천징수세액"으로 뭉뚱그리지 않는다.
- 신고지원(JC-013)의 `splitWithholdingTax` 근사치를 이 화면과 같은 실제값으로 교체(정합성 수정, 구현 시 함께 진행).
- 단일 스크롤·직원 중심 표. mutation 없음. 상태칩·State Card·Table 골격은 공통(DRY).

### 4.13 First-run Sample Data (JC-019)

| 컴포넌트 | 역할 | 상태 |
|:---|:---|:---|
| SampleDataBanner | 모든 dashboard 화면 상단에서 샘플 데이터임을 고지 | active / creating / failed / deleting |
| SampleDataBadge | 주요 heading·table caption에 샘플 표시 보조 | muted + warn accent |
| DeleteSampleDataDialog | 샘플 전체 삭제 확인 | 실제 데이터 보존 설명 + confirm/cancel |
| SampleRetryAction | 샘플 생성 실패 시 재시도 | secondary button + 오류 문구 |

- banner 필수 문구: "샘플 데이터로 보는 화면입니다" / "실제 신고 전에 샘플을 삭제하고 회사 자료를 업로드하세요".
- CTA: "샘플 데이터 삭제하고 실제 사용 시작". 파괴적 성격이 있으므로 확인 dialog를 반드시 거친다.
- 삭제 dialog는 "샘플 데이터만 삭제", "실제 업로드·급여·신고 데이터 보존", "삭제 후 자동 재생성 없음"을 명시한다.
- 기존 8개 승인 Preview의 채워진 화면을 first-run sample 목표 상태로 사용한다. 별도 신규 HTML Preview는 만들지 않고, 이 섹션과 [First-run Sample Data Pre-Code Brief](../03_Technical_Specs/12_FIRST_RUN_SAMPLE_DATA_PRE_CODE_BRIEF.md)를 구현 계약으로 삼는다.
- 상태칩·버튼·dialog는 기존 shadcn `card`/`badge`/`button`/`dialog`를 재사용한다.

## 5. 핵심 CTA 우선순위

**회사 홈**
1. 다음 할 일의 워크스페이스 진입 버튼 (가장 강한 primary, brand 색 채움)
2. 준비 현황 카드 클릭 (전체 카드가 클릭 대상)
3. 기간 선택 pill (컨텍스트 전환)

**자료수집**
1. 업로드 드롭존 "파일 선택" (primary, brand 색 채움)
2. 파싱 오류·미수집 항목의 "다시 업로드 / 정규화 확인"
3. 수집 상태 표의 행별 "보기 / 다시 시도"

**기장검토**
1. "선택 N건 승인" / "이 거래 승인" (primary, brand 색 채움)
2. 신뢰도 낮은 거래의 "계정 지정" (승인 전 강제 확인)
3. 행별 "승인 / 수정", 탭 전환(검토 대기/신뢰도 낮음/확정/전체)

**부가세**
1. 불공제 후보 "불공제 확정 / 공제", 공통매입 "안분 계산" (공제 검토)
2. "패키지 생성" — 단, 검토 완료 전에는 잠금(비활성)
3. "전체 매입 보기" 등 상세 이동

**급여**
1. 확인 필요 직원 "해당 직원 열기" (마감 전 처리)
2. "급여 마감·확정" — 단, 확인 필요 처리 전에는 잠금(비활성)
3. 급여명세서/지급명세서 "미리보기", "엑셀 내보내기"

**신고지원**
1. 신고 항목 "패키지 열기"(준비됨) / "부가세·급여 열기"(선행 화면 연동)
2. "가이드 값 복사" (홈택스 직접 입력 보조, 자동 제출 아님)
3. 접수증 업로드, 사후 체크리스트 체크

**First-run Sample**
1. 전역 banner의 "샘플 데이터 삭제하고 실제 사용 시작"
2. 삭제 확인 dialog의 최종 confirm
3. 샘플 생성 실패 시 "샘플 데이터 다시 만들기"

## 6. HTML UI Preview

- Preview (회사 홈): [00_company_home.html](./previews/00_company_home.html)
- Preview (자료수집): [01_source_collection.html](./previews/01_source_collection.html)
- Preview (기장검토): [02_bookkeeping_review.html](./previews/02_bookkeeping_review.html)
- Preview (부가세): [03_vat.html](./previews/03_vat.html)
- Preview (급여): [04_payroll.html](./previews/04_payroll.html)
- Preview (신고지원): [05_filing_support.html](./previews/05_filing_support.html)
- Preview (직원 명부): [06_employee_directory.html](./previews/06_employee_directory.html)
- Preview (리마인드): [07_internal_reminder.html](./previews/07_internal_reminder.html)
- Preview (신고 준비): [08_filing_preparation.html](./previews/08_filing_preparation.html)
- Preview (지급명세서·연말정산): [09_payment_year_end.html](./previews/09_payment_year_end.html)
- Preview (지방소득세): [10_local_income_tax.html](./previews/10_local_income_tax.html)

## 7. Related Documents
- **Concept_Design**: [Product Baseline](../01_Concept_Design/01_PRODUCT_BASELINE.md) - 제품 목적 및 사용자
- **Concept_Design**: [Filing Preparation Pipeline](../01_Concept_Design/02_FILING_PREPARATION_PIPELINE.md) - 신고 준비 파이프라인 방향
- **UI_Screens**: [Screen Flow](./00_SCREEN_FLOW.md) - 사용자 흐름 및 데이터 입출력
- **UI_Screens**: [MVP UX Baseline](./01_MVP_UX_BASELINE.md) - 6개 워크스페이스 기준선
- **UI_Screens**: [Company Home Prototype Review](./02_COMPANY_HOME_PROTOTYPE_REVIEW.md) - 회사 홈 확인 결과
- **UI_Screens**: [Source Collection Prototype Review](./03_SOURCE_COLLECTION_PROTOTYPE_REVIEW.md) - 자료수집 확인 결과
- **UI_Screens**: [Bookkeeping Review Prototype Review](./04_BOOKKEEPING_REVIEW_PROTOTYPE_REVIEW.md) - 기장검토 확인 결과
- **UI_Screens**: [VAT Prototype Review](./05_VAT_PROTOTYPE_REVIEW.md) - 부가세 확인 결과
- **UI_Screens**: [Payroll Prototype Review](./06_PAYROLL_PROTOTYPE_REVIEW.md) - 급여 확인 결과
- **UI_Screens**: [Filing Support Prototype Review](./07_FILING_SUPPORT_PROTOTYPE_REVIEW.md) - 신고지원 확인 결과
- **UI_Screens**: [Employee Directory Prototype Review](./08_EMPLOYEE_DIRECTORY_PROTOTYPE_REVIEW.md) - 직원 명부 확인 결과
- **UI_Screens**: [Internal Reminder Prototype Review](./09_INTERNAL_REMINDER_PROTOTYPE_REVIEW.md) - 리마인드 확인 결과
- **UI_Screens**: [HTML Preview 폴더](./previews/) - 브라우저 확인용 프로토타입
- **Technical_Specs**: [Payroll Pre-Code Brief](../03_Technical_Specs/08_PAYROLL_PRE_CODE_BRIEF.md) - 급여 구현 전 데이터·mutation 계약
- **Technical_Specs**: [Employee Directory Pre-Code Brief](../03_Technical_Specs/10_EMPLOYEE_DIRECTORY_PRE_CODE_BRIEF.md) - 직원 명부 구현 전 데이터·mutation 계약
- **Technical_Specs**: [Internal Reminder Mail Pre-Code Brief](../03_Technical_Specs/11_INTERNAL_REMINDER_MAIL_PRE_CODE_BRIEF.md) - 내부 리마인드 구현 전 데이터·mutation 계약
- **QA_Validation**: [Payroll Test Scenarios](../05_QA_Validation/06_PAYROLL_TEST_SCENARIOS.md) - 급여 구현 검증 시나리오
- **QA_Validation**: [Employee Directory Test Scenarios](../05_QA_Validation/08_EMPLOYEE_DIRECTORY_TEST_SCENARIOS.md) - 직원 명부 구현 검증 시나리오
- **QA_Validation**: [Internal Reminder Mail Test Scenarios](../05_QA_Validation/09_INTERNAL_REMINDER_MAIL_TEST_SCENARIOS.md) - 내부 리마인드 구현 검증 시나리오
- **Technical_Specs**: [First-run Sample Data Pre-Code Brief](../03_Technical_Specs/12_FIRST_RUN_SAMPLE_DATA_PRE_CODE_BRIEF.md) - 샘플 banner/delete UI 계약
- **QA_Validation**: [First-run Sample Data Test Scenarios](../05_QA_Validation/10_FIRST_RUN_SAMPLE_DATA_TEST_SCENARIOS.md) - 샘플 생성·표시·삭제 검증 시나리오
