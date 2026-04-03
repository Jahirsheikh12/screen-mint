export type PreviewHoldReason = "export" | "dialog" | "recovery";

export interface PreviewHoldLease {
	token: string;
	reason: PreviewHoldReason;
	frameSrc: string;
}

export function addPreviewHold(
	holds: Map<string, PreviewHoldLease>,
	hold: PreviewHoldLease,
): Map<string, PreviewHoldLease> {
	const next = new Map(holds);
	next.set(hold.token, hold);
	return next;
}

export function removePreviewHold(
	holds: Map<string, PreviewHoldLease>,
	token: string,
): Map<string, PreviewHoldLease> {
	if (!holds.has(token)) {
		return holds;
	}

	const next = new Map(holds);
	next.delete(token);
	return next;
}

export function clearPreviewHolds(): Map<string, PreviewHoldLease> {
	return new Map();
}

export function getActivePreviewHold(
	holds: Map<string, PreviewHoldLease>,
): PreviewHoldLease | null {
	let activeHold: PreviewHoldLease | null = null;

	for (const hold of holds.values()) {
		activeHold = hold;
	}

	return activeHold;
}

export function resolvePreviewFrameOverlaySource(options: {
	activePreviewHoldSrc: string | null;
	cachedPreviewFrameSrc: string | null;
	pixiReady: boolean;
	videoReady: boolean;
	hasVideoPath: boolean;
}): string | null {
	if (options.activePreviewHoldSrc) {
		return options.activePreviewHoldSrc;
	}

	if ((!options.pixiReady || !options.videoReady) && options.hasVideoPath) {
		return options.cachedPreviewFrameSrc;
	}

	return null;
}
