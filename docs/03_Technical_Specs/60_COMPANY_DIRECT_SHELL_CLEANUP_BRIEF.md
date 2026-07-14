# Company Direct-Use Shell Cleanup Pre-Code Brief

> Created: 2026-07-14
> Status: UI-First Preview ready · owner review pending · runtime not implemented

## 0. 목적

SemuAgent는 회계사무소가 여러 고객사를 배정·관리하는 제품이 아니라, 한 회사가 자기 자료를 정리하고 세금 신고를 준비하는 제품이다. 로그인 직후와 설정 화면도 이 목적을 그대로 보여줘야 한다.

이번 Slice C는 물리 스키마의 `tenant`·`client`·`staff` 이름을 바꾸지 않는다. 사용자에게 보이는 첫 진입과 설정 정보 구조만 회사 직접사용 기준으로 정리한다.

## 1. 확인된 문제

1. 로그인 또는 기존 회사 확인 뒤 `/dashboard/clients`로 이동해 다사업장 관리 화면이 첫 화면처럼 보인다.
2. 온보딩에서 사용자가 실제 업무에 쓰지 않는 `서브도메인`을 직접 입력한다.
3. 설정 첫 화면에 `담당자 관리`·`업무메일 설정`·`사업장 관리`가 동급 탭으로 노출되어 회계사무소 운영 제품처럼 보인다.
4. 사용자 목록에 `사업장 수`·`업무 메일함`이 표시되어 회사 내부 사용자 권한 관리보다 고객사 배정 구조가 강조된다.
5. `client` 물리 모델과 레거시 라우트는 아직 여러 live read/write 경로가 사용하므로 이 Slice에서 삭제할 수 없다.

## 2. 오너 확인용 IA

### 2.1 첫 진입

```text
로그인
  ├─ 회사 없음 → 회사 등록 → 회사 홈
  └─ 회사 있음 → 회사 홈
```

- 회사 홈(`/dashboard`)을 인증 후 기본 진입점으로 사용한다.
- 신규 회사 등록 뒤 first-run sample 생성 계약은 유지한다.
- `client` row가 없을 때만 현재 업무 화면의 `회사 정보 등록` CTA를 사용한다.
- `/dashboard/clients` 물리 라우트는 호환을 위해 유지하되 기본 진입점이나 상시 네비게이션으로 사용하지 않는다.

### 2.2 설정

설정은 다음 두 탭만 기본 노출한다.

| 탭 | 포함 | 제외 |
|:---|:---|:---|
| 회사 정보 | 회사명, 기본 시간대, 사업자 유형, 요금제 이동 | 서브도메인 직접 편집, 다사업장 배정 |
| 사용자 관리 | 이름, 이메일, 전화번호, 권한, 활성 상태, 사용자 추가 | 사업장 수, 업무 메일함, 담당 고객사 |

- `담당자`는 사용자 화면에서 `사용자`로 표시한다.
- `STAFF`는 `일반 사용자`, `TENANT_ADMIN`은 `관리자`로 표시한다.
- 업무메일 주소 관리 화면은 설정 기본 탭에서 제거한다. 테이블·API·메일 이력은 이번 Slice에서 삭제하지 않는다.
- 사업장 관리 링크는 설정 기본 탭에서 제거한다. 실제 회사 정보가 없는 Empty 상태의 등록 동선은 유지한다.

## 3. Preview 계약

오너 확인 대상은 [16_company_settings.html](../02_UI_Screens/previews/16_company_settings.html)이다.

### 3.1 첫 화면에서 보여야 하는 것

- 제목 `설정`
- 설명 `회사 정보와 사용자 권한을 관리합니다.`
- `회사 정보`·`사용자 관리` 두 탭
- 회사 정보 탭의 회사명·기본 시간대·사업자 유형·요금제
- 사용자 관리 탭의 사용자 표와 사용자 추가 액션

### 3.2 보여서는 안 되는 것

- `Workspace`
- `담당자 관리`
- `업무메일 설정`
- `사업장 관리`
- `사업장 N개`
- `업무 메일함`
- 사용자가 직접 정해야 하는 `서브도메인`

## 4. Runtime 구현 순서

1. 인증·온보딩 성공 후 기본 경로를 회사 홈으로 변경한다.
2. 온보딩 요청에서 내부 회사 식별자를 서버가 생성하고, 입력 UI에서 서브도메인을 제거한다.
3. 설정 read model에서 업무메일 전용 조회와 props를 제거한다.
4. 설정 탭을 회사 정보·사용자 관리로 축소하고 사용자 용어를 적용한다.
5. 기존 사용자 role/활성화 mutation, 회사 정보 저장, 사업자 유형 저장, 요금제 링크를 그대로 재사용한다.
6. `/dashboard/clients`·staff mailbox 스키마·메일 API 삭제는 JC-031 영향 감사 없이 수행하지 않는다.

## 5. Side-Effect Isolation

- 세무 계산·자료수집·기장·부가세·급여·신고 준비 read/write는 변경하지 않는다.
- first-run sample 생성 시점과 sample registry는 유지한다.
- 인증 tenant 격리와 관리자 권한 검증은 유지한다.
- `staff` 물리명과 role enum은 변경하지 않는다.
- `client` 물리명과 기존 FK는 변경하지 않는다.
- 레거시 업무메일 데이터는 숨기되 삭제하거나 상태를 바꾸지 않는다.

## 6. 완료선

- 로그인·온보딩 후 회사 홈으로 진입한다.
- 온보딩 화면에 서브도메인 입력이 없다.
- 설정 정상 DOM에 금지 문구가 없다.
- 회사 정보 저장, 사업자 유형 저장, 사용자 추가·권한 변경·활성화가 회귀하지 않는다.
- 오래된 `?tab=mail`·`?tab=clients` 링크는 안전하게 회사 정보 탭으로 돌아온다.
- 타입·전체 테스트·린트·whitespace·데스크톱/모바일 브라우저 확인을 통과한다.

## 7. Related Documents

- [Product Purpose UI Alignment Brief](./58_PRODUCT_PURPOSE_UI_ALIGNMENT_BRIEF.md)
- [Screen Flow](../02_UI_Screens/00_SCREEN_FLOW.md)
- [UI Design](../02_UI_Screens/01_UI_DESIGN.md)
- [Backlog](../04_Logic_Progress/00_BACKLOG.md)
- [Runtime UI Trust Test Scenarios](../05_QA_Validation/11_RUNTIME_UI_TRUST_TEST_SCENARIOS.md)
