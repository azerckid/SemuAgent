# JC-030 Withholding Official Upload Form Pre-Code Technical Brief
> Created: 2026-07-07 04:40 KST
> Last Updated: 2026-07-11 KST

## 0.1 Flow Status

```text
[Flow]
완료: Slice 0b 서식 조사·Part A 매핑, Slice 1a 검증 패널, W0 공식 경로 감사
판정: 원천세 1a 양식 없음 → 1b(직접입력 정리) 대상으로 결정. 공식 안내는 직접작성/비밀번호 변환파일뿐
다음(미구현): A01 확정 집계를 1b `항목 = 값` 화면으로 정리(파일 generator 없음)
1a 승격: 최신 공식 비암호화 원본과 직접 수용 메뉴가 새로 확인되면 본 Brief(W1~W5)를 활성화
제외: 바이너리 레코드 추정, fcrypt·암호화 파일, 단계별 위치 안내
```

## 0. Governing Principle

JC-030 Path 1 **2번 세목 후보**는 JC-012·JC-013이 준비한 **월별 원천징수 집계**를
홈택스가 직접 수용하는 **원천징수이행상황신고서 공식 비암호화 업로드 양식**에
채우고, 제출 전 **서식·정합성 사전검증**을 보여준다.

- **자동 제출·자격증명 저장 없음** (JC-023 원칙).
- **self-filing 보조** — 사용자가 홈택스 원천세 신고에서 준비된 파일을 직접 업로드·제출.
- v1은 **근로소득 간이세액(A01) 집계 행**만; 환급조정·부표·타 소득구분 제외.
- 공식 비암호화 업로드 양식 **미확인** → 원천세는 **1b(직접입력 정리) 대상으로 결정** — [Final Audit](./37_JC030_WITHHOLDING_EFILING_LAYOUT_ACQUISITION.md). 아래 1a 파일 구현 범위는 공식 양식 확인 전 비활성이다. 1b A01 값 정리 화면은 아직 구현하지 않았고(현재 앱은 검증 패널만 표시) 후속 구현 과제다.

## 1. Scope

포함한다 (v1, 공식 비암호화 업로드 양식 확인 **후**).

1. `/dashboard/filing-support` 원천세 항목 또는 급여 화면 연동 **JC-030 패널**
2. 귀속월(`payrollPeriodKey`) 선택 — JC-012·JC-013과 동일
3. A01 서식 필드 검증 read model
4. 일회성 메타 입력(Zod): 세무서코드·담당자 등 [갭 — 공식 양식 확인 후]
5. **공식 비암호화 업로드 양식** 생성 + 결정론적 단위 테스트
6. 암호화·fcrypt·전자신고 암호 입력은 범위 밖
7. `POST /api/filing-preparation/withholding-efiling/generate` — stream, 서버 미보관
8. 홈택스 비암호화 파일 업로드 단계 안내 ([Layout Acquisition §5](./37_JC030_WITHHOLDING_EFILING_LAYOUT_ACQUISITION.md))

**Slice 0b~1a (W0 통과 전):** 패널에 **서식 검증·JC-013 값 대조·blocking 사유**만 표시, 다운로드 버튼 비활성.

제외한다 (v1).

- 연말·반기-only 로직(반기납 사업자)
- A02~A03·환급(⑫~㉑)·부표·타 소득구분
- 지방소득세 위택스 파일(JC-027 별도)
- 간이지급(SC)·지급명세서(1175) 파일
- `국세청 검증 완료` UI
- 직원별 주민번호(집계 신고서)
- 암호화 전자파일·NTS-CRYPTO·전자신고 암호
- 홈택스 메뉴·입력칸 위치 단계별 안내·자동제출 (1b는 값 정리 표시까지)

## 2. Route and Component Boundary

| 항목 | 결정 |
|:---|:---|
| Route | `/dashboard/filing-support` — 원천세 `FilingSupportItem` 확장 **(권장)** |
| 대안 | `/dashboard/payroll` — 급여 마감 직후 맥락 |
| Read model | `lib/efiling-withholding/summary.ts` (신규) |
| Generator | W0 공식 파일 형식에 맞춰 결정 — **Part B 승인 후** |
| Persistence | 없음 |
| API | `POST /api/filing-preparation/withholding-efiling/generate` |
| 진입 | 신고지원 → 원천징수이행상황신고 항목 → JC-030 패널 |

## 3. Data Sources

[Field Mapping §3](./38_JC030_WITHHOLDING_EFILING_FIELD_MAPPING.md).

| 소스 | 용도 |
|:---|:---|
| `payroll_period_summary` | 마감·인원·총지급·원천 합계 |
| `payroll_employee_line` | `incomeTaxKrw` 합계·`needs_review` |
| `lib/filing-support/summary.ts` | JC-013 가이드 교차 검증 |
| `client` + billing | 사업장 식별 |
| Request body | 공식 양식이 요구하는 세무서코드·담당자 등; 암호 입력 없음 |

## 4. File Format Contract

### 4.1 현재 상태 — **[갭] 비암호화 업로드 양식 미확인**

원천세 작성 HWP/PDF는 확인했지만 홈택스가 직접 수용하는 업로드 양식으로
확인되지 않았다. 구현 시 아래를 **공식 비암호화 업로드 원본과 홈택스 메뉴**에서 확정한다.

| 항목 | 상태 |
|------|------|
| 파일명·확장자 | [갭] |
| 시트·표·열 구조 | [갭] |
| 필수 필드·코드 | [갭] |
| A01 집계 필드 위치 | Part A 서식 매핑 완료 → Part B에서 공식 양식 위치 확정 |
| 홈택스 직접 수용 메뉴 | [갭] |

### 4.2 서식 정합 (Part A — 구현 가능 선행)

- **A01 ④⑤⑥** = JC-012/JC-013 live 값
- blocking: `closeStatus !== 'closed'`, `needs_review` 라인, Σ세액 불일치

### 4.3 암호화

- fcrypt·암호화 전자파일·전자신고 암호는 본 Brief와 현재 제품 범위에서 제외한다.

## 5. API Contract (Zod 초안)

```typescript
// lib/efiling-withholding/schemas.ts (신규, 구현 시)
const withholdingEfilingGenerateBodySchema = z.object({
  tenantId: z.string().uuid(),
  clientId: z.string().uuid(),
  payrollPeriodKey: z.string().regex(/^\d{4}-\d{2}$/),
  taxOfficeCode: z.string().length(3).optional(),
  submitterPhone: z.string().max(15).optional(),
})
```

Response: W0에서 확인된 공식 파일의 content type 또는 `422` + validation errors.

## 6. UI Copy (JC-030 공통)

- Scope Gate §5.3: **`국세청 검증 완료` 금지**
- Path 1 한계: 파일 업로드·최종 검증은 **사용자 홈택스**에서 수행
- 책임: [Filing Support responsibility](./09_FILING_SUPPORT_PRE_CODE_BRIEF.md)

## 7. Implementation Slices

| Slice | 내용 | 게이트 |
|-------|------|--------|
| **0b** | 참조 PDF 입수·Field Mapping | 완료 (업로드 양식 갭 명시) |
| **1a** | filing-support 패널 — 서식 검증·JC-013 대조 only | **구현 완료** (W0 전) |
| **1b-W0** | 공식 비암호화 업로드 양식·수용 경로 확인 | 파일·버전·적용일·홈택스 업로드 메뉴·직접 수용 확인 |
| **1b-W1** | Field Mapping Part B·Brief 최종 승인 | 모든 v1 필드/검증의 공식 양식 위치 확정 |
| **1b-W2** | shared read model + generator + 양식 채움 확인 | 화면 값과 생성 양식 값의 동일성 |
| **1b-W3** | generate API + 다운로드 UI | tenant/client/month scope, 서버 미보관, blocker 우회 불가 |
| **1b-W4** | file/browser/Hometax verification | 파일 구조 fixture와 실제 비암호화 업로드 검증 통과 |
| **1b-W5** | docs/QA closeout | Roadmap §2.1, Backlog, QA, Audit 동기화 |
| **1b branch** | 공식 양식 없음 | 1a generator 미구현, 확정 A01을 직접입력 정리 화면으로 표시하는 것이 목표(1b 화면 미구현) |

Slice 1b는 W0부터 W5까지 완료되어야 끝난다. W0·W1 전에는 W2 generator
코드를 작성하지 않는다.

### 7.1 Slice 1b Completion Line

- [ ] 공식 비암호화 업로드 양식의 출처·버전·적용일과 홈택스 수용 경로가 기록된다.
- [ ] A01 v1 필드가 공식 양식의 exact 시트/셀/열에 매핑된다.
- [ ] payroll 마감·needs-review·합계 불일치가 Preview와 API 모두에서 생성 차단된다.
- [ ] Preview와 생성 양식이 동일 read model을 사용한다.
- [ ] 파일명·파일 형식·양식 구조·필수 필드·합계가 결정론적으로 검증된다.
- [ ] 다른 tenant·사업장·귀속월 데이터가 섞이지 않는다.
- [ ] 브라우저 다운로드와 대표 파일의 홈택스 비암호화 업로드 검증이 통과한다.
- [ ] 파일·PII·자격증명은 서버에 영구 저장되지 않는다.
- [ ] 사용자가 직접 업로드(1a)·직접 입력(1b)·제출하며 단계별 위치 안내·자동제출 문구가 없다.
- [ ] QA·Backlog·Completion Contract·Audit가 main 상태와 일치한다.

## 8. Preconditions (착수 전)

- [x] Layout Acquisition Slice 0a (37)
- [x] Field Mapping Part A 초안 (38)
- [ ] **공식 비암호화 업로드 양식·홈택스 직접 수용 경로 확인**
- [x] UI-First Gate — filing-support 원천세 JC-030 패널 HTML
- [x] Slice 1a — `lib/efiling-withholding` 검증 패널 (다운로드 비활성)
- [ ] Slice 1b W0 공식 비암호화 업로드 양식 확인
- [ ] Slice 1b W1 Part B 매핑·Brief 최종 사용자 승인

## 9. Related Documents

- [Field Mapping](./38_JC030_WITHHOLDING_EFILING_FIELD_MAPPING.md)
- [Layout Acquisition](./37_JC030_WITHHOLDING_EFILING_LAYOUT_ACQUISITION.md)
- [Simplified Wage Pre-Code Brief](./30_JC030_EFILING_FILE_PRE_CODE_BRIEF.md) — 패턴 참조
- [Path 1 Roadmap](./36_PATH1_FORM_FILL_ROADMAP.md)
- [Path 1 E2E Readiness Audit](./40_PATH1_END_TO_END_FILING_READINESS_AUDIT.md)
- [Filing Support QA](../05_QA_Validation/07_FILING_SUPPORT_TEST_SCENARIOS.md)
