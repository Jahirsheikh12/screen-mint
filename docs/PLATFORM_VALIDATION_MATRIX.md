# Platform Validation Matrix

This matrix is the release gate for calling ScreenMint "fully working" on macOS, Windows, and
Linux. Automated tests and local code review are not enough for capture claims because screen,
audio, permission, cursor, and GPU behavior differs by OS and hardware.

## Status Legend

- `PASS`: verified on a real host for the target OS.
- `FAIL`: reproduced failure with notes or issue link.
- `BLOCKED`: cannot be verified because a dependency, permission, host, or credential is missing.
- `N/A`: unsupported on that platform by design.
- `PENDING`: not verified yet.

## Real Host Matrix

| Area | macOS 12.3+ | Windows 10 19041+ | Linux modern distros | Evidence |
| --- | --- | --- | --- | --- |
| Clean install with `npm ci` | PENDING | PENDING | PENDING | Record host, CPU/GPU, OS build, Node/npm versions |
| `npm run lint` | PENDING | PENDING | PENDING | Attach command result |
| `npm run lint:repo` | PENDING | PENDING | PENDING | Required before release |
| `npm run test` | PENDING | PENDING | PENDING | Attach test summary |
| `npm run i18n:check` | PENDING | PENDING | PENDING | Attach command result |
| `npm run build:renderer` | PENDING | PENDING | PENDING | Attach build summary |
| Platform package build | PENDING | PENDING | PENDING | `build:mac`, `build:win`, or `build:linux` |
| Display recording | PENDING | PENDING | PENDING | Verify output playback and duration |
| Window recording | PENDING | PENDING | PENDING | Verify correct window and cursor projection |
| Area recording | PENDING | PENDING | PENDING | Verify crop dimensions and cursor projection |
| Screenshot capture | N/A | N/A | N/A | Disabled by feature flag for this production wave |
| Microphone-only audio | PENDING | PENDING | PENDING | Verify exported audio stream |
| System-audio-only capture | PENDING | PENDING | PENDING | Mark N/A where unavailable |
| Mixed microphone + system audio | PENDING | PENDING | PENDING | Verify sync and mix levels |
| No-audio recording | PENDING | PENDING | PENDING | Verify no audio stream is expected |
| Cursor telemetry | PENDING | PENDING | PENDING | Verify hover/click/move samples |
| Cursor hiding | PENDING | PENDING | PENDING | Linux may remain limited |
| Webcam local camera | PENDING | PENDING | PENDING | Verify preview, recording, export |
| Mobile camera pairing | PENDING | PENDING | PENDING | Verify QR/pair/connect/disconnect |
| Captions | PENDING | PENDING | PENDING | Verify generation and transcript export |
| Audio regions/music | PENDING | PENDING | PENDING | Verify built-in and imported audio |
| Project save/reopen | PENDING | PENDING | PENDING | Verify `.screenmint` round trip |
| MP4 export | PENDING | PENDING | PENDING | Verify dimensions, duration, audio |
| GIF export | PENDING | PENDING | PENDING | Verify loop, dimensions, playback |
| Export cancel cleanup | PENDING | PENDING | PENDING | Verify partial output is removed |
| Save dialog export | PENDING | PENDING | PENDING | Verify custom path |
| Recordings-folder export | PENDING | PENDING | PENDING | Verify default output path |

## Known Platform Limits

- Windows WGC capture and cursor helper behavior must be verified on a real Windows 10 build 19041+
  or newer host before publishing Windows claims.
- Linux recording currently uses Electron/Chromium capture paths. The real OS cursor may remain
  visible and cursor-hiding claims must be scoped accordingly.
- macOS release distribution still depends on signing/notarization decisions. Unsigned builds need
  explicit Gatekeeper and permissions guidance in release notes.

## Acceptance Rule

A release may describe a platform as fully working only when every supported row for that platform is
`PASS` or has a documented `N/A` limitation. Any `PENDING`, `BLOCKED`, or `FAIL` row must be called
out in release notes.
