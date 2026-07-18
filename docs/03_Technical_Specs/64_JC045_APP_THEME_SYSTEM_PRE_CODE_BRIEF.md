# JC-045 App Theme System Pre-Code Brief

> Created: 2026-07-18
> Status: Approved (T0) - runtime T1 not started
> Related: [UI Design](../02_UI_Screens/01_UI_DESIGN.md) · [Component & Library Plan](./02_COMPONENT_LIBRARY_PLAN.md) · [Theme QA](../05_QA_Validation/14_JC045_APP_THEME_SYSTEM_TEST_SCENARIOS.md) · [Backlog JC-045](../04_Logic_Progress/00_BACKLOG.md)

## 1. Decision To Make

SemuAgent is one application, not a light operational product plus a separate dark chat product.
It must support both light and dark appearance across the whole authenticated application, including
the sidebar, company home, collection, bookkeeping, payroll, VAT, annual filing, settings, dialogs,
toasts and Sebiseo.

The visual reference for the dark conversation surface is ChatGPT's quiet neutral-dark language:
low-contrast charcoal surfaces, clear text hierarchy and restrained blue links. It is a familiarity
reference only; SemuAgent does not copy ChatGPT branding or turn tax decisions into chat bubbles.

This work is visual infrastructure. It must not change tax calculations, canonical data, AI decisions,
upload behavior, permissions, filing gates, routes or browser-storage of business data.

## 2. Product Contract

### 2.1 Three choices

| Choice | Meaning | Initial behavior |
|---|---|---|
| System | Follow the operating-system light/dark preference | Default for a user without a stored preference |
| Light | Use the complete light token set | User override |
| Dark | Use the complete dark token set | User override |

- The selector belongs in the persistent sidebar user/footer area. It is always available after login;
  it is not hidden in an individual workspace or behind a tax-setting screen.
- The control uses a familiar icon button with accessible label and a small menu: 시스템 설정, 라이트,
  다크. The selected mode has text as well as its visual mark.
- The preference is a non-tax UI preference. It may be stored in browser storage by the theme library;
  it is never placed in a transaction, payroll, filing or audit record.
- A first visit uses 시스템 설정; no onboarding question or modal is added.
- A user can choose a different theme while a dialog, filtered table or Sebiseo conversation is open.
  The appearance changes without navigation, mutation or loss of current client state.

### 2.2 Theme scope

The theme applies to every authenticated SemuAgent page and shared overlay. The public landing/sign-in
surfaces may adopt the same primitives in a later explicitly scoped slice, but are not silently changed
with the dashboard rollout.

Sebiseo is not dark-only after this work. It uses the selected application theme. Its dark version may
retain the familiar conversational density, but it must consume the same semantic tokens as the rest of
the app.

## 3. Existing-State Audit

app/globals.css already contains shadcn-compatible base tokens for root and dark, but the root layout has
no theme controller and the authenticated shell is effectively light-only. In particular:

1. company shell tokens exist only for light surfaces, so dashboard shell components cannot become dark
   safely through current dark variables alone.
2. Many workspace components use literal Tailwind colors or arbitrary hex values. A parent dark class
   does not change those values.
3. Sebiseo deliberately uses fixed charcoal and white values, so it currently looks dark even when the
   rest of the application is light.

The implementation therefore starts with semantic-token coverage and shared chrome. It does not flip a
global dark class before individual workspace literals have a safe token path.

## 4. Visual Token Contract

### 4.1 Semantic tokens

Every reusable component must express visual intent through semantic tokens, never through a light/dark
conditional in business logic.

| Intent | Token family | Light | Dark |
|---|---|---|---|
| Application canvas | background, company background | quiet off-white | neutral charcoal |
| Raised surface | card, company surface, popover | white | layered charcoal |
| Default text | foreground | near-black | near-white |
| Secondary text | muted foreground, company muted text | readable gray | readable gray-white |
| Hairline / input | border, input, company border | soft gray | low-contrast light alpha |
| Navigation | sidebar tokens | light neutral | dark neutral |
| Primary action / focus | primary, ring | accessible blue | accessible blue |
| Positive / caution / destructive | semantic status tokens | text + soft background + border | text + soft background + border |

Exact color values are implementation details, but normal text, disabled controls, table borders,
focus rings and status combinations must meet the QA contrast checks. Status cannot be communicated by
color alone: existing text labels and chips remain required.

### 4.2 No visual meaning changes

- danger, warn, ok, muted and blue keep their current business meaning in both themes.
- A disabled action remains visibly disabled and non-interactive; dark mode must not make it resemble a
  secondary enabled action.
- Ready, confirmation-required, error, AI fallback, evidence blockers and tax outcomes retain labels.
  Theme work does not reinterpret a tax state.
- Dense tables retain row boundaries, selected-row emphasis, keyboard focus and hover visibility without
  relying on shadows alone.

## 5. Implementation Architecture

### 5.1 Theme controller

Use the existing shadcn CSS-variable model and add a small root ThemeProvider using next-themes.
The provider applies light or dark to the HTML class, supports system preference, and avoids a
server/client hydration warning with the standard root-layout pattern.

| Item | Contract |
|---|---|
| Library | next-themes only; no new design system or color-mode state manager |
| Attribute | class on HTML |
| Default | system |
| System detection | prefers-color-scheme; updates while mode is system |
| Persistence | theme-library browser preference only; no DB migration or tenant setting |
| SSR | root uses the documented hydration-safe attribute; a theme button renders only after mount if needed |
| Native chrome | color-scheme and theme-color metadata follow the active mode |

### 5.2 Token completion

1. Complete dark values for every company shell token.
2. Add semantic status surface/foreground/border tokens if the current ad-hoc status colors cannot meet
   contrast in both modes.
3. Migrate shared UI and dashboard chrome from literal colors to semantic token classes.
4. Migrate Sebiseo fixed charcoal/white literals to conversational semantic tokens.
5. Migrate each workspace only after its desktop and mobile visual check passes in both themes.

Business read models and domain functions must never receive a theme parameter.

### 5.3 Component boundaries

| Component | Responsibility | Must not do |
|---|---|---|
| ThemeProvider | resolve/apply mode and persist UI preference | read/write tenant data or tax state |
| ThemeModeMenu | select 시스템 설정/라이트/다크 and expose accessible state | navigate away or open a settings workflow |
| CSS token layer | map semantic token to mode-specific value | encode filing status logic |
| Shared UI primitives | consume semantic classes | own theme state |
| Workspace components | remove literals incrementally | fork their own dark palettes |

## 6. Fixed Delivery Order

### T0 - Contract and visual audit

1. Owner approves this Brief and [Theme QA](../05_QA_Validation/14_JC045_APP_THEME_SYSTEM_TEST_SCENARIOS.md).
2. Audit literal color use by shared shell and each workspace; classify as tokenizable, status-specific,
   chart-specific or intentional image/media color.
3. Produce a small HTML Preview only if the owner needs to compare token choices. A decorative redesign
   is not required.

### T1 - Foundation and shell

1. Add provider, root class behavior, 시스템 설정/라이트/다크 selector and complete CSS tokens.
2. Convert dashboard canvas, sidebar, topbars, common cards, dialogs, popovers, inputs, buttons,
   tables and toast treatment.
3. Verify no first-paint flash produces a light dashboard inside a requested dark mode, or the reverse.
4. **T1 exit covers shared shell and overlays only.** Sebiseo may still render with its current fixed
   charcoal/white literals after T1. That interim look is an expected migration lag, not a product
   decision to keep a separate dark island. Do not treat T1 as failed because Sebiseo has not yet
   consumed global theme tokens.

### T2 - Workspace rollout

Apply and review one coherent group at a time:

1. Sebiseo first (retire dark-only literals; consume conversational semantic tokens), then company home.
2. Source collection and bookkeeping/reconciliation.
3. Payroll, employees, withholding, payment statements, year-end settlement and local income tax.
4. VAT, filing-preparation, business-status report, reminders and settings.

Each group preserves its existing data hierarchy and action placement. This is not an opportunity to
add cards, duplicate explanations or change tax workflow copy.

### T3 - Full visual and accessibility verification

Run the two-theme desktop/mobile QA matrix, keyboard checks, reduced-motion checks and screenshot
review. Only then mark JC-045 complete.

## 7. Explicit Non-Goals

- A new ChatGPT-branded or cloned SemuAgent UI.
- Automatic dark-mode migration of arbitrary literal colors without review.
- A user profile/tenant database field for a purely local appearance preference.
- A change to filing math, AI prompting, evidence rules, upload formats, data retention or authentication.
- Replacing dense tax tables with a chat-only interface.
- Changing the public landing/sign-in experience in the first dashboard theme slice.

## 8. Failure-Safe Behavior

| Situation | Required behavior |
|---|---|
| Browser storage unavailable | Render system preference; selector still works for current page lifetime |
| Invalid stored theme | Fall back to 시스템 설정 without error UI |
| JavaScript unavailable | Render current light baseline; tax actions remain usable |
| Theme switch during mutation | Do not cancel, repeat or alter mutation; only repaint |
| Reduced motion | Theme switching does not require animated transitions |
| Unsupported OS preference | Use light token baseline |

## 9. Acceptance Criteria

JC-045 complete (after T3). T1 alone does not require Sebiseo token migration.

- [ ] 시스템 설정/라이트/다크 modes are available from the authenticated persistent sidebar and have accessible
  names and selected state.
- [ ] First use follows OS preference; explicit user choice survives dashboard navigation and refresh.
- [ ] The entire dashboard shell and Sebiseo use shared semantic tokens in both modes (Sebiseo from T2).
- [ ] No authenticated workspace is unintentionally dark-only or light-only after its T2 group lands.
- [ ] Text, border, focus, disabled, selected, hover and status states remain distinguishable in both modes.
- [ ] Tables, forms, dialogs, sheets, menus, toasts and file-upload states remain legible in both modes.
- [ ] The switch changes no canonical data, API request, AI request, filing gate or user permission.
- [ ] Desktop and mobile browser checks pass for the high-risk workflow pages in both modes.

## 10. Owner Decisions

Approved for T1 implementation (T0 complete):

1. All authenticated SemuAgent screens support light and dark; 시스템 설정 is the default.
2. A persistent sidebar menu exposes System, Light, Dark.
3. Browser-local theme preference is sufficient; no server/tenant setting in v1.
4. Sebiseo follows the selected app theme and no longer owns a dark-only palette (migration lands in T2;
   T1 shell may still show Sebiseo literals temporarily).
5. The rollout is token foundation -> shell -> workspace groups -> full QA; no single global class flip.
6. Public/sign-in screens are outside the first implementation slice.

## 11. Related Documents

- [UI Design](../02_UI_Screens/01_UI_DESIGN.md)
- [Component & Library Plan](./02_COMPONENT_LIBRARY_PLAN.md)
- [Theme QA Scenarios](../05_QA_Validation/14_JC045_APP_THEME_SYSTEM_TEST_SCENARIOS.md)
- [Conversational Tax Workspace Product Direction](../01_Concept_Design/04_CONVERSATIONAL_TAX_WORKSPACE_PRODUCT_DIRECTION.md)
- [Backlog JC-045](../04_Logic_Progress/00_BACKLOG.md)
