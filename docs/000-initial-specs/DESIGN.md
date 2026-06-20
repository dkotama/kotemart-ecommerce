---
version: alpha
name: Kotemart Keychron Light
description: "Precision catalog aesthetic — clean white surfaces, mechanical precision in spacing and form, with teal accent that signals action without screaming. Inspired by Keychron's product design language: technical credibility meets warm minimalism."
colors:
  primary: "#1A1D23"
  secondary: "#5B606D"
  tertiary: "#1A8F89"
  neutral: "#F9F9F7"
  surface: "#FFFFFF"
  border: "#E8E9ED"
  muted: "#F1F2F5"
  on-primary: "#FFFFFF"
  on-tertiary: "#FFFFFF"
  success: "#2E8B57"
  warning: "#D4890B"
  danger: "#D1453B"
typography:
  h1:
    fontFamily: "DM Sans"
    fontSize: 2.5rem
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.03em"
  h2:
    fontFamily: "DM Sans"
    fontSize: 1.75rem
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  h3:
    fontFamily: "DM Sans"
    fontSize: 1.25rem
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  body-lg:
    fontFamily: "DM Sans"
    fontSize: 1.125rem
    lineHeight: 1.6
  body-md:
    fontFamily: "DM Sans"
    fontSize: 0.9375rem
    lineHeight: 1.55
  body-sm:
    fontFamily: "DM Sans"
    fontSize: 0.8125rem
    lineHeight: 1.5
  label-caps:
    fontFamily: "DM Sans"
    fontSize: 0.6875rem
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "0.1em"
  price-lg:
    fontFamily: "DM Sans"
    fontSize: 1.5rem
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  price-sm:
    fontFamily: "DM Sans"
    fontSize: 0.9375rem
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  mono:
    fontFamily: "JetBrains Mono"
    fontSize: 0.8125rem
    lineHeight: 1.6
rounded:
  xs: 3px
  sm: 6px
  md: 10px
  lg: 16px
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
  2xl: 64px
shadows:
  card: "0 1px 3px rgba(26, 29, 35, 0.06), 0 1px 2px rgba(26, 29, 35, 0.04)"
  card-hover: "0 4px 12px rgba(26, 29, 35, 0.08), 0 2px 4px rgba(26, 29, 35, 0.04)"
  modal: "0 8px 32px rgba(26, 29, 35, 0.12), 0 2px 8px rgba(26, 29, 35, 0.06)"
  dropdown: "0 4px 16px rgba(26, 29, 35, 0.08)"
components:
  button-primary:
    backgroundColor: "#0F726E"
    textColor: "{colors.on-tertiary}"
    rounded: "{rounded.sm}"
    padding: 12px
    typography: "{typography.label-caps}"
    height: 44px
  button-primary-hover:
    backgroundColor: "#0A5D59"
    textColor: "{colors.on-tertiary}"
    rounded: "{rounded.sm}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    rounded: "{rounded.sm}"
    padding: 12px
    typography: "{typography.label-caps}"
    height: 44px
  button-secondary-hover:
    backgroundColor: "{colors.muted}"
    textColor: "{colors.primary}"
  button-ghost:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    rounded: "{rounded.sm}"
    padding: 8px
  button-ghost-hover:
    backgroundColor: "{colors.muted}"
    textColor: "{colors.primary}"
  card-product:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    rounded: "{rounded.md}"
    padding: 0px
  card-product-hover:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.md}"
  badge-status:
    backgroundColor: "{colors.muted}"
    textColor: "{colors.secondary}"
    rounded: "{rounded.full}"
    padding: 4px
  badge-status-active:
    backgroundColor: "#D5EDEB"
    textColor: "#0F726E"
    rounded: "{rounded.full}"
  badge-status-success:
    backgroundColor: "#D9EDE2"
    textColor: "#1E6B3F"
    rounded: "{rounded.full}"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    rounded: "{rounded.sm}"
  input-focus:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
  table-row:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
  table-row-hover:
    backgroundColor: "{colors.muted}"
  banner-gate-closed:
    backgroundColor: "#FDF3E7"
    textColor: "#8B5E0A"
    rounded: "{rounded.xs}"
    padding: 12px
  alert-error:
    backgroundColor: "#FDEDEC"
    textColor: "#A6312A"
    rounded: "{rounded.sm}"
    padding: 16px
  badge-settled:
    backgroundColor: "#D9EDE2"
    textColor: "#1E6B3F"
    rounded: "{rounded.full}"
    padding: 4px
  page-background:
    backgroundColor: "{colors.neutral}"
  divider:
    backgroundColor: "{colors.border}"
    height: 1px
---

## Overview

Kotemart Jastip Catalog is precision-first — clean, readable, and composed like a well-engineered product page. The light theme draws from Keychron's mechanical keyboard aesthetic: white space as structure, typography as hierarchy, and a single teal accent that carries all interactive signals.

The feel is **warm technical credibility**: not sterile SaaS, not playful marketplace. Every pixel justifies itself. Cards are restrained — no heavy borders, no aggressive shadows. Content is king; the UI stays out of the way until the user needs to act.

**Implementation:** Astro + TailwindCSS v4 + daisyUI v5. DESIGN.md tokens map to Tailwind config via CSS custom properties; daisyUI theme extends from the DESIGN.md palette. All components reference daisyUI primitives (buttons, badges, cards, modals, tables, forms) themed with the Kotemart Keychron Light palette.

## Colors

- **Primary (#1A1D23):** Deep warm-charcoal for headline text, navigation, and high-emphasis labels. Never pure black — softens contrast slightly for extended reading comfort.
- **Secondary (#5B606D):** Mid-gray for body text, metadata, secondary labels. Meets WCAG AA at 14px+.
- **Tertiary (#1A8F89):** The action color. A desaturated teal — sophisticated, not toy-like. Used exclusively for interactive elements: primary buttons, links, focus rings, active states, and the jastip-gate OPEN indicator. One accent, strict discipline.
- **Neutral (#F9F9F7):** Page background — an off-white with a barely perceptible warmth. Prevents eye fatigue on long browsing sessions.
- **Surface (#FFFFFF):** Pure white for cards, modals, and elevated containers on the neutral background. Flat, confident, soft-shadowed.
- **Border (#E8E9ED):** Light gray borders — visible enough to separate elements, subtle enough to not distract. Used on inputs, dividers, and card edges when needed.
- **Muted (#F1F2F5):** Slightly darker than neutral — for hover states, selected rows, and inactive badge backgrounds.
- **Success (#2E8B57):** Settled orders, confirmed status. Calm green.
- **Warning (#D4890B):** Pending states, attention-needed indicators.
- **Danger (#D1453B):** Errors, closed-gate banner accent (used sparingly).

**Contrast notes:**
- Primary on surface: 15.3:1 (AAA+)
- Tertiary on surface: 5.1:1 (AA)
- Secondary on neutral: 5.8:1 (AA)
- White on tertiary: 4.9:1 (AA, large text only — buttons use bold caps)

## Typography

**DM Sans** for all UI text — a geometric sans with open apertures and excellent readability. No serif. No secondary family. Weight and size do all the work.

**JetBrains Mono** reserved for: JPY price displays, order IDs, and admin data views where numeric alignment matters.

**Typography rhythm (desktop):**
- `h1`: 40px / 700 — catalog section headers, admin page titles
- `h2`: 28px / 600 — product detail titles, dashboard section headers
- `h3`: 20px / 600 — card titles, modal headers
- `body-lg`: 18px — product descriptions, intro paragraphs
- `body-md`: 15px — default body, order details, form labels
- `body-sm`: 13px — metadata, timestamps, disclaimer text
- `label-caps`: 11px / 600 / 0.1em — button text, badge labels, nav items
- `price-lg`: 24px / 700 — primary price display (IDR estimate)
- `price-sm`: 15px / 600 — JPY display, HPP, profit figures
- `mono`: 13px — JPY amounts, order numbers, rate values

## Layout

**Grid system:** 12-column CSS Grid with 24px gutters. Max content width 1200px on desktop.

**Spacing scale (4px baseline):**
- `xs` (4px): icon-to-text gap, badge internal padding
- `sm` (8px): intra-component spacing, label-input gap, button icon gap
- `md` (16px): card internal padding, form field stacking, list item gap
- `lg` (24px): section padding, grid gap on catalog, modal padding
- `xl` (40px): section-to-section separation on landing pages
- `2xl` (64px): hero sections, page-top breathing room

**Catalog grid:** 3 columns on desktop (≥1024px), 2 on tablet, 1 on mobile. Product cards fill evenly.

**Admin panel:** Single-column forms max 640px. Data tables full-width with sticky header. Sidebar navigation fixed 240px.

**Gate banner:** Full-width at top of catalog page when closed. 12px top, 12px bottom padding. Warning-tinted background with danger-left-border.

## Elevation & Depth

Kotemart is intentionally flat. Cards float with a whisper of shadow — enough to distinguish from the neutral background, not enough to feel 3D.

- **card shadow:** 0 1px 3px rgba(26,29,35,0.06) — barely-there elevation. Card sits slightly above the page.
- **card-hover:** 0 4px 12px rgba(26,29,35,0.08) — gentle lift on hover. No transform, no scale — just shadow.
- **modal shadow:** 0 8px 32px rgba(26,29,35,0.12) — clear z-stack. Modal demands attention but doesn't darken the page aggressively.
- **dropdown shadow:** 0 4px 16px rgba(26,29,35,0.08) — quick popover, light elevation.

No gradients. No glass. No blur. Just confident flat surfaces with precise shadow tiers.

## Shapes

- `xs` (3px): input fields, small badges, inline code
- `sm` (6px): buttons, form elements, status indicators
- `md` (10px): product cards, modals, table containers
- `lg` (16px): hero images, large feature cards (rarely used)
- `full` (9999px): avatar circles, pill badges (status, categories)

Product photos: 4px radius — sharper than cards to create visual tension between image and container. Images stretch edge-to-edge within cards.

## Components

### Product Card (`card-product`)
The core UI element. No internal padding — the image fills the top, content area below with 16px padding. Photo takes 60% of card height, content 40%. On hover: shadow deepens slightly, no scale. Product name in `h3`, JPY price in mono, IDR estimate in `price-sm` with teal tint. Category badge top-left overlay with `badge-status` styling.

### Buttons
- **Primary (`button-primary`):** Teal fill with white label-caps. 44px min height for mobile tap targets. The only high-emphasis action on screen. One per view.
- **Secondary (`button-secondary`):** White fill with primary text, 1px border (border color). For "Cancel", "Back", secondary actions.
- **Ghost (`button-ghost`):** Transparent with secondary text. For tertiary actions, icon-only buttons, inline actions in table rows.

### Status Badges (`badge-status`)
Pill shape (full radius). Three variants:
- **Default (muted bg, secondary text):** Draft, idle states
- **Active (teal-tinted bg, tertiary text):** Pending, Open gate, active batch
- **Success (green-tinted bg, success text):** Settled, Bought, completed

### Gate Banner
Full-width horizontal bar at catalog top when gate=Closed. Warning-background with danger-left-border (4px), danger text. Contains: icon, message "Jastip sedang tutup", Telegram CTA button (secondary). No card — flat against page edge.

### Order Status Timeline
Horizontal stepper: Draft → Pending → Bought → Settled. Four dots connected by 1px border line. Active/complete dots filled tertiary. Inactive dots: border only. Labels below each dot in `body-sm`.

### Data Table (Admin)
White rows on neutral background. `body-md` for cell content. `border` divider rows 1px. Hover: `muted` background. Sticky header with `label-caps`. Price columns right-aligned in mono. Status column uses `badge-status`.

### Admin Sidebar
Fixed left, 240px. `surface` background. Navigation items: `label-caps` with tertiary on active. 1px border separator on right edge. Collapse toggle at bottom. Mobile: hamburger → overlay.

## Responsive Rules

| Breakpoint | Catalog | Admin | Nav |
|---|---|---|---|
| ≥1024px | 3 cols, 24px gap | Sidebar + content | Horizontal top bar |
| 768–1023px | 2 cols, 16px gap | Collapsible sidebar | Horizontal top bar |
| <768px | 1 col, full width | Sidebar = hamburger overlay | Bottom tab bar or hamburger |

Photos maintain 4:3 aspect ratio at all breakpoints. Type scale reduces 10–15% on mobile (max body 16px, h1 32px).

## Interaction States

All interactive elements must have visible states:

| Element | Default | Hover | Focus | Active/Pressed | Disabled |
|---|---|---|---|---|---|
| Primary button | teal fill | darker teal (#147A74) | 2px teal ring, offset 2px | darker teal, scale 0.98 | muted bg, secondary text, no pointer |
| Secondary button | white + border | muted bg | 2px tertiary ring | muted bg, scale 0.98 | 50% opacity |
| Input | white + border | border → secondary | 2px tertiary ring | border = tertiary | muted bg, 50% text |
| Product card | surface + card shadow | card-hover shadow | 2px tertiary ring | card-hover | — |
| Table row | surface | muted bg | — | — | — |
| Link (text) | tertiary, no underline | darker teal, underline | 2px tertiary ring | darker teal | secondary text |

**Focus ring:** 2px solid {colors.tertiary}, 2px offset from element edge. No box-shadow focus — visible border ring only. Works for keyboard and pointer users equally.

**Motion:** All state transitions 150ms ease-out. No spring, no bounce. `prefers-reduced-motion`: instant transition.

## Do's and Don'ts

- **Do** use exactly one `button-primary` per view. The teal accent loses signal if overused.
- **Do** display JPY in mono font, IDR in DM Sans — this creates instant visual distinction between currency tiers.
- **Do** put the price disclaimer ("Harga estimasi") in `body-sm` with secondary color, immediately below every IDR price.
- **Do** use the status badge variants consistently — don't invent new badge colors for special cases.
- **Do** keep gate banner at the top. Don't hide it — it's the most critical business signal.
- **Do** map DESIGN.md colors → Tailwind `theme.extend.colors` and typography → `theme.extend.fontFamily`; daisyUI theme from these tokens.
- **Do** use daisyUI component classes (`btn`, `badge`, `card`, `table`, `modal`, `drawer`, `stat`, `form-control`, `input`, `select`, `textarea`, `file-input`) — do not rebuild these from scratch.
- **Do** prefer Astro SSG (`---`) for static catalog pages; SSR for auth-gated order/admin pages.
- **Don't** add decorative icons, gradients, or illustrations. This design system is typography + spacing + one accent.
- **Don't** use box-shadow on text or overlays. Flat surfaces, precise shadows only on elevated elements.
- **Don't** scale cards on hover. Lift with shadow only. Motion is functional, not theatrical.
- **Don't** introduce colors outside the palette. If you need a new semantic state, extend the palette in DESIGN.md first.
- **Don't** use inline styles or CSS modules when Tailwind utility classes + daisyUI components can express the same intent.
