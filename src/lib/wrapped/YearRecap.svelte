<script lang="ts">
	import { imageUrl, webHref } from '$lib/film/links';
	import { count, formatDayMonth, plural, starCaption, stars } from '$lib/format';
	import { billedIn, LABELS, ratingsAcross, TOP_FILMS } from './labels';
	import { buildYear } from '$lib/year';
	import { isRunning } from '$lib/year/library';
	import { alsoTrueLine } from '$lib/year/verdict';
	import { votes } from '$lib/film/votes';
	import { crowdGap } from '$lib/year/facts/critics';
	import { mostObscure, mostPopular } from '$lib/year/facts/extremes';
	import { streak } from '$lib/year/facts/timing';
	import { averageRating, countries, hours, languages, topRated } from '$lib/year/facts/totals';
	import type { CollectionParts, EnrichedFilm, WatchlistEntry } from '$lib/types';

	let {
		films,
		years,
		watchlist = [],
		collections = []
	}: {
		films: EnrichedFilm[];
		/** Years worth a recap, newest first, from `recapYears`. */
		years: number[];
		watchlist?: WatchlistEntry[];
		collections?: CollectionParts[];
	} = $props();

	let chosen: number | null = $state(null);
	const year = $derived(chosen !== null && years.includes(chosen) ? chosen : (years[0] ?? null));
	const built = $derived(year === null ? null : buildYear(films, year, { watchlist, collections }));
	const recap = $derived.by(() => {
		if (!built) return null;
		const { library, personality } = built;
		return {
			year: library.year,
			partial: isRunning(library),
			films: library.slice.length,
			watches: library.dates.length,
			hours: hours(library),
			avg: averageRating(library),
			top: topRated(library).slice(0, TOP_FILMS),
			topGenre: library.genres()[0] ?? null,
			topDirector: library.directors()[0] ?? null,
			topActor: library.cast()[0] ?? null,
			mostObscure: mostObscure(library),
			mostPopular: mostPopular(library),
			gap: crowdGap(library).over,
			streak: streak(library),
			countries: countries(library).length,
			languages: languages(library).length,
			personality
		};
	});
</script>

{#snippet numberCard(eyebrow: string, value: string, detail: string)}
	<li class="card">
		<span class="eyebrow">{eyebrow}</span>
		<strong class="value" data-numeric>{value}</strong>
		<span class="detail">{detail}</span>
	</li>
{/snippet}

{#snippet nameCard(eyebrow: string, value: string, detail: string)}
	<li class="card">
		<span class="eyebrow">{eyebrow}</span>
		<strong class="value name">{value}</strong>
		<span class="detail">{detail}</span>
	</li>
{/snippet}

{#if recap}
	<div class="picker">
		<label>
			Year
			<select value={recap.year} onchange={(event) => (chosen = Number(event.currentTarget.value))}>
				{#each years as option (option)}
					<option value={option}>{option}</option>
				{/each}
			</select>
		</label>
		{#if recap.partial}
			<span class="partial">{recap.year} is still running; this is the year so far.</span>
		{/if}
	</div>

	<ul class="deck">
		{@render numberCard(
			LABELS.films,
			String(recap.films),
			`${plural(recap.watches, 'diary entry', 'diary entries')}, a film seen twice counts once here.`
		)}
		{@render numberCard(
			'Hours in front of a screen',
			count(recap.hours),
			'Series are counted at their whole-run length.'
		)}
		{@render numberCard(
			'Your average',
			stars(recap.avg),
			recap.avg !== null ? 'Across everything you rated this year.' : 'You rated nothing this year.'
		)}

		<li class="card wide">
			<span class="eyebrow">{LABELS.top}</span>
			{#if recap.top.length > 0}
				<ol class="posters">
					{#each recap.top as film (film.uri)}
						{@const href = webHref(film.uri)}
						{@const src = imageUrl(film.tmdb?.posterPath ?? null, 'w92')}
						<li>
							<svelte:element
								this={href ? 'a' : 'span'}
								href={href ?? undefined}
								target={href ? '_blank' : undefined}
								rel={href ? 'noopener' : undefined}
								title="{film.name}, {starCaption(film.rating)}"
							>
								{#if src}
									<img {src} alt={film.name} loading="lazy" />
								{:else}
									<span class="noposter">{film.name}</span>
								{/if}
							</svelte:element>
						</li>
					{/each}
				</ol>
			{:else}
				<span class="detail">Nothing rated this year.</span>
			{/if}
		</li>

		{#if recap.topGenre}
			{@render nameCard(
				LABELS.genre,
				recap.topGenre.label,
				`${recap.topGenre.count} films${recap.topGenre.avg !== null ? `, averaging ${stars(recap.topGenre.avg)}` : ''}.`
			)}
		{/if}
		{#if recap.topDirector}
			{@render nameCard(
				LABELS.director,
				recap.topDirector.label,
				`${recap.topDirector.count} of their films.`
			)}
		{/if}
		{#if recap.topActor}
			{@render nameCard(LABELS.actor, recap.topActor.label, billedIn(recap.topActor.count))}
		{/if}

		{#if recap.mostObscure}
			{@render nameCard(
				LABELS.deepCut,
				recap.mostObscure.name,
				`Only ${ratingsAcross(votes(recap.mostObscure))}.`
			)}
		{/if}
		{#if recap.mostPopular}
			{@render nameCard(
				LABELS.biggestCrowd,
				recap.mostPopular.name,
				`${ratingsAcross(votes(recap.mostPopular))}.`
			)}
		{/if}
		{#if recap.gap}
			{@render nameCard(
				LABELS.crowd,
				recap.gap.film.name,
				`You gave it ${starCaption(recap.gap.yours)} where TMDB settled on ${stars(recap.gap.source)}.`
			)}
		{/if}

		{#if recap.streak}
			{@render numberCard(
				LABELS.streak,
				plural(recap.streak.days, 'day'),
				`${formatDayMonth(recap.streak.start)} to ${formatDayMonth(recap.streak.end)}.`
			)}
		{/if}
		{@render numberCard(
			'Reach',
			String(recap.countries),
			`Countries, across ${plural(recap.languages, 'original language')}.`
		)}

		<li class="card accent">
			<span class="eyebrow">{LABELS.verdict}</span>
			<strong class="value name">{recap.personality.title}</strong>
			<span class="detail">{recap.personality.detail}</span>
			{#if alsoTrueLine(recap.personality)}
				<span class="also">{alsoTrueLine(recap.personality)}</span>
			{/if}
		</li>
	</ul>
{/if}

<style>
	.picker {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 12px;
		margin-bottom: 16px;
		font-size: var(--text-sm);
		color: var(--fg-secondary);
	}
	label {
		display: inline-flex;
		align-items: center;
		gap: 8px;
	}
	select {
		font: inherit;
		font-family: var(--font-mono);
		font-size: var(--text-sm);
		padding: 4px 8px;
		color: var(--fg);
		background: var(--bg-secondary);
		border: 1px solid var(--border);
	}
	.partial {
		color: var(--fg-muted);
	}

	.deck {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: 12px;
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.card {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 16px;
		background: var(--surface);
		border: 1px solid var(--border);
	}
	.card.wide {
		grid-column: span 2;
	}
	.card.accent {
		border-color: var(--accent);
	}
	.eyebrow {
		font-size: var(--text-2xs);
		color: var(--fg-muted);
	}
	.value {
		font-family: var(--font-accent);
		font-size: var(--text-2xl);
		line-height: var(--leading-tight);
		font-weight: 400;
		color: var(--fg);
	}
	.value.name {
		font-size: var(--text-lg);
	}
	.detail {
		font-size: var(--text-sm);
		color: var(--fg-secondary);
	}
	.also {
		font-size: var(--text-xs);
		color: var(--ctp-subtext0);
	}

	.posters {
		display: flex;
		gap: 4px;
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.posters img {
		display: block;
		width: 100%;
		aspect-ratio: 2 / 3;
		object-fit: cover;
		background: var(--bg-secondary);
	}
	.posters li {
		flex: 1;
		min-width: 0;
	}
	.posters a:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: 2px;
	}
	.noposter {
		display: block;
		padding: 4px;
		font-size: var(--text-2xs);
		color: var(--fg-muted);
		background: var(--bg-secondary);
	}

	@media (max-width: 700px) {
		.deck {
			grid-auto-flow: column;
			grid-auto-columns: minmax(220px, 78%);
			grid-template-columns: none;
			overflow-x: auto;
			scroll-snap-type: x mandatory;
			padding-bottom: 8px;
		}
		.card {
			scroll-snap-align: start;
		}
		.card.wide {
			grid-column: auto;
		}
	}
</style>
