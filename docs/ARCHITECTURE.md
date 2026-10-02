# Architecture and design documentation

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
        +getDb(platform) D1Database
    }
    class LocalDb {
        +localDb() D1Database
    }
    class Tmdb {
        +tmdbGet(budget, path, params)
        +lookupMovie(budget, name, year)
        +fetchRecord(budget, kind, id)
        +fetchCollection(budget, id)
    }
    class Tvdb {
        +lookupSeriesOnTvdb()
    }
    class Omdb {
        +fetchOmdbRatings(budget, imdbId)
    }
    class Related {
        +relatedMoviesMany(db, budget, limit, ids)
    }
    class Session {
        +mintSessionToken(secret)
        +verifySessionToken(secret, token)
        +requireSession(cookies)
    }
    class RateLimit {
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

## 13. Use case catalogue

Actors: **Viewer** (a Letterboxd user, anonymous, no accounts), **Operator** (deploys and configures),
and the external systems **TMDB**, **OMDb**, **TheTVDB** which the server calls on the viewer's behalf.

```mermaid
flowchart LR
    viewer([Viewer])
    operator([Operator])
    tmdb([TMDB])
    omdb([OMDb])
    tvdb([TheTVDB])

    subgraph load["Load data"]
        UC1(UC1 Upload export zip)
        UC2(UC2 Try demo library)
        UC3(UC3 Restore saved snapshot)
        UC4(UC4 Remember / forget library)
    end
    subgraph explore["Explore"]
        UC5(UC5 Browse stat tiles and sections)
        UC6(UC6 Toggle metric, scope or view)
        UC7(UC7 Inspect a country, film or person)
        UC8(UC8 Compare rating sources)
    end
    subgraph discover["Discover and share"]
        UC9(UC9 Get recommendations)
        UC10(UC10 Watch year in review)
        UC11(UC11 Save story card or poster)
        UC12(UC12 Switch theme)
    end
    subgraph ops["Operate"]
        UC13(UC13 Deploy to Workers or Node)
        UC14(UC14 Configure keys, limits, budget)
    end

    viewer --- UC1 & UC2 & UC3 & UC4 & UC5 & UC6 & UC7 & UC9 & UC10 & UC11 & UC12
    operator --- UC13 & UC14

    UC1 -.->|include| ENR(Enrich films with metadata)
    UC2 -.->|include| UC1
    UC5 -.->|include| UC6
    UC5 -.->|include| UC7
    UC8 -.->|extend| UC5
    UC11 -.->|extend| UC10

    ENR --- tmdb
    ENR --- tvdb
    ENR -.->|include| ENR2(Fetch IMDb / RT / Metacritic)
    ENR2 --- omdb
    UC9 --- tmdb
    UC14 -.->|enables| UC8
```

### Use case specifications

| ID | Use case | Trigger | Main flow | Alternatives and errors |
|----|----------|---------|-----------|-------------------------|
| UC1 | Upload export zip | Drop or pick a `.zip` in `FileDrop` | `parseExport` merges the CSVs, `enrichFilms` resolves titles on `/api/enrich`, `enrichOmdb` adds ratings, `fetchCollections` sizes franchises, page becomes `ready` | No `watched.csv` gives "not a Letterboxd export" and the page stays `idle`. Batches that fail or hit the budget are retried for up to 8 rounds. Watchlist and OMDb failures are swallowed so the main flow still completes |
| UC2 | Try demo library | `?demo` in dev mode | Fetches `/demo-export.zip` and runs UC1 | Dev only |
| UC3 | Restore snapshot | Page mount | `loadSnapshot` fills `films`, `watchlist`, `collections`, `profile`, page becomes `ready` | Missing, corrupt or old-generation snapshot is ignored |
| UC4 | Remember / forget | `RememberToggle` | On: `saveSnapshot` to `localStorage`. Off: `clearSnapshot` | Quota exceeded: toggle reverts and an error says data lasts for this visit only |
| UC5 | Browse sections | Scroll or `SectionNav` | `+page.svelte` derives each chart's data from `films` | Sections with no data (for example triangulation without OMDb) are hidden |
| UC6 | Toggle metric / scope | Buttons in a chart | `MetricToggle`, runtime scope, season scale, keyword cloud or bars switch the derived data | none |
| UC7 | Inspect a country, film or person | Click on map, bar or node | `selectByLabel` and chart state show a `FilmList` or detail | Click again clears the selection |
| UC8 | Compare rating sources | OMDb key present | Radar, contrarian, Metacritic gap and correlation charts | Without `OMDB_API_KEY` the endpoint returns all-null and the charts are hidden |
| UC9 | Get recommendations | Section renders | `pickDiverseSeeds` and `pickGenreSeeds` feed `/api/recommend`, with retries `1.5s, 3.5s, 7s` while records are `pending` | `available: false` shows the section as unavailable. Watchlist can be included or excluded |
| UC10 | Watch year in review | December, or demo | `buildRecap` then `buildWrapped` then `buildDeck`. Frames play on a timer or by keys. Gate frame opens the extras | Years under 10 films are not eligible. The current year is held back until December |
| UC11 | Save a share card | Share button in the deck | `storyCard` or `summaryCard` draws to canvas, `deliver` uses the Web Share API or downloads a PNG | User cancels the share sheet and nothing is saved. Canvas failure throws "picture could not be rendered" |
| UC12 | Switch theme | `ThemeSwitch` | Choose Catppuccin flavor and accent, stored in `localStorage` | Falls back to the system theme |
| UC13 | Deploy | Build with `DEPLOY_TARGET` | Cloudflare: Worker, assets, D1. Node: Docker with local SQLite | none |
| UC14 | Configure | `.env` / Worker vars | `TMDB_API_KEY`, `SESSION_SECRET`, optional `TVDB_API_KEY`, `OMDB_API_KEY`, `FETCH_BUDGET`, `CACHE_DB_PATH` | Missing `SESSION_SECRET` makes API routes return 500. Missing TMDB key makes lookups fail |

## 14. Class diagram: client ingest, state and persistence

```mermaid
classDiagram
    direction LR

    class PageComponent {
        phase: idle / working / ready
        stage: films / ratings
        data: LetterboxdData
        films: EnrichedFilm[]
        progress: done, total
        watchlistIds: number[]
        collections: CollectionParts[]
        remember: boolean
        +handleFile(file)
        +persist()
        +toggleRemember(on)
    }
    class Parse {
        +parseExport(zipBytes) LetterboxdData
    }
    class EnrichClient {
        +enrichFilms(items, onProgress)
        +enrichOmdb(imdbIds, onProgress)
        +fetchCollections(ids)
        -runRounds(options)
        -postBatch(url, body, label)
    }
    class RoundsOptions {
        items: T[]
        send(batch) BatchResponse
        keep(index, result)
        onProgress(done, total)
        firstRoundSize
    }
    class BatchResponse {
        results: R[]
        pending: number[]
    }
    class Store {
        +loadSnapshot() Snapshot
        +saveSnapshot(snapshot) boolean
        +clearSnapshot()
    }
    class Snapshot {
        films
        watchlist
        watchlistIds
        profile
        collections
    }
    class Collections {
        +getOrCreate(map, key, make)
    }
    class FileDrop {
        onfile(file)
    }
    class RememberToggle {
        checked
        error
        onchange(on)
    }
    class ThemeSwitch {
    }

    FileDrop --> PageComponent : onfile
    RememberToggle --> PageComponent : onchange
    PageComponent ..> Parse
    PageComponent ..> EnrichClient
    PageComponent ..> Store
    Parse ..> Collections
    EnrichClient *-- RoundsOptions
    EnrichClient ..> BatchResponse
    Store *-- Snapshot
```

## 15. Class diagram: visualization data structures

```mermaid
classDiagram
    direction TB

    class BarDatum {
        label
        count
        avg
        films
    }
    class HeatmapGrid {
        rows: HeatCell grid
        rowLabels
        colLabels
        watchtimeThresholds
        watchtimeLegend
        period
        empty
    }
    class HeatCell {
        key
        label
        minutes
        rating
        ratedCount
        films
        watchtimeBin
    }
    class NetworkGraph {
        nodes: NetworkNode[]
        edges: NetworkEdge[]
    }
    class NetworkNode {
        film
        degree
        x
        y
        r
        bin
    }
    class NetworkEdge {
        source
        target
        shared: string[]
    }
    class NetworkOptions {
        castDepth
        minShared
        maxNodes
    }
    class CountryStat {
        code
        name
        films
        count
        ratedCount
        avg
    }
    class RatingGap {
        film
        gap
    }
    class Streak {
        days
        start
        end
    }
    class Seed {
        tmdbId
        rating
    }
    class Recommendation {
        tmdbId
        title
        year
        posterPath
        countries
        pending
    }

    HeatmapGrid *-- HeatCell
    NetworkGraph *-- NetworkNode
    NetworkGraph *-- NetworkEdge
    NetworkOptions ..> NetworkGraph : buildNetwork
    EnrichedFilm <.. BarDatum : grouped from
    EnrichedFilm <.. CountryStat : aggregateCountries
    EnrichedFilm <.. HeatCell : bucketsByDay
    EnrichedFilm <.. NetworkNode
    EnrichedFilm <.. RatingGap : ratingGaps
    Seed ..> Recommendation : /api/recommend
```

## 16. Class diagram: Wrapped deck, verdicts and share cards

```mermaid
classDiagram
    direction TB

    class LibraryInput {
        films
        year
        watchlist
        collections
        locale
        now
    }
    class Library {
        all: EnrichedFilm[]
        year
        slice: EnrichedFilm[]
        dates: string[]
        watchlist
        collections: Map
        locale
        now
        +directors() BarDatum[]
        +cast() BarDatum[]
        +genres() BarDatum[]
    }
    class Recap {
        year
        films
        watches
        hours
        avg
        top
        topGenre
        topDirector
        topActor
        mostObscure
        mostPopular
        streak
        gap
        countries
        languages
        library: Library
        personality: Personality
        partial
    }
    class Wrapped {
        viewer
        days
        perMonth
        busiestMonth
        busiestDay
        first
        last
        topGenres
        topDirectors
        topActors
        topCountries
        topLanguages
        longest
        oldest
        medianYear
        rewatches
        over
        under
    }
    class Personality {
        title
        detail
        alsoTrue: string[]
    }
    class Traits {
        films
        entries
        activeMonths
        monthCounts
        meanRating
        ratedShare
        fiveStarShare
        likedShare
        medianVotes
        longestGapDays
        recentYears
    }
    class Rule {
        id
        title
        fallback
        +when(traits) boolean
        +detail(traits) string
    }
    class NearMiss {
        label
        actual
        threshold
    }
    class Deck {
        main: Scene[]
        extras: Scene[]
        closing: Scene[]
    }
    class SceneBuilder {
        rank: number
        +build(wrapped) Scene
    }
    class Scene {
        id
        accent
        label
        value
        valueKind
        note
        stats: Stat[]
        footnote
        backdrop
        body: SceneBody
    }
    class SceneBody {
        none
        bars
        posters
        summary
        gate
    }
    class Poster {
        name
        path
        href
        meta
    }
    class Bar {
        label
        value
        share
    }
    class Stat {
        label
        value
    }
    class Palette {
        room
        screen
        ink
        muted
        line
        stamp
        accent
        cast
    }
    class Block {
        height
        +draw(y)
    }
    class Cards {
        +storyCard(scene, data, palette)
        +summaryCard(data, palette)
    }
    class Canvas {
        +paletteFrom(element)
        +ensureFonts()
        +deliver(canvas, filename)
    }

    LibraryInput ..> Library : buildLibrary
    Recap *-- Library
    Recap *-- Personality
    Recap <|-- Wrapped
    Library ..> Traits : buildTraits
    Traits ..> Rule : evaluated by
    Rule ..> Personality : verdictFor
    Rule ..> NearMiss : fallback case
    Wrapped ..> SceneBuilder
    SceneBuilder ..> Scene
    Deck o-- Scene
    Scene *-- SceneBody
    SceneBody o-- Poster
    SceneBody o-- Bar
    Scene *-- Stat
    Cards ..> Scene
    Cards ..> Palette
    Cards *-- Block
    Cards ..> Canvas
```

## 17. Svelte component hierarchy

```mermaid
flowchart TD
    layout["+layout.svelte<br/>global css, theme"] --> page["+page.svelte"]

    page --> FileDrop
    page --> RememberToggle
    page --> ThemeSwitch
    page --> SectionNav
    page --> StatTiles
    page --> WrappedEntry

    subgraph sections["Sections"]
        WorldMap
        Columns
        RankedBars
        FilmList
        Heatmap
        MetricToggle
        Scatter
        Quadrants
        KeywordCloud
        Network
        Mosaic
        Milestones
        PeopleTimeline
        YearRecap
        Recommendations
        CountryRec
        PickerList
    end

    subgraph triangulation["Rating triangulation (needs OMDb)"]
        RatingGaps
        RatingRadar
        RatingContrarian
        MetacriticDisagreement
        RatingCorrelation
    end

    page --> sections
    page --> triangulation
    Recommendations --> CountryRec
    WorldMap --> FilmList
    RankedBars --> FilmList

    WrappedEntry --> Wrapped["Wrapped.svelte<br/>dialog, timer, keyboard"]
    Wrapped --> Frame["Frame.svelte<br/>renders one Scene"]
    Wrapped --> rain["rain.ts backdrop"]
    Wrapped --> cards["cards.ts share card"]
```

## 18. Activity: parsing and merging the export

```mermaid
flowchart TD
    A([zip bytes]) --> B[unzipSync with fflate]
    B --> C{all paths share one<br/>top-level folder?}
    C -- yes --> D[prefix = folder/]
    C -- no --> E[prefix = empty]
    D --> F
    E --> F{watched.csv present?}
    F -- no --> X([throw: not a Letterboxd export])
    F -- yes --> G[for each watched row:<br/>get or create Film by name + year]
    G --> H[ratings.csv: set film.rating]
    H --> I[likes/films.csv: liked = true]
    I --> J[diary.csv: push date + DiaryEntry,<br/>set rewatch, collect tags]
    J --> K[reviews.csv: set review text]
    K --> L[watchlist.csv: map to WatchlistEntry]
    L --> M[profile.csv: first row to Profile]
    M --> N([LetterboxdData])
```

## 19. Activity: how a verdict is chosen

```mermaid
flowchart TD
    lib[Library] --> t[buildTraits<br/>rhythm, ratings, taste, habit numbers]
    t --> r[rulesInOrder<br/>fixed ORDER: archivist ... regular]
    r --> m[keep rules whose when traits is true]
    m --> w[winner = first match]
    w --> f{winner is fallback<br/>The Regular?}
    f -- no --> o["alsoTrue = next 2 non-fallback matches"]
    o --> p1([Personality title + detail + alsoTrue])
    f -- yes --> n[nearestMiss:<br/>probe the rule that came closest]
    n --> p2([Personality with<br/>widest margin vs threshold])
```

## 20. Activity: building the deck

```mermaid
flowchart TD
    w[Wrapped data] --> s[SEQUENCE of 38 scene builders<br/>in narrative order, each with a rank]
    s --> b[run every builder]
    b --> nn[drop builders that returned null<br/>not enough data for that fact]
    nn --> sort[sort by rank, keep top DECK_CAP = 20 ids]
    sort --> main[main: kept scenes in narrative order]
    sort --> extras[extras: scenes the cap pushed out]
    w --> close[closing: verdictScene + summaryScene]
    main --> asm[assemble deck, expanded?]
    extras --> asm
    close --> asm
    asm --> g{extras exist?}
    g -- yes --> gate[insert gate frame after main<br/>expanded: also append extras]
    g -- no --> out
    gate --> out([Scene list shown by Wrapped.svelte])
```

## 21. Sequence: share card

```mermaid
sequenceDiagram
    actor U as User
    participant W as Wrapped.svelte
    participant K as cards.ts
    participant V as canvas.ts
    participant N as Browser share / download

    U->>W: click Share
    W->>V: paletteFrom(element)
    alt last frame
        W->>K: summaryCard(data, palette)
    else any other frame
        W->>K: storyCard(scene, data, palette)
    end
    K->>V: ensureFonts()
    K->>K: measure blocks, centre stack, draw on 1080x1920 canvas
    K->>V: loadImage(poster urls)
    K-->>W: HTMLCanvasElement
    W->>V: deliver(canvas, filename)
    V->>V: toBlob image/png
    alt navigator.canShare with files
        V->>N: navigator.share
        N-->>V: shared or AbortError (cancelled)
    else fallback
        V->>N: anchor download, revoke URL after 1s
        N-->>V: saved
    end
```

## 22. Sequence: session cookie and API protection

```mermaid
sequenceDiagram
    participant B as Browser
    participant H as hooks.server.ts
    participant S as session.ts
    participant A as /api route

    B->>H: GET / (page load)
    H->>S: verifySessionToken(secret, cookie)
    alt missing, expired or bad signature
        H->>S: mintSessionToken(secret)
        S-->>H: expiry.hmacSha256
        H-->>B: Set-Cookie lv_session httpOnly, sameSite lax, 6h
    end
    B->>A: POST /api/enrich + cookie
    A->>S: requireSession(cookies)
    alt SESSION_SECRET not set
        S-->>B: 500
    else cookie invalid
        S-->>B: 403 reload the page
    else ok
        A-->>B: continue to rate limit, validation, lookup
    end
```

## 23. Sequence: client retry loop against the fetch budget

```mermaid
sequenceDiagram
    participant R as runRounds
    participant W1 as worker 1
    participant W2 as worker 2
    participant API as /api batch endpoint

    Note over R: round 0 uses batches of 50 (35 for collections)
    R->>W1: batch A
    R->>W2: batch B
    par
        W1->>API: POST A
        API-->>W1: results + pending [3, 7]
    and
        W2->>API: POST B
        API-->>W2: network error
    end
    W1->>R: keep resolved, queue pending 3 and 7
    W2->>R: queue the whole batch B
    Note over R: round 1..7 use batches of 15 for the leftovers
    loop until queue empty or 8 rounds
        R->>API: POST retry batches
        API-->>R: results + pending
    end
    Note over R: anything still unresolved stays null (shown as unmatched)
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
