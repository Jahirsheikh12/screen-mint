let openCount = 0;
let pending: ReturnType<typeof setTimeout> | null = null;
let emittedOpen = false;
const subscribers = new Set<(open: boolean) => void>();

function emit(open: boolean): void {
	if (emittedOpen === open) {
		return;
	}

	emittedOpen = open;
	for (const subscriber of subscribers) {
		subscriber(open);
	}
}

function syncHudDropdownExpanded(target: boolean): void {
	void window.electronAPI?.setHudDropdownExpanded?.(target);
}

export function notifyHudDropdownToggle(open: boolean): void {
	if (open) {
		openCount += 1;
		if (openCount === 1) {
			if (pending) {
				clearTimeout(pending);
				pending = null;
			}
			emit(true);
			syncHudDropdownExpanded(true);
		}
		return;
	}

	openCount = Math.max(0, openCount - 1);
	if (openCount === 0) {
		if (pending) clearTimeout(pending);
		pending = setTimeout(() => {
			pending = null;
			emit(false);
			syncHudDropdownExpanded(false);
		}, 80);
	}
}

export function bindHudDropdown(
	handler: ((open: boolean) => void) | undefined,
): (open: boolean) => void {
	return (open: boolean) => {
		notifyHudDropdownToggle(open);
		handler?.(open);
	};
}

export function subscribeHudDropdownOpen(handler: (open: boolean) => void): () => void {
	subscribers.add(handler);
	handler(emittedOpen);

	return () => {
		subscribers.delete(handler);
	};
}
