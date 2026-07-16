# JC-043 CUI-3 · 세비서 업로드·대화·작업 라우팅 Pre-Code Brief
> Created: 2026-07-17 04:20
> Last Updated: 2026-07-17 04:20
> Backlog: JC-043 · CUI-3
> Status: draft · **owner approval required before runtime implementation**
> Related Concept: [04_CONVERSATIONAL_TAX_WORKSPACE_PRODUCT_DIRECTION](../01_Concept_Design/04_CONVERSATIONAL_TAX_WORKSPACE_PRODUCT_DIRECTION.md)
> Related Preview: [19_sebiseo.html](../02_UI_Screens/previews/19_sebiseo.html)
> Related Source Collection: [05_SOURCE_COLLECTION_PRE_CODE_BRIEF](./05_SOURCE_COLLECTION_PRE_CODE_BRIEF.md)
> Related QA: [12_JC043_CUI3_SEBISEO_TEST_SCENARIOS](../05_QA_Validation/12_JC043_CUI3_SEBISEO_TEST_SCENARIOS.md)

## 0. Decision

CUI-3는 CUI-2 셸 위에 **실제 파일 첨부(기존 자료수집 경로)** 와 **화이트리스트 대화 입력**,
그리고 **작업 화면 라우팅**만 연결한다.

```text
첨부 = 기존 staff_direct 업로드·Blob·분석 파이프라인 재사용
대화 = 요청/응답 JSON · 첫 로드 LLM 0회 · 채팅만으로 확정 금지
라우팅 = 자료수집·자료대조원장 등 기존 화면으로 이동
결과 카드(실DB 건수·필터 CTA) = CUI-4
구조화 확정·fingerprint mutation = CUI-5
```

CUI-2 trust 계약은 유지한다. 가짜 DB 상태 문구를 다시 넣지 않고, Instant·마이크·음성은
계속 disabled다.

## 1. Baseline (CUI-2 after PR #265)

| 항목 | 현재 |
|:---|:---|
| Route | `/dashboard/sebiseo` · 로그인/온보딩 기본 진입 · 사이드바 최상단 |
| UI | `#171717` 셸, 중립 환영 문구, `세무 일정(참고)` 1카드 |
| Composer | 첨부·Instant·Mic·Voice·입력 영역이 **disabled** |
| LLM | 페이지 로드 시 provider 호출 없음 |
| Upload | 세비서에서 미연결 · 회사는 `/dashboard/direct-upload`에서만 업로드 |
| Chat history | 없음(레일·DB 없음) |

## 2. Product Contract (CUI-3)

### 2.1 In scope

1. **파일 첨부 활성화**  
   - `+` 버튼과 숨은 file input만 활성화한다.  
   - 허용 형식·용량은 자료수집과 동일: PDF / XLSX / XLS / JPEG / PNG / WebP, ≤50MB.  
   - 업로드 성공 후 thread에 **실제 세션/파일 상태**를 표시한다(가짜 건수 금지).  
   - 저장·파싱·정규화는 기존 API만 호출한다(§4).

2. **대화 입력 활성화**  
   - placeholder를 활성 입력으로 바꾼다.  
   - 전송은 명시적 Send(또는 Enter)로만 한다.  
   - 응답은 request/response JSON이다. **토큰 스트리밍은 CUI-3에서 만들지 않는다.**  
   - 주제는 Concept §3 화이트리스트만 허용한다(§5).

3. **작업 라우팅**  
   - 응답·업로드 결과에서 기존 화면으로 가는 CTA만 제공한다.  
   - 예: `자료수집 열기` → `/dashboard/direct-upload`, `자료대조원장` → `/dashboard/bookkeeping/reconciliation-ledger`.  
   - CTA는 navigation이며, 채팅 문장으로 도메인 mutation을 수행하지 않는다.

4. **실패·준비 상태 표시**  
   - 업로드 거부, 세션 생성 실패, 분석 실패, 비밀번호 필요, 대화 거절, rate limit, provider 오류를
     thread/composer 근처에서 구분 표시한다(§6).

### 2.2 Out of scope (CUI-3 금지)

| 항목 | 이유 | 후속 |
|:---|:---|:---|
| Instant / Mic / Voice 동작 | CUI-2에서 비활성 확정 | 별도 에픽 |
| 채팅 이력 사이드 레일·영구 대화 DB를 정본으로 사용 | Concept Non-Goal | CUI-4+ 검토 |
| 실DB 건수 action card + 필터된 원장 진입 | CUI-4 완료선 | CUI-4 |
| 채팅으로 거래·급여·세액·신고 확정 | Trust Contract | CUI-5 |
| 새 Blob/storage/분석 엔진 | 자료수집 경로 재사용 | — |
| Vercel AI SDK streaming UI | 기존 제품에 stream 패턴 없음 · YAGNI | 후속 UX |
| 홈택스 자동 신고·자격증명 저장 | 제품 경계 | — |
| 회사별 Ready/미확정 canonical 상태 카드 완성 | CUI-2는 참고 일정만 | CUI-4 |

## 3. Responsibility Boundary

| 계층 | CUI-3 책임 | 정본 |
|:---|:---|:---|
| 세비서 대화 | 요청 접수, 업로드 안내, 설명, 거절, 라우팅 CTA | 아님 |
| 자료수집 API·DB | 파일·세션·분석 상태 | `upload_session` / `upload_file` / `source_batch` |
| 구조화 화면 | 검토·수정·확정 | 사용자 확정 + 도메인 테이블 |
| 참고 일정 카드 | 공통 법정 일정 표시(회사 준비 상태 아님) | `lib/tax-calendar` 규칙 |

대화와 구조화 화면이 다르면 **DB canonical 상태를 우선**한다.

## 4. Upload Reuse Contract

세비서는 자료수집과 **동일 mutation 순서**를 클라이언트에서 호출한다.
신규 upload 테이블·신규 Blob handler를 만들지 않는다.

```text
1) POST /api/staff-direct-upload
     body: createStaffDirectUploadSchema
     → sessionId, uploadUrl(rawToken), source_batch
2) @vercel/blob/client upload → POST /api/upload (clientPayload: rawToken…)
3) POST /api/upload/submit { rawToken }
4) (실패 시) POST /api/upload/files/:fileId/retry
5) (암호 필요 시) POST /api/upload/files/:fileId/password
```

| 규칙 | 결정 |
|:---|:---|
| `source` | 항상 `staff_direct` |
| tenant | `requireTenantSession` / Blob token의 `tenantId`와 일치 |
| business entity | 활성 사업장 `clientId` (자료수집과 동일 선택 규칙) |
| workType / period | 기본값: 자료수집 화면과 동일한 기간·workType 헬퍼 재사용. 세비서에서 기간 UI를 새로 만들지 않고, 회사 홈/자료수집과 같은 기본 `?period=` 규칙을 서버가 적용한다 |
| 표시 | `lib/upload/file-display` safe title만. storage key·blob URL 금지 |
| 집계 읽기 | `lib/source-collection/summary` 또는 동일 테이블의 최소 조회. **가짜 건수 금지** |
| 비밀번호 | 기존 password 컴포넌트/API 재사용. 비밀번호를 채팅 로그에 남기지 않음 |

Impact Scope: 업로드 파이프라인 공유 모듈을 수정할 경우 **자료수집 화면 회귀를 반드시 검증**한다.
세비서 전용 동작은 `sebiseo` 경로·컴포넌트 guard로 격리한다.

## 5. Dialogue Input And AI Guardrail

### 5.1 입력 범위 (화이트리스트)

답변 허용:

1. 세무·회계 **제품 업무 흐름** 안내(자료수집, 기장검토, 부가세, 급여·지급, 연간신고 등
   현재 화면·자료에 근거한 설명)
2. 제품 사용법(“이 파일 어떻게 올려요?”, “이 버튼은 뭐예요?”)

거절(업무 답변 생성 금지, 짧은 거절 문구만):

- 잡담, 다른 도메인, 코딩 도움
- 제품 범위 밖 일반 세무상담·세무대리 조언
- 자격 사칭을 유도하는 요청(“세무사처럼 확정해줘”)

### 5.2 페르소나

- “세무·회계 업무를 도와주는 어시스턴트”
- “세무사”·“세무회계 전문가” 사칭 금지
- 필요 시 self-filing 경계 문구 동반

### 5.3 실행 규칙

| 규칙 | 결정 |
|:---|:---|
| 첫 로드 LLM | 0회 (CUI-2 유지) |
| LLM 시작 조건 | 사용자가 메시지를 **전송**했을 때만 |
| 첨부만 수행 | 업로드 파이프라인만 호출. 첨부가 자동으로 긴 LLM 요약을 강제하지 않음. 선택적 짧은 상태 문구는 DB 상태 기반 |
| 응답 형태 | JSON `{ status, answer, suggestedActions[], refusal? }` Zod 검증 |
| Streaming | CUI-3 제외 |
| Rate limit | usage-help와 동등 이상. tenant+user 단위 |
| Redaction | 주민번호·계좌·카드·비밀번호·storage key 응답 금지 |
| 확정 금지 | 모델이 “확정했습니다”라고 말해도 서버 mutation 없음 |
| 이력 저장 | CUI-3는 **브라우저 세션 ephemeral thread**만. 대화 테이블을 canonical로 신설하지 않음 |

### 5.4 API 경계 (제안)

| 옵션 | 결정 |
|:---|:---|
| 추천 | 신규 `POST /api/sebiseo/chat` (세비서 전용 Zod·페르소나·가드레일) |
| 재사용 | `lib/usage-help`의 scope classifier·rate limit·redaction·refusal 패턴을 **복사/공유 모듈화**. `/api/help/usage-chat` 경로를 세비서가 직접 호출하지 않음(도움말 제품과 책임 분리) |
| 금지 | 업로드 분석용 `lib/ai/analyze.ts`를 채팅 한 줄마다 호출 |

## 6. Failure And UX States

| 상태 | UI | 사용자 행동 |
|:---|:---|:---|
| Idle (CUI-2 유지 + 입력 활성) | 중립 환영 + 참고 일정 | 질문 또는 첨부 |
| Uploading | thread에 파일명(safe) + 진행 | 대기 · 다른 메뉴 이동 가능(전체 화면 비차단) |
| Analyzing | DB status `analyzing` 반영 | 자료수집에서도 동일 상태 확인 가능 |
| Upload rejected (type/size) | 오류 문구, DB 행 없음 | 다른 파일 |
| Analyze failed | 실패 사유 + 재시도 CTA(기존 retry API) | 재시도 또는 자료수집으로 이동 |
| Password required | 비밀번호 입력 UI(기존 컴포넌트) | 제출 후 재분석 |
| Chat refused | 짧은 거절 + 허용 주제 안내 | 허용 범위 재질문 |
| Chat rate limited | 대기 안내 | 잠시 후 재시도 |
| Provider error | 일반 오류 + 수동 경로(자료수집/해당 화면) | 메뉴로 직접 이동 |
| Unauthenticated | 기존과 동일 `/sign-in` | 로그인 |

## 7. Component And Library Plan

### 7.1 Reuse (수정 최소화)

| 자산 | 용도 | Guard |
|:---|:---|:---|
| `POST /api/staff-direct-upload` + validations | 세션 생성 | tenant·client 검증 유지 |
| `POST /api/upload` + Blob client | 바이트 저장 | token tenant 일치 |
| `POST /api/upload/submit` · retry · password | 제출·복구 | 기존과 동일 |
| `lib/ai/process.ts` · `analyze.ts` | 백그라운드 분석 | 세비서가 직접 analyze 내부 호출 금지 · API만 |
| `lib/source-collection/summary.ts` | 업로드 후 상태 읽기(선택) | tenant+client+staff_direct |
| `lib/upload/file-display.ts` | safe title | 비밀 경로 미노출 |
| `lib/tax-calendar` `buildUpcomingSchedule` | 참고 일정 | 회사 준비 상태로 표현 금지 |
| usage-help: classifier / rate-limit / redaction / refusal | 대화 가드레일 패턴 | 세비서 페르소나·화이트리스트로 래핑 |
| shadcn Button / 기존 dropzone 패턴 | 첨부 UX | 세비서 컴포저 안에서만 |

### 7.2 New (세비서 전용)

| 자산 | 책임 |
|:---|:---|
| `app/api/sebiseo/chat/route.ts` | Zod 입력, tenant session, 가드레일, JSON 응답 |
| `lib/sebiseo/chat/*` | 시스템 프롬프트, 화이트리스트, action 제안 스키마 |
| `sebiseo-workspace.tsx` 확장 | composer enable, thread state, upload/chat handlers |
| `sebiseo-composer.tsx` (권장 분리) | 입력·첨부·disabled Instant/Mic/Voice |
| `sebiseo-thread.tsx` (권장 분리) | ephemeral messages + 상태 칩 |
| 단위 테스트 | disabled 유지(Instant 등), 업로드 경로 mock, 거절 케이스 |

### 7.3 Do not reuse / do not touch

| 자산 | 이유 |
|:---|:---|
| 외부 업로드 포털 `app/upload/[token]` | 회사 v1 범위 밖 |
| `customer_upload` / 메일 요청 UI | GIWA 회계사무소 흐름 |
| VAT tax-treatment AI API | 부가세 전용 · 세비서 일반 채팅과 혼합 금지 |
| law consultation API를 기본 백엔드로 사용 | 법령 상담 제품과 책임 분리. 필요 시 CUI-4+에서 명시 연결만 |
| 회사 홈 canonical Ready 카드 로직을 세비서에 복제 | CUI-4에서 read model로 설계 |

## 8. Delivery Slices (implementation after approval)

| Slice | 산출물 | 완료선 |
|:---|:---|:---|
| **CUI-3a** | 첨부 활성 + 기존 업로드 파이프라인 + thread 상태 | 파일 1건이 `staff_direct`로 저장·분석 큐 진입. Instant/Mic/Voice 여전히 disabled |
| **CUI-3b** | `POST /api/sebiseo/chat` + 입력 활성 + 거절/허용 | 화이트리스트 외 거절, 첫 로드 LLM 0, Zod 응답 |
| **CUI-3c** | suggestedActions 라우팅 CTA | 클릭 시 기존 화면만 이동, mutation 없음 |
| **CUI-3d** | QA 시나리오 자동화/수동 통과 | [QA 12](../05_QA_Validation/12_JC043_CUI3_SEBISEO_TEST_SCENARIOS.md) |

각 slice는 별도 PR. CUI-3 전체 승인 전 runtime 착수 금지.

## 9. Acceptance Criteria

- [ ] 세비서에서 허용 파일을 올리면 기존 자료수집과 동일하게 `staff_direct` 세션·파일이 생성된다.
- [ ] 업로드/분석 상태 문구는 실제 DB 상태를 반영하며 가짜 건수를 쓰지 않는다.
- [ ] Instant·마이크·음성은 disabled + 준비 중 안내를 유지한다.
- [ ] 사용자 메시지 전송 전에 LLM provider 호출이 없다.
- [ ] 화이트리스트 밖 질문은 거절되며 업무 답변을 생성하지 않는다.
- [ ] 채팅 응답만으로 거래·급여·세액·신고 canonical 상태가 바뀌지 않는다.
- [ ] 모든 읽기/mutation은 `tenantId`(및 사업장 scope) 밖 데이터에 접근하지 않는다.
- [ ] 자료수집 화면 기존 업로드·집계 회귀가 통과한다.
- [ ] Preview/Screen Flow/Backlog/Concept Status가 CUI-3 승인 범위로 동기화된다.

## 10. Open Owner Confirmations

구현 전 오너 확인이 필요한 항목(기본 제안 포함):

1. **대화 API**: 신규 `/api/sebiseo/chat` 승인? (제안: 승인)  
2. **대화 이력 DB**: CUI-3에서 ephemeral만? (제안: ephemeral만)  
3. **업로드 후 자동 LLM 요약**: 끔? (제안: 끔. DB 상태 한 줄만)  
4. **기간 UI**: 세비서에 기간 선택기 추가 vs 자료수집 기본 기간 공유? (제안: 기본 기간 공유, 선택기는 자료수집에 유지)

## 11. Document Sync Checklist (approval 시)

- [ ] Concept 04 Status → CUI-3 Brief 승인 / runtime 미착수 또는 slice 진행
- [ ] BACKLOG JC-043 Related Technical/QA Docs 링크
- [ ] SCREEN_FLOW §2.1 CUI-3 범위 문구
- [ ] Preview `19_sebiseo.html`에 활성 첨부·입력(Instant 등은 disabled) 반영은 **runtime PR과 동일 슬라이스**에서

## 12. Related Documents

| Layer | Doc |
|:---|:---|
| Concept | [04 Conversational Tax Workspace](../01_Concept_Design/04_CONVERSATIONAL_TAX_WORKSPACE_PRODUCT_DIRECTION.md) |
| UI | [00_SCREEN_FLOW](../02_UI_Screens/00_SCREEN_FLOW.md) · [19_sebiseo.html](../02_UI_Screens/previews/19_sebiseo.html) |
| Tech | [05 Source Collection](./05_SOURCE_COLLECTION_PRE_CODE_BRIEF.md) · this brief |
| Progress | [00_BACKLOG JC-043](../04_Logic_Progress/00_BACKLOG.md) |
| QA | [12 CUI-3 Scenarios](../05_QA_Validation/12_JC043_CUI3_SEBISEO_TEST_SCENARIOS.md) · [03 Source Collection QA](../05_QA_Validation/03_SOURCE_COLLECTION_TEST_SCENARIOS.md) |
