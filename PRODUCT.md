# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Three roles, no player accounts:
- **Admin**: administers the site itself — manages other admin accounts, generates one-time room-join codes, and curates the start/target Wikipedia article pairs (classified easy/medium/hard).
- **Host**: claims a room code, configures a single match (difficulty, number of rounds, seconds per round), and manages it live (start, skip round). Always plays too — the host is a normal participant with host privileges layered on, not a separate spectator role, so a lone host can play solo.
- **Players**: join a room with just a nickname + room code and race through real Wikipedia articles by clicking only internal links.

Primary audience: a small closed group of friends/family playing together for fun (e.g. a game night), not the general public. No need to design for strangers, abuse-resistance at scale, or high concurrency.

## Product Purpose

A self-hosted, customizable Wikirace party game: two or more players race from a shared start Wikipedia article to a shared target article using only in-article links. WikiHunt adds real-time multiplayer rooms, host-configurable difficulty/timing, a sudden-death 30-second cutoff once the first player finishes a round, and a live per-player proximity indicator so spectating players stay engaged.

## Positioning

Unlike open/public Wikirace tools that pick random article pairs or compute link-distance automatically, WikiHunt is admin-curated by default: an admin hand-picks and difficulty-rates the word pairs and gates room creation with single-use codes, so a host runs a private match with parameters they control rather than relying on public matchmaking or an automated distance metric. A host may opt into a fourth mode, "Caos," which draws two live random articles per round instead of a curated pair — an explicit, host-chosen wildcard alongside curation, not a replacement for it.

## Operating Context

Runs as a local Node.js server (Express + Socket.io) opened in the browser by people on the same network; no login for players, just a nickname and a room code shared by the host. Room/match state is in-memory and ephemeral (lost on server restart); admin data (word pairs, admin accounts, room codes) persists to a local JSON file. Real Wikipedia content is fetched and sanitized server-side (non-article links disabled, internal links rewritten) so races run against live pt.wikipedia.org articles by default (language configurable).

## Capabilities and Constraints

- Admin: manage admin accounts, generate/revoke one-time room codes (one code = one room), CRUD curated word pairs with difficulty tiers.
- Host: claim a room code, pick one difficulty for the whole match (easy/medium/hard, or the "Caos" wildcard mode), set round count and per-round time limit, start the match, skip to the next round. Also plays as a normal participant in the same room — can play solo with no one else — and can start a fresh match in the same room afterward, keeping the same connected players.
- Players: join with nickname + code (name must be unique per room); score by finish rank; once the first player reaches the target, remaining time for everyone else drops to 30 seconds.
- Both host and players can refresh the page (F5) mid-game and resume exactly where they were (score, current round, article position) via a session token; a disconnected host gets a 45-second grace window before the room is closed for everyone.
- No persistent match history/analytics beyond the live session; no player accounts.
- Undecided: whether to eventually add match history, player accounts, or finer-grained admin permissions (today any admin can do everything).

## Brand Commitments

Name: "WikiHunt". Existing visual identity already implemented: dark UI with a teal/violet accent palette, Space Grotesk for display type and Inter for UI text, a Wikipedia-authentic reading pane for the article view. Treat this as the incumbent design system, not open ground.

## Evidence on Hand

None — personal/hobby project for private use, no testimonials, case studies, or user research to draw on. Do not fabricate any.

## Product Principles

- Casual-first: optimize for a fun private game night, not enterprise robustness, public abuse-resistance, or scale.
- Frictionless joining: no accounts, ever — a nickname and a room code is the entire "login."
- Admin curates fairness: word-pair difficulty is an editorial human judgment, not an automated graph-distance score.
- Host owns pacing, not content: a host configures rounds/timing/difficulty but never touches the word-pair library or site-wide settings.
- Live feedback keeps everyone in the race: real-time signals (proximity dots, arrival toasts, the sudden-death countdown) matter as much for spectating players as for whoever is currently ahead.
