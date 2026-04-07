#!/usr/bin/env bash

set -euo pipefail

if [[ "${OSTYPE:-}" != darwin* ]]; then
	echo "This reset script is intended for macOS only."
	exit 1
fi

BUNDLE_ID="com.jahirsheikh.screenmint"
APP_SUPPORT_DIR="${HOME}/Library/Application Support/ScreenMint"

echo "Resetting ScreenMint macOS capture permissions for ${BUNDLE_ID}..."
tccutil reset ScreenCapture "${BUNDLE_ID}" || true
tccutil reset Microphone "${BUNDLE_ID}" || true
tccutil reset Accessibility "${BUNDLE_ID}" || true

echo "Removing targeted stale state while preserving recordings and settings..."
rm -rf "${APP_SUPPORT_DIR}/native-tools"
rm -rf "${APP_SUPPORT_DIR}/Cache"
rm -rf "${APP_SUPPORT_DIR}/GPUCache"
rm -rf "${APP_SUPPORT_DIR}/Session Storage"

echo
echo "Targeted reset complete."
echo "Preserved:"
echo "  ${APP_SUPPORT_DIR}/recordings"
echo "  ${APP_SUPPORT_DIR}/shortcuts.json"
echo "  ${APP_SUPPORT_DIR}/recordings-settings.json"
echo "  ${APP_SUPPORT_DIR}/hud-overlay-settings-full.json"
echo
echo "If ScreenMint is installed in Downloads, Desktop, or another temporary location,"
echo "move ScreenMint.app into /Applications before launching it again."
