## Context

<!-- What changed, and why now? Link the backlog item or source document. -->

## Scope

<!-- What is included in this PR? -->

## Out of scope

<!-- What is intentionally not included? -->

## DB / Migration Checklist

- [ ] No schema or migration changes.
- [ ] Schema or migration changes are included in this PR.

If schema or migration changes are included:

- [ ] New migration file is committed under `drizzle/`.
- [ ] Baseline DB has been updated or verified with the migration.
- [ ] Verification query/result is noted in this PR.
- [ ] Rollback or recovery note is included if the migration is not trivially reversible.

## Minimal Implementation (YAGNI / KISS / DRY)

- [ ] **YAGNI**: Backlog/doc scope 밖 기능, 미래용 추상화, 불필요한 env/플래그, 새 의존성 없음
- [ ] **KISS**: 기존 helper·Luxon·Zod·프레임워크 기본 기능으로 해결; 구현체 1개짜리 interface/provider/factory 없음
- [ ] **DRY**: 같은 비즈니스 규칙 중복 없음 (모양만 비슷한 UI는 premature abstraction 사유 없이 묶지 않음)

체크 해제 항목이 있으면 **Notes**에 근거를 남깁니다.

## Verification

- [ ] `npx tsc --noEmit`
- [ ] `npm test` (or scoped `npx vitest run` for the touched area)
- [ ] `npm run build`
- [ ] Local or preview UI check, if this PR changes screens.

## Notes

<!-- Anything reviewers or future agents should know. -->
