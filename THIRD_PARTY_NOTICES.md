# Third-Party Notices

This file tracks third-party runtime dependencies and bundled assets that must remain
compatible with ScreenMint's MIT-licensed open-source distribution. Keep this file and
`docs/ASSET_PROVENANCE.md` updated together.

## Runtime Libraries

ScreenMint uses npm dependencies listed in `package.json` and `website/package.json`.
Before each public beta release:

- run a dependency license review from a clean checkout;
- keep Electron, FFmpeg, MediaPipe, PixiJS, React, Radix UI, and native-helper notices
  represented in release materials when an upstream license requires it;
- include any required upstream notices in packaged artifacts when required by the
  upstream license.

## Bundled Runtime Assets

| Path | Purpose | Notice status |
| --- | --- | --- |
| `public/mediapipe/` | MediaPipe Tasks Vision runtime files for webcam segmentation. | Redistributable runtime asset per maintainer attestation; keep upstream notices with release materials when required. |
| `public/models/selfie_segmenter_landscape.tflite` | Webcam segmentation model. | Redistributable model asset per maintainer attestation; keep upstream notices with release materials when required. |
| `public/wasm/web-demuxer.wasm` | Video demuxing runtime used by export/decode paths. | Redistributable runtime asset per maintainer attestation; keep upstream notices with release materials when required. |
| `electron/native/bin/` | Prebuilt macOS helper binaries generated from source in `electron/native`. | Generated artifacts from committed source; rebuild for release builds when possible. |

## Bundled Media

| Path | Purpose | Notice status |
| --- | --- | --- |
| `public/wallpapers/` | Built-in editor backgrounds and generated thumbnails. | Copyright-free redistributable media per maintainer attestation. |
| `src/assets/audio/` | App UI sounds plus built-in editor music packaged into `background-music`. | Copyright-free redistributable media per maintainer attestation, including Mixkit-named files. |
| `src/assets/cursors/` | Built-in cursor artwork and cursor packs. | Copyright-free redistributable media per maintainer attestation. |
| `website/public/images/` | Website previews and demos. | Project-owned, generated, or copyright-free media per maintainer attestation. |

## Removed Duplicates

The unused `public/background-music/*.wav` files were removed so built-in editor music has
one intentional source: `src/assets/audio/`, packaged by
`scripts/build-packaged-assets.mjs`.
