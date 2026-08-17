<script lang="ts">
	import { imageUrl } from './images';
	import { webHref } from './href';
	import { buildRecap, eligibleYears } from './recap';
	import type { EnrichedFilm } from '$lib/types';

	let { films }: { films: EnrichedFilm[] } = $props();

	const years = $derived(eligibleYears(films, new Date()));
	// svelte-ignore state_referenced_locally
	let chosen: number | null = $state(Math.max(...years));
	const year = $derived(chosen !== null && years.includes(chosen) ? chosen : (years[0] ?? null));
	const recap = $derived(year === null ? null : buildRecap(films, year));

	/* Diary dates are calendar days with no time zone of their own, so format them as UTC. */
	function shortDate(iso: string): string {
		return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en', {
			day: 'numeric',
			month: 'short',
			timeZone: 'UTC'
		});
	}
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
	<section id="recap">
		<h2>Your year in cinema</h2>
		<div class="picker">
			<label>
				Year
				<select bind:value={chosen}>
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
				'Films watched',
				String(recap.films.length),
				`${recap.watches} diary entries, a film seen twice counts once here.`
			)}
			{@render numberCard(
				'Hours in front of a screen',
				recap.hours.toLocaleString('en'),
				'Series are counted at their whole-run length.'
			)}
			{@render numberCard(
				'Your average',
				recap.avg !== null ? `★ ${recap.avg.toFixed(2)}` : '—',
				recap.avg !== null
					? 'Across everything you rated this year.'
					: 'You rated nothing this year.'
			)}

			<li class="card wide">
				<span class="eyebrow">Your five best</span>
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
									title="{film.name}, ★ {film.rating}"
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
					'Genre of the year',
					recap.topGenre.label,
					`${recap.topGenre.count} films${recap.topGenre.avg !== null ? `, averaging ★ ${recap.topGenre.avg.toFixed(1)}` : ''}.`
				)}
			{/if}
			{#if recap.topDirector}
				{@render nameCard(
					'Director of the year',
					recap.topDirector.label,
					`${recap.topDirector.count} of their films.`
				)}
			{/if}
			{#if recap.topActor}
				{@render nameCard(
					'On screen most',
					recap.topActor.label,
					`Billed in ${recap.topActor.count} of your films.`
				)}
			{/if}

			{#if recap.mostObscure}
				{@render nameCard(
					'Deepest cut',
					recap.mostObscure.name,
					`Only ${(recap.mostObscure.tmdb?.voteCount ?? 0).toLocaleString('en')} people have rated it on TMDB.`
				)}
			{/if}
			{#if recap.mostPopular}
				{@render nameCard(
					'Biggest crowd',
					recap.mostPopular.name,
					`${(recap.mostPopular.tmdb?.voteCount ?? 0).toLocaleString('en')} TMDB ratings.`
				)}
			{/if}
			{#if recap.gap}
				{@render nameCard(
					'You against the crowd',
					recap.gap.film.name,
					`You gave it ★ ${recap.gap.yours} where TMDB settled on ★ ${recap.gap.tmdb.toFixed(1)}.`
				)}
			{/if}

			{#if recap.streak}
				{@render numberCard(
					'Longest streak',
					`${recap.streak.days} ${recap.streak.days === 1 ? 'day' : 'days'}`,
					`${shortDate(recap.streak.start)} to ${shortDate(recap.streak.end)}.`
				)}
			{/if}
			{@render numberCard(
				'Reach',
				String(recap.countries),
				`Countries, across ${recap.languages} original languages.`
			)}

			<li class="card accent">
				<span class="eyebrow">Your year in one word</span>
				<strong class="value name">{recap.personality.title}</strong>
				<span class="detail">{recap.personality.detail}</span>
			</li>
		</ul>
	</section>
{/if}

<style>
	section {
		margin: 32px 0;
	}
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
		text-transform: uppercase;
		letter-spacing: 0.08em;
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
