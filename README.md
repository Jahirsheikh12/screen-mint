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
git clone https://github.com/Jahirsheikh12/screenmint.git
cd screenmint
npm install
npm run dev
```

Useful commands:

- `npm run build`
- `npm run build:mac`
- `npm run build:win`
- `npm run build:linux`
- `npm run lint`
- `npm run test`
- `npm run i18n:check`

## Project Format

ScreenMint saves editor projects as `.screenmint` files. Project serialization lives in `src/components/video-editor/projectPersistence.ts`.

## macOS Note

Local builds are not signed. If macOS quarantines the app, remove the flag with:

```bash
xattr -rd com.apple.quarantine /Applications/ScreenMint.app
```

## Architecture

ScreenMint is an Electron + React + Vite desktop app with:

- a floating recording HUD
- a dedicated editor window
- a source selector window
- native capture helpers for macOS
- native Windows capture support
- a renderer-driven export pipeline built on PixiJS and Web APIs

## Project Links

- GitHub: https://github.com/Jahirsheikh12/screenmint
- Homepage placeholder: https://screenmint.live

## License

ScreenMint is released under the MIT License. See [LICENSE](./LICENSE).
