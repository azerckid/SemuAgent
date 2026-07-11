# JC-034 — GIWA Handoff Package Scope Gate
> Created: 2026-07-07 04:00 KST
> Last Updated: 2026-07-10 16:01 KST

## 0. Flow Status

```text
[Flow]
현재: Filing Path 2 — 세무회계사무소 연결 (자료기와 / JARYO-GIWA)
Gate: Path 1 세목 확대(홈택스 양식 기입) 안정 전 코드 착수 금지
완료: UI-First Gate · Pre-Code Brief
다음: Path 1 원천세 등 세목 확대 후 ZIP Export 구현 ([Path 1 Roadmap](./36_PATH1_FORM_FILL_ROADMAP.md))
v1 범위: ZIP Export only (API·실시간 연동 없음)
```

## 1. Purpose

JC-034는 **Filing Path 2** 를 구현한다 ([Product Baseline §3](../01_Concept_Design/01_PRODUCT_BASELINE.md)).
회사가 확정한 신고 준비 데이터를 **기존 수임 세무사무소**가 **자료기와(JARYO-GIWA)** 에서
검토·신고할 수 있는 **구조화 handoff 패키지**로 보낸다.

SemuAgent는 홈택스에 제출하지 않는다. 사무소는 위하고·세무사랑 등 **검정 SW**로
전자신고 파일을 만들고 대리 제출한다.

## 2. Product Decisions (2026-07-07)

| Decision | Choice |
|---|---|
| Filing Path | **Path 2** — 세무회계사무소 연결 (자료기와) |
| Path 1 (parallel) | 양식 파일 + 홈택스 안내 — JC-030 Path 1 · JC-013 |
| Path 3 (excluded) | 인증·암호화 파일 — 현재 제품 범위 밖 |
| v1 delivery | **ZIP Export** (manual upload to firm) |
| v2 delivery | Invitation link, API push, receipt sync |
| Tax-agent marketplace | **Excluded** |
| NTS certification on SemuAgent | **Not required** for Path 2 |

## 3. v1 Package Contents (candidate)

ZIP root must include at minimum:

1. **`manifest.json`** — Zod-validated metadata: tenantId, businessEntityId, period keys,
   tax tracks included, generation timestamp, SemuAgent version, validation summary.
2. **Track sections** — one or more of:
   - `withholding/` — 원천세 집계 (from `lib/filing-support/summary`)
   - `vat/` — 부가세 초안 (from `lib/vat/summary`)
   - `payment-statements/` — JC-024 간이지급·연말정산 준비 데이터
   - `local-income-tax/` — JC-027 원천 특별징수분
   - `business-status/` — JC-028 (if applicable)
3. **Optional plain SC attachment** — from JC-030 Validation / Path 1 output (간이지급 v1),
   for firm cross-check; not positioned as Path 3 certified upload file.
4. **`README-handoff.txt`** — responsibility boundary, what the firm should do next,
   what SemuAgent did not certify.

Format inside ZIP: **Excel and/or CSV** per track (human + GIWA staff friendly).
JSON mirrors allowed for machine import in v2.

## 4. PII And Consent

- Export includes only data the company already entered or approved in SemuAgent.
- Resident registration numbers for wage statements: follow [JC-030 PII Policy](./27_JC030_EFILING_FILE_PII_POLICY.md)
  — one-time input at export time if needed; not persisted server-side after export completes.
- User must confirm handoff scope and recipient firm name (or "manual delivery") before download.
- Audit log: who exported, when, which period, which tracks (no raw PII in logs).

## 5. JARYO-GIWA Reception (v1)

v1 does **not** require a new SemuAgent API on GIWA.

Expected firm workflow:

1. Company downloads ZIP from SemuAgent.
2. Company or firm staff uploads files through **existing GIWA client upload/review**
   surfaces (paid pilot scope: material request, upload, review, payroll Excel draft).
3. Firm staff enters or imports into certified SW and files on Hometax.

GIWA-side ingest automation is **v2** after field compatibility is validated in the field.

## 6. Relationship To JC-030

| JC-030 layer | Role in JC-034 (Path 2) |
|---|---|
| **Validation** | Required before ZIP assembly |
| **Path 1 output** | Optional attachment inside ZIP for firm cross-check |
| **Path 3** | Not used in Path 2 v1 |

JC-034 must reuse `lib/efiling-simplified-wage` validation where 간이지급 is included.

## 7. Blocking Decisions Before Implementation

- [ ] UI-First Gate: Path 1a 베타 이후 신규 handoff export Preview로 재승인. 기존 `08_filing_preparation.html` 패널은 Path 1-only preview로 supersede.
- [x] Pre-Code Brief: [35_JC034_GIWA_HANDOFF_PACKAGE_PRE_CODE_BRIEF.md](./35_JC034_GIWA_HANDOFF_PACKAGE_PRE_CODE_BRIEF.md) — manifest Zod, per-track CSV, API·audit (2026-07-07)
- [x] First tax-type scope for v1 ZIP: **간이지급명세서 반기** + 원천세·부가세 summary (minimum)
- [ ] Copy review: no `대행`, `알선`, `국세청 검증 완료` claims
- [ ] QA scenarios for tenant isolation, empty tracks, validation failure blocking export

## 8. Non-Goals (v1)

- Real-time SemuAgent ↔ GIWA API sync
- In-app tax-firm discovery or referral fees
- Hometax login, certificate storage, or auto-submit
- Replacing firm's certified e-filing software
- NTS fcrypt / 적합성 검정 on SemuAgent

## 9. Related Documents

- **Concept_Design**: [Product Baseline](../01_Concept_Design/01_PRODUCT_BASELINE.md)
- **Concept_Design**: [Filing Preparation Pipeline](../01_Concept_Design/02_FILING_PREPARATION_PIPELINE.md)
- **Technical_Specs**: [E-Filing Scope Gate](./19_EFILING_FILE_GENERATION_SCOPE_GATE.md) — JC-030 Validation / Path 1
- **Technical_Specs**: [JC-030 PII Policy](./27_JC030_EFILING_FILE_PII_POLICY.md)
- **Technical_Specs**: [JC-034 Pre-Code Brief](./35_JC034_GIWA_HANDOFF_PACKAGE_PRE_CODE_BRIEF.md)
- **Logic_Progress**: [Backlog JC-034](../04_Logic_Progress/00_BACKLOG.md)
- **Logic_Progress**: [Completion Contracts §3 JC-034](./22_OPEN_BACKLOG_COMPLETION_CONTRACTS.md)
