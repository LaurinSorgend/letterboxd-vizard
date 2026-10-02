# Architecture

Letterboxd Vizard is a SvelteKit app. The user's export zip is parsed **in the browser**; only film
titles and years go to the server, which looks them up on TMDB (plus OMDb and TheTVDB as optional
extras) and caches the answers in SQLite. All charts are computed client-side from the enriched
library.

## 1. System overview

```mermaid
flowchart LR
    user([User]) -->|drops export .zip| browser

    subgraph browser["Browser (SvelteKit client)"]
        direction TB
        page["routes/+page.svelte<br/>state machine: idle / working / ready"]
        parse["ingest/parse.ts<br/>parseExport()"]
        enrichClient["ingest/enrich.ts<br/>runRounds() batching + retry"]
        store["store.ts<br/>localStorage snapshot"]
        viz["viz/*<br/>pure stats + Svelte charts"]
        wrapped["wrapped/*<br/>year-in-review deck"]
        page --> parse --> enrichClient
        page <--> store
        page --> viz
        page --> wrapped
    end

    subgraph server["Server (Cloudflare Worker or Node)"]
        direction TB
        hooks["hooks.server.ts<br/>mints session cookie"]
        api["routes/api/*<br/>enrich, omdb-enrich,<br/>collections, recommend"]
        guard["session.ts + ratelimit.ts<br/>+ budget.ts"]
        clients["tmdb.ts / tvdb.ts / omdb.ts / related.ts"]
        cache["cache.ts"]
        db["db.ts getDb()"]
        api --> guard
        api --> clients
        api --> cache --> db
    end

    enrichClient -->|"POST batches (titles + years only)"| api
    hooks -.->|"lv_session cookie"| page

    clients -->|HTTPS| tmdb[(TMDB)]
    clients -->|HTTPS| omdb[(OMDb)]
    clients -->|HTTPS| tvdb[(TheTVDB)]

    db --> d1[("Cloudflare D1")]
    db --> sqlite[("better-sqlite3<br/>data/cache.db")]
```

## 2. Use cases

```mermaid
flowchart LR
    viewer([Letterboxd user])
    host([Self-hoster / operator])

    subgraph app[Letterboxd Vizard]
        uc1(Upload export zip)
        uc2(Explore visualizations)
        uc3(Filter by metric / country / year)
        uc4(Get recommendations)
        uc5(Watch year-in-review deck)
        uc6(Save a share card)
        uc7(Remember library on this device)
        uc8(Compare ratings: TMDB / IMDb / RT / Metacritic)
        uc9(Switch theme)
        uc10(Deploy to Workers or Node/Docker)
        uc11(Configure API keys + limits)
    end

    viewer --- uc1 & uc2 & uc3 & uc4 & uc5 & uc6 & uc7 & uc9
    uc2 -.->|includes| uc8
    uc1 -.->|includes| enrichuc(Enrich with metadata)
    uc8 -.->|needs OMDB_API_KEY| uc11
    host --- uc10 & uc11
```

## 3. Upload and enrichment flow

```mermaid
sequenceDiagram
    autonumber
    actor U as User
    participant P as +page.svelte
    participant PA as parse.ts
    participant E as enrich.ts (client)
    participant H as hooks.server.ts
    participant A as /api/enrich
    participant C as cache.ts
    participant T as tmdb.ts
    participant X as TMDB / TheTVDB

    U->>P: GET /
    P->>H: request
    H-->>P: Set-Cookie lv_session (HMAC, 6h)
    U->>P: drop zip
    P->>PA: parseExport(bytes)
    PA-->>P: LetterboxdData {films, watchlist, profile}
    P->>E: enrichFilms(films) and enrichFilms(watchlist)
    loop runRounds (max 8 rounds, 2 batches in flight)
        E->>A: POST {items: name+year}
        A->>A: requireSession + checkRateLimit
        A->>C: getCachedMany(keys)
        C-->>A: hits and fresh misses
        A->>T: lookupMovie(budget, name, year) for unknown keys
        T->>X: search / details (each costs 1 budget unit)
        X-->>T: JSON
        T-->>A: TmdbMovie or null
        A->>C: putCachedMany(resolved)
        A-->>E: {results, pending[]}
        Note over E: pending indices (budget hit) are re-queued next round
    end
    E-->>P: films with tmdb
    P->>E: enrichOmdb(imdbIds) via /api/omdb-enrich
    P->>E: fetchCollections(ids) via /api/collections
    P->>P: films = EnrichedFilm[], phase = ready
    P->>P: saveSnapshot() if "remember" is on
```

## 4. TMDB lookup strategy (`lookupMovie`)

```mermaid
flowchart TD
    start([name, year]) --> hasYear{year known?}
    hasYear -- yes --> m1[search movie with year]
    m1 -->|hit| rec
    m1 -->|miss| t1[search tv with year]
    t1 -->|hit| rec
    t1 -->|miss| tvdb
    hasYear -- no --> tvdb[TheTVDB series lookup<br/>needs TVDB_API_KEY]
    tvdb -->|hit| done
    tvdb -->|miss| loose[loose search movie + tv<br/>lazily, once each]
    loose --> tiers["tiers: movie+year match, tv+year match,<br/>any movie, any tv"]
    tiers -->|first hit| rec[fetchRecord<br/>details + credits + keywords + external_ids<br/>in ONE request]
    tiers -->|none| nul([null: cached as a miss, 30d TTL])
    rec --> done([TmdbMovie])
```

## 5. Server request guards

```mermaid
flowchart LR
    req[POST /api/*] --> s{valid lv_session<br/>cookie?}
    s -- no --> r403[403]
    s -- yes --> rl{rate limiter bound<br/>and under limit?}
    rl -- no --> r429[429]
    rl -- yes --> v{"body valid and<br/>batch at most 100?"}
    v -- no --> r400[400]
    v -- yes --> cache[batched cache read]
    cache --> fetch["fetch misses<br/>pLimit(5) + FetchBudget(40)"]
    fetch -->|budget exhausted| pend[add to pending]
    fetch --> put[batched cache write]
    pend --> resp
    put --> resp["200 {results, pending}"]
```

## 6. Server classes and modules

```mermaid
classDiagram
    direction LR

    class FetchBudget {
        -remaining: number
        -reserve: number
        +exhausted: boolean
        +take()
        +tryTake() boolean
        +releaseReserve()
    }
    class BudgetExhausted
    Error <|-- BudgetExhausted
    FetchBudget ..> BudgetExhausted : throws

    class Cache {
        <<module cache.ts>>
        +cacheKey(name, year) string
        +getCachedMany(db, keys)
        +putCachedMany(db, entries)
        +getRelatedCachedMany()
        +putRelatedCachedMany()
        +getCollectionsCachedMany()
        +putCollectionsCachedMany()
        +getOmdbCachedMany()
        +putOmdbCachedMany()
    }
    class Db {
        <<module db.ts>>
        +getDb(platform) D1Database
    }
    class LocalDb {
        <<module local-db.ts>>
        +localDb() D1Database
    }
    class Tmdb {
        <<module tmdb.ts>>
        +tmdbGet(budget, path, params)
        +lookupMovie(budget, name, year)
        +fetchRecord(budget, kind, id)
        +fetchCollection(budget, id)
    }
    class Tvdb {
        <<module tvdb.ts>>
        +lookupSeriesOnTvdb()
    }
    class Omdb {
        <<module omdb.ts>>
        +fetchOmdbRatings(budget, imdbId)
    }
    class Related {
        <<module related.ts>>
        +relatedMoviesMany(db, budget, limit, ids)
    }
    class Session {
        <<module session.ts>>
        +mintSessionToken(secret)
        +verifySessionToken(secret, token)
        +requireSession(cookies)
    }
    class RateLimit {
        <<module ratelimit.ts>>
        +checkRateLimit(limiter, key)
    }

    Db --> LocalDb : self-host fallback
    Cache ..> Db : receives D1Database
    Cache ..> FetchBudget
    Tmdb ..> FetchBudget
    Tvdb ..> FetchBudget
    Omdb ..> FetchBudget
    Tmdb ..> Tvdb : fallback
    Related ..> Tmdb : tmdbGet
    Related ..> Cache
```

## 7. Data model

### Domain types (`lib/types.ts`)

```mermaid
classDiagram
    direction TB
    class LetterboxdData {
        films: Film[]
        watchlist: WatchlistEntry[]
        profile: Profile?
    }
    class Film {
        uri
        name
        year?
        rating?
        liked
        review?
        watchedDates: string[]
        rewatch
        tags: string[]
    }
    class DiaryEntry {
        date
        rating?
        rewatch
    }
    class WatchlistEntry {
        uri
        name
        year?
        added?
    }
    class Profile {
        username
        givenName
        dateJoined
        location
    }
    class TmdbMovie {
        tmdbId
        mediaType: movie|tv
        title
        year?
        countries
        genres
        runtime?
        releaseDate?
        originalLanguage?
        voteAverage?
        voteCount?
        posterPath?
        keywords
        imdbId?
    }
    class Person {
        name
        tmdbId?
        profilePath?
    }
    class Collection {
        id
        name
        posterPath?
    }
    class CollectionParts {
        id
        name
        total
    }
    class OmdbRatings {
        imdbRating?
        imdbVotes?
        rottenTomatoes?
        metascore?
    }
    class EnrichedFilm {
        tmdb: TmdbMovie?
        omdb: OmdbRatings?
    }
    class Snapshot {
        <<localStorage>>
        films: EnrichedFilm[]
        watchlist
        watchlistIds
        profile
        collections
    }

    LetterboxdData *-- Film
    LetterboxdData *-- WatchlistEntry
    LetterboxdData o-- Profile
    Film *-- DiaryEntry : entries
    Film <|-- EnrichedFilm
    EnrichedFilm o-- TmdbMovie
    EnrichedFilm o-- OmdbRatings
    TmdbMovie *-- Person : directors, cast
    TmdbMovie o-- Collection
    Collection ..> CollectionParts : sized via /api/collections
    Snapshot o-- EnrichedFilm
    Snapshot o-- CollectionParts
```

### Cache tables (`schema.sql`)

```mermaid
erDiagram
    movies {
        TEXT cache_key PK "v6::lowercased name::year"
        INTEGER tmdb_id
        TEXT data "JSON TmdbMovie"
        INTEGER fetched_at
    }
    misses {
        TEXT cache_key PK
        INTEGER fetched_at "TTL 30d"
    }
    related {
        INTEGER tmdb_id PK
        TEXT data "JSON RelatedMovie[]"
        INTEGER fetched_at "TTL 90d"
    }
    collections {
        INTEGER collection_id PK
        TEXT data "JSON CollectionParts"
        INTEGER fetched_at
    }
    omdb {
        TEXT imdb_id PK
        TEXT data "JSON OmdbRatings"
        INTEGER fetched_at
    }
    omdb_misses {
        TEXT imdb_id PK
        INTEGER fetched_at "TTL 30d"
    }
    movies ||--o| related : "tmdb_id"
    movies }o--o| collections : "data.collection.id"
    movies }o--o| omdb : "data.imdbId"
```

## 8. Recommendations flow

```mermaid
sequenceDiagram
    actor U as User
    participant R as Recommendations.svelte
    participant S as viz/seeds.ts
    participant A as /api/recommend
    participant RL as related.ts
    participant C as cache.ts
    participant T as TMDB

    R->>S: seeds from watched + rated films
    R->>A: POST {seeds (max 25), exclude[]}
    A->>RL: relatedMoviesMany (budget reserve = 15)
    RL->>C: getRelatedCachedMany
    RL->>T: /movie/:id/recommendations for cache misses
    RL->>C: putRelatedCachedMany
    alt every seed failed
        A-->>R: {available: false}
    else
        A->>A: score += max(0.5, rating - 2.5) per related film
        A->>A: releaseReserve(), take top 20
        A->>C: getCachedMany (poster + countries)
        A->>T: fetchRecord for uncached (may be pending)
        A-->>R: {available: true, results[]}
    end
    R-->>U: ranked suggestions, optionally per country
```

## 9. Client-side visualization layer

Charts are thin Svelte components over pure TypeScript functions that take `EnrichedFilm[]`, so the
statistics are unit-testable without a DOM.

```mermaid
flowchart TD
    films[("films: EnrichedFilm[]")]

    films --> stats["viz/stats.ts<br/>byGenre, byPerson, byCollection,<br/>watchesPerYear, runtimeBuckets, ..."]
    films --> heat["viz/heatmap.ts<br/>daily / weekly / seasonal grids"]
    films --> net["viz/network.ts<br/>films joined by shared cast"]
    films --> kw["viz/keywords.ts"]
    films --> ms["viz/milestones.ts"]
    films --> ctr["viz/contrarian.ts, ratingRadar.ts,<br/>ratingCorrelation.ts"]
    films --> pt["viz/peopleTimeline.ts, quadrants.ts,<br/>scatter.ts, countries.ts"]

    stats --> RB[RankedBars / Columns / FilmList]
    heat --> HM[Heatmap]
    net --> NW[Network]
    kw --> KC[KeywordCloud]
    ms --> MS[Milestones]
    ctr --> RC[RatingGaps / Radar / Contrarian /<br/>MetacriticDisagreement / Correlation]
    pt --> PV[PeopleTimeline / Quadrants / Scatter / WorldMap]

    RB & HM & NW & KC & MS & RC & PV --> page["+page.svelte sections<br/>nav via SectionNav, headline via StatTiles"]
```

## 10. Year-in-review deck ("Wrapped")

```mermaid
flowchart LR
    films[EnrichedFilm list + year] --> lib["library.ts<br/>buildLibrary() → Library<br/>(slice, dates, lazy tallies)"]
    lib --> facts["facts/*<br/>audience, critics, dates,<br/>history, release, timing, library"]
    lib --> verdicts["viz/verdicts<br/>traits → rules → nearest miss"]
    facts --> wrapped["wrapped.ts<br/>buildWrapped() → Wrapped"]
    verdicts --> wrapped
    wrapped --> deck["deck.ts<br/>SEQUENCE of scene builders<br/>ranked, capped at 20"]
    scenes["scenes/*<br/>core, history, timing, library,<br/>audience, release"] --> deck
    deck --> UI["Wrapped.svelte + Frame.svelte<br/>rain.ts backdrop"]
    UI --> cards["cards.ts + canvas.ts<br/>save as share card"]
    entry["WrappedEntry.svelte<br/>picks year (December / demo)"] --> UI
```

## 11. Page state machine

```mermaid
stateDiagram-v2
    [*] --> idle
    idle --> ready : snapshot found in localStorage
    idle --> working : file dropped / demo
    working --> working : stage films → ratings → collections
    working --> ready : enrichment finished
    working --> idle : error (message shown)
    ready --> working : new file dropped
    ready --> idle : snapshot cleared / reset
    note right of ready
        "Remember" toggle writes or clears
        the localStorage Snapshot (key v5)
    end note
```

## 12. Deployment targets

```mermaid
flowchart TD
    env{{DEPLOY_TARGET}}
    env -- "unset / cloudflare" --> cf["adapter-cloudflare<br/>Worker + static assets"]
    env -- node --> nd["adapter-node<br/>Docker / compose"]

    cf --> d1[("D1 binding DB<br/>schema.sql applied via wrangler")]
    cf --> rl["Rate limit bindings<br/>ENRICH / RECOMMEND / OMDB"]
    nd --> sq[("better-sqlite3<br/>CACHE_DB_PATH, WAL")]
    nd --> nb["No limiter; FETCH_BUDGET<br/>can be raised"]

    cfg["Env: TMDB_API_KEY, SESSION_SECRET,<br/>TVDB_API_KEY?, OMDB_API_KEY?, FETCH_BUDGET?"] --> cf & nd
```

## How it works, in short

1. **Parse locally.** `parseExport` unzips with `fflate`, reads CSVs with PapaParse, and merges
   `watched`, `ratings`, `likes/films`, `diary`, `reviews` into one `Film` per name+year.
2. **Enrich in batches.** The client sends only `{name, year}` to `/api/enrich`. The server answers
   what it can from cache and fetches the rest from TMDB under a per-request `FetchBudget`
   (Workers' 50-subrequest limit). Anything cut off is returned in `pending` and the client's
   `runRounds` re-queues it, so large libraries still finish in one visit.
3. **Cache once, share across users.** Hits live in `movies`, known misses in `misses` (30-day TTL).
   Cache keys carry a `SCHEMA` generation; old generations are swept on first read.
4. **Add ratings and franchises.** IMDb ids from TMDB drive `/api/omdb-enrich`; collection ids drive
   `/api/collections` so "five of six" can be said.
5. **Visualize.** `+page.svelte` derives every chart's data from `EnrichedFilm[]` with pure
   functions in `lib/viz`, and feeds the same list into the Wrapped deck.
6. **Remember (opt-in).** A `Snapshot` in `localStorage` lets repeat visits skip the upload.
7. **Abuse guard.** `hooks.server.ts` issues an HMAC-signed session cookie on page loads; API routes
   require it, plus an optional Cloudflare rate limiter.
