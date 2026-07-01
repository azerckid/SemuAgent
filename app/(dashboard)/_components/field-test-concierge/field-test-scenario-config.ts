import type { FieldTestScenario } from './field-test-types'

export const FIELD_TEST_SCENARIOS: FieldTestScenario[] = [
  {
    id: 'dashboard',
    title: '진행 현황',
    purpose: '진행 현황만 보고 오늘 먼저 처리할 업무를 판단할 수 있는지 확인합니다.',
    operatorSetup: [
      '테스터가 로그인할 수 있어야 합니다.',
      '테스트 tenant에 고객사, 요청, 업로드, 메일, 급여 중 하나 이상의 신호가 있으면 좋습니다.',
    ],
    steps: [
      {
        screen: '/dashboard',
        instruction: '왼쪽 메뉴에서 진행 현황을 눌러 현재 업무 요약 화면으로 돌아가 주세요.',
        expectedResult: '진행 현황 화면이 바로 보이고 로그인/오류 화면으로 빠지지 않아야 합니다.',
      },
      {
        screen: '/dashboard',
        instruction: '상단 숫자 카드와 오늘의 우선순위를 읽어 보세요.',
        expectedResult: '오늘 제출기한, 발송 실패, 검토 대기, 급여 부적합 같은 신호가 이해되어야 합니다.',
      },
    ],
    expectedResult: [
      '테스터가 모든 메뉴를 열지 않고도 오늘의 첫 업무를 대략 판단할 수 있습니다.',
      '진행 현황이 오늘 처리할 업무를 확인하는 요약 화면으로 충분합니다.',
    ],
    feedbackPrompts: [
      '진행 현황만 보고 오늘 무엇을 먼저 해야 할지 알 수 있나요?',
      '중복되거나 헷갈리는 상태 신호가 있나요?',
    ],
  },
  {
    id: 'client-create',
    title: '고객사 추가',
    purpose: '새 고객사를 추가하는 흐름이 실제 업무 시작점으로 충분히 이해되는지 확인합니다.',
    operatorSetup: [
      '실제 고객 정보가 아닌 테스트 고객사 정보만 사용합니다.',
      '테스트 이메일 주소를 준비합니다.',
    ],
    steps: [
      {
        screen: '/dashboard/clients',
        instruction: '왼쪽 메뉴에서 고객사를 눌러 목록 화면으로 이동해 주세요.',
        expectedResult: '고객사 목록 화면이 보여야 합니다.',
      },
      {
        screen: '/dashboard/clients',
        instruction: '화면 우측 상단의 고객사 추가 버튼을 눌러 주세요.',
        expectedResult: '새 고객사 입력 영역이 자연스럽게 열려야 합니다.',
      },
      {
        screen: '/dashboard/clients',
        instruction:
          '새 고객사 입력 영역에서 테스트 고객사 이름, 담당자, 이메일 등 필수 정보를 입력해 저장한 뒤, 방금 추가한 테스트 고객사가 보이는지 확인해 주세요.',
        expectedResult: '필수 입력값과 저장 결과가 이해되고, 다음 설정 작업으로 이어져야 합니다.',
      },
    ],
    expectedResult: [
      '테스터가 새 고객사를 추가하고 저장 결과를 확인할 수 있습니다.',
      '고객사 추가 후 상세, CC 그룹, 메일 요청 같은 다음 작업으로 이어지는 흐름이 이해됩니다.',
    ],
    feedbackPrompts: [
      '고객사 추가에 꼭 필요한 정보가 빠져 있나요?',
      '저장 후 다음에 무엇을 해야 하는지 자연스럽게 보이나요?',
    ],
  },
  {
    id: 'clients',
    title: '고객사 workspace',
    purpose: '고객사 화면이 설정, 맥락, 이력 확인의 중심으로 보이는지 확인합니다.',
    operatorSetup: [
      '직전 고객사 추가 시나리오에서 만든 테스트 고객사를 사용합니다.',
      '가능하면 담당자, CC 그룹, 요청/업로드/검토 이력이 있는 고객사를 사용합니다.',
    ],
    steps: [
      {
        screen: '/dashboard/clients',
        instruction: '고객사 목록으로 돌아와 방금 추가한 테스트 고객사가 보이는지 확인해 주세요.',
        expectedResult: '고객사 목록과 상태 컬럼이 보입니다.',
      },
      {
        screen: '/dashboard/clients',
        instruction: '해당 고객사의 담당자, 최근 요청, 업로드, 검토, 급여, CC 컬럼을 확인하세요.',
        expectedResult: '값이 비어 있거나 대기 상태여도 각 컬럼이 고객사별 상태를 스캔하는 데 도움이 되어야 합니다.',
      },
      {
        screen: '/dashboard/clients/[id]',
        instruction: '테스트 고객사 하나를 눌러 상세 화면에서 기본 정보, 요청 맥락, 설정, 이력을 확인하세요.',
        expectedResult: '고객사 상세가 발송/검토 실행 화면이 아니라 설정과 맥락의 허브로 보여야 합니다.',
      },
    ],
    expectedResult: [
      '고객사 목록은 상태 스캔에 도움이 됩니다.',
      '고객사 상세는 설정과 이력을 확인하는 곳으로 이해됩니다.',
    ],
    feedbackPrompts: [
      '고객사 화면이 너무 많은 일을 하려고 하나요?',
      '관리자와 일반 직원이 다르게 봐야 할 정보가 있나요?',
    ],
  },
  {
    id: 'cc-groups',
    title: '고객사 CC 그룹',
    purpose: '반복되는 참조자 관리가 실제 일반/급여 요청 업무에 맞는지 확인합니다.',
    operatorSetup: [
      '테스트 고객사만 사용합니다.',
      'CC 그룹을 만들거나 수정할 경우 통제된 테스트 이메일만 사용합니다.',
    ],
    steps: [
      {
        screen: '/dashboard/clients/[id]',
        instruction: '테스트 고객사 상세 화면에서 참조 그룹 영역을 찾아 주세요.',
        expectedResult: '일반, 급여, 공통 목적 구분이 보여야 합니다.',
      },
      {
        screen: '/dashboard/clients/[id]',
        instruction: '우측 참조 그룹 영역에서 참조 그룹 추가를 눌러 테스트 참조 그룹을 추가해 보세요.',
        expectedResult: '참조 그룹 추가 입력 영역이 열리고 저장 흐름이 이해되어야 합니다.',
      },
      {
        screen: '/dashboard/clients/[id]',
        instruction: '실제 고객사라면 참조 그룹이 몇 개 정도 필요할지 메모해 주세요.',
        expectedResult: '일반/급여/공통 구분이 실무에 맞는지 의견을 남길 수 있어야 합니다.',
      },
    ],
    expectedResult: [
      '테스터가 CC 그룹의 목적을 이해할 수 있습니다.',
      '일반 요청과 급여 요청의 참조자 차이를 판단할 수 있습니다.',
    ],
    feedbackPrompts: [
      '고객사별로 여러 CC 그룹이 필요한가요?',
      '노무사, 인사팀, 외부 담당자를 별도로 다뤄야 하나요?',
    ],
  },
  {
    id: 'mail',
    title: '메일 일괄 발송',
    purpose: '대량 요청 메일 작성, 미리보기, 발송 결과 흐름이 안전하고 이해되는지 확인합니다.',
    operatorSetup: [
      '실제 발송 가능 여부와 테스트 수신함을 먼저 확정합니다.',
      '선택 가능한 테스트 고객사를 확정합니다.',
    ],
    steps: [
      {
        screen: '/dashboard/emails',
        instruction: '왼쪽 메뉴에서 메일을 눌러 주세요.',
        expectedResult: '일괄 발송 화면이 보입니다.',
      },
      {
        screen: '/dashboard/emails',
        instruction: '일괄 발송 탭에서 테스트 고객사만 선택하세요.',
        expectedResult: '실제 고객사로 발송될 위험 없이 테스트 대상만 선택해야 합니다.',
      },
      {
        screen: '/dashboard/emails',
        instruction: '미리보기에서 고객명, 담당자명, 회계기간, 제출기한, 업로드 링크가 자연스럽게 채워지는지 확인하세요.',
        expectedResult: '발송 전 개인화 결과를 충분히 확인할 수 있어야 합니다.',
      },
      {
        screen: '/dashboard/emails',
        instruction: '테스트 수신함으로 확인 가능한 경우에만 발송하고, 발송 결과와 발송 이력을 확인하세요.',
        expectedResult: '성공/실패가 고객사별로 이해되어야 합니다.',
      },
    ],
    expectedResult: [
      '테스터가 대상, 미리보기, 최종 발송의 안전 장치를 이해합니다.',
      '발송 결과와 이력 탭에서 결과를 확인할 수 있습니다.',
    ],
    feedbackPrompts: [
      '발송 전 확인이 충분히 안전한가요?',
      '많은 고객사를 보낼 때 진행률이 필요해 보이나요?',
    ],
  },
  {
    id: 'upload',
    title: '업로드 링크와 고객 제출',
    purpose: '고객사가 직원 로그인 없이 업로드 링크로 자료를 제출할 수 있는지 확인합니다.',
    operatorSetup: [
      '테스트 메일함에 안전한 업로드 링크가 있어야 합니다.',
      '샘플 파일만 준비합니다.',
    ],
    steps: [
      {
        screen: '/upload/[token]',
        instruction: '테스트 메일함에서 업로드 링크를 열어 주세요.',
        expectedResult: '직원 로그인 화면이 아니라 고객용 업로드 화면이 보여야 합니다.',
      },
      {
        screen: '/upload/[token]',
        instruction: '샘플 파일만 업로드하고 제출해 주세요.',
        expectedResult: '제출 완료 메시지가 고객 입장에서 이해되어야 합니다.',
      },
      {
        screen: '/upload/[token]',
        instruction: '고객 화면에 내부 AI 로그, raw token, storage key 같은 정보가 보이지 않는지 확인하세요.',
        expectedResult: '고객에게 내부 정보가 노출되지 않아야 합니다.',
      },
    ],
    expectedResult: [
      '테스터가 고객 입장에서 샘플 파일을 제출할 수 있습니다.',
      '업로드 포털은 내부 정보를 노출하지 않습니다.',
    ],
    feedbackPrompts: [
      '고객이 어떤 자료를 올려야 하는지 충분히 알 수 있나요?',
      '제출 후 다음 상태가 명확한가요?',
    ],
  },
  {
    id: 'reviews',
    title: '자료 검토 workspace',
    purpose: '일반 자료 제출 상태와 보충 요청 승인 큐가 한 화면에서 이해되는지 확인합니다.',
    operatorSetup: [
      '일반 자료 세션이 있으면 좋습니다.',
      '자료 충족 세션은 완료 감사메일 발송까지, 자료 부족 세션은 보충 요청 승인까지 나눠 봅니다.',
      '승인/발송 action은 운영자가 허용한 테스트 초안에서만 사용합니다.',
    ],
    steps: [
      {
        screen: '/dashboard/reviews',
        instruction: '왼쪽 메뉴에서 자료 검토를 눌러 주세요.',
        expectedResult: '상단 숫자, 세션 목록, 상세 영역, 승인 큐가 보입니다.',
      },
      {
        screen: '/dashboard/reviews',
        instruction: '일반 자료 세션 하나를 선택해 요청자료 기준, 업로드 파일, 승인 큐를 확인하세요.',
        expectedResult: '누락/부적합/확인 필요 상태가 이해되어야 합니다.',
      },
      {
        screen: '/dashboard/reviews',
        instruction: '검토 가능 또는 자료 충족 세션이 있으면 다운로드와 완료 감사메일 미리보기가 구분되는지 확인하세요.',
        expectedResult: '부합 자료 다운로드와 완료 감사메일 미리보기가 서로 다른 동작으로 명확히 구분되어야 합니다.',
      },
      {
        screen: '/dashboard/reviews',
        instruction: '테스트 수신함으로 확인 가능한 초안에서만 승인/발송 버튼을 확인하세요.',
        expectedResult: '자료 검토 화면이 보충 요청 검토 위치로 자연스럽게 느껴져야 합니다.',
      },
    ],
    expectedResult: [
      '테스터가 어떤 자료가 부족하거나 확인 필요한지 이해합니다.',
      '보충 요청 초안 검토 위치가 자연스럽게 보입니다.',
    ],
    feedbackPrompts: [
      '승인 큐가 이 화면에 있는 것이 맞나요?',
      '급여 데이터가 일반 자료 검토와 잘 분리되어 있나요?',
    ],
  },
  {
    id: 'calendar',
    title: '세무 일정 캘린더',
    purpose: '세무 일정 중심 캘린더가 실제 업무 흐름과 맞는지 확인합니다.',
    operatorSetup: [
      '현재 캘린더는 curated seed와 기존 요청/업로드/메일 상태를 함께 봅니다.',
      '세무 일정 메일 자동화는 아직 구현되지 않았음을 안내합니다.',
    ],
    steps: [
      {
        screen: '/dashboard/calendar',
        instruction: '왼쪽 메뉴에서 캘린더를 눌러 주세요.',
        expectedResult: '월간 세무 일정과 업무 상태가 함께 보여야 합니다.',
      },
      {
        screen: '/dashboard/calendar',
        instruction: '일정이 많은 날짜를 눌러 상세 정보가 보기 편한지 확인하세요.',
        expectedResult: '많은 고객사를 관리할 때 화면이 과밀해질지 판단할 수 있어야 합니다.',
      },
      {
        screen: '/dashboard/calendar',
        instruction: '자료 요청 메일을 며칠 전에 자동 생성하면 좋을지 메모해 주세요.',
        expectedResult: '자동화 필요 지점이 후속 결정으로 남아야 합니다.',
      },
    ],
    expectedResult: [
      '세무 일정과 관련 업무 상태를 월간 보기에서 확인할 수 있습니다.',
      '자동화가 필요한 영역과 아직 결정되지 않은 영역이 구분됩니다.',
    ],
    feedbackPrompts: [
      '세무 일정이 많을 때 달력이 너무 복잡해질까요?',
      '완료 기준은 메일 발송, 업로드, 검토 완료, 신고 완료 중 무엇이어야 하나요?',
    ],
  },
  {
    id: 'payroll',
    title: '급여정산 workspace',
    purpose: '급여 업무가 일반 자료 검토와 분리되어 보이는지 확인합니다.',
    operatorSetup: [
      '가능하면 payroll 세션을 준비합니다.',
      '엑셀 다운로드를 테스트할 경우 합성 급여 데이터만 사용합니다.',
    ],
    steps: [
      {
        screen: '/dashboard/payroll',
        instruction: '왼쪽 메뉴에서 급여정산을 눌러 주세요.',
        expectedResult: '급여 요청 목록과 자동 추출 상태가 보입니다.',
      },
      {
        screen: '/dashboard/payroll',
        instruction: '급여 세션에서 적합/부적합 표시와 부적합 사유가 이해되는지 확인하세요.',
        expectedResult: '급여 row 상태가 일반 자료 검토와 섞이지 않아야 합니다.',
      },
      {
        screen: '/dashboard/payroll',
        instruction: '모든 row가 적합인 세션에서 부합 원자료 다운로드와 결과 엑셀 다운로드가 구분되는지 확인하세요.',
        expectedResult: '부합 원자료는 고객사가 업로드한 원본 패키지이고, 결과 엑셀은 JARYO가 작성한 출력 파일임이 구분되어야 합니다.',
      },
      {
        screen: '/dashboard/payroll',
        instruction: '부적합 row가 있는 세션에서 두 다운로드가 차단되는지 확인하세요.',
        expectedResult: '부적합 자료를 그대로 내려받거나 출력하지 않도록 담당자에게 차단 사유가 보여야 합니다.',
      },
    ],
    expectedResult: [
      '급여정산은 계산/신고 시스템이 아니라 자료 정리 workspace로 이해됩니다.',
      '엑셀 output과 화면 표 미리보기의 유용성을 판단할 수 있습니다.',
    ],
    feedbackPrompts: [
      '급여정산 화면에서 빠진 컬럼이 있나요?',
      '세무대리인의 소통 workspace로 위치가 맞나요?',
    ],
  },
  {
    id: 'cross-screen',
    title: '전체 화면 연결 흐름',
    purpose: 'JARYO의 주요 화면들이 하나의 업무 흐름으로 이어지는지 확인합니다.',
    operatorSetup: [
      '가능하면 같은 테스트 고객사와 같은 요청 흐름을 사용합니다.',
      '실제 발송이 허용되지 않으면 preview/confirmation까지만 봅니다.',
    ],
    steps: [
      {
        screen: '/dashboard',
        instruction: '왼쪽 메뉴에서 진행 현황을 눌러 현재 업무 요약을 본 뒤, 고객사 화면으로 이동해 주세요.',
        expectedResult: '요약에서 고객사 맥락으로 자연스럽게 이동해야 합니다.',
      },
      {
        screen: '/dashboard/emails',
        instruction: '메일 화면에서 요청 작성 흐름이나 기존 요청 상태를 확인하세요.',
        expectedResult: '메일 화면이 고객사 설정과 연결되어야 합니다.',
      },
      {
        screen: '/dashboard/reviews',
        instruction: '자료 검토와 캘린더에서 같은 업무 상태가 이어져 보이는지 확인하세요.',
        expectedResult: '자료 제출, 검토, 일정 상태가 서로 다른 말처럼 보이지 않아야 합니다.',
      },
      {
        screen: '/dashboard',
        instruction: '다시 진행 현황으로 돌아와 상태 신호가 자연스럽게 반영되는지 확인하세요.',
        expectedResult: '진행 현황이 전체 흐름의 요약 화면으로 느껴져야 합니다.',
      },
    ],
    expectedResult: [
      '사용자가 요약, 고객사 맥락, 메일, 업로드, 자료 검토, 캘린더를 잃지 않고 오갈 수 있습니다.',
      '화면 경계가 분리되어 있지만 단절되어 보이지 않습니다.',
    ],
    feedbackPrompts: [
      '화면 간 링크가 부족한 곳이 있나요?',
      '어떤 화면이 너무 많은 역할을 하고 있나요?',
    ],
  },
]
