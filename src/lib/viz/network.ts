import { forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY } from 'd3-force';
import { getOrCreate } from '$lib/collections';
import { binIndex, RATING_THRESHOLDS } from './ramp';
import { clamp, seeded } from './seeded';
import type { EnrichedFilm } from '$lib/types';

export const NET_WIDTH = 1000;
export const NET_HEIGHT = 620;

export interface NetworkNode {
	film: EnrichedFilm;
	degree: number;
	x: number;
	y: number;
	r: number;
	/** Rating bin 0–4, or null when you never rated the film. */
	bin: number | null;
}

/** `source` and `target` index into `NetworkGraph.nodes`. */
export interface NetworkEdge {
	source: number;
	target: number;
	shared: string[];
}

export interface NetworkOptions {
	castDepth: number;
	minShared: number;
	maxNodes: number;
}

export interface NetworkGraph {
	nodes: NetworkNode[];
	edges: NetworkEdge[];
	/** Films sharing nobody with the rest of your library at this threshold. */
	isolated: number;
	/** Connected films dropped to keep the graph readable. */
	omitted: number;
}

/**
 * Someone in more than this many of your films links nearly everything to everything, which
 * says more about how much you watch them than about how your library hangs together.
 */
const UBIQUITY_LIMIT = 40;

interface PersonIndex {
	names: Map<string, string>;
	filmsByPerson: Map<string, number[]>;
}

/**
 * People keyed by TMDB id, each holding the films they appear in. Keying on the id rather than
 * the name matters here for the same reason it does in `byPerson`: distinct people share names,
 * and pooling them would invent connections that do not exist.
 */
function indexPeople(films: EnrichedFilm[], castDepth: number): PersonIndex {
	const names = new Map<string, string>();
	const filmsByPerson = new Map<string, number[]>();
	films.forEach((film, index) => {
		if (!film.tmdb) return;
		const people = [...film.tmdb.directors, ...film.tmdb.cast.slice(0, castDepth)];
		const seen = new Set<string>();
		for (const person of people) {
			const key = person.tmdbId !== null ? `id:${person.tmdbId}` : `name:${person.name}`;
			if (seen.has(key)) continue;
			seen.add(key);
			names.set(key, person.name);
			getOrCreate(filmsByPerson, key, () => []).push(index);
		}
	});
	return { names, filmsByPerson };
}

/** Film pairs sharing at least `minShared` people, keyed `lowIndex-highIndex`. */
function sharedPairs(index: PersonIndex, minShared: number): Map<string, string[]> {
	const pairs = new Map<string, string[]>();
	for (const [key, indices] of index.filmsByPerson) {
		if (indices.length < 2 || indices.length > UBIQUITY_LIMIT) continue;
		const name = index.names.get(key) ?? key;
		for (let i = 0; i < indices.length; i++) {
			for (let j = i + 1; j < indices.length; j++) {
				getOrCreate(pairs, `${indices[i]}-${indices[j]}`, () => []).push(name);
			}
		}
	}
	return new Map([...pairs].filter(([, shared]) => shared.length >= minShared));
}

const ITERATIONS = 300;

/**
 * Settles the graph in place with a standard charge/link/collide simulation: nodes repel each
 * other, edges pull their two films together, and collision keeps circles from overlapping (the
 * hand-rolled Fruchterman–Reingold pass this replaced had no collision term at all). Runs to
 * completion before anything is drawn rather than animating, which keeps the picture stable and
 * leaves nothing to suppress for reduced motion. `forceLink` mutates its link objects' `source`/
 * `target` from index to node reference, so it runs against throwaway clones; the real `edges`
 * array keeps the plain numeric indices the rest of this module and Network.svelte expect.
 *
 * Repulsion is short-range (`distanceMax`) and mild, and a weak per-node pull toward the centre
 * stands in for the "gravity" term classic force layouts use to stop the graph drifting apart;
 * `forceCenter` alone only re-centres the average position, so a film with a single edge still
 * gets flung to the canvas edge by everything repelling it with nothing pulling it back.
 */
function layout(nodes: NetworkNode[], edges: NetworkEdge[]): void {
	const count = nodes.length;
	if (count === 0) return;
	nodes.forEach((node, i) => {
		const seed = (node.film.tmdb?.tmdbId ?? i) + i;
		node.x = seeded(seed) * NET_WIDTH;
		node.y = seeded(seed + 1000) * NET_HEIGHT;
	});
	if (count === 1) {
		nodes[0].x = NET_WIDTH / 2;
		nodes[0].y = NET_HEIGHT / 2;
		return;
	}

	const simEdges = edges.map((edge) => ({ ...edge }));
	const simulation = forceSimulation(nodes)
		.force('charge', forceManyBody().strength(-90).distanceMax(260))
		.force('link', forceLink(simEdges).distance(55).strength(0.35))
		.force('x', forceX(NET_WIDTH / 2).strength(0.02))
		.force('y', forceY(NET_HEIGHT / 2).strength(0.02))
		.force(
			'collide',
			forceCollide<NetworkNode>((n) => n.r + 2)
		)
		.stop();
	for (let i = 0; i < ITERATIONS; i++) simulation.tick();

	for (const node of nodes) {
		node.x = clamp(node.x, node.r, NET_WIDTH - node.r);
		node.y = clamp(node.y, node.r, NET_HEIGHT - node.r);
	}
}

function toNode(film: EnrichedFilm, degree: number): NetworkNode {
	return {
		film,
		degree,
		bin: film.rating === null ? null : binIndex(film.rating, RATING_THRESHOLDS),
		r: Math.min(20, 6 + Math.sqrt(degree) * 2.5),
		x: 0,
		y: 0
	};
}

/**
 * Films joined where they share billed people, laid out ready to draw. Films are ranked by how
 * many others they connect to and cut at `maxNodes`, because past roughly that many the picture
 * stops being a map of your taste and becomes a ball of string.
 */
export function buildNetwork(films: EnrichedFilm[], options: NetworkOptions): NetworkGraph {
	const pairs = sharedPairs(indexPeople(films, options.castDepth), options.minShared);
	const edgeKeys = [...pairs.keys()].map((key) => key.split('-').map(Number));

	const linkCount = new Map<number, number>();
	for (const [a, b] of edgeKeys) {
		linkCount.set(a, (linkCount.get(a) ?? 0) + 1);
		linkCount.set(b, (linkCount.get(b) ?? 0) + 1);
	}
	const connected = [...linkCount.keys()].sort(
		(a, b) => linkCount.get(b)! - linkCount.get(a)! || films[a].name.localeCompare(films[b].name)
	);
	const kept = connected.slice(0, options.maxNodes);

	// Two passes: the first finds which of the kept films still have a link, the second numbers
	// the survivors. Dropping a linkless film removes no edge, so one round of this is enough.
	const survivors = new Set(kept);
	const linked = new Set<number>();
	for (const [a, b] of edgeKeys) {
		if (!survivors.has(a) || !survivors.has(b)) continue;
		linked.add(a);
		linked.add(b);
	}
	const finalFilms = kept.filter((index) => linked.has(index));
	const position = new Map(finalFilms.map((filmIndex, i) => [filmIndex, i]));

	const edges: NetworkEdge[] = [];
	const degrees = new Array<number>(finalFilms.length).fill(0);
	for (const [key, shared] of pairs) {
		const [a, b] = key.split('-').map(Number);
		const source = position.get(a);
		const target = position.get(b);
		if (source === undefined || target === undefined) continue;
		edges.push({ source, target, shared });
		degrees[source]++;
		degrees[target]++;
	}

	const nodes = finalFilms.map((filmIndex, i) => toNode(films[filmIndex], degrees[i]));
	layout(nodes, edges);
	return {
		nodes,
		edges,
		isolated: films.filter((film) => film.tmdb).length - connected.length,
		omitted: connected.length - nodes.length
	};
}
