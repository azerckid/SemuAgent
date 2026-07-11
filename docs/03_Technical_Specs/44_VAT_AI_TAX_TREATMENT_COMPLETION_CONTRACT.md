# VAT AI Tax Treatment Completion Contract
> Created: 2026-07-10
> Last Updated: 2026-07-11
> Backlog: JC-035

## 0. Decision

부가세의 다음 제품 작업은 **공식 업로드 파일 추정 구현이 아니라, 확정 거래를 부가세
신고에 반영할 수 있도록 세무 판단을 보조하는 기능**이다.

사용자 흐름은 다음 한 줄로 고정한다.

```text
자료대조원장 확정 -> AI 부가세 판단 -> 사용자 확인 -> 부가세 신고 준비 완료 -> 사용자가 홈택스에서 제출
```

AI는 매입의 공제/불공제/안분과 매출의 과세/영세율/면세 가능성을 **근거와 필요한
증빙을 함께 제시**한다. AI가 판단을 확정하거나 홈택스 신고서를 제출하지 않는다.

부가세 Path 1 공식 비암호화 업로드 파일 조사는 [VAT Stage A Audit](./43_JC030_VAT_NONENCRYPTED_UPLOAD_TEMPLATE_AUDIT.md)에
따라 별도 외부 확인 대기로 유지한다. JC-035 완료는 JC-030 부가세 파일 지원 완료를
의미하지 않는다.

### 0.2 Flow Status

- VAI-0 완료: 범위·AI 판단 단계·실패 안전성 고정
- VAI-1 완료: AI 판단 작업표 Preview 프로젝트 오너 승인
- VAI-2 완료: 규칙 매트릭스·Pre-Code Brief 프로젝트 오너 승인
- VAI-3a 완료: Zod·deterministic rule·이전 확정 패턴·read-only 화면
- VAI-3b 완료: single-provider AI·timeout/fallback·PII/소비자 격리
- VAI-4a 완료: additive audit schema·사용자 확정 transaction, migration 0068 dev/prod 적용
- VAI-4b 완료: 적용/다르게/보류/전문가 확인 UI·최근 작업 undo, migration 0069 dev/prod 적용
- VAI-5 완료: 고위험 multi-provider consensus·Claude 중재·비차단 fallback
- 현재: VAI-6a 사용자 세무판단 gate를 VAT 화면·rebuild API·package API에 공통 연결 완료
- 다음: VAI-6b 영세율·면세 필수 증빙 확인 입력과 감사 기록 구현 뒤 JC-035 최종 완료 처리

## 0.1 Current Status

| 영역 | 현재 상태 | JC-035에서 필요한 보강 |
|:---|:---|:---|
| exact VAT fact | 공급가액·세액·합계액·과세유형·원천 행을 저장하고 산술 검증 | 기존 계약 재사용 |
| 매입 공제 검토 | 공제/불공제/안분 사용자 mutation과 감사 필드 존재 | 판단 근거·신뢰도·필요 증빙·AI 실패 상태를 표준화 |
| 매출 구분 | 과세/영세율/면세 snapshot 및 deterministic rebuild 존재 | 영세율·면세의 법적 요건과 증빙 충족 여부를 거래 단위로 검토 |
| 이전 확정 패턴 | 자료대조원장 계정 패턴 학습 기반 존재 | 같은 tenant·사업장 안의 부가세 확정 이력만 근거로 사용 |
| AI orchestration | 자료 분석·기간 귀속에 fallback/consensus 구현 존재 | 부가세 고위험 판단에 조건부 재사용 |
| 사용자 확정 | `confirmedByStaffId`, `confirmedAt` 존재 | AI 추천과 최종 사용자 결정을 분리해 표시·저장 |
| 신고 파일 | 부가세 전체 신고용 공식 비암호화 업로드 규격 미확인 | 외부 확인 전 generator 미구현 |

## 1. Product Scope

### 1.1 Included

1. **매입세액 판단 보조**
   - 공제 가능성 높음
   - 불공제 가능성 높음
   - 공통매입 안분 필요
   - 사용자 또는 전문가 확인 필요
2. **매출 과세유형 판단 보조**
   - 과세 가능성 높음
   - 영세율 가능성 + 필수 증빙 확인
   - 면세 가능성 + 법정 요건 확인
   - 비과세/신고대상 여부 확인 필요
3. **설명 가능한 판단**
   - 적용 규칙, 거래 사실, 이전 확정 패턴, AI 보강 여부, 신뢰도, 필요한 증빙을 표시
4. **사용자 확정**
   - 적용, 다르게 처리, 보류, 전문가 확인 요청
5. **실패 안전성**
   - LLM timeout·quota·provider 오류가 있어도 화면과 수동 검토는 계속 사용
6. **감사 추적**
   - 추천과 최종 결정, 규칙 버전, 확정자, 확정시각을 구분

### 1.2 Excluded

- AI 또는 규칙의 자동 최종확정
- 세무대리, 세무 자문 보증, 신고 책임 이전
- 홈택스 직접입력 단계별 안내
- 홈택스 자격증명 저장·자동 로그인·자동 제출·자동 납부
- 공식 규격이 확인되지 않은 부가세 업로드 파일 추정 생성
- 복잡한 국제거래·조세특례·경정청구 등 모든 예외의 자동 판정
- 근거 또는 필수 증빙이 없는 영세율·면세 자동 적용

## 2. Governing Sources and Rule Ownership

법령과 국세청 안내가 판단 규칙의 1차 소스다. AI는 공식 규칙을 대체하지 않고,
거래 사실을 규칙에 대입하기 어려운 경우에만 해석을 보강한다.

| 주제 | 기준 소스 | 제품 계약 |
|:---|:---|:---|
| 부가세 기본 산식·신고주기 | [국세청 부가가치세 개요](https://i.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7693&mi=2401) | 사업자 유형·기간을 먼저 확정 |
| 불공제 매입세액 | [부가가치세법 제39조](https://www.law.go.kr/LSW/lsLawLinkInfo.do?chrClsCd=010202&lsId=001571&lsJoLnkSeq=900316725&print=print) | 사업 무관·비영업용 승용차·기업업무추진비·면세사업 관련 등은 공식 규칙으로 우선 분류 |
| 공통매입 안분 | [부가가치세법 시행령 제81조](https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0081&lsiSeq=283641&urlMode=lsScJoRltInfoR) | 실지귀속 우선, 불명확한 공통매입만 안분 검토 |
| 신고 검토 항목·영세율 증빙 | [홈택스 부가가치세 신고도움](https://mob.tbht.hometax.go.kr/jsonAction.do?actionId=UTBRNAA130F001) | 사업 무관·개인 사용·중복공제·영세율 필수서류 등을 검토 항목으로 사용 |

구현 전 별도 규칙 매트릭스에서 조문/시행령/국세청 안내의 버전·적용일·필수 사실·필수
증빙·불확실 시 처리 상태를 고정한다. 법령 개정 시 기존 확정 결과를 몰래 바꾸지 않고,
새 규칙 버전으로 재검토 대상을 표시한다.

## 3. Decision Ladder

모든 행에 3개 LLM을 호출하지 않는다. 판단 비용과 위험에 따라 단계적으로 확장한다.

| 단계 | 적용 대상 | 처리 |
|:---|:---|:---|
| 1. Deterministic rule | 정확한 증빙·금액·사업자 유형·명백한 법정 요건 | 규칙 결과와 조문 근거 표시 |
| 2. Prior confirmed pattern | 같은 tenant·사업장·유사 거래처/용도에서 반복되는 사용자 확정 | 이전 확정 건수·기간·결정 표시, 자동 적용 금지 |
| 3. Single-provider AI | 적요·업종·거래 목적 해석이 필요한 애매한 거래 | 가능성·근거·부족한 정보 표시 |
| 4. Multi-provider review | 영세율/면세, 고액, 모델 불일치, 낮은 신뢰도 | Gemini+OpenAI 1차 판단, 불일치 시 Claude 중재를 기본 참조 패턴으로 사용 |
| 5. Manual/expert review | 근거 부족·provider 실패·고위험 예외 | `확인 필요`로 남기고 사용자가 판단하거나 전문가에게 확인 |

단계 1·2의 근거가 충분하면 LLM을 호출하지 않는다. 단계 3·4의 결과도 추천일 뿐이며,
사용자 확정 전에는 VAT fact·공제 결정·package gate를 바꾸지 않는다.

VAI-5의 고액 운영 기준은 **거래 합계액 1천만원 이상**이다. 이는 세법상 고액 기준이나
공제·과세 판정 기준이 아니라, 여러 AI가 같은 결론에 도달하는지 한 번 더 확인하기 위한
제품 내부 escalation 기준이다.

## 4. Display Contract

```ts
type VatTaxTreatmentRecommendation = {
  rowId: string
  direction: 'sale' | 'purchase'
  recommendation:
    | 'likely_taxable'
    | 'likely_zero_rated'
    | 'likely_exempt'
    | 'likely_deductible'
    | 'likely_non_deductible'
    | 'proration_required'
    | 'needs_review'
  source: 'deterministic_rule' | 'prior_confirmed_pattern' | 'ai_single' | 'ai_consensus'
  confidence: 'high' | 'medium' | 'low'
  basisLabel: string
  ruleReference: string | null
  ruleVersion: string
  requiredEvidence: Array<{
    code: string
    label: string
    status: 'present' | 'missing' | 'needs_review'
  }>
  missingFacts: string[]
  finalDecision: string | null
  confirmedByStaffId: string | null
  confirmedAt: string | null
}
```

화면은 추천 결론을 한 줄로 먼저 보여주고, 근거·필요 증빙·AI 사용 여부는 같은 행에서
확인할 수 있어야 한다. `AI 판단`과 `사용자 확정`을 같은 라벨로 표시하지 않는다.

### 4.1 Required UI States

| 상태 | 화면 문구 원칙 | 사용자 액션 |
|:---|:---|:---|
| 높은 확신 | `공제 가능성 높음`, `과세 가능성 높음` | 적용 / 다르게 |
| 영세율·면세 | `영세율 가능성`, `면세 가능성` + 필요한 증빙 | 증빙 확인 / 사용자 확정 |
| 안분 | `공통매입 안분 필요` + 산식 근거 | 안분 검토 |
| 낮은 확신 | `확인 필요` + 부족한 사실 | 내용 보완 / 전문가 확인 |
| AI 지연·실패 | `AI 판단을 불러오지 못했습니다. 수동 검토를 계속할 수 있습니다.` | 수동 검토 / 다시 시도 |
| 확정 완료 | AI 추천과 별도로 `사용자 확정` | 변경 / 변경 이력 |

## 5. Runtime Safety Contract

- 각 provider 호출은 제한된 timeout과 전체 작업 deadline을 갖는다.
- provider 하나가 실패해도 다음 단계 또는 수동 검토로 전환한다.
- 모든 provider가 실패해도 서버 렌더·표 탐색·기존 사용자 mutation은 막지 않는다.
- 재시도는 횟수를 제한하며 무한 loading·무한 polling을 금지한다.
- 추천 응답은 구조화 스키마 검증을 통과해야 하며, 실패하면 `needs_review`다.
- tenant·사업장·기간 범위를 벗어난 이전 패턴과 거래는 프롬프트·결과에 포함하지 않는다.
- 개인정보와 원문 증빙은 판단에 필요한 최소 범위만 provider에 전달한다.
- 추천 결과는 package 생성 조건을 직접 해제하지 않는다. 사용자 확정된 VAT fact와
  deduction decision만 downstream gate가 소비한다.

## 6. Work Units and Fixed Order

| 작업 단위 | 내용 | 완료선 |
|:---|:---|:---|
| **VAI-0 · Scope Contract** | 현재 구현 격차·제품 경계·AI 단계·완료선 고정 | 본 문서·Backlog·Roadmap 동기화 |
| **VAI-1 · UI-First Gate** | `03_vat.html`에 AI 판단·근거·필요 증빙·사용자 확정·실패 상태 표시 | 브라우저에서 프로젝트 오너 승인 |
| **VAI-2 · Rule Matrix + Pre-Code Brief** | [공식 규칙 매트릭스](./45_VAT_AI_TAX_TREATMENT_RULE_MATRIX.md), [Zod/API/read model/mutation/감사 계약](./46_VAT_AI_TAX_TREATMENT_PRE_CODE_BRIEF.md) | 규칙 출처·버전·테스트 fixture와 Pre-Code Brief 승인 |
| **VAI-3 · Read-only Recommendation** | deterministic + 이전 확정 패턴 + 필요한 행만 single AI | 실제 데이터에서 추천·근거·증빙요건 표시, 저장 없음 |
| **VAI-4 · User Confirmation** | 적용/다르게/보류/전문가 확인, 최종 결정 저장·이력 | AI 추천과 사용자 확정이 분리 저장되고 undo/감사 가능 |
| **VAI-5 · Risk Escalation** | 고위험 multi-provider consensus·timeout·fallback | 불일치/실패가 비차단 `확인 필요`로 전환됨 |
| **VAI-6a · VAT Gate Connection** | 확정 결과를 VAT rebuild/package gate에서 소비 | 미확정 판단이 있으면 차단하고 확정 결과만 세액·패키지에 반영 |
| **VAI-6b · Evidence Attestation** | 영세율·면세 법정 증빙을 사용자가 확인 완료로 기록 | 증빙 항목·확인자·확인시각을 감사 가능하게 저장하고 재조회 시 `present`로 파생 |

VAI-1 승인 전 VAI-2 Pre-Code Brief와 코드 구현을 시작하지 않는다. VAI-3의 read-only
결과를 브라우저에서 검증하기 전 VAI-4 mutation을 붙이지 않는다.

## 7. Completion Line

JC-035는 다음을 **모두** 만족할 때만 `done`이다.

- [x] VAI-1 HTML Preview가 프로젝트 오너에게 승인됐다.
- [x] 공제/불공제/안분/과세/영세율/면세 공식 규칙 매트릭스의 출처·버전·적용일이 고정됐다.
- [x] 규칙·패턴·AI·consensus·수동 판단의 source와 근거가 화면에 구분된다.
- [x] 영세율·면세는 필수 증빙이 없으면 사용자 확정과 downstream gate가 차단된다.
- [ ] 사용자가 영세율·면세 필수 증빙을 확인 완료로 기록하고, 감사 이력과 함께 재조회할 수 있다.
- [x] AI가 판단하지 못하거나 timeout/error가 나도 화면과 수동 검토가 계속 동작한다.
- [x] 사용자 확인 없이 VAT fact·공제 decision·세액·package gate가 변경되지 않는다.
- [x] 같은 tenant·사업장·기간만 사용하고, 이전 확정 패턴도 같은 범위로 격리된다.
- [x] 규칙 버전, 추천, 사용자 최종 결정, 확정자, 확정시각의 감사 추적이 가능하다.
- [x] 대표 fixture로 deterministic/pattern/single-AI/consensus/fallback/수동 확정을 검증한다.
- [ ] 브라우저 E2E, tsc, 전체 테스트, lint, whitespace가 통과한다.
- [ ] Backlog·Screen Flow·UI Design·Prototype Review·QA가 main 코드와 일치한다.

다음은 JC-035 완료에 포함하지 않는다.

- 부가세 공식 업로드 파일 생성·업로드 검증(JC-030 VAT Stage A~G)
- 홈택스 제출·납부
- 세무 전문가의 법적 책임을 대신하는 최종 판정

## 8. Related Documents

- **UI_Screens**: [VAT HTML Preview](../02_UI_Screens/previews/03_vat.html) · [VAT Prototype Review](../02_UI_Screens/05_VAT_PROTOTYPE_REVIEW.md) · [Screen Flow §4d](../02_UI_Screens/00_SCREEN_FLOW.md) · [UI Design §4.4](../02_UI_Screens/01_UI_DESIGN.md)
- **Technical_Specs**: [VAT Pre-Code Brief](./07_VAT_PRE_CODE_BRIEF.md) · [VAI-2 Rule Matrix](./45_VAT_AI_TAX_TREATMENT_RULE_MATRIX.md) · [VAI-2 Pre-Code Brief](./46_VAT_AI_TAX_TREATMENT_PRE_CODE_BRIEF.md) · [VAT Provenance Audit](./42_VAT_CONFIRMED_LEDGER_PROVENANCE_AUDIT.md) · [VAT Stage A Audit](./43_JC030_VAT_NONENCRYPTED_UPLOAD_TEMPLATE_AUDIT.md) · [Path 1 Roadmap](./36_PATH1_FORM_FILL_ROADMAP.md)
- **Logic_Progress**: [Backlog JC-035](../04_Logic_Progress/00_BACKLOG.md)
- **QA_Validation**: [VAT Test Scenarios](../05_QA_Validation/05_VAT_TEST_SCENARIOS.md)
