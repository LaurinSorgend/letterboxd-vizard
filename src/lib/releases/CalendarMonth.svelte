<script lang="ts">
	import { imageUrl } from '$lib/viz/images';
	import { webHref } from '$lib/viz/href';
	import { monthGrid, type CalendarEntry } from './calendar';
	import { KINDS } from './kinds';

	let { month, entries, today }: { month: string; entries: CalendarEntry[]; today: string } =
		$props();

	const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
	const days = $derived(monthGrid(month, entries));

	const dayLabel = (iso: string) => {
		const weekday = new Date(`${iso}T00:00:00Z`).toLocaleDateString('en', {
			weekday: 'short',
			timeZone: 'UTC'
		});
		return `${weekday} ${Number(iso.slice(8))}`;
	};

	function describe(entry: CalendarEntry): string {
		const elsewhere = entry.fallbackRegion ? `, ${entry.fallbackRegion} date` : '';
		const why = entry.film.recommended ? ` · recommended: ${entry.film.recommended.reason}` : '';
		return `${entry.film.name}: ${KINDS[entry.kind].label.toLowerCase()} release${elsewhere}${why}`;
	}

	function entryHref(entry: CalendarEntry): string | null {
		const { uri, tmdb, recommended } = entry.film;
		const href = webHref(uri);
		if (href || !recommended || !tmdb) return href;
		return `https://www.themoviedb.org/movie/${tmdb.tmdbId}`;
	}
</script>

<ol class="grid">
	{#each WEEKDAYS as weekday (weekday)}
		<li class="weekday" aria-hidden="true">{weekday}</li>
	{/each}
	{#each days as day, i (day.date ?? `pad-${i}`)}
		<li
			class="day"
			class:pad={!day.date}
			class:empty={day.entries.length === 0}
			class:past={day.date !== null && day.date < today}
			class:today={day.date === today}
		>
			{#if day.date}
				<span class="date">
					<span class="num">{Number(day.date.slice(8))}</span>
					<span class="long">{dayLabel(day.date)}</span>
				</span>
				<ul>
					{#each day.entries as entry (`${entry.film.tmdb?.tmdbId ?? entry.film.uri}-${entry.kind}`)}
						{@const href = entryHref(entry)}
						{@const poster = imageUrl(entry.film.tmdb?.posterPath ?? null, 'w92')}
						<li
							class="entry"
							class:recommended={!!entry.film.recommended}
							style:--kind-colour={KINDS[entry.kind].colour}
							title={describe(entry)}
						>
							{#if poster}<img src={poster} alt="" loading="lazy" />{/if}
							<span class="text">
								{#if href}
									<a {href} target="_blank" rel="noopener">{entry.film.name}</a>
								{:else}
									{entry.film.name}
								{/if}
								<span class="kind">
									{KINDS[entry.kind].label}{entry.fallbackRegion
										? ` (${entry.fallbackRegion})`
										: ''}{#if entry.film.recommended}
										<span class="rec">Rec</span>{/if}
								</span>
							</span>
						</li>
					{/each}
				</ul>
			{/if}
		</li>
	{/each}
</ol>

<style>
	.grid {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(7, minmax(0, 1fr));
		border-top: 1px solid var(--border);
		border-left: 1px solid var(--border);
	}
	.weekday,
	.day {
		border-right: 1px solid var(--border);
		border-bottom: 1px solid var(--border);
		min-width: 0;
	}
	.weekday {
		padding: 4px 6px;
		font-size: var(--text-2xs);
		color: var(--fg-secondary);
		background: var(--bg-secondary);
	}
	.day {
		min-height: 96px;
		padding: 4px;
	}
	.pad {
		background: var(--bg-secondary);
	}
	.past {
		opacity: 0.6;
	}
	.today .date {
		background: var(--accent);
		color: var(--on-accent);
		padding: 0 4px;
	}
	.date {
		font-family: var(--font-mono);
		font-size: var(--text-2xs);
		color: var(--fg-secondary);
	}
	.long {
		display: none;
	}
	ul {
		list-style: none;
		margin: 4px 0 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.entry {
		display: flex;
		gap: 4px;
		padding-left: 4px;
		border-left: 3px solid var(--kind-colour);
		font-size: var(--text-2xs);
		line-height: 1.25;
	}
	.entry img {
		width: 24px;
		height: 36px;
		object-fit: cover;
		flex: none;
	}
	.text {
		display: flex;
		flex-direction: column;
		min-width: 0;
		overflow-wrap: anywhere;
	}
	.text a {
		color: var(--fg);
		text-decoration: none;
	}
	.text a:hover,
	.text a:focus-visible {
		text-decoration: underline;
	}
	.kind {
		color: var(--fg-secondary);
	}
	.recommended {
		border-left-style: dashed;
	}
	.rec {
		margin-left: 0.5ch;
		font-family: var(--font-mono);
		color: var(--ctp-blue);
	}
	@media (max-width: 640px) {
		.grid {
			display: block;
			border: none;
		}
		.weekday,
		.pad,
		.empty {
			display: none;
		}
		.day {
			min-height: 0;
			border-right: none;
			padding: 8px 0;
		}
		.num {
			display: none;
		}
		.long {
			display: inline;
		}
		.entry {
			font-size: var(--text-sm);
		}
		.entry img {
			width: 32px;
			height: 48px;
		}
	}
</style>
