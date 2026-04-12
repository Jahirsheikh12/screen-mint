let openCount = 0;
let pending: ReturnType<typeof setTimeout> | null = null;

function flush(target: boolean) {
	pending = null;
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
			flush(true);
		}
		return;
	}

	openCount = Math.max(0, openCount - 1);
	if (openCount === 0) {
		if (pending) clearTimeout(pending);
		pending = setTimeout(() => flush(false), 80);
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
