# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
- Developers and indie makers recording product demos, launch videos, and bug walkthroughs for GitHub, X, and Product Hunt.
- Educators and creators making tutorials, courses, and how-to videos who want polished results without learning a video editor.
- Product, marketing, and support teams making demo and docs videos, often comparing against paid recorders.

All three are primary for the marketing site; none outranks the others.

## Product Purpose
ScreenMint is a free, open-source desktop screen recorder and editor. It records a display or a single window (with microphone and system audio where the OS allows), then turns the raw take into a polished video: automatic zooms on clicks, cursor smoothing and sway, click highlights, motion blur, wallpaper/gradient/color/image backgrounds with shadow, padding and roundness, annotations, and a non-destructive timeline with trim, speed, and zoom controls. It exports MP4 or GIF and saves editable `.screenmint` projects. Success for the website: a visitor understands that in seconds and downloads the build for their OS.

## Positioning
The polish of paid screen-recording tools, but free, MIT-licensed, and cross-platform (macOS 12.3+, Windows 10 build 19041+, Linux), with no account, no watermark, and no upload: recordings, projects, and exports stay on the user's machine.

## Operating Context
Visitors arrive from GitHub, social posts, and search, usually on a desktop browser, deciding whether to install. Downloads come from the latest GitHub release (`.dmg` for Apple Silicon and Intel, `.exe` for Windows, `.AppImage` for Linux). Unsigned macOS builds may need moving to /Applications and a one-time `xattr -rd com.apple.quarantine` command. The project is funded through GitHub Sponsors tiers and, when enabled, one-time card support via Creem.

## Capabilities and Constraints
- Platform-specific capture: ScreenCaptureKit on macOS, Windows.Graphics.Capture on Windows (fallback on older builds), Electron desktop capture on Linux (the OS cursor may remain visible on Linux).
- Export: MP4 (H.264) or GIF, GPU-accelerated.
- No telemetry, no accounts, no analytics in the app.
- Website stack: Vite + React + Tailwind in `website/`; legal/support pages render from `?page=` query params.

## Brand Commitments
- Name and mark: "ScreenMint" with the green-and-gold app icon (`website/public/images/screenmint-*.png`); do not redraw or recolor the mark.
- Amber/gold stays in the palette.
- The website is dark-themed.
- The website footer (`website/src/components/Footer.tsx`) is frozen: it must not change in markup or rendered appearance.
- The marketing site follows the category standard for screen-recorder landing pages, executed at full craft with no novelty concept; the craft bar is Screen Studio (screen.studio) and Cap (cap.so). Inspiration only: never copy their copy or layouts (user decision, 2026-10-22).

## Evidence on Hand
- Editor screenshots: `website/public/images/preview2.png` (inspector: zoom depth 1.25×–5×, motion blur, shadow/roundness/padding, backgrounds, export quality), `preview3.png` (recording bar over a wallpaper), `preview4.png` (preview with a 3.5× zoom block on the timeline).
- Real exports: `website/public/images/demo.mp4` (auto-zoom on clicks), `CursorLoop.mp4` (smoothed cursor), `CursorSwayDemo.mp4` (cursor sway), each with a `-poster.jpg`.
- Absent and not to be fabricated: testimonials, customer logos, user/download counts, star counts, benchmarks, press.

## Product Principles
1. Show the output, not adjectives: the product's own recordings prove the claim.
2. Free means free: never imply tiers, trials, or paywalls for the app itself.
3. Respect every platform: macOS, Windows, and Linux visitors each get a first-class path to their build.
4. Local by default: privacy and ownership (no account, no upload) are part of the offer.
