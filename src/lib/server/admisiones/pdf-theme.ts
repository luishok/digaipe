import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
	PDFDocument,
	StandardFonts,
	rgb,
	type PDFFont,
	type PDFImage,
	type PDFPage,
	type RGB
} from 'pdf-lib';

/**
 * Shared drawing toolkit for the DIGAIPE report PDFs. Gives every export a
 * consistent institutional masthead, running header/footer and a refined,
 * hairline-ruled table with tabular (monospaced) figures.
 */

export const palette = {
	ink: rgb(0.11, 0.12, 0.14),
	accent: rgb(0.1, 0.19, 0.38),
	accentSoft: rgb(0.86, 0.9, 0.96),
	hairline: rgb(0.8, 0.82, 0.85),
	zebra: rgb(0.965, 0.975, 0.985),
	muted: rgb(0.42, 0.45, 0.5),
	white: rgb(1, 1, 1)
};

const CREST_PATH = path.resolve(process.cwd(), 'static', 'ula-crest.jpg');
const PAD = 4;

// WinAnsi-encodable code points >= 0x100 that the standard fonts still support.
const WINANSI_EXTRA = new Set([
	0x152, 0x153, 0x160, 0x161, 0x17d, 0x17e, 0x178, 0x192, 0x2c6, 0x2dc, 0x2013, 0x2014, 0x2018,
	0x2019, 0x201a, 0x201c, 0x201d, 0x201e, 0x2020, 0x2021, 0x2022, 0x2026, 0x2030, 0x2039, 0x203a,
	0x20ac, 0x2122
]);

/** Replace characters the built-in (WinAnsi) fonts cannot encode so pdf-lib never throws. */
function safe(value: string) {
	let out = '';
	for (const ch of value) {
		const c = ch.codePointAt(0)!;
		if (c < 0x20) out += ' ';
		else if (c < 0x80 || (c >= 0xa0 && c < 0x100) || WINANSI_EXTRA.has(c)) out += ch;
		else out += '?';
	}
	return out;
}

/** Trim text with an ellipsis so it fits within maxWidth for the given font/size. */
function fit(value: string, font: PDFFont, size: number, maxWidth: number) {
	let text = safe(value);
	if (maxWidth <= 0) return '';
	if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
	while (text.length > 1 && font.widthOfTextAtSize(`${text}…`, size) > maxWidth)
		text = text.slice(0, -1);
	return `${text}…`;
}

export function formatCount(value: number) {
	return value.toLocaleString('es-VE');
}

export function formatPct(ratio: number) {
	return `${(ratio * 100).toFixed(1)}%`;
}

export function formatDate(iso: string | null | undefined) {
	if (!iso) return '';
	const [y, m, d] = iso.slice(0, 10).split('-');
	return y && m && d ? `${d}/${m}/${y}` : iso;
}

/** Semantic colors for review statuses, shared by tables, funnel bars and legend. */
export const statusColors: Record<string, RGB> = {
	pendiente: rgb(0.85, 0.6, 0.13),
	matriculado: rgb(0.16, 0.55, 0.3),
	devuelto: rgb(0.72, 0.23, 0.2),
	'no procesado': rgb(0.5, 0.53, 0.57)
};

type Fonts = { regular: PDFFont; bold: PDFFont; mono: PDFFont; monoBold: PDFFont };

export type Orientation = 'portrait' | 'landscape';
export type Align = 'left' | 'right';

export interface Column {
	header: string;
	width: number;
	align?: Align;
	mono?: boolean;
	/** Draw a proportional bar behind the value (value / column max). */
	bar?: boolean;
}

export interface Row {
	cells: Array<string | number | null | undefined>;
	strong?: boolean;
	topRule?: boolean;
	fill?: RGB;
	indent?: number;
}

export interface TableOptions {
	title?: string;
	columns: Column[];
	rows: Row[];
	fontSize?: number;
	zebra?: boolean;
}

export interface MastheadOptions {
	title: string;
	subtitle?: string;
	meta?: string[];
}

export class ReportDoc {
	readonly pdf: PDFDocument;
	private readonly fonts: Fonts;
	private readonly crest: PDFImage | null;
	private readonly size: [number, number];
	readonly marginX = 40;
	private readonly marginBottom = 42;
	page: PDFPage;
	private y: number;
	private runningTitle = '';

	private constructor(
		pdf: PDFDocument,
		fonts: Fonts,
		crest: PDFImage | null,
		size: [number, number]
	) {
		this.pdf = pdf;
		this.fonts = fonts;
		this.crest = crest;
		this.size = size;
		this.page = pdf.addPage(size);
		this.y = size[1];
	}

	static async create(orientation: Orientation): Promise<ReportDoc> {
		const pdf = await PDFDocument.create();
		const [regular, bold, mono, monoBold] = await Promise.all([
			pdf.embedFont(StandardFonts.Helvetica),
			pdf.embedFont(StandardFonts.HelveticaBold),
			pdf.embedFont(StandardFonts.Courier),
			pdf.embedFont(StandardFonts.CourierBold)
		]);
		let crest: PDFImage | null = null;
		try {
			crest = await pdf.embedJpg(await readFile(CREST_PATH));
		} catch {
			crest = null;
		}
		const size: [number, number] = orientation === 'landscape' ? [792, 612] : [612, 792];
		return new ReportDoc(pdf, { regular, bold, mono, monoBold }, crest, size);
	}

	private get pageWidth() {
		return this.size[0];
	}
	private get pageHeight() {
		return this.size[1];
	}
	get contentWidth() {
		return this.pageWidth - this.marginX * 2;
	}
	private get right() {
		return this.marginX + this.contentWidth;
	}

	private rightText(text: string, y: number, size: number, font: PDFFont, color: RGB) {
		const t = safe(text);
		const w = font.widthOfTextAtSize(t, size);
		this.page.drawText(t, { x: this.right - w, y, size, font, color });
	}

	/** Full institutional masthead — drawn once on the first page. */
	masthead(o: MastheadOptions) {
		this.runningTitle = o.title;
		const top = this.pageHeight - 34;
		let textX = this.marginX;
		if (this.crest) {
			const h = 46;
			const w = h * (this.crest.width / this.crest.height);
			this.page.drawImage(this.crest, { x: this.marginX, y: top - h, width: w, height: h });
			textX = this.marginX + w + 12;
		}
		this.page.drawText(safe('Universidad de Los Andes'), {
			x: textX,
			y: top - 12,
			size: 13,
			font: this.fonts.bold,
			color: palette.ink
		});
		this.page.drawText(safe('Secretaría'), {
			x: textX,
			y: top - 25,
			size: 8,
			font: this.fonts.regular,
			color: palette.muted
		});
		this.page.drawText(
			safe('Dirección de Gestión de Admisión, Ingreso y Permanencia Estudiantil'),
			{
				x: textX,
				y: top - 36,
				size: 8,
				font: this.fonts.regular,
				color: palette.muted
			}
		);
		let my = top - 12;
		for (const line of o.meta ?? []) {
			this.rightText(line, my, 8, this.fonts.regular, palette.muted);
			my -= 11;
		}
		const ruleY = top - 50;
		this.page.drawRectangle({
			x: this.marginX,
			y: ruleY - 2,
			width: this.contentWidth,
			height: 2,
			color: palette.accent
		});
		this.page.drawText(safe(o.title), {
			x: this.marginX,
			y: ruleY - 24,
			size: 16,
			font: this.fonts.bold,
			color: palette.ink
		});
		if (o.subtitle)
			this.page.drawText(safe(o.subtitle), {
				x: this.marginX,
				y: ruleY - 37,
				size: 8.5,
				font: this.fonts.regular,
				color: palette.muted
			});
		this.y = ruleY - (o.subtitle ? 52 : 40);
	}

	/** Compact one-line header for continuation pages. */
	private runningHeader() {
		const top = this.pageHeight - 30;
		this.page.drawText(safe('Universidad de Los Andes · DIGAIPE'), {
			x: this.marginX,
			y: top,
			size: 8,
			font: this.fonts.bold,
			color: palette.ink
		});
		this.rightText(this.runningTitle, top, 8, this.fonts.regular, palette.muted);
		this.page.drawRectangle({
			x: this.marginX,
			y: top - 6,
			width: this.contentWidth,
			height: 1,
			color: palette.accent
		});
		this.y = top - 18;
	}

	private newPage() {
		this.page = this.pdf.addPage(this.size);
		this.runningHeader();
	}

	private ensure(needed: number) {
		if (this.y - needed < this.marginBottom) this.newPage();
	}

	private sectionHeading(title: string) {
		const top = this.y;
		this.page.drawText(safe(title.toUpperCase()), {
			x: this.marginX,
			y: top - 10,
			size: 9,
			font: this.fonts.bold,
			color: palette.accent
		});
		this.page.drawLine({
			start: { x: this.marginX, y: top - 15 },
			end: { x: this.right, y: top - 15 },
			thickness: 0.6,
			color: palette.accent
		});
		this.y = top - 23;
	}

	/** Vertical space above the current cursor, before the bottom margin. */
	spaceLeft() {
		return this.y - this.marginBottom;
	}

	/** Row of KPI stat tiles. */
	kpiRow(items: Array<{ label: string; value: string | number }>) {
		const gap = 10;
		const n = items.length;
		const tileW = (this.contentWidth - gap * (n - 1)) / n;
		const tileH = 44;
		this.ensure(tileH + 8);
		const top = this.y;
		items.forEach((it, i) => {
			const x = this.marginX + i * (tileW + gap);
			this.page.drawRectangle({
				x,
				y: top - tileH,
				width: tileW,
				height: tileH,
				color: palette.zebra,
				borderColor: palette.hairline,
				borderWidth: 0.8
			});
			this.page.drawRectangle({
				x,
				y: top - tileH,
				width: 3,
				height: tileH,
				color: palette.accent
			});
			this.page.drawText(safe(String(it.value)), {
				x: x + 12,
				y: top - 26,
				size: 17,
				font: this.fonts.monoBold,
				color: palette.ink
			});
			this.page.drawText(fit(it.label, this.fonts.regular, 7.5, tileW - 16), {
				x: x + 12,
				y: top - 38,
				size: 7.5,
				font: this.fonts.regular,
				color: palette.muted
			});
		});
		this.y = top - tileH - 16;
	}

	/** Standalone section heading (accent label + rule), outside of a table. */
	section(title: string) {
		this.ensure(24);
		this.sectionHeading(title);
	}

	/** A single line of muted (or bold) text. */
	note(text: string, opts: { strong?: boolean } = {}) {
		this.ensure(15);
		const font = opts.strong ? this.fonts.bold : this.fonts.regular;
		this.page.drawText(fit(text, font, 8.5, this.contentWidth), {
			x: this.marginX,
			y: this.y - 10,
			size: 8.5,
			font,
			color: opts.strong ? palette.ink : palette.muted
		});
		this.y -= 15;
	}

	/** Horizontal legend of colored swatches. */
	legend(items: Array<{ label: string; color: RGB }>) {
		this.ensure(16);
		const top = this.y;
		let x = this.marginX;
		for (const it of items) {
			this.page.drawRectangle({ x, y: top - 9, width: 8, height: 8, color: it.color });
			const t = safe(it.label);
			this.page.drawText(t, {
				x: x + 11,
				y: top - 8,
				size: 7.5,
				font: this.fonts.regular,
				color: palette.muted
			});
			x += 11 + this.fonts.regular.widthOfTextAtSize(t, 7.5) + 16;
		}
		this.y = top - 16;
	}

	/** Labeled proportional bars (an admission funnel). Bars scale to the largest pct. */
	funnel(items: Array<{ label: string; count: number; pct: number; indent?: number; tone?: RGB }>) {
		const size = 8.5;
		const rowH = 19;
		const labelW = 160;
		const statW = 118;
		const barMaxW = this.contentWidth - labelW - statW;
		const maxPct = Math.max(0.0001, ...items.map((i) => i.pct));
		for (const it of items) {
			this.ensure(rowH);
			const top = this.y;
			const indent = it.indent ?? 0;
			this.page.drawText(fit(it.label, this.fonts.bold, size, labelW - indent - 4), {
				x: this.marginX + indent,
				y: top - 13,
				size,
				font: this.fonts.bold,
				color: palette.ink
			});
			const bx = this.marginX + labelW;
			const bw = Math.max(1, barMaxW * (it.pct / maxPct));
			this.page.drawRectangle({
				x: bx,
				y: top - 16,
				width: bw,
				height: 11,
				color: it.tone ?? palette.accent
			});
			this.page.drawText(safe(`${formatCount(it.count)}  ·  ${formatPct(it.pct)}`), {
				x: bx + bw + 6,
				y: top - 13,
				size: 8,
				font: this.fonts.mono,
				color: palette.ink
			});
			this.y = top - rowH;
		}
		this.y -= 6;
	}

	table(opts: TableOptions) {
		const { columns } = opts;
		const size = opts.fontSize ?? 7.5;
		const rowH = size + 8;
		const headH = size + 9;
		const totalW = columns.reduce((s, c) => s + c.width, 0);
		const baselineIn = (top: number, h: number) => top - h + (h - size * 0.7) / 2;

		const barMax: Record<number, number> = {};
		columns.forEach((c, i) => {
			if (c.bar) barMax[i] = Math.max(1, ...opts.rows.map((r) => Number(r.cells[i]) || 0));
		});

		const drawHead = () => {
			const top = this.y;
			this.page.drawRectangle({
				x: this.marginX,
				y: top - headH,
				width: totalW,
				height: headH,
				color: palette.accent
			});
			let x = this.marginX;
			for (const col of columns) {
				const t = fit(col.header, this.fonts.bold, size, col.width - PAD * 2);
				const w = this.fonts.bold.widthOfTextAtSize(t, size);
				const tx = col.align === 'right' ? x + col.width - PAD - w : x + PAD;
				this.page.drawText(t, {
					x: tx,
					y: baselineIn(top, headH),
					size,
					font: this.fonts.bold,
					color: palette.white
				});
				x += col.width;
			}
			this.y = top - headH;
		};

		// Keep the heading with its header row and at least one body row.
		this.ensure((opts.title ? 23 : 0) + headH + rowH);
		if (opts.title) this.sectionHeading(opts.title);
		drawHead();

		let zebraIdx = 0;
		for (const row of opts.rows) {
			if (this.y - rowH < this.marginBottom) {
				this.newPage();
				if (opts.title) this.sectionHeading(`${opts.title} (cont.)`);
				drawHead();
			}
			const top = this.y;
			const fill = row.fill ?? (opts.zebra && zebraIdx % 2 === 1 ? palette.zebra : undefined);
			if (fill)
				this.page.drawRectangle({
					x: this.marginX,
					y: top - rowH,
					width: totalW,
					height: rowH,
					color: fill
				});
			if (row.topRule)
				this.page.drawLine({
					start: { x: this.marginX, y: top },
					end: { x: this.marginX + totalW, y: top },
					thickness: 0.9,
					color: palette.accent
				});
			let x = this.marginX;
			columns.forEach((col, i) => {
				const raw = row.cells[i];
				if (col.bar && !row.strong) {
					const frac = (Number(raw) || 0) / barMax[i];
					const bw = (col.width - PAD * 2) * Math.max(0, Math.min(1, frac));
					if (bw > 0)
						this.page.drawRectangle({
							x: x + PAD,
							y: top - rowH + 2.5,
							width: bw,
							height: rowH - 5,
							color: palette.accentSoft
						});
				}
				const text = raw === undefined || raw === null ? '' : String(raw);
				const font = row.strong
					? col.mono
						? this.fonts.monoBold
						: this.fonts.bold
					: col.mono
						? this.fonts.mono
						: this.fonts.regular;
				const indent = i === 0 ? (row.indent ?? 0) : 0;
				const t = fit(text, font, size, col.width - PAD * 2 - indent);
				const w = font.widthOfTextAtSize(t, size);
				const tx = col.align === 'right' ? x + col.width - PAD - w : x + PAD + indent;
				this.page.drawText(t, { x: tx, y: baselineIn(top, rowH), size, font, color: palette.ink });
				x += col.width;
			});
			this.page.drawLine({
				start: { x: this.marginX, y: top - rowH },
				end: { x: this.marginX + totalW, y: top - rowH },
				thickness: 0.4,
				color: palette.hairline
			});
			this.y = top - rowH;
			zebraIdx++;
		}
		this.page.drawLine({
			start: { x: this.marginX, y: this.y },
			end: { x: this.marginX + totalW, y: this.y },
			thickness: 1,
			color: palette.accent
		});
		this.y -= 16;
	}

	async finish(footer: {
		left: string;
		center: string;
		folio?: string;
		generatedBy?: string;
	}): Promise<Uint8Array> {
		const pages = this.pdf.getPages();
		const total = pages.length;
		pages.forEach((pg, i) => {
			const fy = 26;
			pg.drawLine({
				start: { x: this.marginX, y: fy + 11 },
				end: { x: this.right, y: fy + 11 },
				thickness: 0.5,
				color: palette.hairline
			});
			if (footer.folio) {
				pg.drawText(safe(`Folio: ${footer.folio}`), {
					x: this.marginX,
					y: fy - 11,
					size: 6.5,
					font: this.fonts.mono,
					color: palette.muted
				});
				if (footer.generatedBy) {
					const g = safe(`Generó: ${footer.generatedBy}`);
					const gw = this.fonts.regular.widthOfTextAtSize(g, 6.5);
					pg.drawText(g, {
						x: this.right - gw,
						y: fy - 11,
						size: 6.5,
						font: this.fonts.regular,
						color: palette.muted
					});
				}
			}
			pg.drawText(safe(footer.left), {
				x: this.marginX,
				y: fy,
				size: 7.5,
				font: this.fonts.regular,
				color: palette.muted
			});
			const center = safe(footer.center);
			const cw = this.fonts.regular.widthOfTextAtSize(center, 7.5);
			pg.drawText(center, {
				x: this.marginX + (this.contentWidth - cw) / 2,
				y: fy,
				size: 7.5,
				font: this.fonts.regular,
				color: palette.muted
			});
			const pageStr = safe(`Página ${i + 1} de ${total}`);
			const pw = this.fonts.regular.widthOfTextAtSize(pageStr, 7.5);
			pg.drawText(pageStr, {
				x: this.right - pw,
				y: fy,
				size: 7.5,
				font: this.fonts.regular,
				color: palette.muted
			});
		});
		return this.pdf.save();
	}
}
