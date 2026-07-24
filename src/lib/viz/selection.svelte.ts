import type { BarDatum } from './stats';

/**
 * Click-to-select state for a bar chart: one bar at a time, clicking it again clears it.
 * `data` is a getter so the selection follows a reactive prop.
 */
export function selectByLabel(data: () => BarDatum[]) {
	let label: string | null = $state(null);
	return {
		get selected(): BarDatum | null {
			return label === null ? null : (data().find((d) => d.label === label) ?? null);
		},
		isSelected: (candidate: string) => label === candidate,
		toggle: (candidate: string) => {
			label = label === candidate ? null : candidate;
		}
	};
}
