import { compareSpectrum, extractPalette, type Swatch } from './colors';

/**
 * Poster colours read so far, for sorting a wall by colour. Reading is on demand: every poster is
 * a download and a decode, and a browser that refuses to share the pixels (a tainted canvas)
 * leaves the sort unavailable for the rest of the visit.
 */
export class PosterPalette {
	#swatches = $state.raw(new Map<string, Swatch>());
	reading = $state(false);
	/** Posters read in the current pass. */
	progress = $state(0);
	refused = $state(false);

	/** Whether any colours have been read, so a colour sort means something. */
	get ready(): boolean {
		return this.#swatches.size > 0;
	}

	swatchOf(url: string | null): Swatch | undefined {
		return url ? this.#swatches.get(url) : undefined;
	}

	/** The distinct poster URLs among `urls` not read yet. */
	unread(urls: (string | null)[]): string[] {
		return [...new Set(urls)].filter(
			(url): url is string => url !== null && !this.#swatches.has(url)
		);
	}

	/** Reads `urls`; true when the colours arrived, false when the browser refused them. */
	async read(urls: string[]): Promise<boolean> {
		this.reading = true;
		this.progress = 0;
		const found = await extractPalette(urls, (done) => (this.progress = done));
		this.reading = false;
		if (!found) {
			this.refused = true;
			return false;
		}
		this.#swatches = new Map([...this.#swatches, ...found]);
		return true;
	}

	/** Orders two posters along the colour spectrum, unread ones last. */
	compare(a: string | null, b: string | null): number {
		return compareSpectrum(this.swatchOf(a), this.swatchOf(b));
	}
}
