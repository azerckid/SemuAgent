# JC-030 E-Filing File Generation Pre-Code Technical Brief
> Created: 2026-07-07 00:35 KST
> Last Updated: 2026-07-10 16:01 KST

## 0. Governing Principle

JC-030은 JC-024가 제공하는 **신고 준비 데이터**를 근로소득 **간이지급명세서(근로소득)** 전산매체 규격의
**전자신고 파일 후보**로 변환하고, 제출 전 **형식·정합성 사전검증**을 보여준다.

- **자동 제출·자격증명 저장·홈택스 로그인 없음** (JC-023 원칙 유지).
- **self-filing 보조** — 사용자가 공식 비암호화 업로드 파일을 내려받아 홈택스에서 직접 업로드·검증·제출.
- 소득자 주민등록번호와 B8 원천징수의무자 주민/법인번호는 [PII Policy](./27_JC030_EFILING_FILE_PII_POLICY.md)에 따라 **일회성 입력·서버 미저장**.
- 생성 파일은 **v1 기본: 다운로드 후 서버 미보관**.
- 현재 슬라이스 2a의 고정길이 파일은 **비암호화 후보**이며, 홈택스가 직접
  수용한다는 공식 검증은 아직 없다. 이 검증 전에는 Path 1 완료가 아니다.
- UI·문구는 승인된 [09_payment_year_end.html](../02_UI_Screens/previews/09_payment_year_end.html) JC-030 패널을 따른다.
- 레이아웃·필드 정의는 [Field Mapping](./29_JC030_SIMPLIFIED_WAGE_EFILING_FIELD_MAPPING.md) · [Layout Acquisition](./28_JC030_SIMPLIFIED_WAGE_EFILING_LAYOUT_ACQUISITION.md).

## 1. Scope

포함한다 (v1).

1. `/dashboard/filing-preparation/payment-statements` 화면 내 **JC-030 파일 생성 패널** (Preview §4.11)
2. 반기·귀속연도 선택(기존 JC-024 context 재사용)
3. 데이터·규격·검증 상태 read model
4. 일회성 PII·제출 메타 입력 폼(Zod)
5. 다운로드 전 **양식 채움 확인** — 신고 양식·귀속기간·사업자·대상자·합계·일회성 식별정보 입력 상태
6. **Plain fixed-width A/B/C 레코드** 생성 + 결정론적 단위 테스트
7. 공식 비암호화 직접 업로드 수용 검증 — 통과 전에는 beta 완료로 표시하지 않음
8. 다운로드 API(일회성 스트림, 서버 미보관)
9. 사전검증 결과(오류/경고) UI

제외한다 (v1).

- 홈택스 적합성 검정 API 연동·`국세청 검증 완료` 표시
- plain 파일만으로 홈택스 제출 가능 파일이라고 보장하는 문구
- 연말 지급명세서(1175)·부가세·원천세·사업소득 간이지급(SF) 파일
- `employee_profile` 주민번호 컬럼·서버 측 PII 저장
- 자동 제출(JC-023)·세무대리인 제출(A5=1)
- fcrypt·암호화 전자파일·전자신고 암호·적합성 검정
- 인정상여·비과세 분리 입력( C15=0 고정 )

## 2. Route and Component Boundary

| 항목 | 결정 |
|:---|:---|
| Route | 기존 `/dashboard/filing-preparation/payment-statements` (JC-024) — 패널 확장 |
| 화면 성격 | read(집계) + **제한적 mutation**(파일 생성 요청·일회성 PII POST) |
| Read model | `lib/efiling-simplified-wage/summary.ts` (신규) — JC-024 summary 래핑 + 규격·검증 상태 |
| Generator | `lib/efiling-simplified-wage/build-records.ts` (순수 함수) |
| Crypto | N/A — fcrypt·암호화 파일은 현재 제품 범위 밖 |
| Persistence | **없음** (PII·생성 파일 서버 미저장) |
| API | `POST /api/filing-preparation/simplified-wage-efiling/generate` — Zod body, stream response |
| 진입 | 신고 준비 허브 → 지급명세서 검토 화면 → JC-030 패널 |

## 3. Data Sources

[Field Mapping §3](./29_JC030_SIMPLIFIED_WAGE_EFILING_FIELD_MAPPING.md)와 동일.

| 소스 | 용도 |
|:---|:---|
| `lib/payment-statements/summary.ts` | 반기 직원별 준비 상태·gross 합계·blocker |
| `payroll_employee_line` | 월별 gross·누락 월·재입사 분할 |
| `employee_profile` | 성명·입퇴사일 |
| billing / `client` | 사업자등록번호·상호·사업자 유형 |
| Request body (Zod) | 주민번호·B8 주민/법인번호·세무서코드·담당자 연락처; 암호 입력 없음 |

## 4. File Format Contract

### 4.1 레코드 구조

- 파일명: `SC{businessRegNo10}` (예: `SC1234567890`)
- 인코딩: **최신 HWP 확인 필요** — 구현 시 `scratch/jc-030-reference` 대비 홈택스 최신본; 초안은 **EUC-KR / CP949** 가정 [추정, NTS 관행]
- 레코드: 190 byte 고정 × (1 A + 1 B + N C)
- 숫자 필드: `9(n)` — 우측 정렬, 0 패딩
- 문자 필드: `X(n)` — 좌측 정렬, 공백 패딩
- 레코드 순서: A → B → C₁…Cₙ (HWP 수록순서)

### 4.2 홈택스 직접 수용 Gate

- 현재 고정길이 후보 파일이 암호화·별도 변환 없이 홈택스에서 직접 수용되는지
  공식 메뉴와 대표 fixture로 재검증한다.
- 직접 수용되지 않으면 이 세목을 Path 1 `done`으로 표시하지 않는다.
- fcrypt·NTS-CRYPTO·전자신고 암호를 대체 경로로 구현하지 않는다.

## 5. API Contract (Draft)

### `POST .../generate`

**Request (Zod):**

```typescript
z.object({
  year: z.number().int().min(2020).max(2100),
  half: z.union([z.literal(1), z.literal(2)]),
  taxOfficeCode: z.string().regex(/^\d{3}$/),
  contactDepartment: z.string().max(30).optional(),
  contactName: z.string().max(30),
  contactPhone: z.string().max(15),
  hometaxId: z.string().max(20).optional(),
  representativeId: z.string().regex(/^\d{13}$/), // B8 — 법인등록번호 또는 개인사업자 대표 주민번호, 일회성
  employeePii: z.record(
    z.string(), // employeeKey from JC-024
    z.object({ residentId: z.string().length(13) })
  ),
})
```

**Response:**

- `200` — `application/octet-stream` plain 레코드 후보; `Content-Disposition: attachment`
- `400` — Zod / 사전검증 실패 JSON `{ errors: ValidationIssue[] }`
- `403` — tenant 권한 없음

**Response body에 PII echo 금지.**

## 6. Validation and UI Copy

### 6.1 검증 규칙

[Field Mapping §7](./29_JC030_SIMPLIFIED_WAGE_EFILING_FIELD_MAPPING.md) V-01~V-11.

### 6.2 UI 문구 (Scope Gate §5.3)

| 허용 | 금지 |
|:---|:---|
| 비암호화 업로드 파일 후보 | 홈택스 제출 보장 |
| 공식 수용 검증 대기 | 암호화 파일 지원 |
| 업로드 전 사전검증 | 국세청 검증 완료 |
| 홈택스 업로드 전 확인 | 자동 신고 / 대리 제출 |

### 6.3 패널 5단계 (Preview 정합)

1. **대상·기간** — 근로소득 간이지급 · 반기/귀속연도
2. **데이터 상태** — JC-024 ready/확인필요 인원
3. **식별·제출 정보** — 일회성 PII·B8·세무서코드·담당자
4. **양식 채움 확인** — 파일에 들어갈 신고 양식·귀속기간·사업자·대상자·합계·일회성 식별정보 입력 상태를 다운로드 전에 확인
5. **검증·다운로드** — 사전검증 칩 · 비암호화 후보 파일 다운로드 · 홈택스 업로드 안내 링크

## 7. Implementation Slices

| 슬라이스 | 내용 | 착수 조건 |
|:---|:---|:---|
| **1a** | `build-records` 순수 함수 + V-01~V-11 테스트 | Brief 승인 — **구현 완료(2026-07-07)** `lib/efiling-simplified-wage/` |
| **1b** | 패널 UI + validation read model (다운로드 없이 검증만) | 1a — **구현 완료(2026-07-07)** `summary.ts` + `payment-statements` 패널 |
| **2a** | Generate API 비암호화 후보 파일 스트림 + PII 입력 폼 | 1a — **구현 완료(2026-07-07)** generate API·다운로드 |
| **2b** | 공식 비암호화 홈택스 직접 수용 검증 | **미완료** — 통과 전 Path 1 `done` 금지 |
| **3** | 홈택스 업로드 가이드 deep link · 운영 체크리스트 | **구현 완료(2026-07-07)** `hometax-guide.ts` + 패널 안내 |

## 8. Acceptance Criteria (Implementation)

- [ ] JC-024 `ready` 직원만 C레코드에 포함; 미준비는 검증 오류로 차단
- [ ] A/B/C 190 byte 레코드가 HWP 필드표와 일치(최신본 대조 테스트 fixture)
- [ ] 주민번호·생성 파일이 DB·로그에 남지 않음(감사·테스트)
- [ ] B8 주민/법인번호는 법인/개인 모두 요청 body에서 일회성 필수 입력이며 저장하지 않음
- [ ] 사용자가 다운로드 전 양식에 채워질 값(서식·기간·사업자·대상자·합계·일회성 식별정보 입력 상태)을 확인할 수 있음
- [ ] 대표 비암호화 파일이 홈택스 공식 업로드 경로에서 직접 수용됨
- [ ] UI에 Scope Gate 금지 문구 없음
- [ ] tenant 격리: 타 회사 데이터 혼입 불가

## 9. HWP Refresh Checklist (Operations)

제출 반기마다 담당자가 수행:

1. 홈택스 자료실에서 `간이지급명세서(근로소득) 전산매체 제출요령` + 정오표 다운로드
2. `scratch/jc-030-reference/` 갱신 · Field Mapping §2.2 변경 여부 기록
3. 단위 테스트 fixture 업데이트
4. Staging에서 홈택스 공식 업로드 **시험 검증**(사용자 수동) — 비암호화 파일 직접 수용 여부 확인

## 10. Related Documents

- [Field Mapping](./29_JC030_SIMPLIFIED_WAGE_EFILING_FIELD_MAPPING.md)
- [Layout Acquisition](./28_JC030_SIMPLIFIED_WAGE_EFILING_LAYOUT_ACQUISITION.md)
- [PII Policy](./27_JC030_EFILING_FILE_PII_POLICY.md)
- [Scope Gate](./19_EFILING_FILE_GENERATION_SCOPE_GATE.md)
- [Payment Statement Brief](./16_PAYMENT_STATEMENT_YEAR_END_PRE_CODE_BRIEF.md)
- [Completion Contract §3 / JC-030](./22_OPEN_BACKLOG_COMPLETION_CONTRACTS.md)
- [Archived NTS Crypto Research](./31_JC030_NTS_CRYPTO_SPEC_ACQUISITION.md) — 현재 제품 범위 밖
- [Backlog JC-030](../04_Logic_Progress/00_BACKLOG.md)
