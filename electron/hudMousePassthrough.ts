export type HudMousePassthroughState = {
	dragActive: boolean;
	contentVisible: boolean;
	dropdownExpanded: boolean;
	passthroughRequested: boolean;
};

export function shouldEnableHudMousePassthrough({
	dragActive,
	contentVisible,
	dropdownExpanded,
	passthroughRequested,
}: HudMousePassthroughState): boolean {
	return passthroughRequested && !dragActive && !contentVisible && !dropdownExpanded;
}
