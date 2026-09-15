---
name: WikiHunt
description: A mechanical split-flap departure board for a real-time wikirace.
colors:
  board-black: "#0a0a0c"
  gunmetal: "#18181c"
  gunmetal-raised: "#212126"
  split-seam: "#303036"
  flap-cream: "#eae6da"
  panel-steel: "#a3a5ac"
  faint-steel: "#8d8f98"
  amber-glow: "#ffb020"
  amber-strong: "#d98c00"
  amber-ink: "#1a1200"
  status-enroute: "#4f8fd1"
  status-departed: "#4ade80"
  status-delayed: "#f35f5f"
  status-delayed-bright: "#f87171"
typography:
  display:
    fontFamily: "'Big Shoulders Display', 'Archivo', system-ui, sans-serif"
    fontSize: "21px"
    fontWeight: 800
    letterSpacing: "0.01em"
  flap:
    fontFamily: "'Big Shoulders Stencil Display', 'Big Shoulders Display', monospace"
    fontWeight: 700
  body:
    fontFamily: "'Archivo', system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "'Archivo', system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 700
    letterSpacing: "0.06em"
rounded:
  sm: "2px"
  md: "4px"
  lg: "6px"
  pill: "999px"
components:
  button-primary:
    backgroundColor: "{colors.amber-glow}"
    textColor: "{colors.amber-ink}"
    rounded: "{rounded.sm}"
    padding: "12px 20px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.flap-cream}"
    rounded: "{rounded.sm}"
    padding: "12px 20px"
  button-danger:
    backgroundColor: "rgba(243, 95, 95, 0.12)"
    textColor: "{colors.status-delayed}"
    rounded: "{rounded.sm}"
    padding: "12px 20px"
  input:
    backgroundColor: "{colors.board-black}"
    textColor: "{colors.flap-cream}"
    rounded: "{rounded.sm}"
    padding: "11px 14px"
  card:
    backgroundColor: "{colors.gunmetal}"
    rounded: "{rounded.lg}"
    padding: "28px"
  badge-easy:
    backgroundColor: "{colors.board-black}"
    textColor: "{colors.status-departed}"
    rounded: "{rounded.sm}"
    padding: "3px 9px"
  badge-medium:
    backgroundColor: "{colors.board-black}"
    textColor: "{colors.amber-glow}"
    rounded: "{rounded.sm}"
    padding: "3px 9px"
  badge-hard:
    backgroundColor: "{colors.board-black}"
    textColor: "{colors.status-delayed}"
    rounded: "{rounded.sm}"
    padding: "3px 9px"
  player-chip:
    backgroundColor: "{colors.gunmetal-raised}"
    textColor: "{colors.flap-cream}"
    rounded: "{rounded.sm}"
    padding: "7px 12px"
  flap-cell:
    backgroundColor: "{colors.board-black}"
    textColor: "{colors.flap-cream}"
    rounded: "{rounded.sm}"
---

# Design System: WikiHunt

## Overview

**Creative North Star: "The Departure Board"**

WikiHunt reads as a mechanical split-flap board at a terminal gate — the kind that once hung in every airport and train station, its characters flipping into place with an audible click. The product's own mechanism (racing from a shared origin article to a shared target through nothing but real links) maps directly onto that world's own grammar: a board that always shows FROM and TO, a clock that counts down in physical digits, and a status column that reads DEPARTED / EN ROUTE / BOARDING instead of drawing on the visitor's imagination.

This direction was assigned by a dice roll against six catalog challengers (an oscilloscope signal bench, a variable-font specimen, a gravity-rain garden, a Miura-fold deployable sheet, a design-annual plate section, and a zoo-and-gardens guide map), fused and weighed on audience identification and product clarity. None beat it outright; two — the oscilloscope's live-signal legibility and the guide-map's warm sense of journey — were strong enough to raise it. The physical scene forced the palette: someone glances at this from across a couch at a game night, the way you'd glance up at an actual departure board — so it reads dark not because dark is a template default, but because terminal boards are dark, lit from within.

**Key Characteristics:**
- Board black and gunmetal neutrals with exactly one accent — amber — the way a real split-flap board glows amber-on-black, never a rainbow of decorative color.
- Numbers a player must read under pressure (the timer, the room code, scores) render as physical flap cells with a visible split seam and a real flip transition, not plain digits.
- Corners are almost square — a split-flap board has no soft, pill-shaped chrome anywhere.
- Depth comes from a recessed-cell inset shadow (a character sunk into its board) and a hard-edged panel lip, never a soft ambient glow.
- Status is read as a word (DEPARTED / EN ROUTE / BOARDING) backed by a small square LED, not inferred from a colored dot alone.
- The Wikipedia article pane stays its authentic light-mode self at rest — the one deliberate exception to the board's otherwise all-dark, all-mechanical world — with a player-opt-in dark reading mode.

## Colors

Board Black and two steps of Gunmetal carry the whole shell; Amber Glow is the system's one accent, doing the work teal or violet might do elsewhere. A small, named status vocabulary (blue/green/red) exists because a real departure board itself uses colored status words against an otherwise monochrome face — it is motivated by the referent, not a "full palette" default.

### Primary
- **Amber Glow** (`#ffb020`): the system's one accent — primary buttons, the "you are here" flap cells, the boarding/near-target status, active tabs and difficulty selectors. Everything a player must act on or watch closely.
- **Amber Strong** (`#d98c00`): the pressed/focus register — input focus rings, hover states that need to read as "the same accent, one notch deeper."
- **Amber Ink** (`#1a1200`): text color used only on top of amber-filled surfaces (primary buttons), never as a standalone UI ink.

### Status Vocabulary (named, motivated by the referent)
- **En Route** (`#4f8fd1`): a player who hasn't yet reached a page linking to the target — the board's "in transit" blue.
- **Departed** (`#4ade80`): a player who has reached the target — the easy difficulty tier reuses this same green.
- **Delayed** (`#f35f5f` / bright stop `#f87171`): danger, destructive actions, the urgent final-seconds timer, and the hard difficulty tier — a real board's "problem" color.

### Neutral
- **Board Black** (`#0a0a0c`): page background, the recessed fill for every input, flap cell, and code chip — the board's own housing.
- **Gunmetal** (`#18181c`): card and panel background, the sidebar's flat surface.
- **Gunmetal Raised** (`#212126`): chips, leaderboard rows, toasts — the system's default "sits on a panel" surface.
- **Split Seam** (`#303036`): every border, divider, and the horizontal seam line inside a flap cell.
- **Flap Cream** (`#eae6da`): primary text — the off-white of a real flap character.
- **Panel Steel** (`#a3a5ac`): secondary text, field labels.
- **Faint Steel** (`#8d8f98`): placeholder text and the faintest captions; verified ≥4.5:1 against every surface in use, including Gunmetal Raised.

### Named Rules
**The One Glow Rule.** Amber is the system's only accent color. It never shares a component with a second saturated hue; the status vocabulary (blue/green/red) is locked to player/room state and never used decoratively.

## Typography

**Display Font:** Big Shoulders Display (with Archivo, system-ui fallback)
**Flap Font:** Big Shoulders Stencil Display — reserved for the Flap Display component only, its stencil cut literalizing the seam between a real flap's two halves.
**Body Font:** Archivo (with system-ui fallback)

**Character:** A no-nonsense grotesk carries every sentence a player reads; the display face is condensed, heavy, and shouts in uppercase the way gate signage does. The stencil face appears nowhere except inside an actual flap cell — it is a material signature, not a general display option.

### Hierarchy
- **Display** (800, uppercase, 15–21px in-game, 46px on the homepage hero): headings, the origin/target titles, section labels — always uppercase, never mixed-case.
- **Flap** (700, sized per cell, 14–40px): exclusively inside `.flap-cell` — the timer, the room code. Never used as ordinary running text.
- **Body** (400–600, 13–15.5px): paragraph copy, form fields, table cells.
- **Label** (700, 11–12.5px, uppercase, 0.04–0.1em tracking): stat labels, badges, field labels, breadcrumb text. 11px is the floor — nothing functional renders smaller.

### Named Rules
**The Flap-for-Numbers Rule.** Any number a player must read under time pressure — the timer, a room code, a score — renders through the Flap Display component, not as plain text in the display or body face.

## Layout

Two container widths: `1100px` (`.wrap`) for chrome-first pages (home, admin, host setup) and `1500px` for the in-game screen, with a fixed 230px sidebar beside the article pane. Responsive collapse points are unchanged from the previous system: `900px` stacks the game sidebar, `800px` drops chrome-page grids to one column, `700px` tightens the article pane's padding. Both the site topbar and the in-game header stay `position: sticky` with a frosted blur, matching a terminal's overhead board staying visible while you walk past it.

## Elevation & Depth

Nothing floats. A real board's characters sit recessed into steel housings, so every input, flap cell, and code chip uses an **inset** shadow (`--shadow-cell`) to read as sunk into the board rather than lifted off it. Panels and cards instead get a hard-edged **panel** shadow — stacked 1px/3px hairline offsets plus a tight, low-blur drop shadow — mimicking a physical bezel's lip, never a soft cinematic glow.

### Shadow Vocabulary
- **Panel Lip** (`0 1px 0 rgba(0,0,0,.9), 0 3px 0 rgba(0,0,0,.5), 0 3px 8px rgba(0,0,0,.35)`): cards, the sidebar, the article pane, toasts.
- **Recessed Cell** (`inset 0 2px 4px rgba(0,0,0,.6)`): inputs, flap cells, code chips — anything meant to read as a character sunk into the board.

### Named Rules
**The Recessed-or-Lipped Rule.** A surface is either a raised panel (Panel Lip, flat fill, no border-radius softness beyond the 6px ceiling) or a recessed cell (Recessed Cell shadow, board-black fill) — never a soft ambient glow, and never both treatments on the same element.

## Shapes

Corners are almost square: `2px` for buttons, inputs, badges, and flap cells; `4px` for the logo mark and icon tiles; `6px` for cards and the sidebar — the system's largest and only "soft" corner. The one exception is the `7px` status LED, radiused at `1px` rather than the `2px` scale step — a rounding that small reads as fully square on an element that tiny, so it drops one step to stay a true square. A `999px` pill exists solely as a spare token; the built system uses it nowhere; a true circle (were one ever needed) is the only case it should return for.

## Components

### Buttons
- **Shape:** `2px` radius on every variant, uppercase label, `0.06em` tracking.
- **Primary:** Amber Glow fill, Amber Ink text; hover shifts to a lighter amber tint rather than a filter brighten.
- **Ghost:** transparent fill, Split Seam border, Flap Cream text; hover fills with Gunmetal Raised.
- **Danger:** a 12%-opacity Delayed wash with full-opacity text; hover deepens to 22%.
- **Active state:** every button presses down `1px` (`translateY(1px)`) on `:active` — a physical toggle click, not a soft scale bounce.

### Flap Display (signature component)
The system's one true signature: any glance-read number renders as a row of `.flap-cell` elements, each a recessed board-black cell with a visible horizontal seam and Stencil-face type. On change, only the cells whose character actually changed animate — a quick vertical compression (`scaleY` toward zero) with the new character swapped at the midpoint — so a room code or countdown feels mechanically alive rather than just re-painted. Used for: the room code display, and the timer in both the host control screen and the player game screen.

### Badges & Status Tags
- **Difficulty badges:** board-black background, a `3px` colored left border standing in for a physical status flag, full-opacity tier-colored text — no pill, no tinted fill.
- **Player status:** a `7×7px` square LED (not a circle — nothing on this board is round) plus an uppercase status word (A CAMINHO / EMBARQUE / PARTIU), so status is legible by word as well as by color.
- **The Caos wildcard:** the one non-difficulty mode gets no new hue — it stays Amber Glow, the same as any other primary/active element, but its border switches to dashed. Dashed border means "unpredictable, not curated" everywhere it appears (this badge, the Caos selector button, the breadcrumb's ticket-stub styling for a visited-but-not-current stop) — a single motif reused for one meaning, not a one-off.

### Cards / Containers
- **Corner Style:** `6px` (Shapes' `lg` step).
- **Background:** flat Gunmetal — no gradient.
- **Shadow Strategy:** Panel Lip only (see Elevation & Depth); a thin Split Seam border.
- **Internal Padding:** `28px` (`.card-pad`).

### Inputs / Fields
- **Style:** Board Black fill, Split Seam border, `2px` radius, Recessed Cell shadow.
- **Focus:** Amber Strong border plus a soft amber focus ring — the system's one glow-like exception, reserved for the exact moment of active input.
- **Error:** a dedicated `.error-box` — Delayed-tinted wash and border, `role="alert"` for screen readers.

### Player Chips
- **Chip:** `2px`-radius rectangular tag, Gunmetal Raised fill, Split Seam border; drops to 45% opacity when a player disconnects; a `.me` chip gets an Amber Strong outline.

### Navigation
- **Topbar:** sticky, frosted board-black glass, Split Seam bottom border, logo mark (a single stenciled "W" in its own recessed cell) + wordmark left.
- **In-game header:** the same sticky-glass treatment, carrying the Origin → Target path, live stats (with the timer as a Flap Display), and a dark-mode toggle for the article pane, top-right.
- **Tabs:** rectangular, uppercase, inactive Gunmetal fill with Panel Steel text, active Amber Glow fill with Amber Ink text.

### The Article Pane (exception, by design)
Real, sanitized Wikipedia HTML rendered on its authentic light background (`#ffffff`, `#202122` text, `#0645ad` links) — the one place the board's all-dark, all-mechanical world deliberately steps aside, because the content's authenticity is the point. A player-triggered dark-reading toggle exists as an explicit opt-in, inverting the pane's colors (`filter: invert(1) hue-rotate(180deg)`, with images/video re-inverted so photos stay correct) without re-theming Wikipedia's own markup piece by piece.

### Origin → Target Path
A compact two-node path lives in the in-game header at all times — Origin in dim Panel Steel, Target in Amber Glow — so a player never loses track of where they started. The host's control screen carries the same grammar at a larger scale (`.path-line`).

### Toasts & the Host Banner
Toasts carry two registers: **hype** (Amber) for exciting-but-fine news (an opponent finishing, sudden death triggering) and **warn** (Delayed) reserved for actual problems. Depth comes from the Panel Lip shadow plus an inset ring for color, never a `border` property stacked on the outer shadow. A host disconnect additionally promotes to a persistent sticky banner — a state that can last 45 seconds needs standing presence, not a toast that fades in 3.5.

### Breadcrumb (rewind mechanic)
The breadcrumb is a real navigation control: every visited article except the current one renders as a real `<button>` styled like a torn ticket stub (a dashed bottom edge), and clicking it re-navigates there at the cost of one click, same as any other link. The current position is the non-interactive, Amber-highlighted stub at the end of the trail.

## Do's and Don'ts

### Do:
- **Do** render any glance-read number through the Flap Display component (the Flap-for-Numbers Rule) — never as plain display-face text.
- **Do** keep Amber Glow as the system's only accent (the One Glow Rule); the status vocabulary is locked to player/room state, never decorative.
- **Do** give status its own word (A CAMINHO / EMBARQUE / PARTIU), not just a colored LED — color alone is never the only signal.
- **Do** keep every surface either a raised panel or a recessed cell (the Recessed-or-Lipped Rule), never a soft ambient glow.
- **Do** keep the article reading pane in its authentic light-mode Wikipedia styling at rest — the deliberate exception to the board's dark world.
- **Do** keep the game screen's own containers (header, sidebar, article) edge-aligned with the topbar's logo at any viewport width — padding, never a centered max-width island, so the sides never read as broken or asymmetric.

### Don't:
- **Don't** round a corner past `6px` — this board has no pill-shaped chrome anywhere.
- **Don't** introduce a text color below 4.5:1 contrast against any of the three neutral surfaces (Board Black, Gunmetal, Gunmetal Raised).
- **Don't** set functional UI text below `11px` — the label floor.
- **Don't** reach for a soft ambient drop shadow; depth comes from the Panel Lip or Recessed Cell treatments only.
- **Don't** restyle the article pane toward a casual mobile-app look — real Wikipedia content has to read as serious and trustworthy.
- **Don't** use emoji or icon glyphs anywhere in the interface — a real departure board speaks only in words and flap characters; every icon that would have been an emoji is a short uppercase text tag instead (gate codes on the homepage, status words in chips, `NOITE`/`DIA` on the reading-mode toggle).
