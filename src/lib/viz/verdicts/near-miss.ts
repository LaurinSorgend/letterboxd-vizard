import type { Traits } from './traits';

export interface NearMiss {
	label: string;
	actual: string;
	threshold: string;
}

interface Probe {
	label: string;
	value: (t: Traits) => number | null;
	threshold: number;
	format: (value: number) => string;
}

const percent = (value: number): string => `${Math.round(value * 100)}%`;
const plainNumber = (value: number): string => Math.round(value).toLocaleString('en');
const minutes = (value: number): string => `${Math.round(value).toLocaleString('en')} minutes`;

/**
 * The conditions worth reporting a near miss on: each is a share or a count the viewer would
 * recognise, and each maps onto a label they could have had.
 */
const PROBES: Probe[] = [
	{ label: 'country', value: (t) => t.topCountryShare, threshold: 0.6, format: percent },
	{ label: 'genre', value: (t) => t.topGenreShare, threshold: 0.5, format: percent },
	{ label: 'subtitles', value: (t) => t.foreignShare, threshold: 0.65, format: percent },
	{ label: 'obscurity', value: (t) => t.obscureShare, threshold: 0.45, format: percent },
	{ label: 'rewatches', value: (t) => t.rewatchShare, threshold: 0.3, format: percent },
	{ label: 'hearts', value: (t) => t.likedShare, threshold: 0.5, format: percent },
	{ label: 'reviews', value: (t) => t.reviewShare, threshold: 0.5, format: percent },
	{ label: 'weekends', value: (t) => t.weekendShare, threshold: 0.6, format: percent },
	{ label: 'December', value: (t) => t.decemberShare, threshold: 0.3, format: percent },
	{
		label: 'new releases',
		value: (t) => t.releasedThisYearShare,
		threshold: 0.55,
		format: percent
	},
	{ label: 'countries', value: (t) => t.countries, threshold: 20, format: plainNumber },
	{ label: 'runtime', value: (t) => t.meanRuntime, threshold: 125, format: minutes }
];

/** The condition the year came closest to meeting without meeting it. */
export function nearestMiss(traits: Traits): NearMiss | null {
	if (traits.films === 0) return null;
	const scored = PROBES.map((probe) => ({ probe, value: probe.value(traits) }))
		.filter(
			(entry): entry is { probe: Probe; value: number } =>
				entry.value !== null && entry.value > 0 && entry.value < entry.probe.threshold
		)
		.sort((a, b) => b.value / b.probe.threshold - a.value / a.probe.threshold);
	const closest = scored[0];
	if (!closest) return null;
	return {
		label: closest.probe.label,
		actual: closest.probe.format(closest.value),
		threshold: closest.probe.format(closest.probe.threshold)
	};
}
