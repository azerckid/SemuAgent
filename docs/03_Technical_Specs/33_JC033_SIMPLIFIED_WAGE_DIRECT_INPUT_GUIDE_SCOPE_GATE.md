# JC-033 — 간이지급명세서 홈택스 직접입력 가이드 Scope Gate
> Created: 2026-07-07 03:00 KST
> Last Updated: 2026-07-07 03:00 KST

## 0. Flow Status

```text
[Flow]
현재: Scope Gate 초안 — 홈택스 직접입력 메뉴 경로 확인, 화면별 입력 필드 미확인
Gate: 미통과
완료: 문제 정의(파일변환신고 경로가 암호화·적합성 검정으로 막혀 있어 대안 경로 필요), 직접입력 메뉴 진입 경로 확인
다음: 홈택스 직접입력 화면 필드 상세 조사 → UI-First Gate → Pre-Code Brief
필요 확인: 화면별 입력 필드·순서, JC-024 데이터로 몇 % 자동 채움 가능한지
```

라벨 — **[확실]** 공식 검색 결과 확인 · **[추정]** 정황 · **[미확인]** 실제 화면 미확인(로그인 필요 구간)

## 1. Purpose

JC-030(파일변환신고용 파일 생성)은 **암호화 필수**([NTS Crypto Spec §4.1](./31_JC030_NTS_CRYPTO_SPEC_ACQUISITION.md))와
**적합성 검정 미확정**([SW Conformance Certification Research](./32_JC030_SW_CONFORMANCE_CERTIFICATION_RESEARCH.md))
때문에, 지금 시점에는 **plain 파일을 사용자가 직접 업로드해도 제출까지 이어지지 않을 가능성**이 있다.

JC-013(신고지원)은 부가세·원천세·보험만 다루고 **간이지급명세서 직접입력 가이드는 없다.** JC-033은 이 공백을
메운다 — 파일 없이, 홈택스 화면에 **직접 타이핑**하는 경로를 SemuAgent가 안내한다.

**핵심 가치**: 파일 업로드가 막혀 있어도 사용자는 이 경로로 **지금 바로 신고를 완료**할 수 있다.

## 2. Official Menu Path (Confirmed 2026-07-07, 웹 검색)

홈택스 로그인 → **지급명세·자료·공익법인** → **(일용·간이·용역)직접작성 제출** [확실]

확인된 단계 개요 [확실, 웹 검색 요약 — 로그인 필요 구간이라 실제 화면 미확인]:

1. 소득자료 종류 선택 (간이지급명세서 선택 또는 대화형 안내 화면 이용)
2. 소득자 인적사항·소득내역 입력 → 지급액 입력 시 필요경비·소득금액 자동 계산
3. 소득세·지방소득세액 확인·입력
4. [등록하기] → 전 소득자 반복 → [제출하러 가기] → **[제출하기]** 클릭해야 최종 제출 완료
5. 접수증 인쇄 가능, [과세자료 미리보기]에서 원장 서식 확인 가능

공식 상세 안내: 국세청 게시판 `간이지급명세서 제출방법(자세히)` (bbsId=50714) [확실 — 문서 존재 확인, 세부 내용 미열람]

## 3. Data Mapping Candidate (JC-024 → 직접입력 필드)

| 홈택스 직접입력 필드(추정) | SemuAgent 소스 | 확실성 |
|---|---|---|
| 소득자 성명 | `employee_profile.displayName` | [확실 — 필드 존재] |
| 소득자 주민등록번호 | 없음 — 사용자가 홈택스 화면에서 직접 입력 | PII, DB 미보유 (JC-030과 동일 원칙) |
| 지급액(총급여) | `payment-statements` 반기 집계 `grossPayKrw` | [확실 — JC-024 데이터] |
| 소득세·지방소득세 | 홈택스가 지급액 기준 자동 계산 (추정) | [미확인 — 자동계산 여부·수식] |
| 귀속연도·반기 | `ReportingContext` | [확실] |

**SemuAgent 역할**: 데이터 입력이 아니라 **"이 값을 이 순서로 입력하세요"라는 가이드**를 제공한다.
JC-013의 기존 "홈택스 입력 가이드" UI 패턴을 그대로 재사용할 수 있다(신규 화면 설계 최소화).

## 4. Non-Goals (v1)

- 홈택스 화면에 **자동 입력**(브라우저 자동화·매크로) — 자동 제출 금지 원칙과 동일하게 **수동 타이핑 가이드까지만**
- 파일 생성·업로드 — JC-030 범위, 본 항목과 무관하게 그대로 유지
- 화면별 정확한 필드명·순서·계산식 확정 — 로그인 후 실제 화면 확인 또는 국세청 공식 매뉴얼 필요

## 5. UI-First Gate 대상

기존 [Filing Support](./09_FILING_SUPPORT_PRE_CODE_BRIEF.md)의 "홈택스 입력 가이드" 패턴을 참고해 신규
독립 화면보다 **지급명세서 검토 화면(payment-statements)에 가이드 패널 추가**를 우선 검토한다
(JC-030 패널과 나란히 배치 가능 — "파일변환신고" vs "직접입력" 두 경로 병기).

## 6. Precode Preconditions

- [ ] 홈택스 직접입력 화면의 정확한 필드명·순서·필수/선택 여부 확인(실사용자 로그인 확인 또는 국세청 매뉴얼)
- [ ] 소득세·지방소득세 자동계산 여부 확인 — SemuAgent가 미리 계산해서 보여줄지, 홈택스가 계산한 값을 안내만 할지
- [ ] UI Preview(HTML) 작성 — payment-statements 화면에 가이드 패널 목업
- [ ] PII 원칙 재확인 — 주민번호는 여전히 SemuAgent가 저장하지 않고, 홈택스 화면에서 사용자가 직접 입력([PII Policy](./27_JC030_EFILING_FILE_PII_POLICY.md) 동일 원칙 적용)

## 7. Related Documents

- [SW Conformance Certification Research](./32_JC030_SW_CONFORMANCE_CERTIFICATION_RESEARCH.md) — 파일변환신고 경로가 막힌 이유
- [NTS Crypto Spec Acquisition](./31_JC030_NTS_CRYPTO_SPEC_ACQUISITION.md) — plain 파일 제출 불가 근거(§4.1)
- [Payment Statement Pre-Code Brief](./16_PAYMENT_STATEMENT_YEAR_END_PRE_CODE_BRIEF.md) — JC-024 데이터 소스
- [Filing Support Pre-Code Brief](./09_FILING_SUPPORT_PRE_CODE_BRIEF.md) — 기존 "홈택스 입력 가이드" UI 패턴
- [PII Policy](./27_JC030_EFILING_FILE_PII_POLICY.md)
- [Backlog JC-033](../04_Logic_Progress/00_BACKLOG.md)
