# ScreenMint Brand System

## Source Of Truth
- Master mark: `branding/source-assets/ScreenMint-Mark.svg`
- Primary lockup: `branding/source-assets/ScreenMint.svg`
- Monochrome mark: `branding/source-assets/ScreenMint-Mark-Mono.svg`
- Monochrome lockup: `branding/source-assets/ScreenMint-Mono.svg`
- Export command: `npm run brand:generate`

## Brand Direction
ScreenMint uses a `Luxury Capture` identity: restrained, premium, software-first, and immediately legible as a screen-recording product.

### Palette
- Graphite: `#0D0F13`
- Deep shell: `#111318`
- Soft ivory: `#F4EBDD`
- Champagne amber: `#D1A86A`
- Dark gold: `#815C31`
- Ruby record: `#D03E46`

## Usage Rules

### Clearspace
Maintain clearspace around the mark equal to the height of the recording dot.

### Minimum Size
- Icon mark: never render below `16px`.
- Horizontal lockup: never render below `120px` wide.
- Use the icon-only mark for tray, dock, favicon, and any cramped UI.

### Approved Backgrounds
- Solid near-black or charcoal.
- Warm dark gradients with subtle amber lighting.
- Soft neutral light backgrounds only when using the monochrome version.

### Record Dot Rules
- Always keep the record dot ruby in the full-color mark.
- Never recolor the record dot to green, blue, or amber.
- Never remove the dot from the icon-only version.

## Do Not
- Do not use camera shutter blades.
- Do not add glossy glass, neon gradients, or photo-app styling.
- Do not stretch the lockup or separate the icon and wordmark proportions.
- Do not swap the premium amber shell for bright green branding.

## Export Map
`npm run brand:generate` writes these runtime assets from the master mark:

| Source | Output |
| --- | --- |
| `ScreenMint-Mark.svg` | `branding/source-assets/{16,32,64,128,256,512,1024}-mac.png` |
| `ScreenMint-Mark.svg` | `public/app-icons/screenmint-{16,32,64,128,256,512,1024}.png` |
| `ScreenMint-Mark.svg` | `icons/icons/png/{16,24,32,48,64,128,256,512,1024}x{size}.png` |
| `ScreenMint-Mark.svg` | `icons/icons/mac/icon.icns` |
| `ScreenMint-Mark.svg` | `icons/icons/win/icon.ico` |
| `ScreenMint-Mark.svg` | `website/public/images/screenmint-32.png` |
| `ScreenMint-Mark.svg` | `website/public/images/screenmint-mark.svg` |
| `ScreenMint.svg` | `website/public/images/screenmint-logo.svg` |

## Verification Checklist
- Review the icon at `16`, `32`, `64`, `128`, `256`, `512`, and `1024`.
- Confirm tray readability on macOS.
- Confirm app loading and editor screens use the icon-only mark.
- Confirm website navbar, footer, and favicon use the updated lockup and favicon.
