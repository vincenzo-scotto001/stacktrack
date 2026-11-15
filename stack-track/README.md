# StackTrack

Track your poker tournaments, see your real results after action sold, plan series, and follow your friends.
React 19 + Supabase, installable as a PWA.

## Run it

```bash
npm install
npm start
```

Create a `.env` file (it's git-ignored) with your Supabase project's values:

```
REACT_APP_SUPABASE_URL=https://xxxx.supabase.co
REACT_APP_SUPABASE_ANON_KEY=eyJ...
```

### Demo mode

Try every screen with sample players and results, without touching your database:

```bash
REACT_APP_DEMO=true npm start
```

Sign in with any email and password. Data resets when you reload. Demo code is stripped from production builds (see `.env.production`).

### Database

The SQL migrations are kept out of this repo. Run them in your Supabase SQL editor, in order:

1. `001_features.sql` turns on profiles, notifications and more.
2. `002_security.sql` adds row-level security. Run it before more people sign up.
3. `003_tournament_catalog.sql` turns on tournament search: players pick a tournament instead of typing it.

If you keep them in a `supabase/` folder here, it's git-ignored.

### Tournament catalog

The Add tournament and Journey screens suggest tournaments as you type, and picking one fills in the venue, date and buy-in. Suggestions come from two places:

- **Community:** every tournament anyone logs (including CSV imports) adds an anonymous catalog entry. Other players only see an entry once at least 2 different players have logged it, so home games stay private. You always see your own.
- **Official schedules:** admins load series schedules on the **Schedules** page (`/admin/schedules`) by pasting rows from a spreadsheet or uploading a CSV. A row has a Date (or a Day like `Monday` / `Daily` for weekly events), an Event and a Buy-in, plus an optional Time, #, Game, GTD and Venue. Admins are added in the Supabase SQL editor (see the migration's header).

## Scripts

| Command | |
|---|---|
| `npm start` | Dev server |
| `npm test` | Unit tests (stats math, CSV import/export, formatting) |
| `npm run build` | Production build |

## What's where

```
src/
  api/          All Supabase calls. Pages never query Supabase directly.
  lib/          Pure logic with tests: stats.js (ROI, streaks, drawdown…), csv.js, format.js
  context/      AuthContext (session, profile, feature detection), UIContext (toasts, confirm dialogs)
  pages/        One file per route
  components/   Shared UI: layout/ (shell, nav, guards), ui/, charts/, feed/
  styles/       tokens.css (colours, type, spacing) → base → components → layout → pages
  demo/         In-memory Supabase stand-in for demo mode
public/
  serviceWorker.js  Offline app shell; never caches Supabase data
```

## How results are counted

- **Buy-in** is the total you paid, including re-entries.
- **Action sold** is the % of your action backers bought at 1.0 markup.
- **Your result** = (winnings − buy-in) × (1 − sold). ROI, the bankroll graph, the leaderboard and every stat use this, so they reflect only your share.
