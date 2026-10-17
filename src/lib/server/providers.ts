import { OFFER_KINDS, type OfferKind, type RegionOffers } from '$lib/types';
import type { FetchBudget } from './budget';
import { tmdbGet } from './tmdb';

interface TmdbProvider {
	provider_id: number;
	provider_name: string;
	logo_path?: string | null;
}

type TmdbRegion = { link?: string } & Partial<Record<OfferKind, TmdbProvider[]>>;

/**
 * Every country's offers for one title, as cached. Services are listed once and referenced by id
 * from each country, since the same few dozen recur across most of the ~150 countries.
 */
export interface WatchAvailability {
	providers: Record<number, [name: string, logoPath: string | null]>;
	regions: Record<string, { link: string | null } & Partial<Record<OfferKind, number[]>>>;
}

/** Folds TMDB's per-country provider lists into the compact cached shape. */
export function compactAvailability(results: Record<string, TmdbRegion>): WatchAvailability {
	const availability: WatchAvailability = { providers: {}, regions: {} };
	for (const [region, offers] of Object.entries(results)) {
		const entry: WatchAvailability['regions'][string] = { link: offers.link ?? null };
		for (const kind of OFFER_KINDS) {
			const list = offers[kind];
			if (!list?.length) continue;
			entry[kind] = list.map((p) => {
				availability.providers[p.provider_id] = [p.provider_name, p.logo_path ?? null];
				return p.provider_id;
			});
		}
		availability.regions[region] = entry;
	}
	return availability;
}

/** One country's offers with services spelled out, or null when the title has none there. */
export function regionOffers(availability: WatchAvailability, region: string): RegionOffers | null {
	const entry = availability.regions[region];
	if (!entry) return null;
	const offers = { link: entry.link } as RegionOffers;
	for (const kind of OFFER_KINDS) {
		offers[kind] = (entry[kind] ?? []).flatMap((id) => {
			const known = availability.providers[id];
			return known ? [{ id, name: known[0], logoPath: known[1] }] : [];
		});
	}
	return offers;
}

/** Watch availability in every country for one title: a single subrequest. */
export async function fetchAvailability(
	budget: FetchBudget,
	kind: 'movie' | 'tv',
	id: number
): Promise<WatchAvailability> {
	const { results } = (await tmdbGet(budget, `/${kind}/${id}/watch/providers`, {})) as {
		results?: Record<string, TmdbRegion>;
	};
	return compactAvailability(results ?? {});
}
