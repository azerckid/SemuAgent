# Payroll Employee Reminder Pre-Code Technical Brief
> Created: 2026-07-05 03:10
> Last Updated: 2026-07-05 03:10

## 0. Governing Principle

JC-018은 JC-016 내부 리마인드의 `recipient_source`(`staff`/`employee_directory`/`mixed`) 배관을 **payroll 도메인에 한해** 실제로 연결한다. 스키마·타입은 JC-016 때 이미 대비돼 있었으나(`internal_reminder_rule.recipientSource`, `internal_reminder_send_log.recipientType` enum에 `employee` 포함), `persistInternalReminderRule`이 항상 `'staff'`로 하드코딩해 실제로는 쓰인 적이 없었다.

- **대상 도메인은 payroll 하나뿐이다.** 다른 도메인(자료수집·기장·부가세·신고지원)은 이번 범위에서 동작 변경이 없다.
- **mixed = staff(전체) + 확인 필요 직원만(전체 직원 아님).** "그 시점 급여 확인 필요(needs_review)인 직원"만 대상이다. 급여가 정상 처리된 직원에게는 보내지 않는다.
- **직원 이메일에는 금액·세액 등 민감정보를 절대 포함하지 않는다.** staff가 받는 상세 요약과 완전히 다른, 일반 문구의 별도 템플릿을 쓴다.
- **recipient_source 규칙별 사용자 설정 UI는 후속이다.** v1은 payroll 도메인에 `mixed`를 코드로 고정하고, 사용자가 화면에서 바꿀 수 없다.
- 직원 명부 미매칭·이메일 없음·알림 꺼짐이면 **그 직원만 제외**한다 — staff 발송에는 영향이 없고, 전체가 staff-only로 폴백하는 것도 아니다.

## 1. Scope

포함한다.

1. `employee_profile`에서 급여 확인 필요 직원의 이메일 후보를 조회하는 로더
2. payroll 도메인 발송 시, staff(기존) + 확인 필요 직원(신규)에게 각각 다른 콘텐츠로 발송
3. 직원용 일반 문구 이메일 컴포저(민감정보 미포함)
4. 발송 로그 `recipientType: 'employee'` 기록, 기존 멱등성 패턴 재사용
5. 단위 테스트(직원 매칭·제외 조건·이메일 콘텐츠 안전성)

제외한다(후속).

- `recipient_source` 규칙별 사용자 설정 UI
- payroll 외 도메인의 직원 수신 확장
- 직원 본인 급여 상세 조회 화면(이 기능은 알림만, 조회는 범위 밖)

## 2. Data Contract — 확인 필요 직원 조회

`payrollEmployeeLine`에서 현재 급여 기간(`payrollPeriodSummary`, 최신 또는 지정 기간)의 `status === 'needs_review'` 라인을 조회하고, `employeeCode`로 `employee_profile`과 매칭한다.

```ts
type PayrollAttentionEmployee = {
  employeeCode: string
  employeeName: string
  workEmail: string
  issueLabel: string | null // staff 참고용, 직원 이메일 본문에는 사용하지 않음
}

async function loadPayrollAttentionEmployees(params: {
  tenantId: string
  clientId: string
  periodKey?: string | null
}): Promise<PayrollAttentionEmployee[]>
```

**매칭 규칙:**
- `payrollEmployeeLine.employeeCode`가 없으면(null) 매칭하지 않고 제외한다(직원 본인에게 안전하게 도달할 확실한 링크가 없으면 보내지 않는다 — false positive보다 누락이 안전).
- `employee_profile.employeeCode`로 매칭. 매칭 실패 → 제외.
- `employee_profile.workEmail`이 없거나 공백 → 제외.
- `employee_profile.notificationEnabled === false` → 제외.
- `employee_profile.employeeStatus === 'terminated'` → 제외(퇴사자에게 급여 확인 요청 발송 안 함).

이 로더는 이름 기반 fallback(JC-024 `resolveEmployeeGroupKey`)을 **쓰지 않는다** — 개인 이메일 발송이라 코드 불일치 시 잘못된 사람에게 보낼 위험을 피하기 위해 정확한 코드 매칭만 허용한다.

## 3. Email Content — Staff vs Employee (분리)

| 수신자 | 콘텐츠 소스 | 포함 정보 |
|:---|:---|:---|
| staff | `composeInternalReminderEmail`(기존, 변경 없음) | 확인 필요 건수, 도메인 라벨 등 요약(기존과 동일) |
| 직원 | **신규** `composeEmployeePayrollReminderEmail` | 이름 + 일반 문구만. **금액·세액·issueLabel 등 급여 세부 내용 미포함** |

**직원용 이메일 (고정 템플릿 — 허용 변수는 `recipientName`과 `[테스트] ` 접두뿐, 급여 금액·세액·issueLabel 등 민감 변수 보간 금지):**
```
제목: 급여 정보 확인 요청
본문:
{recipientName}님,

확인이 필요한 급여·인적사항이 있습니다. 담당자에게 문의하시거나
급여 화면에서 직접 확인해 주세요.

이 메일은 세무 에이전트 내부 업무 리마인드입니다.
급여 금액이나 세부 내역은 포함하지 않습니다.
```
- `mode`(test/manual/cron)에 따라 `[테스트] ` 접두만 기존과 동일하게 적용.
- 절대 `grossPayKrw`·`withholdingTaxKrw`·`issueLabel`·계좌/주민번호 등을 본문에 넣지 않는다(코드 리뷰 시 확인 포인트).

## 4. Send Flow — sendInternalReminderRule 확장

`sendInternalReminderRule`은 domain이 `payroll`이고 매칭된 확인 필요 직원이 있을 때만 추가 루프를 돈다. 기존 staff 루프는 **완전히 그대로** 유지한다(회귀 없음).

```
if (rule.domain === 'payroll') {
  const attentionEmployees = await loadPayrollAttentionEmployees({ tenantId, clientId, periodKey })
  for (const employee of attentionEmployees) {
    // idempotencyKey: 기존 buildInternalReminderIdempotencyKey 재사용
    //   recipientId = employeeCode 기반 키로 staff recipientId와 네임스페이스 충돌 없게 구성
    // recipientType: 'employee' 로 send log 기록
    // 발송 실패는 개별 직원 단위로 격리(한 명 실패가 다른 발송을 막지 않음)
  }
}
```

- 직원 발송은 staff 발송과 **별도 루프**로, 서로의 성공/실패에 영향을 주지 않는다.
- `writeSendLog`의 `recipientType`을 매개변수화한다(현재 하드코딩된 `'staff'` → 호출부에서 `'staff' | 'employee'` 전달).
- 멱등성: `buildInternalReminderIdempotencyKey`의 `recipientId`에 직원 식별자(예: `employee:{employeeCode}`)를 써서 staff recipientId와 충돌하지 않게 한다.

## 5. Acceptance Criteria (백로그 JC-018과 일치)

- [ ] payroll 리마인드 발송 시 staff는 기존과 동일한 전체 요약을 받는다(회귀 없음).
- [ ] 해당 시점 급여 확인 필요(needs_review) 직원만 추가로 이메일을 받는다.
- [ ] 직원 이메일 본문에 금액·세액·issueLabel 등 민감정보가 포함되지 않는다.
- [ ] employeeCode 매칭 실패·이메일 없음·알림 꺼짐·퇴사자는 제외되고, staff 발송에는 영향 없다.
- [ ] payroll 외 도메인은 동작 변경이 없다.
- [ ] 발송 로그에 `recipientType: 'employee'`가 정확히 기록된다.
- [ ] 직원 발송 실패가 staff 발송이나 다른 직원 발송을 막지 않는다(격리).
- [ ] 직원 매칭·이메일 콘텐츠 안전성(민감정보 미포함)이 순수 함수로 단위 테스트된다.

## 6. Component & Library Plan

- 신규 UI 없음(백엔드 발송 로직 변경). shadcn/library 변경 없음.

## 7. Related Documents
- **Concept_Design**: [Product Baseline](../01_Concept_Design/01_PRODUCT_BASELINE.md) - 개인정보 최소 수집·회사 self-use 경계
- **Technical_Specs**: [Internal Reminder Mail Pre-Code Brief](./11_INTERNAL_REMINDER_MAIL_PRE_CODE_BRIEF.md) - JC-016 발송·규칙·멱등성 선행 계약 · [Internal Reminder Cron Pre-Code Brief](./14_INTERNAL_REMINDER_CRON_PRE_CODE_BRIEF.md) - cron send mode 패턴 · [Payroll Pre-Code Brief](./08_PAYROLL_PRE_CODE_BRIEF.md) - needs_review 라인 정의
- **Logic_Progress**: [Backlog](../04_Logic_Progress/00_BACKLOG.md) - JC-018 Context Lock
