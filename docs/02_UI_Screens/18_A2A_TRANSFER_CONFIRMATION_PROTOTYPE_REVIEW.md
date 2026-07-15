# A2A Transfer Confirmation Prototype Review
> Created: 2026-07-16 06:10
> Last Updated: 2026-07-16 06:10

## 1. HTML UI Preview

- Preview: [세무사무소로 전송 확인](./previews/18_a2a_transfer_confirmation.html)
- 진입점 변경: [부가세 작업대](./previews/03_vat.html) — Ready 배너에 `세무사무소로 보내기` 추가
- 확인 방식: 브라우저에서 HTML 파일 직접 열람
- 제작자 검증: 데스크톱 1558×1324, mobile 375×812 렌더 확인, 진입점 → 확인 화면 링크 이동 확인
- 확인 목적: 사용자가 전송 전 확인해야 할 범위(연결 상태·전송 대상·준비값·원본 범위·해결된
  예외·fingerprint)가 한 화면에서 충분히 검토되는지, 최종 CTA가 즉시 전송을 유발하지 않는지 확인

## 2. Prototype Scope

- 부가세(VAT) 첫 slice만 다룬다. 원천세·지급명세서 등 후속 세목은 이번 Preview 범위 밖이다.
- SemuAgent 발신 측 화면만 다룬다. JARYO-GIWA 수신 화면은 별도 Preview에서 다룬다.
- `세무사무소 연결` 관리 화면(상담 신청·수임 승인·연결 해지, §7.1)은 이 화면에 통합하지 않는다.
- 전송 진행 중·전송 완료·기술 오류 상태는 이번 Preview 범위 밖이다. Ready 진입 상태와
  fingerprint 불일치(재확인 필요) 차단 상태 두 가지만 다룬다.
- 부가세 화면의 진입점은 Ready일 때만 활성화하고 클릭 즉시 전송하지 않는다(마스터플랜 §8.17.4).
  03_vat.html의 기본 스냅샷은 신고 전 수정 필요 2건이 남아 있어 Not Ready(비활성 버튼)를 기본
  표시하고, Ready 상태의 활성 진입점은 같은 파일의 `다른 상태 보기`에서 별도로 보여준다(전송
  확인 화면 자체의 데이터는 별도 Ready 스냅샷 기준).

## 3. Key User Flow

```text
부가세 작업대
  -> 공제·과세유형·안분 사용자 확정
  -> 확정 원장 provenance/gate 통과 (Ready)
  -> `세무사무소로 보내기`
  -> 전송 확인 화면: 연결 상태 · 전송 대상 · 준비값 · 원본 범위 · 해결된 예외 · fingerprint
  -> `세무사무소로 전송` (서버가 fingerprint 재검증)
  -> JARYO-GIWA `SemuAgent 수신 · 검토 대기` (범위 밖, 후속 Preview)
```

## 4. Screen States

- Ready: 녹색 `Ready` 칩, 미해결 blocker/무결성 오류 0건, 전송값·원본 범위·해결된 예외 전체 표시,
  `세무사무소로 전송` 활성
- 재확인 필요(fingerprint 불일치): warn 배너로 전환, `세무사무소로 전송` 비활성화,
  `부가세로 돌아가서 확인`만 활성
- Not Ready(부가세 화면 진입점): 신고 전 수정 필요 항목이 남아 있으면 warn 칩 + 비활성
  `세무사무소로 보내기`만 표시하고 전송 확인 화면으로 이동하지 않는다(기존 VAT package gate
  재사용). 03_vat.html의 기본 스냅샷 상태이며, Ready 활성 진입점은 같은 파일 `다른 상태 보기`에서
  확인한다.
- 전송 진행 중/완료/기술 오류: 범위 밖, 후속 Preview

## 5. Data Flow

- Inputs: 같은 tenant·사업장·기간의 확정 VAT 원장, 사용자 확정 공제 검토, 현재 provenance
  fingerprint, VAT package gate `isReady`, 연결된 세무회계사무소 상태(§7.1 결과 참조)
- Displayed data: 연결 사무소, 전송 대상(사업자·세목·기간·snapshot version), Ready 상태,
  매출세액/매입세액/납부세액, 자료유형별 원본 건수·목록, 해결된 예외(사유·확인자·확인시각),
  확인 시점 fingerprint
- Mutations: 없음(read-only). `세무사무소로 전송` 클릭은 이번 Preview에서 동작을 시연하지 않으며
  실제 전송 mutation·서버 fingerprint 재검증은 기술 계약(A2A-7 후반)에서 정의한다
- External dependency: JARYO-GIWA 수신 상태는 이 화면이 직접 조회하지 않는다. 연결 상태는
  SemuAgent 쪽 연결 레코드를 참조한다

## 6. Information Hierarchy

1. 수신 사무소와 연결 상태
2. 전송 대상(사업자·세목·기간·snapshot)과 Ready 여부
3. 신고 준비값 요약
4. 포함 원본 자료 범위(펼쳐보기)
5. 해결된 예외
6. fingerprint 확인과 최종 CTA

별도 Hero 반복, AI 판단 설명, 거래별 상세 편집 기능은 이 화면에 두지 않는다. 편집은 부가세
작업대에서만 수행한다.

## 7. User Confirmation

- 화면/UI 선확인 여부: 확인 대기
- HTML Preview 확인 여부: 확인 대기
- 확인자: -
- 확인 일시: -
- 승인 결과: -
- 다음 단계: 오너 확인 후 A2A-7 나머지 항목(JARYO 수신 화면 Preview, 공통 envelope·세목별 payload
  기술 계약)으로 이어간다

## 8. Review Questions

1. 부가세 화면의 진입점(Ready 배너 + `세무사무소로 보내기`)이 즉시 전송처럼 보이지 않고,
   별도 확인 화면으로 이동한다는 것이 명확한가?
2. 전송 확인 화면 한 화면의 정보량이 §5.3 필수 항목(연결 상태, 전송 대상, 준비값, 원본 범위,
   해결된 예외, Ready 상태)을 빠짐없이 담으면서도 과하지 않은가?
3. 원본 자료를 `자료유형별 건수 + 펼쳐보기 상세`로 압축한 구성이 적절한가, 아니면 기본 노출
   정보를 늘리거나 줄여야 하는가?
4. fingerprint 불일치 차단 상태의 문구와 CTA 비활성화 방식이 사용자에게 이해되는가?
5. 최종 CTA 문구를 `세무사무소로 전송`(§5.3)으로 통일하고 마스터플랜 §8.17.4 원문(`확인하고
   전송`)을 수정한 것에 동의하는가?
6. `세무사무소 연결` 관리 화면을 이 Preview에 포함하지 않고 후속으로 분리한 범위 판단이 맞는가?

## 9. Related Documents

- **Concept_Design**: [Agent-to-Agent Tax Collaboration Master Plan §5, §6.2, §8.17](../01_Concept_Design/03_AGENT_TO_AGENT_TAX_COLLABORATION_MASTER_PLAN.md) - Ready Handoff·VAT Ready Contract·전송 화면 계약 정본
- **UI_Screens**: [Screen Flow §4h](./00_SCREEN_FLOW.md) - A2A 전송 확인 화면 흐름
- **UI_Screens**: [UI Design §4.4, §4.4a](./01_UI_DESIGN.md) - 부가세 진입점·전송 확인 컴포넌트
- **UI_Screens**: [VAT Prototype Review](./05_VAT_PROTOTYPE_REVIEW.md) - 부가세 작업대 확인 결과
- **Logic_Progress**: [Backlog / JC-044](../04_Logic_Progress/00_BACKLOG.md) - 제품 방향 승인·구현 미승인 상태
