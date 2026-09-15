---
target: public/room.html (in-game screen)
total_score: 22
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 3
target_identity: "file:C:\\Users\\rapha\\wikihunt\\public\\room.html"
target_fingerprint: "sha256:3075085d436cdd1ca3e5faeed0e46f04ae59a8a7c0f0093a1209c193c58787eb"
target_path: "C:\\Users\\rapha\\wikihunt\\public\\room.html"
timestamp: 2026-09-15T11-48-58Z
slug: public-room-html
---
Method: dual-agent (A: design-review agent · B: detector-evidence agent)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3/4 | No self-marker in the live player sidebar during a race |
| 2 | Match System / Real World | 3/4 | Casual pt-BR copy matches product tone |
| 3 | User Control and Freedom | 2/4 | Breadcrumb is a passive log — no undo/back for a mis-click |
| 4 | Consistency and Standards | 2/4 | `.crumb` reuses clickable-button visual language while being inert |
| 5 | Error Prevention | 2/4 | Nothing prevents/confirms an accidental link click mid-race |
| 6 | Recognition Rather Than Recall | 3/4 | `.sidebar-legend` keeps the color key permanently visible |
| 7 | Flexibility and Efficiency | 1/4 | No accelerators, no remembered room code, nothing for repeat players |
| 8 | Aesthetic and Minimalist Design | 3/4 | Disciplined header; long titles can break layout (no max-width) |
| 9 | Error Recovery | 1/4 | Raw `Erro ao carregar artigo: ${err.message}` with no retry |
| 10 | Help and Documentation | 2/4 | Sudden-death rule explained only after it fires, via toast |
| **Total** | | **22/40** | **Acceptable** |

## Design Specificity Verdict

**LLM assessment**: Atmospherically specific (navy shell, single teal accent, Space Grotesk numerals, authentic white Wikipedia island) but interaction-generically composed — presence chips, toast stack, breadcrumb are the same shapes any real-time collab tool uses. Nothing in the composition itself evokes "hunt" or "race" beyond the four-color dot code. Verdict: strong visual identity, generic interaction identity.

**Deterministic scan**: 44 raw detector hits (room.html + CSS) reduced to 20 real issues after line-by-line verification against DESIGN.md. 6 confirmed false positives (amber Status Glow, 9px logo radius, the 4 authentic Wikipedia colors) plus 17 "likely false positive" font-size hits that fall inside DESIGN.md's prose-documented ranges but outside its two literal frontmatter tokens — reinforces the type-scale coverage gap already logged in the technical audit. Real confirmed issues: text-faint contrast (8 occurrences, now shown to hit gameplay-relevant text — target label, stats, breadcrumb), width-based timer-bar transition (2 occurrences), 3 minor undocumented color drifts (`#1a2a2c`, `rgba(255,255,255,0.2)`, `#f87171` — a near-duplicate of `--rose`, already flagged in the audit), one radius outlier, one font-size outlier.

**Browser visualization**: unavailable in this environment (no browser automation tool exposed); findings are source-level + deterministic scan only.

## Overall Impression

The visual system is well-established and authentic, but the *play* experience is still generic — the issues that hurt most aren't aesthetic, they're recognition-under-pressure: not knowing which chip is yours, a breadcrumb that looks clickable but isn't, and a 3.5s toast for a crisis that can last 45 seconds. The biggest opportunity isn't recoloring — it's giving the game screen an interaction identity as specific as its visual one.

## What's Working

1. The article pane's authenticity is executed precisely as designed (`#ffffff`/`#202122`/`#0645ad` hardcoded regardless of theme).
2. The sticky glass header genuinely serves the "operate" use case — target/stats/timer stay visible while an arbitrarily long article scrolls beneath.
3. Session-resume architecture (`resumeIntoRound`) is a real, non-generic investment for a casual friend-group audience that will refresh mid-game.

## Priority Issues

**[P0] Host-disconnect state is a transient toast for a potentially 45-second-long crisis**
- Why it matters: `toast()`'s fixed 3.5s auto-removal applies uniformly, so the moment players most need ongoing reassurance gets the shortest-lived treatment in the system.
- Fix: promote `host:disconnected` to a persistent banner in `.game-header` that stays until `host:reconnected` or `room:closed`.
- Suggested command: /impeccable harden

**[P1] No self-identification in the live player sidebar**
- Why it matters: every chip in `renderSidebar()` looks identical; the leaderboard already solves this with `.leaderboard-row.me`, the live sidebar doesn't.
- Fix: apply a `.me` class to the local player's chip, reusing the existing pattern.
- Suggested command: /impeccable clarify

**[P1] Breadcrumb crumbs look clickable but aren't**
- Why it matters: `.crumb` shares the pill/border language of actually-clickable tab buttons; `renderBreadcrumb()` never attaches a handler — a false affordance with no other undo mechanism in the game.
- Fix: either wire clicks to re-navigate, or strip the button-like styling.
- Suggested command: /impeccable clarify

**[P1] Timer number never escalates, only the hairline bar does**
- Why it matters: `.urgent` only applies to the 5px bar; `#timerText` stays the same weight/color at 3s as at 180s, under real race stress.
- Fix: apply the same urgent treatment (color shift, pulse) to the timer number itself — DESIGN.md's own Display-for-Numbers Rule case.
- Suggested command: /impeccable animate

**[P2] Toast semantics collapse three emotional registers into one style**
- Why it matters: opponent-finish (exciting), sudden-death (tense), and host-disconnect (alarming) all render as the same rose `.toast.warn`.
- Fix: add a non-alarming "hype" toast style (teal/amber) for progress events, reserve rose for actual problems.
- Suggested command: /impeccable colorize

## Persona Red Flags

**Riley (stress tester)**: a long article title in `.target-title` (no max-width/text-overflow) can push `.game-stats` to wrap, changing header height round to round. 8+ players grow `.game-sidebar` with no max-height/overflow-y. Near-simultaneous finishes stack unlimited toasts in `.toast-area`.

**Jordan (first-timer)**: dropped into `#gameScreen` with no rules recap — sudden-death is explained only after it fires, via toast. The one teaching surface, `.sidebar-legend`, is the same low-contrast element already flagged.

**Sam (accessibility-dependent)**: proximity signal is hue-only (blue/amber/rose dots), no shape/icon/text redundancy; amber/rose are adjacent warm hues, a classic hard case for red-green color deficiency. `#toastArea` has no `aria-live` — game events are silent to screen readers.

## Minor Observations

- Click counter increments even when navigation fails, inflating the stat without a successful nav.
- Fetch-error color (`#a00` in room.js) is a raw hex outside the token palette.
- Inline 40px 🎉 emoji is a decorative flourish inconsistent with the system's otherwise disciplined restraint.
- `#timerText` can jump from "1" straight to stopping, never showing "0".
- Near-duplicate red (`#f87171` vs `--rose`) already on the audit's radar.

## Questions to Consider

- What if the breadcrumb were a real mechanic — a clickable "rewind" — instead of a passive log?
- What if the sudden-death window had spatial presence beyond the header (a vignette on the article shell) so the tension is felt while reading, not just in a thin bar?
- What if losing had its own small moment of recognition on the final screen, instead of only the winners' leaderboard?
