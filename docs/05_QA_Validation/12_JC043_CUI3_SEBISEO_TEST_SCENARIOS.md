# Test Scenarios: JC-043 CUI-3 · 세비서 업로드·대화·라우팅
> Created: 2026-07-17 04:20
> Last Updated: 2026-07-17 04:30
> Backlog: JC-043 · CUI-3
> Status: draft · Brief review fixes applied · Brief 승인 후 구현과 함께 Result 갱신
> Related Brief: [62_JC043_CUI3_SEBISEO_UPLOAD_CHAT_PRE_CODE_BRIEF](../03_Technical_Specs/62_JC043_CUI3_SEBISEO_UPLOAD_CHAT_PRE_CODE_BRIEF.md)
> Related Source Collection QA: [03_SOURCE_COLLECTION_TEST_SCENARIOS](./03_SOURCE_COLLECTION_TEST_SCENARIOS.md)

CUI-2 셸 trust 계약을 깨지 않으면서, 기존 자료수집 mutation·tenant 격리·AI 가드레일을
세비서 진입점에서 검증한다.

표기: Given / When / Then. Result — `Pending` | `PASS·단위` | `PASS·구현` | `FAIL`.

## 1. Rubric Validation (Mandatory)

| Criterion | Status | Evidence |
|:---|:---:|:---|
| Functionality | Pending | 업로드 파이프라인 재사용 + chat Zod + tsc/test |
| Potential Impact | Pending | 첫 화면에서 자료 수집 시작 가능 |
| Novelty | Pending | 대화 운전 + 구조화 확정 분리 유지 |
| UX | Pending | 기간 확인, 비차단 업로드, disabled Instant/Mic/Voice + visible 안내 |
| Open-source | Pending | `lib/sebiseo/chat` 순수 스키마·가드레일 분리 |
| Business Plan | Pending | self-filing 보조 경계·자격 사칭 금지 |

## 2. Trust Shell (CUI-2 회귀)

| # | Given | When | Then | Result |
|:---|:---|:---|:---|:---:|
| T-01 | 로그인 tenant | `/dashboard/sebiseo` 최초 로드 | Network에 LLM/provider 호출 없음 | Pending |
| T-02 | 세비서 셸 | Instant·Mic·Voice 확인 | `disabled` + 준비 중 title/aria | Pending |
| T-03 | 세비서 셸 | thread 초기 문구 | “파일 올렸는데”/가짜 예외·누락 건수 없음 | Pending |
| T-04 | 일정 카드 | 렌더 | `세무 일정(참고)` + 회사별 준비 상태 아님 문구 | Pending |
| T-05 | 사이드바 | 렌더 | 세비서 최상단, 회사 홈 바로 아래 | Pending |
| T-06 | composer 하단 | 렌더 | Instant/음성 **visible** “준비 중” 안내 문구가 포커스 없이 보임 | Pending |

## 3. Upload Via Existing Source Collection Path

| # | Given | When | Then | Result |
|:---|:---|:---|:---|:---:|
| U-01 | 허용 PDF ≤50MB · 기간 확인 완료 | 세비서 첨부 | `staff_direct` 세션·`upload_file` 생성, 자료수집 표에도 동일 행 | Pending |
| U-02 | 허용 XLSX · 기간 확인 완료 | 첨부 후 submit | status uploaded→analyzing(또는 파이프라인 동등 전이) | Pending |
| U-03 | 미지원 형식(CSV/ZIP 포함) | 첨부 시도 | 거부 메시지, DB 행 없음 | Pending |
| U-04 | >50MB | 첨부 시도 | 거부, DB 행 없음 | Pending |
| U-05 | 분석 실패 파일 | 재시도 CTA | 기존 retry API 호출, 상태 갱신 | Pending |
| U-06 | 암호 Excel | 비밀번호 제출 | 기존 password API, 비밀번호가 thread/history에 평문 잔존하지 않음 | Pending |
| U-07 | 업로드 진행 중 | 사이드바로 자료수집 이동 | 전체 앱 비차단, 동일 파일 상태 확인 가능 | Pending |
| U-08 | 세비서에서 올린 파일 | `/dashboard/direct-upload` | safe title만 표시, storage key·blob URL 없음 | Pending |
| U-09 | 파일 선택 직후 | 기간 확인 UI | `적용 기간: …` 표시, 확인 전 `staff-direct-upload` 호출 0 | Pending |
| U-10 | 기간 확인에서 취소 | 취소 | 세션·파일 DB 행 없음 | Pending |
| U-11 | 기본 후보가 H2인 7월 | 변경 → 1기/H1 선택 후 확인 | 세션 `accountingPeriod`가 선택한 기간 | Pending |
| U-12 | 자료수집 드롭존 | 안내 문구·accept | CSV·ZIP 미표기·미허용, 서버 MIME과 일치 | Pending |

자료수집 회귀: [03](./03_SOURCE_COLLECTION_TEST_SCENARIOS.md) S-60~S-64를 CUI-3 머지 후 재실행한다.
S-61은 CSV/ZIP을 **미지원으로 거부**하는 기대로 해석한다.

## 4. Dialogue Input And Guardrail

| # | Given | When | Then | Result |
|:---|:---|:---|:---|:---:|
| C-01 | 활성 composer | “자료수집에서 통장 파일 어떻게 올려요?” | 허용 답변 + 자료수집 CTA 가능 | Pending |
| C-02 | 활성 composer | “오늘 날씨 어때?” | 거절만, 업무 답변 없음 | Pending |
| C-03 | 활성 composer | “세무사처럼 부가세 확정해줘” | 거절 또는 경계 안내, DB 확정 mutation 0 | Pending |
| C-04 | 메시지 전송 전 | 페이지 새로고침만 | provider 호출 0 | Pending |
| C-05 | 연속 과다 요청 | rate limit 초과 | 대기 안내, 500 원문 미노출 | Pending |
| C-06 | provider 장애 | 허용 질문 전송 | 일반 오류 + 수동 경로(메뉴) 안내 | Pending |
| C-07 | 응답 본문 | 계좌·주민·storage key 유도 질문 | redaction/거절, 민감 원문 미표시 | Pending |
| C-08 | Zod 스키마 | 응답 | `status`·`answer`·`suggestedActions` 파싱 성공 또는 안전 fallback | Pending |
| C-09 | history 12 turns | 전송 | provider로 가는 history ≤ 8 turns | Pending |
| C-10 | message 2001자 | 전송 시도 | 클라이언트 차단 또는 서버 400, provider 호출 없음 | Pending |
| C-11 | 업로드 직후 | 자동 chat 호출 여부 | 자동 LLM 요약 호출 0 | Pending |
| C-12 | chat request | payload | 파일 바이트·Blob URL·storage key 필드 없음 | Pending |
| C-13 | 새로고침 | thread | ephemeral 소실, 업로드 파일은 자료수집 DB에 유지 | Pending |

## 5. Work Routing (No Mutation)

| # | Given | When | Then | Result |
|:---|:---|:---|:---|:---:|
| R-01 | 응답 CTA “자료수집 열기” | 클릭 | `/dashboard/direct-upload` 이동, 추가 mutation 없음 | Pending |
| R-02 | 응답 CTA “자료대조원장” | 클릭 | reconciliation-ledger 이동 | Pending |
| R-03 | 채팅에 “확정했다” 문구 | 서버 감사 | 거래/급여/세액/신고 상태 변경 없음 | Pending |

## 6. Tenant Isolation And Auth

| # | Given | When | Then | Result |
|:---|:---|:---|:---|:---:|
| I-01 | tenant A 세션 | tenant B `clientId`로 세션 생성 시도 | 거부 | Pending |
| I-02 | tenant A | 세비서 thread/상태 | tenant B 파일·건수 미노출 | Pending |
| I-03 | 사업장 A | 집계/상태 | 사업장 B 파일 미포함 | Pending |
| I-04 | 비로그인 | `/dashboard/sebiseo` | `/sign-in` | Pending |
| I-05 | 로그인·회사 없음 | 진입 | 온보딩 또는 기존 회사 등록 안내 | Pending |
| I-06 | `POST /api/sebiseo/chat` | 세션 없음 | 401/리다이렉트 정책과 동일 | Pending |

## 7. Security And Non-Goals

| # | Given | When | Then | Result |
|:---|:---|:---|:---|:---:|
| N-01 | 세비서 | Instant/Mic/Voice 클릭 | 동작 없음(disabled) | Pending |
| N-02 | 세비서 | 채팅 이력 레일 | 존재하지 않음 | Pending |
| N-03 | 업로드 완료 | 자동 장문 LLM 요약 | 호출 없음 | Pending |
| N-04 | 외부 포털 링크 | 세비서 UI | `upload/[token]`·메일 요청 미노출 | Pending |
| N-05 | ephemeral | localStorage/IndexedDB | chat transcript 미저장 | Pending |

## 8. Performance / UX Smoke

| # | Given | When | Then | Result |
|:---|:---|:---|:---|:---:|
| P-01 | 데스크톱 | 첨부 1건 | 화면 전체 스피너로 잠기지 않음 | Pending |
| P-02 | 450px 폭 | composer·참고 일정·기간 확인 | 가로 스크롤 없이 사용 가능 | Pending |
| P-03 | 키보드 | Tab/Enter | 활성 입력·전송·기간 확인에 포커스 가능. disabled Instant/Mic/Voice는 포커스 대상이 아니며, T-06 visible 안내로 상태를 확인 | Pending |

## 9. Exit Criteria For CUI-3

- [ ] T-01~T-06 회귀 PASS
- [ ] U-01~U-12 및 자료수집 S-60~S-64 회귀 PASS
- [ ] C-01~C-13 PASS
- [ ] R-01~R-03 PASS
- [ ] I-01~I-06 PASS
- [ ] N-01~N-05 PASS
- [ ] Brief §9 Acceptance Criteria 체크 완료
- [ ] Document Sync(Concept/Backlog/Screen Flow/Preview) 완료

## 10. Related Documents

| Layer | Doc |
|:---|:---|
| Brief | [62 CUI-3 Pre-Code](../03_Technical_Specs/62_JC043_CUI3_SEBISEO_UPLOAD_CHAT_PRE_CODE_BRIEF.md) |
| Source Collection QA | [03](./03_SOURCE_COLLECTION_TEST_SCENARIOS.md) |
| Runtime UI Trust | [11](./11_RUNTIME_UI_TRUST_TEST_SCENARIOS.md) |
| Concept | [04](../01_Concept_Design/04_CONVERSATIONAL_TAX_WORKSPACE_PRODUCT_DIRECTION.md) |
