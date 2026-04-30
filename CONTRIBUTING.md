# Contributing to ScreenMint

Thanks for helping improve ScreenMint.

## Setup

```bash
git clone https://github.com/Jahirsheikh12/screen-mint.git
cd screen-mint
npm install
```

## Development Workflow

1. Create a branch for your change.
2. Make the smallest reasonable change set.
3. Run the relevant checks before opening a pull request.

Recommended checks:

- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run i18n:check` when editing locale files

For larger changes, read [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) first and keep refactors
scoped to one domain at a time. Public beta release validation lives in
[docs/BETA_RELEASE_CHECKLIST.md](./docs/BETA_RELEASE_CHECKLIST.md).

## Pull Requests

- Explain the user-facing problem and the fix.
- Include screenshots or a short video for UI changes when useful.
- Mention any platform-specific testing you performed.

## Issues

Report bugs and feature requests here:

- https://github.com/Jahirsheikh12/screen-mint/issues

For security issues, do not open a public issue. Follow [SECURITY.md](./SECURITY.md).

## Sponsorship

If you want to support ScreenMint beyond code contributions, you can sponsor the project on
GitHub Sponsors:

- https://github.com/sponsors/Jahirsheikh12

GitHub Sponsors remains the primary funding path. Any one-time website support checkout is treated
as a separate support purchase rather than the main open-source sponsorship flow.

## License

By contributing, you agree that your contributions are licensed under the [MIT License](./LICENSE).
