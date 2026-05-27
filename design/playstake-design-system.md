# PlayStake Design System v2.0

**Date**: 2026-05-27
**Status**: Authoritative spec for Frontend Developer implementation
**Token source**: `design/tokens.css` (all values referenced here live there)

---

## Table of Contents

1. [Design Principles](#1-design-principles)
2. [Token Reference](#2-token-reference)
3. [Typography System](#3-typography-system)
4. [Accessibility Rulings](#4-accessibility-rulings)
5. [Component Specifications (10)](#5-component-specifications)
6. [Motion Principles](#6-motion-principles)
7. [Do / Don't Rules](#7-do--dont-rules)
8. [Page-by-Page Redesign Intent](#8-page-by-page-redesign-intent)
9. [Deck-to-Product Mapping Table](#9-deck-to-product-mapping-table)

---

## 1. Design Principles

### Identity
PlayStake is a **premium competitive esports platform** where players wager on their own skill in real-time matches. The visual language must communicate: **fairness, competition, verification, and trust**.

### Five Pillars

| Pillar | Meaning | Visual expression |
|--------|---------|-------------------|
| **Competitive** | Skill-based, not luck-based | Clean sport-tech aesthetic; lime/cyan energy without chaos |
| **Transparent** | Verified outcomes, escrow-backed | Clear data display, tabular numerics, status indicators |
| **Premium** | Serious product, not a toy | Restrained palette, generous whitespace, tight typography |
| **Inclusive** | WCAG AA, all devices | Safe contrast combos, 44px touch targets, reduced-motion respect |
| **Not Gambling** | No casino tropes whatsoever | See Section 7 for explicit bans |

---

## 2. Token Reference

All tokens live in `design/tokens.css`. This section is a quick-reference index.

### 2.1 Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `--ps-lime` | `#C6F432` | Primary CTAs, brand glow, icons on dark |
| `--ps-lime-strong` | `#B6E635` | Hover state for lime elements |
| `--ps-lime-dim` | `#8FAF1E` | Lime where more weight is needed (e.g. icon tile borders) |
| `--ps-cyan` | `#00C8FF` | Secondary highlight, gradient end-stop |
| `--ps-cyan-dim` | `#0099CC` | Hover state for cyan elements |
| `--ps-blue` | `#1E6BFF` | Accent subheads, investor-facing callouts |
| `--ps-ink` | `#0A0F1C` | Primary dark surface |
| `--ps-ink-2` | `#111827` | Card surface on dark mode |
| `--ps-ink-3` | `#1A2233` | Elevated surface on dark mode |
| `--ps-paper` | `#FAFBFC` | Light background |
| `--ps-paper-elevated` | `#FFFFFF` | Card/modal surface on light mode |
| `--ps-success` | `#22C55E` | Success states, positive outcomes |
| `--ps-warning` | `#F59E0B` | Warnings, pending states |
| `--ps-error` | `#EF4444` | Error states, destructive actions |
| `--ps-text` | `#0A0F1C` | Primary body text on light surfaces |
| `--ps-text-on-dark` | `#F0F2F5` | Primary body text on dark surfaces |
| `--ps-muted` | `#5B6473` | Secondary/caption text on light |
| `--ps-muted-on-dark` | `#8892A2` | Secondary/caption text on dark |

### 2.2 Gradients

| Token | Value | Usage |
|-------|-------|-------|
| `--ps-gradient-brand` | `135deg, #C6F432 -> #00C8FF` | Hero backgrounds, card borders, feature highlights |
| `--ps-gradient-brand-h` | `90deg, #C6F432 -> #00C8FF` | Progress bars, horizontal dividers |
| `--ps-gradient-brand-subtle` | `135deg, lime 6% -> cyan 6%` | Section background tinting |
| `--ps-gradient-text` | `100deg, #C6F432 -> #00C8FF` | Gradient text (clip) on display headings |
| `--ps-gradient-icon-tile` | Radial lime 18% -> 4% | IconTile circular background |

### 2.3 Shadows

| Token | Usage |
|-------|-------|
| `--ps-glow` | Default glow: 1px lime ring + cyan depth shadow. Use on featured cards. |
| `--ps-glow-sm` | Subtle version for hover states |
| `--ps-glow-lg` | Emphasized version for hero/phone mockup |
| `--ps-glow-lime` | Lime-only glow for button hover |
| `--ps-shadow-sm` | General card elevation (non-glowing) |
| `--ps-shadow-md` | Elevated cards, dropdowns |
| `--ps-shadow-lg` | Modals, phone mockup |

### 2.4 Spacing

8-point grid. Use Tailwind spacing utilities (`p-2` = 8px, `p-4` = 16px, etc.) which align with the `--ps-space-*` tokens.

| Token | Value | Common use |
|-------|-------|------------|
| `--ps-space-1` | 4px | Icon gaps, fine adjustments |
| `--ps-space-2` | 8px | Inline padding, tight gaps |
| `--ps-space-3` | 12px | Small card padding |
| `--ps-space-4` | 16px | Default padding, component gaps |
| `--ps-space-6` | 24px | Card padding, section inner |
| `--ps-space-8` | 32px | Section gaps |
| `--ps-space-12` | 48px | Large section padding |
| `--ps-space-16` | 64px | Section vertical rhythm (mobile) |
| `--ps-space-20` | 80px | Section vertical rhythm (desktop) |

### 2.5 Radius

| Token | Value | Usage |
|-------|-------|-------|
| `--ps-radius-sm` | 6px | Badges, small pills |
| `--ps-radius-md` | 8px | Buttons, inputs |
| `--ps-radius-lg` | 12px | Cards |
| `--ps-radius-xl` | 16px | Large cards, modals |
| `--ps-radius-2xl` | 24px | Phone mockup |
| `--ps-radius-full` | 9999px | Dots, avatars, EyebrowPill |

---

## 3. Typography System

### 3.1 Font Stack

| Role | Family | Weight range | Loading |
|------|--------|-------------|---------|
| **Display** | Sora | 700-800 (Bold, ExtraBold) | `next/font` with `display: swap` |
| **Body** | Inter | 400-600 (Regular, Medium, Semibold) | `next/font` with `display: swap` |
| **Mono** | JetBrains Mono (or Inter tabular) | 400-500 | Loaded on demand for code/money |

### 3.2 Scale Application

| Element | Size token | Weight | Tracking | Leading | Font |
|---------|-----------|--------|----------|---------|------|
| Hero headline | `--ps-text-5xl` (mobile) / `--ps-text-6xl` (desktop) | 800 | `--ps-tracking-tight` | `--ps-leading-tight` | Sora |
| Section heading | `--ps-text-3xl` / `--ps-text-4xl` | 800 | `--ps-tracking-tight` | `--ps-leading-tight` | Sora |
| Card heading | `--ps-text-xl` / `--ps-text-2xl` | 700 | `--ps-tracking-normal` | `--ps-leading-snug` | Sora |
| Body | `--ps-text-base` | 400 | `--ps-tracking-normal` | `--ps-leading-normal` | Inter |
| Body small | `--ps-text-sm` | 400-500 | `--ps-tracking-normal` | `--ps-leading-normal` | Inter |
| Caption | `--ps-text-xs` | 500 | `--ps-tracking-normal` | `--ps-leading-normal` | Inter |
| Eyebrow label | `--ps-text-xs` | 600 | `--ps-tracking-widest` | `--ps-leading-none` | Inter |
| Stat number | `--ps-text-4xl`+ | 700 | `--ps-tracking-tight` | `--ps-leading-none` | Sora + tabular-nums |
| Money value | `--ps-text-base`+ | 600-700 | 0 | auto | Inter + tabular-nums |

### 3.3 Headline Pattern (from deck)

All section headings use the two-line pattern:
- **Line 1**: White (or `--ps-text`) in Sora ExtraBold
- **Line 2**: Gradient text (`--ps-gradient-text` with `background-clip: text`) in Sora ExtraBold
- Both lines sentence case, never ALL CAPS for headings

### 3.4 Eyebrow Label Pattern (from deck)

Above every section heading:
- Black rounded pill (`--ps-ink` background, `--ps-radius-full`)
- Lime dot icon (6px circle, `--ps-lime`) left-aligned inside pill
- White uppercase text, tracked wide (`--ps-tracking-widest`), `--ps-text-xs`
- Example: `[lime dot] THE OPPORTUNITY`

---

## 4. Accessibility Rulings

### 4.1 Critical: Lime on Light Backgrounds

**`--ps-lime` (#C6F432) FAILS WCAG AA for normal text on white or light backgrounds.** Contrast ratio is approximately 1.38:1 against white.

Safe usage of lime:

| Context | Ruling |
|---------|--------|
| Large display text (24px+ bold) on `--ps-ink` | PASS (13.2:1). Use freely. |
| Body text on `--ps-ink` | PASS (13.2:1). Allowed for accent spans, not paragraphs. |
| Body text on `--ps-paper` or white | FAIL. Never use lime for readable text on light. |
| Icon/decoration on any background | PASS. Decorative use has no contrast requirement. |
| Button fill (lime bg, ink text) | PASS. `--ps-text` on `--ps-lime` = 11.8:1. |
| Focus ring | PASS on dark. Use `--ps-lime` rings on dark surfaces only. On light, use `--ps-blue` focus rings. |

### 4.2 Safe Text-on-Background Combinations

| Text color | Background | Ratio | Verdict |
|------------|------------|-------|---------|
| `--ps-text` (#0A0F1C) | `--ps-paper` (#FAFBFC) | 17.4:1 | PASS AAA |
| `--ps-text` (#0A0F1C) | `--ps-lime` (#C6F432) | 11.8:1 | PASS AAA |
| `--ps-text-on-dark` (#F0F2F5) | `--ps-ink` (#0A0F1C) | 16.1:1 | PASS AAA |
| `--ps-muted` (#5B6473) | `--ps-paper` (#FAFBFC) | 5.1:1 | PASS AA |
| `--ps-muted-on-dark` (#8892A2) | `--ps-ink` (#0A0F1C) | 5.8:1 | PASS AA |
| `--ps-lime` (#C6F432) | `--ps-ink` (#0A0F1C) | 13.2:1 | PASS AAA |
| `--ps-cyan` (#00C8FF) | `--ps-ink` (#0A0F1C) | 8.9:1 | PASS AAA |
| `--ps-lime` (#C6F432) | `--ps-paper` (#FAFBFC) | 1.4:1 | **FAIL** |
| `--ps-cyan` (#00C8FF) | `--ps-paper` (#FAFBFC) | 2.8:1 | **FAIL** |
| `--ps-blue` (#1E6BFF) | `--ps-paper` (#FAFBFC) | 4.6:1 | PASS AA (large text only) |
| White (#FFFFFF) | `--ps-ink` (#0A0F1C) | 18.6:1 | PASS AAA |

### 4.3 Focus Indicators

- All interactive elements must have a visible `:focus-visible` ring
- On dark surfaces: `outline: 2px solid var(--ps-lime); outline-offset: 2px`
- On light surfaces: `outline: 2px solid var(--ps-blue); outline-offset: 2px`
- Never remove focus indicators; use `:focus-visible` (not `:focus`) to avoid showing on mouse click

### 4.4 Touch Targets

- Minimum 44x44px for all interactive elements (WCAG 2.5.5 AA)
- Buttons: `min-height: 44px` enforced via size tokens
- Icon-only buttons: 44x44px minimum with adequate padding

### 4.5 Reduced Motion

- All animations wrapped in `@media (prefers-reduced-motion: no-preference)`
- Fallback: elements appear in final state immediately
- Pulsing dots become static dots
- Count-up numbers display final value instantly

---

## 5. Component Specifications

---

### 5.1 EyebrowPill

**Purpose**: Section label that appears above every major heading. Identifies the section topic using the deck's black-pill-with-lime-dot pattern.

**Anatomy**:
```
[ (lime-dot)  SECTION LABEL ]
  ^6px circle  ^uppercase white text, tracked
  ^-- ink-colored pill with full radius --^
```

**Visual spec**:
- Background: `--ps-ink`
- Border-radius: `--ps-radius-full`
- Padding: `6px 14px 6px 10px`
- Lime dot: 6px circle, `--ps-lime`, `margin-right: 8px`
- Text: `--ps-text-xs`, weight 600, `--ps-tracking-widest`, uppercase, `#FFFFFF`
- Height: auto (approx 28px with padding)

**States**:
| State | Behavior |
|-------|----------|
| Default | Static display. No hover interaction. |
| Reduced motion | Identical (no animation on this component). |

**Variants**:
- None. This is a single-purpose display component.

**Props**:
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `label` | string | required | The section label text (rendered uppercase via CSS) |

**Usage guidelines**:
- Place directly above the section `<h2>` with `margin-bottom: 12px` (space-3)
- Center-aligned when the heading is centered; left-aligned when the heading is left-aligned
- One per section maximum

**Do**:
- Use for top-level section labels: "THE OPPORTUNITY", "PRODUCT", "HOW IT WORKS"
- Keep text short (2-4 words)

**Don't**:
- Don't use as a clickable element
- Don't nest inside headings
- Don't use more than one per section
- Don't change the lime dot to another color

---

### 5.2 GlowCard

**Purpose**: Primary content card used on light surfaces (landing page, info sections). White background with a gradient lime-to-cyan border and soft glow.

**Anatomy**:
```
+-- 1px gradient border (lime -> cyan) --+
|                                         |
|  [card content area]                    |
|  padding: 24px                          |
|                                         |
+-----------------------------------------+
   ^--- soft glow shadow beneath ---^
```

**Visual spec**:
- Background: `--ps-paper-elevated` (white)
- Border: 1px gradient using `ps-gradient-border-mask-light` technique
- Border-radius: `--ps-radius-lg` (12px)
- Shadow: `--ps-glow-sm` (subtle by default)
- Padding: `--ps-space-6` (24px) default

**States**:
| State | Behavior |
|-------|----------|
| Default | Gradient border visible, `--ps-glow-sm` shadow |
| Hover (if interactive) | Shadow transitions to `--ps-glow`, `translateY(-2px)` over `--ps-transition-normal` |
| Focus (if interactive) | Blue focus ring on light, lime focus ring on dark |
| Disabled | Not applicable (display component) |

**Variants**:
| Variant | Difference |
|---------|-----------|
| `glow="subtle"` | `--ps-glow-sm` (default) |
| `glow="medium"` | `--ps-glow` |
| `glow="none"` | `--ps-shadow-md` only, no glow |

**Props**:
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `glow` | `'subtle' \| 'medium' \| 'none'` | `'subtle'` | Glow intensity |
| `padding` | `'sm' \| 'md' \| 'lg'` | `'md'` | Inner padding: 16/24/32px |
| `as` | `'div' \| 'article' \| 'section'` | `'div'` | Semantic HTML element |

**Do**:
- Use on light (`--ps-paper`) page backgrounds
- Use for feature cards, info panels, comparison containers

**Don't**:
- Don't use on ink/dark surfaces (use DarkGlowCard instead)
- Don't nest GlowCards inside GlowCards
- Don't add additional borders or outlines

---

### 5.3 DarkGlowCard

**Purpose**: Emphasis card used on dark surfaces or force-dark sections. Ink background with gradient border and stronger glow.

**Anatomy**:
```
+-- 1px gradient border (lime -> cyan) --+
|  background: --ps-ink-2                 |
|                                         |
|  [card content area]                    |
|  padding: 24px                          |
|                                         |
+-----------------------------------------+
   ^--- pronounced glow shadow beneath ---^
```

**Visual spec**:
- Background: `--ps-ink-2` (#111827)
- Border: 1px gradient using `ps-gradient-border-mask` technique
- Border-radius: `--ps-radius-lg` (12px)
- Shadow: `--ps-glow` (standard glow)
- Padding: `--ps-space-6` (24px) default

**States**:
| State | Behavior |
|-------|----------|
| Default | Gradient border + `--ps-glow` shadow |
| Hover (if interactive) | Shadow transitions to `--ps-glow-lg`, slight lift |
| Focus (if interactive) | Lime focus ring (`--ps-lime`) |

**Variants**:
| Variant | Difference |
|---------|-----------|
| `emphasis="standard"` | `--ps-glow` (default) |
| `emphasis="high"` | `--ps-glow-lg` + slightly thicker border appearance |
| `emphasis="low"` | `--ps-glow-sm` for supporting cards |

**Props**:
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `emphasis` | `'low' \| 'standard' \| 'high'` | `'standard'` | Glow intensity |
| `padding` | `'sm' \| 'md' \| 'lg'` | `'md'` | Inner padding |

**Do**:
- Use on dark backgrounds (`--ps-ink`, force-dark sections)
- Use for the hero area, game surfaces, featured content

**Don't**:
- Don't use on white/paper backgrounds
- Don't combine with GlowCard in the same visual row

---

### 5.4 IconTile

**Purpose**: Circular icon container with a lime radial gradient background, used for feature icons and step indicators.

**Anatomy**:
```
+-- circle with radial gradient bg --+
|                                     |
|         [line icon, black]          |
|         centered                    |
|                                     |
+-------------------------------------+
```

**Visual spec**:
- Shape: circle (`border-radius: --ps-radius-full`)
- Background: `--ps-gradient-icon-tile` (radial lime, 18% center -> 4% edge)
- Border: `1px solid var(--ps-lime-20)` (subtle lime border)
- Icon: black line icon (`--ps-text` on light, `--ps-text-on-dark` on dark), stroke-width 1.5-2

**Sizes**:
| Size | Dimensions | Icon size |
|------|-----------|-----------|
| `sm` | 48px | 20px |
| `md` | 56px | 24px |
| `lg` | 72px | 32px |

**States**:
| State | Behavior |
|-------|----------|
| Default | Static display |
| On dark background | Same gradient but icon color switches to `--ps-text-on-dark` |

**Props**:
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `icon` | ReactNode | required | Lucide or custom SVG icon |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | Tile size |

**Do**:
- Use for feature lists, how-it-works steps, trust pillars
- Use Lucide line icons at consistent stroke weight

**Don't**:
- Don't use filled/solid icons (line style only)
- Don't change the radial gradient to a different color
- Don't add hover effects (this is a display element)

---

### 5.5 PhoneMockup

**Purpose**: Device frame showcasing the PlayStake mobile experience. Used in the hero section and feature areas.

**Anatomy**:
```
          +-- outer glow (lime/cyan) --+
          |                             |
          |  +-- device frame (ink) --+ |
          |  | dynamic island bar     | |
          |  | +-- screen area -----+ | |
          |  | | [screenshot or     | | |
          |  | |  placeholder UI]   | | |
          |  | +--------------------+ | |
          |  | home indicator bar     | |
          |  +------------------------+ |
          |                             |
          +--- reflection glow below ---+
```

**Visual spec**:
- Frame size: 280x572px (adjustable via className)
- Frame background: `--ps-ink-3` (#1A2233)
- Frame border: 8px solid `--ps-ink-2` with inner highlight (`inset 0 1px 0 rgba(255,255,255,0.07)`)
- Frame radius: 44px outer
- Dynamic island: 88x24px, `--ps-ink`, centered at top with 12px top offset
- Outer glow: `--ps-glow-lg`
- Reflection glow: blurred lime ellipse beneath device, `--ps-lime-20`
- Home indicator: `h-1 w-24`, white 20% opacity, bottom 8px

**States**:
| State | Behavior |
|-------|----------|
| Default | Static with ambient glow |
| With screenshot | `next/image` fills screen area, `object-cover object-top` |
| Placeholder | Built-in placeholder UI showing a live match card |

**Variants**:
- `src` provided: renders screenshot
- `src` omitted: renders placeholder match UI

**Rebranding notes** (changes from current implementation):
- Outer glow changes from green-only to lime/cyan gradient glow (`--ps-glow-lg`)
- Frame border changes from `#2a2a3e` to `--ps-ink-2` to unify with token system
- Reflection glow beneath uses `--ps-lime-20` instead of hardcoded green
- Internal placeholder match card gradient updates from `#22c55e -> #06b6d4` to `--ps-lime -> --ps-cyan`

**Do**:
- Use at most once per viewport/section
- Always set `aria-hidden="true"` on the outer wrapper (decorative)

**Don't**:
- Don't display at widths smaller than 240px (becomes unreadable)
- Don't animate the phone (static positioning only; glow may breathe)

---

### 5.6 StatStrip

**Purpose**: Large numeric stat display for key metrics. Horizontal layout on desktop, stacked on mobile. Used in the Market Stats and Trust sections.

**Anatomy**:
```
[large lime number]  [black label]  [muted caption]
     $200K+          Total paid out  Since launch
```

**Visual spec**:
- Number: Sora, `--ps-text-4xl` (desktop) / `--ps-text-3xl` (mobile), weight 700, `--ps-lime`, tabular-nums
- Label: Inter, `--ps-text-base`, weight 600, `--ps-text` (light) / `--ps-text-on-dark` (dark)
- Caption: Inter, `--ps-text-sm`, weight 400, `--ps-muted` / `--ps-muted-on-dark`

**Layout**:
- Desktop: horizontal row with items spaced via flexbox `justify-between`, max-width constrained
- Mobile: stack vertically or 2-column grid with the third item spanning full width
- Each item sits in a card: `--ps-paper-elevated` background (light) or `--ps-ink-2` (dark), `--ps-radius-lg`, `--ps-space-6` padding, `border: 1px solid var(--ps-border-light)`
- Centered text within each card

**States**:
| State | Behavior |
|-------|----------|
| Default | Numbers at final value |
| Animate-in (on scroll) | Count-up animation over 1.5s with ease-out cubic. Reduced-motion: skip to final. |

**Props**:
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | number | required | The numeric value |
| `prefix` | string | `''` | Currency symbol or prefix |
| `suffix` | string | `''` | Unit suffix (%, +, etc.) |
| `label` | string | required | Primary label text |
| `caption` | string | `''` | Optional secondary description |
| `format` | function | identity | Number formatter |

**Do**:
- Use lime for the numeric value to draw the eye
- Always use tabular figures (`font-variant-numeric: tabular-nums`)
- Trigger count-up only when section scrolls into view (IntersectionObserver)

**Don't**:
- Don't display more than 4 stats in a single strip
- Don't use for non-numeric content

---

### 5.7 ComparisonCard

**Purpose**: Three-column comparison showing "Informal Wagers / Existing Platforms / PlayStake" to position PlayStake as the clear winner.

**Anatomy**:
```
+--------------------------------------------------+
| Feature row header                                |
+--------------------------------------------------+
| Informal         | Existing        | PlayStake   |
| (muted)          | (muted)         | (lime check)|
|                  |                 | gradient    |
|                  |                 | border      |
+--------------------------------------------------+
```

**Visual spec**:
- Overall container: `--ps-paper-elevated` background, `--ps-radius-xl`, `--ps-shadow-md`
- Column headers: `--ps-text-xs`, weight 600, `--ps-tracking-widest`, uppercase
- PlayStake column header: `--ps-lime` text
- PlayStake column: has a gradient left-border (2px, `--ps-gradient-brand`) running full height, or alternatively the entire column has a subtle `--ps-lime-10` background tint
- Feature labels (left): `--ps-text-sm`, weight 600, `--ps-text`
- Cell text: `--ps-text-sm`, weight 400
- PlayStake cell checkmarks: `--ps-lime` (on dark) or `--ps-success` (on light)
- Non-PlayStake cells with deficiency: `--ps-error` X icon or no icon
- Row dividers: `1px solid var(--ps-border-light)`
- Table padding: cells `--ps-space-3` vertical, `--ps-space-4` horizontal

**States**:
| State | Behavior |
|-------|----------|
| Default | Static table display |
| Mobile (<640px) | Scrollable horizontally, or collapse to stacked cards per feature row |

**Variants**:
- `columns={3}` (default): three-way comparison
- `columns={2}`: simplified PlayStake vs. Bookmaker (current implementation)

**Rebranding notes** (changes from current ComparisonTable):
- Add third column ("Informal Wagers") for full deck alignment
- PlayStake column gets visual emphasis (gradient border or lime tint background)
- Checkmarks switch from `--color-brand-*` to `--ps-lime` / `--ps-success`

**Do**:
- Place inside a GlowCard or stand-alone with its own card treatment
- Keep feature descriptions concise (under 6 words per cell)

**Don't**:
- Don't use red/green for win/loss connotation (use lime check / muted X)
- Don't exceed 8 feature rows (becomes overwhelming)

---

### 5.8 StepIndicator

**Purpose**: Numbered step indicators with connectors showing the match flow progression. Horizontal on desktop, vertical on mobile.

**Anatomy (horizontal/desktop)**:
```
  (1)-----(2)-----(3)-----(4)-----(5)
 Choose   Stake   Play    Verify  Settle
```

**Anatomy (vertical/mobile)**:
```
  (1) Choose a Game
   |
  (2) Set Your Stake  
   |
  (3) Play the Match
   |
  (4) Verified Result
   |
  (5) Instant Settlement
```

**Visual spec**:
- Step circles: 40px diameter, `--ps-lime` background, `--ps-text` (#0A0F1C) text, Sora weight 700, `--ps-text-sm`
- Active step: `--ps-lime` fill with `--ps-glow-lime` shadow
- Completed step: `--ps-lime` fill, checkmark icon replaces number
- Upcoming step: `--ps-ink-2` fill (dark) or `--ps-paper` fill with `--ps-border-light` border (light), `--ps-muted` text
- Connectors: 2px dotted line, `--ps-lime-35` color
- Completed connectors: 2px solid line, `--ps-lime`
- Step labels: below circles (desktop) or right of circles (mobile), `--ps-text-sm`, weight 500

**States**:
| State | Behavior |
|-------|----------|
| Default (all steps shown) | Used on landing page — all steps visible as a visual progression |
| Interactive (in-match) | Current step highlighted, completed steps checked, future steps dimmed |

**Props**:
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `steps` | `Array<{label: string}>` | required | Step labels |
| `currentStep` | number | `0` | Currently active step (0 = all shown) |
| `orientation` | `'horizontal' \| 'vertical' \| 'auto'` | `'auto'` | Layout. Auto = horizontal on md+, vertical below. |

**Do**:
- Use for the 5-step match flow on landing and how-it-works pages
- Use for in-match progress on the match detail page

**Don't**:
- Don't exceed 7 steps (becomes too compact)
- Don't use for unordered lists of features (use IconTile list instead)

---

### 5.9 StatusPill

**Purpose**: Indicates live status of matches, transactions, or system states. Compact pill with a pulsing dot and uppercase label.

**Anatomy**:
```
[ (pulsing dot)  LIVE ]
```

**Visual spec**:
- Container: `--ps-ink` background, `--ps-radius-full`, padding `4px 12px 4px 8px`
- Dot: 6px circle, color varies by status, `ps-pulse-dot` animation
- Text: `--ps-text-xs`, weight 600, `--ps-tracking-widest`, uppercase, white

**Status variants**:
| Status | Dot color | Text | Animation |
|--------|-----------|------|-----------|
| `live` | `--ps-lime` | "LIVE" | Pulsing |
| `waiting` | `--ps-warning` | "WAITING" | Pulsing |
| `completed` | `--ps-success` | "COMPLETED" | Static (no pulse) |
| `disputed` | `--ps-error` | "DISPUTED" | Static |
| `settled` | `--ps-cyan` | "SETTLED" | Static |
| `expired` | `--ps-muted-on-dark` | "EXPIRED" | Static |

**States**:
| State | Behavior |
|-------|----------|
| Default | Pill displayed with appropriate dot color and animation |
| Reduced motion | Dot is static (no pulse animation) |

**Props**:
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `status` | `'live' \| 'waiting' \| 'completed' \| 'disputed' \| 'settled' \| 'expired'` | required | Determines color and text |
| `label` | string | auto from status | Override the displayed text |

**Do**:
- Use in match headers, lobby cards, transaction rows
- Place at the top-right of cards or inline with headings

**Don't**:
- Don't use more than one StatusPill per card
- Don't use for non-status information (use Badge component for tags)

---

### 5.10 PrimaryButton / SecondaryButton

**Purpose**: Main call-to-action buttons. PrimaryButton is a solid lime fill. SecondaryButton is a lime ghost outline for secondary actions on dark surfaces.

#### PrimaryButton

**Anatomy**:
```
+-- lime fill, rounded, ink text --+
|   [optional icon]  Button Text   |
+----------------------------------+
```

**Visual spec**:
- Background: `--ps-lime`
- Text: `--ps-text` (#0A0F1C), Sora, weight 700, `--ps-text-sm`
- Border-radius: `--ps-radius-md` (8px)
- Min-height: 44px (WCAG touch target)
- Padding: `0 24px`
- Transition: `--ps-transition-fast`

**States**:
| State | Behavior |
|-------|----------|
| Default | Lime fill, ink text |
| Hover | Background shifts to `--ps-lime-strong`, `box-shadow: var(--ps-glow-lime)`, `translateY(-1px)` |
| Active | `scale(0.98)`, shadow collapses |
| Focus-visible | `outline: 2px solid var(--ps-lime); outline-offset: 2px` (dark) or `outline-color: var(--ps-blue)` (light) |
| Disabled | `opacity: 0.5`, `cursor: not-allowed`, no hover effects |
| Loading | Spinner replaces or precedes text, button disabled |

#### SecondaryButton

**Anatomy**:
```
+-- transparent bg, lime border, lime text --+
|      [optional icon]  Button Text          |
+--------------------------------------------+
```

**Visual spec**:
- Background: transparent
- Border: `1px solid var(--ps-lime-35)`
- Text: `--ps-lime`, Sora, weight 600, `--ps-text-sm`
- Border-radius: `--ps-radius-md` (8px)
- Min-height: 44px
- Padding: `0 24px`

**States**:
| State | Behavior |
|-------|----------|
| Default | Transparent with lime border and lime text |
| Hover | Border opacity increases to `--ps-lime`, text brightens, subtle `--ps-glow-sm` shadow |
| Active | `scale(0.98)` |
| Focus-visible | Lime focus ring |
| Disabled | `opacity: 0.5`, `cursor: not-allowed` |

**Additional button variants** (keep from existing codebase):
- `danger`: `--ps-error` fill, white text
- `ghost`: transparent, muted text, hover reveals subtle background

**Props** (shared):
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `'primary' \| 'secondary' \| 'danger' \| 'ghost'` | `'primary'` | Visual variant |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | Height: 36/44/48px |
| `loading` | boolean | `false` | Shows spinner, disables button |
| `icon` | ReactNode | undefined | Leading icon |
| `fullWidth` | boolean | `false` | `width: 100%` |

**Do**:
- Use PrimaryButton for the single most important action per section
- Use SecondaryButton for supporting actions ("See How It Works", "Learn More")
- Always include descriptive text (not icon-only for primary/secondary)

**Don't**:
- Don't place two PrimaryButtons side by side (one must be Secondary)
- Don't use ALL CAPS for button text (sentence case or title case only)
- Don't use lime ghost buttons on light backgrounds (contrast fails)

---

## 6. Motion Principles

### Philosophy: Restraint, Not Flair

PlayStake animations serve a purpose: they **confirm actions**, **guide attention**, and **convey state changes**. They never exist for decoration alone.

### Motion Tokens

| Token | Duration | Easing | Usage |
|-------|----------|--------|-------|
| `--ps-transition-fast` | 120ms | `cubic-bezier(0.16, 1, 0.3, 1)` | Button hover, focus rings, toggles |
| `--ps-transition-normal` | 200ms | `cubic-bezier(0.16, 1, 0.3, 1)` | Card hover lift, dropdown open |
| `--ps-transition-slow` | 350ms | `cubic-bezier(0.45, 0, 0.55, 1)` | Page transitions, modal appear |

### Animation Inventory

| Animation | Duration | Trigger | Reduced-motion fallback |
|-----------|----------|---------|------------------------|
| **Fade up** | 600ms ease-out | Section enters viewport | Immediate opacity: 1 |
| **Count up** | 1500ms ease-out-cubic | Stat enters viewport | Show final value |
| **Pulse dot** | 1800ms infinite | Live status visible | Static dot |
| **Glow breathe** | 2400ms infinite | Featured card visible | Static glow |
| **Button hover glow** | 120ms | Mouse enter | No glow, color shift only |
| **Press scale** | 80ms | Mouse/touch down | No scale |
| **Stake fill bar** | 1200ms ease-out | Match starts | Bar at 100% immediately |

### Rules

1. **No animation lasts longer than 600ms** for user-initiated actions (hover, click, toggle).
2. **Infinite animations** (pulse, breathe) are reserved for status indication only.
3. **All animations** respect `prefers-reduced-motion: reduce` — wrap in media query.
4. **No bouncing, no elastic, no overshoot** — this is competitive, not playful.
5. **Page transitions** use a simple fade-up (8px translateY + opacity). No slides, no flips.
6. **Loading states** use a simple spinner (rotating ring), never a progress bar for indeterminate waits.

---

## 7. Do / Don't Rules

### Explicit Casino Trope Bans

| BANNED Element | Reason | Alternative |
|----------------|--------|-------------|
| Red + gold color scheme | Casino / bookmaker association | Lime + cyan + ink palette |
| Chip/coin illustrations | Gambling imagery | Clean geometric icons |
| Slot machine / reel animations | Gambling mechanic | Simple fade-up reveals |
| "JACKPOT" / "BIG WIN" typography | Gambling language | "Match Won" / "Settled" |
| Neon cursive or script fonts | Casino signage | Sora/Inter only |
| Playing card suit symbols | Gambling iconography | Game-specific neutral icons |
| Spinning wheel / roulette motifs | Gambling mechanic | StepIndicator for process |
| Confetti cannons on every win | Excessive celebration | Subtle success glow + confirmation |
| Flashing/strobing elements | Gambling machine UX + accessibility hazard | Smooth transitions only |
| "Bet" as primary CTA text | Gambling framing | "Play", "Challenge", "Stake" |
| Dollar sign rain / money animations | Gambling celebration | Clean balance update with count-up |
| Leaderboard crowns / treasure chests | Fantasy gambling | Clean rank numbers, achievement badges |

### Visual Language Do's

| DO | Why |
|----|-----|
| Use "Stake" / "Challenge" / "Match" language | Frames as competitive, not gambling |
| Show verification/escrow trust signals | Builds credibility |
| Use generous whitespace | Premium, not cluttered |
| Use consistent 8px grid | Professional alignment |
| Use tabular figures for all numbers | Prevents layout shift, looks precise |
| Pair lime with ink for maximum contrast | Accessible and on-brand |
| Use gradient sparingly (borders, text, CTAs) | Gradient is the brand signature — overuse dilutes it |
| Keep iconography to line-style only | Consistent, modern, clean |

### Visual Language Don'ts

| DON'T | Why |
|-------|-----|
| Use lime for body text on white | WCAG contrast failure |
| Mix more than 2 accent colors in one view | Visual noise |
| Use drop shadows heavier than `--ps-shadow-lg` | Feels dated, heavy |
| Use borders thicker than 2px | Chunky, not premium |
| Animate on page load without scroll trigger | Distracting, hurts performance |
| Use background images or patterns | Clutters the minimal aesthetic |
| Round to `border-radius: 50%` on rectangles | Use `--ps-radius-*` tokens only |

---

## 8. Page-by-Page Redesign Intent

### 8.1 Landing Page (`/`)

The landing page follows the investor deck's narrative flow. Each section maps to a deck slide.

#### Section 1: Hero + TrustStrip
- **Layout**: Two-column. Left: text stack. Right: PhoneMockup.
- **EyebrowPill**: `SKILL-BASED ESPORTS WAGERING`
- **Headline**: Two-line Sora ExtraBold. Line 1: "Play for Stakes." (white/ink). Line 2: "Beat Real Players." (gradient text).
- **Sub-headline**: Inter Regular, `--ps-muted` / `--ps-muted-on-dark`, max-width 480px.
- **CTAs**: PrimaryButton "Join the Beta" + SecondaryButton "See How It Works"
- **Proof tags**: Three inline items below CTAs: "Skill not luck", "P2P not the house", "Instant settlement" — each with a lime bold keyword.
- **TrustStrip**: Full-width bar below hero with shield/lock/escrow icons and labels.
- **Background**: `--ps-ink` with two ambient gradient blobs (decorative, `pointer-events: none`). Lime blob top-left, cyan blob mid-right, heavily blurred.

#### Section 2: Market Stats
- **EyebrowPill**: `THE OPPORTUNITY`
- **Headline**: "A $XX Billion Market" / gradient second line
- **StatStrip**: 3-4 stats in card grid (market size, growth rate, user base)
- **Body text**: 1-2 sentences contextualizing the market below the stats
- **Background**: `--ps-paper` (light) or alternating ink section

#### Section 3: How It Works
- **EyebrowPill**: `HOW IT WORKS`
- **Headline**: "Five Steps to Fair Play" (or similar)
- **StepIndicator**: Horizontal numbered lime circles with dotted connectors
- **Step cards**: Below the indicator, 5 StepCards in a responsive grid (3+2 on desktop, stacked on mobile). Each uses GlowCard treatment with IconTile, number badge, title, description.
- **Background**: `--ps-paper` or `--ps-gradient-brand-subtle`

#### Section 4: Not a Bookmaker
- **EyebrowPill**: `FUNDAMENTALLY DIFFERENT`
- **Headline**: "Not Odds. Not the House." / "Just the Match." (gradient)
- **ComparisonCard**: Three-column comparison inside a GlowCard. PlayStake column visually emphasized.
- **Disclaimer**: Fine print about regulatory readiness below.

#### Section 5: Game Modes
- **EyebrowPill**: `GAMES`
- **Headline**: "Choose Your Arena"
- **Game cards**: Grid of game cards, each with: game icon (IconTile), title, short description, "Play" or "Coming Soon" badge. Available games use GlowCard with gradient border. Coming-soon games use muted card (no glow, `--ps-border-light` only).

#### Section 6: Trust & Responsible Play
- **EyebrowPill**: `TRUST & SAFETY`
- **Headline**: "Built on Verification"
- **Trust pillars**: 3-4 IconTile + text blocks (escrow, dual-source verification, dispute resolution, responsible play). Each in a GlowCard.
- **Visual**: Clean grid layout, no imagery, icon-driven.

#### Section 7: Community
- **EyebrowPill**: `COMMUNITY`
- **Headline**: "Built for Players, By Players"
- **Content**: Community stats, social proof, or early adopter quotes.
- **Visual**: Lighter section, possibly testimonial cards.

#### Section 8: Beta Signup
- **EyebrowPill**: `EARLY ACCESS`
- **Headline**: "Get In Early"
- **Form**: Name, email, preferred game, player type. Inside a DarkGlowCard for emphasis.
- **CTA**: PrimaryButton "Request Access"
- **Background**: `--ps-ink` section with gradient subtle tinting.

#### Section 9: FAQ
- **Standard accordion** with clean expand/collapse. No special treatment needed beyond consistent typography and spacing.

#### Section 10: Footer
- **Standard footer**: Logo, nav links, social links, legal text.
- **Background**: `--ps-ink`, text in `--ps-muted-on-dark` and `--ps-text-on-dark`.

---

### 8.2 Play / Games Lobby (`/play`)

**Purpose**: Browse available games and enter matchmaking.

- **Page header**: "Game Demos" heading, Sora Bold, with subtitle.
- **Game grid**: Responsive 3-column grid (2 on tablet, 1 on mobile).
- **Game card spec**:
  - GlowCard treatment (gradient border)
  - IconTile (game icon, `md` size) at top
  - Game title: Sora Bold `--ps-text-xl`
  - Description: Inter Regular `--ps-text-sm` `--ps-muted`
  - Footer row: player count indicator + "Play Now" PrimaryButton (sm)
  - Hover: card lifts (`translateY(-2px)`), glow intensifies
  - Coming soon games: muted card, no glow, "Coming Soon" Badge overlaid

---

### 8.3 Match Create (`/match/create`)

**Purpose**: Create or configure a match challenge.

- **Layout**: Centered single-column form, max-width 560px
- **Form container**: DarkGlowCard on ink background (force-dark)
- **Sections**:
  1. Game selection (icon tiles in a radio-button grid)
  2. Stake amount (numeric input with currency prefix, lime focus ring)
  3. Match settings (game-specific options)
  4. Challenge type (open / invite specific player)
- **Trust signals**: Below the form, small text with shield icon: "Funds held in escrow until match is verified"
- **CTA**: PrimaryButton "Create Challenge" (full width)
- **Validation**: Inline error messages in `--ps-error`, success states in `--ps-success`

---

### 8.4 Match Detail / Live Match (`/match/[id]`)

**Purpose**: Live match view with VS layout, status, and actions.

- **VS Layout** (top of page):
  - Two player cards side by side (or stacked on mobile)
  - Left player: avatar, display name, current score (large Sora tabular-nums)
  - Center: "VS" divider with gradient horizontal line
  - Right player: same treatment
  - StatusPill at top-right: "LIVE" (pulsing), "WAITING", "COMPLETED", etc.
- **Match info card** (below VS):
  - DarkGlowCard containing: stake amount, total pot, game type, time elapsed
  - StepIndicator showing match progress (5 steps, current highlighted)
- **Action area**:
  - During match: game canvas/board takes center stage
  - Post-match: result display with outcome (win/loss), payout amount in lime, "Dispute" SecondaryButton if applicable
- **Mobile**: Full-screen game canvas with floating HUD overlay (existing `mobile-zone-a` pattern)

---

### 8.5 Wallet (`/wallet`) and Payout Success

**Purpose**: View balance, deposit/withdraw, see transaction history.

- **Balance card**: DarkGlowCard with gradient border. Available balance in lime (large Sora tabular-nums), escrowed amount in muted. Lock icon next to escrow.
- **Action buttons**: PrimaryButton "Deposit" + SecondaryButton "Withdraw" below balance.
- **Transaction list**: Clean table/list rows inside a card. Each row: icon (type), description, date, StatusPill, amount (lime for credit, default for debit). Tabular figures throughout.
- **Deposit success state**: Balance flashes with a brief lime glow (`--ps-glow-lime`), count-up animation on the new balance. Success banner with checkmark icon and lime accent.
- **Payout success**: Similar treatment. "Payout Complete" heading, amount displayed large in lime, confirmation details below. Subtle success glow on the card, no confetti.

---

### 8.6 Profile / Leaderboard / Stats (`/profile`)

**Purpose**: Player stats dashboard with achievement feel.

- **Stats grid**: 2x2 or 3-column grid of stat cards at top. Each card: GlowCard with large lime number (wins, win rate, total earned, matches played). Tabular figures.
- **Match history**: Table or list below stats. Compact rows with: opponent name, game, result (W/L badge), stake, date.
  - Win badge: `--ps-success` background tint, checkmark icon
  - Loss badge: `--ps-muted` background tint, X icon
- **Achievement section** (future): Icon-based badges in a grid. Unlocked badges use IconTile with lime glow. Locked badges are dimmed with a lock overlay.
- **Rank display**: Clean numeric rank (e.g. "#47") in large Sora Bold, not a crown or trophy. Lime accent if in top 10.

---

## 9. Deck-to-Product Mapping Table

This table ensures every visual element from the investor deck has a corresponding product surface, maintaining visual story consistency from pitch to product.

| Deck Element | Deck Slide | Product Surface | Component Used | Notes |
|---|---|---|---|---|
| Lime/cyan gradient headline | Title slide, every section | Every page `<h2>` second line | `.ps-gradient-text` | Sentence case, Sora ExtraBold |
| Black pill with lime dot | Section labels throughout | Landing section eyebrows | **EyebrowPill** | One per section max |
| Phone mockup with match UI | Hero/product slide | Landing hero (`/`) | **PhoneMockup** | Update glow to lime/cyan gradient |
| Three-stat banner (market size) | Opportunity slide | `/` Section 2 (Market Stats) | **StatStrip** | Count-up on scroll |
| 5-step match flow | How It Works slide | `/` Section 3, `/how-it-works` | **StepIndicator** + **StepCard** | Horizontal desktop, vertical mobile |
| Three-column comparison table | Differentiation slide | `/` Section 4 (Not a Bookmaker) | **ComparisonCard** | PlayStake column gets gradient border |
| Game mode cards | Product slide | `/` Section 5, `/play` lobby | **GlowCard** + **IconTile** | Coming-soon games dimmed |
| Trust pillar icons | Trust slide | `/` Section 6 | **IconTile** + text | Shield, lock, scale icons |
| Live match VS layout | Product demo slide | `/match/[id]` | Custom VS layout | StatusPill, score cards |
| Balance/pot display | Wallet slide | `/wallet` | **DarkGlowCard** + tabular nums | Lime for available balance |
| "LIVE" status indicator | Match demo | Match detail, lobby cards | **StatusPill** (`live`) | Pulsing lime dot |
| CTA buttons (lime fill) | Every slide | Every page | **PrimaryButton** | `--ps-lime` fill, ink text |
| Ghost outline buttons | Supporting CTAs | Every page | **SecondaryButton** | Lime border on dark |
| Gradient card borders | Featured cards | Landing cards, wallet, match | **GlowCard** / **DarkGlowCard** | `ps-gradient-border-mask` technique |
| Success celebration | Win state | Match result, payout | Glow flash + count-up | Subtle, no confetti |
| Ink dark backgrounds | Full-bleed sections | Landing (force-dark), game surfaces | `--ps-ink` / `--ps-ink-2` | Ambient gradient blobs decorative |
| Form with trust signals | Beta signup slide | Beta signup, match create | Form + shield icon text | "Funds held in escrow" |

---

## Appendix: Migration from Current Tokens

The existing codebase uses `--color-brand-*` (green-500 based) and `--color-accent-*` (cyan-based) tokens. The redesign shifts the primary brand color from `#22c55e` to `#C6F432` (lime). Here is the migration mapping:

| Old Token | Old Value | New Token | New Value | Notes |
|-----------|-----------|-----------|-----------|-------|
| `--color-brand-400` | `#4ade80` | `--ps-lime` | `#C6F432` | Primary brand color |
| `--color-brand-500` | `#22c55e` | `--ps-lime-strong` | `#B6E635` | Hover / emphasis |
| `--color-brand-600` | `#16a34a` | `--ps-lime-dim` | `#8FAF1E` | Darker lime for contrast |
| `--color-accent-400` | `#22d3ee` | `--ps-cyan` | `#00C8FF` | Secondary accent |
| `--color-accent-500` | `#06b6d4` | `--ps-cyan-dim` | `#0099CC` | Darker cyan |
| `--gradient-brand` | green-emerald-cyan | `--ps-gradient-brand` | lime-cyan 135deg | Updated gradient stops |
| `--color-surface-950` | `#0a0a0f` | `--ps-ink` | `#0A0F1C` | Slightly warmer dark |
| `--color-surface-800` | `#1a1a2e` | `--ps-ink-2` | `#111827` | Card surface dark |
| Hardcoded `rgba(34,197,94,*)` | Various | `--ps-lime-*` opacity tokens | Various | All green glows update |

**Migration strategy**: The Frontend Developer should introduce `--ps-*` tokens alongside existing tokens, then progressively replace. The old tokens can be aliased to new values during transition to avoid breaking changes.

---

**End of Design System Specification**

*This document is the single source of truth for PlayStake's visual design. All implementation decisions should reference this spec. Any deviation requires updating this document first.*
