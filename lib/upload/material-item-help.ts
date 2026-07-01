/**
 * 기장 자료 업로드 포털: 자료 항목별 "어디서 받나요?" 안내.
 *
 * 체크리스트 항목명은 사무소(테넌트)가 자유롭게 정하므로 고정 ID가 없다.
 * 그래서 문의가 잦은 자료 종류를 항목명 키워드로 best-effort 매칭해 단계
 * 안내를 돌려준다. 매칭되는 안내가 없으면 null을 돌려주고, 그 항목에는
 * 안내를 노출하지 않는다(모든 항목에 억지로 붙이지 않는다 — UX 문서 5.4).
 *
 * 순수 함수로 분리해 단위 테스트 대상으로 둔다.
 */

export interface MaterialItemHelp {
  title: string
  steps: string[]
  note?: string
}

interface HelpRule {
  keywords: string[]
  help: MaterialItemHelp
}

const HELP_RULES: HelpRule[] = [
  {
    keywords: ['통장', '계좌', '거래내역', '은행'],
    help: {
      title: '통장 거래내역 받는 법',
      steps: [
        '은행 홈페이지·앱에 로그인합니다.',
        '거래내역 조회에서 요청 기간을 선택합니다.',
        'Excel 또는 PDF로 내보낸 뒤 업로드합니다.',
      ],
      note: '계좌가 여러 개면 계좌별로 각각 올려 주세요.',
    },
  },
  {
    keywords: ['카드'],
    help: {
      title: '카드 사용내역 받는 법',
      steps: [
        '카드사 홈페이지·앱에 로그인합니다.',
        '이용내역 조회에서 요청 기간을 선택합니다.',
        'Excel 또는 PDF로 저장한 뒤 업로드합니다.',
      ],
      note: '법인카드가 여러 장이면 카드별로 각각 올려 주세요.',
    },
  },
  {
    keywords: ['세금계산서', '계산서'],
    help: {
      title: '세금계산서 내역 받는 법',
      steps: [
        '홈택스에 로그인합니다.',
        '전자세금계산서 조회에서 요청 기간을 선택합니다.',
        '합계/목록을 Excel 또는 PDF로 내려받아 업로드합니다.',
      ],
    },
  },
  {
    keywords: ['현금영수증'],
    help: {
      title: '현금영수증 내역 받는 법',
      steps: [
        '홈택스에 로그인합니다.',
        '현금영수증 발행/수취 내역에서 요청 기간을 선택합니다.',
        'Excel 또는 PDF로 내려받아 업로드합니다.',
      ],
    },
  },
  {
    keywords: ['온라인', 'pg', '정산', '스마트스토어', '오픈마켓', '네이버페이', '배달'],
    help: {
      title: '온라인 매출 / PG 정산자료 받는 법',
      steps: [
        '판매 채널(스마트스토어·오픈마켓·배달앱 등) 관리자에 로그인합니다.',
        '정산 내역에서 요청 기간을 선택합니다.',
        'Excel 또는 PDF로 내려받아 업로드합니다.',
      ],
      note: '채널이 여러 개면 채널별로 각각 올려 주세요.',
    },
  },
]

export function getMaterialItemHelp(itemName: string): MaterialItemHelp | null {
  const normalized = itemName.toLowerCase()
  for (const rule of HELP_RULES) {
    if (rule.keywords.some((keyword) => normalized.includes(keyword))) {
      return rule.help
    }
  }
  return null
}
