# Airport prioritization scene

`PixelAirport` now uses a shared `AirportLayout` composition: a central runway,
parallel taxi lanes to the north and south, and six angled connections. The
road geometry is editable in `src/AirportLayout.tsx`; the aircraft paths are
authored separately in `src/PixelAirport.tsx`.

The first 20 seconds demonstrate a priority change. OpenAir prepares to merge,
then yields when the lower-left Cloud Code aircraft becomes urgent. An amber
route shows its path to the front. OpenAir rejoins behind it and a second Cloud
Code aircraft takes the next position. The remaining planes depart as builds,
approvals, and dependencies clear.

Airborne planes, their shadows, and tooltips remain hidden. Arrivals use the
angled connections to return to the outer taxi lanes. The sequence lasts 66
seconds and retains the orange Cloud Code / green OpenAir narrowbody and
widebody fleet.

## Terrain asset

Saved at `public/airport/airport-terrain-v2.png`, generated with the built-in
image-generation tool from `public/airport/pixel-airport.png`. The roads are
separate from this image, so their geometry and aircraft motion stay aligned.

Prompt:

Use case: precise-object-edit. Edit the supplied simple pixel-art airport backdrop into a clean terrain plate for an animated map. Preserve the exact muted moss green grass palette, sparse tiny grass tufts, crisp pixel-art blocks, soft old-game shading, and straight overhead map viewpoint. REMOVE ALL runway asphalt, ALL taxiways, ALL yellow or white road markings, ALL aprons and pavement, replacing them with continuous matching grass. Keep one small terminal in the extreme upper-left corner occupying only x=25..155 and y=15..115 on a 1280x720 coordinate grid, and one small control tower in the extreme upper-right corner occupying x=1140..1225 and y=20..120. Scale the original terminal down to fit that small corner; retain its blue windows and one small jet bridge. Tower matches original. Rest of image entirely open unobstructed grass so precisely aligned roads and planes can be overlaid later. No aircraft, no text, no roads, no parking lines, no new scenery, no border. Wide 16:9 full-bleed background. Restrained detail.
