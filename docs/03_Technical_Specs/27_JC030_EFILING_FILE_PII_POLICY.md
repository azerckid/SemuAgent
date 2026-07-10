# JC-030 Slice 0b E-Filing File PII Policy
> Created: 2026-07-06 23:05 KST
> Last Updated: 2026-07-10 16:01 KST

## 0. Flow Status

```text
[Flow]
현재: JC-030 PII 정책 유지 — 식별정보 일회성 입력·서버 미저장
Gate: 세목별 공식 비암호화 업로드 양식이 식별정보를 요구할 때 동일 정책 적용
완료: Scope Gate §5.2 PII, 간이지급 Field Mapping·Pre-Code Brief·구현
다음: 새 세목 W0 통과 후 공식 양식의 PII 필드를 확인하고 매핑
제외: 적합성 검정·fcrypt·암호화 파일은 현재 제품 범위 밖
```

## 1. Purpose

JC-030 v1 1순위 후보는 **근로소득 간이지급명세서** 전자신고 파일 생성이다. 국세청 전산매체/파일변환신고 규격상 소득자 식별정보(주로 주민등록번호 또는 외국인등록번호)가 필요할 가능성이 높다.

SemuAgent는 JC-015(직원 명부)·JC-024(지급명세서 검토)에서 **주민등록번호 원문을 DB에 저장하지 않는** 최소 PII 원칙을 이미 채택했다. JC-030은 이 원칙을 깨지 않으면서 파일 생성만 허용하는 경계를 고정한다.

## 2. Decision Summary

| 항목 | 결정 |
|---|---|
| 채택안 | **Scope Gate §5.2 옵션 1 — 서버 미저장 일회성 입력** |
| 거부 | 옵션 2(암호화 DB 저장) — 별도 법무·보안·감사 설계 없이는 도입하지 않음 |
| 거부 | 옵션 3(부가세 등 비직원 PII 세목 선회) — v1 1순위 후보는 간이지급명세서 유지 |
| `employee_profile` | **변경 없음** — 주민등록번호·외국인등록번호 컬럼 추가 금지 |
| 생성 파일 서버 보관 | **v1 기본: 미보관** — 사용자 다운로드 후 서버에 바이트·storage key 저장하지 않음 |

## 3. Policy Detail — Server Non-Storage One-Time Input

### 3.1 사용자 흐름

1. JC-024에서 반기 집계·검토가 완료된 직원 목록을 표시한다.
2. 파일 생성 직전 **소득자 식별정보 입력** 단계를 둔다(직원별 또는 일괄 paste — UI는 Pre-Code Brief에서 확정).
3. 사용자가 입력한 식별정보는 **해당 HTTP 요청 처리 동안 메모리에서만** 사용해 전자신고 record를 조립한다.
4. 응답은 **파일 다운로드**(또는 스트리밍)로 제공한다. 처리 종료 후 식별정보는 **폐기**한다.

### 3.2 금지 사항 (구현·운영 공통)

- `employee_profile`·기타 영구 테이블에 주민등록번호/외국인등록번호 **INSERT/UPDATE 금지**
- 감사 로그·애플리케이션 로그·에러 리포트에 식별정보 **평문 기록 금지**
- 생성된 전자신고 파일을 Vercel Blob 등 **서버 스토리지에 기본 저장 금지**(사용자 명시 재업로드·접수증 보관 패턴은 JC-013 filing receipt와 별개)
- 세션 쿠키·localStorage·IndexedDB에 식별정보 **캐시 금지**(브라우저 자동완성에 의존하지 않음)

### 3.3 허용 사항

- 요청 본문에 Zod로 검증된 식별정보를 **일회성**으로 수신
- 메모리 내에서만 JC-024 집계 데이터(`employeeCode`, 금액 등)와 조합
- 다운로드되는 파일 바이트에 규격이 요구하는 식별정보 **포함**(국세청 제출용 — 사용자 로컬 보관 책임)
- 입력 누락·형식 오류를 **검증 결과**로 표시(식별정보 값 자체는 로그에 남기지 않음)

### 3.4 JC-015 / JC-024와의 정합

| 기존 문서 | JC-030과의 관계 |
|---|---|
| [Employee Directory Brief §0](./10_EMPLOYEE_DIRECTORY_PRE_CODE_BRIEF.md) | 명부에 주민번호 컬럼 없음 — **유지** |
| [Payment Statement Brief §6](./16_PAYMENT_STATEMENT_YEAR_END_PRE_CODE_BRIEF.md) | 검토 화면은 주민번호 검증 안 함 — **유지**. 파일 생성은 **별도 1회 입력** 단계 |
| JC-024 인적사항 누락 | `hireDate`·명부 매칭·재직상태만 — 주민번호 누락 칩은 **파일 생성 단계**에서만 "식별정보 입력 필요"로 표시 |

## 4. UI · 책임 경계 (초안)

- 화면 문구: `소득자 식별정보는 파일 생성에만 사용되며 서버에 저장되지 않습니다.`
- 금지 문구: `국세청 검증 완료`, `제출 보장`, `자동 신고`, `대리 제출` ([Scope Gate §5.3](./19_EFILING_FILE_GENERATION_SCOPE_GATE.md) 동일)
- CTA: `식별정보 입력` → `검증 결과 보기` → `파일 다운로드` → `홈택스 업로드 안내`

## 5. Rejected Alternatives (근거)

### 5.1 암호화 저장 (옵션 2)

- 장점: 재생성·재다운로드 편의
- 거부 이유: 키 관리·접근 통제·삭제/정정·법무 동의·침해사고 대응이 필요. SemuAgent v1 최소 PII 원칙과 충돌. **별도 보안 brief·법무 승인 없이는 재검토하지 않는다.**

### 5.2 부가세 선회 (옵션 3)

- 장점: 직원 PII 회피
- 거부 이유: JC-024 데이터 live·공식 제출주기 확인 완료로 v1 1순위 후보가 간이지급명세서로 이미 고정([Scope Gate §4](./19_EFILING_FILE_GENERATION_SCOPE_GATE.md)). 부가세 상세 layout 입수도 [미확인].

## 6. Implementation Preconditions Closed (0b)

- [x] 직원 식별정보 처리 방식 확정 — **서버 미저장 일회성 입력**
- [x] 간이지급(근로) 전자신고 레이아웃 **공식 입수 경로** 확정 — [Layout Acquisition](./28_JC030_SIMPLIFIED_WAGE_EFILING_LAYOUT_ACQUISITION.md)
- [x] 간이지급 세목 필드 레이아웃·확정 데이터 매핑·정합성 규칙 구현
- [ ] 후속 세목 공식 비암호화 양식의 PII 필드 확인 — 해당 세목 W0 통과 후
- [x] 파일변환신고 적합성 검정·암호화 경로는 현재 제품 범위 밖으로 결정

## 7. Related Documents

- [E-Filing File Generation Scope Gate](./19_EFILING_FILE_GENERATION_SCOPE_GATE.md)
- [JC-023 Hometax Auto-submit Research](./13_JC023_HOMETAX_AUTOSUBMIT_RESEARCH.md)
- [Payment Statement Pre-Code Brief](./16_PAYMENT_STATEMENT_YEAR_END_PRE_CODE_BRIEF.md)
- [Employee Directory Pre-Code Brief](./10_EMPLOYEE_DIRECTORY_PRE_CODE_BRIEF.md)
- [Open Backlog Completion Contracts §3 / JC-030](./22_OPEN_BACKLOG_COMPLETION_CONTRACTS.md)
- [Backlog JC-030](../04_Logic_Progress/00_BACKLOG.md)
