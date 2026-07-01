# Payroll Adaptive Structuring Fixtures

These files are synthetic QA fixtures for Payroll Adaptive Data Structuring Slice 7.

They contain no real employee, resident number, account, phone, customer, or payroll data.

## Files

| File | Purpose | Expected behavior |
|---|---|---|
| `unknown-valid-payroll-2026-06.xlsx` | New but valid payroll source format | `구조화 제안` should be eligible and should produce candidate mappings/sample rows. |
| `metadata-only-company-profile.xlsx` | Company metadata only | Should be rejected or shown as ineligible for payroll row proposal. |
| `policy-only-payroll-rules.xlsx` | Payroll policy text only | Should not create payroll rows or payable amounts. |
| `result-only-payroll-summary.xlsx` | Final summary/result table only | Should be treated as verification/reference, not source rows. |
| `missing-identity-payroll.xlsx` | Payroll-like rows without employee identity | Proposal may explain the issue; approved apply path must block rows. |
| `missing-period-payroll.xlsx` | Payroll-like rows without payment period | Proposal may explain the issue; approved apply path must block rows. |
| `missing-deduction-basis-payroll.xlsx` | Identity/period/gross pay present, no tax/4대보험/공제 basis columns | Rows may be previewed; deduction fields must stay `자료없음`, not default to 0. |
| `similar-different-payroll.xlsx` | Similar but different workbook after approval | Approved model signature should fail closed or require a separate proposal. |
| `malformed-workbook.txt` | Non-XLSX parsing guard | Upload/parsing or engine matching should fail closed and produce no payroll rows. |

`malformed-workbook.txt` may not appear in the browser file picker by default — the
direct-upload `accept` attribute only lists PDF/XLSX/XLS/image MIME types
(`staff-direct-upload-workspace.tsx`). Switch the OS file picker to "All Files" or test
via direct API call to exercise server-side parsing fail-closed behavior.

## Regenerate

```bash
node scripts/qa/create-payroll-adaptive-structuring-fixtures.mjs
```
