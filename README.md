# ScreenMint

Language: EN | [简中](README.zh-CN.md)

ScreenMint is an open-source desktop screen recorder and editor for creating polished walkthroughs, demos, tutorials, and product videos.

## Highlights

- Record a full display or a single window
- Capture microphone and system audio where the platform supports it
- Polish recordings with auto-zoom, cursor effects, custom backgrounds, and annotations
- Edit on a non-destructive timeline with trim, speed, zoom, and styling controls
- Export to MP4 or GIF
- Save projects as `.screenmint` files

## Platform Support

- macOS 12.3+
- Windows 10 build 19041+
- Linux on modern distros

Windows builds older than 19041 fall back to Electron capture and cannot hide the system cursor. Linux recording uses Electron desktop capture, so the real OS cursor may remain visible in recordings.

## Development

```bash
git clone https://github.com/Jahirsheikh12/screen-mint.git
cd screen-mint
npm ci
npm run dev
```

Useful commands:

- `npm run lint`
- `npm run lint:repo`
- `npm run test`
- `npm run i18n:check`
- `npm run build:renderer`
- `npm run build`
- `npm run build:mac`
- `npm run build:win`
- `npm run build:linux`
- `npm run version:patch`
- `npm run version:minor`
- `npm run version:major`
- `npm run version:set -- 1.2.3`

## Public Beta

ScreenMint is preparing for a public beta. Before publishing a release, use the
[beta release checklist](./docs/BETA_RELEASE_CHECKLIST.md) and review
[asset provenance](./docs/ASSET_PROVENANCE.md) for bundled media, models, WASM, and native helper
artifacts.
Third-party runtime and asset notices are tracked in
[THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

## Project Format

ScreenMint saves editor projects as `.screenmint` files. Project serialization lives in `src/components/video-editor/projectPersistence.ts`.

## Architecture

See [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) for the process model, window types, recording
pipeline, editing pipeline, export pipeline, and current refactor targets.

## macOS Note

Unsigned macOS builds are most stable when `ScreenMint.app` is moved into `/Applications` before first launch.

If macOS quarantines the app after you move it there, remove the flag with:

```bash
xattr -rd com.apple.quarantine /Applications/ScreenMint.app
```

If screen capture permissions get stuck or ScreenMint shows blank capture sources, run the targeted reset playbook:

```bash
bash scripts/reset-macos-capture-state.sh
```

This resets ScreenMint-only TCC entries for Screen Recording, Microphone, and Accessibility, and removes stale helper/cache state while preserving recordings and saved settings.

## Project Links

- GitHub: https://github.com/Jahirsheikh12/screen-mint
- Homepage placeholder: https://screenmint.live
- Sponsor ScreenMint: https://github.com/sponsors/Jahirsheikh12

## Support ScreenMint

ScreenMint is free and open source. If you want to help fund bug fixes, polish, and future
releases, you can sponsor the project on GitHub Sponsors:

- https://github.com/sponsors/Jahirsheikh12

If you prefer one-time website support, the support options on `screenmint.live` are designed as
separate card-checkout support purchases and remain secondary to GitHub Sponsors.

## Support And Security

- For bugs and beta support, see [SUPPORT.md](./SUPPORT.md).
- For private vulnerability reports, see [SECURITY.md](./SECURITY.md).

## License

ScreenMint is released under the MIT License. See [LICENSE](./LICENSE).
