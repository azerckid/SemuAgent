export type UsageHelpDocEntry = {
  relativePath: string
  sourceLabel: string
}

export const USAGE_HELP_DOCS_ALLOWLIST: UsageHelpDocEntry[] = [
  {
    relativePath: 'docs/01_Concept_Design/01_MVP_PRODUCT_BASELINE.md',
    sourceLabel: 'JARYO 제품 기준',
  },
  {
    relativePath: 'docs/02_UI_Screens/01_MVP_UX_BASELINE.md',
    sourceLabel: 'JARYO 화면·UX 기준',
  },
  {
    relativePath: 'docs/02_UI_Screens/15_WORKFLOW_BASED_NAVIGATION_UX.md',
    sourceLabel: '업무 흐름·메뉴 안내',
  },
  {
    relativePath: 'docs/02_UI_Screens/17_AI_USAGE_HELP_ASSISTANT_UX.md',
    sourceLabel: 'JARYO 사용 안내',
  },
  {
    relativePath: 'docs/03_Technical_Specs/01_MVP_TECHNICAL_BASELINE.md',
    sourceLabel: 'JARYO 기술·처리 흐름',
  },
  {
    relativePath: 'docs/04_Logic_Progress/12_AI_CONCIERGE_DECISION_NOTE.md',
    sourceLabel: 'JARYO 사용 안내 범위',
  },
  {
    relativePath: 'docs/04_Logic_Progress/07_DASHBOARD_OVERVIEW_WORK_ORDER.md',
    sourceLabel: '진행 현황 화면',
  },
  {
    relativePath: 'docs/04_Logic_Progress/11_CLIENT_WORKSPACE_WORK_ORDER.md',
    sourceLabel: '고객사 관리 화면',
  },
  {
    relativePath: 'docs/04_Logic_Progress/03_MAIL_BULK_SEND_WORK_ORDER.md',
    sourceLabel: '메일 요청 화면',
  },
  {
    relativePath: 'docs/04_Logic_Progress/09_REVIEW_WORKSPACE_WORK_ORDER.md',
    sourceLabel: '자료 검토 화면',
  },
  {
    relativePath: 'docs/04_Logic_Progress/06_PAYROLL_WORKSPACE_WORK_ORDER.md',
    sourceLabel: '급여정산 workspace',
  },
  {
    relativePath: 'docs/04_Logic_Progress/49_REVIEW_SUBMISSION_STATUS_EXCEPTION_UI_CORRECTION.md',
    sourceLabel: '자료 검토 제출 자료 현황',
  },
  {
    relativePath: 'docs/04_Logic_Progress/52_CLIENT_LIST_SLIMDOWN_WORK_ORDER.md',
    sourceLabel: '고객사 목록 화면',
  },
]
