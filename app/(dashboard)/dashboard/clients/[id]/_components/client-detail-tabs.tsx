'use client'

import { useState } from 'react'
import { TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ClientDocumentsPanel } from './client-documents-panel'
import {
  ClientPayrollLegalBasisPanel,
  PAYROLL_LEGAL_BASIS_ROWS,
} from './client-payroll-legal-basis-panel'
import {
  ClientPayrollRuleProfilePanel,
  type PayrollRuleProfileView,
} from './client-payroll-rule-profile-panel'
import type { ClientDetailDocument } from './client-detail-types'

type Tab = 'documents' | 'payrollRule' | 'payrollLegalBasis'

export function ClientDetailTabs({
  clientId,
  documents,
  payrollRuleProfile,
  initialTab,
}: {
  clientId: string
  documents: ClientDetailDocument[]
  payrollRuleProfile: PayrollRuleProfileView
  initialTab?: string
}) {
  const KNOWN_TABS: Tab[] = ['documents', 'payrollRule', 'payrollLegalBasis']
  const [tab, setTab] = useState<Tab>(
    KNOWN_TABS.includes(initialTab as Tab) ? (initialTab as Tab) : 'documents',
  )

  const TABS: { key: Tab; label: string; count: number }[] = [
    { key: 'documents', label: '사업장 문서', count: documents.length },
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

      {tab === 'documents' && (
        <ClientDocumentsPanel clientId={clientId} documents={documents} defaultExpanded />
      )}

      {tab === 'payrollRule' && <ClientPayrollRuleProfilePanel clientId={clientId} view={payrollRuleProfile} />}
      {tab === 'payrollLegalBasis' && <ClientPayrollLegalBasisPanel />}
    </div>
  )
}
