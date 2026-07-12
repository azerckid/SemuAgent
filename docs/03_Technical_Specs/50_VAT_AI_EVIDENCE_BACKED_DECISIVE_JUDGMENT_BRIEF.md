# VAT AI Evidence-Backed Decisive Judgment Brief
> Created: 2026-07-12
> Last Updated: 2026-07-13
> Backlog: JC-039 · VAI-8
> Status: VAI-8a~8d implemented; VAI-8e pending

## 0. Decision

부가세 AI에게 판단을 요청했는데 결과가 단순히 **확인 필요**, **담당자 판단 필요**,
**전문가 확인**으로 끝나면 AI 판단 기능의 가치가 없다.

AI는 사용 가능한 자료와 공식 규칙을 먼저 찾아본 뒤 반드시 다음을 제공한다.

1. 가장 가능성이 높은 명확한 잠정 결론
2. 결론을 뒷받침하는 실제 근거 자료
3. 찾아본 자료와 찾지 못한 자료
4. 홈택스에서 유지하거나 수정할 권장 행동

확인 필요는 AI의 결론이 아니라 **사용자가 아직 최종 확정하지 않았다는 workflow 상태**로만
사용한다. 담당자 이관은 근거 탐색을 마친 뒤에도 필수 사실이 없거나 자료가 충돌하는 경우의
최후 수단이다.

## 1. Terminology Contract

### 1.1 Judgment and Workflow Must Be Separate

| 구분 | 의미 | 허용 예시 |
|:---|:---|:---|
| AI 잠정 결론 | AI가 자료와 규칙을 적용해 내린 세무 처리 방향 | 공제 가능성 높음, 불공제 가능성 높음, 과세, 영세율, 면세, 안분 필요, 해당 없음 |
| workflow 상태 | 사용자가 최종 확정했는지와 추가 행동이 있는지 | 사용자 확인 대기, 근거 없음 기본처리, 담당자 해결 필요, AI 일시 오류 |
| 사용자 최종 결정 | canonical VAT fact·공제 decision에 반영되는 사람의 결정 | 공제 확정, 불공제 확정, 과세 확정, 영세율 확정, 면세 확정 |

AI 잠정 결론 값으로 needs_review, 담당자 판단 필요, 전문가 확인을 사용하지 않는다.
이 표현은 workflow 상태 또는 사용자 행동으로만 존재할 수 있다.

### 1.2 Forbidden Final Answers

다음 응답은 AI 판단 완료로 인정하지 않는다.

- 확인이 필요합니다.
- 담당자가 판단해야 합니다.
- 전문가에게 문의하세요.
- 정보가 부족합니다.
- 확신할 수 없습니다.

위 문구가 필요하면 반드시 잠정 결론, 탐색 근거, 정확히 부족한 사실, 결론이 바뀌는 조건을
함께 제공해야 한다.

## 2. Evidence Search Order

AI는 판단 전에 다음 소스를 순서대로 검사한다.

1. **현재 거래의 구조화 사실**
   - 거래 방향, 일자, 거래처, 공급가액, 세액, 합계액, 계정항목, 적요
2. **연결 증빙**
   - 전자세금계산서, 카드 승인, 현금영수증, 첨부 문서, 증빙 연결 상태
3. **exact VAT fact와 자료대조 결과**
   - 과세유형, 금액 산술, 원장 연결, 누락·중복·취소·기간 오류
4. **같은 tenant·사업장의 사용자 확정 이력**
   - 동일 거래처·거래 성격의 과거 결정과 근거
5. **versioned 공식 규칙**
   - Rule Matrix에 등록된 법령·시행령·국세청 안내와 적용일
6. **조건부 provider 판단**
   - 위 사실을 규칙에 대입하기 어려운 경우에만 사용

AI는 존재하지 않는 증빙, 법령 조항, 과거 결정을 만들어내면 안 된다. 판단 결과에는 사용한
근거의 source type, 식별 가능한 row/document reference, 근거 요약, 발견 여부를 남긴다.
민감 원문 전체와 provider 원문 응답은 저장하지 않는다.

## 3. No Evidence Means No Special Treatment

영세율·면세·공제·안분처럼 일반 처리에서 벗어나는 특례 또는 예외는 **적극적인 근거가
확인될 때만** 추천한다.

| 검토 대상 | 근거를 찾은 경우 | 근거를 찾지 못한 경우의 잠정 결론 |
|:---|:---|:---|
| 영세율 | 수출·국외용역 사실과 필수 증빙을 확인 | 영세율 해당 없음, 과세 방향 |
| 면세 | 법정 면세 요건·인허가·실질 용역을 확인 | 면세 해당 없음, 과세 방향 |
| 매입세액 공제 | 적격 증빙·사업 관련성·과세사업 귀속을 확인 | 공제 해당 없음, 불공제 방향 |
| 공통매입 안분 | 과세·면세 공통 사용 사실과 안분 근거를 확인 | 안분을 자동 적용하지 않음 |
| 신고대상 제외 | 공식 제외 규칙과 거래 구조를 확인 | 제외 해당 없음, 신고대상 방향 |

해당 없음은 자료를 찾아보지 않았다는 뜻이 아니다. 정해진 소스를 모두 확인했지만 해당
요건을 입증하는 근거를 발견하지 못했다는 판단이어야 한다.

안분처럼 근거가 없다고 하나의 숫자를 안전하게 만들 수 없는 경우에는 숫자를 추정하지 않는다.
대신 현재 사실로 가능한 잠정 방향과 부족한 단 하나의 귀속 사실을 명시한 뒤 담당자 이관
조건을 적용한다.

## 4. Human Handoff Gate

담당자 해결 필요는 다음 중 하나일 때만 허용한다.

1. **필수 사실 부재**
   - 모든 정해진 소스를 확인했지만 결론에 필수적인 외부 사실이 시스템에 없다.
2. **근거 충돌**
   - 증빙·원장·과거 확정·공식 규칙이 서로 다른 결론을 지지한다.
3. **공식 규칙 공백 또는 합의 실패**
   - versioned 규칙으로 다룰 수 없는 거래 구조이고 multi-provider 중재 후에도 결론이 갈린다.

낮은 confidence, provider 한 곳의 실패, timeout, 어려운 거래라는 이유만으로 담당자에게
넘길 수 없다. provider 장애는 AI 일시 오류 상태이며 AI의 판단 결과가 아니다.

### 4.1 Required Handoff Payload

담당자 이관에는 다음 항목이 모두 있어야 한다.

- 잠정 결론
- 확인한 자료 목록
- 찾지 못했거나 충돌한 근거
- 담당자가 확인할 정확한 한 가지 사실
- 그 사실의 답에 따라 결론이 어떻게 바뀌는지

예시:

> 잠정 결론: 불공제 방향<br>
> 확인 자료: 카드 승인, 계정항목, 거래처 과거 3건<br>
> 부족 사실: 이번 지출의 참석자와 업무 목적<br>
> 확인 질문: 외부 거래처 접대 목적의 지출입니까?<br>
> 예이면 기업업무추진비 불공제, 아니면 업무용 증빙을 추가해 공제 재검토

## 5. Target Data Contract

VAI-8a부터 recommendation의 legacy 호환값과 실제 잠정 결론·workflow 상태를 분리한다.
최소 계약은 다음과 같다.

| 필드 | 목적 |
|:---|:---|
| provisionalJudgment | 공제/불공제/과세/영세율/면세/안분/해당 없음 중 잠정 결론 |
| judgmentWorkflowStatus | 판단 준비 중/사용자 확인 대기/사용자 확정/근거 없음 기본처리/담당자 해결 필요/AI 일시 오류 |
| evidenceTrace | 확인한 source·reference·발견 상태·근거 요약 |
| searchedSources | 소스별 탐색 완료 기록 |
| missingEssentialFact | 담당자 이관을 허용한 단일 필수 사실 |
| handoffReason | essential_fact_missing/evidence_conflict/rule_gap/no_consensus |
| recommendedHometaxAction | 유지·수정·추가·제외 등 사용자의 다음 행동 |
| confidence / ruleVersion / promptVersion | 재현·stale·감사 추적 |

기존 canonical VAT fact, deduction decision, 사용자 확정 감사 테이블은 그대로 유지한다.
VAI-8 결과는 추천·workflow 계층이며 사용자 확인 없이 canonical 값을 변경하지 않는다.

### 5.1 VAI-8a Migration Boundary

- 신규 SQL migration·테이블·컬럼은 추가하지 않는다.
- provider 응답은 `provisionalJudgment`만 허용하며 `needs_review`를 세무 결론으로 받을 수 없다.
- 기존 `recommendation`은 규칙엔진·mutation·감사 호환 경계에서만 유지한다.
- VAI-8a 시점의 `vat_tax_treatment_ai_result.result_payload_json`은 payload v2와 prompt
  `vat-tax-treatment-v2`로 전환했다. 현재 버전은 VAI-8b §5.2의 v3가 대체한다.
- 기본 작업대는 잠정 결론 한 칩만 표시하고, provider 장애는 `AI 일시 중단` workflow로
  분리한다. 추가 근거 trace와 담당자 이관 UI는 VAI-8b~8e 범위다.

### 5.2 VAI-8b Evidence Resolver Boundary

- 신규 SQL migration 없이 기존 classification·VAT fact·연결 증빙·사용자 확정·규칙 데이터를 읽는다.
- 모든 display row는 `current_transaction`, `linked_evidence`, `exact_vat_fact`,
  `reconciliation_result`, `prior_confirmed_decision`, `official_rule` 여섯 source의 탐색 결과를 가진다.
- 각 source는 `found`·`not_found`·`not_applicable` 중 하나이며 `found`는 실제
  classification/source/rule reference 없이는 schema를 통과할 수 없다.
- 연결 증빙 reference는 같은 tenant의 현재 classification 조회 범위에 실제 존재하는 행만 사용한다.
- evidence trace와 searched source는 recommendation fingerprint에 포함한다. 연결·규칙·과거 확정이
  바뀌면 저장 AI 결과는 stale이 된다.
- stored result는 payload v3·prompt `vat-tax-treatment-v3`를 사용한다. provider prompt에는
  source·상태·마스킹된 요약만 전달하고 내부 row/document reference는 보내지 않는다.
- VAI-8b는 근거를 수집·보존하는 read-only 단계다. 근거 없음 기본처리와 명확 결론은 VAI-8c에서 구현한다.

### 5.3 VAI-8c Decisive Default Boundary

- 규칙 결과에 VAI-6b 증빙 확인 상태를 먼저 합친 뒤 근거 없음 기본처리를 적용한다. 따라서 영세율·면세
  증빙을 나중에 확인하면 기존 특례 방향을 다시 표시할 수 있다.
- 매입 공제는 정확한 VAT fact·적격 매입 증빙·업무 목적이 모두 `present`일 때만 유지한다. 하나라도
  없으면 `likely_non_deductible`과 `no_evidence_defaulted`를 제시한다.
- 영세율은 법정 영세율 증빙, 면세는 면세 요건 근거가 `present`일 때만 유지한다. 근거가 없으면
  `likely_taxable`과 찾지 못한 근거를 제시한다.
- 안분은 근거 없이 안분율을 만들지 않는다. `proration_required`를 유지하고 실제 안분 기준 확인은
  사용자 확정 단계에 남긴다.
- provider가 근거 없는 공제·영세율·면세 결론을 반환해도 동일 resolver를 다시 적용한다. 기본처리된
  행은 AI 재호출 대상에서 제외한다.
- VAI-8c 시점의 stored result는 payload v4·prompt `vat-tax-treatment-v4`를 사용했다. 현재 버전은
  VAI-8d §5.4의 v5가 대체한다.
- 신규 SQL migration·canonical VAT fact·deduction decision·gate write·기본 UI 변경은 없다.

### 5.4 VAI-8d Human Handoff Boundary

- `humanHandoff`는 reason·잠정 결론·확인 자료 reference·부족/충돌 근거·정확한 질문 한 개·답변에
  따른 결론 변화를 모두 포함해야 한다. `human_resolution_required`와 payload 존재는 Zod가 양방향으로
  강제한다.
- 자동 이관은 (1) 안분에 필요한 실지귀속·안분 기준 부재, (2) 같은 거래처·방향의 과거 확정이
  최다 동률로 충돌, (3) 적용할 versioned 공식 규칙 공백, (4) 다중 AI에서 유효한 결론이 실제로
  둘 이상 갈린 경우에만 허용한다.
- 낮은 confidence, 단일 provider 실패, timeout, 응답 부족은 담당자 이관 사유가 아니다. 이 경우
  기존 `ai_temporary_error`와 fallback backoff를 유지한다.
- 다중 AI 불합의는 `no_consensus` 실행 상태와 stable ready 결과로 저장한다. 자동 재시도하지 않으며
  입력 fingerprint가 바뀔 때만 stale이 된다.
- handoff 질문이 남아 있는 행은 추천 바로 적용을 UI helper와 서버 mutation에서 차단한다. 사용자는
  이유를 포함한 다른 판단 확정 또는 후속 VAI-8e 질문 응답 흐름을 사용한다.
- stored result는 payload v5·prompt `vat-tax-treatment-v5`를 사용하며 v1~v4 결과는 재사용하지 않는다.
- 신규 SQL migration·canonical VAT fact·deduction decision·gate write·기본 UI 변경은 없다.

## 6. UI Contract

각 예외 행은 다음 순서로 표시한다.

1. **AI 잠정 결론**
2. **근거 자료**
3. **홈택스 권장 행동**
4. 사용자 적용/변경

담당자 해결 필요는 Human Handoff Gate를 통과한 행에만 표시한다. 이 경우에도 잠정 결론과
근거 탐색 결과를 먼저 보여준다. 단독 확인 필요 칩과 단독 전문가 확인 문구는 금지한다.

## 7. Fixed Implementation Order

| 작업 단위 | 내용 | 완료선 |
|:---|:---|:---|
| **VAI-8a · Judgment/Workflow Contract** | 결과 enum·Zod·API·UI 용어 분리 | **완료(2026-07-13)** · provider 결론에서 needs_review 제거, 당시 payload/prompt v2, SQL migration 없음 |
| **VAI-8b · Evidence Resolver** | 정해진 소스 탐색·evidence trace·공식 규칙 reference | **완료(2026-07-13)** · 여섯 source 탐색·실제 reference·fingerprint/payload v3 연결 |
| **VAI-8c · Decisive Recommendation** | 근거 기반 잠정 결론과 근거 없음 기본처리 | **완료(2026-07-13)** · 공제 근거 없음→불공제, 영세율·면세 근거 없음→과세, 안분율 추정 금지, payload/prompt v4 |
| **VAI-8d · Handoff Gate** | 필수 사실 부재·충돌·규칙 공백/합의 실패만 이관 | **완료(2026-07-13)** · 구조화 payload, 4개 허용 reason, provider 장애 분리, 추천 바로 적용 차단, payload/prompt v5 |
| **VAI-8e · UI and E2E** | 결론→근거→행동 표시, 적용/변경·담당자 이관 검증 | 대표 거래에서 근거 링크·결론·최종 사용자 확인 증명 |

JC-037 결과 저장은 evidence trace와 새 judgment/workflow 구조를 저장할 수 있어야 한다.
JC-038 Preview는 VAI-8의 결론 우선 정보 계층을 반영한 뒤 runtime을 수정한다.

## 8. Acceptance Criteria

- [x] AI 판단 결과가 확인 필요·담당자 판단 필요·전문가 확인으로만 끝나지 않는다.
- [x] 모든 AI 잠정 결론에 실제 근거 source와 reference가 하나 이상 있다.
- [x] 지정된 소스를 모두 탐색하지 않은 결과는 완료 상태가 될 수 없다.
- [x] 영세율·면세·공제 방향은 적극적인 근거가 있을 때만 유지하며, 안분은 근거 없이 비율을 만들지 않는다.
- [x] 특례·예외 근거가 없으면 해당 없음과 보수적 기본 방향을 제시한다.
- [x] 낮은 confidence만으로 담당자 이관하지 않는다.
- [x] 담당자 이관은 허용 조건과 required payload를 모두 만족한다.
- [x] provider timeout은 AI 일시 오류로 표시하고 거짓 판단 근거를 만들지 않는다.
- [x] 사용자 확인 전 canonical VAT fact·deduction decision·gate를 변경하지 않는다.
- [x] tenant·사업장·기간 격리와 PII 최소화를 유지한다.
- [ ] 대표 fixture와 브라우저 E2E에서 결론·근거·권장 행동·이관 질문을 확인한다.

## 9. Out of Scope

- AI 자동 세무확정
- 근거 없는 법령·증빙 생성
- 세무사 자문 또는 법적 책임 대체
- 홈택스 자동 제출·자동 수정
- 공식 Rule Matrix에 없는 법령을 실시간 웹 검색 결과만으로 적용

## 10. Related Documents

- **Concept_Design**: [Product Baseline](../01_Concept_Design/01_PRODUCT_BASELINE.md) - 회사 직접 신고 보조와 사용자 최종 책임 경계
- **UI_Screens**: [VAT Prototype Review](../02_UI_Screens/05_VAT_PROTOTYPE_REVIEW.md) · [VAT HTML Preview](../02_UI_Screens/previews/03_vat.html) - VAI-8e 결론 우선 예외 작업대의 UI-first 검증 대상
- **Technical_Specs**: [JC-035 Completion Contract](./44_VAT_AI_TAX_TREATMENT_COMPLETION_CONTRACT.md) · [Rule Matrix](./45_VAT_AI_TAX_TREATMENT_RULE_MATRIX.md) · [VAI-2 Pre-Code Brief](./46_VAT_AI_TAX_TREATMENT_PRE_CODE_BRIEF.md) · [JC-037 Loading Brief](./47_VAT_AI_LOADING_AND_RESULT_REUSE_PRE_CODE_BRIEF.md) · [JC-038 Screen Brief](./48_VAT_SCREEN_SIMPLIFICATION_AND_DEDUPLICATION_BRIEF.md)
- **Logic_Progress**: [Backlog JC-039](../04_Logic_Progress/00_BACKLOG.md)
- **QA_Validation**: [VAT Test Scenarios](../05_QA_Validation/05_VAT_TEST_SCENARIOS.md)
