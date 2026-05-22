import { afterEach, describe, expect, it, vi } from "vitest";

async function loadHudDropdownExpansion(setHudDropdownExpanded = vi.fn(() => Promise.resolve())) {
	vi.resetModules();
	vi.stubGlobal("window", {
		electronAPI: {
			setHudDropdownExpanded,
		},
	});

	const module = await import("./hudDropdownExpansion");
	return { module, setHudDropdownExpanded };
}

describe("hudDropdownExpansion", () => {
	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
		vi.resetModules();
	});

	it("notifies subscribers immediately when a dropdown opens", async () => {
		let resolveIpc: (() => void) | null = null;
		const setHudDropdownExpanded = vi.fn(
			() =>
				new Promise<void>((resolve) => {
					resolveIpc = resolve;
				}),
		);
		const { module } = await loadHudDropdownExpansion(setHudDropdownExpanded);
		const events: boolean[] = [];
		module.subscribeHudDropdownOpen((open) => events.push(open));
		events.length = 0;

		module.notifyHudDropdownToggle(true);

		expect(events).toEqual([true]);
		expect(setHudDropdownExpanded).toHaveBeenCalledWith(true);

		resolveIpc?.();
	});

	it("waits before notifying closed and shrinking the HUD", async () => {
		vi.useFakeTimers();
		const { module, setHudDropdownExpanded } = await loadHudDropdownExpansion();
		const events: boolean[] = [];
		module.subscribeHudDropdownOpen((open) => events.push(open));

		module.notifyHudDropdownToggle(true);
		events.length = 0;
		setHudDropdownExpanded.mockClear();

		module.notifyHudDropdownToggle(false);
		vi.advanceTimersByTime(79);

		expect(events).toEqual([]);
		expect(setHudDropdownExpanded).not.toHaveBeenCalled();

		vi.advanceTimersByTime(1);

		expect(events).toEqual([false]);
		expect(setHudDropdownExpanded).toHaveBeenCalledWith(false);
	});

	it("cancels a pending close when another dropdown opens", async () => {
		vi.useFakeTimers();
		const { module, setHudDropdownExpanded } = await loadHudDropdownExpansion();
		const events: boolean[] = [];
		module.subscribeHudDropdownOpen((open) => events.push(open));

		module.notifyHudDropdownToggle(true);
		module.notifyHudDropdownToggle(false);
		events.length = 0;
		setHudDropdownExpanded.mockClear();

		vi.advanceTimersByTime(40);
		module.notifyHudDropdownToggle(true);
		vi.advanceTimersByTime(80);

		expect(events).toEqual([]);
		expect(setHudDropdownExpanded).toHaveBeenCalledTimes(1);
		expect(setHudDropdownExpanded).toHaveBeenCalledWith(true);
	});
});
