export * from './shared';
import { assemble, buildDeck } from '../deck';
import type { Scene } from './shared';
import type { Wrapped } from '../wrapped';

/** Every frame the year earned, gate included. The carousel uses `buildDeck` directly. */
export function buildScenes(data: Wrapped): Scene[] {
	return assemble(buildDeck(data), true);
}
