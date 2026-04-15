export interface BuiltInWallpaper {
	id: string;
	label: string;
	relativePath: string;
	publicPath: string;
	thumbRelativePath: string;
	thumbPublicPath: string;
}

function createBuiltInWallpaper(id: string, label: string, fileName: string): BuiltInWallpaper {
	const thumbFileName = `${fileName.replace(/\.[^.]+$/, "")}.webp`;
	return {
		id,
		label,
		relativePath: `wallpapers/${fileName}`,
		publicPath: `/wallpapers/${fileName}`,
		thumbRelativePath: `wallpapers/thumbs/${thumbFileName}`,
		thumbPublicPath: `/wallpapers/thumbs/${thumbFileName}`,
	};
}

const REMOVED_BUILT_IN_WALLPAPERS: Array<Pick<BuiltInWallpaper, "relativePath" | "publicPath">> = [
	{ relativePath: "wallpapers/wallpaper1.jpg", publicPath: "/wallpapers/wallpaper1.jpg" },
	{ relativePath: "wallpapers/wallpaper2.jpg", publicPath: "/wallpapers/wallpaper2.jpg" },
	{ relativePath: "wallpapers/wallpaper3.jpg", publicPath: "/wallpapers/wallpaper3.jpg" },
	{ relativePath: "wallpapers/wallpaper4.jpg", publicPath: "/wallpapers/wallpaper4.jpg" },
	{ relativePath: "wallpapers/wallpaper5.jpg", publicPath: "/wallpapers/wallpaper5.jpg" },
	{ relativePath: "wallpapers/wallpaper6.jpg", publicPath: "/wallpapers/wallpaper6.jpg" },
	{ relativePath: "wallpapers/wallpaper7.jpg", publicPath: "/wallpapers/wallpaper7.jpg" },
	{ relativePath: "wallpapers/wallpaper8.jpg", publicPath: "/wallpapers/wallpaper8.jpg" },
	{ relativePath: "wallpapers/wallpaper9.jpg", publicPath: "/wallpapers/wallpaper9.jpg" },
	{ relativePath: "wallpapers/wallpaper10.jpg", publicPath: "/wallpapers/wallpaper10.jpg" },
	{ relativePath: "wallpapers/wallpaper11.jpg", publicPath: "/wallpapers/wallpaper11.jpg" },
	{ relativePath: "wallpapers/wallpaper12.jpg", publicPath: "/wallpapers/wallpaper12.jpg" },
	{ relativePath: "wallpapers/wallpaper13.jpg", publicPath: "/wallpapers/wallpaper13.jpg" },
	{ relativePath: "wallpapers/wallpaper14.jpg", publicPath: "/wallpapers/wallpaper14.jpg" },
	{ relativePath: "wallpapers/wallpaper15.jpg", publicPath: "/wallpapers/wallpaper15.jpg" },
	{ relativePath: "wallpapers/wallpaper16.jpg", publicPath: "/wallpapers/wallpaper16.jpg" },
	{ relativePath: "wallpapers/wallpaper17.jpg", publicPath: "/wallpapers/wallpaper17.jpg" },
	{ relativePath: "wallpapers/wallpaper18.jpg", publicPath: "/wallpapers/wallpaper18.jpg" },
	{ relativePath: "wallpapers/cityscape.jpg", publicPath: "/wallpapers/cityscape.jpg" },
	{ relativePath: "wallpapers/farmvalley.jpg", publicPath: "/wallpapers/farmvalley.jpg" },
	{ relativePath: "wallpapers/levels.jpg", publicPath: "/wallpapers/levels.jpg" },
	{ relativePath: "wallpapers/mountaintrees.jpg", publicPath: "/wallpapers/mountaintrees.jpg" },
	{ relativePath: "wallpapers/luisdelrio.jpg", publicPath: "/wallpapers/luisdelrio.jpg" },
];

export const BUILT_IN_WALLPAPERS: BuiltInWallpaper[] = [
	createBuiltInWallpaper("green-blue-waves", "Green Blue Waves", "green-blue-waves.jpg"),
	createBuiltInWallpaper("black-liquid", "Black Liquid", "black-liquid.jpg"),
	createBuiltInWallpaper("anime-camper-valley", "Anime Camper Valley", "anime-camper-valley.png"),
	createBuiltInWallpaper("green-liquid", "Green Liquid", "green-liquid.jpg"),
	createBuiltInWallpaper("multicolor-ribbons", "Multicolor Ribbons", "multicolor-ribbons.jpg"),
	createBuiltInWallpaper("pink-curves", "Pink Curves", "pink-curves.jpg"),
	createBuiltInWallpaper("gray-liquid-glass", "Gray Liquid Glass", "gray-liquid-glass.jpg"),
	createBuiltInWallpaper("sunset-mountains", "Sunset Mountains", "sunset-mountains.webp"),
	createBuiltInWallpaper("purple-folds", "Purple Folds", "purple-folds.jpg"),
	createBuiltInWallpaper("red-distortion", "Red Distortion", "red-distortion.jpg"),
	createBuiltInWallpaper("topography-lines", "Topography Lines", "topography-lines.jpg"),
	createBuiltInWallpaper("colorful-feathers", "Colorful Feathers", "colorful-feathers.jpg"),
	createBuiltInWallpaper("blue-abstract", "Blue Abstract", "blue-abstract.jpg"),
	createBuiltInWallpaper("fabric-ribbon", "Fabric Ribbon", "fabric-ribbon.png"),
	createBuiltInWallpaper("pixel-orbs", "Pixel Orbs", "pixel-orbs.jpg"),
	createBuiltInWallpaper("geometric-gradients", "Geometric Gradients", "geometric-gradients.jpg"),
	createBuiltInWallpaper("green-abstract", "Green Abstract", "green-abstract.jpg"),
	createBuiltInWallpaper("yellow-bubbles", "Yellow Bubbles", "yellow-bubbles.png"),
	createBuiltInWallpaper(
		"macbook-air-gradient",
		"MacBook Air Gradient",
		"macbook-air-gradient.jpg",
	),
	createBuiltInWallpaper("mojave-solar-blue", "Mojave Solar Blue", "mojave-solar-blue.jpg"),
	createBuiltInWallpaper("mojave-solar-dawn", "Mojave Solar Dawn", "mojave-solar-dawn.jpg"),
	createBuiltInWallpaper(
		"sequoia-icons-orange",
		"Sequoia Icons Orange",
		"sequoia-icons-orange.jpg",
	),
	createBuiltInWallpaper("sequoia-icons-pink", "Sequoia Icons Pink", "sequoia-icons-pink.jpg"),
	createBuiltInWallpaper("sequoia-icons-blue", "Sequoia Icons Blue", "sequoia-icons-blue.jpg"),
	createBuiltInWallpaper("sequoia-icons-lime", "Sequoia Icons Lime", "sequoia-icons-lime.jpg"),
	createBuiltInWallpaper("lion-autumn-mist", "Lion Autumn Mist", "lion-autumn-mist.jpg"),
	createBuiltInWallpaper("lion-twilight-fuji", "Lion Twilight Fuji", "lion-twilight-fuji.jpg"),
	createBuiltInWallpaper("mountain-lion-leaf", "Mountain Lion Leaf", "mountain-lion-leaf.jpg"),
	createBuiltInWallpaper("mountain-lion-snow", "Mountain Lion Snow", "mountain-lion-snow.jpg"),
	createBuiltInWallpaper("pink-abstract", "Pink Abstract", "pink-abstract.jpg"),
	createBuiltInWallpaper("pink-wine-hands", "Pink Wine Hands", "pink-wine-hands.jpg"),
	createBuiltInWallpaper("purple-abstract", "Purple Abstract", "purple-abstract.jpg"),
	createBuiltInWallpaper("red-abstract", "Red Abstract", "red-abstract.jpg"),
	createBuiltInWallpaper("tomb-raider-climb", "Tomb Raider Climb", "tomb-raider-climb.jpg"),
	createBuiltInWallpaper("forest-green-path", "Forest Green Path", "forest-green-path.jpg"),
	createBuiltInWallpaper("vector-wave-blur", "Vector Wave Blur", "vector-wave-blur.jpg"),
	createBuiltInWallpaper("winter-mountain", "Winter Mountain", "winter-mountain.jpg"),
];

export const WALLPAPER_PATHS = BUILT_IN_WALLPAPERS.map((wallpaper) => wallpaper.publicPath);
export const WALLPAPER_RELATIVE_PATHS = BUILT_IN_WALLPAPERS.map(
	(wallpaper) => wallpaper.relativePath,
);
export const WALLPAPER_THUMB_RELATIVE_PATHS = BUILT_IN_WALLPAPERS.map(
	(wallpaper) => wallpaper.thumbRelativePath,
);
export const DEFAULT_WALLPAPER_PATH = WALLPAPER_PATHS[0];
export const DEFAULT_WALLPAPER_RELATIVE_PATH = WALLPAPER_RELATIVE_PATHS[0];

const BUILT_IN_WALLPAPER_BY_FILENAME = new Map(
	BUILT_IN_WALLPAPERS.map((wallpaper) => [
		wallpaper.relativePath.split("/").pop()?.toLowerCase() ?? "",
		wallpaper.publicPath,
	]),
);

export function isRemovedBuiltInWallpaperPath(path: string): boolean {
	const normalizedPath = path.replace(/\\/g, "/");

	return REMOVED_BUILT_IN_WALLPAPERS.some(({ relativePath, publicPath }) => {
		return (
			normalizedPath === relativePath ||
			normalizedPath === publicPath ||
			normalizedPath.endsWith(`/${relativePath}`) ||
			normalizedPath.endsWith(publicPath)
		);
	});
}

export function normalizeWallpaperSelection(path: string): string {
	const normalizedPath = path.replace(/\\/g, "/");
	const filename = normalizedPath.split("/").pop()?.toLowerCase() ?? "";
	const currentBuiltInPath = BUILT_IN_WALLPAPER_BY_FILENAME.get(filename);

	if (currentBuiltInPath) {
		return currentBuiltInPath;
	}

	return isRemovedBuiltInWallpaperPath(normalizedPath) ? DEFAULT_WALLPAPER_PATH : path;
}
