export type FeatureFlagKey = "screenshots";

export type FeatureFlags = Record<FeatureFlagKey, boolean>;

export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
	screenshots: false,
};

function readEnvFlag(key: string): boolean | undefined {
	const value =
		typeof process !== "undefined" && process.env
			? process.env[key]?.trim().toLowerCase()
			: undefined;
	if (!value) return undefined;
	if (["1", "true", "yes", "on"].includes(value)) return true;
	if (["0", "false", "no", "off"].includes(value)) return false;
	return undefined;
}

export function getFeatureFlags(overrides: Partial<FeatureFlags> = {}): FeatureFlags {
	return {
		screenshots:
			overrides.screenshots ??
			readEnvFlag("SCREENMINT_FEATURE_SCREENSHOTS") ??
			DEFAULT_FEATURE_FLAGS.screenshots,
	};
}

export function isFeatureEnabled(key: FeatureFlagKey, overrides?: Partial<FeatureFlags>) {
	return getFeatureFlags(overrides)[key];
}
