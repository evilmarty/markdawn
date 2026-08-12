# AGENTS.md

## Project summary
- **Name:** Markdawn
- **Type:** Web-based Markdown editor (preview is directly editable)
- **Core stack:** React + Vite, TailwindCSS + DaisyUI, `@mdxeditor/editor`
- **Hosting:** GitHub Pages (static build)
- **Offline:** PWA via `vite-plugin-pwa`

## Working conventions
- Do not take decisive product/behavior actions without explicit user instruction (e.g., adding compatibility/migration paths, changing storage versioning, altering data semantics).
- If intent is ambiguous or uncertain, ask the user before implementing.
- If intent appears risky and you are unsure whether to proceed safely, pause and ask first.
- When in doubt, choose caution and ask for confirmation instead of assuming.
- Use DaisyUI for **all UI-related styles**.
- Build UI controls/layouts with DaisyUI components and classes first; avoid custom styling unless absolutely necessary.
- Keep UI changes aligned with existing DaisyUI patterns and utility classes.
- For MDXEditor content-node styling, prefer `lexicalTheme` class overrides first (inline code, quote, list, admonitions) and keep CSS for editor chrome (toolbar, dialogs, dropdown portals, CodeMirror shell).
- Keep heavy editor/plugin wiring in `src/EditorWorkspace.jsx`, and keep `src/App.jsx` loading it lazily to protect startup performance.
- Keep draft autosave writes debounced; flush pending session writes on critical actions/page hide and surface storage/quota write failures to users.
- Preserve multi-tab behavior and per-tab dirty tracking:
  - `isDirty` drives Save button styling and unsaved indicators.
  - Unsaved close confirmation must remain in place.
- Keep code block support wired through both:
  - `codeBlockPlugin(...)`
  - `codeMirrorPlugin(...)` with explicit language registry.
- Keep `data-theme` applied to `document.body` so Radix/portal-rendered editor popups inherit DaisyUI theme tokens.

## Key behavior expectations
- New tabs start **clean** and become dirty only after edits.
- Save button is right-aligned in the editor toolbar.
- On small screens (`< lg`), sidebar is off-canvas and toggled by toolbar hamburger.
- Mobile toolbar uses ellipsis dropdown for advanced actions.

## MDXEditor theming and debugging guardrails
- Do not guess on styling regressions. Inspect the rendered DOM/class chain first and target the exact element receiving/losing styles.
- Scope overrides under `.mdxeditor` unless a portal element lives outside it (e.g. `[data-radix-popper-content-wrapper]`).
- Avoid broad selectors like `.mdxeditor-toolbar button` that can unintentionally restyle DaisyUI `btn` controls (Save/Save As).
- Prefer stable semantic hooks (`.mdxeditor-select-content`, `[data-editor-dropdown='true']`) and minimize reliance on hashed internal class fragments.
- For inline code, style a single element only (the lexical theme class target) and keep wrapper `<code>` neutral to prevent double styling.
- For code blocks, separate responsibilities:
  - wrapper: positioning/overflow for floating toolbar
  - inner editor surface: border/radius/shadow
  - avoid overriding CodeMirror syntax-token colors/background unless explicitly intended

## Useful commands
- Install deps: `npm install`
- Dev server: `npm run dev`
- Production build: `npm run build`
- Tests: `npm run test`
- Coverage: `npm run test:coverage`
- Deploy (manual): `npm run deploy`

## Quality gates
- Keep tests passing.
- Enforce coverage requirement: **>= 90%** for statements/functions/lines (configured in `vitest.config.js`).
- Run `npm run test:coverage` for any non-trivial code change and do not merge if thresholds fail.

## Language and tools best practices
- Follow modern React patterns:
  - Prefer functional components and hooks.
  - Keep state transitions explicit and side effects contained.
  - Avoid unnecessary re-renders; use memoization only where it improves clarity/perf.
- Keep JavaScript clear and defensive:
  - Avoid `any`-style escapes and implicit behavior.
  - Prefer small pure helpers for logic that benefits from direct unit tests.
  - Surface user-facing failures with clear messages; avoid silent failures.
- Use DaisyUI/Tailwind consistently:
  - Reuse existing component patterns before introducing custom one-off styles.
  - Keep responsive behavior explicit (`lg` breakpoints are important in this app).
- Prefer ecosystem tools over custom reinvention:
  - Use `@mdxeditor/editor` plugin system for editor capabilities.
  - Keep code-block support wired through `codeBlockPlugin` + `codeMirrorPlugin` language registry.
- Testing discipline:
  - Add or update Vitest + Testing Library coverage for behavioral changes.
  - Test both happy paths and key error/fallback paths (picker APIs, unsaved confirmation, session restore).
