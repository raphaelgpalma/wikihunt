# WikiHunt

A self-hosted, real-time Wikipedia wikirace party game. Players race from a shared start article to a shared target article using only in-article links — first to arrive wins the round, and once someone finishes, everyone else's remaining time drops to 30 seconds.

No player accounts, ever — just a nickname and a room code. The host plays too (a lone host can even play solo).

## Features

- **Admin-curated word pairs**, rated by difficulty (easy / medium / hard) — plus a **Caos** mode that draws two random articles live instead, for unpredictable rounds.
- **PT/EN language support** per room — articles are resolved to the equivalent page in the other language via Wikipedia's own interlanguage links.
- **Live shortest-path lookup**: after each round, the app searches Wikipedia's real link graph (a bounded bidirectional search, not a precomputed index) and shows the actual shortest click path between the two articles.
- **Session resume**: refresh the page (F5) mid-game and pick up exactly where you left off — score, round, and article position all survive.
- **Play again**: after a match ends, the host can start a fresh match in the same room with the same connected players, no new code needed.
- **Dark reading mode** for the article pane, a departure-board-style interface, and a redirect/alias-aware proximity indicator so "how close am I" is accurate even when a link goes through a redirect.

## Requirements

- Node.js 18 or later (uses the native `fetch` API — no extra HTTP client dependency)
- No database — a local JSON file holds admin accounts, room codes, and word pairs; room/match state lives in memory and resets when the server restarts

## Setup

```bash
git clone https://github.com/raphaelgpalma/wikihunt.git
cd wikihunt
npm install
cp .env.example .env
```

Edit `.env` and set your own `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and `JWT_SECRET` (a long random string) before running this anywhere other than your own machine.

| Variable | Purpose | Default |
|---|---|---|
| `PORT` | HTTP port the server listens on | `3000` |
| `JWT_SECRET` | Signs admin session tokens | — |
| `ADMIN_USERNAME` | First admin account, created on first run if none exist | `admin` |
| `ADMIN_PASSWORD` | Password for that first admin account | `admin123` |
| `WIKI_LANG` | Default/curation language for word pairs (`pt` or `en`) | `pt` |

## Running

```bash
npm start        # plain run
npm run dev       # restarts automatically on file changes
```

Then open `http://localhost:3000`. The console prints the exact URL once the server is up.

On first run, an admin account is seeded from `ADMIN_USERNAME`/`ADMIN_PASSWORD`, and a handful of example word pairs are seeded across all three difficulties — enough to try a match immediately.

## How a match works

1. **Admin** logs in at `/admin.html`, generates one-time room codes, and curates word pairs (start article, target article, difficulty).
2. **Host** claims a code at `/host.html`, picks difficulty (or Caos), language, round count, and time per round, then creates the room. The host is automatically a player too.
3. **Players** join at `/room.html` with the room code and a nickname (or the host can send them a link with the code pre-filled).
4. Everyone races from the same start article to the same target article by clicking only real in-article links. Once someone arrives, everyone else gets 30 seconds left.
5. After each round, see the results, the leaderboard, and (when it resolves in time) the actual shortest path between the two articles.

## Deployment note

This runs as a single long-lived Node process (Express + Socket.io) with in-memory room state and a local JSON file for persistence. It is **not** compatible with serverless platforms like Vercel — Socket.io needs a persistent connection, and the in-memory/file-based state needs a single process that stays alive. It runs as-is on any host that keeps a Node process running: a VPS, Railway, Render, Fly.io, or your own machine on a local network.

## License

ISC
