# SemuAgent UI Design
> Created: 2026-07-01 19:40
> Last Updated: 2026-07-14

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
│  사용자    │   실제 상태에서만 Loading/Empty/Error   │
└───────────┴─────────────────────────────────────┘
```

- Sidebar: 브랜드 → 회사 홈 → 자료수집 → 기장검토(자료대조원장) → 급여·지급(직원 명부·원천세·지급명세서·연말정산·지방소득세, 지급명세서와 연말정산은 별도 메뉴) → 부가세 → 연간신고(사업자 유형별) → 관리(설정·리마인드) → 사용자.
  - 기장검토 하위에는 Path 1 첫 관문인 **자료대조원장**을 둔다.
  - 연간신고는 법인에 법인세, 일반 개인에 종합소득세, 면세 개인에 종합소득세·사업장현황신고만 노출한다.
  - `신고지원`·`신고 준비`는 상위 메뉴로 노출하지 않는다.
  아직 미구현 화면은 "다음" 배지로 표기.
- Topbar: 회계기간·신고구분 선택 pill을 우측 정렬. 컨텍스트 전환의 단일 지점.
- HTML Preview의 상태 카드는 설계 검토용이다. 런타임은 실제 Loading/Empty/Error가 발생했을 때만 해당 상태를 표시하며, 정상 화면에 데모 카드·Preview 안내·내부 작업번호를 렌더하지 않는다.
- 런타임 문구는 사용자 업무 언어를 사용한다. `handoff`, `track`, `JC-*`, `Path 1a/1b`, `Billing` 같은 내부 개발·기획 용어는 문서와 코드 식별자로만 남긴다.

## 4. 핵심 컴포넌트

### 4.1 회사 홈 (00_company_home.html)

| 컴포넌트 | 역할 | 상태 |
|:---|:---|:---|
| 회계기간 Hero | 현재 기간·진행률·마감일 강조 | 진행 중 / 마감 임박(D-day 강조) |
| Action Row | 신고 전 해결 항목 + CTA | danger/warn/ok dot로 우선순위 |
| Status Card | 워크스페이스 집계 요약 | 값 + 상태칩, 클릭 시 라우팅 |
| Recent Table | 제출·영수증 이력 | 구분·항목·기간·상태·일시 |
| State Card | 로딩/빈/오류 표준 | 실제 상태에서 스켈레톤·빈안내·오류+재시도, 정상 화면에는 미노출 |

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
| Classification Header | 신고 전 거래 대조·계정확정 현황(확정/대기)·진행률 강조 | 진행률 바 + 우측 대기 카운트(danger) |
| Queue Tabs | 검토 대기 / 신뢰도 낮음 / 확정 / 전체 필터 | 세그먼트 탭(active 강조) + 건수 배지 |
| Bulk Action Bar | 다중 선택 일괄 승인·계정 변경 | primary "선택 N건 승인" + ghost "일괄 변경" |
| Classification Queue Table | 거래별 AI 추천 계정과목·신뢰도·처리 | 체크박스 + AI 배지 + Confidence Bar + 행 액션(승인/수정/계정 지정) |
| Confidence Bar | AI 추천 신뢰도 시각화 | high(ok) / mid(warn) / low(danger), 낮으면 "계정 지정" 강제 |
| Journal Entry Preview | 확정 전 분개(차변/대변) 미리보기 | `card` 내 전표 표(부가세대급금 포함), 차·대변 합계 일치 표시 |
| Period Attribution / Approval | 귀속 기간·증빙·부가세 공제·승인 | 속성 리스트 + 상태칩 + "이 거래 승인" |
| State Card | 로딩/빈/오류 표준 (공용) | 스켈레톤·빈안내(확정 전표 보기)·오류+재시도 |

- 사이드바 "기장검토"에는 검토 대기 건수 카운트 배지(danger)를 노출하고, 하위 메뉴 **자료대조원장**을 표시한다. 기장검토 본 화면은 AI 계정분류 큐와 승인 mutation 중심이며, 자료대조원장은 별도 Preview(12)로 분리한다.
- AI 추천은 초안이며 확정 책임은 사용자에게 있다. 신뢰도 낮은 항목은 승인 전 "계정 지정"으로 강제 확인시킨다.
- 상태칩·State Card·Table 골격은 회사 홈/자료수집과 공통(DRY).

### 4.3a 자료대조원장 (12_reconciliation_ledger.html)

| 컴포넌트 | 역할 | 상태 |
|:---|:---|:---|
| Readiness Hero | Path 1 양식 생성 전 데이터 준비율·확정·확인 필요·증빙·소명 필요 | 진행률 + 4개 지표 |
| Source Summary Cards | 통장·카드·세금계산서·현금영수증·제외 검토 상태 | source별 건수·미연결·확인 필요 |
| Next Action Queue | Path 1 생성을 막는 항목부터 처리 | 세목 blocker·금액·마감 영향 기준 정렬 |
| Period Scope Control | 월·분기·반기·연·사용자 지정 기간 전환 | 기본값은 진입한 신고 맥락에서 결정 |
| Source Tabs | 전체/통장/카드/세금계산서/현금영수증/증빙 필요/소명 필요/제외 검토 | 세그먼트 탭 + 건수 |
| Reconciliation Ledger Table | 출처별 거래와 연결 증빙을 하나의 신고 전 원장으로 대조 | 거래일·출처·거래처·적요·공급가액·세액·증빙·계정·상태·처리 |
| Evidence Action Status | 통장↔카드↔세금계산서↔현금영수증 연결·소명·예외 상태 | 증빙있음/증빙 확인/증빙 찾기/증빙 필요/소명 필요/소명 완료/증빙 예외/제외됨 |
| Prior Pattern Suggestion | 전월/최근 확정 이력 기반 추천 | 추천 계정·증빙·제외 사유 + 근거 + 수락/변경/거부 |
| Batch Suggestion Acceptance | 동일 근거·동일 추천 그룹을 한 번에 확인 | 자동 확정 금지, 자격 조건과 대상 행 표시 |
| Work Panel Conclusion | 선택 행의 추천 결론을 한 줄로 먼저 표시 | 추천 계정·증빙/제외·근거·주요 액션 |
| Account / Counterparty Controls | 계정항목·거래처 확정 | select-like control, 미확정은 warn |
| Exclusion Review | 사적 사용·업무무관·중복 의심 처리 | 업무사용/제외/메모 |
| Tax File Gate Panel | 세목별 Path 1 양식 생성 가능 여부 | 부가세·사업장현황신고·지방소득세 등 ready/blocker chip |
| Tax Blocker Reasons | 어떤 세목 파일이 왜 막혔는지 표시 | blocker code·건수·대표 행 링크 |
| Closing Checklist | 완료 조건이 0건이 되었는지 확인 | 증빙·소명·계정·제외·세목 blocker |
| Source Back Link / Recent Undo | 부족한 자료는 자료수집으로 보내고 최근 적용은 취소 | 기간·자료유형 context 포함, 최근 1건 취소 |
| State Card | 로딩/빈/오류/권한 없음 | 공통 state pattern |

- 사용자 제공 Clobe 참고 화면(통장 내역·카드 승인·세금계산서·현금영수증)의 밀도와 필터 구조를 참고하되, SemuAgent에서는 거래원장 확정 관문으로 재구성한다.
- 자료대조원장은 신고 준비 허브가 아니라 기장검토 하위 화면이다. 신고 준비는 이 관문을 통과한 확정 거래원장을 세목별 마무리 상태로 읽는다.
- 전월/최근 확정 패턴은 추천 근거로만 사용한다. 같은 사업장 안에서 반복 거래의 계정·증빙·제외 추천을 설명하지만, 사용자의 확인 없이 자동 확정하지 않는다.
- "증빙없음"은 최종 상태처럼 표시하지 않는다. 증빙 필요·소명 필요·소명 완료·증빙 예외·제외됨처럼 사용자의 다음 행동 또는 해결 상태를 표시한다.
- 기본 뷰는 처리 필요 항목을 우선 보여주고, 전체 보기/출처 탭은 보조 탐색으로 둔다.
- 일괄 제안 수락은 같은 근거·같은 추천을 가진 안전한 그룹에만 제공하며, 사용자의 명시 확인 없이는 확정하지 않는다.
- 직접입력 가이드·값 복사 경로는 포함하지 않는다. Path 1은 양식·파일에 값이 채워진 상태를 확인하고 홈택스에서 사용자가 업로드·제출하는 경로다.

### 4.4 부가세 (03_vat.html)

| 컴포넌트 | 역할 | 상태 |
|:---|:---|:---|
| Tax Summary Hero | 매출세액 − 매입세액 = 납부(예정)세액 강조, 마감 D-day | 3셀 계산 레이아웃 + 예정치 안내 + D-day 칩 |
| Sales Grouping Cards | 과세 / 영세율 / 면세 그룹별 공급가액·매출세액 | 3카드, 그룹 태그(tax/zero/exempt) |
| VAT Savings Opportunities | 접대비 불공제 후보 중 복리후생비·회의비로 재분류할 가능성이 있는 거래 | 세액 요약 바로 아래 별도 목록. 기본 행은 거래·재분류 방향·최대 추가 공제 가능성만, 신뢰도·근거·부족 자료와 사용자 액션은 펼쳐보기. 후보 0건이면 미표시. 공제 확정 모달은 업무 목적/참석자 입력과 적격증빙 확인을 요구 |
| VAT Filing Modification Workbench | 홈택스에서 공제·과세유형·금액·안분을 수정할 거래와 미완료 공제 검토를 한 곳에서 처리 | `신고 전 수정 필요` 3열(`거래/상대처`·`금액`·`공제 판단`). `expected_no_change`는 숨기고 근거·증빙·할 일·사용자 액션은 펼친 뒤 표시 |
| Hometax Review Action | 홈택스 자동채움에서 확인·수정할 항목 | 그대로 확인 / 공제·불공제 확인 / 과세유형 확인 / 금액 추가·수정 / 안분 확인; 실제 자료 미연결 시 `자동채움 예상` 표시 |
| Required Evidence Tags | 영세율·면세·공제 판단에 필요한 증빙 상태 | 있음(neutral) / 확인 필요(danger); 누락 시 확정·gate 해제 금지 |
| Statutory Evidence Attestation | 영세율·면세 법정 증빙 사용자 확인 | 증빙 tag 옆 `확인 완료`; 사용자 확인 건만 `확인 취소`, 저장 중 행 단위 spinner |
| AI Failure Fallback | timeout·quota·provider 오류 시 비차단 수동 검토 | 표 유지 + 해당 행 `수동 확인 필요` + 제한된 다시 시도 |
| Tax Treatment Actions | AI·규칙 판단에 대한 사용자 최종 처리 | 행 안의 적용/다르게/보류/전문가 확인; 저장 중 행 단위 spinner, 확정 행은 변경만 노출 |
| Tax Treatment Decision Dialog | 추천과 다른 판단·보류·전문가 확인 근거 입력 | 방향별 결정 select + 근거 textarea + 안분율 input; 영세율·면세 증빙 누락 시 저장 차단 |
| Human Handoff Question | 필수 사실 부재·근거 충돌·규칙 공백·다중 AI 불합의 해결 | 펼친 상세에서 질문 1개 + 답변에 따른 처리 + `답변하고 확정`; 잠정 결론을 기본 선택하고 답변을 감사 근거로 저장 |
| Recent Tax Treatment Undo | 방금 저장한 판단을 원래 canonical·감사 상태로 복원 | sonner `되돌리기`; 최신 1건·일회용 토큰·서버 current-state 검증 |
| Confirmed Ledger Rebuild | 현재 확정 VAT fact로 summary와 fingerprint를 재계산 | 다른 gate가 모두 ready이고 snapshot만 stale일 때 파란 outline `확정 원장 다시 계산`; 처리 중 spinner |
| VAT Package API Gate | package/rebuild 요청 시 미완료 자료를 서버에서 차단 | 화면에 별도 준비 카드·차단 이유 목록을 반복하지 않고 API에서만 강제 |
| VAT Path 1b Input Summary | 확정 부가세 값을 홈택스 신고서 행·칸과 연결 | 별도 `홈택스 입력값` 화면. 한 개 표에서 `신고서 위치/금액/세액/확인 방식` 표시, AI 설명 반복 없음 |
| Hidden Empty State | 수정 거래가 0건일 때 불필요한 작업대 제거 | `신고 전 수정 필요` 섹션 전체를 렌더하지 않고 Hero에 `수정할 거래가 없습니다` 한 줄만 표시 |

- 사이드바 "부가세"에 공제 검토 대기 건수 카운트 배지(warn)를 노출한다.
- **검토 자료 마감 잠금**: 자료수집·자료대조·사용자 세무판단·확정 원장 fingerprint 중 하나라도 미완이면 `is-disabled` + `disabled` + `aria-disabled="true"` muted 버튼으로 잠금을 명시하고, 위에 사유(locknote)를 함께 노출한다. exact 입력은 유효하지만 snapshot만 stale인 경우에만 별도 재계산 버튼을 제공한다.
  - 구현 노트: disabled 버튼의 `title` 툴팁은 브라우저별 표시가 일관되지 않으므로, React 구현 시 비활성 버튼을 래퍼(tooltip 컴포넌트)로 감싸 잠금 사유를 접근성 있게 노출한다.
- **판단 정보 계층**: AI 열에는 클릭 가능한 한 줄 결론 외의 source mark·완료시각·재확인 버튼을 기본 노출하지 않는다. 홈택스 열도 권장 행동 한 줄과 `처리` 진입점 하나만 둔다. 근거·필요 증빙·상태·사용자 액션 묶음은 펼친 뒤 표시한다.
- **담당자 이관 정보 계층**: 기본 셀에는 별도 이관 badge를 추가하지 않는다. 펼친 상세에서 실제로 찾은 근거를 먼저 보여준 뒤 허용된 handoff 행에만 질문 한 개·부족/충돌 근거·답변에 따른 처리·`답변하고 확정`을 표시한다. 이때 일반 `적용`·`전문가 확인` 버튼은 반복하지 않는다.
- **수정 중심**: 사용자 확정 완료 행과 `expected_no_change` 행은 AI 출처·미확정 여부만으로 작업대에 넣지 않는다. 홈택스 수정 행동, unresolved handoff, 미완료 공제 검토만 표시한다.
- **중복 제거**: 같은 classification 행의 AI 판단과 공제 검토 mutation은 한 행에 합치며, 별도 부속명세·상태 예시·대형 패키지 미리보기·동작 없는 `확정 신고` control을 두지 않는다.
- **증빙 확인 경계**: `확인 완료`는 증빙파일 생성·AI 자동확정이 아니라 사용자가 법정 증빙 준비를 직접 확인했다는 기록이다. 확인 취소 시 세무판단·package gate를 다시 잠근다.
- **자동 홈택스 제출은 범위 밖**이다. 부가세 공식 비암호화 업로드 파일은 Stage A 외부 확인 전 미제공이며, 세액은 사용자 판단 완료 전 "예정"으로 표기한다.
- **Path 1b 분리**: VAT 작업대 상단 CTA에서 별도 `홈택스 입력값` 화면으로 이동한다. ready 상태에서만 입력표를 표시하고, blocked/empty/stale/unsupported 상태에서는 이전 값을 확정값처럼 노출하지 않는다. 직접 입력 행은 `값 비교·수정`, 신고서 합계 행은 `자동 합계 대조`, `(27)`은 `최종 확인`으로 구분한다.
- **최종세액 경계**: 현재 `payableTaxKrw`는 신고서 ㉰(매출세액-공제 가능 매입세액)이며 경감·공제·예정고지·가산세를 반영한 (27) 최종 납부세액이 아니다. 화면에서 두 값을 같은 것으로 표시하지 않는다.
- 상태칩·Table 골격은 앞 화면들과 공통(DRY). Loading·Error는 실제 상태에서 처리하고 live 화면에 데모 카드를 상시 표시하지 않는다.
- **모바일 셸**: `md` 미만에서는 248px 고정 사이드바를 숨기고 상단 전체 메뉴 버튼으로 왼쪽 Sheet를 연다. Sheet는 데스크톱과 같은 메뉴·배지·사업자 유형 분기를 재사용하며 링크 선택 시 닫힌다.

### 4.5 급여·지급 (04_payroll.html)

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
- 원천세·지급명세서·연말정산·지방소득세·직원 명부를 같은 사이드바 그룹에서 이동한다.
- 상태칩·State Card·Table 골격은 앞 화면들과 공통(DRY).

### 4.6 원천세 (05_filing_support.html)

| 컴포넌트 | 역할 | 상태 |
|:---|:---|:---|
| Hometax Route | 원천세 신고 진입 경로 | 한 줄 경로 표시 |
| Hometax Input Table | 기본정보와 근로소득 간이세액(A01) 입력 위치·값 | 화면/입력 위치/값 3열 표 |
| Wetax Separate Value | 지방소득세 특별징수분 분리 | 주황 안내 박스, 홈택스 합산 금지 |
| Receipts Storage | 제출 접수증 업로드·보관 | 접수증 목록 + 빈 항목(제출 후 업로드 대기) |

- **책임 경계 규칙**: 자동 홈택스 입력·제출·납부·자격증명 서버 저장은 제공하지 않는다. 입력표 하단에 한 번만 명시한다.
- 급여(JC-012)의 확정 산출물만 읽는다. 부가세 내용은 부가세 화면에서 처리한다.
- 원천세 화면에는 부가세·4대보험 패키지, 중복 준비 단계, 혼합 사후 체크리스트를 표시하지 않는다.

### 4.7 화면 간 내비게이션

- 사이드바 항목·브랜드·breadcrumb를 모두 `<a>`로 처리(`a { color: inherit; text-decoration: none }`).
- 회사 홈에는 가장 가까운 일정 2~3건만 보여주는 `다가오는 신고` 스트립을 두고, 각 항목은 급여·지급/부가세/연간신고로 이동한다.
- 급여·지급 부모는 04에서 `active`, 05·06·09·10에서는 `active-parent`이며 선택된 하위 항목만 `active`다.
- 직원 명부는 관리가 아니라 급여·지급 하위 기준정보다.
- 리마인드는 사이드바 "관리" 그룹의 직원 명부 아래 항목으로 진입하며, 전 화면과 상호 이동한다.
- 연간신고(08)는 사업자 유형에 맞는 세목만 렌더링한다. 사업장현황신고(11)는 면세 개인사업자에서만 하위 항목으로 보인다.
- 부가세는 독립 상위 메뉴이며 급여·지급이나 연간신고에 중복 배치하지 않는다.
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
| Rule List | 업무 영역별(자료수집/기장검토/급여·지급/부가세/연간신고) 규칙 | 트리거 태그(마감 D-7/D-3/D-1·일일 요약·수동), 활성 토글, 테스트 발송 |
| Recipient Preview | 담당자 본인·내부 staff 수신자 | 본인/staff 칩, 알림 꺼짐 대상은 제외 표시 |
| Send Log Table | 최근 발송 로그 | 상태칩(발송됨/실패/스킵), 실패 사유·중복 방지(idempotency) |
| State Card | 로딩/빈/오류 + provider missing 표준 | 스켈레톤·빈안내(첫 규칙)·오류+재시도·발송 설정 안내 |

- **책임 경계 규칙**: 회사 내부 업무 알림이다. 고객사 요청 메일, 외부 업로드 포털 초대, 자동 홈택스 제출·납부는 제공하지 않는다. 배너·하단 안내에 반복 노출한다.
- 수신자는 담당자 본인·내부 staff에서 파생하며, notification 꺼진 대상은 제외한다. 직원 명부(JC-015) 기반 직원 수신은 후속.
- 신고 준비 일정(마감 D-day)·확인 필요 상태를 담당자 본인에게 리마인드하는 자가 알림이 v1 핵심 흐름이다.
- 상태칩·State Card·Table 골격은 앞 화면들과 공통(DRY).

### 4.10 연간신고 (08_filing_preparation.html)

| 컴포넌트 | 역할 | 상태 |
|:---|:---|:---|
| Annual Filing Hero | 사업자 유형·귀속연도·연간 세목 준비율·확인 필요 | 진행률 + blocker 카운트 |
| **Path 1 Completion Flow** | 1a: 홈택스 업로드용 양식·파일 작성·양식 채움 확인·업로드 안내 / 1b: 항목=값 직접입력 정리 | 베타 중심 경로 |
| **Path Boundary Notice** | Path 2(사무소 ZIP)는 Path 1 베타 이후, 암호화 Path 3은 범위 밖임을 안내 | 책임 경계 |
| Annual Filing Cards | 법인세/종합소득세/사업장현황신고 중 해당 세목만 표시 | 준비 상태·blocker·Path 1 상태 |
| Responsibility Boundary | Path 1 책임 경계·자동입력·자동제출 제외·1b는 메뉴 경로와 신고서 행·칸 위치까지 안내 | accent 안내 박스 |
| State Card | 로딩/빈/오류/권한 없음 표준 | 스켈레톤·빈안내·오류+재시도 |

- 화면의 중심 질문은 "홈택스·위택스에 넣을 확정 데이터가 준비됐는가"이며, **실행 우선순위는 Path 1**이다 — 공식 양식이 있으면 1a(양식·파일 작성), 없으면 1b(항목=값 직접입력 정리) ([Path 1 Roadmap](../03_Technical_Specs/36_PATH1_FORM_FILL_ROADMAP.md)).
- Path 1b는 홈택스 메뉴 경로와 신고서의 행·칸 위치에 확정값을 연결해 보여준다. 홈택스 화면을 대신 조작하는 자동입력·자동제출과 클릭별 화면 캡처 튜토리얼은 제공하지 않는다.
- 세무 일정 요약은 회사 홈의 `다가오는 신고`로 이동하며 연간신고 화면에서는 해당 연도의 마감만 표시한다.
- 자동제출·신규 산출 엔진·신규 DB는 JC-029 Preview 범위 밖이다.
- 상태칩·State Card·Table 골격은 앞 화면들과 공통(DRY).

### 4.11 지급명세서·연말정산 (09_payment_year_end.html · 15_year_end_settlement.html, JC-024)

`급여·지급 > 지급명세서`와 `급여·지급 > 연말정산`을 별도 메뉴·라우트로 제공한다. 두 화면은 급여·직원 명부 read model을 공유하지만, 지급명세서는 반기 집계·간이지급명세서 홈택스 직접작성 값에 집중한다. 연말정산은 홈택스 편리한 연말정산이 근로소득 지급명세서를 생성하기 전에 필요한 회사 급여 기초자료를 직원별로 정리한다.

| 컴포넌트 | 역할 | 상태 |
|:---|:---|:---|
| 지급명세서 Prep Hero | 대상 인원·확인 필요(누락)·데이터 준비 완료 요약 | 진행률 + 카운트 |
| 지급명세서 Next Action List | 급여 미확정·인적사항 누락 blocker + 급여/직원 명부 CTA | danger/warn dot + 라우팅 |
| 간이지급명세서 Table | 직원별 귀속기간·지급총액·원천징수세액·준비 상태(근로소득 반기) | 준비완료/누락 월/확인 필요 상태칩 |
| Direct-Entry Value Panel (JC-030) | **Path 1b** — 홈택스 메뉴 경로·사업자/기간·소득자별 월 지급액·합계·인정상여 | read-only · 식별정보 미저장 |
| Annual Intro | `홈택스 편리한 연말정산에서 지급명세서를 생성합니다`와 대상·준비 완료·급여 보완·특례 확인 요약 | 간결한 본문 + 4개 카운트, 대형 진행률 카드 없음 |
| Hometax Process Strip | 기초자료 등록→공제신고서 확인→지급명세서 생성→확인·수정→제출 | 현재 단계만 강조, 자동 이동/제출 없음 |
| Annual Employee Table | 직원·근무기간·급여 준비값·홈택스 확인·상태 | `급여 준비 완료/급여 보완/특례 확인` 3종만 사용 |
| Annual Row Detail | 급여 항목, 4대보험, 기납부 소득세·지방소득세, 홈택스 직접 확인 항목 | 행 펼침, 원문 PII·공제자료 없음 |
| Privacy Boundary | 주민번호·공제신고서·공제증빙은 홈택스에서 직접 확인 | 표 하단 한 줄, 별도 대형 안내 카드 없음 |
| State Surface | 로딩/빈/오류/권한 없음 표준 | 표 골격 스켈레톤·다음 행동·오류+재시도 |

- 연말정산 화면 언어는 **"홈택스 지급명세서 생성용 급여 기초자료 준비"** 로 통일한다. `급여 준비 완료`는 최종 연말정산 완료가 아니다.
- 각 화면은 단일 스크롤·직원 중심 표다. 연말정산 상세는 필요한 행만 펼치며, 상단 blocker 카드·진행률·반복 책임경계 설명을 추가하지 않는다.
- 완료 연도에서 `ready`는 `급여 준비 완료`, 급여 미확정/누락/명부 불완전은 `급여 보완`, 중도입사·중도퇴사 등 현재 데이터로 확인되는 예외는 `특례 확인`으로 표시한다. 근거 데이터가 없는 특례는 `해당 없음`으로 단정하지 않고 홈택스 직접 확인 항목으로 남긴다.
- 진행 중 연도는 상태 3종에 섞지 않고 페이지 수준 `연도 진행 중`으로 표시한다. 현재까지 합계를 연간 확정값처럼 보이지 않는다.
- 정산액 계산·최종 지급명세서 복제·파일 생성·자동입력·자동제출은 범위 밖이다. 주민등록번호·공제신고서·공제증빙 입력/업로드 UI를 만들지 않는다.

### 4.12 지방소득세 (10_local_income_tax.html, JC-027)

`급여·지급 > 지방소득세`로 진입하는 전용 화면. 급여에 이미 기록된 `localIncomeTaxKrw`(원천세 특별징수분)를 집계한 **read-only** 화면이다.

| 컴포넌트 | 역할 | 상태 |
|:---|:---|:---|
| Prep Hero | 대상 인원·확인 필요·지방소득세 합계 요약, "근사치 재계산 아님" 명시 | 진행률 + 카운트 |
| Next Action List | 급여 미확정 blocker + 급여 CTA | danger dot + 라우팅 |
| 지방소득세 Table | 직원별 지급총액·소득세(국세)·지방소득세(특별징수)·상태 + 합계 행 | 준비완료/급여 미확정 상태칩 |
| Consistency Banner | 급여·지급 하위 원천세와 동일한 실제값임을 명시 | plan 톤 안내 박스 |
| Responsibility Boundary | 종합소득세·법인세분 지방소득세·위택스 제출 제외 | accent 안내 박스 |
| State Card | 로딩/빈/오류/권한 없음 표준 | 스켈레톤·빈안내·오류+재시도 |

- v1은 **원천세 특별징수분만**. 종합소득세분·법인세분 지방소득세는 JC-025/026 이후.
- 화면 언어는 "귀속기간·원천세 신고 주기 기준"으로, 월 단위를 못박지 않는다(반기납부 특례 고려).
- 소득세(국세)와 지방소득세(특별징수)를 컬럼으로 명확히 분리해 "원천징수세액"으로 뭉뚱그리지 않는다.
- 기존 JC-013의 `splitWithholdingTax` 근사치는 이 화면과 같은 실제값으로 교체됐다. 새 IA에서도 원천세·지방소득세가 같은 소스를 사용한다.
- 단일 스크롤·직원 중심 표. mutation 없음. 상태칩·State Card·Table 골격은 공통(DRY).

### 4.13 사업장현황신고 (11_business_status_report.html, JC-028)

`연간신고 > 사업장현황신고`로 진입하는 전용 화면. 면세 개인사업자가 부가세 신고 대신 홈택스 사업장현황신고에 넣을 수입금액·자료 상태를 확인하는 **read-only** 화면이다.

| 컴포넌트 | 역할 | 상태 |
|:---|:---|:---|
| Prep Hero | 면세 개인 대상 여부·준비율·확인 필요·신고 준비 요약 | 진행률 + 카운트 |
| Eligibility Notice | `tax_exempt` 개인만 대상, 과세사업자/법인은 해당 없음 | plan 톤 안내 박스 |
| Next Action List | 자료 누락·계정분류 확인 blocker + 자료수집/기장검토 CTA | danger/warn/ok dot + 라우팅 |
| Summary Cards | 수입금액·매입/경비·미확정 거래·누락 자료 요약 | 숫자 카드 + 상태칩 |
| Revenue Table | 수입금액 분류별 금액·상태 + 합계 행 | 준비완료/확인필요 상태칩 |
| Source Material Table | 매입·경비 자료 유형별 합계·누락 상태 + 합계 행 | 준비완료/누락 상태칩 |
| Hometax Handoff Table | 홈택스 업로드·신고 전 확인할 항목·상태·담당 화면 | 준비완료/확인필요 상태칩 |
| Responsibility Boundary | 홈택스 제출·전자신고 파일(JC-030)·자동제출(JC-023) 제외 | accent 안내 박스 |
| State Card | 로딩/빈/오류/권한 없음/해당 없음 표준 | 스켈레톤·빈안내·오류+재시도 |

- v1은 **면세 개인사업자만**. 부가세 대상 과세사업자와 법인은 해당 없음으로 표시하거나 차단한다.
- 화면 언어는 "신고 준비 데이터"로 통일한다. 홈택스 제출 보장·대리 신고 뉘앙스는 쓰지 않는다.
- 수입금액·매입/경비는 자료수집·기장검토의 확정 거래 데이터를 읽어 집계한다. 신규 세액 계산 엔진과 신규 DB는 JC-028 v1 범위 밖이다.
- mutation 없음. 확인 필요는 기존 업무 화면(자료수집·기장검토)으로 라우팅한다. 상태칩·State Card·Table 골격은 공통(DRY).

### 4.14 First-run Sample Data (JC-019)

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

### 4.15 회사 직접사용 설정 (16_company_settings.html)

| 컴포넌트 | 역할 | 상태 |
|:---|:---|:---|
| Settings Tabs | 회사 정보·사용자 관리만 노출 | active / inactive |
| Company Form | 회사명·시간대·사업자 유형 저장, 요금제 이동 | default / saving / error |
| User Table | 회사 사용자·전화번호·권한·활성 상태 | 관리자 / 일반 사용자 / 비활성 |
| Add User Action | 가입된 계정 추가 | default / submitting / error |

- 인증·온보딩 성공 뒤 회사 홈으로 진입한다. 다사업장 관리 화면을 기본 랜딩으로 사용하지 않는다.
- 사용자 화면에서 `담당자` 대신 `사용자`, `STAFF` 대신 `일반 사용자`를 사용한다.
- 서브도메인·사업장 수·업무 메일함·업무메일 설정은 기본 설정 화면에 노출하지 않는다.
- 물리 `client`·`staff` 모델과 기존 권한·메일 데이터는 이 화면 정리만으로 삭제하지 않는다.

### 4.16 신고 준비 공통 패턴 (17_shared_filing_patterns.html)

| 컴포넌트 | 역할 | 상태 |
|:---|:---|:---|
| ActionBlockerList | 먼저 해결할 항목과 단일 CTA | danger / warn / empty-hidden |
| PeriodContextControl | 현재 기간과 지원되는 이전·다음 이동 | navigable / read-only |
| FilingPortalGuide | 포털별 준비값과 사용자 행동 | ready / source-pending |
| Submission Boundary | 자동 입력·제출·납부를 하지 않는 경계 | info |

- 공통 컴포넌트는 도메인의 상태 계산을 대신하지 않는다. 각 화면이 만든 표시 데이터를 같은 구조로 렌더링한다.
- blocker는 모바일에서 CTA를 본문 아래로 내려 겹침을 막는다.
- 기간 이동 버튼은 실제 href가 있을 때만 활성화한다. 공통 컴포넌트가 기간을 추정하지 않는다.
- 홈택스·위택스는 같은 정보 순서를 사용하되, 공식 양식 확인 상태는 포털별 사실에 따라 다르게 표시한다.
- `source-pending` 상태는 파일 다운로드·업로드 가능·검증 완료 표현을 금지한다.

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

**급여·지급**
1. 확인 필요 직원 "해당 직원 열기" (마감 전 처리)
2. "급여 마감·확정" — 단, 확인 필요 처리 전에는 잠금(비활성)
3. 급여명세서/지급명세서 "미리보기", "엑셀 내보내기"

**원천세**
1. 확인 필요 급여가 있으면 급여로 이동
2. 확정 A01 항목=값 확인
3. 제출 후 접수증 업로드

**First-run Sample**
1. 전역 banner의 "샘플 데이터 삭제하고 실제 사용 시작"
2. 삭제 확인 dialog의 최종 confirm
3. 샘플 생성 실패 시 "샘플 데이터 다시 만들기"

## 6. HTML UI Preview

- Preview (회사 홈): [00_company_home.html](./previews/00_company_home.html)
- Preview (자료수집): [01_source_collection.html](./previews/01_source_collection.html)
- Preview (기장검토): [02_bookkeeping_review.html](./previews/02_bookkeeping_review.html)
- Preview (부가세): [03_vat.html](./previews/03_vat.html)
- Preview (부가세 Path 1b 홈택스 입력값): [14_vat_path1b.html](./previews/14_vat_path1b.html)
- Preview (급여·지급): [04_payroll.html](./previews/04_payroll.html)
- Preview (원천세): [05_filing_support.html](./previews/05_filing_support.html)
- Preview (직원 명부): [06_employee_directory.html](./previews/06_employee_directory.html)
- Preview (리마인드): [07_internal_reminder.html](./previews/07_internal_reminder.html)
- Preview (연간신고): [08_filing_preparation.html](./previews/08_filing_preparation.html)
- Preview (지급명세서): [09_payment_year_end.html](./previews/09_payment_year_end.html)
- Preview (연말정산): [15_year_end_settlement.html](./previews/15_year_end_settlement.html)
- Preview (지방소득세): [10_local_income_tax.html](./previews/10_local_income_tax.html)
- Preview (사업장현황신고): [11_business_status_report.html](./previews/11_business_status_report.html)
- Preview (회사 설정): [16_company_settings.html](./previews/16_company_settings.html)
- Preview (신고 준비 공통 패턴): [17_shared_filing_patterns.html](./previews/17_shared_filing_patterns.html)

## 7. Related Documents
- **Concept_Design**: [Product Baseline](../01_Concept_Design/01_PRODUCT_BASELINE.md) - 제품 목적 및 사용자
- **Concept_Design**: [Filing Preparation Pipeline](../01_Concept_Design/02_FILING_PREPARATION_PIPELINE.md) - 신고 준비 파이프라인 방향
- **UI_Screens**: [Screen Flow](./00_SCREEN_FLOW.md) - 사용자 흐름 및 데이터 입출력
- **UI_Screens**: [MVP UX Baseline](./01_MVP_UX_BASELINE.md) - 6개 워크스페이스 기준선
- **UI_Screens**: [Company Home Prototype Review](./02_COMPANY_HOME_PROTOTYPE_REVIEW.md) - 회사 홈 확인 결과
- **UI_Screens**: [Source Collection Prototype Review](./03_SOURCE_COLLECTION_PROTOTYPE_REVIEW.md) - 자료수집 확인 결과
- **UI_Screens**: [Bookkeeping Review Prototype Review](./04_BOOKKEEPING_REVIEW_PROTOTYPE_REVIEW.md) - 기장검토 확인 결과
- **UI_Screens**: [VAT Prototype Review](./05_VAT_PROTOTYPE_REVIEW.md) - 부가세 확인 결과
- **UI_Screens**: [VAT Path 1b Prototype Review](./14_VAT_PATH1B_PROTOTYPE_REVIEW.md) - 부가세 직접입력 정리 화면 확인
- **UI_Screens**: [Payroll Prototype Review](./06_PAYROLL_PROTOTYPE_REVIEW.md) - 급여 확인 결과
- **UI_Screens**: [Withholding Tax Prototype Review](./07_FILING_SUPPORT_PROTOTYPE_REVIEW.md) - 원천세 재배치 기록
- **UI_Screens**: [Employee Directory Prototype Review](./08_EMPLOYEE_DIRECTORY_PROTOTYPE_REVIEW.md) - 직원 명부 확인 결과
- **UI_Screens**: [Internal Reminder Prototype Review](./09_INTERNAL_REMINDER_PROTOTYPE_REVIEW.md) - 리마인드 확인 결과
- **UI_Screens**: [Cadence Navigation Prototype Review](./13_CADENCE_NAVIGATION_PROTOTYPE_REVIEW.md) - cadence 기반 사이드바 계약
- **UI_Screens**: [Company Direct-Use Settings Prototype Review](./16_COMPANY_SETTINGS_PROTOTYPE_REVIEW.md) - 회사 직접사용 셸 UI-First 검토
- **UI_Screens**: [Shared Filing UI Patterns Prototype Review](./17_SHARED_FILING_PATTERNS_PROTOTYPE_REVIEW.md) - 공통 blocker·기간·포털 안내 UI-First 검토
- **UI_Screens**: [HTML Preview 폴더](./previews/) - 브라우저 확인용 프로토타입
- **Technical_Specs**: [Payroll Pre-Code Brief](../03_Technical_Specs/08_PAYROLL_PRE_CODE_BRIEF.md) - 급여 구현 전 데이터·mutation 계약
- **Technical_Specs**: [Employee Directory Pre-Code Brief](../03_Technical_Specs/10_EMPLOYEE_DIRECTORY_PRE_CODE_BRIEF.md) - 직원 명부 구현 전 데이터·mutation 계약
- **Technical_Specs**: [Internal Reminder Mail Pre-Code Brief](../03_Technical_Specs/11_INTERNAL_REMINDER_MAIL_PRE_CODE_BRIEF.md) - 내부 리마인드 구현 전 데이터·mutation 계약
- **QA_Validation**: [Payroll Test Scenarios](../05_QA_Validation/06_PAYROLL_TEST_SCENARIOS.md) - 급여 구현 검증 시나리오
- **QA_Validation**: [Employee Directory Test Scenarios](../05_QA_Validation/08_EMPLOYEE_DIRECTORY_TEST_SCENARIOS.md) - 직원 명부 구현 검증 시나리오
- **QA_Validation**: [Internal Reminder Mail Test Scenarios](../05_QA_Validation/09_INTERNAL_REMINDER_MAIL_TEST_SCENARIOS.md) - 내부 리마인드 구현 검증 시나리오
- **Technical_Specs**: [First-run Sample Data Pre-Code Brief](../03_Technical_Specs/12_FIRST_RUN_SAMPLE_DATA_PRE_CODE_BRIEF.md) - 샘플 banner/delete UI 계약
- **QA_Validation**: [First-run Sample Data Test Scenarios](../05_QA_Validation/10_FIRST_RUN_SAMPLE_DATA_TEST_SCENARIOS.md) - 샘플 생성·표시·삭제 검증 시나리오
