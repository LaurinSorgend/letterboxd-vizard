/** Low-level drawing helpers shared by the story card and the summary poster. */

export interface Palette {
	/** The dark surround the slide is mounted in. */
	room: string;
	/** The lit field the picture is printed on. */
	screen: string;
	ink: string;
	muted: string;
	line: string;
	stamp: string;
	accent: string;
	/** The dye shift the whole frame took, already carrying its own alpha. */
	cast: string;
	faces: Faces;
}

/** A measured piece of the card, so a stack can be centred before anything is painted. */
export interface Block {
	height: number;
	draw: (y: number) => void;
}

/** The card's typefaces, read off the page like its colours, so the card sets the slide's type. */
export interface Faces {
	sans: string;
	mono: string;
	accent: string;
}

/** Stacks for a page whose custom properties could not be read. */
const FALLBACK_FACES: Faces = {
	sans: 'Ronzino, Arial, sans-serif',
	mono: '"Fira Code", monospace',
	accent: '"Mazius Display Extra Italic", Georgia, serif'
};

const FACE = {
	value: { weight: 400, family: 'accent' },
	label: { weight: 500, family: 'sans' },
	body: { weight: 400, family: 'sans' },
	mono: { weight: 500, family: 'mono' }
} as const satisfies Record<string, { weight: number; family: keyof Faces }>;

export function font(faces: Faces, face: keyof typeof FACE, size: number): string {
	const { weight, family } = FACE[face];
	return `${weight} ${size}px ${faces[family]}`;
}

/** The faces the cards paint with. Canvas silently falls back without this. */
export async function ensureFonts(faces: Faces): Promise<void> {
	if (!('fonts' in document)) return;
	await Promise.all(
		(Object.keys(FACE) as (keyof typeof FACE)[]).map((face) =>
			document.fonts.load(font(faces, face, 64)).catch(() => [])
		)
	);
}

export function paletteFrom(element: Element): Palette {
	const style = getComputedStyle(element);
	const read = (name: string) => style.getPropertyValue(name).trim();
	const stack = (name: string, fallback: string) => read(name).replace(/\s+/g, ' ') || fallback;
	return {
		room: read('--w-room'),
		screen: read('--w-screen'),
		ink: read('--w-ink'),
		muted: read('--w-muted'),
		line: read('--w-line'),
		stamp: read('--w-stamp'),
		accent: read('--w-accent') || read('--w-ink'),
		cast: read('--w-cast') || 'transparent',
		faces: {
			sans: stack('--font-sans', FALLBACK_FACES.sans),
			mono: stack('--font-mono', FALLBACK_FACES.mono),
			accent: stack('--font-accent', FALLBACK_FACES.accent)
		}
	};
}

let probe: CanvasRenderingContext2D | null = null;

/** Any CSS colour as rgba, since a canvas gradient cannot fade a colour to nothing on its own. */
export function rgba(color: string, alpha: number): string {
	probe ??= document.createElement('canvas').getContext('2d', { willReadFrequently: true });
	if (!probe) return color;
	probe.clearRect(0, 0, 1, 1);
	probe.fillStyle = color;
	probe.fillRect(0, 0, 1, 1);
	const [r, g, b] = probe.getImageData(0, 0, 1, 1).data;
	return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Film grain, tiled from a small noise patch so a 2-megapixel card stays cheap. */
export function grain(ctx: CanvasRenderingContext2D, width: number, height: number): void {
	const tile = document.createElement('canvas');
	tile.width = tile.height = 128;
	const tileCtx = tile.getContext('2d');
	if (!tileCtx) return;
	const image = tileCtx.createImageData(128, 128);
	for (let i = 0; i < image.data.length; i += 4) {
		const value = Math.random() * 255;
		image.data[i] = image.data[i + 1] = image.data[i + 2] = value;
		image.data[i + 3] = 16;
	}
	tileCtx.putImageData(image, 0, 0);
	const pattern = ctx.createPattern(tile, 'repeat');
	if (!pattern) return;
	ctx.save();
	ctx.globalCompositeOperation = 'overlay';
	ctx.fillStyle = pattern;
	ctx.fillRect(0, 0, width, height);
	ctx.restore();
}

export function wrap(
	ctx: CanvasRenderingContext2D,
	text: string,
	maxWidth: number,
	maxLines = 3
): string[] {
	const lines: string[] = [];
	let line = '';
	for (const word of text.split(/\s+/)) {
		const candidate = line ? `${line} ${word}` : word;
		if (ctx.measureText(candidate).width <= maxWidth || !line) {
			line = candidate;
		} else {
			lines.push(line);
			line = word;
			if (lines.length === maxLines) break;
		}
	}
	if (lines.length < maxLines && line) lines.push(line);
	if (lines.length === maxLines) {
		let last = lines[maxLines - 1];
		while (last.length > 1 && ctx.measureText(`${last}…`).width > maxWidth)
			last = last.slice(0, -1);
		if (ctx.measureText(lines[maxLines - 1]).width > maxWidth) lines[maxLines - 1] = `${last}…`;
	}
	return lines;
}

/** Shrinks a display value until it fits the measure, so long titles never run off the card. */
export function fitFont(
	ctx: CanvasRenderingContext2D,
	faces: Faces,
	text: string,
	maxWidth: number,
	start: number,
	floor: number
): number {
	let size = start;
	while (size > floor) {
		ctx.font = font(faces, 'value', size);
		if (ctx.measureText(text).width <= maxWidth) break;
		size -= 4;
	}
	ctx.font = font(faces, 'value', size);
	return size;
}

export function loadImage(src: string | null): Promise<HTMLImageElement | null> {
	if (!src) return Promise.resolve(null);
	return new Promise((resolve) => {
		const image = new Image();
		image.crossOrigin = 'anonymous';
		image.onload = () => resolve(image);
		image.onerror = () => resolve(null);
		image.src = src;
	});
}

/** Draws a poster into its box, or a titled placeholder when the artwork never arrived. */
export function posterBox(
	ctx: CanvasRenderingContext2D,
	image: HTMLImageElement | null,
	name: string,
	box: { x: number; y: number; width: number; height: number },
	palette: Palette
): void {
	const { x, y, width, height } = box;
	if (image) {
		ctx.drawImage(image, x, y, width, height);
	} else {
		ctx.fillStyle = rgba(palette.ink, 0.1);
		ctx.fillRect(x, y, width, height);
		ctx.fillStyle = palette.muted;
		ctx.font = font(palette.faces, 'body', 20);
		ctx.textAlign = 'center';
		wrap(ctx, name, width - 16, 4).forEach((line, i) => {
			ctx.fillText(line, x + width / 2, y + height / 2 + i * 24);
		});
		ctx.textAlign = 'left';
	}
	ctx.strokeStyle = rgba(palette.ink, 0.45);
	ctx.lineWidth = 2;
	ctx.strokeRect(x + 1, y + 1, width - 2, height - 2);
}

/** Hands the finished canvas to the share sheet, or falls back to a download. */
export async function deliver(
	canvas: HTMLCanvasElement,
	filename: string
): Promise<'shared' | 'saved' | 'cancelled'> {
	const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
	if (!blob) throw new Error('The picture could not be rendered.');
	const file = new File([blob], filename, { type: 'image/png' });
	if (navigator.canShare?.({ files: [file] })) {
		try {
			await navigator.share({ files: [file] });
			return 'shared';
		} catch (cause) {
			if (cause instanceof DOMException && cause.name === 'AbortError') return 'cancelled';
		}
	}
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement('a');
	anchor.href = url;
	anchor.download = filename;
	anchor.click();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
	return 'saved';
}
