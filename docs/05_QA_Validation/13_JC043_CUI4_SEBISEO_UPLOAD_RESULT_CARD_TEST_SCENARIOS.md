# JC-043 CUI-4 · 세비서 업로드 결과 카드 QA 시나리오
> Created: 2026-07-17 19:15
> Last Updated: 2026-07-17 19:55
> Backlog: JC-043 · CUI-4
> Status: **Brief 승인됨(PR #272)** — CUI-4a runtime 구현 후 실행
> Related Brief: [63_JC043_CUI4_SEBISEO_UPLOAD_RESULT_CARD_PRE_CODE_BRIEF](../03_Technical_Specs/63_JC043_CUI4_SEBISEO_UPLOAD_RESULT_CARD_PRE_CODE_BRIEF.md)
> Related Preview: [19_sebiseo.html](../02_UI_Screens/previews/19_sebiseo.html)
> Related Prior QA: [12_JC043_CUI3_SEBISEO_TEST_SCENARIOS](./12_JC043_CUI3_SEBISEO_TEST_SCENARIOS.md)

## 1. Scope

CUI-4 runtime 검증 대상:

- 세비서 최근 업로드 결과 카드(read-only 집계)
- CTA `period + sessionId` deep link
- 자료수집 **가져오기 상태 표** 세션 필터(§4.3)
- mutation·AI 재실행·확정 없음

Out of scope: 기장검토 거래 건수 카드, CUI-5 확정, 법령 참고 intent.

## 2. Preconditions

- tenant A에 활성 사업장 1건
- CUI-3 업로드 경로(`staff_direct`) 사용 가능
- 테스트 fixture 또는 staging DB에서 **같은 period에 서로 다른 session 2건**을 만들 수 있음

## 3. Scenarios

| ID | 시나리오 | 단계 | 기대 결과 | 상태 |
|:---|:---|:---|:---|:---|
| R-01 | 카드 미표시 | 세션 없는 tenant로 `/dashboard/sebiseo` 진입 | 결과 카드 없음. LLM 미호출 | Pending |
| R-02 | 카드 집계 | session 1건·파일 2건(`matched` 1, `needs_review` 1) | 카드 meta `정상 1건 · 확인 필요 1건`. 배지 `확인 필요 1` | Pending |
| R-03 | CTA href | R-02 카드 CTA 확인 | `/dashboard/direct-upload?period={key}&sessionId={id}` 형태 | Pending |
| R-04 | **같은 기간 다른 세션 혼입 없음** | (1) period P에 session S1(파일 A), S2(파일 B) 업로드. **fixture: `S1.createdAt > S2.createdAt`** 로 S1이 최근 세션 1건으로 선택되게 고정 (2) 카드가 S1을 표시하는지 확인 후 CTA 클릭 (3) 가져오기 상태 표 행 확인 | 카드 sessionId = S1. 표에 **S1 소속 파일만** 표시. S2 파일 B **미표시**. 행 수 = 카드 `totalCount` | Pending |
| R-05 | 카드·표 status 정합 | R-04 landing 후 각 행 status | `needs_review`/`matched` 건수가 카드 버킷과 일치 | Pending |
| R-06 | tenant 격리 | tenant B `sessionId`를 tenant A CTA에 수동 주입 | redirect로 `sessionId` strip. tenant B 파일 **0건** 노출 | Pending |
| R-07 | 사업장 격리 | 다른 `clientId` sessionId 주입 | §4.3.3 redirect. 타 사업장 파일 0건 | Pending |
| R-08 | period 불일치 | session의 `accountingPeriod`와 다른 `period` query + valid sessionId | redirect · sessionId strip | Pending |
| R-09 | 무효 sessionId | 존재하지 않는 UUID. **추가:** 무효 `sessionId` + `fileId` query 동시 전달 | `/dashboard/direct-upload?period=…` (sessionId·fileId strip). 기간 전체 importRows로 머물지 않음 | Pending |
| R-10 | sessionId 없는 진입 | `/dashboard/direct-upload?period=P` only | 기간 전체 importRows(기존 동작). 회귀 통과 | Pending |
| R-11 | 업로드 후 갱신 | 세비서에서 새 업로드 | system 링크 대신 카드 갱신. 새 sessionId 반영 | Pending |
| R-12 | mutation 없음 | 카드·CTA·표에서 확정/재분석 버튼 없음(기존 retry만 file 행 scope) | 채팅·카드에서 domain mutation 0 | Pending |

## 4. Regression

- [ ] [03_SOURCE_COLLECTION_TEST_SCENARIOS](./03_SOURCE_COLLECTION_TEST_SCENARIOS.md) S-60~S-64
- [ ] [12_JC043_CUI3](./12_JC043_CUI3_SEBISEO_TEST_SCENARIOS.md) 업로드·tenant 격리 시나리오

## 5. Notes

- **R-04**는 CUI-4 핵심 계약. Preview HTML만으로는 검증 불가 — runtime 필수.
- R-04 fixture는 **`S1.createdAt > S2.createdAt`** 을 명시해야 “최근 세션 1건” 선택과 표 필터 검증이 흔들리지 않는다. 업로드 시각이 뒤집히면 S2가 카드에 잡혀 시나리오가 깨진다.
- localhost Blob callback 한계는 CUI-3d와 동일. `needs_review` 실측은 staging DB 권장.
- period 역산·표시 단위 테스트(월·H1·H2·과거 연도·fail-closed)는 Brief §4.2.1·§4.2.2 / CUI-4a에 포함. QA 표의 별도 ID는 두지 않는다.
- 카드 라벨은 `formatSebiseoPeriodLabel`만 사용한다. `buildSebiseoPeriodOptions` 후보에 없는 과거 세션도 라벨이 나와야 한다.
