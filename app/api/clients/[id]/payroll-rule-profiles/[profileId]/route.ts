import { NextResponse } from 'next/server'
import {
  getClientPayrollRuleProfile,
  listClientPayrollRuleProfileSources,
  readProfileJson,
} from '@/lib/payroll/rule-profile-registry'
import {
  countApprovalBlockingConflicts,
  countNeedsReviewRows,
} from '@/lib/payroll/rule-profile-lifecycle'
import { requirePayrollRuleProfileStaffAccess } from '@/lib/payroll/rule-profile-staff-access'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; profileId: string }> },
) {
  try {
    const { id: clientId, profileId } = await params
    const access = await requirePayrollRuleProfileStaffAccess(clientId)

    const row = await getClientPayrollRuleProfile({
      tenantId: access.tenantId,
      clientId: access.clientId,
      profileId,
    })
    if (!row) {
      return NextResponse.json({ error: '급여기준 프로필을 찾을 수 없습니다' }, { status: 404 })
    }

    const profile = readProfileJson(row)
    const sources = await listClientPayrollRuleProfileSources({
      tenantId: access.tenantId,
      clientId: access.clientId,
      profileId,
    })

    return NextResponse.json({
      id: row.id,
      status: row.status,
      version: row.version,
      effectiveFrom: row.effectiveFrom,
      effectiveTo: row.effectiveTo,
      approvedAt: row.approvedAt,
      approvedByStaffId: row.approvedByStaffId,
      approvalNotes: row.approvalNotes,
      createdAt: row.createdAt,
      profile,
      sources: sources.map((source) => ({
        id: source.id,
        sourceType: source.sourceType,
        sourceFileId: source.sourceFileId,
        sourceHash: source.sourceHash,
        securityLane: source.securityLane,
      })),
      summary: profile
        ? {
          needsReviewCount: countNeedsReviewRows(profile),
          conflictRowCount: countApprovalBlockingConflicts(profile),
          teePending: sources.some((source) => source.securityLane === 'tee_required'),
        }
        : null,
    })
  } catch (err) {
    if (err instanceof Error && err.message === 'NOT_FOUND') {
      return NextResponse.json({ error: '고객사를 찾을 수 없습니다' }, { status: 404 })
    }
    if (err instanceof Error && err.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (err instanceof Error && err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 })
  }
}
