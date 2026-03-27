export interface BuiltInWallpaper {
	id: string;
	label: string;
	relativePath: string;
	publicPath: string;
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
	{
		id: "green-blue-waves",
		label: "Green Blue Waves",
		relativePath: "wallpapers/green-blue-waves.jpg",
		publicPath: "/wallpapers/green-blue-waves.jpg",
	},
	{
		id: "black-liquid",
		label: "Black Liquid",
		relativePath: "wallpapers/black-liquid.jpg",
		publicPath: "/wallpapers/black-liquid.jpg",
	},
	{
		id: "anime-camper-valley",
		label: "Anime Camper Valley",
		relativePath: "wallpapers/anime-camper-valley.png",
		publicPath: "/wallpapers/anime-camper-valley.png",
	},
	{
		id: "green-liquid",
		label: "Green Liquid",
		relativePath: "wallpapers/green-liquid.jpg",
		publicPath: "/wallpapers/green-liquid.jpg",
	},
	{
		id: "multicolor-ribbons",
		label: "Multicolor Ribbons",
		relativePath: "wallpapers/multicolor-ribbons.jpg",
		publicPath: "/wallpapers/multicolor-ribbons.jpg",
	},
	{
		id: "pink-curves",
		label: "Pink Curves",
		relativePath: "wallpapers/pink-curves.jpg",
		publicPath: "/wallpapers/pink-curves.jpg",
	},
	{
		id: "gray-liquid-glass",
		label: "Gray Liquid Glass",
		relativePath: "wallpapers/gray-liquid-glass.jpg",
		publicPath: "/wallpapers/gray-liquid-glass.jpg",
	},
	{
		id: "sunset-mountains",
		label: "Sunset Mountains",
		relativePath: "wallpapers/sunset-mountains.webp",
		publicPath: "/wallpapers/sunset-mountains.webp",
	},
	{
		id: "purple-folds",
		label: "Purple Folds",
		relativePath: "wallpapers/purple-folds.jpg",
		publicPath: "/wallpapers/purple-folds.jpg",
	},
	{
		id: "red-distortion",
		label: "Red Distortion",
		relativePath: "wallpapers/red-distortion.jpg",
		publicPath: "/wallpapers/red-distortion.jpg",
	},
	{
		id: "topography-lines",
		label: "Topography Lines",
		relativePath: "wallpapers/topography-lines.jpg",
		publicPath: "/wallpapers/topography-lines.jpg",
	},
];

export const WALLPAPER_PATHS = BUILT_IN_WALLPAPERS.map((wallpaper) => wallpaper.publicPath);
export const WALLPAPER_RELATIVE_PATHS = BUILT_IN_WALLPAPERS.map(
	(wallpaper) => wallpaper.relativePath,
);
export const DEFAULT_WALLPAPER_PATH = WALLPAPER_PATHS[0];
export const DEFAULT_WALLPAPER_RELATIVE_PATH = WALLPAPER_RELATIVE_PATHS[0];

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
	return isRemovedBuiltInWallpaperPath(path) ? DEFAULT_WALLPAPER_PATH : path;
}
