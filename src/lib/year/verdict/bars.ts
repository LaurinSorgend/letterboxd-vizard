/**
 * The bars a rule fires at, for the rules the near-miss line can also report on. Both the rule's
 * own `when` and the probe in `near-miss.ts` read these, so a tuned threshold cannot leave the
 * near-miss sentence quoting a bar that no longer exists.
 *
 * A rule's secondary guards — "and at least twenty films" — stay in its `when`. They decide
 * whether the label was reachable at all, which is not what a near miss measures.
 */
export const BARS = {
	deepDiver: 0.45,
	globetrotter: 20,
	marathoner: 125,
	frontrunner: 0.55,
	subtitler: 0.65,
	specialist: 0.5,
	returner: 0.3,
	diarist: 0.5,
	enthusiast: 0.5,
	weekender: 0.6,
	crammer: 0.3
} as const;

/** The US is the modal country for most libraries, so it only counts as a residence at 85%. */
export const residencyBar = (country: string | null): number => (country === 'US' ? 0.85 : 0.6);
