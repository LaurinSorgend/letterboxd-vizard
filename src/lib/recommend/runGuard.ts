/**
 * Tracks the newest of several overlapping async runs. `begin()` stamps a run and returns
 * `isCurrent()`, which stays true only until a later run begins, so a slow earlier response
 * can bail before it overwrites state produced by a newer run. One guard per component instance.
 */
export function runGuard(): { begin: () => () => boolean } {
	let seq = 0;
	return {
		begin() {
			const mine = ++seq;
			return () => mine === seq;
		}
	};
}
