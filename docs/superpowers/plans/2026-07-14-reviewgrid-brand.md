# ReviewGrid Brand Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Project Flow identity with the approved ReviewGrid Signal Beacon brand across the public landing page, login, authenticated workspace, browser metadata, and reusable assets.

**Architecture:** Add one accessible React logo component backed by a CSS brand system, plus standalone SVG files for browser and external use. Consume the same component in product surfaces and update copy/metadata so the identity has one source of truth.

**Tech Stack:** React 19, TypeScript, CSS, SVG, Vitest, Vite

## Global Constraints

- Brand name: `ReviewGrid`.
- Tagline: `See risk. Review clearly.`
- Signal Beacon mark uses Signal Mint `#73F5C8`, Deep Grid `#07100E`, Precision White `#F2F7F4`, System Slate `#71827B`, Alert Amber `#F2B84B`, and Risk Red `#F06A6A`.
- Preserve the existing bilingual landing experience and premium dark visual language.
- Do not commit `.superpowers/` preview artifacts.

---

### Task 1: Brand contract and reusable identity

**Files:**
- Create: `frontend/src/__tests__/brand.test.ts`
- Create: `frontend/src/components/brand/ReviewGridLogo.tsx`
- Create: `frontend/src/components/brand/reviewgrid-brand.css`
- Create: `frontend/public/brand/reviewgrid-mark.svg`
- Create: `frontend/public/brand/reviewgrid-logo-dark.svg`
- Create: `frontend/public/brand/reviewgrid-logo-monochrome.svg`
- Create: `frontend/public/favicon.svg`

**Interfaces:**
- Produces: `ReviewGridLogo({ compact?, showTagline?, className? })`.

- [ ] Write a failing filesystem contract test for the component, approved wording, SVG assets, and removal of the old name.
- [ ] Run `npm test -- frontend/src/__tests__/brand.test.ts` and confirm failure because the brand component/assets do not exist.
- [ ] Implement the reusable Signal Beacon logo, styles, and standalone assets.
- [ ] Run the targeted test and confirm it passes.

### Task 2: Apply ReviewGrid across product surfaces

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/features/auth/Login.tsx`
- Modify: `frontend/src/features/landing/LandingShell.tsx`
- Modify: `frontend/src/features/landing/LandingPage.tsx`
- Modify: `frontend/src/features/landing/VietnameseLandingPage.tsx`
- Modify: `frontend/src/styles/app.css`
- Modify: `frontend/src/features/landing/landing.css`
- Modify: `frontend/src/features/landing/landing-experience.css`
- Modify: `frontend/index.html`

**Interfaces:**
- Consumes: `ReviewGridLogo` from Task 1.
- Produces: consistent ReviewGrid navigation, footer, login, sidebar, copy, metadata, and favicon.

- [ ] Replace all visible and metadata references to Project Flow with ReviewGrid.
- [ ] Use the shared logo in landing navigation/footer, login, and authenticated sidebar.
- [ ] Adjust responsive styling for the wordmark and compact mark.
- [ ] Run the brand and landing tests.

### Task 3: Verify and publish

**Files:**
- Modify only files required by failures found during verification.

- [ ] Run `npm run typecheck`.
- [ ] Run `npm run lint`.
- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Review `git diff`, stage only brand implementation files, commit as `feat: launch ReviewGrid brand identity`, rebase on `origin/develop` if necessary, and push `develop`.
