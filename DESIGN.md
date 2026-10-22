---
name: ScreenMint
description: Free, open-source screen recorder and editor; the website shows the product's real output in a quiet near-black frame.
colors:
  ink: "#121212"
  ink-raised: "#18181a"
  ink-hover: "#202023"
  nav-glass: "#1a1a1c"
  app-chrome: "#2b2b30"
  paper: "#f4f4f5"
  text-strong: "#ffffff"
  text-secondary: "rgba(255, 255, 255, 0.55)"
  text-tertiary: "rgba(255, 255, 255, 0.5)"
  hairline: "rgba(255, 255, 255, 0.07)"
  reel: "#ffb21a"
  reel-hover: "#ffc247"
typography:
  display:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "clamp(2.5rem, 6vw, 4.625rem)"
    fontWeight: 600
    lineHeight: 1.03
    letterSpacing: "-0.038em"
  headline:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "clamp(2.125rem, 4.2vw, 3.5rem)"
    fontWeight: 600
    lineHeight: 1.05
    letterSpacing: "-0.035em"
  title:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "clamp(1.75rem, 3vw, 2.375rem)"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.03em"
  title-sm:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.02em"
  body-lg:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 400
    lineHeight: 1.6
  body:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.625
  label:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1.4
  label-lg:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: 1.4
  menu-link:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "26px"
    fontWeight: 600
    letterSpacing: "-0.02em"
  caption:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.4
rounded:
  xs: "8px"
  sm: "10px"
  md: "12px"
  lg: "14px"
  xl: "16px"
  stage: "22px"
  2xl: "24px"
  3xl: "28px"
  full: "9999px"
spacing:
  gutter: "20px"
  gutter-md: "32px"
  section: "112px"
  section-md: "160px"
  section-related: "96px"
  section-related-md: "112px"
  title-gap: "48px"
  cell: "20px"
  cell-lg: "32px"
components:
  button-primary:
    backgroundColor: "{colors.reel}"
    textColor: "{colors.ink}"
    typography: "{typography.label-lg}"
    rounded: "{rounded.sm}"
    height: "48px"
    padding: "0 24px"
  button-primary-hover:
    backgroundColor: "{colors.reel-hover}"
  button-primary-compact:
    backgroundColor: "{colors.reel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xs}"
    height: "36px"
    padding: "0 14px"
  button-secondary:
    backgroundColor: "rgba(255, 255, 255, 0.06)"
    textColor: "{colors.paper}"
    typography: "{typography.label-lg}"
    rounded: "{rounded.sm}"
    height: "48px"
    padding: "0 24px"
  button-secondary-hover:
    backgroundColor: "rgba(255, 255, 255, 0.1)"
  window-frame:
    backgroundColor: "{colors.ink-raised}"
    rounded: "{rounded.lg}"
  recording-bar:
    backgroundColor: "{colors.app-chrome}"
    textColor: "{colors.text-strong}"
    rounded: "{rounded.lg}"
    height: "48px"
  nav-bar-floating:
    backgroundColor: "{colors.nav-glass}"
    textColor: "{colors.paper}"
    rounded: "{rounded.lg}"
    height: "56px"
  download-card:
    backgroundColor: "{colors.ink-raised}"
    rounded: "{rounded.xl}"
    padding: "20px"
  download-card-hover:
    backgroundColor: "{colors.ink-hover}"
  panel:
    backgroundColor: "{colors.ink-raised}"
    rounded: "{rounded.2xl}"
    padding: "28px 32px 32px"
  background-stage:
    backgroundColor: "{colors.ink-raised}"
    rounded: "{rounded.stage}"
  wallpaper-swatch:
    rounded: "{rounded.md}"
    size: "48px"
  wallpaper-swatch-sm:
    rounded: "{rounded.md}"
    size: "56px"
  closing-panel:
    backgroundColor: "{colors.ink-raised}"
    rounded: "{rounded.3xl}"
    padding: "64px 24px"
---

# Design System: ScreenMint

## Overview

**Creative North Star: "The Product Is the Picture"**

The ScreenMint website follows the category standard for screen-recorder sites, built to the craft level of Screen Studio and Cap. The product's real output leads. A looping export plays inside a desktop window. Editor screenshots sit bare on the ground. Pieces of the app (the recording bar, timeline zoom blocks, the export controls) are rebuilt in HTML, so every claim is shown working rather than illustrated. Nothing on the page is decoration invented for the concept.

The world is a neutral near-black ground with one raised surface tone and hairline white edges. Type is Geist: large, tight, semibold headings over calm grey body copy. Amber (reel) is the one accent: it marks the primary action, the active state and the FAQ's quick-answer verdicts. Density is generous. Sections breathe on a 112/160px rhythm, tightening to 96/112px where a section continues the one before it. Each section has one heading and one supporting line, and its content is product media or a short spec list, never a grid of equal cards.

Confirmed rejections from the direction: novelty concept worlds, eyebrow and kicker labels above headings, glow and gradient chrome, and grids of equal cards.

**Key Characteristics:**
- Real product media in a desktop-window frame with a long, soft shadow.
- App UI rebuilt in HTML instead of icon tiles.
- Near-black ground (#121212) with one raised tone; edges come from inset hairlines, not borders.
- Amber reserved for the primary action and the active state.
- Geist semibold headings with tight negative tracking; white-alpha greys for all secondary text.
- Motion stays quiet: one scroll-linked moment and one authored moment, and both respect reduced motion.

## Colors

The palette is a near-monochrome dark world with one warm accent used sparingly.

### Primary
- **Reel Amber** (reel): the primary button fill, the active cursor-take dot, the recommended download card's edge and badge, the timeline zoom block while the playhead crosses it, the keyboard focus ring, text selection (at 32%), the caret, the skip link's fill and the hover underline of inline text links. It lives in the frame's "recording light" register.
- **Reel Amber, Lit** (reel-hover): the hover fill for the primary button only.

### Neutral
- **Ink** (ink): the page ground behind the header and main content.
- **Raised Ink** (ink-raised): the single raised surface. It fills the window frame, the How it works track, download cards, the macOS help strip and the closing panel.
- **Raised Ink, Pressed** (ink-hover): the hover state for non-recommended download cards.
- **Nav Glass** (nav-glass): the floating nav pill at 80% opacity with a heavy backdrop blur.
- **App Chrome** (app-chrome): the rebuilt recording bar at 95% opacity. This is the app's own HUD color, so the bar reads as product rather than page.
- **Paper** (paper): default text color on the page shell and in secondary buttons.
- **Pure White** (text-strong): headings, item titles and active nav links.
- **Secondary Grey** (text-secondary): supporting paragraphs, inactive nav links, captions and meta lines.
- **Tertiary Grey** (text-tertiary): descriptions under spec and detail titles.
- **Hairline** (hairline): dividers inside the track, sponsor price list rules and inset card edges. The range runs from 6% to 8% white, depending on context.

### Named Rules
**The One Warm Thing Rule.** Amber marks only the primary action or the current state. If it appears on a heading, an icon tile, a label or a decorative line, it is wrong.

**The White-Alpha Rule.** All secondary text, dividers and quiet fills are white at reduced opacity over ink, never a separately mixed grey. That keeps every grey on the same temperature as the ground.

**The Bundled Wallpaper Rule.** ScreenMint's own wallpapers (the six in website/public/images/wallpapers, copied from the app's public/wallpapers) are a sanctioned surface material, and they are used in exactly two places: the background picker stage and the closing panel. They are product output shown as a photograph, not page chrome, so they never stand in for a CSS gradient or a glow. Copy over a wallpaper sits under an ink scrim at 78%, with supporting text raised to 70% white for contrast.

## Typography

**Display Font:** Geist (with system-ui, sans-serif)
**Body Font:** Geist (with system-ui, sans-serif) for the header and main content
**Label/Mono Font:** system monospace, used only for the copyable terminal command

**Character:** This is a single-family system. Hierarchy comes from size and tracking, never from a second face. Headings are semibold and tightly tracked. Body copy is regular weight in a grey that keeps the page quiet.

### Hierarchy
- **Display** (600, clamp(2.5rem, 6vw, 4.625rem), 1.03): the hero headline only, balanced across two lines.
- **Headline** (600, clamp(2.125rem, 4.2vw, 3.5rem), 1.05): section titles and the closing statement.
- **Title** (600, clamp(1.75rem, 3vw, 2.375rem), 1.1): feature titles inside a section.
- **Title Small** (600, 20px, -0.02em): step names in the How it works track.
- **Body Large** (400, 18px, 1.6): the single supporting line under a heading, capped at about 600-760px.
- **Body** (400, 15-16px, relaxed): spec and detail descriptions, step copy and FAQ answers (FAQ answers are capped at 62ch).
- **Label Large** (600, 16px, 1.4): button text at full size, the nav wordmark (tracked -0.01em), and item titles in spec lists, tier rows and cursor-take toggles.
- **Label** (600, 14px): nav links, the compact nav button, recording-bar items and download-card buttons.
- **Menu Link** (600, 26px, -0.02em): links in the full-screen mobile menu sheet only.
- **Caption** (500, 12-13.5px): the window title, export-control labels, timeline timecodes (tabular numerals) and the meta line under the hero buttons.

### Named Rules
**The Heading Stands Alone Rule.** A heading carries its own weight with one supporting line under it. Nothing sits above it: no eyebrow, no kicker, no numbered label.

**The Tabular Numbers Rule.** Timecodes, step numbers and sponsor amounts use tabular numerals.

## Layout

Content sits in a centered 1120px container (1080px for the hero copy, 1000px or 900px for feature screenshots). Side gutters are 20px, widening to 32px from md. Sections open with 112px of top padding, rising to 160px from md. A section that continues the one before it (Specs after How it works, FAQ after Sponsor) opens with the tighter related gap: 96px, rising to 112px from md. Feature blocks inside a section use the same gap. The space from a section title to its content is 48-64px.

The page alternates three compositions:
- **Centered media:** a heading, then a wide window or screenshot, then a three-column detail list.
- **Split 5:7 or 4:7:** a left column holds the heading, controls or a sticky title, and the right column holds the content.
- **One raised panel:** the How it works track or the closing panel.
- **Stage:** the background picker, a wallpaper stage wide as the feature screenshot (1000px), with its swatch row centered beneath.

Breakpoints are Tailwind defaults (sm 640, md 768, lg 1024). Splits and multi-column lists collapse to one column below lg or sm. The rebuilt recording bar hides below sm. The scroll offset is 88px, which clears the floating nav. The feature blocks carry deep-link ids (`auto-zoom`, `cursor`, `backgrounds`), so links to them land under the same offset.

## Elevation & Depth

The system is mostly tonal. Surfaces separate by stepping from ink to raised ink and by a 1px inset white hairline. Real cast shadows appear only on things that represent physical windows floating above the desktop: the product window, the recording bar, the floating nav, the background picker stage (the app's own framed-output canvas), and editor screenshots (which get a drop shadow).

### Shadow Vocabulary
- **Desktop Window** (`0 0 0 1px rgba(255,255,255,0.09), inset 0 1px 0 rgba(255,255,255,0.06), 0 30px 60px -20px rgba(0,0,0,0.7), 0 80px 140px -60px rgba(0,0,0,0.9)`): the window frame around product media.
- **Floating HUD** (`0 0 0 1px rgba(255,255,255,0.08), 0 18px 40px -12px rgba(0,0,0,0.75)`): the recording bar. The nav pill uses a lighter variant (`0 12px 32px -12px`).
- **Stage** (`0 0 0 1px rgba(255,255,255,0.08), 0 40px 80px -40px rgba(0,0,0,0.9)`): the background picker stage. The editor screenshot on it takes a slightly tighter drop (`drop-shadow(0 24px 32px rgba(0,0,0,0.5))`).
- **Screenshot Drop** (`drop-shadow(0 30px 40px rgba(0,0,0,0.55))`): bare editor PNGs that already carry their own frame.
- **Inset Edge** (`inset 0 0 0 1px rgba(255,255,255,0.07)`): every raised panel and card. The amber variant is `inset 0 0 0 1px rgba(255,178,26,0.55)` and marks the recommended card.
- **Key Button** (`inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -1px 0 rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.35)`): the primary button's slight physical bevel.

### Named Rules
**The Only Windows Float Rule.** A cast shadow means "this is a window above the desktop." Cards and panels never cast shadows; they are edged by an inset hairline. The background picker stage is the one non-window that casts, because it stands for ScreenMint's own exported frame.

**The No Glow Rule.** Shadows are black and directional. Coloured glows and halos are not part of this world.

## Shapes

Corners are soft and follow a macOS-like logic: the bigger the object, the bigger the radius.
- 8px: compact controls, nav links and timeline blocks.
- 10px: buttons and the code strip.
- 12px: the cursor-take toggles and wallpaper swatches.
- 14px: windows, the recording bar, the nav pill and status notes.
- 16px: download cards.
- 22px: the background picker stage.
- 24px: the How it works track.
- 28px: the closing panel.
- Full rounding: only for dots, step numbers and the "Your computer" badge.

Edges are drawn with inset box-shadow hairlines rather than CSS borders, except for list dividers (the sponsor price list and FAQ use 7-8% white rules). Window title bars use three neutral 12px dots at 13% white, never colored traffic lights.

## Components

The landing page is pre-rendered to static HTML at build time and hydrated on the client, so components must not read `window`, `document` or `navigator` during render, only in effects.

### Buttons
Buttons are tactile and plain, like a native key.
- **Shape:** gently rounded at 10px (8px for the compact 36px nav version).
- **Primary:** a reel amber fill with ink text. Weight 600, a 48px height with 24px side padding, and an optional 17px leading icon. A slight bevel comes from the Key Button shadow.
- **Hover / Focus / Active:** hover lifts to reel-hover over 0.2s ease. Active scales to 0.98. Focus is a 2px amber outline at a 3px offset.
- **Secondary:** a 6% white fill with a 10% white inset edge, paper text and weight 500. Hover raises the fill to 10%. It always sits beside or below a primary button and is never the only action.

### Navigation
- At the top, the nav is transparent and spans a 1200px row. After 24px of scroll, it morphs over 500ms into a floating pill: max 1040px wide, 14px radius, nav glass at 80% with a backdrop blur and the Floating HUD shadow.
- The layout is a three-column grid: the logo and wordmark (16px, 600), centered links, and a GitHub icon button plus a compact primary Download button.
- Links are 14px at 55% white, turning white on hover. The section crossing the middle of the viewport sets the active link to white.
- On mobile, the menu opens a full-screen ink sheet with 26px semibold links on hairline rules. The links stagger in at 40ms each, and the primary button is pinned to the bottom.

### Window Frame (signature)
A desktop window around product media. A 36px title bar holds three neutral dots and a centered 12.5px medium title at 55% white, above a hairline. The media below is a looping, muted 16:9 video that switches to controls under reduced motion. The frame uses raised ink, a 14px radius and the Desktop Window shadow. In the hero, it scales from 0.94 to 1 as it scrolls up into view.

### Recording Bar (signature)
ScreenMint's HUD, rebuilt in HTML. It sits over the top edge of the hero window and appears in compact form in step one. The bar is app chrome at 95% with a blur, a 14px radius and a 48px height (44px compact). It holds semibold 14px items (Display, Record, Open) separated by 15% white vertical rules. The Record icon is the app's own record red, which is product fidelity and not a palette color.

### Background Picker (signature)
The background feature, working. The ScreenMint editor screenshot sits framed (7% inset padding) on one of six bundled wallpapers. The stage is 4:3 on mobile and 16:10 from sm, with a 22px radius, raised ink beneath the image, and the Stage shadow (a 1px white hairline plus a long black drop). Only the first wallpaper loads up front; the rest load as the section approaches. Choosing a wallpaper crossfades the stage on opacity over 450ms with the standard ease-out, and the switch is instant under reduced motion.

Below the stage is a centered row of square swatches, 48px (56px from sm) at a 12px radius, 10px apart. At rest, a swatch has a 1px ring at 12% white, which rises to 35% white on hover. The active swatch gets a 2px ink gap and a 2px amber ring outside it, and every swatch presses to 0.95. The swatches are buttons with aria-pressed, inside a group labelled "Background". A 13.5px caption at 55% white sits under the row. The share image (og.jpg, 1200×630, used for the Open Graph and Twitter cards) is the same pairing: the editor screenshot on the black-liquid wallpaper.

### Detail List
A three-column list (one column below sm) under centered media, capped at 1000px, with 48px between columns. Each item sits on a 1px top rule at 8% white with 20px of padding above it. A 15px semibold white title is followed by a 15px relaxed description at 50% white.

### Closing Panel
One 28px-radius panel of raised ink (64px vertical padding, 96px from md) carrying the black-liquid wallpaper under an ink scrim at 78%. The content is raised above both layers: the 72px app mark, a Headline, one supporting line at 70% white (the scrim exception to the 55% default), and a primary and secondary button pair.

### How it works Track
One raised panel (24px radius, inset edge) split 1 : 1.35 : 1 with hairline dividers. Each step starts with a track row: a white 24px numbered circle followed by a 12% white line running to the edge, so the three lines read as one rail. A 260px figure stage holds the rebuilt UI, and each figure plays its step on a shared 6s loop while it is on screen. Record: a pointer glides to the Record button, clicks with a ripple, and a blinking REC pill appears above the bar. Polish: the playhead sweeps the timeline, and the 2.0× zoom block turns amber, and the annotation brightens, exactly while the playhead is over them. Export: the quality pill slides from Medium to Good, then Export video presses, fills with progress (Exporting…) and reports Saved. The step name and copy sit below the figure.

### Download Cards
A 1/2/4-column list of raised-ink cards with a 16px radius, 20px padding and an inset edge. Each card has the OS mark (24px), the name with the chip in a lighter weight, a 14px note, and a full-width 40px button. The card matching the visitor's computer switches to an 8% amber fill, an amber inset edge, a "Your computer" badge and a primary button. The other cards use secondary buttons and hover to ink-hover.

### Sponsor Panel
One way to pay, one button. A raised-ink panel (22px radius, inset edge, max 1000px) splits 5:7. The left column holds a 20px semibold title ("Sponsor monthly on GitHub"), one line on how billing works, and the single "Sponsor on GitHub" secondary button pinned to the bottom with a 14px note under it. The right column is the tier list: a price list, not links, because every tier opens the same GitHub page. Each row is a 26px tabular amount with a 14px "/month" at 45% white, then a 16px semibold name over a 15px description at 55% white, on 7% white dividers. Below the panel come a four-up "help another way" link strip (one inset-edged block with hairline dividers, each link a 15px semibold label with a 16px icon and an arrow that turns white on hover, over a 14px line at 50% white), and the sponsoring questions shown open as a Detail List.

### FAQ
The FAQ opens with quick answers, then topic tabs. Every answer is in the static HTML for search and answer engines: all tab panels are rendered, with the inactive ones `hidden`.
- **Title:** the section title is centered, with the "Send an email" link as its supporting line.
- **Quick answers:** one raised-ink panel (22px radius, inset edge at 7% white) split into four cells by 7% white hairlines: four columns from lg, two from sm, one below. Each cell holds the question (15px semibold at 70% white, two lines tall from sm so the verdicts align), a one-word verdict ("Yes" or "No", 40px semibold, -0.035em, amber) and the answer (15px at 55% white).
- **Topic tabs:** a tablist (Recording, Editing & export, Install & more) on a 1px rule at 8% white, 820px wide. Tabs are 16px semibold (15px below sm), white/50 when inactive and white when selected, with a 2px amber underline and an amber tabular count (counts hide below sm). Arrow keys, Home and End move between tabs.
- **Panel:** each tab shows one raised-ink panel (22px radius, inset edge) of native disclosures, with a separate `name` per panel so one question stays open at a time.
- **Row:** a 7% white divider and 20px of vertical padding. The question is 17px semibold at 85% white, turning white on hover and while open.
- **Toggle:** a 28px amber circle at 12% fill holding an amber plus, which becomes a minus when open. The native marker is hidden.
- **Answer:** 16px at 1.65 line height, 55% white, capped at 62ch.

### Inline Links
Text links inside running copy (the FAQ's "Send an email", the release link under the download cards) are white with an underline at 25% white and a 5px offset. On hover the underline turns amber; the text color does not change. The release link sits centered 20px under the download cards, in a 14px line at 55% white.

### Skip Link
The first focusable element on the page. It is visually hidden until focused, then pins to the top-left at 16px as an amber pill (8px radius, 16px by 8px padding) with 14px semibold ink text, above the nav. It targets `<main id="main">`, which is focusable (tabindex -1) so focus actually moves. Smooth scrolling skips links marked `data-skip-link`, so the browser handles the jump natively.

### Choice Rows
Choice rows are toggles, such as the cursor takes. Each is a 12px-radius row with a 6px status dot. The active row has a 7% white fill and an amber dot. Inactive rows have a 25% white dot and a 4% fill on hover. Switching takes crossfades the media over 0.25s.

### Motion
Motion is quiet and functional. Entrances and crossfades use the standard ease-out curve, cubic-bezier(0.16, 1, 0.3, 1). Colour state changes take 0.2s ease. Wallpaper switches in the background picker crossfade over 450ms. Smooth scrolling uses Lenis (lerp 0.1), and same-page links glide to an 88px offset. The How it works loops pause off screen. Every animation, including Lenis, autoplay and those loops, turns off under prefers-reduced-motion, which shows each figure's still frame instead.

## Do's and Don'ts

### Do:
- **Do** lead every claim with real ScreenMint output: an export in the window frame, a bare editor screenshot, or app UI rebuilt in HTML.
- **Do** keep amber (#ffb21a) on the primary action and the active state only.
- **Do** separate surfaces with raised ink (#18181a) and a 1px inset hairline at 7% white.
- **Do** give headings Geist 600 with negative tracking (-0.03em to -0.038em) and pair each with one supporting line at 55% white.
- **Do** pair the primary button with a secondary button rather than a second amber action.
- **Do** keep the bundled wallpapers to the background picker stage and the closing panel, and put copy over a wallpaper only under an ink scrim at 78%.
- **Do** honor prefers-reduced-motion for every animation, the video autoplay and smooth scroll.

### Don't:
- **Don't** put eyebrow or kicker labels above headings.
- **Don't** use glow shadows, gradient fills or gradient text.
- **Don't** lay features out as a grid of equal cards with icon tiles. Use media, a ruled list, or one raised panel.
- **Don't** cast shadows from cards or panels. Only windows and the recording bar float.
- **Don't** invent proof: no testimonials, logos, counts, stars or benchmarks.
- **Don't** redraw or recolor the green-and-gold ScreenMint mark.
