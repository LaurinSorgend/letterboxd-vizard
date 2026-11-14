import type { ReleaseKind } from '$lib/types';

export const KIND_LABELS: Record<ReleaseKind, string> = {
	theatrical: 'Theatrical',
	digital: 'Digital',
	physical: 'Physical'
};
