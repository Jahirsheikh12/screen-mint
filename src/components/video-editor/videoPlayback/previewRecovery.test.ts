import { describe, expect, it, vi } from "vitest";
import {
	hasRenderablePreviewFrame,
	PREVIEW_READY_STATE_CURRENT_DATA,
	type PreviewRecoveryVideo,
	restorePreviewFrame,
} from "./previewRecovery";

class FakeVideo implements PreviewRecoveryVideo {
	src: string;
	currentSrc: string;
	readyState = PREVIEW_READY_STATE_CURRENT_DATA;
	paused = true;
	ended = false;
	error: MediaError | null = null;
	loadCalls = 0;
	playCalls = 0;
	pauseCalls = 0;

	private listeners = new Map<string, Set<EventListenerOrEventListenerObject>>();
	private seekDelayMs: number;
	private loadBehavior: "success" | "error";
	private currentTimeValue = 0;

	constructor({
		src = "file:///recording.mp4",
		currentTime = 0,
		readyState = PREVIEW_READY_STATE_CURRENT_DATA,
		paused = true,
		loadBehavior = "success",
		seekDelayMs = 0,
	}: {
		src?: string;
		currentTime?: number;
		readyState?: number;
		paused?: boolean;
		loadBehavior?: "success" | "error";
		seekDelayMs?: number;
	} = {}) {
		this.src = src;
		this.currentSrc = src;
		this.currentTimeValue = currentTime;
		this.readyState = readyState;
		this.paused = paused;
		this.loadBehavior = loadBehavior;
		this.seekDelayMs = seekDelayMs;
	}

	get currentTime() {
		return this.currentTimeValue;
	}

	set currentTime(value: number) {
		this.currentTimeValue = value;
		setTimeout(() => this.emit("seeked"), this.seekDelayMs);
	}

	load() {
		this.loadCalls += 1;
		setTimeout(() => {
			if (this.loadBehavior === "error") {
				this.error = { code: 4 } as MediaError;
				this.emit("error");
				return;
			}

			this.error = null;
			this.readyState = PREVIEW_READY_STATE_CURRENT_DATA;
			this.emit("loadeddata");
		}, 0);
	}

	async play() {
		this.playCalls += 1;
		this.paused = false;
	}

	pause() {
		this.pauseCalls += 1;
		this.paused = true;
	}

	addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
		const listeners = this.listeners.get(type) ?? new Set<EventListenerOrEventListenerObject>();
		listeners.add(listener);
		this.listeners.set(type, listeners);
	}

	removeEventListener(type: string, listener: EventListenerOrEventListenerObject) {
		this.listeners.get(type)?.delete(listener);
	}

	private emit(type: string) {
		for (const listener of this.listeners.get(type) ?? []) {
			if (typeof listener === "function") {
				listener(new Event(type));
			} else {
				listener.handleEvent(new Event(type));
			}
		}
	}
}

describe("previewRecovery", () => {
	it("detects when the preview already has a renderable frame", () => {
		const video = new FakeVideo();
		expect(hasRenderablePreviewFrame(video)).toBe(true);
	});

	it("redraws the existing frame when the preview is still renderable", async () => {
		const video = new FakeVideo({
			currentTime: 14.25,
			readyState: PREVIEW_READY_STATE_CURRENT_DATA,
		});
		const redrawFrame = vi.fn(async () => undefined);
		const syncPreviewLayer = vi.fn(async () => undefined);

		const result = await restorePreviewFrame(video, {
			redrawFrame,
			syncPreviewLayer,
		});

		expect(result).toEqual({
			mode: "redraw",
			recovered: true,
			restoreTime: 14.25,
		});
		expect(redrawFrame).toHaveBeenCalledTimes(1);
		expect(syncPreviewLayer).toHaveBeenCalledTimes(1);
		expect(video.loadCalls).toBe(0);
		expect(video.currentTime).toBe(14.25);
	});

	it("reloads the same source and restores the prior time when the preview frame is gone", async () => {
		const video = new FakeVideo({
			currentTime: 22.4,
			readyState: 0,
			paused: true,
		});
		const redrawFrame = vi.fn(async () => undefined);
		const prepareForReload = vi.fn();
		const syncPreviewLayer = vi.fn(async () => undefined);

		const result = await restorePreviewFrame(video, {
			prepareForReload,
			redrawFrame,
			syncPreviewLayer,
		});

		expect(result).toEqual({
			mode: "reload",
			recovered: true,
			restoreTime: 22.4,
		});
		expect(video.loadCalls).toBe(1);
		expect(prepareForReload).toHaveBeenCalledTimes(1);
		expect(redrawFrame).toHaveBeenCalledTimes(1);
		expect(syncPreviewLayer).toHaveBeenCalledTimes(1);
		expect(video.currentTime).toBe(22.4);
		expect(video.src).toBe("file:///recording.mp4");
	});

	it("falls back to a reload if a redraw-only recovery fails", async () => {
		const video = new FakeVideo({ currentTime: 8.5 });
		const redrawFrame = vi
			.fn<() => Promise<void>>()
			.mockRejectedValueOnce(new Error("frame missing"))
			.mockResolvedValueOnce(undefined);

		const result = await restorePreviewFrame(video, {
			redrawFrame,
		});

		expect(result.mode).toBe("reload");
		expect(video.loadCalls).toBe(1);
		expect(redrawFrame).toHaveBeenCalledTimes(2);
	});

	it("fails without clearing the source when the video cannot be reloaded", async () => {
		const video = new FakeVideo({
			currentTime: 5.5,
			readyState: 0,
			loadBehavior: "error",
		});
		const redrawFrame = vi.fn(async () => undefined);

		await expect(
			restorePreviewFrame(video, {
				redrawFrame,
			}),
		).rejects.toThrow("Preview recovery failed");
		expect(video.src).toBe("file:///recording.mp4");
		expect(video.currentSrc).toBe("file:///recording.mp4");
	});
});
