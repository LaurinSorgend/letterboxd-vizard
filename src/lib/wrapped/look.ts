/*
 * The deck's render spec: every measure the DOM slide and the canvas card must agree on, so a
 * saved card looks like the slide it was saved from.
 */

/** Scene hues. wrapped.css defines a `[data-hue]` block for each; `paletteFrom` reads the result. */
export const ACCENTS = [
	'neutral',
	'amber',
	'oxblood',
	'cyan',
	'indigo',
	'forest',
	'magenta',
	'gold'
] as const;
export type Accent = (typeof ACCENTS)[number];

/** How many posters a frame's poster row holds on screen. */
export const POSTER_ROW = 6;
/** The card is narrower than the gate, so its row holds one poster fewer. */
export const CARD_POSTERS = 5;
/** Past this many bars a row stands its bars up and drops to short labels. */
const DENSE_BARS = 6;
/** One turn of the tray: the outgoing slide falls, the lamp flashes, the next one lands. */
export const TRAY_TURN_MS = 380;

export const isDense = (bars: unknown[]): boolean => bars.length > DENSE_BARS;

/**
 * The gate's own marks, which never move between frames: dust specks, one hair and the lens
 * falloff. Positions are fractions of the gate. The screen and the card each get their own size
 * and strength, since a card is printed at 1080 pixels and seen at a fraction of that.
 */
const DUST = 'rgba(20, 14, 6, ALPHA)';
const SPECKS = [
	{
		x: 0.18,
		y: 0.27,
		screen: { core: 1.1, edge: 1.7, alpha: 0.55 },
		card: { radius: 3.2, alpha: 0.5 }
	},
	{
		x: 0.74,
		y: 0.16,
		screen: { core: 0.9, edge: 1.4, alpha: 0.4 },
		card: { radius: 2.6, alpha: 0.36 }
	},
	{
		x: 0.61,
		y: 0.84,
		screen: { core: 1.3, edge: 1.9, alpha: 0.5 },
		card: { radius: 3.8, alpha: 0.45 }
	},
	{
		x: 0.33,
		y: 0.69,
		screen: { core: 0.8, edge: 1.3, alpha: 0.34 },
		card: { radius: 2.3, alpha: 0.3 }
	},
	{
		x: 0.88,
		y: 0.57,
		screen: { core: 1, edge: 1.5, alpha: 0.45 },
		card: { radius: 2.9, alpha: 0.4 }
	}
];
const HAIR = { x: 0.87, y: 0.07, length: 0.24, degrees: 13, cardAlpha: 0.42 };
const LENS = {
	centreY: 0.42,
	glow: 'rgba(255, 250, 232, ALPHA)',
	glowAlpha: 0.14,
	shade: 'rgba(24, 16, 6, 0.22)'
};

const dust = (alpha: number) => DUST.replace('ALPHA', String(alpha));
const pct = (fraction: number) => `${Math.round(fraction * 1000) / 10}%`;

/** CSS for the gate's layers on screen. */
export const gateStyle = {
	vignette: [
		`radial-gradient(70% 60% at 50% ${pct(LENS.centreY)}, ${LENS.glow.replace('ALPHA', String(LENS.glowAlpha))}, transparent 72%)`,
		`radial-gradient(122% 112% at 50% 50%, transparent 44%, ${LENS.shade} 100%)`
	].join(', '),
	dust: SPECKS.map(
		({ x, y, screen }) =>
			`radial-gradient(circle at ${pct(x)} ${pct(y)}, ${dust(screen.alpha)} 0 ${screen.core}px, transparent ${screen.edge}px)`
	).join(', '),
	hair: `--hair-x: ${pct(HAIR.x)}; --hair-y: ${pct(HAIR.y)}; --hair-length: ${pct(HAIR.length)}; --hair-angle: ${HAIR.degrees}deg`
};

/** The same marks printed on a card, inside `box`. */
export function drawGate(
	ctx: CanvasRenderingContext2D,
	box: { x: number; y: number; width: number; height: number }
): void {
	const { x, y, width, height } = box;
	const lens = ctx.createRadialGradient(
		x + width / 2,
		y + height * LENS.centreY,
		0,
		x + width / 2,
		y + height / 2,
		Math.max(width, height) * 0.78
	);
	lens.addColorStop(0, LENS.glow.replace('ALPHA', String(LENS.glowAlpha)));
	lens.addColorStop(0.5, LENS.glow.replace('ALPHA', '0'));
	lens.addColorStop(1, LENS.shade);
	ctx.fillStyle = lens;
	ctx.fillRect(x, y, width, height);

	for (const speck of SPECKS) {
		ctx.beginPath();
		ctx.arc(x + width * speck.x, y + height * speck.y, speck.card.radius, 0, Math.PI * 2);
		ctx.fillStyle = dust(speck.card.alpha);
		ctx.fill();
	}

	ctx.save();
	ctx.translate(x + width * HAIR.x, y + height * HAIR.y);
	ctx.rotate((HAIR.degrees * Math.PI) / 180);
	ctx.fillStyle = dust(HAIR.cardAlpha);
	ctx.fillRect(0, 0, 2, height * HAIR.length);
	ctx.restore();
}
