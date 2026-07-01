'use client'

import { useMemo, useState } from 'react'
import { TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  ClientWorkContext,
  buildRecentRequestItems,
  type PayrollDerivedStatus,
  type ReviewDerivedStatus,
} from './client-work-context'
import { ClientCcGroupsPanel } from './client-cc-groups-panel'
import { ClientDocumentsPanel } from './client-documents-panel'
import {
  ClientPayrollLegalBasisPanel,
  PAYROLL_LEGAL_BASIS_ROWS,
} from './client-payroll-legal-basis-panel'
import {
  ClientPayrollRuleProfilePanel,
  type PayrollRuleProfileView,
} from './client-payroll-rule-profile-panel'
import type {
  ClientDetailCcGroup,
  ClientDetailDocument,
  ClientDetailEvent,
  ClientDetailSession,
} from './client-detail-types'

type Tab = 'requests' | 'cc' | 'documents' | 'payrollRule' | 'payrollLegalBasis'

export function ClientDetailTabs({
  clientId,
  events,
  sessions,
  reviewStatusBySessionId,
  payrollStatusBySessionId,
  ccGroups,
  documents,
  payrollRuleProfile,
  initialTab,
}: {
  clientId: string
  events: ClientDetailEvent[]
  sessions: ClientDetailSession[]
  reviewStatusBySessionId: Record<string, ReviewDerivedStatus>
  payrollStatusBySessionId: Record<string, PayrollDerivedStatus>
  ccGroups: ClientDetailCcGroup[]
  documents: ClientDetailDocument[]
  payrollRuleProfile: PayrollRuleProfileView
  initialTab?: string
}) {
  const KNOWN_TABS: Tab[] = ['requests', 'cc', 'documents', 'payrollRule', 'payrollLegalBasis']
  const [tab, setTab] = useState<Tab>(
    KNOWN_TABS.includes(initialTab as Tab) ? (initialTab as Tab) : 'requests',
  )

  const recentCount = useMemo(
    () =>
      buildRecentRequestItems({
        clientId,
        events,
        sessions,
        reviewStatusBySessionId,
        payrollStatusBySessionId,
      }).length,
    [clientId, events, sessions, reviewStatusBySessionId, payrollStatusBySessionId],
  )

  const TABS: { key: Tab; label: string; count: number }[] = [
    { key: 'requests', label: '최근 요청', count: recentCount },
    { key: 'cc', label: '참조 그룹', count: ccGroups.length },
    { key: 'documents', label: '고객사 문서', count: documents.length },
    { key: 'payrollRule', label: '사내급여기준', count: payrollRuleProfile.total },
    { key: 'payrollLegalBasis', label: '법적기준', count: PAYROLL_LEGAL_BASIS_ROWS.length },
  ]

  return (
    <div className="space-y-4">
      <TabsList>
        {TABS.map((item) => (
          <TabsTrigger
            key={item.key}
            active={tab === item.key}
            onClick={() => setTab(item.key)}
          >
            {item.label}
            <span className="ml-1 rounded-full bg-muted px-1.5 text-[11px] font-semibold text-muted-foreground">
              {item.count}
            </span>
          </TabsTrigger>
        ))}
      </TabsList>

      {tab === 'requests' && (
        <ClientWorkContext
          clientId={clientId}
          events={events}
          sessions={sessions}
          reviewStatusBySessionId={reviewStatusBySessionId}
          payrollStatusBySessionId={payrollStatusBySessionId}
        />
      )}

      {tab === 'cc' && (
        <ClientCcGroupsPanel clientId={clientId} groups={ccGroups} defaultExpanded />
      )}

      {tab === 'documents' && (
        <ClientDocumentsPanel clientId={clientId} documents={documents} defaultExpanded />
      )}

      {tab === 'payrollRule' && <ClientPayrollRuleProfilePanel clientId={clientId} view={payrollRuleProfile} />}
      {tab === 'payrollLegalBasis' && <ClientPayrollLegalBasisPanel />}
    </div>
  )
}
