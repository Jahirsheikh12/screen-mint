import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "../..");
const css = readFileSync(path.join(root, "src/index.css"), "utf8");

function themeTokens(selector: string): Record<string, number[]> {
	const start = css.indexOf(`${selector} {`);
	const block = css.slice(start, css.indexOf("}", start));
	const tokens: Record<string, number[]> = {};
	for (const [, name, r, g, b] of block.matchAll(/--([\w-]+):\s*(\d+) (\d+) (\d+);/g)) {
		tokens[name] = [Number(r), Number(g), Number(b)];
	}
	return tokens;
}

function luminance([r, g, b]: number[]): number {
	const [R, G, B] = [r, g, b].map((c) => {
		const s = c / 255;
		return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

function contrast(a: number[], b: number[]): number {
	const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
	return (hi + 0.05) / (lo + 0.05);
}

const WHITE = [255, 255, 255];
const surfaces = ["canvas", "surface", "raised", "sunken"];
// [foreground, minimum ratio] that must hold on every surface.
const textPairs: [string, number][] = [
	["fg", 7],
	["fg-muted", 4.5],
	["fg-subtle", 4.5],
	["accent-fg", 4.5],
	["danger-fg", 4.5],
	["success-fg", 4.5],
	["warning-fg", 4.5],
	["info-fg", 4.5],
	["focus", 3],
];

describe.each([
	["dark", ':root,\n\t[data-theme="dark"]'],
	["light", '[data-theme="light"]'],
])("%s theme tokens", (_name, selector) => {
	const t = themeTokens(selector);

	it.each(textPairs)("%s reads on every surface", (fg, min) => {
		for (const surface of surfaces) {
			expect(t[fg], fg).toBeDefined();
			expect(contrast(t[fg], t[surface]), `${fg} on ${surface}`).toBeGreaterThanOrEqual(min);
		}
	});

	it("text on filled accent and danger buttons reads", () => {
		expect(contrast(t["on-accent"], t.accent)).toBeGreaterThanOrEqual(4.5);
		expect(contrast(t["on-accent"], t["accent-hover"])).toBeGreaterThanOrEqual(4.5);
		expect(contrast(WHITE, t.danger)).toBeGreaterThanOrEqual(4.5);
	});
});

// Hard-coded palette colours must not creep back into the UI; use the tokens in tailwind.config.cjs.
// These files draw over or into the video, where literal colours are the point.
const ALLOWED = new Set([
	"video-editor/VideoPlayback.tsx",
	"video-editor/WebcamOverlay.tsx",
	"video-editor/AnnotationOverlay.tsx",
	"video-editor/CaptionOverlay.tsx",
	"video-editor/CropControl.tsx",
	"video-editor/KeyboardShortcutOverlay.tsx",
	"video-editor/ArrowSvgs.tsx",
	"video-editor/ColorPicker.tsx",
	// Preset mood swatches.
	"video-editor/settings/StudioSettingsTab.tsx",
	"video-editor/videoPlayback/PlaybackOverlays.tsx",
	"launch/AreaSelectionOverlay.tsx",
]);
const RAW_COLOUR =
	/\b(?:bg|text|border(?:-[tblrxy])?|ring|divide|from|via|to|fill|stroke|outline|placeholder|caret)-(?:white|black|(?:slate|zinc|neutral|gray|stone|amber|orange|yellow|red|emerald|green|blue|sky)-\d+|\[#[0-9a-fA-F]{3,8}\])\b/g;

function tsxFiles(dir: string): string[] {
	return readdirSync(dir).flatMap((name) => {
		const full = path.join(dir, name);
		if (statSync(full).isDirectory()) return tsxFiles(full);
		return name.endsWith(".tsx") && !name.includes(".test.") ? [full] : [];
	});
}

describe("UI colours", () => {
	it("use semantic tokens instead of raw palette classes", () => {
		const componentsDir = path.join(root, "src/components");
		const offenders: string[] = [];
		for (const file of tsxFiles(componentsDir)) {
			const rel = path.relative(componentsDir, file).split(path.sep).join("/");
			if (ALLOWED.has(rel)) continue;
			const hits = readFileSync(file, "utf8").match(RAW_COLOUR);
			if (hits) offenders.push(`${rel}: ${[...new Set(hits)].join(" ")}`);
		}
		expect(offenders).toEqual([]);
	});
});
