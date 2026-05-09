# TxGuardian Design System

## Design intent
TxGuardian is a **security-first Solana product**. The interface should feel like a trusted pre-sign decision layer, not a dashboard toy and not a crypto trading terminal. Every visual choice should reduce anxiety, surface clarity, and build confidence.

The product must communicate four qualities immediately:
- Trust
- Precision
- Calm urgency
- Technical credibility

## Design principles

### 1. Clarity before personality
The UI should be memorable because it is **sharp and useful**, not because it is loud. High-risk information must always be easier to see than branding or decoration.

### 2. Progressive disclosure
Show the verdict first, explanation second, evidence third, raw technical detail last. Security products are stressful when everything is equally loud.

### 3. Color is semantic
Use color only when it communicates state or action. Most of the interface should remain neutral. Risk colors should be reserved for safe, caution, and danger states.

### 4. Product, not template
Avoid standard SaaS landing patterns, centered hero everything, bubbly cards, generic icon circles, and decorative gradients. The layout should feel deliberate and editorial.

### 5. Trust is visible
Users need visible structure, clear labels, stable spacing, and transparent reasoning to believe the product.

---

## Brand character

### Keywords
- Vigilant
- Refined
- Composed
- Technical
- Protective
- Grounded

### Anti-keywords
- Hype
- Noisy
- Neon
- Gamer
- Futuristic-for-show
- Meme-coin energy

---

## Visual language

### General style
- Dark theme by default.
- Warm graphite and charcoal surfaces, not pure black.
- Quiet teal as the primary accent.
- Risk states with restrained but high-contrast semantic colors.
- Border-driven structure rather than heavy shadows.
- Dense in technical areas, spacious in decision areas.

### Surface model
Use layered surfaces to create depth without looking glossy:
- App background
- Main panel surface
- Nested detail surface
- Code/technical inset surface
- Alert/risk surface tint

Surfaces should differ subtly but clearly.

---

## Color system

### Core neutrals
- `bg/base`: #0f1213
- `bg/canvas`: #131719
- `surface/1`: #171c1f
- `surface/2`: #1d2327
- `surface/3`: #232a2f
- `border/default`: rgba(255,255,255,0.08)
- `border/strong`: rgba(255,255,255,0.14)
- `text/primary`: #eef2f3
- `text/secondary`: #a7b0b5
- `text/muted`: #7f8a90

### Brand accent
- `accent/primary`: #3e8f96
- `accent/primary-hover`: #4fa3aa
- `accent/soft`: rgba(62,143,150,0.14)

### Risk semantics
- `risk/safe`: #4d8f66
- `risk/safe-soft`: rgba(77,143,102,0.16)
- `risk/caution`: #d0a34b
- `risk/caution-soft`: rgba(208,163,75,0.16)
- `risk/danger`: #c35b63
- `risk/danger-soft`: rgba(195,91,99,0.16)

### Utility semantics
- `info`: #5a8fcb
- `info-soft`: rgba(90,143,203,0.15)

### Color usage rules
- The app should be at least 75–80% neutral in any viewport.
- Do not mix multiple accent hues in one section.
- Risk colors only appear where state is meaningful.
- Never use saturated gradients for CTAs.

---

## Implementation tokens (CSS variables + Tailwind)

Tokens live as CSS custom properties on `:root` in `app/globals.css`, then bridge into Tailwind via `tailwind.config.ts` so utility classes (`bg-surface-1`, `text-primary`, `border-default`) read straight from the design tokens.

### CSS variables (`app/globals.css`)
```css
:root {
  --bg-base: #0f1213;
  --bg-canvas: #131719;
  --surface-1: #171c1f;
  --surface-2: #1d2327;
  --surface-3: #232a2f;
  --border-default: rgba(255,255,255,0.08);
  --border-strong: rgba(255,255,255,0.14);

  --text-primary: #eef2f3;
  --text-secondary: #a7b0b5;
  --text-muted: #7f8a90;

  --accent: #3e8f96;
  --accent-hover: #4fa3aa;
  --accent-soft: rgba(62,143,150,0.14);

  --risk-safe: #4d8f66;
  --risk-safe-soft: rgba(77,143,102,0.16);
  --risk-caution: #d0a34b;
  --risk-caution-soft: rgba(208,163,75,0.16);
  --risk-danger: #c35b63;
  --risk-danger-soft: rgba(195,91,99,0.16);

  --info: #5a8fcb;
  --info-soft: rgba(90,143,203,0.15);

  --radius-sm: 8px;
  --radius-md: 14px;
  --radius-lg: 18px;

  --focus-ring: 0 0 0 2px var(--bg-base), 0 0 0 4px var(--accent);
}
```

### Tailwind config bridge
```ts
// tailwind.config.ts
theme: {
  extend: {
    colors: {
      base: 'var(--bg-base)',
      canvas: 'var(--bg-canvas)',
      surface: {
        1: 'var(--surface-1)',
        2: 'var(--surface-2)',
        3: 'var(--surface-3)',
      },
      border: {
        DEFAULT: 'var(--border-default)',
        strong: 'var(--border-strong)',
      },
      text: {
        primary: 'var(--text-primary)',
        secondary: 'var(--text-secondary)',
        muted: 'var(--text-muted)',
      },
      accent: {
        DEFAULT: 'var(--accent)',
        hover: 'var(--accent-hover)',
        soft: 'var(--accent-soft)',
      },
      risk: {
        safe: 'var(--risk-safe)',
        'safe-soft': 'var(--risk-safe-soft)',
        caution: 'var(--risk-caution)',
        'caution-soft': 'var(--risk-caution-soft)',
        danger: 'var(--risk-danger)',
        'danger-soft': 'var(--risk-danger-soft)',
      },
      info: {
        DEFAULT: 'var(--info)',
        soft: 'var(--info-soft)',
      },
    },
    borderRadius: {
      sm: 'var(--radius-sm)',
      md: 'var(--radius-md)',
      lg: 'var(--radius-lg)',
    },
  },
},
```

### Token usage rules
- Components consume tokens via Tailwind classes only — never hardcoded hex.
- New colors require a token first. No raw hex in JSX.
- Risk soft variants are for surface tints; risk solid variants are for badges, chips, and verdict fills.

---

## Typography

### Font pairing
Use a strong, readable sans-serif such as:
- **Primary choice:** Geist or Inter for body and UI.
- **Alternative:** Satoshi or General Sans if available.

Do not use display serif or highly stylized headings.

### Type scale
- Page title: 32–36px, semibold
- Section title: 20–24px, semibold
- Card title: 16–18px, semibold
- Body: 14–16px, regular
- Secondary/meta: 12–13px, medium
- Code: 13px mono (use Geist Mono or JetBrains Mono)

### Typography rules
- Left align almost everything.
- Use weight contrast instead of extreme size jumps.
- Keep line length readable (max ~70ch for prose).
- Headings should sound factual, not marketing-heavy.

---

## Spacing system
Base spacing unit: **4px**

Recommended scale:
- 4
- 8
- 12
- 16
- 20
- 24
- 32
- 40
- 48
- 64

### Spacing behavior
- Decision panels should breathe.
- Technical panels can be denser.
- Horizontal rhythm should feel crisp and grid-aligned.

---

## Radius and borders

### Radius
- Small controls: 8px (`rounded-sm`)
- Standard cards: 14px (`rounded-md`)
- Large panels: 18px (`rounded-lg`)
- Pills/chips: 999px (`rounded-full`)

### Borders
Prefer subtle borders over strong shadows.
- Default: 1px `border/default`
- Elevated sections: 1px `border/strong`

### Shadows
Use only soft, low-contrast shadows for slight lift. The product should feel engineered, not glossy.

---

## Interactive states

Every interactive element must define visible hover, focus, active, and disabled states. State changes are subtle — color shift or border emphasis, not size jumps.

### Hover
- Primary buttons: background `accent` → `accent-hover`.
- Secondary/ghost buttons: background `transparent` → `surface-2`.
- Links and ghost icons: text `secondary` → `primary`; underline only on prose links.
- Cards (when clickable): border `default` → `strong`. Never scale.
- Transition: 120ms ease-out on `background-color`, `border-color`, `color`.

### Focus (keyboard)
- All interactive elements show a visible focus ring on `:focus-visible`.
- Focus ring: 2px offset (using `bg-base`) + 2px `accent` outer ring — encoded as `--focus-ring`.
- Never rely on color alone to indicate focus. The ring must be visible against any surface.
- Apply `outline: none; box-shadow: var(--focus-ring);` on `:focus-visible`. Do not strip outlines without replacing them.

### Active (pressed)
- Buttons: background darkens 4–6%; no scale transform.
- Toggles: background snaps to `accent-soft`.

### Disabled
- Opacity 0.4 + `cursor: not-allowed`.
- Disabled primary CTAs lose accent color (use `surface-3` instead) so they don't read as primary.
- Disabled inputs: text `muted`, border `default`, no focus ring.

### Loading (per-element)
- Buttons replace label with a 14px spinner + "Working…" sibling text. Do not collapse the button width.
- Inputs become read-only with a left-edge progress shimmer, never spinners overlapping the field.

---

## Accessibility

The product is for users under stress making security decisions. Accessibility is functional, not optional.

### Contrast
- All `text/primary` on `bg/base`, `bg/canvas`, `surface/1`, `surface/2`, `surface/3` must clear WCAG AA (4.5:1 for body, 3:1 for large text).
- Risk solid colors (`risk/safe`, `risk/caution`, `risk/danger`) on `text/primary` (white-ish) clear AA at 16px+.
- Risk soft variants are surface tints only — never put `text/primary` directly on a soft variant alone; pair with the solid variant or use a darker label.

### Keyboard navigation
- Every action reachable via keyboard. No mouse-only flows.
- Tab order follows visual reading order (verdict → recommendation → flags → details → actions).
- Focus rings (see Interactive States) are mandatory.
- Recommendation bar: `Esc` dismisses any expandable detail; `Enter` confirms primary action when bar is focused.

### Screen reader
- Risk badge announces full state: "Danger. Score 87 of 100. Three flags detected."
- Flag cards use `<article>` with `aria-labelledby` pointing to the flag label.
- Severity chips use `aria-label` ("High severity") since icon and color carry meaning.
- Loading sequence copy ("Simulating transaction…", etc.) is in an `aria-live="polite"` region.

### Motion
- All non-essential motion respects `prefers-reduced-motion: reduce`. Disable panel transitions and any decorative motion under that media query.

### Color independence
- Risk level is never communicated by color alone. Always pair with text label (Safe/Caution/Danger) and a stable icon (shield-check / alert-triangle / shield-x).

---

## Layout system

### App shell
- Top nav always visible.
- Wide centered content area for marketing-lite pages.
- Utility layout with sidebar for docs.
- Single-column focus mode for scanner.

### Scan/result page layout
Desktop:
- Left/main column: verdict, explanation, flags
- Right/supporting column: decoded instructions, metadata, share actions

Mobile:
- Everything stacks in a single column
- Recommendation bar sticks near bottom after analysis

### Hierarchy rules
Order on result pages should always be:
1. Risk verdict
2. Recommendation
3. Explanation
4. Evidence flags
5. Technical breakdown
6. Raw data

This matches security dashboard hierarchy best practices for action-first scanning.

---

## Components

### Buttons
Variants:
- Primary
- Secondary
- Ghost
- Danger

Rules:
- Primary action appears once per viewport.
- Danger buttons should be rare and intentional.
- No gradient buttons.
- All variants implement the four interactive states above.

### Risk badge
Displays:
- Label: Safe / Caution / Danger
- Numeric score
- Stable icon (shield-check / alert-triangle / shield-x — never substitute)

Visual behavior:
- Strong fill or tinted surface
- Clear text contrast
- Should read instantly from distance
- ARIA: announces label + score + flag count

### Severity chips
Used for risk flags.
- Small pill
- Low visual noise
- Semantic tint based on severity (low → `info-soft`, medium → `risk-caution-soft`, high → `risk-danger-soft`)
- ARIA-label spelled out

### Cards
Use cards to organize content into digestible units.
Types:
- Summary card
- Risk flag card
- Instruction detail card
- Code card
- Metric card

### Recommendation bar
Sticky and strong.
Contains:
- Recommendation text
- Main action state
- Option to inspect details

### Input area
- Large textarea or upload-like field for base64 transaction input
- Strong label and helper text
- Example fixtures beneath
- Monospace inside the textarea (the input is a hash-like blob, not prose)

### Code block
- Monospaced
- Slightly inset surface
- Copy button visible but subtle
- Wrap-or-scroll: scroll long lines horizontally, do not wrap mid-token

### JSON panel
- Dense but readable
- Syntax highlighted
- Collapsible when secondary

### Tables
Used mainly in docs and risk references.
- Tight row height
- Strong alignment
- Sticky header on long tables if possible

---

## States

### Empty state
Should not feel blank or broken.
Include:
- short instructional text,
- one clear next action,
- optional example transaction presets.

### Loading state
Use skeletons that resemble the final layout.
Do not use generic spinners alone.
Suggested loading sequence copy:
- Simulating transaction
- Running rule checks
- Generating explanation

### Error state
Should be calm and actionable.
Include:
- what failed,
- likely cause,
- next best step.

### Success / caution / danger
All use the same component structure; only semantic styling changes.
Consistency is critical for trust.

---

## Motion

### Motion style
Subtle, functional, quick.

Use motion for:
- loading transitions,
- panel reveal,
- expand/collapse,
- sticky recommendation bar entrance,
- inline state changes.

Avoid:
- floating decorative motion,
- dramatic parallax,
- delayed entrance animations everywhere.

Timing:
- Fast transitions: 120–180ms
- Panel transitions: 180–240ms
- Easing: smooth and restrained
- All motion respects `prefers-reduced-motion: reduce`.

---

## Iconography
Use a thin-to-medium stroke icon set such as Lucide.

Principles:
- Icons support meaning; they do not decorate empty space.
- No icon circles unless state-specific.
- Use familiar security symbols carefully: shield, alert, eye, code, terminal, wallet.

Risk-state icon mapping (do not substitute):
- Safe → `shield-check`
- Caution → `alert-triangle`
- Danger → `shield-x`
- Unknown program → `help-circle`
- Token approval → `key`
- Drainer match → `siren`

---

## Content tone in UI
The UI copy should sound:
- precise,
- calm,
- honest,
- professional.

Examples:
- Good: "This transaction grants broader token access than expected."
- Good: "Simulation and instruction intent do not fully match."
- Bad: "Uh oh! This looks super dangerous 🚨"
- Bad: "AI says you might get rugged."

---

## Page-by-page design direction

### Home
- Compact, product-led, not long-form.
- One strong product statement.
- One realistic mock analysis card.
- Small architecture section for SDK credibility.
- Trust through product clarity, not testimonials.

### Scan
- Single-task environment.
- Input at top.
- Result appears beneath without navigation disruption.
- Serious, high-focus feel.

### Result
- Most polished screen in the product.
- Verdict must dominate.
- Explanation must feel readable in 5 seconds.
- Evidence cards should be scannable.

### Docs
- Quiet, sharp, dev-tool aesthetic.
- Sidebar + content area.
- Great typography and code presentation.

### Playground
- Slightly denser.
- Technical credibility through structured output and side-by-side panels.

### About
- Strategic, minimal, product-minded.
- Architecture and roadmap should feel venture-ready, not essay-like.

---

## Anti-template checklist
Before accepting any generated design, reject it if it includes:
- gradient blob backgrounds,
- purple/blue glowing neon palette,
- centered landing-page hero with giant generic marketing copy,
- three equal feature cards in a row with icon circles,
- over-rounded components everywhere,
- excessive glassmorphism,
- gratuitous charts,
- cyberpunk motifs,
- crypto casino aesthetics,
- generic AI-dashboard look,
- too many bright colors in one viewport.

---

## Vercel-friendly implementation notes
- Use Next.js App Router.
- Tailwind is fine, but keep tokens explicit (see Implementation tokens above).
- Prefer CSS variables for color tokens and semantic states.
- Keep the design system consistent across marketing-lite pages and app pages.
- Dark mode default; optional light mode later, not required for hackathon MVP.

---

## Success criteria
The design succeeds if:
- judges instantly understand the product,
- the result screen feels trustworthy,
- the app looks custom-designed,
- developers can imagine integrating the SDK,
- the product feels premium enough to justify future wallet/plugin/API expansion.
