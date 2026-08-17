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
		room: read('--w-room'),
		screen: read('--w-screen'),
		ink: read('--w-ink'),
		muted: read('--w-muted'),
		line: read('--w-line'),
		stamp: read('--w-stamp'),
		accent: read('--w-accent') || read('--w-ink'),
		cast: read('--w-cast') || 'transparent'
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

/** Lens falloff, dust and one hair: the gate's own marks, printed on every card. */
export function gateMarks(
	ctx: CanvasRenderingContext2D,
	box: { x: number; y: number; width: number; height: number }
): void {
	const { x, y, width, height } = box;
	const centre = ctx.createRadialGradient(
		x + width / 2,
		y + height * 0.42,
		0,
		x + width / 2,
		y + height / 2,
		Math.max(width, height) * 0.78
	);
	centre.addColorStop(0, 'rgba(255, 250, 232, 0.13)');
	centre.addColorStop(0.5, 'rgba(255, 250, 232, 0)');
	centre.addColorStop(1, 'rgba(24, 16, 6, 0.22)');
	ctx.fillStyle = centre;
	ctx.fillRect(x, y, width, height);

	const specks: [number, number, number, number][] = [
		[0.18, 0.27, 3.2, 0.5],
		[0.74, 0.16, 2.6, 0.36],
		[0.61, 0.84, 3.8, 0.45],
		[0.33, 0.69, 2.3, 0.3],
		[0.88, 0.57, 2.9, 0.4]
	];
	for (const [fx, fy, radius, alpha] of specks) {
		ctx.beginPath();
		ctx.arc(x + width * fx, y + height * fy, radius, 0, Math.PI * 2);
		ctx.fillStyle = `rgba(20, 14, 6, ${alpha})`;
		ctx.fill();
	}

	ctx.save();
	ctx.translate(x + width * 0.87, y + height * 0.07);
	ctx.rotate(0.23);
	ctx.fillStyle = 'rgba(20, 14, 6, 0.42)';
	ctx.fillRect(0, 0, 2, height * 0.24);
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
		ctx.fillStyle = rgba(palette.ink, 0.1);
		ctx.fillRect(x, y, width, height);
		ctx.fillStyle = palette.muted;
		ctx.font = font('body', 20);
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
