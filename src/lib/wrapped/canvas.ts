/** Low-level drawing helpers shared by the story card and the summary poster. */

export interface Palette {
	ground: string;
	type: string;
	muted: string;
	line: string;
	gate: string;
	accent: string;
	onAccent: string;
}

/** A measured piece of the card, so a stack can be centred before anything is painted. */
export interface Block {
	height: number;
	draw: (y: number) => void;
}

const FACE = {
	value: '400 {size}px "Mazius Display Extra Italic", Georgia, serif',
	label: '700 {size}px Ronzino, Arial, sans-serif',
	body: '400 {size}px Ronzino, Arial, sans-serif',
	mono: '500 {size}px "Fira Code", monospace'
} as const;

export function font(face: keyof typeof FACE, size: number): string {
	return FACE[face].replace('{size}', String(size));
}

/** The faces the cards paint with. Canvas silently falls back without this. */
export async function ensureFonts(): Promise<void> {
	if (!('fonts' in document)) return;
	await Promise.all(
		(['value', 'label', 'body', 'mono'] as const).map((face) =>
			document.fonts.load(font(face, 64)).catch(() => [])
		)
	);
}

export function paletteFrom(element: Element): Palette {
	const style = getComputedStyle(element);
	const read = (name: string) => style.getPropertyValue(name).trim();
	return {
		ground: read('--w-ground'),
		type: read('--w-type'),
		muted: read('--w-muted'),
		line: read('--w-line'),
		gate: read('--w-gate'),
		accent: read('--w-accent') || read('--w-type'),
		onAccent: read('--w-on-accent')
	};
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

/** The perforated rail that frames every card, top and bottom. */
export function sprockets(
	ctx: CanvasRenderingContext2D,
	width: number,
	top: number,
	railHeight: number,
	palette: Palette
): void {
	ctx.fillStyle = palette.gate;
	ctx.fillRect(0, top, width, railHeight);
	const holeWidth = 44;
	const holeHeight = railHeight * 0.42;
	const pitch = 92;
	const y = top + (railHeight - holeHeight) / 2;
	ctx.fillStyle = palette.ground;
	for (let x = pitch / 2 - holeWidth / 2; x < width; x += pitch) {
		ctx.fillRect(x, y, holeWidth, holeHeight);
	}
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
	text: string,
	maxWidth: number,
	start: number,
	floor: number
): number {
	let size = start;
	while (size > floor) {
		ctx.font = font('value', size);
		if (ctx.measureText(text).width <= maxWidth) break;
		size -= 4;
	}
	ctx.font = font('value', size);
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
		ctx.fillStyle = palette.gate;
		ctx.fillRect(x, y, width, height);
		ctx.fillStyle = palette.muted;
		ctx.font = font('body', 20);
		ctx.textAlign = 'center';
		wrap(ctx, name, width - 16, 4).forEach((line, i) => {
			ctx.fillText(line, x + width / 2, y + height / 2 + i * 24);
		});
		ctx.textAlign = 'left';
	}
	ctx.strokeStyle = palette.line;
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
