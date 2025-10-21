Admin Dark Mode Theming
=======================

Overview
--------
The admin interface now supports a light / dark theme toggle consistent with the public site. The theming system is based on CSS custom properties (variables) defined in each admin stylesheet with a `[data-theme="dark"]` attribute override.

Key Files
---------
`public/css/admin-dashboard.css`  Core dashboard + shared components with dark overrides.
`public/css/admin-login.css`      Login page styling with dark overrides.
`src/views/admin/*.ejs`           Each view now includes an early inline script to apply the previously chosen theme before paint to reduce FOUC.

Implementation Notes
--------------------
1. Early Theme Application Script
   A tiny IIFE runs in the `<head>` before rendering content. It reads `localStorage.getItem('admin-theme')` and falls back to the system `prefers-color-scheme` media query. If dark, it sets `data-theme="dark"` on `<html>`.

2. Toggle Button
   Inserted into the admin navigation (dashboard + settings) and the login container. The button updates:
   - `aria-pressed` to reflect state (accessibility)
   - Swaps sun / moon glyph spans
   - Persists next state in `localStorage` under the key `admin-theme`.

3. CSS Variables
   Base variables declared at `:root`. Dark theme overrides inside `[data-theme="dark"] { ... }` redefine neutrals, greens, border colors, and elevation shadows. Components consume only variables (no new hard-coded colors for elements affected by theming).

4. Extending Components
   When adding new styled elements, prefer existing tokens:
   - Backgrounds: `var(--surface)` or gradient using `var(--bg)`
   - Text: `var(--text)` / `var(--muted)`
   - Borders: `var(--border-color)` / `var(--border-color-strong)`
   - Highlight / primary actions: `var(--primary)` / `var(--primary-dark)` / `var(--primary-light)`
   - Destructive: `var(--danger)` (background tints may use `var(--danger-bg)` if present in file)

5. Accessibility
   Focus outlines use `--focus-outline` (light = `--primary-light`, dark inherits updated value). Ensure new interactive elements keep `:focus-visible` styling.

6. Performance & FOUC Prevention
   By setting the attribute before external CSS fully loads, we avoid a flash of incorrect theme. If you refactor to bundle JS, retain an inline snippet that executes before paint.

7. Future Enhancements (Optional)
   - Centralize shared variable blocks into a single partial and include via build step.
   - Animate theme transitions with `transition` on background/color properties (guarded by `prefers-reduced-motion`).
   - Provide a high-contrast variant via `[data-theme="dark-high-contrast"]` if needed.

Usage
-----
No server-side session state is required; theme preference is purely client-side. Removing the `admin-theme` key resets to system preference.

Troubleshooting
---------------
If dark mode does not apply:
1. Check `<html>` element for `data-theme="dark"`.
2. Confirm localStorage key `admin-theme` holds `dark`.
3. Verify no CSP blocks inline `<script>` (would need nonce/hash in production).

---
Maintained as part of the accessibility & UX improvements initiative.