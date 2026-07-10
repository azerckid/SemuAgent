# JC-030 Slice 1b W0 — 원천세 공식 비암호화 업로드 양식 확인
> Created: 2026-07-07 04:25 KST
> Last Updated: 2026-07-10 16:01 KST

## 0. Flow Status

```text
[Flow]
현재: 원천세 Slice 1b-W0 — 공식 비암호화 업로드 양식·홈택스 수용 경로 확인
판정: blocked — 공식 신고서 HWP/PDF는 확인했으나 직접 업로드 가능한 비암호화 양식은 미확인
완료: 별지 제21호·NTS 작성요령·A01 매핑·검증 패널·공개 홈택스 메뉴 감사
다음: 로그인 후 원천세 일반신고 내부 업로드 기능 확인 또는 국세청 126 공식 답변 확보
분기: 비암호화 업로드 양식 확인 시 W1 진행 / 없으면 원천세 W2 구현 없이 다음 세목 Stage A로 이동
제외: 바이너리 레코드 추정, fcrypt·암호화 파일, 직접입력 안내, 자동제출
```

라벨 — **[확인]** 공식 공개 페이지·현재 메뉴에서 직접 확인 · **[미확인]** 로그인 이후 화면 또는 공식 답변 필요 · **[범위 밖]** 암호화·인증·자동제출

## 1. Purpose

Path 1은 홈택스·국세청이 제공하고 홈택스가 직접 수용하는 **공식 비암호화
업로드 양식**에 SemuAgent가 값을 채워 파일을 만들고, 사용자가 홈택스에서 직접
업로드·제출하도록 돕는 경로다.

이 문서는 원천징수이행상황신고서에 대해 다음 두 사실을 별도로 검증한다.

1. 신고 내용을 작성할 공식 서식이 존재하는가.
2. 그 서식 또는 별도 파일이 **비암호화 상태로 홈택스에 직접 업로드 가능한가.**

1번만 확인되고 2번이 확인되지 않으면 W0는 완료가 아니다. HWP/PDF가 단지 인쇄·서면
제출용이면 Path 1 업로드 양식으로 사용하지 않는다.

## 2. Product Decision — 2026-07-10

| 항목 | 결정 |
|:---|:---|
| Path 1 산출물 | 공식 비암호화 업로드 양식에 값을 채운 파일 |
| 사용자 역할 | SemuAgent에서 값 확인·다운로드 후 홈택스에 직접 업로드·제출 |
| 직접입력 | 제외 |
| fcrypt·암호화 파일 | 제외 |
| 바이너리 레코드 추정 | 금지 |
| 공식 업로드 양식이 없는 세목 | `blocked`; 암호화 경로로 우회하지 않고 다음 세목 조사로 이동 |

따라서 과거 문서의 `공식 바이너리 레이아웃 입수`는 더 이상 W0 완료선이 아니다.
원천세 변환프로그램·NTS-CRYPTO 조사는 Path 1 구현 입력으로 사용하지 않는다.

## 3. Official Evidence Audit

### 3.1 확인된 공식 서식

| 자료 | 공식 경로 | 확인 결과 | Path 1 판정 |
|:---|:---|:---|:---|
| 원천징수이행상황신고서 | https://s.nts.go.kr/nts/na/ntt/selectNttList.do?bbsId=30012&mi=135800 | 국세청 주요서식에 제21호 서식이 게시됨. 2026년 개정 예정 표시가 있어 제출 시점 최신본 재확인 필요 | 작성 필드 근거만 충족. 업로드 수용 근거 아님 |
| 2017 원천징수이행상황신고서 작성요령 | https://s.nts.go.kr/nts/na/ntt/selectNttInfo.do?mi=135773&nttSn=74816 | A01 등 서식 작성 규칙 참고 가능 | 작성 규칙 근거만 충족 |
| 홈택스 공개 메뉴 | https://www.hometax.go.kr/websquare/websquare.html?w2xPath=/ui/pp/index_pp.xml | 2026-07-10 공개 메뉴에서 `원천세 신고 > 일반신고`(menu `4106010000`, screen `UTERNAA0E001`) 확인 | 로그인 이후 내부 기능 확인 필요 |

### 3.2 공개 메뉴에서 구분한 오탐

현재 홈택스 공개 메뉴의 `변환파일 제출`(menu `4401110000`, screen
`UWEICAAD15`)은 `지급명세·자료·공익법인 > 일용·간이지급명세` 영역이다.
원천세 신고용 비암호화 업로드 메뉴의 근거로 재사용하지 않는다.

### 3.3 2026-07-10 W0 조사 결론

- 국세청의 원천징수이행상황신고서와 작성요령은 확인했다.
- 공식 공개 검색에서 원천세 전용 Excel·CSV·HWP **업로드 템플릿**은 찾지 못했다.
- 공개 홈택스 메뉴는 원천세 `일반신고`까지만 확인되며, 비암호화 파일을 직접
  수용하는 별도 메뉴는 확인되지 않았다.
- 로그인 이후 일반신고 화면 안에 비암호화 업로드 기능이 있는지는 미확인이다.
- 따라서 W0는 **blocked**이며 W1·W2 generator를 시작하지 않는다.

이 결론은 `비암호화 업로드가 절대 없다`는 단정이 아니다. 공개 경로만으로는
존재와 수용 형식을 입증하지 못했다는 뜻이다.

## 4. W0 Completion Evidence

W0는 아래 다섯 가지가 모두 확인되어야 완료다.

- [ ] 국세청·홈택스가 제공한 비암호화 업로드 원본 파일을 확보했다.
- [ ] 파일 형식(예: XLSX·CSV·HWP)과 버전·적용일을 기록했다.
- [ ] 홈택스에서 그 파일을 선택하는 정확한 메뉴와 버튼을 확인했다.
- [ ] 수정하지 않은 공식 샘플 또는 최소 fixture가 업로드 단계에서 수용됨을 확인했다.
- [ ] 암호·fcrypt·인증 프로그램 없이 사용자가 직접 업로드할 수 있음을 확인했다.

서식 HWP/PDF만 확보하거나 작성 화면이 존재하는 것만으로는 통과하지 않는다.

## 5. Next Acquisition Actions

### 5.1 홈택스 로그인 후 확인

1. 홈택스 로그인.
2. `세금신고 > 원천세 신고 > 일반신고` 진입.
3. `파일 업로드`, `엑셀 업로드`, `양식 다운로드`와 같은 비암호화 경로가 있는지 확인.
4. 있다면 원본 양식, 도움말, 적용일, 허용 확장자, 최대 크기를 보관.
5. 암호화 전자파일·회계프로그램 변환제출만 제공되면 Path 1 부적합으로 기록.

### 5.2 국세청 공식 문의

공개 화면에서 판단할 수 없으면 국세상담센터 **126**에 다음 질문을 그대로 확인한다.

> 원천징수이행상황신고서를 홈택스에 신고할 때, 회계프로그램의 암호화 전자파일이
> 아닌 국세청 공식 Excel·CSV·HWP 양식을 작성해 직접 업로드할 수 있습니까?
> 가능하다면 최신 양식 다운로드 위치와 홈택스 업로드 메뉴를 알려주십시오.

답변 일자, 상담 경로, 담당 부서, 안내 URL을 본 문서에 기록한 뒤 W0를 재판정한다.

## 6. Data Mapping If W0 Passes

W0가 통과하면 [Field Mapping](./38_JC030_WITHHOLDING_EFILING_FIELD_MAPPING.md)의
Part A를 공식 양식 위치에 연결한다.

| SemuAgent 소스 | 양식 대상 |
|:---|:---|
| `payroll_period_summary.employeeCount` | A01 인원 |
| `payroll_period_summary.grossPayKrw` | A01 총지급액 |
| 확정 `payroll_employee_line.incomeTaxKrw` 합계 | A01 소득세 등 |
| `payroll_period_summary.closeStatus` | 생성 blocker |
| `needs_review` 급여 라인 | 생성 blocker |
| 사업장·귀속월 | 신고 기본사항 |

양식 위치·시트명·셀·열은 W0에서 확보한 공식 파일에만 근거해 W1에서 확정한다.

## 7. Implementation Gate

| 단계 | 게이트 |
|:---|:---|
| W0 | 공식 비암호화 업로드 양식과 홈택스 직접 수용 경로 확인 |
| W1 | 공식 양식 위치에 A01 필드를 매핑하고 Brief 최종 승인 |
| W2 | W0·W1 완료 후에만 generator 구현 |
| Blocked branch | W0 실패 시 원천세 generator 미구현, 다음 세목 Stage A 조사 |
| UI 문구 | `국세청 검증 완료`, 직접입력, 암호화 업로드 안내 금지 |

## 8. Related Documents

- [Path 1 Form Fill Roadmap](./36_PATH1_FORM_FILL_ROADMAP.md)
- [E-Filing File Generation Scope Gate](./19_EFILING_FILE_GENERATION_SCOPE_GATE.md)
- [Withholding Field Mapping](./38_JC030_WITHHOLDING_EFILING_FIELD_MAPPING.md)
- [Withholding Pre-Code Brief](./39_JC030_WITHHOLDING_EFILING_PRE_CODE_BRIEF.md)
- [Path 1 E2E Readiness Audit](./40_PATH1_END_TO_END_FILING_READINESS_AUDIT.md)
- [Logic_Progress / JC-030](../04_Logic_Progress/00_BACKLOG.md)
