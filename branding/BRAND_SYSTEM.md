# ScreenMint Brand System

## Source Of Truth
- Master mark: `branding/source-assets/ScreenMint-Mark.png`
- Export command: `npm run brand:generate`

## Brand Direction
ScreenMint uses a dimensional green-and-gold app-icon identity: polished, high-contrast,
software-first, and immediately legible as a screen-recording product.

### Palette
- Signal green: `#24D85C`
- Lime highlight: `#8EF33C`
- Gold record ring: `#FFB21A`
- Amber center: `#FF8A00`
- Carbon black: `#10191A`

## Usage Rules

### Clearspace
Maintain clearspace around the mark equal to the height of the recording dot.

### Minimum Size
- Icon mark: never render below `16px`.
- Use the icon-only mark for tray, dock, favicon, and any cramped UI.

### Approved Backgrounds
- Solid near-black or charcoal.
- Dark neutral gradients that preserve the green and gold contrast.
- Light backgrounds when the full app icon remains inside its transparent square.

## Do Not
- Do not stretch the lockup or separate the icon and wordmark proportions.
- Do not recolor, flatten, or redraw the mark.
- Do not crop into the visible green app tile or gold record ring.

## Export Map
`npm run brand:generate` trims transparent padding from the master PNG, centers it in a square,
and writes these runtime assets:

| Source | Output |
| --- | --- |
| `ScreenMint-Mark.png` | `branding/source-assets/{16,32,64,128,256,512,1024}-mac.png` |
| `ScreenMint-Mark.png` | `public/app-icons/screenmint-{16,32,64,128,256,512,1024}.png` |
| `ScreenMint-Mark.png` | `icons/icons/png/{16,24,32,48,64,128,256,512,1024}x{size}.png` |
| `ScreenMint-Mark.png` | `icons/icons/mac/icon.icns` |
| `ScreenMint-Mark.png` | `icons/icons/win/icon.ico` |
| `ScreenMint-Mark.png` | `website/public/images/screenmint-{16,32,48,64,180}.png` |
| `ScreenMint-Mark.png` | `website/public/images/screenmint-mark.png` |

## Verification Checklist
- Review the icon at `16`, `32`, `64`, `128`, `256`, `512`, and `1024`.
- Confirm tray readability on macOS.
- Confirm app loading and editor screens use the icon-only mark.
- Confirm website navbar, footer, and favicon use the updated PNG mark.
