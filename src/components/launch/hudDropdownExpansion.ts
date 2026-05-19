let openCount = 0;
let pending: ReturnType<typeof setTimeout> | null = null;
const subscribers = new Set<(open: boolean) => void>();

function emit(open: boolean): void {
	for (const subscriber of subscribers) {
		subscriber(open);
	}
}

async function flush(target: boolean) {
	pending = null;
	await window.electronAPI?.setHudDropdownExpanded?.(target);
	emit(target);
}

export function notifyHudDropdownToggle(open: boolean): void {
	if (open) {
		openCount += 1;
		if (openCount === 1) {
			if (pending) {
				clearTimeout(pending);
				pending = null;
			}
			void flush(true);
		}
		return;
	}

	openCount = Math.max(0, openCount - 1);
	if (openCount === 0) {
		if (pending) clearTimeout(pending);
		pending = setTimeout(() => void flush(false), 80);
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
	handler(openCount > 0);

	return () => {
		subscribers.delete(handler);
	};
}
