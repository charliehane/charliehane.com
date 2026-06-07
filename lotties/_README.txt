============================================================
  LOTTIES/  —  your After Effects animations live here
============================================================

This folder holds Lottie JSON files exported from After Effects.
Each one replaces a corresponding CSS/JS animation in the site.

WORKFLOW (every time you want to add or update an animation):
  1. Pick a slot — see Assets_Specs/*.lottie.todo files for the
     list of available animation slots and their specs.
  2. Build the animation in After Effects matching the spec
     (dimensions, frame rate, loop behavior, color palette).
  3. Export via the Bodymovin / LottieFiles plugin → save the
     resulting .json file in THIS folder, with the exact filename
     listed in the spec (e.g. `wind-streak.json`).
  4. Hard-refresh your browser. Your Lottie replaces the
     fallback animation.

If a .json file isn't here yet, the site uses a built-in
fallback animation (CSS or JS) so nothing ever looks broken.
You can swap one slot at a time without breaking anything else.

============================================================
