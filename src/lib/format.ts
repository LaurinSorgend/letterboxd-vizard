/**
 * The number formats the recap, the deck and the verdicts all print. They live outside both
 * `viz/` and `wrapped/` so neither layer has to import the other to say "43%".
 */

/** A counted figure. Years and ratings are not counts and must not be grouped this way. */
export const count = (n: number): string => n.toLocaleString('en');

/** A 0–1 share as a whole percentage. */
export const percent = (share: number): string => `${Math.round(share * 100)}%`;
