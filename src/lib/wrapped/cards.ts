import { imageUrl } from '$lib/viz/images';
import {
	ensureFonts,
	fitFont,
	font,
	gateMarks,
	grain,
	loadImage,
	posterBox,
	rgba,
	wrap,
	type Block,
	type Palette
} from './canvas';
import type { Scene } from './scenes';
import type { Wrapped } from './wrapped';

/* A mounted transparency: dark mount all round, a deeper strip at the foot for the
 * stamp, and the lit field between them. `margin` is mount plus the field's own inset,
 * so every block below still measures from the card edge. */
const STORY = { width: 1080, height: 1920, mount: 56, strip: 148, margin: 128 };
const POSTER = { width: 1080, height: 1350, mount: 56, strip: 136, margin: 124 };

/** Printed on the mount of the card people actually hand around. */
const SITE = 'letterboxd-vizard.sorgend.org';

function surface(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	const ctx = canvas.getContext('2d');
	if (!ctx) throw new Error('This browser will not give us a canvas to draw on.');
	ctx.textBaseline = 'top';
	return [canvas, ctx];
}

type Mount = { width: number; height: number; mount: number; strip: number };

function fieldOf(size: Mount) {
	return {
		x: size.mount,
		y: size.mount,
		width: size.width - size.mount * 2,
		height: size.height - size.mount - size.strip
	};
}

function ground(ctx: CanvasRenderingContext2D, size: Mount, palette: Palette): void {
	ctx.fillStyle = palette.room;
	ctx.fillRect(0, 0, size.width, size.height);
	const field = fieldOf(size);
	ctx.fillStyle = palette.screen;
	ctx.fillRect(field.x, field.y, field.width, field.height);
	ctx.fillStyle = palette.cast;
	ctx.fillRect(field.x, field.y, field.width, field.height);
}

/** Everything the projector adds after the picture: lens falloff, dust, emulsion, stamp. */
function finish(
	ctx: CanvasRenderingContext2D,
	size: Mount & { margin: number },
	palette: Palette,
	right: string,
	url?: string
): void {
	const field = fieldOf(size);
	gateMarks(ctx, field);
	ctx.save();
	ctx.beginPath();
	ctx.rect(field.x, field.y, field.width, field.height);
	ctx.clip();
	grain(ctx, size.width, size.height);
	ctx.restore();
	stamp(ctx, size, palette, right, url);
}

/** The stamp on the mount, the way a slide carries its date and its place in the tray. */
function stamp(
	ctx: CanvasRenderingContext2D,
	size: Mount & { margin: number },
	palette: Palette,
	right: string,
	url?: string
): void {
	const field = fieldOf(size);
	const centre = field.y + field.height + size.strip / 2;
	ctx.font = font('mono', 26);
	ctx.fillStyle = palette.stamp;
	ctx.fillText('LETTERBOXD VIZARD', size.mount, url ? centre - 30 : centre - 13);
	if (url) {
		ctx.fillStyle = palette.screen;
		ctx.fillText(url, size.mount, centre + 4);
	}
	ctx.textAlign = 'right';
	ctx.fillStyle = palette.stamp;
	ctx.fillText(right, size.width - size.mount, centre - 13);
	ctx.textAlign = 'left';
}

function valueBlock(ctx: CanvasRenderingContext2D, scene: Scene, palette: Palette): Block {
	const measure = STORY.width - STORY.margin * 2;
	const size = fitFont(ctx, scene.value, measure, scene.valueKind === 'number' ? 240 : 128, 56);
	return {
		height: size * 1.02,
		draw: (y) => {
			ctx.font = font('value', size);
			ctx.fillStyle = palette.accent;
			ctx.fillText(scene.value, STORY.margin, y);
		}
	};
}

function labelBlock(ctx: CanvasRenderingContext2D, scene: Scene, palette: Palette): Block {
	return {
		height: 96,
		draw: (y) => {
			const width = Math.min(520, STORY.width - STORY.margin * 2);
			ctx.fillStyle = palette.accent;
			ctx.fillRect(STORY.margin, y, width, 6);
			ctx.font = font('label', 54);
			ctx.fillStyle = palette.ink;
			ctx.fillText(scene.label, STORY.margin, y + 24);
		}
	};
}

function noteBlock(ctx: CanvasRenderingContext2D, scene: Scene, palette: Palette): Block {
	ctx.font = font('body', 36);
	const lines = wrap(ctx, scene.note, STORY.width - STORY.margin * 2, 4);
	const footnote = scene.footnote ?? '';
	return {
		height: lines.length * 50 + 16 + (footnote ? 44 : 0),
		draw: (y) => {
			ctx.font = font('body', 36);
			ctx.fillStyle = palette.muted;
			lines.forEach((line, i) => ctx.fillText(line, STORY.margin, y + i * 50));
			if (!footnote) return;
			ctx.font = font('mono', 26);
			ctx.fillStyle = palette.stamp;
			ctx.fillText(footnote.toUpperCase(), STORY.margin, y + lines.length * 50 + 12);
		}
	};
}

function posterBlock(
	ctx: CanvasRenderingContext2D,
	names: string[],
	metas: string[],
	images: (HTMLImageElement | null)[],
	palette: Palette
): Block {
	const measure = STORY.width - STORY.margin * 2;
	const gap = 16;
	const columns = Math.min(images.length, 5);
	const width = columns === 1 ? 320 : (measure - gap * (columns - 1)) / columns;
	const height = width * 1.5;
	return {
		height: height + 52,
		draw: (y) => {
			images.slice(0, columns).forEach((image, i) => {
				const x = STORY.margin + i * (width + gap);
				posterBox(ctx, image, names[i], { x, y, width, height }, palette);
				if (!metas[i]) return;
				ctx.font = font('mono', 26);
				ctx.fillStyle = palette.accent;
				ctx.fillText(metas[i], x, y + height + 14);
			});
		}
	};
}

function barBlock(
	ctx: CanvasRenderingContext2D,
	bars: { label: string; value: string; share: number }[],
	palette: Palette
): Block {
	const measure = STORY.width - STORY.margin * 2;
	if (bars.length > 6) {
		const gap = 8;
		const width = (measure - gap * (bars.length - 1)) / bars.length;
		const tall = 190;
		return {
			height: tall + 48,
			draw: (y) => {
				bars.forEach((bar, i) => {
					const x = STORY.margin + i * (width + gap);
					const filled = Math.max(4, bar.share * tall);
					ctx.fillStyle = palette.accent;
					ctx.fillRect(x, y + tall - filled, width, filled);
					ctx.fillStyle = palette.line;
					ctx.fillRect(x, y + tall, width, 2);
					ctx.font = font('mono', 24);
					ctx.fillStyle = palette.muted;
					ctx.textAlign = 'center';
					ctx.fillText(bar.label, x + width / 2, y + tall + 14);
					ctx.textAlign = 'left';
				});
			}
		};
	}
	const row = 60;
	return {
		height: bars.length * row,
		draw: (y) => {
			bars.forEach((bar, i) => {
				const top = y + i * row;
				ctx.font = font('body', 32);
				ctx.fillStyle = palette.ink;
				ctx.fillText(bar.label, STORY.margin, top);
				const trackX = STORY.margin + 300;
				const trackWidth = measure - 300 - 90;
				ctx.fillStyle = rgba(palette.ink, 0.12);
				ctx.fillRect(trackX, top + 8, trackWidth, 26);
				const filled = Math.max(4, trackWidth * bar.share);
				ctx.fillStyle = palette.accent;
				ctx.fillRect(trackX, top + 8, filled, 26);
				ctx.font = font('mono', 28);
				ctx.fillStyle = palette.muted;
				ctx.textAlign = 'right';
				ctx.fillText(bar.value, STORY.width - STORY.margin, top + 6);
				ctx.textAlign = 'left';
			});
		}
	};
}

function statBlock(ctx: CanvasRenderingContext2D, scene: Scene, palette: Palette): Block {
	return {
		height: 118,
		draw: (y) => {
			ctx.fillStyle = palette.line;
			ctx.fillRect(STORY.margin, y, STORY.width - STORY.margin * 2, 2);
			let x = STORY.margin;
			for (const stat of scene.stats.slice(0, 3)) {
				ctx.font = font('mono', 24);
				ctx.fillStyle = palette.muted;
				ctx.fillText(stat.label.toUpperCase(), x, y + 24);
				ctx.font = font('mono', 40);
				ctx.fillStyle = palette.ink;
				const value = stat.value.length > 18 ? `${stat.value.slice(0, 17)}…` : stat.value;
				ctx.fillText(value, x, y + 58);
				x += Math.max(ctx.measureText(value).width, 200) + 48;
			}
		}
	};
}

async function bodyBlock(
	ctx: CanvasRenderingContext2D,
	scene: Scene,
	palette: Palette
): Promise<Block | null> {
	if (scene.body.kind === 'bars') return barBlock(ctx, scene.body.bars, palette);
	if (scene.body.kind !== 'posters') return null;
	const posters = scene.body.posters.slice(0, 5);
	const images = await Promise.all(
		posters.map((item) => loadImage(imageUrl(item.path, posters.length === 1 ? 'w500' : 'w342')))
	);
	return posterBlock(
		ctx,
		posters.map((item) => item.name),
		posters.map((item) => item.meta),
		images,
		palette
	);
}

/** One frame of the deck as a 1080×1920 story card. */
export async function storyCard(
	scene: Scene,
	data: Wrapped,
	palette: Palette
): Promise<HTMLCanvasElement> {
	await ensureFonts();
	const [canvas, ctx] = surface(STORY.width, STORY.height);
	ground(ctx, STORY, palette);

	const blocks: Block[] = [
		valueBlock(ctx, scene, palette),
		labelBlock(ctx, scene, palette),
		noteBlock(ctx, scene, palette)
	];
	const body = await bodyBlock(ctx, scene, palette);
	if (body) blocks.push(body);
	if (scene.stats.length > 0) blocks.push(statBlock(ctx, scene, palette));

	const field = fieldOf(STORY);
	const gap = 40;
	const total = blocks.reduce((sum, block) => sum + block.height, 0) + gap * (blocks.length - 1);
	let y = Math.max(field.y + 72, field.y + (field.height - total) / 2);
	for (const block of blocks) {
		block.draw(y);
		y += block.height + gap;
	}

	finish(ctx, STORY, palette, `${data.viewer ? `${data.viewer} · ` : ''}${data.year}`);
	return canvas;
}

function summaryStats(data: Wrapped): { label: string; value: string }[] {
	return [
		{ label: 'FILMS', value: data.films.length.toLocaleString('en') },
		{ label: 'HOURS', value: data.hours.toLocaleString('en') },
		{ label: 'COUNTRIES', value: String(data.countries) },
		{ label: 'AVERAGE', value: data.avg !== null ? `${data.avg.toFixed(2)}` : '—' },
		{ label: 'GENRE', value: data.topGenres[0]?.label ?? '—' },
		{ label: 'DIRECTOR', value: data.topDirectors[0]?.label ?? '—' },
		{ label: 'ON SCREEN', value: data.topActors[0]?.label ?? '—' },
		{ label: 'STREAK', value: data.streak ? `${data.streak.days} days` : '—' }
	];
}

function drawSummaryGrid(
	ctx: CanvasRenderingContext2D,
	stats: { label: string; value: string }[],
	top: number,
	row: number,
	palette: Palette
): void {
	const column = (POSTER.width - POSTER.margin * 2) / 2;
	stats.forEach((stat, i) => {
		const x = POSTER.margin + (i % 2) * column;
		const y = top + Math.floor(i / 2) * row;
		ctx.font = font('mono', 22);
		ctx.fillStyle = palette.muted;
		ctx.fillText(stat.label, x, y);
		ctx.font = font('mono', 38);
		ctx.fillStyle = palette.ink;
		const value = stat.value.length > 20 ? `${stat.value.slice(0, 19)}…` : stat.value;
		ctx.fillText(value, x, y + 30);
	});
}

/** The closing word, measured so it can be hung off the bottom rail rather than flowed into it. */
function verdictBlock(ctx: CanvasRenderingContext2D, data: Wrapped, palette: Palette): Block {
	const measure = POSTER.width - POSTER.margin * 2;
	const title = fitFont(ctx, data.personality.title, measure, 84, 44);
	ctx.font = font('body', 30);
	const lines = wrap(ctx, data.personality.detail, measure, 2);
	return {
		height: 34 + title * 1.1 + lines.length * 40,
		draw: (y) => {
			ctx.font = font('mono', 22);
			ctx.fillStyle = palette.muted;
			ctx.fillText('YOUR YEAR IN ONE WORD', POSTER.margin, y);
			ctx.font = font('value', title);
			ctx.fillStyle = palette.accent;
			ctx.fillText(data.personality.title, POSTER.margin, y + 34);
			ctx.font = font('body', 30);
			ctx.fillStyle = palette.muted;
			const body = y + 34 + title * 1.1;
			lines.forEach((line, i) => ctx.fillText(line, POSTER.margin, body + i * 40));
		}
	};
}

/** The whole year on one 1080×1350 poster. */
export async function summaryCard(data: Wrapped, palette: Palette): Promise<HTMLCanvasElement> {
	await ensureFonts();
	const [canvas, ctx] = surface(POSTER.width, POSTER.height);
	ground(ctx, POSTER, palette);
	const measure = POSTER.width - POSTER.margin * 2;

	let y = POSTER.mount + 56;
	ctx.font = font('mono', 26);
	ctx.fillStyle = palette.muted;
	ctx.fillText(
		data.viewer ? `${data.viewer.toUpperCase()} · A YEAR IN CINEMA` : 'A YEAR IN CINEMA',
		POSTER.margin,
		y
	);

	y += 44;
	const size = fitFont(ctx, String(data.year), measure, 176, 96);
	ctx.fillStyle = palette.accent;
	ctx.fillText(String(data.year), POSTER.margin, y);
	y += size * 1.05;

	ctx.fillStyle = palette.accent;
	ctx.fillRect(POSTER.margin, y, measure, 6);
	y += 40;

	const top = data.top.slice(0, 5);
	if (top.length > 0) {
		const images = await Promise.all(
			top.map((film) => loadImage(imageUrl(film.tmdb?.posterPath ?? null, 'w342')))
		);
		const gap = 16;
		const width = (measure - gap * (top.length - 1)) / top.length;
		const height = width * 1.5;
		images.forEach((image, i) => {
			posterBox(
				ctx,
				image,
				top[i].name,
				{ x: POSTER.margin + i * (width + gap), y, width, height },
				palette
			);
		});
		y += height + 32;
	}

	const stats = summaryStats(data);
	const verdict = verdictBlock(ctx, data, palette);
	const verdictTop = POSTER.height - POSTER.strip - 48 - verdict.height;
	const rows = Math.ceil(stats.length / 2);
	const row = Math.min(96, Math.max(72, (verdictTop - 20 - y) / rows));
	drawSummaryGrid(ctx, stats, y, row, palette);
	verdict.draw(verdictTop);

	finish(ctx, POSTER, palette, String(data.year), SITE);
	return canvas;
}
