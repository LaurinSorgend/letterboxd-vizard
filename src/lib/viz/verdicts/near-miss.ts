import { count, percent } from '$lib/format';
import { BARS, residencyBar } from './bars';
import type { Traits } from './traits';

export interface NearMiss {
	label: string;
	actual: string;
	threshold: string;
}

interface Probe {
	label: string;
	value: (t: Traits) => number | null;
	/** A function where the rule's own bar moves with the traits, as The Resident's does. */
	threshold: number | ((t: Traits) => number);
	format: (value: number) => string;
}

const barOf = (probe: Probe, traits: Traits): number =>
	typeof probe.threshold === 'number' ? probe.threshold : probe.threshold(traits);

const plainNumber = (value: number): string => count(Math.round(value));
const minutes = (value: number): string => `${plainNumber(value)} minutes`;

/**
 * The conditions worth reporting a near miss on: each is a share or a count the viewer would
 * recognise, and each maps onto a label they could have had.
 */
const PROBES: Probe[] = [
	{
		label: 'country',
		value: (t) => t.topCountryShare,
		threshold: (t) => residencyBar(t.topCountry),
		format: percent
	},
	{ label: 'genre', value: (t) => t.topGenreShare, threshold: BARS.specialist, format: percent },
	{ label: 'subtitles', value: (t) => t.foreignShare, threshold: BARS.subtitler, format: percent },
	{ label: 'obscurity', value: (t) => t.obscureShare, threshold: BARS.deepDiver, format: percent },
	{ label: 'rewatches', value: (t) => t.rewatchShare, threshold: BARS.returner, format: percent },
	{ label: 'hearts', value: (t) => t.likedShare, threshold: BARS.enthusiast, format: percent },
	{ label: 'reviews', value: (t) => t.reviewShare, threshold: BARS.diarist, format: percent },
	{ label: 'weekends', value: (t) => t.weekendShare, threshold: BARS.weekender, format: percent },
	{ label: 'December', value: (t) => t.decemberShare, threshold: BARS.crammer, format: percent },
	{
		label: 'new releases',
		value: (t) => t.releasedThisYearShare,
		threshold: BARS.frontrunner,
		format: percent
	},
	{
		label: 'countries',
		value: (t) => t.countries,
		threshold: BARS.globetrotter,
		format: plainNumber
	},
	{ label: 'runtime', value: (t) => t.meanRuntime, threshold: BARS.marathoner, format: minutes }
];

/** The condition the year came closest to meeting without meeting it. */
export function nearestMiss(traits: Traits): NearMiss | null {
	if (traits.films === 0) return null;
	const scored = PROBES.map((probe) => ({
		probe,
		value: probe.value(traits),
		bar: barOf(probe, traits)
	}))
		.filter(
			(entry): entry is { probe: Probe; value: number; bar: number } =>
				entry.value !== null && entry.value > 0 && entry.value < entry.bar
		)
		.sort((a, b) => b.value / b.bar - a.value / a.bar);
	const closest = scored[0];
	if (!closest) return null;
	return {
		label: closest.probe.label,
		actual: closest.probe.format(closest.value),
		threshold: closest.probe.format(closest.bar)
	};
}
