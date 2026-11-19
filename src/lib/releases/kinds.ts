import type { ReleaseKind } from '$lib/types';

/** Each release kind's label and its Catppuccin colour. */
export const KINDS: Record<ReleaseKind, { label: string; colour: string }> = {
	theatrical: { label: 'Theatrical', colour: 'var(--ctp-peach)' },
	digital: { label: 'Digital', colour: 'var(--ctp-mauve)' },
	physical: { label: 'Physical', colour: 'var(--ctp-teal)' }
};
