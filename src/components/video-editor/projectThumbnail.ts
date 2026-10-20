import type { Application } from "pixi.js";

const THUMBNAIL_WIDTH = 320;

/** Small JPEG of the current preview frame for the project browser, or null if unavailable. */
export function captureProjectThumbnail(app: Application | null): string | null {
	try {
		if (!app?.canvas || app.canvas.width === 0 || app.canvas.height === 0) return null;
		// WebGL canvases may clear after compositing; render and copy in the same tick.
		app.renderer.render(app.stage);
		const source = app.canvas as HTMLCanvasElement;
		const canvas = document.createElement("canvas");
		canvas.width = THUMBNAIL_WIDTH;
		canvas.height = Math.round((source.height / source.width) * THUMBNAIL_WIDTH);
		const ctx = canvas.getContext("2d");
		if (!ctx) return null;
		ctx.fillStyle = "#000";
		ctx.fillRect(0, 0, canvas.width, canvas.height);
		ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
		return canvas.toDataURL("image/jpeg", 0.7);
	} catch {
		return null;
	}
}
