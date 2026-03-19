export const REPO_URL = "https://github.com/Jahirsheikh12/screen-mint";
export const RELEASE_DOWNLOAD_BASE_URL = `${REPO_URL}/releases/latest/download`;

export const LICENSE_URL = `${REPO_URL}/blob/main/LICENSE`;
export const CONTRIBUTING_URL = `${REPO_URL}/blob/main/CONTRIBUTING.md`;

export const DOWNLOAD_LINKS = {
	macAppleSilicon: `${RELEASE_DOWNLOAD_BASE_URL}/ScreenMint-arm64.dmg`,
	macIntel: `${RELEASE_DOWNLOAD_BASE_URL}/ScreenMint-x64.dmg`,
	windows: `${RELEASE_DOWNLOAD_BASE_URL}/ScreenMint-windows-x64.exe`,
	linux: `${RELEASE_DOWNLOAD_BASE_URL}/ScreenMint-linux-x64.AppImage`,
} as const;
