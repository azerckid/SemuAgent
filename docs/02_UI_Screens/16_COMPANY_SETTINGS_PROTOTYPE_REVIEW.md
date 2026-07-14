# Company Direct-Use Settings Prototype Review

> Created: 2026-07-14
> Status: owner review pending
> Preview: [16_company_settings.html](./previews/16_company_settings.html)

## 1. 검토 목적

로그인 뒤 한 회사의 업무로 바로 들어가고, 설정이 회계사무소의 고객사 배정 화면처럼 보이지 않도록 Slice C의 정보 구조를 먼저 확인한다.

## 2. Preview 결정안

1. 인증·온보딩 성공 뒤 회사 홈으로 이동한다.
2. 온보딩에서 서브도메인을 묻지 않는다.
3. 설정 탭은 `회사 정보`와 `사용자 관리` 두 개만 노출한다.
4. `담당자`는 `사용자`, 일반 `STAFF` 권한은 `일반 사용자`로 표시한다.
5. 회사 정보에는 회사명·시간대·사업자 유형·요금제 이동만 둔다.
6. 사용자 표에는 이름·이메일·전화번호·권한·활성 상태만 둔다.
7. 업무메일·사업장 배정·다사업장 추가는 기본 설정 화면에서 숨긴다.

## 3. 유지 경계

- 사용자 추가·권한 변경·활성화 API는 유지한다.
- 회사 정보·사업자 유형 저장 API는 유지한다.
- 물리 `client`·`staff`·mailbox와 레거시 라우트는 삭제하지 않는다.
- 회사 정보가 실제로 없는 Empty 상태의 등록 동선은 유지한다.

## 4. 오너 확인

- [ ] 로그인 후 회사 홈 진입이 맞다.
- [ ] 설정 2탭의 정보 밀도가 충분하다.
- [ ] 업무메일·사업장 배정 비노출이 맞다.
- [ ] 사용자 관리 용어가 회사 직접사용 목적에 맞다.

승인 후 [Brief 60](../03_Technical_Specs/60_COMPANY_DIRECT_SHELL_CLEANUP_BRIEF.md) §4 순서로 runtime을 구현한다.
