export type Platform = "macos" | "windows" | "linux" | "unknown";
export type MacArchitecture = "apple-silicon" | "intel" | "unknown";

export const PLATFORM_LABELS: Record<Platform, string> = {
	macos: "macOS",
	windows: "Windows",
	linux: "Linux",
	unknown: "",
};

export function detectPlatform(): Platform {
	const ua = navigator.userAgent.toLowerCase();
	// Phones and tablets cannot run the desktop builds; iOS UAs say "Mac OS X" and Android says "Linux".
	if (/iphone|ipad|ipod|android/.test(ua)) return "unknown";
	if (ua.includes("mac")) return "macos";
	if (ua.includes("win")) return "windows";
	if (ua.includes("linux")) return "linux";
	return "unknown";
}

export async function detectMacArchitecture(): Promise<MacArchitecture> {
	type NavigatorWithUAData = Navigator & {
		userAgentData?: {
			getHighEntropyValues?: (
				hints: string[],
			) => Promise<{ architecture?: string; platform?: string }>;
		};
	};

	const typedNavigator = navigator as NavigatorWithUAData;

	try {
		const highEntropyValues = await typedNavigator.userAgentData?.getHighEntropyValues?.([
			"architecture",
			"platform",
		]);
		const architecture = highEntropyValues?.architecture?.toLowerCase();
		if (architecture?.includes("arm")) return "apple-silicon";
		if (architecture?.includes("x86")) return "intel";
	} catch {
		// Fall back to user agent sniffing below.
	}

	const ua = navigator.userAgent.toLowerCase();
	if (ua.includes("arm") || ua.includes("aarch64") || ua.includes("apple silicon")) {
		return "apple-silicon";
	}

	return "unknown";
}
