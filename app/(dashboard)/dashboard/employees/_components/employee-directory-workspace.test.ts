import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (relative: string) => readFileSync(new URL(relative, import.meta.url), 'utf8')

const workspaceSource = read('./employee-directory-workspace.tsx')
const tableSource = read('./employee-table.tsx')
const actionsSource = read('./employee-actions.tsx')
const createRouteSource = read('../../../../api/employees/route.ts')
const patchRouteSource = read('../../../../api/employees/[employeeId]/route.ts')
const validationsSource = read('../../../../../lib/validations/employee-directory.ts')

describe('employee directory workspace preview contract', () => {
  it('renders stats, table, and personal-data boundary note', () => {
    expect(workspaceSource).toContain('재직')
    expect(workspaceSource).toContain('급여 대상')
    expect(workspaceSource).toContain('4대보험 확인 필요')
    expect(workspaceSource).toContain('퇴사')
    expect(workspaceSource).toContain('EmployeeTable')
    expect(workspaceSource).toContain('주민등록번호·계좌번호·전화번호 원문은 저장하지 않습니다')
  })

  it('provides search + status/eligibility filters and edit affordance', () => {
    expect(tableSource).toContain('이름·사번·부서로 검색')
    expect(tableSource).toContain('EmployeeEditorButton')
    expect(tableSource).toContain('최근 급여')
  })

  it('add/edit editor targets the employee API and hides personal-data fields', () => {
    expect(actionsSource).toContain("'/api/employees'")
    expect(actionsSource).toContain('/api/employees/${employee!.id}')
    for (const banned of ['주민등록번호를 입력', 'residentNumber', 'accountNumber', 'phoneNumber']) {
      expect(actionsSource).not.toContain(banned)
    }
  })
})

describe('employee API guards', () => {
  it('create route validates, checks staff, and scopes by tenant', () => {
    expect(createRouteSource).toContain('requireTenantSession')
    expect(createRouteSource).toContain('getActiveStaffForUser')
    expect(createRouteSource).toContain('employeeCreateSchema.safeParse(await req.json())')
    expect(createRouteSource).toContain('eq(client.tenantId, tenantId)')
    expect(createRouteSource).toContain('status: 409')
  })

  it('patch route validates, scopes by tenant, and guards duplicate code', () => {
    expect(patchRouteSource).toContain('requireTenantSession')
    expect(patchRouteSource).toContain('employeeUpdateSchema.safeParse(await req.json())')
    expect(patchRouteSource).toContain('eq(employeeProfile.tenantId, tenantId)')
    expect(patchRouteSource).toContain('status: 409')
  })

  it('validation schema does not expose raw personal-data fields', () => {
    for (const banned of ['residentNumber', 'accountNumber', 'phoneNumber', 'rrn']) {
      expect(validationsSource).not.toContain(banned)
    }
  })
})
