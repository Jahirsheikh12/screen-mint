import { useEffect, useState } from "react";
import { getAssetPath, getRenderableAssetUrl } from "@/lib/assetPath";
import {
	DEFAULT_WALLPAPER_PATH,
	DEFAULT_WALLPAPER_RELATIVE_PATH,
	normalizeWallpaperSelection,
} from "@/lib/wallpapers";

export function useResolvedWallpaper(wallpaper: string | undefined): string | null {
	const [resolvedWallpaper, setResolvedWallpaper] = useState<string | null>(null);

	useEffect(() => {
		let mounted = true;
		(async () => {
			const resolvedDefaultWallpaper = await getRenderableAssetUrl(
				await getAssetPath(DEFAULT_WALLPAPER_RELATIVE_PATH),
			);

			try {
				const selectedWallpaper = wallpaper
					? normalizeWallpaperSelection(wallpaper)
					: DEFAULT_WALLPAPER_PATH;

				if (!selectedWallpaper) {
					if (mounted) setResolvedWallpaper(resolvedDefaultWallpaper);
					return;
				}

				if (
					selectedWallpaper.startsWith("#") ||
					selectedWallpaper.startsWith("linear-gradient") ||
					selectedWallpaper.startsWith("radial-gradient")
				) {
					if (mounted) setResolvedWallpaper(selectedWallpaper);
					return;
				}

				if (selectedWallpaper.startsWith("data:")) {
					if (mounted) setResolvedWallpaper(selectedWallpaper);
					return;
				}

				if (
					selectedWallpaper.startsWith("http") ||
					selectedWallpaper.startsWith("file://") ||
					selectedWallpaper.startsWith("/")
				) {
					const renderable = await getRenderableAssetUrl(selectedWallpaper);
					if (mounted) setResolvedWallpaper(renderable);
					return;
				}
				const assetPath = await getAssetPath(selectedWallpaper.replace(/^\//, ""));
				const renderable = await getRenderableAssetUrl(assetPath);
				if (mounted) setResolvedWallpaper(renderable);
			} catch {
				if (mounted) setResolvedWallpaper(resolvedDefaultWallpaper);
			}
		})();
		return () => {
			mounted = false;
		};
	}, [wallpaper]);

	return resolvedWallpaper;
}
