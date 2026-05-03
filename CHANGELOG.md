# Changelog

All notable changes to ScreenMint will be documented in this file.

This project follows human-written release notes. Versions should match `package.json` and GitHub
release tags.

## Unreleased

### Added

- Public beta readiness documentation.
- Architecture, asset provenance, support, security, and beta release checklists.
- Shared IPC channel constants now cover capture, recording, export, files, projects, captions,
  updater/settings, HUD, and platform utility channels.
- CI now runs an explicit TypeScript check, and Windows build CI exposes WGC/cursor helper build
  steps before packaging.
- Release workflow now blocks publishing while bundled asset provenance remains unresolved.

### Changed

- Repository cleanup planning now separates public-release hygiene from larger code refactors.
- IPC registration continues moving out of the legacy all-in-one handler file into domain modules.

### Known Beta Focus Areas

- Split large IPC, editor, settings, and recording modules into smaller domains.
- Finish asset provenance review for bundled wallpapers, music, models, WASM, and cursor assets.
- Keep bundled assets in place unless the maintainer explicitly requests removal.
- Validate Windows WGC/cursor helpers on Windows and keep release validation green across macOS,
  Windows, and Linux.
