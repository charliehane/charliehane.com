# Forest Cinema — AE Render Brief

The forest section is now driven by a single MP4 you render in After Effects.
The browser scrubs through it as the user scrolls, and three sign hotspots
become clickable as their scroll windows hit.

## Comp settings

| Setting              | Recommended                       | Notes                                       |
|----------------------|-----------------------------------|---------------------------------------------|
| Resolution           | 1920×1080 (16:9)                  | Will be cropped to viewport; render wide.   |
| Frame rate           | 24 fps                            | Cinematic feel; 30 fps also fine.           |
| Duration             | 6–10 seconds                      | Maps to the full 700vh scroll of the forest.|
| Color space          | sRGB                              | Standard web.                               |

The container in the browser uses `object-fit: cover`, so anything past
the 16:9 frame edges gets cropped at narrower viewports. Keep important
elements (signs, the leafy road centerline) in the safe 4:3 center.

## Animation arc

Scroll 0%  → start: low camera angle, looking forward into the forest, horizon high
Scroll 50% → mid: rolling over the planet's crest, signs passing the camera
Scroll 100% → end: descending under the canopy, can fade to dark for transition out

Trees, leaves, dust, motion blur — all the AE things you'd already reach
for. The procedural CSS attempt is gone.

## Sign timing — must match `Editable Text Content.json`

Each sign in `forest.quotes` has `scrollIn` and `scrollOut` (0–1 across
the scroll length). The web overlays a click-target during that window.

| Sign           | scrollIn | scrollOut | When in the comp                  |
|----------------|----------|-----------|-----------------------------------|
| Preproduction  | 0.24     | 0.38      | ~2.4s–3.8s of a 10s render        |
| Production     | 0.50     | 0.64      | ~5.0s–6.4s of a 10s render        |
| Postproduction | 0.78     | 0.92      | ~7.8s–9.2s of a 10s render        |

Animate the sign on-screen during the open window. The hotspot rect
(also in JSON: `hotspot.{x,y,w,h}` as % of viewport) is roughly where
the sign sits — tune it after seeing the render.

Want different timing? Edit the JSON; nothing else needs to change.

## Export

| Setting     | Value                                    |
|-------------|------------------------------------------|
| Format      | H.264 MP4                                |
| Codec opts  | Target ~3–6 Mbps; tune for ≤5 MB total   |
| Audio       | None (muted in browser anyway)           |
| File path   | `assets/forest.mp4`                      |

Optional: also export a WebM (VP9) for ~30% smaller file size on browsers
that support it. The current `<video>` tag only has one `src`; if you do
both, ping me and I'll switch to `<source>` tags with the WebM first.

## Wiring it in

Once `assets/forest.mp4` exists, open `Editable Text Content.json` and
set:

```json
"forest": {
  "videoSrc": "assets/forest.mp4",
  "quotes": [ ... ]
}
```

Refresh. The "forest sequence pending" placeholder disappears, the
video loads, and scrolling scrubs through it.

## Tuning the hotspots

After the render is in, scroll to each sign and check whether the
"↗ tap to read" pill lands on the actual sign in the video. If not:

- Adjust `hotspot.x` / `hotspot.y` to move the click target
- Adjust `hotspot.w` / `hotspot.h` to resize it
- Adjust `scrollIn` / `scrollOut` if the timing's off

You can ship the pill *as the entire affordance* (no need to align
perfectly to the sign artwork) — the user reads the pill and knows
to click. Or hide the pill entirely with CSS for a cleaner look,
relying on cursor change alone.

## Adding videos to the modals

Set `video` on a quote to embed a player in the modal:

```json
{
  "role": "Preproduction",
  ...
  "video": "https://player.vimeo.com/video/123456789"
}
```

Vimeo and YouTube embed URLs are auto-detected and iframed. Anything
else gets a plain `<video controls>`.
