import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";

const handlers = new Map<string, (...args: unknown[]) => unknown>();
type FakeWindow = EventEmitter & {
	isDestroyed: () => boolean;
	webContents: EventEmitter & { send: () => void };
};
let countdownWindow: FakeWindow | null = null;

vi.mock("electron", () => ({
	app: { getPath: () => "/tmp" },
	ipcMain: { handle: (channel: string, handler: () => unknown) => handlers.set(channel, handler) },
}));
vi.mock("../updater", () => ({ getScreenMintUpdater: () => ({}) }));
vi.mock("../windows", () => ({
	createCountdownWindow: () => {
		const webContents = Object.assign(new EventEmitter(), { send: vi.fn() });
		countdownWindow = Object.assign(new EventEmitter(), { webContents, isDestroyed: () => false });
		return countdownWindow;
	},
	getCountdownWindow: () => countdownWindow,
	closeCountdownWindow: () => {
		const win = countdownWindow;
		countdownWindow = null;
		win?.emit("closed");
	},
	closeAreaOverlayWindow: vi.fn(),
	closeSpeakerNotesWindow: vi.fn(),
	createAreaOverlayWindow: vi.fn(),
	createSpeakerNotesWindow: vi.fn(),
	lockAreaOverlayWindow: vi.fn(),
	updateSpeakerNotesWindow: vi.fn(),
}));

const { IPC_CHANNELS } = await import("../../src/electron-ipc/contracts");
const { registerSystemSettingsIpcHandlers } = await import("./systemSettingsHandlers");
registerSystemSettingsIpcHandlers();

const start = (seconds: number) =>
	handlers.get(IPC_CHANNELS.countdown.start)?.({}, seconds) as Promise<unknown>;
const cancel = () => handlers.get(IPC_CHANNELS.countdown.cancel)?.({});

describe("countdown IPC", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	it("resolves as cancelled when cancelled mid-countdown, and can start again", async () => {
		const first = start(3);
		countdownWindow?.webContents.emit("did-finish-load");
		vi.advanceTimersByTime(1000);
		cancel();
		await expect(first).resolves.toEqual({ success: false, cancelled: true });

		const second = start(1);
		countdownWindow?.webContents.emit("did-finish-load");
		vi.advanceTimersByTime(1000);
		await expect(second).resolves.toEqual({ success: true });
	});

	it("resolves as cancelled when the window closes before it loads", async () => {
		const pending = start(3);
		countdownWindow?.emit("closed");
		await expect(pending).resolves.toEqual({ success: false, cancelled: true });
	});
});
