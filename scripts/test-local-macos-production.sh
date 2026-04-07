#!/usr/bin/env bash

set -euo pipefail

if [[ "${OSTYPE:-}" != darwin* ]]; then
	echo "This script is for macOS only."
	exit 1
fi

ARCH_FLAG="${1:-auto}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

detect_arch() {
	local machine_arch
	machine_arch="$(uname -m)"
	case "${machine_arch}" in
		arm64|aarch64) echo "arm64" ;;
		x86_64) echo "x64" ;;
		*)
			echo "Unsupported mac architecture: ${machine_arch}" >&2
			exit 1
			;;
	esac
}

case "${ARCH_FLAG}" in
	auto) TARGET_ARCH="$(detect_arch)" ;;
	arm64|x64) TARGET_ARCH="${ARCH_FLAG}" ;;
	*)
		echo "Usage: bash scripts/test-local-macos-production.sh [auto|arm64|x64]" >&2
		exit 1
		;;
esac

if [[ "${TARGET_ARCH}" == "arm64" ]]; then
	SOURCE_APP="${ROOT_DIR}/release/mac-arm64/ScreenMint.app"
else
	SOURCE_APP="${ROOT_DIR}/release/mac/ScreenMint.app"
fi

DEST_APP="/Applications/ScreenMint.app"

echo "==> Building local mac production bundles"
cd "${ROOT_DIR}"
npm run build:mac

echo "==> Resetting ScreenMint-only stale macOS capture state"
bash "${ROOT_DIR}/scripts/reset-macos-capture-state.sh"

echo "==> Installing ${TARGET_ARCH} production app to ${DEST_APP}"
rm -rf "${DEST_APP}"
cp -R "${SOURCE_APP}" "${DEST_APP}"

echo "==> Removing quarantine from installed app"
xattr -rd com.apple.quarantine "${DEST_APP}" || true

echo "==> Installed app details"
codesign -dv --verbose=4 "${DEST_APP}" 2>&1 | sed -n '1,20p'

echo
echo "==> Launching installed app"
open "${DEST_APP}"

echo
echo "Next steps:"
echo "1. Grant Screen & System Audio Recording if macOS asks."
echo "2. Quit ScreenMint completely."
echo "3. Reopen only: ${DEST_APP}"
echo "4. Verify the source picker loads from the /Applications copy."
