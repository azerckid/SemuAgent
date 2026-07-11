# VAT AI Loading and Result Reuse Pre-Code Brief
> Created: 2026-07-12
> Last Updated: 2026-07-12
> Backlog: JC-037 · VAI-7
> Status: docs-only contract; runtime implementation pending

## 0. Decision

부가세 화면은 **새 데이터나 판단 근거가 없는데도 페이지를 열 때마다 LLM을 다시 호출하면 안 된다.**

현재 `/dashboard/vat`은 초기 서버 렌더에서 AI 판단을 활성화하고, 고위험 consensus,
single-provider 판단, 추가 consensus를 순차적으로 기다린다. 결과 재사용 계층과 초기 화면
분리가 없어 같은 미확정 데이터도 새로고침할 때 다시 판단한다.

JC-037은 이 문제를 다음 원칙으로 고친다.

```text
최초 화면 = DB 사실 + 공식 규칙 + 저장된 AI 결과를 즉시 표시
새 판단 필요 = 화면을 먼저 연 뒤 비동기로 1회 실행
같은 fingerprint = provider 재호출 0회
데이터·규칙·prompt 변경 또는 사용자 명시 요청 = 다시 판단
```

JC-035의 세무판단 기능 완료 상태는 유지한다. JC-037은 **로딩·결과 재사용·중복 호출
방지라는 긴급 사용성 결함**을 닫는다.

## 1. Current Gap

### 1.1 Confirmed Runtime Facts

- VAT page의 초기 요청이 AI 판단 완료를 기다린다.
- DB·규칙·prompt가 그대로여도 미확정 행은 페이지 요청마다 다시 provider에 전달된다.
- transient AI 추천을 fingerprint 기준으로 재사용하는 저장 계층이 없다.
- VAT page에 AI 판단을 초기 렌더와 분리하는 비동기 상태 경계가 없다.
- 현재 orchestration은 고위험 consensus -> single-provider -> 추가 consensus 순서이며,
  각 provider 단계 timeout이 누적되면 구조상 약 40초까지 대기할 수 있다.
- package/rebuild API는 live AI를 호출하지 않지만 사용자가 보는 VAT page는 호출한다.

### 1.2 User-Visible Failure

새 자료가 없는데도 화면을 열 때마다 로딩이 반복된다. 사용자는 AI가 무엇을 새로 판단하는지
알 수 없고, provider 지연·quota·장애가 VAT 표 전체의 진입 속도를 결정한다. 이는 JC-035의
"AI 실패에도 화면 비차단" 원칙을 최초 진입에서는 충족하지 못하는 상태다.

## 2. Product Contract

1. **초기 화면 비차단**
   - 최초 서버 렌더는 LLM 응답을 기다리지 않는다.
   - DB 사실, deterministic rule, 사용자 확정값, 마지막 저장 AI 결과만 읽어 화면을 연다.
2. **동일 결과 재사용**
   - 동일 recommendation fingerprint, rule version, prompt version이면 저장 결과를 재사용한다.
   - `ready`는 입력 또는 version이 바뀔 때까지 재사용한다.
   - `manual_fallback`은 `nextRetryAt` 전까지 재사용하며, 단순 페이지 방문은 재시도를 만들지
     않는다. 재시도는 backoff 만료 뒤의 명시 스케줄 또는 사용자 요청으로만 시작한다.
3. **변경 기반 재판단**
   - 거래 사실, 계정, 증빙, VAT fact, 사용자 결정, 규칙 버전, prompt version이 바뀐 경우만
     기존 결과를 stale로 보고 새 판단을 허용한다.
4. **사용자 명시 요청**
   - 사용자는 `AI 다시 확인`을 눌러 명시적으로 새 판단을 요청할 수 있다.
   - 이 동작도 중복 실행 방지와 tenant scope를 지켜야 한다.
5. **확정 행 보호**
   - 사용자 확정이 끝난 행은 자동 AI 재판단 대상에서 제외한다.
   - 규칙 버전 변경 시 기존 결정을 덮지 않고 별도 재검토 상태만 표시한다.
6. **정본 분리**
   - AI 결과는 추천 캐시다. exact VAT fact, `vat_deduction_review`, 사용자 확정 감사 row를
     대체하거나 package gate를 직접 해제하지 않는다.

## 3. Result Reuse Contract

### 3.1 Additive Storage

기존 `vat_tax_treatment_review`는 사용자 확정 감사 snapshot이므로 미확정 AI 결과 캐시로
재사용하지 않는다. 구현 시 additive `vat_tax_treatment_ai_result` 계층을 우선 검토한다.

| 필드 | 목적 |
|:---|:---|
| tenant/business entity/period/classification row | 격리된 판단 범위 |
| recommendation fingerprint | 원천 사실과 현재 판단 입력의 동일성 |
| rule version / prompt version | 규칙·prompt 변경 감지 |
| status | `queued`, `running`, `ready`, `manual_fallback`, `stale` |
| recommendation / confidence / basis label | 화면 표시용 구조화 결과 |
| missing facts / Hometax action | 사용자가 확인할 내용 |
| minimal provider trace | provider 종류·모델·완료 상태만 감사 |
| started/completed/next retry/updated at | 실행 상태·backoff·운영 측정 |

동일 tenant·사업장·기간·행·fingerprint에는 활성 실행이 하나만 존재해야 한다. 원문 prompt,
provider 원문 응답, 주민번호·카드번호·계좌번호 등 민감 원문은 저장하지 않는다.

### 3.2 Fingerprint

기존 JC-035 recommendation fingerprint 계약을 재사용하되 버전을 함께 묶는다.

```text
cache key = tenant scope + row id + recommendation fingerprint
            + rule version + prompt version
```

provider 모델명 변경만으로 전체 행을 자동 재판단하지 않는다. prompt/규칙의 의미 변경이 있을
때 명시적으로 version을 올린다.

## 4. Request and UI Flow

### 4.1 Initial Request

1. 서버는 DB 사실, 규칙 결과, 사용자 확정, 저장 AI 결과를 읽는다.
2. VAT 표와 기본 요약을 즉시 렌더한다.
3. AI 결과가 없거나 stale인 행만 `확인 중`으로 표시한다.
4. 최초 HTML/RSC 응답 경로에서는 provider를 호출하지 않는다.

### 4.2 Async Evaluation

1. 화면이 열린 뒤 클라이언트가 비동기 실행 API를 호출한다.
2. 서버는 같은 scope/fingerprint의 `queued|running|ready|manual_fallback`과 재시도 시각을 먼저 확인한다.
3. 기존 실행·결과가 있으면 그대로 반환하고 provider를 호출하지 않는다.
4. 신규 실행이 필요할 때만 현재 JC-035 orchestration을 실행한다.
5. 완료 후 해당 판단 행만 갱신한다. 페이지 전체를 다시 로딩하지 않는다.

polling을 사용한다면 횟수·간격·전체 시간을 제한한다. durable queue 또는 background runner
선택은 VAI-7a 조사에서 현재 Vercel 런타임에 맞춰 결정한다.

### 4.3 Visible States

- `판단 완료`: 저장 결과와 완료 시각 표시
- `확인 중`: 표는 사용 가능하고 해당 행만 진행 상태 표시
- `수동 확인`: timeout·quota·불합의 결과, 화면과 mutation은 계속 사용
- `다시 확인 필요`: 원천 사실 또는 규칙/prompt version 변경
- `AI 다시 확인`: 사용자 명시 재실행

전체 페이지 spinner와 끝나지 않는 loading은 금지한다.

## 5. Fixed Implementation Order

| 작업 단위 | 내용 | 완료선 |
|:---|:---|:---|
| **VAI-7a · Read/AI Split + Instrumentation** | 초기 read path와 provider path 분리, 현재 시간·호출 수 계측 | VAT 최초 렌더 provider 호출 0회, 기존 기능 회귀 없음 |
| **VAI-7b · Result Reuse Storage** | additive 결과 저장, fingerprint/version invalidation, idempotency | 동일 입력 재방문 저장 결과 재사용, 다중 탭 중복 실행 없음 |
| **VAI-7c · Async Trigger + Status UI** | 비동기 실행 API, 행 상태 갱신, 명시적 `AI 다시 확인` | 표를 먼저 사용하고 결과 행만 갱신, 실패 시 수동 확인 |
| **VAI-7d · Cutover + Verification** | 동기 AI 경로 제거, 브라우저 E2E·관측·문서 정합 | 호출 수·초기 렌더 시간·stale 재판단을 실제 환경에서 증명 |

VAI-7a에서 현재 provider 호출 수와 VAT 초기 응답 시간을 먼저 측정한다. VAI-7b migration이
필요하면 additive SQL을 dev/prod에 코드 머지 전에 적용한다. VAI-7c 완료 전 동기 경로를
제거하지 않고 VAI-7d에서 단일 경로로 전환한다.

## 6. Acceptance Criteria

- [ ] 저장 결과가 완성된 동일 VAT 화면을 10회 새로고침해도 추가 provider 호출은 0회다.
- [ ] 최초 의미 있는 VAT 표 렌더 P95는 3초 이내를 목표로 하며 구현 PR에 전후 측정값을 남긴다.
- [ ] provider timeout·quota·전체 실패가 VAT page 최초 렌더를 막지 않는다.
- [ ] 데이터·규칙·prompt version 변경은 기존 결과를 stale로 만들고 신규 실행을 정확히 1회 만든다.
- [ ] 같은 화면을 여러 탭에서 열어도 동일 scope/fingerprint 실행은 하나다.
- [ ] 사용자 확정 행은 자동 provider 호출 대상에서 제외된다.
- [ ] `AI 다시 확인`은 사용자의 명시 동작이며 기존 사용자 확정값을 변경하지 않는다.
- [ ] tenant·사업장·기간·행 격리와 PII 최소화가 유지된다.
- [ ] 원문 prompt·원문 provider 응답·민감 식별정보를 영구 저장하지 않는다.
- [ ] rebuild/package gate는 live LLM 응답을 기다리거나 AI 추천만으로 해제되지 않는다.
- [ ] 브라우저 E2E에서 화면 선렌더, 비동기 갱신, 실패 fallback, stale 재판단을 확인한다.

## 7. Out of Scope

- 부가세 화면의 정보량·배치·표 구조 개편
- 세무 판단 규칙과 provider consensus 정책 변경
- AI 자동확정 또는 사용자 확정값 자동 덮어쓰기
- VAT canonical 세액 계산·provenance·package 형식 변경
- 홈택스 양식·제출 기능

UI 정보구조 개선은 프로젝트 오너와 별도 논의 후 독립 문서·PR로 진행한다.

## 8. Completion Line

JC-037은 VAI-7a~7d 코드·필요 migration·dev/prod 적용·브라우저 검증을 완료하고,
**동일 데이터 재방문 provider 호출 0회**와 **AI 실패 중 화면 사용 가능**을 실제 계측으로
증명한 뒤에만 `done`으로 전환한다.

## 9. Related Documents

- **Concept_Design**: [Product Baseline](../01_Concept_Design/01_PRODUCT_BASELINE.md) - AI는 검토를 보조하고 사용자 확정값을 대체하지 않는 제품 경계
- **UI_Screens**: [VAT Prototype Review](../02_UI_Screens/05_VAT_PROTOTYPE_REVIEW.md) · [VAT HTML Preview](../02_UI_Screens/previews/03_vat.html) - 기존 화면을 유지하며 VAI-7c 상태 UI는 별도 오너 확인 후 동기화
- **Technical_Specs**: [JC-035 Completion Contract](./44_VAT_AI_TAX_TREATMENT_COMPLETION_CONTRACT.md) · [VAI-2 Pre-Code Brief](./46_VAT_AI_TAX_TREATMENT_PRE_CODE_BRIEF.md)
- **Logic_Progress**: [Backlog JC-037](../04_Logic_Progress/00_BACKLOG.md)
- **QA_Validation**: [VAT Test Scenarios](../05_QA_Validation/05_VAT_TEST_SCENARIOS.md)
