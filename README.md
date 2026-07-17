# Letterboxd Vizard

Drop your Letterboxd data-export zip and get visualizations of your film history:
world maps of how many films you watched per country and how you rate them, rating
habits vs TMDB, watches over time, genres, languages, directors and actors.

Your export is parsed entirely in the browser - only film titles and years are sent
to the server to look up metadata on TMDB. Lookups are cached in SQLite so each film
is fetched from TMDB at most once, no matter how many users analyze it. The cache is a
Cloudflare D1 database when deployed to Workers, or a local `better-sqlite3` file when
self-hosted - the app picks the backend automatically.

## Setup

```sh
npm install
cp .env.example .env   # put your TMDB API key in .env
```

Get a free TMDB API key at themoviedb.org → Settings → API. Both v3 keys and v4 read
access tokens work.

Optional extras in `.env`:

- `TRAKT_CLIENT_ID` (trakt.tv → Settings → Your API Apps) enables the
  "You might like" recommendations section.
- `TVDB_API_KEY` (thetvdb.com/api-information) adds a last-resort series lookup
  for titles TMDB doesn't know; without it, TMDB's own TV search is still used.

Get your Letterboxd export at letterboxd.com → Settings → Data → Export your data.

## Choosing a target

The `DEPLOY_TARGET` env var selects how the app is built and where the cache lives:

- unset / `cloudflare` (default) — Cloudflare Workers with a D1 cache.
- `node` — a plain Node server (`adapter-node`) with a local SQLite cache in
  `data/cache.db` (override with `CACHE_DB_PATH`). Use this for Docker or your own
  infrastructure; no Cloudflare account or tooling required.

## Run locally

Node (SQLite, no Cloudflare tooling):

```sh
npm run dev:node
```

Or against the Cloudflare D1 emulator (matches production):

```sh
npx wrangler d1 execute letterboxed-vizard-db --local --file=schema.sql   # once, and after schema changes
npm run dev
```

## Self-host with Docker

```sh
cp .env.example .env   # put your API keys in .env
docker compose up -d --build
```

Serves on port 3000. Set `ORIGIN` in `.env` to your public URL (defaults to
`http://localhost:3000`) so form submissions aren't rejected. The TMDB cache is
persisted on the host in `./data` via a bind mount.

## Self-host without Docker

```sh
npm run build:node
node build
```

Runs a Node server (`adapter-node`). The TMDB cache lives in `data/cache.db`.

## Deploy to Cloudflare

The app deploys to Cloudflare Workers, with the TMDB cache in a D1 database.
At hobby traffic the whole stack fits Cloudflare's free tier. One-time setup:

```sh
npx wrangler login
npx wrangler d1 create letterboxed-vizard-db --jurisdiction eu
# paste the printed database_id into wrangler.jsonc
npx wrangler d1 execute letterboxed-vizard-db --remote --file=schema.sql
npx wrangler secret put TMDB_API_KEY
# optional: repeat for TRAKT_CLIENT_ID and TVDB_API_KEY
```

Then deploy (and redeploy) with:

```sh
npm run deploy
```

## AI disclaimer

This project was written with the help of an AI coding assistant, guided, reviewed and tested by a human.
