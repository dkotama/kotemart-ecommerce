# 003 — Custom CSS, Not DaisyUI

DaisyUI 5 is installed but pages use custom CSS classes defined in `src/styles/global.css`.

**Why:** The design system (Kotemart Keychron Light) predates the DaisyUI dependency. Custom classes like `btn-primary-custom`, `card-product`, `badge-*` give full control over the look. DaisyUI was added but never adopted — don't start now.

**Rule:** Use the existing custom classes. Add new ones to `global.css` if needed. Don't use DaisyUI component classes.
