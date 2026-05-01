# Third-Party Notices

This file tracks third-party runtime dependencies and bundled assets that must remain compatible
with ScreenMint's MIT-licensed open-source distribution. Keep this file and
`docs/ASSET_PROVENANCE.md` updated together.

## Runtime Libraries

ScreenMint uses npm dependencies listed in `package.json` and `website/package.json`. Before each
public beta release:

- run a dependency license review from a clean checkout;
- verify Electron, FFmpeg, MediaPipe, PixiJS, React, Radix UI, and native-helper dependencies remain
  compatible with redistribution;
- include any required upstream notices in release artifacts when required by the upstream license.

## Bundled Runtime Assets

| Path | Purpose | Notice status |
| --- | --- | --- |
| `public/mediapipe/` | MediaPipe Tasks Vision runtime files for webcam segmentation. | Upstream license must be verified before beta release. |
| `public/models/selfie_segmenter_landscape.tflite` | Webcam segmentation model. | Upstream model license must be verified before beta release. |
| `public/wasm/web-demuxer.wasm` | Video demuxing runtime used by export/decode paths. | Upstream package license must be verified before beta release. |
| `electron/native/bin/` | Prebuilt macOS helper binaries generated from source in `electron/native`. | Rebuild from source for releases; do not add new binaries without documenting the build path. |

## Bundled Media

| Path | Purpose | Notice status |
| --- | --- | --- |
| `public/wallpapers/` | Built-in editor backgrounds and generated thumbnails. | Redistribution rights must be confirmed for each source image before beta release. |
| `src/assets/audio/` | App UI sounds plus built-in editor music packaged into `background-music`. | Mixkit-sourced filenames require license confirmation before beta release. |
| `src/assets/cursors/` | Built-in cursor artwork and cursor packs. | Project ownership or compatible license must be confirmed before beta release. |
| `website/public/images/` | Website previews and demos. | Confirm screenshots/demos contain only project-owned or approved content. |

## Removed Duplicates

The unused `public/background-music/*.wav` files were removed so built-in editor music has one
intentional source: `src/assets/audio/`, packaged by `scripts/build-packaged-assets.mjs`.
