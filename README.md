# Letterboxd Vizard

Drop your Letterboxd data-export zip and get visualizations of your film history:
world maps of how many films you watched per country and how you rate them, rating
habits vs TMDB, watches over time, genres, languages, directors and actors.

Your export is parsed entirely in the browser - only film titles and years are sent
to the server to look up metadata on TMDB. Lookups are cached in SQLite so each film
is fetched from TMDB at most once, no matter how many users analyze it.

## Setup

```sh
npm install
cp .env.example .env   # put your TMDB API key in .env
npm run dev
```

Get a free TMDB API key at themoviedb.org → Settings → API. Both v3 keys and v4 read
access tokens work.

Optional extras in `.env`:

- `TRAKT_CLIENT_ID` (trakt.tv → Settings → Your API Apps) enables the
  "You might like" recommendations section.
- `TVDB_API_KEY` (thetvdb.com/api-information) adds a last-resort series lookup
  for titles TMDB doesn't know; without it, TMDB's own TV search is still used.

Get your Letterboxd export at letterboxd.com → Settings → Data → Export your data.

## AI disclaimer

This project was largely written with the help of an AI coding assistant
(Claude Code), guided, reviewed and tested by a human.

## Production

```sh
npm run build
node build
```

Runs a Node server (adapter-node). The TMDB cache lives in `data/cache.db`.
