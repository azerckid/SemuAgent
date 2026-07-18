# JC-045 App Theme System Test Scenarios

> Created: 2026-07-18
> Status: Approved contract (T0) - runtime implementation has not started
> Related: [Theme Pre-Code Brief](../03_Technical_Specs/64_JC045_APP_THEME_SYSTEM_PRE_CODE_BRIEF.md)

## 1. Scope

These scenarios verify appearance only. They must not be used as evidence that a tax calculation,
upload, AI decision, filing gate or data mutation is correct.

T1 verification targets TH-01 through TH-07 and TH-10 through TH-15 (shared shell and overlays).
TH-20 (Sebiseo) and other workspace rows are T2+; a post-T1 Sebiseo that still uses fixed charcoal
literals is an expected interim state, not a separate dark-product failure.

## 2. Mode Selection And Persistence

| ID | Given | When | Then | Result |
|---|---|---|---|:---:|
| TH-01 | no stored preference, OS light | authenticated dashboard loads | light token set is used | Pending |
| TH-02 | no stored preference, OS dark | authenticated dashboard loads | dark token set is used before usable paint | Pending |
| TH-03 | user selects Light | navigate, refresh and return to Sebiseo | light remains selected; no tax/API side effect | Pending |
| TH-04 | user selects Dark | navigate, refresh and return to VAT | dark remains selected; no tax/API side effect | Pending |
| TH-05 | user selects System | OS preference changes | active mode follows OS preference | Pending |
| TH-06 | malformed/unavailable preference storage | dashboard loads | falls back safely to System/light baseline; no crash | Pending |
| TH-07 | switch menu is focused | keyboard navigation | system/light/dark labels and selected state are announced; Escape closes menu | Pending |

## 3. Shared Shell And Overlay Matrix

| ID | Surface | Assertion in both themes | Result |
|---|---|---|:---:|
| TH-10 | sidebar + topbar | active route, hover, disabled nav and user/footer region are distinguishable | Pending |
| TH-11 | card + table | canvas/surface/row/border hierarchy is visible without shadows alone | Pending |
| TH-12 | input + select + textarea | value, placeholder, focus ring, invalid and disabled states are distinct | Pending |
| TH-13 | dialog/popover/dropdown/sheet | overlay boundary and focus indicator remain clear | Pending |
| TH-14 | Sonner toast | success, warning and error copy is readable and status has text | Pending |
| TH-15 | loading/empty/error | no preview/demo blocks reappear; actual state remains readable | Pending |

## 4. Tax Workflow Matrix

| ID | Page / workflow | Assertion in both themes | Result |
|---|---|---|:---:|
| TH-20 | Sebiseo | conversation, typewriter, CTA, disabled composer and upload-period dialog retain hierarchy | Pending |
| TH-21 | company home | upcoming filing, blocker, period control and status cards preserve meaning | Pending |
| TH-22 | source collection | upload dropzone, import states, retry/error and file names remain readable | Pending |
| TH-23 | bookkeeping + reconciliation | dense rows, source markers, selected rows, evidence states and focus are distinguishable | Pending |
| TH-24 | payroll + employees | salary table, close status, employee status and row actions remain readable | Pending |
| TH-25 | VAT | savings candidates, modification workbench, evidence chips, AI fallback and decisions keep text labels | Pending |
| TH-26 | withholding + payment statements | Hometax direct-entry values, preparation blockers and period context remain legible | Pending |
| TH-27 | annual filing + settings | conditional tax tracks, user management and empty/error state retain hierarchy | Pending |

## 5. Accessibility And Regression

| ID | Given | When | Then | Result |
|---|---|---|---|:---:|
| TH-30 | either theme | inspect normal text, muted text, chips, disabled controls, borders and focus | contrast meets the agreed accessible threshold; color is never the sole status signal | Pending |
| TH-31 | either theme | Tab through sidebar, selector, table actions and dialogs | visible focus never disappears into the surface | Pending |
| TH-32 | prefers-reduced-motion: reduce | change mode / receive Sebiseo reply | no mandatory theme animation; typewriter keeps existing reduced-motion contract | Pending |
| TH-33 | 1440x1000 and 390x844 | visit TH-20 through TH-27 sampling pages | no horizontal page overflow, overlap or clipped selector/menu | Pending |
| TH-34 | switch theme during upload, chat request or tax mutation | wait for completion | request completes once; no duplicate request, lost form value or stale gate state | Pending |
| TH-35 | visual-only change diff | inspect network and DB logs | no new API, AI/provider, DB mutation or filing request is made by theme selection | Pending |

## 6. Automation Boundary

- Unit tests cover mode resolver fallback, token class selection and selector accessibility state.
- Browser E2E covers TH-01 through TH-07, TH-20, TH-22, TH-25, TH-33 through TH-35.
- Screenshot comparison uses stable fixtures; it verifies layout and legibility, not tax values.
- A manual contrast pass is required for semantic status combinations because screenshots alone cannot
  prove readable contrast for every OS/browser rendering path.

## 7. Exit Rule

JC-045 is not complete because a dark class exists. It is complete only when the acceptance matrix is
passed in both modes and the normal filing workflows retain their existing behavior.
